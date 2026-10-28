import Foundation
import XCTest
@testable import MadrasadzCore

final class NavigationPolicyTests: XCTestCase {
    private let policy = NavigationPolicy.production

    func testDedicatedPortalAndProtectedStudyPagesRemainInternal() {
        for path in ["/ios", "/ios/course/الرياضيات", "/ios/lesson/الجبر", "/student", "/student/lessons/a", "/student/videos/123", "/student/quizzes/q/attempt/a", "/api/v1/media/id?signature=token", "/student/profile#delete"] {
            let url = URL(string: "https://madrasadz.com" + path)!
            XCTAssertEqual(policy.decision(for: url), .internalPage(url), path)
        }
    }

    func testAuthenticationRecoveryAndPhoneGateRemainInternal() {
        for path in ["/login", "/register", "/forgot-password", "/reset-password?token=secret", "/verify-phone", "/student/verify-phone"] {
            let url = URL(string: "https://madrasadz.com" + path)!
            XCTAssertEqual(policy.decision(for: url), .internalPage(url), path)
        }
    }

    func testAccountDeletionConfirmationRemainsInternalButCannotBeBookmarked() {
        let url = URL(string: "https://madrasadz.com/delete-account?done=1")!
        XCTAssertEqual(policy.decision(for: url), .internalPage(url))
        XCTAssertNil(policy.bookmarkPath(for: url))
    }

    func testEncodedCredentialsAndControlCharactersCannotBypassPolicy() {
        for raw in [
            "https://%75ser:pass@madrasadz.com/ios",
            "https://madrasadz.com%40evil.test@madrasadz.com/ios",
            "https://@madrasadz.com/ios",
            "https://madrasadz.com/ios/course/foo%0Abar",
            "https://madrasadz.com/ios/lesson/foo%0Dbar",
            "https://madrasadz.com/ios/lesson/foo%7Fbar"
        ] {
            XCTAssertEqual(policy.decision(for: URL(string: raw)!), .blocked(.unsafeURL), raw)
        }
        for path in ["/%73tore", "/student/courses/%63atalog", "/student/courses/%6frders"] {
            XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com" + path)!), .blocked(.purchasesUnavailable), path)
        }
    }

    func testOnlyExactOriginStaysInWebView() {
        for raw in ["https://madrasadz.com.evil.test/ios", "https://evil.madrasadz.com/ios", "https://www.madrasadz.com/ios", "https://example.org/lesson"] {
            let url = URL(string: raw)!
            XCTAssertEqual(policy.decision(for: url), .external(url))
        }
    }

    func testExplicitDefaultHTTPSPortIsAccepted() {
        let url = URL(string: "https://madrasadz.com:443/ios")!
        XCTAssertEqual(policy.decision(for: url), .internalPage(url))
    }

    func testCredentialsAndNonHTTPSAreRejected() {
        for raw in ["https://name@madrasadz.com/ios", "https://name:pass@madrasadz.com/ios", "https://madrasadz.com:8443/ios", "http://madrasadz.com/ios", "javascript:alert(1)", "file:///etc/passwd", "blob:https://madrasadz.com/secret", "data:text/html,hello", "about:blank"] {
            XCTAssertEqual(policy.decision(for: URL(string: raw)!), .blocked(.unsafeURL), raw)
        }
    }

    func testCommerceAndAlternativeCodeActivationAreUnavailable() {
        for path in ["/store", "/store/orders/id", "/checkout", "/cart", "/claim/code", "/activate", "/student/courses/catalog", "/student/courses/orders", "/student/courses/maths/order", "/student/codes", "/student/activation", "/ios/store"] {
            XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com" + path)!), .blocked(.purchasesUnavailable), path)
        }
    }

    func testKnownExternalPaymentProvidersDoNotOpenSafari() {
        for raw in ["https://checkout.stripe.com/pay/123", "https://paypal.com/pay", "https://pay.chargily.net/a"] {
            XCTAssertEqual(policy.decision(for: URL(string: raw)!), .blocked(.purchasesUnavailable))
        }
    }

    func testUnsupportedCommunityAndStaffRoutesAreBlocked() {
        XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com/forum/topic")!), .blocked(.communityUnavailable))
        for path in ["/student/groups", "/student/groups/group-id", "/student/forum/topic"] {
            XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com" + path)!), .blocked(.communityUnavailable))
        }
        // Owner-approved teacher-led virtual classroom (internal build).
        for path in ["/student/classroom", "/student/classroom/topic"] {
            let url = URL(string: "https://madrasadz.com" + path)!
            XCTAssertEqual(policy.decision(for: url), .internalPage(url))
        }
        for prefix in ["admin", "teacher", "assistant"] {
            XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com/\(prefix)/settings")!), .blocked(.roleUnavailable))
        }
        XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com/unknown-route")!), .blocked(.unsupportedRoute))
        XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com/ios/unknown")!), .blocked(.unsupportedRoute))
    }

    func testEncodedAndTraversalPathsFailClosed() {
        for path in ["/student%2fcourses/a/order", "/student/%2e%2e/store", "/student/%252e%252e/store", "/ios//course/a", "/ios/%00course", "/ios/%5ccourse"] {
            XCTAssertEqual(policy.decision(for: URL(string: "https://madrasadz.com" + path)!), .blocked(.unsafeURL), path)
        }
    }

    func testTelephoneAndMailUseExternalSystemHandlers() {
        for raw in ["tel:+213555123456", "mailto:support@example.org"] {
            let url = URL(string: raw)!
            XCTAssertEqual(policy.decision(for: url), .external(url))
        }
        XCTAssertEqual(policy.decision(for: URL(string: "mailto:someone@example.org%0Abcc:other@example.org")!), .blocked(.unsafeURL))
    }

    func testMisconfiguredBaseURLCannotExpandTrust() {
        for base in ["http://madrasadz.com", "https://other.example", "https://madrasadz.com/staging", "https://user@madrasadz.com"] {
            let configured = NavigationPolicy(baseURL: URL(string: base)!)
            XCTAssertEqual(configured.decision(for: URL(string: "https://madrasadz.com/ios")!), .blocked(.unsafeURL))
        }
    }

    func testBookmarksPersistOnlySafeStudyPathsWithoutSecrets() {
        let url = URL(string: "https://madrasadz.com/student/lessons/الجبر?token=private&signature=private#fragment")!
        let path = policy.bookmarkPath(for: url)
        XCTAssertNotNil(path)
        XCTAssertFalse(path!.contains("token"))
        XCTAssertFalse(path!.contains("#"))
        XCTAssertEqual(policy.url(forBookmarkPath: path!)?.host, "madrasadz.com")
    }

    func testAuthAndAPIPagesCannotBecomeBookmarks() {
        for path in ["/login", "/reset-password?token=private", "/student/profile", "/api/v1/media/id?signature=secret", "/student/courses/catalog", "/forum"] {
            XCTAssertNil(policy.bookmarkPath(for: URL(string: "https://madrasadz.com" + path)!))
        }
    }

    func testStoredBookmarksCannotContainProtocolRelativeOrAbsoluteURLs() {
        for path in ["//evil.example/ios", "https://evil.example/ios", "/student/lessons/a?token=secret", "/student/lessons/a#x", "/student/%2fstore", "/store"] {
            XCTAssertNil(policy.url(forBookmarkPath: path), path)
        }
    }

    func testNativeRoutesCoverOnlyTheLearningHomeAndCoursePages() {
        let route = { (path: String) in self.policy.nativeRoute(for: URL(string: "https://madrasadz.com" + path)!) }
        XCTAssertEqual(route("/ios"), .home)
        XCTAssertEqual(route("/ios/"), .home)
        XCTAssertEqual(route("/student/courses"), .home)
        XCTAssertEqual(route("/ios/course/الرياضيات"), .course("الرياضيات"))
        XCTAssertEqual(route("/student/courses/%D8%AF%D9%88%D8%B1%D8%A9"), .course("دورة"))
        XCTAssertEqual(route("/ios/course/a?x=1#y"), .course("a"))
        for path in ["/ios/lesson/a", "/student/courses/a/order", "/student/courses/catalog", "/student/play", "/login", "/ios/course/", "/ios/course/a/b", "/admin"] {
            XCTAssertNil(route(path), path)
        }
        XCTAssertNil(policy.nativeRoute(for: URL(string: "https://evil.example/ios")!))
    }
}
