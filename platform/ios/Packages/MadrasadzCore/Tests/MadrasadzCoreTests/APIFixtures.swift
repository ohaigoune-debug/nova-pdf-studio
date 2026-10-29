import Foundation

/// Real responses produced by the server PGlite tests (tests/ios-api.test.ts setup).
enum APIFixtures {
    static let capabilities = #"""
{"ok": true, "data": {"apiVersion": 1, "features": ["home", "course", "lesson"], "minAppBuild": 1}}
"""#
    static let homeGuest = #"""
{"ok": true, "data": {"account": null, "courses": [], "freeLessons": [{"kind": "group", "heading": "سلسلة الفروض", "detail": "الثالثة ثانوي", "items": [{"slug": "سلسلة-الفروض-الثالثة-ثانوي-آداب-27731c", "label": "آداب", "type": "LESSON"}, {"slug": "سلسلة-الفروض-الثالثة-ثانوي-علوم-f7064b", "label": "علوم", "type": "LESSON"}]}], "tools": []}}
"""#
    static let homeStudent = #"""
{"ok": true, "data": {"account": {"id": "4b21efbc-0047-40a3-94bf-c93f906d334f"}, "courses": [{"slug": "دوره-الواجهه", "title": "دورة الواجهة", "teacherName": "أستاذ تجريبي", "season": "2026/2027", "status": "ACTIVE", "accessEndsOn": null, "termsAccepted": true}], "freeLessons": [{"kind": "group", "heading": "سلسلة الفروض", "detail": "الثالثة ثانوي", "items": [{"slug": "سلسلة-الفروض-الثالثة-ثانوي-آداب-27731c", "label": "آداب", "type": "LESSON"}, {"slug": "سلسلة-الفروض-الثالثة-ثانوي-علوم-f7064b", "label": "علوم", "type": "LESSON"}]}], "tools": [{"id": "play", "webPath": "/student/play"}, {"id": "practice", "webPath": "/student/practice"}, {"id": "quizzes", "webPath": "/student/quizzes"}, {"id": "exams", "webPath": "/student/exams"}]}}
"""#
    static let homeRole = #"""
{"ok": false, "error": {"code": "FORBIDDEN", "message": "ليست لديك صلاحية لهذا الإجراء.", "reason": "ROLE"}}
"""#
    static let course = #"""
{"ok": true, "data": {"needsTerms": false, "course": {"slug": "دوره-الواجهه", "title": "دورة الواجهة", "teacherName": "أستاذ تجريبي", "season": "2026/2027", "description": null, "accessEndsOn": null}, "sections": [{"id": "lessons", "items": [{"slug": "الحصة-1-مدخل-c7c9d7", "title": "الحصة 1 — مدخل", "displayTitle": "مدخل", "session": 1, "type": "LESSON", "videoProvider": null, "publishedAt": "2026-10-28T15:53:15.778Z"}, {"slug": "الحصة-2-البلاغة-4af129", "title": "الحصة 2 — البلاغة", "displayTitle": "البلاغة", "session": 2, "type": "LESSON", "videoProvider": null, "publishedAt": "2026-10-28T15:53:15.770Z"}]}, {"id": "videos", "items": [{"slug": "شرح-الحصة-1-d60798", "title": "شرح الحصة 1", "displayTitle": "شرح", "session": 1, "type": "VIDEO", "videoProvider": "YOUTUBE", "publishedAt": "2026-10-28T15:53:15.787Z"}]}, {"id": "homework", "items": [{"slug": "الفرض-الأول-4bf63e", "title": "الفرض الأول", "displayTitle": "الفرض الأول", "session": null, "type": "LESSON", "videoProvider": null, "publishedAt": "2026-10-28T15:53:15.793Z"}]}, {"id": "tests", "items": [{"slug": "اختبار-الفصل-الأول-406daa", "title": "اختبار الفصل الأول", "displayTitle": "اختبار الفصل الأول", "session": null, "type": "PDF", "videoProvider": null, "publishedAt": "2026-10-28T15:53:15.806Z"}]}], "upcoming": [], "webPath": "/ios/course/%D8%AF%D9%88%D8%B1%D9%87-%D8%A7%D9%84%D9%88%D8%A7%D8%AC%D9%87%D9%87"}}
"""#
    static let courseTerms = #"""
{"ok": true, "data": {"needsTerms": true, "course": {"slug": "دوره-بشروط", "title": "دورة بشروط"}, "webPath": "/ios/course/%D8%AF%D9%88%D8%B1%D9%87-%D8%A8%D8%B4%D8%B1%D9%88%D8%B7"}}
"""#
    static let courseUnauth = #"""
{"ok": false, "error": {"code": "AUTH_REQUIRED", "message": "يجب تسجيل الدخول أولاً."}}
"""#
    static let lessonPdf = #"""
{"ok": true, "data": {"lesson": {"slug": "اختبار-الفصل-الأول-406daa", "title": "اختبار الفصل الأول", "summary": null, "type": "PDF", "bodyMarkdown": null, "media": {"kind": "pdf", "contentId": "a3a44d91-0705-48fd-95ea-545859a4acfe", "allowDownload": true}, "webPath": "/ios/lesson/%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1-%D8%A7%D9%84%D9%81%D8%B5%D9%84-%D8%A7%D9%84%D8%A3%D9%88%D9%84-406daa"}}}
"""#
}
