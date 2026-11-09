package dz.madrasa.app

import android.content.Context
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import java.io.File
import java.security.MessageDigest

/**
 * ملفات هذا الحساب على الهاتف فقط: <files>/acct/<الحساب>/...
 * حساب آخر لا يرى شيئًا منها، والخروج من الحساب يمحوها كلها. لا نسخ احتياطي سحابي (allowBackup=false).
 */
class AccountFiles(private val context: Context) {
    private val root: File get() = File(context.filesDir, "acct")

    fun dir(account: String, vararg parts: String): File {
        var f = File(root, safe(account))
        for (p in parts) f = File(f, safe(p))
        if (!f.exists()) f.mkdirs()
        return f
    }

    fun purge(account: String) {
        File(root, safe(account)).deleteRecursively()
    }

    fun purgeAll() {
        root.deleteRecursively()
    }

    companion object {
        fun safe(name: String): String {
            val cleaned = name.lowercase().replace(Regex("[^a-z0-9._-]"), "_")
            return if (cleaned.isEmpty() || cleaned == "." || cleaned == "..") "_" else cleaned.take(80)
        }

        fun sha1(text: String): String {
            val digest = MessageDigest.getInstance("SHA-1").digest(text.toByteArray(Charsets.UTF_8))
            return digest.joinToString("") { "%02x".format(it) }
        }

        /** كتابة ذرّية: ملف مؤقّت ثم إعادة تسمية، فلا يبقى ملف ناقص إن انقطع شيء. */
        fun writeAtomic(file: File, bytes: ByteArray) {
            file.parentFile?.mkdirs()
            val tmp = File(file.parentFile, file.name + ".tmp")
            tmp.writeBytes(bytes)
            if (!tmp.renameTo(file)) {
                file.delete()
                tmp.renameTo(file)
            }
        }

        fun writeText(file: File, text: String) = writeAtomic(file, text.toByteArray(Charsets.UTF_8))

        fun readText(file: File): String? = try {
            if (file.exists()) file.readText(Charsets.UTF_8) else null
        } catch (e: Exception) {
            null
        }

        fun <T> readJson(file: File, serializer: KSerializer<T>): T? {
            val text = readText(file) ?: return null
            return try {
                JsonCodec.decodeFromString(serializer, text)
            } catch (e: Exception) {
                null
            }
        }

        fun <T> writeJson(file: File, serializer: KSerializer<T>, value: T) {
            writeText(file, JsonCodec.encodeToString(serializer, value))
        }
    }
}

@Serializable
data class CachedResponse(val savedAt: Long, val body: String)

/** آخر ردّ ناجح لكل صفحة، ليُعرض دون إنترنت مع تاريخ حفظه. */
class ResponseCache(private val files: AccountFiles) {
    private fun file(account: String, path: String) = File(files.dir(account, "cache"), AccountFiles.sha1(path) + ".json")

    fun store(account: String, path: String, body: String) {
        try {
            AccountFiles.writeJson(file(account, path), CachedResponse.serializer(), CachedResponse(System.currentTimeMillis(), body))
        } catch (e: Exception) {
        }
    }

    fun load(account: String, path: String): CachedResponse? =
        AccountFiles.readJson(file(account, path), CachedResponse.serializer())
}

@Serializable
data class SavedSession(
    val token: String,
    val expiresAt: String? = null,
    val accountId: String,
    val role: String,
    val name: String? = null,
    val email: String? = null
)

/** الجلسة في التخزين الخاص بالتطبيق (لا يقرؤه تطبيق آخر، ولا يُنسخ احتياطيًا). */
class SessionVault(context: Context) {
    private val prefs = context.getSharedPreferences("madrasa.session", Context.MODE_PRIVATE)

    var session: SavedSession?
        get() = prefs.getString("session", null)?.let {
            try {
                JsonCodec.decodeFromString(SavedSession.serializer(), it)
            } catch (e: Exception) {
                null
            }
        }
        set(value) {
            if (value == null) prefs.edit().remove("session").apply()
            else prefs.edit().putString("session", JsonCodec.encodeToString(SavedSession.serializer(), value)).apply()
        }

    /** مفتاح عشوائي لهذا التثبيت لحدّ «جهاز واحد» في المشاهدة (لا معرّف عتادي). */
    val deviceKey: String
        get() {
            val existing = prefs.getString("device-key", null)
            if (existing != null && existing.length >= 16) return existing
            val bytes = ByteArray(16)
            java.security.SecureRandom().nextBytes(bytes)
            val key = "and-" + bytes.joinToString("") { "%02x".format(it) }
            prefs.edit().putString("device-key", key).apply()
            return key
        }

    var appearance: String
        get() = prefs.getString("appearance", "system") ?: "system"
        set(value) {
            prefs.edit().putString("appearance", value).apply()
        }

    fun hiddenClassmates(account: String): Set<String> = prefs.getStringSet("hidden.$account", emptySet()) ?: emptySet()

    fun setHiddenClassmates(account: String, keys: Set<String>) {
        prefs.edit().putStringSet("hidden.$account", keys).apply()
    }

    fun clearAccountPrefs(account: String) {
        prefs.edit().remove("hidden.$account").apply()
    }
}
