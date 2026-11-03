#if DEBUG
import Foundation

/// Debug-only sample server for UI tests (`--madrasadz-fixture`). Invented names and
/// content; no account, token or real server. Release builds exclude this file's code.
enum Fixtures {
    static let enabled = ProcessInfo.processInfo.arguments.contains("--madrasadz-fixture")
    static let signedIn = ProcessInfo.processInfo.arguments.contains("--madrasadz-fixture-signed-in")
    /// The signed-in account still has to confirm its phone (until a right code is sent).
    static let needsPhone = ProcessInfo.processInfo.arguments.contains("--madrasadz-fixture-phone")
    static var phoneConfirmed = false
    static let ticketID = "77777777-7777-4777-8777-777777777777"
    /// Support tickets of the sample account: (id, number, kind, subject, status, messages as (mine, body)).
    static var tickets: [(id: String, number: Int, kind: String, subject: String, status: String, messages: [(mine: Bool, body: String)])] = [
        (ticketID, 7, "DELIVERY", "تأخّر كتاب الرياضيات", "WAITING_USER", [(true, "لم يصلني الكتاب بعد."), (false, "الكتاب عند شركة التوصيل، يصلك غدًا إن شاء الله.")])
    ]
    static let bacID = "66666666-6666-4666-8666-666666666666"
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
            json = #"{"ok":true,"data":{"authenticated":true,"user":{"id":"\#(accountID)","role":"STUDENT"},"requiresPhoneVerification":\#(needsPhone && !phoneConfirmed)}}"#
        case ("GET", "/api/v1/ios/register"):
            json = #"{"ok":true,"data":{"wilayas":[{"id":"w28","name":"28 — المسيلة"},{"id":"w16","name":"16 — الجزائر"}],"levels":[{"id":"l3","name":"الثالثة ثانوي","secondary":true},{"id":"m4","name":"الرابعة متوسط","secondary":false}],"streams":[{"id":"s-lit","name":"آداب وفلسفة"},{"id":"s-sci","name":"علوم تجريبية"}]}}"#
        case ("POST", "/api/v1/ios/register"):
            let body = request.httpBody.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if body.contains("taken@") {
                status = 409
                json = #"{"ok":false,"error":{"code":"EMAIL_TAKEN","message":"هذا البريد مستعمل."}}"#
            } else {
                json = #"{"ok":true,"data":{"token":"fixture-token","expiresAt":"2030-01-01T00:00:00Z","role":"STUDENT"}}"#
            }
        case ("GET", "/api/v1/ios/phone"):
            json = #"{"ok":true,"data":{"required":\#(needsPhone && !phoneConfirmed),"phone":"0661234567","sms":true,"callNumber":"0550 00 00 00"}}"#
        case ("POST", "/api/v1/ios/phone/request"):
            json = #"{"ok":true,"data":{"cooldown":60}}"#
        case ("POST", "/api/v1/ios/phone/verify"):
            let body = request.httpBody.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if body.contains("123456") {
                phoneConfirmed = true
                json = #"{"ok":true,"data":{"verified":true}}"#
            } else {
                status = 400
                json = #"{"ok":false,"error":{"code":"OTP_INVALID","message":"الرمز غير صحيح."}}"#
            }
        case ("GET", "/api/v1/ios/bac"):
            json = bacPage
        case ("GET", "/api/v1/ios/bac/" + bacID):
            json = bacPaper
        case ("GET", "/api/v1/ios/tests"):
            json = testsPage
        case ("GET", _) where path.hasPrefix("/api/v1/ios/papers/"):
            json = testsPaper
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
        case ("GET", "/api/v1/ios/orders"):
            json = orders
        case ("GET", "/api/v1/ios/support"):
            json = ticketList()
        case ("POST", "/api/v1/ios/support"):
            let body = request.httpBody.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
            let id = "88888888-8888-4888-8888-\(String(format: "%012d", tickets.count + 1))"
            tickets.insert((id, 8 + tickets.count, body["kind"] as? String ?? "OTHER", body["subject"] as? String ?? "", "OPEN", [(true, body["body"] as? String ?? "")]), at: 0)
            json = #"{"ok":true,"data":{"id":"\#(id)","number":\#(8 + tickets.count - 1)}}"#
        case ("POST", _) where path.hasPrefix("/api/v1/ios/support/") && path.hasSuffix("/reply"):
            let id = path.split(separator: "/").dropLast().last.map(String.init) ?? ""
            let body = request.httpBody.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
            if let i = tickets.firstIndex(where: { $0.id == id }) {
                tickets[i].messages.append((true, body["body"] as? String ?? ""))
                tickets[i].status = "OPEN"
            }
            json = #"{"ok":true,"data":{"id":"m-new"}}"#
        case ("POST", _) where path.hasPrefix("/api/v1/ios/support/") && path.hasSuffix("/close"):
            let id = path.split(separator: "/").dropLast().last.map(String.init) ?? ""
            if let i = tickets.firstIndex(where: { $0.id == id }) { tickets[i].status = "CLOSED" }
            json = #"{"ok":true,"data":{"closed":true}}"#
        case ("GET", _) where path.hasPrefix("/api/v1/ios/support/"):
            let id = String(path.dropFirst("/api/v1/ios/support/".count))
            if let ticket = tickets.first(where: { $0.id == id }) {
                json = thread(ticket)
            } else {
                status = 404
                json = #"{"ok":false,"error":{"code":"TICKET_NOT_FOUND","message":"التذكرة غير موجودة."}}"#
            }
        case ("POST", "/api/v1/ios/push"), ("DELETE", "/api/v1/ios/push"):
            json = #"{"ok":true,"data":{"registered":true,"removed":true,"active":false}}"#
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

    static let orders = #"""
    {"ok":true,"data":{"orders":[
     {"id":"o-1","number":"MD-1042","status":"SHIPPED","statusText":"في الطريق","createdAt":"2026-11-01T09:15:00.000Z","items":"كتاب الرياضيات ×2","deliveryProvider":"Yalidine","trackingId":"YAL-778812","timeline":[{"label":"استُلم الطلب","at":"2026-11-01T09:15:00.000Z","tone":"done"},{"label":"أُكّد الطلب","at":"2026-11-01T14:00:00.000Z","tone":"done"},{"label":"سُلّم لشركة التوصيل (Yalidine)","at":"2026-11-02T10:00:00.000Z","tone":"done"}]},
     {"id":"o-2","number":"MD-0990","status":"DELIVERED","statusText":"مكتمل","createdAt":"2026-10-01T09:15:00.000Z","items":"دورة الفلسفة — بكالوريا تجريبية","deliveryProvider":null,"trackingId":null,"timeline":[{"label":"استُلم الطلب","at":"2026-10-01T09:15:00.000Z","tone":"done"},{"label":"اكتمل — فُتحت الدورة على حسابك","at":"2026-10-01T12:00:00.000Z","tone":"done"}]}
    ]}}
    """#

    private static func escaped(_ text: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [text])) ?? Data("[\"\"]".utf8)
        return String(String(data: data, encoding: .utf8)!.dropFirst().dropLast())
    }

    static func ticketList() -> String {
        let rows = tickets.map { t in
            #"{"id":"\#(t.id)","number":\#(t.number),"kind":"\#(t.kind)","subject":\#(escaped(t.subject)),"status":"\#(t.status)","lastMessageAt":"2026-11-03T10:00:00.000Z","messages":\#(t.messages.count)}"#
        }
        return #"{"ok":true,"data":{"tickets":[\#(rows.joined(separator: ","))]}}"#
    }

    static func thread(_ t: (id: String, number: Int, kind: String, subject: String, status: String, messages: [(mine: Bool, body: String)])) -> String {
        let messages = t.messages.enumerated().map { i, m in
            #"{"id":"m\#(i)","mine":\#(m.mine),"staff":\#(!m.mine),"author":\#(m.mine ? "\"تلميذ تجريبي\"" : "null"),"body":\#(escaped(m.body)),"createdAt":"2026-11-0\#(min(i + 1, 9))T10:00:00.000Z"}"#
        }
        return #"{"ok":true,"data":{"id":"\#(t.id)","number":\#(t.number),"kind":"\#(t.kind)","subject":\#(escaped(t.subject)),"status":"\#(t.status)","createdAt":"2026-11-01T10:00:00.000Z","orderNumber":\#(t.kind == "DELIVERY" ? "\"MD-1042\"" : "null"),"courseTitle":null,"messages":[\#(messages.joined(separator: ","))]}}"#
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

    static let bacPage = #"""
    {"ok":true,"data":{"items":[
      {"id":"66666666-6666-4666-8666-666666666666","title":"موضوع اللغة العربية شعبة آداب وفلسفة — بكالوريا 2024","year":2024,"session":"NORMAL","subjectName":"اللغة العربية","streamName":"آداب وفلسفة","topic":1,"official":true,"hasPaper":true,"hasSolution":true},
      {"id":"77777777-7777-4777-8777-777777777777","title":"موضوع اللغة العربية شعبة آداب وفلسفة — بكالوريا 2023","year":2023,"session":"NORMAL","subjectName":"اللغة العربية","streamName":"آداب وفلسفة","topic":2,"official":true,"hasPaper":true,"hasSolution":false}],
     "nextCursor":null,"facets":{"streams":[{"id":"s-lit","name":"آداب وفلسفة","count":2}],"subjects":[{"id":"sub-ar","name":"اللغة العربية","count":2}],"years":[{"year":2024,"count":1},{"year":2023,"count":1}]},"total":2,"myStreamId":null}}
    """#

    static let bacPaper = #"""
    {"ok":true,"data":{"id":"66666666-6666-4666-8666-666666666666","title":"موضوع اللغة العربية شعبة آداب وفلسفة — بكالوريا 2024","year":2024,"session":"NORMAL","official":true,"subjectName":"اللغة العربية","streamName":"آداب وفلسفة","source":{"name":"مصدر تجريبي","attribution":"للاختبار"},
     "paper":{"url":"https://example.com/bac-2024.pdf","inApp":false},"solution":{"url":"https://example.com/bac-2024-corrige.pdf","inApp":false},
     "play":{"id":"11111111-2222-4333-8444-555555555555","title":"بكالوريا تجريبية — الموضوع الأول"}}}
    """#

    static let testsPage = #"""
    {"ok":true,"data":{"terms":[{"term":1,"count":3},{"term":2,"count":1},{"term":3,"count":0}],
     "levels":[{"id":"lv-3as","name":"الثالثة ثانوي","code":"3AS","count":3},{"id":"lv-2as","name":"الثانية ثانوي","code":"2AS","count":1}],"myLevelId":"lv-3as",
     "subjects":[{"id":"sub-ar","name":"اللغة العربية","count":2},{"id":"sub-philo","name":"الفلسفة","count":1}],
     "papers":[{"id":"88888888-8888-4888-8888-888888888888","title":"الفرض الأول في اللغة العربية — الفصل الأول","typeLabel":"فرض","year":2025,"hasSolution":true,"hasFile":true}],
     "nextCursor":null,
     "interactive":[{"id":"11111111-2222-4333-8444-555555555555","title":"الفرض الأول — تفاعلي","kind":"DEVOIR","year":2025}]}}
    """#

    static let testsPaper = #"""
    {"ok":true,"data":{"id":"88888888-8888-4888-8888-888888888888","title":"الفرض الأول في اللغة العربية — الفصل الأول","year":2025,"term":1,"official":false,"subjectName":"اللغة العربية","streamName":null,
     "source":{"name":"مدرسة","attribution":null},"paper":{"url":"https://example.com/devoir.pdf","inApp":false},"solution":{"url":"https://example.com/devoir-corrige.pdf","inApp":false},
     "play":{"id":"11111111-2222-4333-8444-555555555555","title":"الفرض الأول — تفاعلي"}}}
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
