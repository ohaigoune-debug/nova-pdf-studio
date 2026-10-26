import XCTest

/// Actual execution still requires Xcode/iPhone Simulator. These cases cover only
/// a disconnected, signed-out Debug shell; they are not authenticated WebKit tests.
final class MadrasadzUITests: XCTestCase {
    @MainActor private func checkShell(language: String, locale: String, labels: [String]) throws {
        #if !DEBUG
        throw XCTSkip("Offline shell validation is compiled out of Release. Validate Release integration against an isolated HTTPS backend manually.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale,
                                "--madrasadz-offline-shell-validation"]
        app.launch()
        defer { app.terminate() }
        XCTAssertTrue(app.tabBars.buttons[labels[0]].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 5))
        app.buttons["retryPage"].tap()
        XCTAssertTrue(app.buttons["retryPage"].exists)
        app.tabBars.buttons[labels[1]].tap()
        XCTAssertTrue(app.buttons[labels[3]].waitForExistence(timeout: 5))
        app.tabBars.buttons[labels[2]].tap()
        XCTAssertTrue(app.buttons[labels[3]].exists)
        app.tabBars.buttons[labels[0]].tap()
        app.buttons["accountButton"].tap()
        XCTAssertTrue(app.buttons[labels[4]].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons[labels[5]].exists)
        XCTAssertTrue(app.buttons[labels[6]].exists)
        let capture = XCTAttachment(screenshot: app.screenshot())
        capture.name = "Disconnected-native-shell-\(language)"
        capture.lifetime = .keepAlways
        add(capture)
        #endif
    }

    @MainActor func testEnglishDisconnectedShell() throws {
        try checkShell(language: "en", locale: "en_US", labels: ["Learn", "Bookmarks", "Revision plan", "Sign in", "Profile and account deletion", "Privacy policy", "Sign out"])
    }

    @MainActor func testFrenchDisconnectedShell() throws {
        try checkShell(language: "fr", locale: "fr_FR", labels: ["Apprendre", "Favoris", "Révisions", "Se connecter", "Profil et suppression du compte", "Confidentialité", "Se déconnecter"])
    }

    @MainActor func testArabicDisconnectedShell() throws {
        try checkShell(language: "ar", locale: "ar_DZ", labels: ["التعلّم", "المفضلة", "خطة المراجعة", "تسجيل الدخول", "ملفي وحذف الحساب", "سياسة الخصوصية", "تسجيل الخروج"])
    }
}
