package dz.madrasa.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

fun CoroutineScope.launchSafe(block: suspend CoroutineScope.() -> Unit): Job = launch {
    try {
        block()
    } catch (e: kotlinx.coroutines.CancellationException) {
        throw e
    } catch (e: Exception) {
    }
}

enum class Phase { LAUNCHING, SIGNED_OUT, READY }

sealed class Heartbeat {
    data object Accepted : Heartbeat()
    data class Blocked(val message: String) : Heartbeat()
    data object Failed : Heartbeat()
}

/**
 * حالة التطبيق كلها في مكان واحد: الجلسة، الاتصال، PLAY دون إنترنت، الملفات، المنظّم.
 * نفس منطق AppModel في تطبيق الآيفون: الحساب الخطأ أو الجلسة المنتهية يُخرجان التلميذ ويمحوان ما حُفظ له.
 */
class AppModel(val context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val api = Api(BuildConfig.BASE_URL)
    val files = AccountFiles(context)
    val vault = SessionVault(context)
    private val cache = ResponseCache(files)
    val play = PlayRepo(this)
    val downloads = Downloads(this)
    private val plannerStore = PlannerStore(context, files)

    var phase by mutableStateOf(Phase.LAUNCHING)
        private set
    var session by mutableStateOf<SavedSession?>(null)
        private set
    var phoneRequired by mutableStateOf(false)
    var online by mutableStateOf(true)
        private set
    var notice by mutableStateOf<String?>(null)
    var supportWaiting by mutableIntStateOf(0)
    var planner by mutableStateOf(PlannerState())
        private set
    var appearance by mutableStateOf(vault.appearance)
        private set
    /** فتح تبويب من إشعار (planner) */
    var pendingTab by mutableStateOf<String?>(null)

    private var busy = false
    private var phonePromptPending = false

    val signedIn: Boolean get() = phase == Phase.READY && session != null
    val accountId: String? get() = session?.accountId
    val deviceKey: String get() = vault.deviceKey

    fun start() {
        watchConnectivity()
        val saved = vault.session
        if (saved == null || saved.role != "STUDENT") {
            vault.session = null
            phase = Phase.SIGNED_OUT
            return
        }
        activate(saved)
        scope.launchSafe { validate() }
    }

    private fun activate(saved: SavedSession) {
        api.use(saved.token, saved.accountId)
        session = saved
        play.activate(saved.accountId)
        downloads.activate(saved.accountId)
        planner = plannerStore.load(saved.accountId)
        Reminders.schedule(context, planner)
        phase = Phase.READY
    }

    fun chooseAppearance(value: String) {
        vault.appearance = value
        appearance = value
    }

    // ── الاتصال ──

    private fun watchConnectivity() {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return
        online = cm.activeNetwork?.let { cm.getNetworkCapabilities(it)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) } ?: false
        try {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    scope.launch {
                        val cameBack = !online
                        online = true
                        if (cameBack && signedIn) play.sync()
                    }
                }

                override fun onLost(network: Network) {
                    scope.launch { online = false }
                }
            })
        } catch (e: Exception) {
        }
    }

    // ── الجلسة ──

    /** يتحقّق من الجلسة المحفوظة عند الخادم ويحدّث الاسم وحالة تأكيد الهاتف */
    suspend fun validate() {
        val current = session ?: return
        try {
            val info = api.getObj("/api/v1/ios/session")
            val user = info.obj("user")
            if (info.bool("authenticated") != true || user.str("id")?.lowercase() != current.accountId.lowercase()) {
                signOutLocally(T("sessionExpired"))
                return
            }
            phoneRequired = info.bool("requiresPhoneVerification") ?: false
            try {
                val me = api.getObj("/api/v1/auth/me")
                if (me.str("userId")?.lowercase() == current.accountId.lowercase()) {
                    val updated = current.copy(name = me.str("fullName"), email = me.str("email"))
                    if (updated != current && session?.accountId == current.accountId) {
                        session = updated
                        vault.session = updated
                    }
                }
            } catch (e: Exception) {
            }
            play.sync()
            refreshSupportBadge()
        } catch (e: ApiException) {
            if (e.kind == ApiException.Kind.UNAUTHORIZED) signOutLocally(T("sessionExpired"))
        }
    }

    /** هاتف أو بريد كما في الموقع. يعيد رسالة خطأ أو null عند النجاح. */
    suspend fun login(identifier: String, password: String): String? {
        val ident = identifier.trim()
        if (ident.isEmpty() || password.isEmpty()) return T("loginMissing")
        if (busy) return null
        busy = true
        try {
            api.use(null, null)
            val body = buildJsonObject {
                put("email", Phone.identifier(ident))
                put("password", password)
                put("deviceName", "تطبيق مدرسة — أندرويد")
            }
            val reply = api.post("/api/v1/auth/login", body, requireSession = false).asObj()
            return completeSignIn(reply)
        } catch (e: ApiException) {
            api.use(null, null)
            if (e.kind == ApiException.Kind.SERVER && e.code == "INVALID_CREDENTIALS") return T("loginInvalid")
            if (e.kind == ApiException.Kind.UNAUTHORIZED) return T("loginInvalid")
            return e.userMessage
        } catch (e: Exception) {
            api.use(null, null)
            return T("error")
        } finally {
            busy = false
        }
    }

    private suspend fun completeSignIn(reply: JsonObject?): String? {
        val token = reply.str("token") ?: return T("error")
        api.use(token, null)
        if (reply.str("role") != "STUDENT") {
            revokeCurrentToken()
            api.use(null, null)
            return T("studentOnly")
        }
        val me = api.getObj("/api/v1/auth/me")
        val accountId = me.str("userId")?.lowercase() ?: return T("error")
        val saved = SavedSession(token, reply.str("expiresAt"), accountId, me.str("role") ?: "STUDENT", me.str("fullName"), me.str("email"))
        vault.session = saved
        activate(saved)
        scope.launchSafe { validate() }
        return null
    }

    fun takePhonePrompt(): Boolean {
        val v = phonePromptPending
        phonePromptPending = false
        return v
    }

    data class SignupFailure(val field: String?, val message: String)

    /** ينشئ حساب تلميذ من داخل التطبيق ثم يدخل به. null عند النجاح. */
    suspend fun register(payload: JsonObject): SignupFailure? {
        if (busy) return null
        busy = true
        try {
            api.use(null, null)
            val reply = api.post("/api/v1/ios/register", payload, requireSession = false).asObj()
            phonePromptPending = true
            busy = false
            val message = completeSignIn(reply)
            if (message != null) {
                phonePromptPending = false
                return SignupFailure(null, message)
            }
            return null
        } catch (e: ApiException) {
            api.use(null, null)
            if (e.kind == ApiException.Kind.SERVER) {
                return when (e.code) {
                    "EMAIL_TAKEN" -> SignupFailure("email", T("signupEmailTaken"))
                    "WEAK_PASSWORD" -> SignupFailure("password", e.serverMessage ?: T("signupField.password"))
                    "RATE_LIMITED" -> SignupFailure(null, T("signupLater"))
                    else -> SignupFailure(null, e.serverMessage ?: T("error"))
                }
            }
            return SignupFailure(null, e.userMessage)
        } catch (e: Exception) {
            api.use(null, null)
            return SignupFailure(null, T("error"))
        } finally {
            busy = false
        }
    }

    private suspend fun revokeCurrentToken() {
        try {
            api.post("/api/v1/ios/logout", buildJsonObject { })
        } catch (e: Exception) {
        }
    }

    suspend fun logout() {
        if (busy || phase != Phase.READY) return
        busy = true
        revokeCurrentToken()
        busy = false
        signOutLocally(T("logoutSuccess"))
    }

    /** حذف الحساب نهائيًا (سياسة Google Play لحذف الحساب). يعيد رسالة خطأ أو null. */
    suspend fun deleteAccount(password: String): String? {
        if (password.isEmpty()) return T("loginMissing")
        if (busy) return null
        busy = true
        try {
            val reply = api.post("/api/v1/ios/account/delete", buildJsonObject { put("password", password); put("confirm", true) }).asObj()
            if (reply.bool("deleted") != true) return T("error")
            busy = false
            signOutLocally(T("accountDeleted"))
            return null
        } catch (e: ApiException) {
            if (e.kind == ApiException.Kind.SERVER && e.code == "INVALID_CREDENTIALS") return T("passwordWrong")
            return e.userMessage
        } finally {
            busy = false
        }
    }

    /** يمحو كل أثر محلي للحساب: الجلسة، النسخ المحفوظة، الملفات، PLAY، الخطة، التذكيرات. */
    fun signOutLocally(message: String?) {
        val account = session?.accountId
        vault.session = null
        api.use(null, null)
        session = null
        phoneRequired = false
        supportWaiting = 0
        planner = PlannerState()
        Reminders.cancelAll(context)
        play.deactivate()
        downloads.deactivate()
        if (account != null) {
            files.purge(account)
            vault.clearAccountPrefs(account)
        }
        context.cacheDir.listFiles()?.forEach { it.deleteRecursively() }
        phase = Phase.SIGNED_OUT
        notice = message
    }

    /** كل شاشة تتلقّى «جلسة منتهية» تستدعي هذا */
    fun handle(e: ApiException) {
        if (e.kind == ApiException.Kind.UNAUTHORIZED && phase == Phase.READY) {
            scope.launch { signOutLocally(T("sessionExpired")) }
        }
    }

    // ── المحتوى: النسخة المحفوظة أولًا، ثم الخادم ──

    fun cached(path: String): Pair<JsonObject, Long>? {
        val account = accountId ?: return null
        val entry = cache.load(account, path) ?: return null
        val root = parseJson(entry.body).asObj() ?: return null
        if (root.bool("ok") != true) return null
        val data = root.obj("data") ?: return null
        return data to entry.savedAt
    }

    suspend fun fetch(path: String): JsonObject {
        val account = accountId
        try {
            val (data, raw) = api.get(path)
            if (account != null && account == accountId) cache.store(account, path, raw)
            return data.asObj() ?: throw ApiException(ApiException.Kind.INVALID)
        } catch (e: ApiException) {
            handle(e)
            throw e
        }
    }

    suspend fun post(path: String, body: JsonObject): JsonObject? {
        try {
            return api.post(path, body).asObj()
        } catch (e: ApiException) {
            handle(e)
            throw e
        }
    }

    /** نبضة المشاهدة كمشغّل الموقع: تعدّ المشاهدة وتفرض جهازًا واحدًا. */
    suspend fun heartbeat(contentId: String, position: Int, delta: Int): Heartbeat {
        return try {
            api.post("/api/v1/media/heartbeat", buildJsonObject {
                put("contentId", contentId.lowercase())
                put("viewerKey", deviceKey)
                put("position", position.coerceIn(0, 24 * 3600))
                put("delta", delta.coerceIn(0, 120))
                put("completed", false)
            })
            Heartbeat.Accepted
        } catch (e: ApiException) {
            if (e.kind == ApiException.Kind.SERVER && e.code == "MEDIA_TOO_MANY_DEVICES") Heartbeat.Blocked(e.serverMessage ?: T("deviceBlocked"))
            else Heartbeat.Failed
        }
    }

    // ── المنظّم ──

    fun updatePlanner(transform: (PlannerState) -> PlannerState) {
        val account = accountId ?: return
        val next = transform(planner)
        planner = next
        plannerStore.save(account, next)
    }

    // ── الدعم ──

    suspend fun refreshSupportBadge() {
        try {
            val data = api.getObj("/api/v1/ios/support")
            supportWaiting = data.objs("tickets").count { it.str("status") == "WAITING_USER" }
        } catch (e: Exception) {
        }
    }

    // ── تأكيد الهاتف ──

    suspend fun refreshPhoneGate(): Boolean {
        return try {
            val status = api.getObj("/api/v1/ios/phone")
            phoneRequired = status.bool("required") ?: false
            !phoneRequired
        } catch (e: Exception) {
            !phoneRequired
        }
    }

    fun hiddenClassmates(): Set<String> = accountId?.let { vault.hiddenClassmates(it) } ?: emptySet()

    fun setHiddenClassmates(keys: Set<String>) {
        accountId?.let { vault.setHiddenClassmates(it, keys) }
    }
}
