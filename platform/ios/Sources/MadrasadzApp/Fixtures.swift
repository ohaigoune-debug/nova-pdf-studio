#if DEBUG
import Foundation

/// Debug-only sample server for UI tests (`--madrasadz-fixture`). Invented names and
/// content; no account, token or real server. Release builds exclude this file's code.
enum Fixtures {
    static let enabled = ProcessInfo.processInfo.arguments.contains("--madrasadz-fixture")
    static let signedIn = ProcessInfo.processInfo.arguments.contains("--madrasadz-fixture-signed-in")
    static let accountID = "00000000-0000-4000-8000-000000000001"
    static let setID = "11111111-2222-4333-8444-555555555555"
    static let lessonID = "44444444-4444-4444-8444-444444444444"

    static func respond(to request: URLRequest) throws -> (Data, HTTPURLResponse) {
        let url = request.url ?? URL(string: "https://madrasadz.com/")!
        let path = url.path
        var status = 200
        let json: String
        switch (request.httpMethod ?? "GET", path) {
        case ("POST", "/api/v1/auth/login"):
            let body = request.httpBody.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if body.contains("\"wrong\"") {
                status = 401
                json = #"{"ok":false,"error":{"code":"INVALID_CREDENTIALS","message":"البريد أو كلمة السر غير صحيحة."}}"#
            } else {
                json = #"{"ok":true,"data":{"token":"fixture-token","expiresAt":"2030-01-01T00:00:00Z","role":"STUDENT"}}"#
            }
        case ("GET", "/api/v1/auth/me"):
            json = #"{"ok":true,"data":{"userId":"\#(accountID)","role":"STUDENT","fullName":"تلميذ تجريبي","email":"student@example.com"}}"#
        case ("GET", "/api/v1/ios/session"):
            json = #"{"ok":true,"data":{"authenticated":true,"user":{"id":"\#(accountID)","role":"STUDENT"},"requiresPhoneVerification":false}}"#
        case ("GET", "/api/v1/ios/home"):
            json = home
        case ("GET", _) where path.hasPrefix("/api/v1/ios/courses/"):
            json = course
        case ("GET", _) where path.hasPrefix("/api/v1/ios/lessons/"):
            json = path.hasSuffix("v1") ? lessonVideo : path.hasSuffix("p1") ? lessonPDF : lessonText
        case ("GET", "/api/v1/ios/play/subjects"):
            json = ##"{"ok":true,"data":{"gradeCode":"3AS","streamCode":"LIT","subjects":[{"code":"AR","nameAr":"اللغة العربية","color":"#1457C5","language":"ar"},{"code":"PHIL","nameAr":"الفلسفة","color":"#0C1F4A","language":"ar"}],"grades":[]}}"##
        case ("GET", "/api/v1/ios/play/sets"):
            json = #"{"ok":true,"data":{"items":[{"id":"\#(setID)","setId":"fixture-bac","kind":"BAC","year":2024,"term":null,"paper":1,"title":"بكالوريا تجريبية — الموضوع الأول","stepCount":5,"interactivePoints":5,"scoreTotal":20,"preview":false,"attempts":0,"best":null}],"preview":false,"gradeCode":"3AS","streamCode":"LIT"}}"#
        case ("GET", "/api/v1/ios/play/sets/" + setID):
            json = package
        case ("GET", "/api/v1/ios/play/lessons"):
            json = cardLessons
        case ("GET", "/api/v1/ios/play/lessons/" + lessonID):
            json = cardPack
        case ("POST", "/api/v1/ios/play/cards/sync"):
            json = #"{"ok":true,"data":{"sessionId":"s","accepted":3,"correctCount":1,"total":3,"xpEarned":40,"xpTotal":140,"level":{"index":0,"title":"مبتدئ","progressPct":70},"newBadges":[],"lessonMastered":false}}"#
        case ("POST", "/api/v1/ios/play/sync"):
            json = #"{"ok":true,"data":{"attemptId":"a","score":5,"max":5,"accepted":5}}"#
        case ("POST", "/api/v1/ios/logout"):
            json = #"{"ok":true,"data":{"loggedOut":true}}"#
        case ("POST", "/api/v1/ios/account/delete"):
            json = #"{"ok":true,"data":{"deleted":true}}"#
        case ("POST", "/api/v1/media/heartbeat"):
            json = #"{"ok":true,"data":{}}"#
        default:
            status = 404
            json = #"{"ok":false,"error":{"code":"CONTENT_NOT_FOUND","message":"المحتوى غير موجود."}}"#
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": "application/json", "X-Madrasadz-Account": accountID])!
        return (Data(json.utf8), response)
    }

    static let home = #"""
    {"ok":true,"data":{"account":{"id":"00000000-0000-4000-8000-000000000001"},
     "courses":[{"slug":"fixture-ar","title":"اللغة العربية — بكالوريا تجريبية","teacherName":"أستاذ تجريبي","season":"2026/2027","status":"ACTIVE","accessEndsOn":"2027-06-30","termsAccepted":true}],
     "freeLessons":[{"kind":"single","slug":"free-t1","label":"منهجية المقالة","summary":"خطوات كتابة مقالة","type":"LESSON"}],
     "tools":[]}}
    """#

    static let course = #"""
    {"ok":true,"data":{"needsTerms":false,"course":{"slug":"fixture-ar","title":"اللغة العربية — بكالوريا تجريبية","teacherName":"أستاذ تجريبي","season":"2026/2027","description":"دورة تجريبية للاختبار.","accessEndsOn":"2027-06-30"},
     "sections":[{"id":"lessons","items":[{"slug":"t1","title":"الحصة 1 — المدخل","displayTitle":"المدخل","session":1,"type":"LESSON","videoProvider":null,"publishedAt":"2026-10-28T15:53:15.778Z"}]},
                 {"id":"videos","items":[{"slug":"v1","title":"شرح الحصة 1","displayTitle":"شرح","session":1,"type":"VIDEO","videoProvider":"YOUTUBE","publishedAt":"2026-10-28T15:53:15.787Z"}]},
                 {"id":"files","items":[{"slug":"p1","title":"ملخص الدرس","displayTitle":"ملخص الدرس","session":null,"type":"PDF","videoProvider":null,"publishedAt":"2026-10-28T15:53:15.806Z"}]}],
     "upcoming":[],"webPath":"/ios/course/fixture-ar"}}
    """#

    static let lessonText = #"""
    {"ok":true,"data":{"lesson":{"slug":"t1","title":"المدخل","summary":"درس تجريبي","type":"LESSON","bodyMarkdown":"# مقدمة\nهذا **نص** درس تجريبي.\n- النقطة الأولى\n- النقطة الثانية","media":{"kind":"none"},"webPath":"/ios/lesson/t1"},"viewer":{"name":"تلميذ تجريبي","code":"00000000"}}}
    """#

    static let lessonVideo = #"""
    {"ok":true,"data":{"lesson":{"slug":"v1","title":"شرح","summary":null,"type":"VIDEO","bodyMarkdown":null,"media":{"kind":"youtube","youtubeId":"dQw4w9WgXcQ","contentId":"22222222-2222-4222-8222-222222222222"},"webPath":"/ios/lesson/v1"},"viewer":{"name":"تلميذ تجريبي","code":"00000000"}}}
    """#

    static let lessonPDF = #"""
    {"ok":true,"data":{"lesson":{"slug":"p1","title":"ملخص الدرس","summary":null,"type":"PDF","bodyMarkdown":null,"media":{"kind":"pdf","contentId":"33333333-3333-4333-8333-333333333333","allowDownload":true},"webPath":"/ios/lesson/p1"},"viewer":null}}
    """#

    static let package = #"""
    {"ok":true,"data":{"id":"11111111-2222-4333-8444-555555555555","setId":"fixture-bac","checksum":"c1","kind":"BAC","year":2024,"title":"بكالوريا تجريبية — الموضوع الأول","subjectCode":"AR","language":"ar","scoreTotal":20,"maxScore":5,
     "steps":[
      {"id":"s1","index":0,"type":"mcq","prompt":"ما نوع الأسلوب في قول الشاعر؟","payload":{"type":"mcq","options":["خبري","إنشائي"]},"points":1,"rubric_label":"البناء اللغوي","excerpt":{"kind":"verses","rows":[{"n":"1","a":"أراك عصيّ الدمع شيمتك الصبر","b":"أما للهوى نهي عليك ولا أمر"}]},"answer":{"type":"mcq","correct":1},"explanation":"استفهام، فهو إنشائي طلبي.","correctText":"إنشائي"},
      {"id":"s2","index":1,"type":"multi","prompt":"اختر المحسنات البديعية الواردة","payload":{"type":"multi","options":["طباق","جناس","سجع"]},"points":1,"answer":{"type":"multi","correct":[0,2]},"explanation":"","correctText":"طباق ، سجع"},
      {"id":"s3","index":2,"type":"fill_blank","prompt":"أكمل","payload":{"type":"fill_blank","text":"الفعل ____ مبني على ____","bank":["الماضي","الفتح","الضم"]},"points":1,"answer":{"type":"fill_blank","blanks":[["الماضي"],["الفتح"]]},"explanation":"","correctText":"الماضي ، الفتح"},
      {"id":"s4","index":3,"type":"ordering","prompt":"رتّب","payload":{"type":"ordering","items":["أولًا","ثانيًا","ثالثًا"]},"points":1,"answer":{"type":"ordering","order":[0,1,2]},"explanation":"","correctText":"أولًا ← ثانيًا ← ثالثًا"},
      {"id":"s5","index":4,"type":"matching","prompt":"صِل","payload":{"type":"matching","lefts":["الطباق","الجناس"],"rights":["تضاد","تشابه لفظي"]},"points":1,"answer":{"type":"matching","pairs":[0,1]},"explanation":"","correctText":"الطباق ← تضاد"}]}}
    """#

    static let cardLessons = #"""
    {"ok":true,"data":{"subject":{"code":"AR","nameAr":"اللغة العربية"},"units":[{"unitCode":"U1","unitName":"البلاغة","lessons":[
      {"id":"44444444-4444-4444-8444-444444444444","lessonName":"الصور البيانية","objective":null,"questions":3,"masteryPct":40,"mastered":false,"answered":5},
      {"id":"55555555-5555-4555-8555-555555555555","lessonName":"المحسنات البديعية","objective":null,"questions":0,"masteryPct":0,"mastered":false,"answered":0}]}],
     "stats":{"xpTotal":100,"streakDays":2,"level":{"index":0,"title":"مبتدئ","minXp":0,"nextMinXp":200,"progressPct":50}}}}
    """#

    static let cardPack = #"""
    {"ok":true,"data":{"lesson":{"id":"44444444-4444-4444-8444-444444444444","subjectCode":"AR","unitCode":"U1","unitName":"البلاغة","lessonName":"الصور البيانية","objective":null,"language":"ar"},
     "checksum":"c1","roundSize":12,"xp":{"correct":10,"correctHard":15,"sessionComplete":30,"lessonMastery":100,"repeatMastered":2},
     "questions":[
      {"id":"q1","type":"MCQ","difficulty":"EASY","language":"ar","questionText":"ما نوع الصورة في «ابتسم الصباح»؟","payload":{"type":"MCQ","options":[{"key":"a","text":"تشبيه بليغ"},{"key":"b","text":"استعارة مكنية"},{"key":"c","text":"كناية"},{"key":"d","text":"مجاز مرسل"}]},"answerKey":{"type":"MCQ","correct":"b"},"explanation":"شُبّه الصباح بإنسان يبتسم وحُذف المشبه به.","correctText":"استعارة مكنية"},
      {"id":"q2","type":"FILL_BLANK","difficulty":"MEDIUM","language":"ar","questionText":"الاستعارة ____ يُحذف فيها المشبه به.","payload":{"type":"FILL_BLANK","segments":[{"t":"الاستعارة "},{"b":0},{"t":" يُحذف فيها المشبه به."}],"blanks":1,"bank":["المكنية","التصريحية"]},"answerKey":{"type":"FILL_BLANK","answers":[["المكنية"]]},"explanation":"في المكنية يُحذف المشبه به.","correctText":"المكنية"},
      {"id":"q3","type":"ORDERING","difficulty":"HARD","language":"ar","questionText":"رتّب خطوات تحليل الصورة","payload":{"type":"ORDERING","items":[{"key":"o0","text":"تحديد الصورة"},{"key":"o1","text":"شرحها"},{"key":"o2","text":"بيان نوعها"}]},"answerKey":{"type":"ORDERING","order":["o0","o1","o2"]},"explanation":"نحدد الصورة ثم نشرحها ثم نسميها.","correctText":"1. تحديد الصورة 2. شرحها 3. بيان نوعها"}]}}
    """#
}
#endif
