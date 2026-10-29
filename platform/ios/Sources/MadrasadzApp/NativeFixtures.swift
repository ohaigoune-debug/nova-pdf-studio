#if DEBUG
import Foundation
import MadrasadzCore

/// Sample API answers for the Debug-only `--madrasadz-native-fixture` UI test.
/// Invented names; no account, token or server is involved. Release excludes this.
enum NativeFixtures {
    static let termsSlug = "fixture-terms"

    static func fetch<Value: Decodable>(_ type: Value.Type, path: String) -> Value? {
        let json: String
        if path == "/api/v1/ios/home" {
            json = home
        } else if path == "/api/v1/ios/courses/" + termsSlug {
            json = courseTerms
        } else if path.hasPrefix("/api/v1/ios/courses/") {
            json = course
        } else if path == "/api/v1/ios/lessons/v1" {
            json = lessonVideo
        } else if path == "/api/v1/ios/lessons/h1" || path == "/api/v1/ios/lessons/t1" || path == "/api/v1/ios/lessons/f1" || path == "/api/v1/ios/lessons/l2" {
            json = lessonPDF
        } else if path.hasPrefix("/api/v1/ios/lessons/") {
            json = lessonText
        } else {
            return nil
        }
        return try? JSONDecoder().decode(IOSAPI.Envelope<Value>.self, from: Data(json.utf8)).data
    }

    static let home = #"""
    {"ok":true,"data":{"account":{"id":"00000000-0000-4000-8000-000000000001"},
     "courses":[
      {"slug":"fixture-math","title":"الرياضيات — بكالوريا تجريبية","teacherName":"أستاذ تجريبي","season":"2026/2027","status":"ACTIVE","accessEndsOn":"2027-06-30","termsAccepted":true},
      {"slug":"fixture-terms","title":"دورة بشروط","teacherName":"أستاذة تجريبية","season":"2026/2027","status":"ACTIVE","accessEndsOn":null,"termsAccepted":false},
      {"slug":"fixture-old","title":"دورة منتهية","teacherName":"أستاذ تجريبي","season":"2025/2026","status":"ENDED","accessEndsOn":"2026-06-30","termsAccepted":true}],
     "freeLessons":[
      {"kind":"group","heading":"سلسلة الفروض","detail":"الثالثة ثانوي","items":[{"slug":"free-a","label":"آداب","type":"LESSON"},{"slug":"free-b","label":"علوم","type":"LESSON"}]},
      {"kind":"single","slug":"free-c","label":"منهجية المقالة","summary":"خطوات كتابة مقالة فلسفية","type":"PDF"}],
     "tools":[{"id":"play","webPath":"/student/play"},{"id":"practice","webPath":"/student/practice"},{"id":"quizzes","webPath":"/student/quizzes"},{"id":"exams","webPath":"/student/exams"}]}}
    """#

    static let course = #"""
    {"ok":true,"data":{"needsTerms":false,
     "course":{"slug":"fixture-math","title":"الرياضيات — بكالوريا تجريبية","teacherName":"أستاذ تجريبي","season":"2026/2027","description":"دروس الحصص الأسبوعية مع الفروض والاختبارات.","accessEndsOn":"2027-06-30"},
     "sections":[
      {"id":"lessons","items":[
        {"slug":"l1","title":"الحصة 1 — الدوال","displayTitle":"الدوال","session":1,"type":"LESSON","videoProvider":null,"publishedAt":"2026-10-01T09:00:00.000Z"},
        {"slug":"l2","title":"الحصة 2 — النهايات","displayTitle":"النهايات","session":2,"type":"PDF","videoProvider":null,"publishedAt":"2026-10-08T09:00:00.000Z"},
        {"slug":"l3","title":"الحصة 3 — الاشتقاق","displayTitle":"الاشتقاق","session":3,"type":"LESSON","videoProvider":null,"publishedAt":"2026-10-15T09:00:00.000Z"}]},
      {"id":"videos","items":[
        {"slug":"v1","title":"شرح الحصة 1","displayTitle":"شرح الحصة 1","session":1,"type":"VIDEO","videoProvider":"YOUTUBE","publishedAt":"2026-10-02T09:00:00.000Z"}]},
      {"id":"homework","items":[
        {"slug":"h1","title":"الفرض الأول","displayTitle":"الفرض الأول","session":null,"type":"PDF","videoProvider":null,"publishedAt":"2026-10-20T09:00:00.000Z"}]},
      {"id":"tests","items":[
        {"slug":"t1","title":"اختبار الفصل الأول","displayTitle":"اختبار الفصل الأول","session":null,"type":"PDF","videoProvider":null,"publishedAt":"2026-10-25T09:00:00.000Z"}]},
      {"id":"files","items":[
        {"slug":"f1","title":"ملخص القوانين","displayTitle":"ملخص القوانين","session":null,"type":"PDF","videoProvider":null,"publishedAt":"2026-10-26T09:00:00.000Z"}]}],
     "upcoming":[{"title":"حصة مباشرة: المراجعة","startsAt":"2026-11-05T17:00:00.000Z","durationMinutes":60}],
     "webPath":"/ios/course/fixture-math"}}
    """#

    static let lessonText = #"""
    {"ok":true,"data":{"lesson":{"slug":"l1","title":"الحصة 1 — الدوال","summary":"مدخل إلى الدوال العددية","type":"LESSON",
     "bodyMarkdown":"نبدأ بتعريف بسيط.\n\n## تعريف الدالة\nالدالة علاقة تربط كل عنصر بعنصر **واحد** فقط.\n\n- مجموعة التعريف\n- الصورة والسابقة\n\nأمثلة محلولة في الحصة.",
     "media":{"kind":"none"},"webPath":"/ios/lesson/l1"},"viewer":{"name":"تلميذ تجريبي","code":"0a1b2c3d"}}}
    """#

    static let lessonVideo = #"""
    {"ok":true,"data":{"lesson":{"slug":"v1","title":"شرح الحصة 1","summary":null,"type":"VIDEO","bodyMarkdown":null,
     "media":{"kind":"youtube","youtubeId":"dQw4w9WgXcQ","contentId":"00000000-0000-4000-8000-0000000000aa"},"webPath":"/ios/lesson/v1"},
     "viewer":{"name":"تلميذ تجريبي","code":"0a1b2c3d"}}}
    """#

    static let lessonPDF = #"""
    {"ok":true,"data":{"lesson":{"slug":"h1","title":"الفرض الأول","summary":null,"type":"PDF","bodyMarkdown":null,
     "media":{"kind":"pdf","contentId":"00000000-0000-4000-8000-0000000000bb","allowDownload":false},"webPath":"/ios/lesson/h1"},
     "viewer":{"name":"تلميذ تجريبي","code":"0a1b2c3d"}}}
    """#

    static let courseTerms = #"""
    {"ok":true,"data":{"needsTerms":true,"course":{"slug":"fixture-terms","title":"دورة بشروط"},"webPath":"/ios/course/fixture-terms"}}
    """#
}
#endif
