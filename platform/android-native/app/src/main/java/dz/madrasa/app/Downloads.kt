package dz.madrasa.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable
import java.io.File

@Serializable
data class SavedFile(
    val key: String,
    val title: String,
    val savedAt: Long,
    val size: Long,
    val source: String = "lesson"
)

@Serializable
data class SavedFileIndex(val files: List<SavedFile> = emptyList())

/**
 * «ملفاتي دون إنترنت»: ملفات PDF المسموح بتنزيلها، كما يختمها الخادم باسم التلميذ ورمز حسابه
 * (/api/v1/ios/materials/{id}/export). تبقى داخل التطبيق فقط لهذا الحساب، وتُمحى عند الخروج.
 */
class Downloads(private val app: AppModel) {
    var index by mutableStateOf(SavedFileIndex())
        private set
    private var account: String? = null

    private fun dir(): File? = account?.let { app.files.dir(it, "files") }
    private fun indexFile() = dir()?.let { File(it, "index.json") }

    fun activate(accountId: String) {
        account = accountId
        index = indexFile()?.let { AccountFiles.readJson(it, SavedFileIndex.serializer()) } ?: SavedFileIndex()
    }

    fun deactivate() {
        account = null
        index = SavedFileIndex()
    }

    private fun save(next: SavedFileIndex) {
        index = next
        indexFile()?.let { AccountFiles.writeJson(it, SavedFileIndex.serializer(), next) }
    }

    fun file(key: String): File? = dir()?.let { File(it, AccountFiles.safe(key) + ".pdf") }?.takeIf { it.exists() && it.length() > 0 }

    fun isSaved(key: String) = file(key) != null

    /** يحفظ ملفًا مختومًا (درس) أو ملف موضوع (بكالوريا/فرض). المفتاح فريد لكل ملف. */
    suspend fun saveFromServer(key: String, title: String, path: String, source: String): File {
        val bytes = app.api.bytes(path)
        if (bytes.size < 5 || String(bytes, 0, 5, Charsets.ISO_8859_1) != "%PDF-") throw ApiException(ApiException.Kind.INVALID)
        val target = File(dir() ?: throw ApiException(ApiException.Kind.UNAUTHORIZED), AccountFiles.safe(key) + ".pdf")
        AccountFiles.writeAtomic(target, bytes)
        val row = SavedFile(key, title.take(200), System.currentTimeMillis(), bytes.size.toLong(), source)
        save(index.copy(files = listOf(row) + index.files.filter { it.key != key }))
        return target
    }

    /** نسخة مؤقتة للعرض فقط (لا تظهر في «ملفاتي») */
    suspend fun temporary(path: String): File {
        val bytes = app.api.bytes(path)
        if (bytes.size < 5 || String(bytes, 0, 5, Charsets.ISO_8859_1) != "%PDF-") throw ApiException(ApiException.Kind.INVALID)
        val tmp = File(app.context.cacheDir, "view")
        tmp.mkdirs()
        tmp.listFiles()?.forEach { it.delete() }
        val f = File(tmp, AccountFiles.sha1(path) + ".pdf")
        AccountFiles.writeAtomic(f, bytes)
        return f
    }

    fun remove(key: String) {
        file(key)?.delete()
        save(index.copy(files = index.files.filter { it.key != key }))
    }

    val totalBytes: Long get() = index.files.sumOf { it.size }
}
