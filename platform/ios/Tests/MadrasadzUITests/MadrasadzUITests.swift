import UIKit
import XCTest

/// Actual execution still requires Xcode/iPhone Simulator. These cases cover only
/// a disconnected, signed-out Debug shell; they are not authenticated WebKit tests.
final class MadrasadzUITests: XCTestCase {
    /// The signed-out /ios page heading (server 662680b and later).
    private let publicLearningHeading = "مرحبًا بك في مدرسة"

    /// Public, unauthenticated WebKit navigation only. Run explicitly with
    /// test-public-navigation.sh; the offline suite skips this networked case.
    /// Forces the web learning pages (Build 7 path) so WebKit recovery stays covered.
    @MainActor func testPublicLearningNavigation() throws {
        #if !DEBUG
        throw XCTSkip("Run the public navigation smoke test in Debug.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ", "--madrasadz-web-learning"]
        app.launch()
        defer {
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Public-WebKit-accessibility-no-account"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Public-WebKit-navigation-no-account"
            capture.lifetime = .keepAlways
            add(capture)
            app.terminate()
        }
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.staticTexts[publicLearningHeading].waitForExistence(timeout: 60))
        // The accessibility tree can exist while the web area is not painted, so
        // every foreground step also checks the on-screen pixels of that area.
        XCTAssertTrue(waitForPaintedWebArea(app, web, timeout: 30), "Learning page was not painted before backgrounding")
        // Exercise real background -> inactive -> active transitions repeatedly.
        for cycle in 1...3 {
            XCUIDevice.shared.press(.home)
            app.activate()
            XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
            XCTAssertTrue(web.staticTexts[publicLearningHeading].waitForExistence(timeout: 40))
            XCTAssertTrue(waitForPaintedWebArea(app, web, timeout: 30), "Cycle \(cycle): web area stayed uniform (blank/black)")
            let resumed = XCTAttachment(screenshot: app.screenshot())
            resumed.name = "Public-foreground-cycle-\(cycle)"
            resumed.lifetime = .keepAlways
            add(resumed)
        }
        // Rapid repeated switching without waiting for the page in between.
        for _ in 1...4 {
            XCUIDevice.shared.press(.home)
            app.activate()
        }
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(web.staticTexts[publicLearningHeading].waitForExistence(timeout: 40))
        XCTAssertTrue(waitForPaintedWebArea(app, web, timeout: 30), "Rapid switching left the web area uniform (blank/black)")
        XCTAssertFalse(app.buttons["retryPage"].exists, "Rapid switching must not end in the failure state")
        let rapid = XCTAttachment(screenshot: app.screenshot())
        rapid.name = "Public-foreground-rapid-switching"
        rapid.lifetime = .keepAlways
        add(rapid)
        let login = web.links["تسجيل الدخول"].firstMatch
        XCTAssertTrue(login.waitForExistence(timeout: 10))
        login.tap()
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        app.tabBars.buttons["المفضلة"].tap()
        XCTAssertTrue(app.staticTexts["سجّل الدخول لتفتح مفضلتك وخطة مراجعتك الخاصة بهذا الحساب."].waitForExistence(timeout: 30))
        app.buttons["تسجيل الدخول"].tap()
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        attachForegroundDiagnostics(app)
        #endif
    }

    /// Native learning against the public server, signed out: the app asks the
    /// server for its capabilities, shows the native welcome card, opens sign-in
    /// in the web view and comes back. No credentials, writes or test accounts.
    @MainActor func testPublicNativeLearning() throws {
        #if !DEBUG
        throw XCTSkip("Run the public native smoke test in Debug.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ"]
        app.launch()
        defer {
            let capture = XCTAttachment(screenshot: app.screenshot())
            capture.name = "Public-native-learning-no-account"
            capture.lifetime = .keepAlways
            add(capture)
            attachForegroundDiagnostics(app)
            app.terminate()
        }
        let signIn = app.buttons["nativeSignIn"]
        XCTAssertTrue(signIn.waitForExistence(timeout: 60), "Native welcome card did not appear (server capabilities or home API)")
        XCTAssertTrue(labelled(app, "مرحبًا بك في مدرسة").exists)
        XCTAssertTrue(labelled(app, "مجانًا للجميع").exists)
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "Public-native-home"
        home.lifetime = .keepAlways
        add(home)
        // Background and return: native screens have no web view to recover.
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(signIn.waitForExistence(timeout: 20))
        signIn.tap()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        XCTAssertTrue(waitForPaintedWebArea(app, web, timeout: 30), "Sign-in page was not painted in the web destination")
        app.buttons["webBack"].tap()
        XCTAssertTrue(signIn.waitForExistence(timeout: 20), "Back from the web destination must return to the native home")
        #endif
    }

    /// Native home and course screens from built-in sample data (Debug only,
    /// disconnected: no server, account or WebKit page load).
    @MainActor func testNativeLearningFixture() throws {
        #if !DEBUG
        throw XCTSkip("Native fixtures are compiled out of Release.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ",
                                "--madrasadz-offline-shell-validation", "--madrasadz-native-fixture"]
        app.launch()
        defer {
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Native-fixture-accessibility"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            app.terminate()
        }
        XCTAssertTrue(labelled(app, "مساحة التعلّم").waitForExistence(timeout: 15))
        XCTAssertTrue(labelled(app, "دوراتي").exists)
        XCTAssertTrue(labelled(app, "تدرّب واختبر نفسك").exists)
        let homeShot = XCTAttachment(screenshot: app.screenshot())
        homeShot.name = "Native-fixture-home"
        homeShot.lifetime = .keepAlways
        add(homeShot)
        let course = app.buttons.matching(identifier: "courseCard").firstMatch
        XCTAssertTrue(course.waitForExistence(timeout: 5))
        course.tap()
        let rows = app.buttons.matching(identifier: "lessonRow")
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 10))
        XCTAssertGreaterThanOrEqual(rows.count, 2)
        let courseShot = XCTAttachment(screenshot: app.screenshot())
        courseShot.name = "Native-fixture-course"
        courseShot.lifetime = .keepAlways
        add(courseShot)
        // A lesson opens in the web view; disconnected, it shows Retry.
        rows.firstMatch.tap()
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 10))
        app.buttons["webBack"].tap()
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 10), "Back must return to the native course")
        let closed = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: app.buttons["retryPage"])
        wait(for: [closed], timeout: 10)
        #endif
    }

    /// Any element whose accessibility label is exactly `label` (SwiftUI may
    /// combine a heading's icon and text into one element of another type).
    @MainActor private func labelled(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    /// Polls the centre of the web area for visible variation. A hidden/unpainted
    /// WKWebView or an opaque shield samples as one colour. Requires about 2 s of
    /// consecutive painted samples (after the app's own ~0.7 s foreground check)
    /// with neither the restoring placeholder nor the failure view present.
    @MainActor private func waitForPaintedWebArea(_ app: XCUIApplication, _ web: XCUIElement, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        let restoring = app.descendants(matching: .any)["restoringPage"]
        let retry = app.buttons["retryPage"]
        var consecutive = 0
        repeat {
            if !restoring.exists, !retry.exists, webAreaShowsContent(app, web) {
                consecutive += 1
                if consecutive >= 4 { return true }
            } else {
                consecutive = 0
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        } while Date() < deadline
        return false
    }

    @MainActor private func webAreaShowsContent(_ app: XCUIApplication, _ web: XCUIElement) -> Bool {
        guard web.exists, let image = app.screenshot().image.cgImage, app.frame.width > 0 else { return false }
        let scale = CGFloat(image.width) / app.frame.width
        let frame = web.frame
        // Central region only: native bars and safe-area edges are excluded.
        let region = CGRect(x: (frame.minX + frame.width * 0.05) * scale,
                            y: (frame.minY + frame.height * 0.2) * scale,
                            width: frame.width * 0.9 * scale,
                            height: frame.height * 0.6 * scale).integral
        guard region.width >= 8, region.height >= 8, let crop = image.cropping(to: region) else { return false }
        let width = 32
        let height = 64
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                                          bitsPerComponent: 8, bytesPerRow: width * 4,
                                          space: CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            // Nearest-neighbour sampling keeps thin text from averaging away.
            context.interpolationQuality = .none
            context.draw(crop, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return false }
        var minimum: [UInt8] = [255, 255, 255]
        var maximum: [UInt8] = [0, 0, 0]
        var index = 0
        while index < pixels.count {
            for channel in 0..<3 {
                minimum[channel] = min(minimum[channel], pixels[index + channel])
                maximum[channel] = max(maximum[channel], pixels[index + channel])
            }
            index += 4
        }
        return (0..<3).contains { maximum[$0] - minimum[$0] > 12 }
    }

    /// Debug-only native lifecycle log (codes and timings, no account is used).
    @MainActor private func attachForegroundDiagnostics(_ app: XCUIApplication) {
        let account = app.buttons["accountButton"]
        guard account.waitForExistence(timeout: 10) else { return }
        account.tap()
        let entry = app.buttons["foregroundDiagnostics"]
        guard entry.waitForExistence(timeout: 10) else { return }
        entry.tap()
        let report = app.staticTexts["diagnosticsReport"]
        if report.waitForExistence(timeout: 10) {
            let text = XCTAttachment(string: report.label)
            text.name = "Foreground-diagnostics-no-account"
            text.lifetime = .keepAlways
            add(text)
        }
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

    /// Simulates capture ON only inside the disconnected Debug fixture. This
    /// tests the real cover path and translations, not Control Center recording.
    @MainActor private func checkCaptureShield(language: String, locale: String, message: String) throws {
        #if !DEBUG
        throw XCTSkip("Capture simulation is compiled out of Release; it never overrides a real capture state.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale,
                                "--madrasadz-offline-shell-validation", "--madrasadz-capture-shield-validation"]
        app.launch()
        defer { app.terminate() }
        XCTAssertTrue(app.staticTexts[message].waitForExistence(timeout: 10))
        let stopSimulation = app.buttons["endCaptureValidation"]
        // Capture diagnostics before assertions so a failure preserves the
        // actual disconnected hierarchy. This fixture never authenticates an
        // account or loads student data, tokens or backend documents.
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "Simulated-capture-accessibility-\(language)"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        XCTAssertTrue(stopSimulation.waitForExistence(timeout: 5))
        XCTAssertTrue(stopSimulation.isHittable)
        let capture = XCTAttachment(screenshot: app.screenshot())
        capture.name = "Simulated-capture-shield-\(language)"
        capture.lifetime = .keepAlways
        add(capture)
        stopSimulation.tap()
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts[message].exists)
        // Also exercise the existing renderer replacement path. A recovered
        // WKWebView must get a fresh capture observer and native container.
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 10))
        #endif
    }

    @MainActor func testEnglishCaptureShieldInDisconnectedDebugShell() throws {
        try checkCaptureShield(language: "en", locale: "en_US", message: "Stop screen recording or mirroring to return to your lesson. Video playback has been paused.")
    }

    @MainActor func testFrenchCaptureShieldInDisconnectedDebugShell() throws {
        try checkCaptureShield(language: "fr", locale: "fr_FR", message: "Arrêtez l’enregistrement ou la recopie de l’écran pour revenir au cours. La vidéo a été mise en pause.")
    }

    @MainActor func testArabicCaptureShieldInDisconnectedDebugShell() throws {
        try checkCaptureShield(language: "ar", locale: "ar_DZ", message: "أوقف تسجيل الشاشة أو بثّها للعودة إلى الدرس. أُوقف تشغيل الفيديو.")
    }
}
