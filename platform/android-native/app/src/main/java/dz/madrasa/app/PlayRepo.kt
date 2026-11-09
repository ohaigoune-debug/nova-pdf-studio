package dz.madrasa.app

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.util.UUID

@Serializable
data class DownloadedSet(
    val id: String,
    val title: String,
    val subjectCode: String,
    val kind: String,
    val year: Int? = null,
    val checksum: String,
    val downloadedAt: Long
)

@Serializable
data class PlayAttempt(
    val id: String,
    val setId: String,
    val title: String,
    val answers: JsonObject,
    val score: Double,
    val max: Double,
    val scoreTotal: Double,
    val finishedAt: Long,
    val serverScore: Double? = null,
    val serverMax: Double? = null,
    val rejected: Boolean = false
) {
    val pending: Boolean get() = serverScore == null && !rejected
}

@Serializable
data class SavedCardLesson(val id: String, val lessonName: String, val subjectCode: String, val checksum: String, val downloadedAt: Long)

@Serializable
data class CardAnswerRecord(val questionId: String, val answer: JsonObject, val timeMs: Int? = null, val correct: Boolean)

@Serializable
data class CardRound(
    val id: String,
    val lessonId: String,
    val lessonName: String,
    val answers: List<CardAnswerRecord>,
    val estimatedXp: Int,
    val finishedAt: Long,
    val xpEarned: Int? = null,
    val xpTotal: Int? = null,
    val levelTitle: String? = null,
    val lessonMastered: Boolean = false,
    val rejected: Boolean = false
) {
    val pending: Boolean get() = xpEarned == null && !rejected
    val localCorrect: Int get() = answers.count { it.correct }
}

@Serializable
data class PlayIndex(
    val downloaded: List<DownloadedSet> = emptyList(),
    val attempts: List<PlayAttempt> = emptyList(),
    val cardLessons: List<SavedCardLesson> = emptyList(),
    val cardMemory: Map<String, Boolean> = emptyMap(),
    val cardRounds: List<CardRound> = emptyList()
)

/**
 * PLAY دون إنترنت لهذا الحساب: الحزم كما أرسلها الخادم، والنتائج المحلية، والمحاولات المنتهية
 * بانتظار الرفع. الخادم يعيد تصحيح كل محاولة؛ الرفض النهائي (موضوع حُذف، انتهى الوصول) يُعلَّم ولا يُعاد.
 */
class PlayRepo(private val app: AppModel) {
    var index by mutableStateOf(PlayIndex())
        private set
    var syncing by mutableStateOf(false)
        private set

    private var account: String? = null

    private fun dir(vararg parts: String): File? = account?.let { app.files.dir(it, "play", *parts) }
    private fun indexFile() = dir()?.let { File(it, "index.json") }

    val pendingCount: Int get() = index.attempts.count { it.pending } + index.cardRounds.count { it.pending }

    fun activate(accountId: String) {
        account = accountId
        index = indexFile()?.let { AccountFiles.readJson(it, PlayIndex.serializer()) } ?: PlayIndex()
    }

    fun deactivate() {
        account = null
        index = PlayIndex()
    }

    private fun save(next: PlayIndex) {
        index = next
        indexFile()?.let { AccountFiles.writeJson(it, PlayIndex.serializer(), next) }
    }

    // ── مواضيع البكالوريا والفروض ──

    fun savedPackage(id: String): PlayPackage? {
        val f = dir("sets")?.let { File(it, AccountFiles.safe(id) + ".json") } ?: return null
        return PlayPackage.parse(AccountFiles.readText(f)?.let { parseJson(it) }.asObj())
    }

    /** يحمّل الحزمة ويحفظها؛ دون إنترنت يعيد النسخة المحفوظة إن وُجدت. */
    suspend fun openSet(id: String): PlayPackage {
        try {
            val data = app.api.get("/api/v1/ios/play/sets/" + Uri.encode(id)).first.asObj() ?: throw ApiException(ApiException.Kind.INVALID)
            val pkg = PlayPackage.parse(data) ?: throw ApiException(ApiException.Kind.INVALID)
            dir("sets")?.let { AccountFiles.writeText(File(it, AccountFiles.safe(pkg.id) + ".json"), data.toString()) }
            val row = DownloadedSet(pkg.id, pkg.title, pkg.subjectCode, pkg.kind, pkg.year, pkg.checksum, System.currentTimeMillis())
            save(index.copy(downloaded = listOf(row) + index.downloaded.filter { it.id != pkg.id }))
            return pkg
        } catch (e: ApiException) {
            app.handle(e)
            if (e.kind == ApiException.Kind.OFFLINE) savedPackage(id)?.let { return it }
            throw e
        }
    }

    fun removeSet(id: String) {
        dir("sets")?.let { File(it, AccountFiles.safe(id) + ".json").delete() }
        save(index.copy(downloaded = index.downloaded.filter { it.id != id }))
    }

    fun finish(pkg: PlayPackage, answers: Map<String, StepAnswer>): PlayAttempt {
        val local = PlayGrading.score(pkg, answers)
        val json = buildJsonObject { answers.forEach { (k, v) -> put(k, v.toJson()) } }
        val attempt = PlayAttempt(UUID.randomUUID().toString(), pkg.id, pkg.title, json, local.score, local.max, pkg.scoreTotal, System.currentTimeMillis())
        var attempts = listOf(attempt) + index.attempts
        if (attempts.size > 200) {
            val keep = attempts.filter { it.pending }
            attempts = (keep + attempts.filter { !it.pending }).take(200)
        }
        save(index.copy(attempts = attempts))
        app.scope.launchSafe { sync() }
        return attempt
    }

    fun attempts(setId: String): List<PlayAttempt> = index.attempts.filter { it.setId == setId }

    // ── لعبة البطاقات ──

    fun savedCardPack(id: String): CardPack? {
        val f = dir("cards")?.let { File(it, AccountFiles.safe(id) + ".json") } ?: return null
        return CardPack.parse(AccountFiles.readText(f)?.let { parseJson(it) }.asObj())
    }

    suspend fun openCardLesson(id: String): CardPack {
        try {
            val data = app.api.get("/api/v1/ios/play/lessons/" + Uri.encode(id)).first.asObj() ?: throw ApiException(ApiException.Kind.INVALID)
            val pack = CardPack.parse(data) ?: throw ApiException(ApiException.Kind.INVALID)
            dir("cards")?.let { AccountFiles.writeText(File(it, AccountFiles.safe(pack.id) + ".json"), data.toString()) }
            val row = SavedCardLesson(pack.id, pack.lessonName, pack.subjectCode, pack.checksum, System.currentTimeMillis())
            save(index.copy(cardLessons = listOf(row) + index.cardLessons.filter { it.id != pack.id }))
            return pack
        } catch (e: ApiException) {
            app.handle(e)
            if (e.kind == ApiException.Kind.OFFLINE) savedCardPack(id)?.let { return it }
            throw e
        }
    }

    fun finishRound(pack: CardPack, answers: List<CardAnswerRecord>, estimatedXp: Int): CardRound? {
        if (answers.isEmpty()) return null
        val round = CardRound(UUID.randomUUID().toString(), pack.id, pack.lessonName, answers, estimatedXp, System.currentTimeMillis())
        val memory = index.cardMemory.toMutableMap()
        answers.forEach { memory[it.questionId] = it.correct }
        save(index.copy(cardRounds = (listOf(round) + index.cardRounds).take(200), cardMemory = memory))
        app.scope.launchSafe { sync() }
        return round
    }

    fun round(id: String): CardRound? = index.cardRounds.firstOrNull { it.id == id }

    // ── المزامنة ──

    private fun refused(e: ApiException): Boolean =
        e.kind == ApiException.Kind.SERVER && e.status in 400..499 && e.code != "RATE_LIMITED" && e.code != "SERVER"

    /** يرفع المحاولات المعلّقة الأقدم أولًا؛ انقطاع الاتصال أو عطل الخادم يُبقيها معلّقة. */
    suspend fun sync() {
        if (syncing || account == null || !app.signedIn) return
        syncing = true
        try {
            for (round in index.cardRounds.filter { it.pending }.reversed()) {
                val body = buildJsonObject {
                    put("lessonId", round.lessonId)
                    put("answers", buildJsonArray {
                        round.answers.forEach { a ->
                            add(buildJsonObject {
                                put("questionId", a.questionId)
                                put("answer", a.answer)
                                a.timeMs?.let { put("timeMs", it) }
                            })
                        }
                    })
                }
                try {
                    val reply = app.api.post("/api/v1/ios/play/cards/sync", body).asObj()
                    val updated = round.copy(
                        xpEarned = reply.int("xpEarned") ?: 0, xpTotal = reply.int("xpTotal"),
                        levelTitle = reply.obj("level").str("title"), lessonMastered = reply.bool("lessonMastered") ?: false
                    )
                    save(index.copy(cardRounds = index.cardRounds.map { if (it.id == round.id) updated else it }))
                } catch (e: ApiException) {
                    if (e.kind == ApiException.Kind.UNAUTHORIZED) { app.handle(e); return }
                    if (refused(e)) save(index.copy(cardRounds = index.cardRounds.map { if (it.id == round.id) it.copy(rejected = true) else it }))
                    else return
                }
            }
            for (attempt in index.attempts.filter { it.pending }.reversed()) {
                val body = buildJsonObject {
                    put("setId", attempt.setId)
                    put("answers", attempt.answers as JsonElement)
                }
                try {
                    val reply = app.api.post("/api/v1/ios/play/sync", body).asObj()
                    val updated = attempt.copy(serverScore = reply.dbl("score") ?: attempt.score, serverMax = reply.dbl("max") ?: attempt.max)
                    save(index.copy(attempts = index.attempts.map { if (it.id == attempt.id) updated else it }))
                } catch (e: ApiException) {
                    if (e.kind == ApiException.Kind.UNAUTHORIZED) { app.handle(e); return }
                    if (refused(e)) save(index.copy(attempts = index.attempts.map { if (it.id == attempt.id) it.copy(rejected = true) else it }))
                    else return
                }
            }
        } finally {
            syncing = false
        }
    }

    fun purge(accountId: String) {
        if (account == accountId) deactivate()
    }
}

@Suppress("unused")
private fun jsonInt(v: Int) = JsonPrimitive(v)
