package dz.madrasa.app

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.Window
import android.view.WindowManager
import android.webkit.PermissionRequest
import java.util.WeakHashMap

/**
 * حماية مشغّل الدرس على أندرويد (16 نوفمبر 2026، بطلب المالك):
 *
 * 1. FLAG_SECURE ما دام مشغّل فيديو ظاهرًا: لقطة الشاشة وتسجيلها يخرجان سوداوين، والتلميذ يرى الدرس
 *    عاديًا. الشاشة لا تسودّ له (هذا غير الحماية القديمة في الآيفون). تُرفع الراية عند مغادرة المشغّل،
 *    فتبقى لقطات PLAY وملفات PDF ممكنة.
 * 2. إذن «المحتوى المحمي» (Widevine) داخل WebView لمشغّل Bunny وحده: بلا هذا الإذن يرفض WebView
 *    تشغيل فيديو MediaCage Enterprise DRM.
 *
 * دوال أندرويد خالصة (بلا Compose) حتى تُترجَم وتُراجَع وحدها.
 */
object VideoGuard {
    /** عدد المشغّلات الظاهرة في كل نافذة (قد يعرض الدرس أكثر من فيديو) */
    private val holders = WeakHashMap<Window, Int>()

    /** يُستدعى عند ظهور مشغّل. الخيط الرئيسي فقط (DisposableEffect). */
    @JvmStatic
    fun acquireSecure(activity: Activity?) {
        val window = activity?.window ?: return
        val count = (holders[window] ?: 0) + 1
        holders[window] = count
        if (count == 1) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    /** يُستدعى عند اختفاء المشغّل؛ تُرفع الراية حين لا يبقى أي مشغّل في النافذة. */
    @JvmStatic
    fun releaseSecure(activity: Activity?) {
        val window = activity?.window ?: return
        val count = (holders[window] ?: 0) - 1
        if (count <= 0) {
            holders.remove(window)
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            holders[window] = count
        }
    }

    /** للاختبار: هل الراية مرفوعة الآن على هذه النافذة؟ */
    @JvmStatic
    fun isSecure(window: Window): Boolean =
        (window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE) != 0

    /** نطاقات مشغّل Bunny الموقّع (كما في isBunny داخل Learning.kt) */
    @JvmStatic
    fun isBunnyHost(host: String): Boolean {
        val h = host.lowercase()
        return h == "mediadelivery.net" || h.endsWith(".mediadelivery.net") || h.endsWith(".b-cdn.net") ||
            h.endsWith(".bunnycdn.com") || h.endsWith(".bunny.net")
    }

    /**
     * طلب صلاحية من صفحة المشغّل: يُمنح «المحتوى المحمي» وحده، ولأصل المنصة (الصفحة المحلية المحمّلة بأصل
     * madrasadz.com) أو مشغّل Bunny فقط. أي صلاحية أخرى (كاميرا، ميكروفون…) تُرفض.
     */
    @JvmStatic
    fun handlePermission(request: PermissionRequest) {
        val host = request.origin?.host?.lowercase() ?: ""
        val trusted = host == "madrasadz.com" || host == "www.madrasadz.com" || isBunnyHost(host)
        val wantsDrm = request.resources.contains(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)
        if (trusted && wantsDrm) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID))
        } else {
            request.deny()
        }
    }
}

/** النشاط الحامل لسياق Compose (LocalContext قد يكون ContextWrapper) */
tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
