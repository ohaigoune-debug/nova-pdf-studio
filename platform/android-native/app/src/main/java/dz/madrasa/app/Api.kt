package dz.madrasa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** فشل طلب: دون اتصال، جلسة منتهية، رفض من الخادم برمزه ورسالته العربية، أو ردّ غير متوقّع. */
class ApiException(
    val kind: Kind,
    val code: String? = null,
    val serverMessage: String? = null,
    val reason: String? = null,
    val status: Int = 0
) : Exception(code ?: kind.name) {
    enum class Kind { OFFLINE, UNAUTHORIZED, SERVER, INVALID }

    /** الرسالة التي تظهر للتلميذ. لا تشير أبدًا إلى شراء أي شيء من داخل التطبيق. */
    val userMessage: String
        get() = when (kind) {
            Kind.OFFLINE -> T("nativeOfflineBody")
            Kind.UNAUTHORIZED -> T("sessionExpired")
            Kind.INVALID -> T("error")
            Kind.SERVER -> when (code) {
                "PLAY_TRIAL_EXPIRED" -> T("playTrialEnded")
                "PLAY_TRIAL_REQUIRED" -> T("playUnavailable")
                "MEDIA_TOO_MANY_DEVICES" -> T("deviceBlocked")
                else -> serverMessage ?: T("error")
            }
        }
}

/**
 * واجهة JSON v1 لموقع madrasadz.com — نفس عقد تطبيق الآيفون:
 *  - الجلسة هي جلسة الموقع نفسها، تُرسَل ككوكي madrasa_session صراحةً (لا مخزن كوكي، لا تحويلات).
 *  - كل ردّ {ok, data} أو {ok:false, error}؛ ورأس X-Madrasadz-Account يجب أن يطابق الحساب المحفوظ.
 *  - رأس X-Madrasadz-Client: ios هو ما تشترطه مسارات الكتابة في الخادم الحالي (حماية من الطلبات
 *    العابرة للمواقع)، فنرسله كما هو حتى يعمل التطبيق على الخادم المنشور دون أي تحديث له،
 *    ونضيف X-Madrasadz-Platform: android ليميّز السجلّ بين الهاتفين.
 */
class Api(val baseUrl: String) {
    @Volatile
    var token: String? = null
        private set

    @Volatile
    var accountId: String? = null
        private set

    private val client: OkHttpClient = OkHttpClient.Builder()
        .followRedirects(false)
        .followSslRedirects(false)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .build()

    private val host: String = baseUrl.removePrefix("https://").substringBefore('/')

    fun use(token: String?, account: String?) {
        this.token = token
        this.accountId = account?.lowercase()
    }

    fun absolute(path: String): String =
        if (path.startsWith("https://")) path else baseUrl.trimEnd('/') + (if (path.startsWith("/")) path else "/$path")

    private fun builder(path: String, requireSession: Boolean): Request.Builder {
        if (requireSession && token == null) throw ApiException(ApiException.Kind.UNAUTHORIZED)
        val b = Request.Builder()
            .url(absolute(path))
            .header("Accept", "application/json")
            .header("X-Madrasadz-Client", "ios")
            .header("X-Madrasadz-Platform", "android")
            .header("User-Agent", "MadrasaAndroid/${BuildConfig.VERSION_NAME}")
        token?.let { b.header("Cookie", "madrasa_session=$it") }
        return b
    }

    private fun fixture(request: Request): Response? {
        if (!Fixtures.enabled) return null
        val body = try {
            val buffer = okio.Buffer()
            request.body?.writeTo(buffer)
            buffer.readUtf8()
        } catch (e: Exception) {
            ""
        }
        val path = request.url.encodedPath + (request.url.encodedQuery?.let { "?$it" } ?: "")
        val (code, text) = Fixtures.respond(request.method, path, body) ?: return null
        return Response.Builder()
            .request(request)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(code)
            .message("fixture")
            .header("Content-Type", "application/json")
            .header("X-Madrasadz-Account", Fixtures.ACCOUNT)
            .body(text.toResponseBody("application/json".toMediaType()))
            .build()
    }

    private suspend fun execute(request: Request): Response = fixture(request) ?: suspendCancellableCoroutine { cont ->
        val call = client.newCall(request)
        cont.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (cont.isActive) cont.resumeWithException(ApiException(ApiException.Kind.OFFLINE))
            }

            override fun onResponse(call: Call, response: Response) {
                if (cont.isActive) cont.resume(response) else response.close()
            }
        })
    }

    private fun checkHost(response: Response) {
        // تحويلٌ (مرفوض أعلاه) أو نطاق آخر ليس ردًّا مقبولًا أبدًا
        if (response.request.url.host != host) throw ApiException(ApiException.Kind.INVALID)
    }

    private fun checkAccount(response: Response) {
        val header = response.header("X-Madrasadz-Account")?.lowercase()
        val expected = accountId
        if (header != null && expected != null && header != expected) throw ApiException(ApiException.Kind.UNAUTHORIZED)
    }

    /** يفكّ الغلاف ويعيد data مع النص الخام (للحفظ دون إنترنت). */
    private fun decode(response: Response, body: String): JsonElement {
        val root = parseJson(body).asObj()
        val error = root.obj("error")
        if (response.code == 401 || error.str("code") == "AUTH_REQUIRED") throw ApiException(ApiException.Kind.UNAUTHORIZED, status = response.code)
        if (error != null && root.bool("ok") == false) {
            throw ApiException(ApiException.Kind.SERVER, error.str("code"), error.str("message"), error.str("reason"), response.code)
        }
        val data = root?.get("data")
        if (response.code !in 200..299 || root.bool("ok") != true || data == null) {
            if (response.code >= 500) throw ApiException(ApiException.Kind.SERVER, "SERVER", status = response.code)
            throw ApiException(ApiException.Kind.INVALID, status = response.code)
        }
        checkAccount(response)
        return data
    }

    suspend fun get(path: String, requireSession: Boolean = true): Pair<JsonElement, String> = withContext(Dispatchers.IO) {
        val request = builder(path, requireSession).get().build()
        execute(request).use { response ->
            checkHost(response)
            val body = try {
                response.body?.string() ?: ""
            } catch (e: IOException) {
                throw ApiException(ApiException.Kind.OFFLINE)
            }
            decode(response, body) to body
        }
    }

    suspend fun getObj(path: String, requireSession: Boolean = true): JsonObject =
        get(path, requireSession).first.asObj() ?: throw ApiException(ApiException.Kind.INVALID)

    suspend fun post(path: String, body: JsonElement, requireSession: Boolean = true): JsonElement = withContext(Dispatchers.IO) {
        val json = JsonCodec.encodeToString(JsonElement.serializer(), body)
        val request = builder(path, requireSession)
            .header("Origin", baseUrl.trimEnd('/'))
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()
        execute(request).use { response ->
            checkHost(response)
            val text = try {
                response.body?.string() ?: ""
            } catch (e: IOException) {
                throw ApiException(ApiException.Kind.OFFLINE)
            }
            decode(response, text)
        }
    }

    suspend fun delete(path: String, body: JsonElement): JsonElement = withContext(Dispatchers.IO) {
        val json = JsonCodec.encodeToString(JsonElement.serializer(), body)
        val request = builder(path, true)
            .header("Origin", baseUrl.trimEnd('/'))
            .delete(json.toRequestBody("application/json".toMediaType()))
            .build()
        execute(request).use { response ->
            checkHost(response)
            decode(response, response.body?.string() ?: "")
        }
    }

    /** بايتات ملف (PDF) بالتحقق نفسه من الحساب. */
    suspend fun bytes(path: String, accept: String = "application/pdf"): ByteArray = withContext(Dispatchers.IO) {
        val request = builder(path, true).header("Accept", accept).get().build()
        execute(request).use { response ->
            checkHost(response)
            if (response.code == 401) throw ApiException(ApiException.Kind.UNAUTHORIZED, status = 401)
            val data = try {
                response.body?.bytes() ?: ByteArray(0)
            } catch (e: IOException) {
                throw ApiException(ApiException.Kind.OFFLINE)
            }
            if (response.code != 200) {
                val root = parseJson(String(data, Charsets.UTF_8)).asObj()
                val error = root.obj("error")
                if (error != null) throw ApiException(ApiException.Kind.SERVER, error.str("code"), error.str("message"), error.str("reason"), response.code)
                throw ApiException(ApiException.Kind.INVALID, status = response.code)
            }
            checkAccount(response)
            data
        }
    }
}
