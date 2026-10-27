import XCTest

/// Actual execution still requires Xcode/iPhone Simulator. These cases cover only
/// a disconnected, signed-out Debug shell; they are not authenticated WebKit tests.
final class MadrasadzUITests: XCTestCase {
    /// Public, unauthenticated WebKit navigation only. Run explicitly with
    /// test-public-navigation.sh; the offline suite skips this networked case.
    @MainActor func testPublicLearningNavigation() throws {
        #if !DEBUG
        throw XCTSkip("Run the public navigation smoke test in Debug.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ"]
        app.launch()
        defer {
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Public-WebKit-navigation-no-account"
            capture.lifetime = .keepAlways
            add(capture)
            app.terminate()
        }
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.staticTexts["مساحة التعلّم"].waitForExistence(timeout: 60))
        // Exercise real background -> inactive -> active transitions repeatedly.
        for cycle in 1...3 {
            XCUIDevice.shared.press(.home)
            app.activate()
            XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
            XCTAssertTrue(web.staticTexts["مساحة التعلّم"].waitForExistence(timeout: 40))
            let resumed = XCTAttachment(screenshot: app.screenshot())
            resumed.name = "Public-foreground-cycle-\(cycle)"
            resumed.lifetime = .keepAlways
            add(resumed)
        }
        let login = web.links["تسجيل الدخول"].firstMatch
        XCTAssertTrue(login.waitForExistence(timeout: 10))
        login.tap()
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        app.tabBars.buttons["المفضلة"].tap()
        XCTAssertTrue(app.staticTexts["سجّل الدخول لتفتح مفضلتك وخطة مراجعتك الخاصة بهذا الحساب."].waitForExistence(timeout: 30))
        app.buttons["تسجيل الدخول"].tap()
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        #endif
    }

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
