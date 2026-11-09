package dz.madrasa.app

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.text.Normalizer
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

// ═══════════════════════════════════════════════════════════════════════════
// مواضيع PLAY التفاعلية (بكالوريا، فروض، اختبارات): الحزمة تحمل مفاتيح الإجابة عمدًا ليتدرّب
// التلميذ دون إنترنت، والخادم يعيد تصحيح كل محاولة تُرفع بمفاتيحه هو (POST /api/v1/ios/play/sync).
// التصحيح هنا نسخة طبق الأصل من platform/src/server/play/exams/engine.ts (gradeStep) ومن PlayModels.swift.
// ═══════════════════════════════════════════════════════════════════════════

data class PlayMedia(val localPath: String, val alt: String, val attribution: String?)

sealed class StepPayload {
    data class Mcq(val options: List<String>) : StepPayload()
    data class Multi(val options: List<String>) : StepPayload()
    data class Fill(val text: String, val bank: List<String>) : StepPayload()
    data class Ordering(val items: List<String>) : StepPayload()
    data class Matching(val lefts: List<String>, val rights: List<String>) : StepPayload()
    data class Portrait(val media: PlayMedia, val options: List<String>) : StepPayload()
    data class Numeric(val unit: String?) : StepPayload()
    data object ShortText : StepPayload()
}

sealed class StepKey {
    data class Mcq(val correct: Int) : StepKey()
    data class Multi(val correct: List<Int>) : StepKey()
    data class Fill(val blanks: List<List<String>>) : StepKey()
    data class Ordering(val order: List<Int>) : StepKey()
    data class Matching(val pairs: List<Int>) : StepKey()
    data class Portrait(val correct: Int) : StepKey()
    data class Numeric(val value: Double, val tolerance: Double) : StepKey()
    data class ShortText(val accepted: List<String>) : StepKey()
}

/** إجابة التلميذ، مرمّزة تمامًا كـ StepAnswer في الخادم. */
sealed class StepAnswer {
    data class Mcq(val choice: Int) : StepAnswer()
    data class Multi(val choices: List<Int>) : StepAnswer()
    data class Fill(val blanks: List<String>) : StepAnswer()
    data class Ordering(val order: List<Int>) : StepAnswer()
    data class Matching(val pairs: List<Int>) : StepAnswer()
    data class Portrait(val choice: Int) : StepAnswer()
    data class Numeric(val value: Double) : StepAnswer()
    data class ShortText(val text: String) : StepAnswer()

    fun toJson(): JsonObject = buildJsonObject {
        when (val a = this@StepAnswer) {
            is Mcq -> { put("type", "mcq"); put("choice", a.choice) }
            is Portrait -> { put("type", "portrait"); put("choice", a.choice) }
            is Multi -> { put("type", "multi"); putJsonArray("choices") { a.choices.forEach { add(JsonPrimitive(it)) } } }
            is Fill -> { put("type", "fill_blank"); putJsonArray("blanks") { a.blanks.forEach { add(JsonPrimitive(it)) } } }
            is Ordering -> { put("type", "ordering"); putJsonArray("order") { a.order.forEach { add(JsonPrimitive(it)) } } }
            is Matching -> { put("type", "matching"); putJsonArray("pairs") { a.pairs.forEach { add(JsonPrimitive(it)) } } }
            is Numeric -> { put("type", "numeric"); put("value", a.value) }
            is ShortText -> { put("type", "short_text"); put("text", a.text) }
        }
    }

    companion object {
        fun fromJson(o: JsonObject?): StepAnswer? = when (o.str("type")) {
            "mcq" -> o.int("choice")?.let { Mcq(it) }
            "portrait" -> o.int("choice")?.let { Portrait(it) }
            "multi" -> Multi(o.ints("choices"))
            "fill_blank" -> Fill(o.strs("blanks"))
            "ordering" -> Ordering(o.ints("order"))
            "matching" -> Matching(o.ints("pairs"))
            "numeric" -> o.dbl("value")?.let { Numeric(it) }
            "short_text" -> o.str("text")?.let { ShortText(it) }
            else -> null
        }
    }
}

data class Verse(val number: String, val first: String, val second: String)

sealed class Excerpt {
    data class Verses(val rows: List<Verse>) : Excerpt()
    data class Prose(val parts: List<String>) : Excerpt()
}

data class SourceDocument(val caption: String, val text: String?, val table: List<List<String>>, val media: PlayMedia?)
data class SourceQuestion(val number: String, val part: String, val text: String, val documents: List<SourceDocument>)

data class PlayStep(
    val id: String,
    val index: Int,
    val prompt: String,
    val payload: StepPayload,
    val key: StepKey,
    val points: Double,
    val explanation: String,
    val correctText: String,
    val rubricLabel: String?,
    val excerpt: Excerpt?,
    val source: SourceQuestion?
) {
    /** عدد الفراغات (يعلّمها الخادم بـ ____) */
    val blankCount: Int
        get() = (payload as? StepPayload.Fill)?.let { max(0, it.text.split("____").size - 1) } ?: 0

    companion object {
        private fun media(o: JsonObject?): PlayMedia? {
            val path = o.str("local_path") ?: return null
            return PlayMedia(path, o.str("alt") ?: "", o.str("attribution"))
        }

        fun parse(o: JsonObject): PlayStep? {
            val id = o.str("id") ?: return null
            val prompt = o.str("prompt") ?: return null
            val p = o.obj("payload") ?: return null
            val k = o.obj("answer") ?: return null
            val pair: Pair<StepPayload, StepKey> = when (o.str("type")) {
                "mcq" -> StepPayload.Mcq(p.strs("options")) to StepKey.Mcq(k.int("correct") ?: return null)
                "multi" -> StepPayload.Multi(p.strs("options")) to StepKey.Multi(k.ints("correct"))
                "fill_blank" -> StepPayload.Fill(p.str("text") ?: return null, p.strs("bank")) to
                    StepKey.Fill(k.arr("blanks").map { el -> (el as? JsonArray)?.mapNotNull { it.asText() } ?: emptyList() })
                "ordering" -> StepPayload.Ordering(p.strs("items")) to StepKey.Ordering(k.ints("order"))
                "matching" -> StepPayload.Matching(p.strs("lefts"), p.strs("rights")) to StepKey.Matching(k.ints("pairs"))
                "portrait" -> StepPayload.Portrait(media(p.obj("media")) ?: return null, p.strs("options")) to StepKey.Portrait(k.int("correct") ?: return null)
                "numeric" -> StepPayload.Numeric(p.str("unit")) to StepKey.Numeric(k.dbl("value") ?: return null, k.dbl("tolerance") ?: 0.0)
                "short_text" -> StepPayload.ShortText to StepKey.ShortText(k.strs("accepted"))
                else -> return null
            }
            val e = o.obj("excerpt")
            val excerpt: Excerpt? = when (e.str("kind")) {
                "verses" -> e.objs("rows").map { Verse(it.str("n") ?: "", it.str("a") ?: "", it.str("b") ?: "") }
                    .takeIf { it.isNotEmpty() }?.let { Excerpt.Verses(it) }
                "prose" -> e.strs("parts").takeIf { it.isNotEmpty() }?.let { Excerpt.Prose(it) }
                else -> null
            }
            val s = o.obj("source_question")
            val source = s?.let {
                SourceQuestion(
                    it.str("number") ?: "", it.str("part") ?: "", it.str("verbatim_text") ?: "",
                    it.objs("documents").map { d ->
                        SourceDocument(
                            d.str("caption") ?: "", d.str("text"),
                            d.arr("table").map { row -> (row as? JsonArray)?.mapNotNull { c -> c.asText() } ?: emptyList() },
                            media(d.obj("media"))
                        )
                    }
                )
            }
            return PlayStep(
                id, o.int("index") ?: 0, prompt, pair.first, pair.second, o.dbl("points") ?: 0.0,
                o.str("explanation") ?: "", o.str("correctText") ?: "", o.text("rubric_label"), excerpt, source
            )
        }
    }
}

data class PlayPackage(
    val id: String,
    val setId: String,
    val checksum: String,
    val kind: String,
    val year: Int?,
    val title: String,
    val subjectCode: String,
    val language: String,
    val scoreTotal: Double,
    val maxScore: Double,
    val steps: List<PlayStep>
) {
    val isLeftToRight: Boolean get() = language == "fr" || language == "en"

    companion object {
        fun parse(o: JsonObject?): PlayPackage? {
            if (o == null) return null
            val id = o.str("id") ?: return null
            val title = o.str("title") ?: return null
            val steps = o.objs("steps").mapNotNull { PlayStep.parse(it) }.sortedBy { it.index }
            val declared = o.dbl("maxScore") ?: 0.0
            return PlayPackage(
                id, o.str("setId") ?: id, o.str("checksum") ?: "", o.str("kind") ?: "TEST", o.int("year"), title,
                o.str("subjectCode") ?: "", o.str("language") ?: "ar", o.dbl("scoreTotal") ?: 20.0,
                if (declared > 0) declared else steps.sumOf { it.points }, steps
            )
        }
    }
}

data class Score(val score: Double, val max: Double)

object PlayGrading {
    /** 0…1 لسؤال واحد؛ جزئي للأنواع المركّبة. إجابة ناقصة أو من نوع آخر = 0. */
    fun grade(step: PlayStep, answer: StepAnswer?): Double {
        if (answer == null) return 0.0
        val key = step.key
        return when {
            key is StepKey.Mcq && answer is StepAnswer.Mcq -> if (answer.choice == key.correct) 1.0 else 0.0
            key is StepKey.Portrait && answer is StepAnswer.Portrait -> if (answer.choice == key.correct) 1.0 else 0.0
            key is StepKey.Multi && answer is StepAnswer.Multi -> {
                val want = key.correct.toSet()
                var hit = 0
                var wrong = 0
                for (c in answer.choices.toSet()) if (c in want) hit++ else wrong++
                max(0.0, min(1.0, (hit - wrong).toDouble() / max(1, want.size).toDouble()))
            }
            key is StepKey.Fill && answer is StepAnswer.Fill -> {
                val bank = (step.payload as? StepPayload.Fill)?.bank ?: emptyList()
                // صارم إذا اختلفت كلمتان من بنك الكلمات بالشكل فقط (الإعراب، العروض)
                val strict = bank.map { normalizeArabic(it) }.toSet().size != bank.size
                var ok = 0
                key.blanks.forEachIndexed { i, alternatives ->
                    if (i < answer.blanks.size) {
                        val value = answer.blanks[i]
                        if (alternatives.any { exact(it) == exact(value) || (!strict && normalizeArabic(it) == normalizeArabic(value)) }) ok++
                    }
                }
                ok.toDouble() / max(1, key.blanks.size).toDouble()
            }
            key is StepKey.Ordering && answer is StepAnswer.Ordering -> sameOrder(key.order, answer.order)
            key is StepKey.Matching && answer is StepAnswer.Matching -> sameOrder(key.pairs, answer.pairs)
            key is StepKey.Numeric && answer is StepAnswer.Numeric ->
                if (answer.value.isFinite() && abs(answer.value - key.value) <= key.tolerance + 1e-6) 1.0 else 0.0
            key is StepKey.ShortText && answer is StepAnswer.ShortText -> {
                val wanted = normalizeArabic(answer.text)
                if (key.accepted.any { normalizeArabic(it) == wanted }) 1.0 else 0.0
            }
            else -> 0.0
        }
    }

    private fun sameOrder(order: List<Int>, given: List<Int>): Double {
        if (given.size != order.size) return 0.0
        val ok = order.indices.count { order[it] == given[it] }
        return ok.toDouble() / max(1, order.size).toDouble()
    }

    /** Σ(النقاط × التصحيح)؛ السؤال دون إجابة = 0 */
    fun score(pkg: PlayPackage, answers: Map<String, StepAnswer>): Score {
        var s = 0.0
        var m = 0.0
        for (step in pkg.steps) {
            s += step.points * grade(step, answers[step.id])
            m += step.points
        }
        return Score(s, m)
    }

    /** النتيجة على سلّم الورقة (20 في البكالوريا) كما يعرضها الموقع */
    fun scaled(score: Score, total: Double): Double {
        if (score.max <= 0) return 0.0
        return (score.score / score.max * total * 100).roundToLong() / 100.0
    }

    // نسخة من src/server/lib/arabic.ts normalizeArabic
    fun normalizeArabic(input: String): String {
        val nfkc = Normalizer.normalize(input, Normalizer.Form.NFKC)
        val out = StringBuilder()
        var i = 0
        while (i < nfkc.length) {
            val cp = nfkc.codePointAt(i)
            i += Character.charCount(cp)
            when {
                cp in 0x064B..0x0652 || cp == 0x0670 || cp == 0x0640 -> {}
                cp == 0x0623 || cp == 0x0625 || cp == 0x0622 || cp == 0x0671 -> out.append('ا')
                cp == 0x0629 -> out.append('ه')
                cp == 0x0649 || cp == 0x0626 -> out.append('ي')
                cp == 0x0624 -> out.append('و')
                isSpace(cp) || isLetterOrDigit(cp) -> out.appendCodePoint(cp)
                else -> out.append(' ')
            }
        }
        return collapse(out.toString().lowercase())
    }

    /** مقارنة دقيقة (بالحركات والرموز): يُتسامح فقط في المسافات والتركيب */
    fun exact(input: String): String = collapse(Normalizer.normalize(input, Normalizer.Form.NFC))

    private fun isSpace(cp: Int) = Character.isWhitespace(cp) || Character.isSpaceChar(cp)

    private fun isLetterOrDigit(cp: Int): Boolean = when (Character.getType(cp).toByte()) {
        Character.UPPERCASE_LETTER, Character.LOWERCASE_LETTER, Character.TITLECASE_LETTER, Character.MODIFIER_LETTER,
        Character.OTHER_LETTER, Character.DECIMAL_DIGIT_NUMBER, Character.LETTER_NUMBER, Character.OTHER_NUMBER -> true
        else -> false
    }

    fun collapse(input: String): String {
        val sb = StringBuilder()
        var pendingSpace = false
        var i = 0
        while (i < input.length) {
            val cp = input.codePointAt(i)
            i += Character.charCount(cp)
            if (isSpace(cp)) {
                pendingSpace = sb.isNotEmpty()
            } else {
                if (pendingSpace) sb.append(' ')
                pendingSpace = false
                sb.appendCodePoint(cp)
            }
        }
        return sb.toString()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// لعبة البطاقات (دروس كل مادة): حزمة الدرس تُحفظ بمفاتيحها فتُلعب الجولة دون إنترنت،
// والخادم يعيد تصحيح كل جولة تُرفع بمحرّكه (platform/src/server/play/engine.ts gradePlayAnswer).
// ═══════════════════════════════════════════════════════════════════════════

data class CardOption(val key: String, val text: String)

sealed class CardSegment {
    data class Text(val text: String) : CardSegment()
    data class Blank(val index: Int) : CardSegment()
}

sealed class CardPayload {
    data class Mcq(val options: List<CardOption>) : CardPayload()
    data class Fill(val segments: List<CardSegment>, val blanks: Int, val bank: List<String>) : CardPayload()
    data class Matching(val lefts: List<CardOption>, val rights: List<CardOption>) : CardPayload()
    data class Ordering(val items: List<CardOption>) : CardPayload()
}

sealed class CardKey {
    data class Mcq(val correct: String) : CardKey()
    data class Fill(val answers: List<List<String>>) : CardKey()
    data class Matching(val pairs: Map<String, String>) : CardKey()
    data class Ordering(val order: List<String>) : CardKey()
}

/** الإجابة تمامًا كـ PlayStudentAnswer في الخادم */
sealed class CardAnswer {
    data class Mcq(val key: String) : CardAnswer()
    data class Fill(val blanks: List<String>) : CardAnswer()
    data class Matching(val matches: Map<String, String>) : CardAnswer()
    data class Ordering(val order: List<String>) : CardAnswer()

    fun toJson(): JsonObject = buildJsonObject {
        when (val a = this@CardAnswer) {
            is Mcq -> { put("type", "MCQ"); put("key", a.key) }
            is Fill -> { put("type", "FILL_BLANK"); putJsonArray("blanks") { a.blanks.forEach { add(JsonPrimitive(it)) } } }
            is Matching -> { put("type", "MATCHING"); putJsonObject("matches") { a.matches.forEach { (k, v) -> put(k, v) } } }
            is Ordering -> { put("type", "ORDERING"); putJsonArray("order") { a.order.forEach { add(JsonPrimitive(it)) } } }
        }
    }

    companion object {
        fun fromJson(o: JsonObject?): CardAnswer? = when (o.str("type")) {
            "MCQ" -> o.str("key")?.let { Mcq(it) }
            "FILL_BLANK" -> Fill(o.strs("blanks"))
            "MATCHING" -> Matching(o.obj("matches")?.mapNotNull { (k, v) -> v.asText()?.let { k to it } }?.toMap() ?: emptyMap())
            "ORDERING" -> Ordering(o.strs("order"))
            else -> null
        }
    }
}

data class CardQuestion(
    val id: String,
    val difficulty: String,
    val language: String,
    val text: String,
    val payload: CardPayload,
    val key: CardKey,
    val explanation: String,
    val correctText: String
) {
    val isHard: Boolean get() = difficulty == "HARD"
    val isLeftToRight: Boolean get() = language == "fr" || language == "en"

    companion object {
        private fun options(list: List<JsonObject>) = list.mapNotNull { o ->
            val k = o.str("key") ?: return@mapNotNull null
            CardOption(k, o.str("text") ?: "")
        }

        fun parse(o: JsonObject): CardQuestion? {
            val id = o.str("id") ?: return null
            val text = o.str("questionText") ?: return null
            val p = o.obj("payload") ?: return null
            val k = o.obj("answerKey") ?: return null
            val pair: Pair<CardPayload, CardKey> = when (o.str("type")) {
                "MCQ" -> CardPayload.Mcq(options(p.objs("options"))) to CardKey.Mcq(k.str("correct") ?: return null)
                "FILL_BLANK" -> {
                    val segments = p.objs("segments").map { s ->
                        val b = s.int("b")
                        if (b != null) CardSegment.Blank(b) else CardSegment.Text(s.str("t") ?: "")
                    }
                    val blanks = p.int("blanks") ?: segments.count { it is CardSegment.Blank }
                    CardPayload.Fill(segments, blanks, p.strs("bank")) to
                        CardKey.Fill(k.arr("answers").map { el -> (el as? JsonArray)?.mapNotNull { it.asText() } ?: emptyList() })
                }
                "MATCHING" -> CardPayload.Matching(options(p.objs("lefts")), options(p.objs("rights"))) to
                    CardKey.Matching(k.obj("pairs")?.mapNotNull { (a, b) -> b.asText()?.let { a to it } }?.toMap() ?: return null)
                "ORDERING" -> CardPayload.Ordering(options(p.objs("items"))) to CardKey.Ordering(k.strs("order"))
                else -> return null
            }
            return CardQuestion(
                id, o.str("difficulty") ?: "MEDIUM", o.str("language") ?: "ar", text, pair.first, pair.second,
                o.str("explanation") ?: "", o.str("correctText") ?: ""
            )
        }
    }
}

data class XpRules(val correct: Int = 10, val correctHard: Int = 15, val sessionComplete: Int = 30)

data class CardPack(
    val id: String,
    val subjectCode: String,
    val unitName: String,
    val lessonName: String,
    val language: String,
    val checksum: String,
    val roundSize: Int,
    val xp: XpRules,
    val questions: List<CardQuestion>
) {
    companion object {
        fun parse(o: JsonObject?): CardPack? {
            val lesson = o.obj("lesson") ?: return null
            val id = lesson.str("id") ?: return null
            val name = lesson.str("lessonName") ?: return null
            val x = o.obj("xp")
            return CardPack(
                id, lesson.str("subjectCode") ?: "", lesson.str("unitName") ?: "", name, lesson.str("language") ?: "ar",
                o.str("checksum") ?: "", max(1, o.int("roundSize") ?: 12),
                XpRules(x.int("correct") ?: 10, x.int("correctHard") ?: 15, x.int("sessionComplete") ?: 30),
                o.objs("questions").mapNotNull { CardQuestion.parse(it) }
            )
        }
    }
}

data class CardGrade(val isCorrect: Boolean, val score: Double)

object CardGrading {
    /** s.normalize('NFKC').replace(/ـ/g,'').replace(/\s+/g,' ').trim() — الحركات معتبرة */
    fun exactToken(s: String): String =
        PlayGrading.collapse(Normalizer.normalize(s, Normalizer.Form.NFKC).replace("ـ", ""))

    fun grade(q: CardQuestion, answer: CardAnswer?): CardGrade {
        if (answer == null) return CardGrade(false, 0.0)
        val key = q.key
        return when {
            key is CardKey.Mcq && answer is CardAnswer.Mcq ->
                if (answer.key == key.correct) CardGrade(true, 1.0) else CardGrade(false, 0.0)
            key is CardKey.Fill && answer is CardAnswer.Fill -> {
                var hit = 0
                key.answers.forEachIndexed { i, alts ->
                    val g = exactToken(if (i < answer.blanks.size) answer.blanks[i] else "")
                    if (g.isNotEmpty() && alts.contains(g)) hit++
                }
                val score = if (key.answers.isEmpty()) 0.0 else hit.toDouble() / key.answers.size
                CardGrade(key.answers.isNotEmpty() && hit == key.answers.size, score)
            }
            key is CardKey.Matching && answer is CardAnswer.Matching -> {
                val hit = key.pairs.count { (l, r) -> answer.matches[l] == r }
                CardGrade(hit == key.pairs.size, if (key.pairs.isEmpty()) 0.0 else hit.toDouble() / key.pairs.size)
            }
            key is CardKey.Ordering && answer is CardAnswer.Ordering -> {
                val complete = answer.order.size == key.order.size && answer.order.indices.all { answer.order[it] == key.order[it] }
                var hit = 0
                key.order.forEachIndexed { i, k -> if (i < answer.order.size && answer.order[i] == k) hit++ }
                CardGrade(complete, if (key.order.isEmpty()) 0.0 else hit.toDouble() / key.order.size)
            }
            else -> CardGrade(false, 0.0)
        }
    }

    /** XP المرجّح الذي سيمنحه الخادم (يظهر حتى تُرفع الجولة) */
    fun estimatedXp(questions: List<CardQuestion>, results: Map<String, CardGrade>, rules: XpRules, complete: Boolean): Int {
        var xp = 0
        for (q in questions) if (results[q.id]?.isCorrect == true) xp += if (q.isHard) rules.correctHard else rules.correct
        if (complete && results.isNotEmpty()) xp += rules.sessionComplete
        return xp
    }

    /** يختار جولة: غير المرئية والخاطئة أولًا، ثم الباقي؛ من السهل إلى الصعب كالموقع. */
    fun pickRound(pack: CardPack, size: Int, memory: Map<String, Boolean>, seed: Long): List<CardQuestion> {
        val gen = SeededRandom(seed)
        fun weight(q: CardQuestion): Double = when (memory[q.id]) {
            null -> 1.5
            false -> 2.2
            true -> 0.4
        }
        val pool = pack.questions.toMutableList()
        val picked = mutableListOf<CardQuestion>()
        val count = min(max(1, size), pool.size)
        while (picked.size < count && pool.isNotEmpty()) {
            val total = pool.sumOf { weight(it) }
            var r = (gen.next() % 1_000_000uL).toDouble() / 1_000_000.0 * total
            var index = pool.size - 1
            for ((i, q) in pool.withIndex()) {
                r -= weight(q)
                if (r <= 0) {
                    index = i
                    break
                }
            }
            picked.add(pool.removeAt(index))
        }
        val rank = mapOf("EASY" to 0, "MEDIUM" to 1, "HARD" to 2)
        return picked.withIndex().sortedWith(compareBy({ rank[it.value.difficulty] ?: 1 }, { it.index })).map { it.value }
    }

    /** عرض مخلوط للبطاقة (الخيارات، البنك، العمود الأيسر، العناصر)؛ الترتيب لا يبدأ محلولًا أبدًا. */
    fun shuffled(payload: CardPayload, seed: Long): CardPayload {
        val gen = SeededRandom(seed)
        return when (payload) {
            is CardPayload.Mcq -> CardPayload.Mcq(gen.shuffle(payload.options))
            is CardPayload.Fill -> payload.copy(bank = gen.shuffle(payload.bank))
            is CardPayload.Matching -> payload.copy(rights = gen.shuffle(payload.rights))
            is CardPayload.Ordering -> {
                var out = gen.shuffle(payload.items)
                if (out.size > 1 && out == payload.items) out = out.drop(1) + out[0]
                CardPayload.Ordering(out)
            }
        }
    }
}

/** مولّد حتمي صغير (SplitMix64) فتبقى الجولة ثابتة أثناء اللعب — مثل تطبيق الآيفون. */
class SeededRandom(seed: Long) {
    private var state: ULong = seed.toULong() + 0x9E3779B97F4A7C15uL

    fun next(): ULong {
        state += 0x9E3779B97F4A7C15uL
        var z = state
        z = (z xor (z shr 30)) * 0xBF58476D1CE4E5B9uL
        z = (z xor (z shr 27)) * 0x94D049BB133111EBuL
        return z xor (z shr 31)
    }

    fun <T> shuffle(list: List<T>): List<T> {
        val out = list.toMutableList()
        for (i in out.size - 1 downTo 1) {
            val j = (next() % (i + 1).toULong()).toInt()
            val t = out[i]
            out[i] = out[j]
            out[j] = t
        }
        return out
    }
}

fun JsonElement?.answerMap(): Map<String, StepAnswer> =
    (this as? JsonObject)?.mapNotNull { (k, v) -> StepAnswer.fromJson(v as? JsonObject)?.let { k to it } }?.toMap() ?: emptyMap()
