package dz.madrasa.app

import android.content.Context

/**
 * خادم تجريبي لنسخة debug فقط (اختبارات الواجهة ولقطات الشاشة): أسماء ومحتوى مختلَق، دون حساب ولا خادم حقيقي.
 * نسخة الإصدار (release) فيها ملف بالاسم نفسه لا يفعل شيئًا، فلا يصل هذا الكود إلى المتجر أبدًا.
 */
object Fixtures {
    @Volatile
    var enabled = false
    private var context: Context? = null
    const val ACCOUNT = "00000000-0000-4000-8000-000000000001"

    fun install(context: Context) {
        this.context = context.applicationContext
        enabled = true
    }

    private fun asset(name: String): String =
        context?.assets?.open("fixtures/$name.json")?.use { it.readBytes().toString(Charsets.UTF_8) } ?: "{}"

    private fun ok(data: String) = """{"ok":true,"data":$data}"""

    private fun envelope(name: String): String {
        val text = asset(name)
        return if (text.trimStart().startsWith("{\"ok\"")) text else ok(text)
    }

    /** (رمز الحالة، النص) أو null لطلب لا يخصّ الخادم التجريبي */
    fun respond(method: String, path: String, body: String): Pair<Int, String>? {
        if (!enabled) return null
        val p = path.substringBefore('?')
        val q = path.substringAfter('?', "")
        return when {
            method == "POST" && p == "/api/v1/auth/login" ->
                if (body.contains("\"wrong\"")) 401 to """{"ok":false,"error":{"code":"INVALID_CREDENTIALS","message":"البريد أو كلمة السر غير صحيحة."}}"""
                else 200 to ok("""{"token":"fixture-token","expiresAt":"2030-01-01T00:00:00Z","role":"STUDENT"}""")
            p == "/api/v1/auth/me" -> 200 to ok("""{"userId":"$ACCOUNT","role":"STUDENT","fullName":"تلميذ تجريبي","email":"student@example.com"}""")
            p == "/api/v1/ios/session" -> 200 to ok("""{"authenticated":true,"user":{"id":"$ACCOUNT","role":"STUDENT"},"requiresPhoneVerification":false}""")
            p == "/api/v1/ios/register" && method == "GET" -> 200 to ok("""{"wilayas":[{"id":"w28","name":"28 — المسيلة"},{"id":"w16","name":"16 — الجزائر"}],"levels":[{"id":"l3","name":"الثالثة ثانوي","secondary":true},{"id":"m4","name":"الرابعة متوسط","secondary":false}],"streams":[{"id":"s-lit","name":"آداب وفلسفة"},{"id":"s-sci","name":"علوم تجريبية"}]}""")
            p == "/api/v1/ios/phone" -> 200 to ok("""{"required":false,"phone":"0661234567","sms":true,"callNumber":"0550 00 00 00"}""")
            p == "/api/v1/ios/home" -> 200 to envelope("home")
            p.startsWith("/api/v1/ios/courses/") -> 200 to envelope("course")
            p.startsWith("/api/v1/ios/lessons/") -> 200 to envelope(if (p.endsWith("v1")) "lessonVideo" else if (p.endsWith("p1")) "lessonPDF" else "lessonText")
            p == "/api/v1/ios/bac" -> 200 to envelope("bacPage")
            p.startsWith("/api/v1/ios/bac/") -> 200 to envelope("bacPaper")
            p == "/api/v1/ios/tests" -> 200 to envelope("testsPage")
            p.startsWith("/api/v1/ios/papers/") -> 200 to envelope("testsPaper")
            p == "/api/v1/ios/play/subjects" -> 200 to ok("""{"gradeCode":"3AS","streamCode":"LIT","subjects":[{"code":"AR","nameAr":"اللغة العربية","color":"#1457C5","language":"ar"},{"code":"PHIL","nameAr":"الفلسفة","color":"#0C1F4A","language":"ar"},{"code":"HG","nameAr":"التاريخ والجغرافيا","color":"#16803D","language":"ar"},{"code":"FR","nameAr":"اللغة الفرنسية","color":"#B45309","language":"fr"}],"grades":[]}""")
            p == "/api/v1/ios/play/sets" -> 200 to ok("""{"items":[{"id":"11111111-2222-4333-8444-555555555555","setId":"fixture-bac","kind":"${Regex("kind=([A-Z]+)").find(q)?.groupValues?.get(1) ?: "BAC"}","year":2024,"term":null,"paper":1,"title":"بكالوريا تجريبية — الموضوع الأول","stepCount":14,"interactivePoints":17,"scoreTotal":20,"preview":false,"attempts":1,"best":{"score":11,"max":17}}],"preview":false}""")
            p.startsWith("/api/v1/ios/play/sets/") -> 200 to envelope("package")
            p == "/api/v1/ios/play/lessons" -> 200 to envelope("cardLessons")
            p.startsWith("/api/v1/ios/play/lessons/") -> 200 to envelope("cardPack")
            p == "/api/v1/ios/play/cards/sync" -> 200 to ok("""{"sessionId":"s","accepted":3,"correctCount":2,"total":3,"xpEarned":50,"xpTotal":150,"level":{"index":0,"title":"مبتدئ","progressPct":75},"newBadges":[],"lessonMastered":false}""")
            p == "/api/v1/ios/play/sync" -> 200 to ok("""{"attemptId":"a","score":12,"max":17,"accepted":14}""")
            p == "/api/v1/ios/play/profile" -> 200 to ok("""{"gradeCode":"3AS"}""")
            p == "/api/v1/ios/orders" -> 200 to envelope("orders")
            p == "/api/v1/ios/support" && method == "GET" -> 200 to ok("""{"tickets":[{"id":"77777777-7777-4777-8777-777777777777","number":7,"kind":"DELIVERY","subject":"تأخّر كتاب الرياضيات","status":"WAITING_USER","lastMessageAt":"2026-11-03T10:00:00.000Z","messages":2}]}""")
            p == "/api/v1/ios/support" -> 200 to ok("""{"id":"77777777-7777-4777-8777-777777777777","number":8}""")
            p.startsWith("/api/v1/ios/support/") && method == "GET" -> 200 to ok("""{"id":"77777777-7777-4777-8777-777777777777","number":7,"kind":"DELIVERY","subject":"تأخّر كتاب الرياضيات","status":"WAITING_USER","createdAt":"2026-11-01T10:00:00.000Z","orderNumber":"MD-1042","courseTitle":null,"messages":[{"id":"m0","mine":true,"staff":false,"author":"تلميذ تجريبي","body":"لم يصلني الكتاب بعد.","createdAt":"2026-11-01T10:00:00.000Z"},{"id":"m1","mine":false,"staff":true,"author":null,"body":"الكتاب عند شركة التوصيل، يصلك غدًا إن شاء الله.","createdAt":"2026-11-02T10:00:00.000Z"}]}""")
            p.startsWith("/api/v1/ios/support/") -> 200 to ok("""{"id":"m-new","closed":true}""")
            p == "/api/v1/ios/classroom" -> 200 to envelope("generalClassroom")
            p.startsWith("/api/v1/ios/classroom/") -> 200 to ok("""{"id":"c-new","deleted":true,"reported":true,"ticketNumber":9}""")
            p.startsWith("/api/v1/ios/media/") -> 200 to ok("""{"provider":"bunny","url":"https://iframe.mediadelivery.net/embed/1/fixture","expires":0,"watermark":["تلميذ تجريبي","…4567 · 2026-11-10"]}""")
            p == "/api/v1/media/heartbeat" -> 200 to ok("{}")
            p == "/api/v1/ios/logout" -> 200 to ok("""{"loggedOut":true}""")
            p == "/api/v1/ios/account/delete" -> 200 to ok("""{"deleted":true}""")
            else -> 404 to """{"ok":false,"error":{"code":"CONTENT_NOT_FOUND","message":"المحتوى غير موجود."}}"""
        }
    }
}
