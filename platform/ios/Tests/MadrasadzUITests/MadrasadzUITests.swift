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
        // Bookmarks moved from a tab of their own to «حسابي» (site shell).
        app.buttons["tab.account"].tap()
        app.buttons["account.saved"].tap()
        XCTAssertTrue(app.staticTexts["سجّل الدخول لتفتح مفضلتك وخطة مراجعتك الخاصة بهذا الحساب."].waitForExistence(timeout: 30))
        app.buttons["identitySignIn"].firstMatch.tap()
        XCTAssertTrue(web.textFields["البريد الإلكتروني"].waitForExistence(timeout: 40))
        XCTAssertTrue(app.buttons["tab.home"].isSelected, "Sign-in opens in the web learning root at Home")
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
        assertShellTabs(app, labels: arabicTabs)
        XCTAssertTrue(app.buttons["homeTile.play"].exists, "The home grid is shown to guests too")
        assertNoCommerce(app)
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
        XCTAssertTrue(labelled(app, "لوحة الطالب").exists)
        XCTAssertTrue(labelled(app, "ماذا تريد أن تتعلم اليوم؟").exists)
        assertShellTabs(app, labels: arabicTabs)
        XCTAssertTrue(app.buttons["tab.home"].isSelected)
        // The four cards of the website's home, each a real button.
        let tiles = ["homeTile.lessons": "الدروس", "homeTile.courses": "دوراتي",
                     "homeTile.exams": "الفروض والاختبارات", "homeTile.play": "مدرسة PLAY"]
        for (identifier, label) in tiles {
            let tile = app.buttons[identifier]
            XCTAssertTrue(tile.exists, "Missing home card \(identifier)")
            XCTAssertEqual(tile.label, label)
        }
        // Two ACTIVE courses in the fixture; the count comes from the API answer.
        XCTAssertEqual(app.buttons["homeTile.courses"].value as? String, "2 دورة مفعّلة")
        XCTAssertEqual(app.buttons["homeTile.lessons"].value as? String, "المحتوى المجاني")
        XCTAssertTrue(app.buttons["resumeCourse"].exists, "«متابعة التعلّم» links to the first active course")
        XCTAssertTrue(app.buttons.matching(identifier: "courseCard").firstMatch.exists)
        assertNoCommerce(app)
        attachScreenshot(app, "Native-fixture-home")
        // The cards open their destinations: «الدروس» selects «دروسي».
        app.buttons["homeTile.lessons"].tap()
        XCTAssertTrue(app.buttons["hub.lessons"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["tab.lessons"].isSelected)
        // «استكشف»: practice tools from the API and the bac bank, no catalogue.
        app.buttons["tab.explore"].tap()
        XCTAssertTrue(labelled(app, "تدرّب واختبر نفسك").waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["exploreTool.play"].exists)
        XCTAssertTrue(app.buttons["exploreBacBank"].exists)
        assertNoCommerce(app)
        attachScreenshot(app, "Native-fixture-explore")
        // «دوراتي» (IMG_6713): hub tabs without store tabs, enrolled courses only.
        app.buttons["tab.courses"].tap()
        XCTAssertTrue(app.buttons["hub.courses"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons["hub.courses"].label, "دوراتي")
        XCTAssertEqual(app.buttons["hub.classroom"].label, "القسم الافتراضي")
        XCTAssertEqual(app.buttons["hub.progress"].label, "تقدّمي")
        XCTAssertTrue(app.buttons["coursesExplore"].exists)
        XCTAssertTrue(app.buttons["coursesPlanner"].exists)
        let enter = app.buttons.matching(identifier: "courseEnter")
        XCTAssertTrue(enter.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(enter.count, 2, "One entry per active course; the ended course has none")
        XCTAssertTrue(labelled(app, "انتهى").exists, "The ended course is listed as ended")
        assertNoCommerce(app)
        attachScreenshot(app, "Native-fixture-courses")
        let course = enter.firstMatch
        reveal(course, in: app)
        course.tap()
        XCTAssertTrue(app.buttons["tab.courses"].isSelected, "A course opened from «دوراتي» keeps its destination selected")
        let rows = app.buttons.matching(identifier: "lessonRow")
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 10))
        XCTAssertGreaterThanOrEqual(rows.count, 2)
        let courseShot = XCTAttachment(screenshot: app.screenshot())
        courseShot.name = "Native-fixture-course"
        courseShot.lifetime = .keepAlways
        add(courseShot)
        // A lesson opens natively (Build 9): title, text and its actions.
        reveal(rows.firstMatch, in: app)
        rows.firstMatch.tap()
        XCTAssertTrue(labelled(app, "الحصة 1 — الدوال").waitForExistence(timeout: 10))
        XCTAssertTrue(labelled(app, "تعريف الدالة").exists, "lesson text headings are rendered")
        let lessonShot = XCTAttachment(screenshot: app.screenshot())
        lessonShot.name = "Native-fixture-lesson"
        lessonShot.lifetime = .keepAlways
        add(lessonShot)
        // The full web page opens in the web view; disconnected, it shows Retry.
        reveal(app.buttons["lessonWebPage"], in: app)
        app.buttons["lessonWebPage"].tap()
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 10))
        app.buttons["webBack"].tap()
        XCTAssertTrue(labelled(app, "الحصة 1 — الدوال").waitForExistence(timeout: 10), "Back must return to the native lesson")
        let closed = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: app.buttons["retryPage"])
        wait(for: [closed], timeout: 10)
        // A bottom-bar destination always opens at its root, as the site's links do.
        app.buttons["tab.home"].tap()
        XCTAssertTrue(labelled(app, "ماذا تريد أن تتعلم اليوم؟").waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["lessonWebPage"].exists)
        #endif
    }

    /// The free-lessons series open as their own list with full names (Build 9).
    @MainActor func testNativeCollectionFixture() throws {
        #if !DEBUG
        throw XCTSkip("Native fixtures are compiled out of Release.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ",
                                "--madrasadz-offline-shell-validation", "--madrasadz-native-fixture"]
        app.launch()
        defer { app.terminate() }
        // «دروسي»: the lessons hub tabs and every free series and lesson.
        let lessonsTab = app.buttons["tab.lessons"]
        XCTAssertTrue(lessonsTab.waitForExistence(timeout: 15))
        lessonsTab.tap()
        XCTAssertTrue(app.buttons["hub.lessons"].waitForExistence(timeout: 5))
        XCTAssertTrue(lessonsTab.isSelected)
        XCTAssertEqual(app.buttons["hub.lessons"].label, "دروسي")
        XCTAssertEqual(app.buttons["hub.videos"].label, "الفيديوهات")
        XCTAssertEqual(app.buttons["hub.files"].label, "الملفات")
        let series = app.buttons.matching(identifier: "freeCollection").firstMatch
        XCTAssertTrue(series.waitForExistence(timeout: 15))
        XCTAssertEqual(app.buttons.matching(identifier: "lessonsSingle").count, 1)
        assertNoCommerce(app)
        attachScreenshot(app, "Native-fixture-lessons")
        series.tap()
        let lessons = app.buttons.matching(identifier: "collectionLesson")
        XCTAssertTrue(lessons.firstMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(lessons.count, 2)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Native-fixture-collection"
        shot.lifetime = .keepAlways
        add(shot)
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

    /// Labels of one language for the disconnected shell check.
    private struct ShellLabels {
        let tabs: [String]
        let signIn: String
        let profile: String
        let privacy: String
        let logout: String
        let hub: [String]
    }

    /// The disconnected Debug shell (no server: the web learning root shows
    /// Retry): the five destinations, the personal space under «حسابي», the
    /// destinations that need the server, and the ☰ menu.
    @MainActor private func checkShell(language: String, locale: String, labels: ShellLabels) throws {
        #if !DEBUG
        throw XCTSkip("Offline shell validation is compiled out of Release. Validate Release integration against an isolated HTTPS backend manually.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale,
                                "--madrasadz-offline-shell-validation"]
        app.launch()
        defer { app.terminate() }
        XCTAssertTrue(app.buttons["tab.home"].waitForExistence(timeout: 10))
        assertShellTabs(app, labels: labels.tabs)
        XCTAssertTrue(app.buttons["tab.home"].isSelected)
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 5))
        app.buttons["retryPage"].tap()
        XCTAssertTrue(app.buttons["retryPage"].exists)
        // Bookmarks and the revision plan (tabs before the site shell) under «حسابي».
        app.buttons["tab.account"].tap()
        XCTAssertTrue(app.buttons["tab.account"].isSelected)
        XCTAssertTrue(app.descendants(matching: .any)["shellHeader"].waitForExistence(timeout: 5))
        app.buttons["account.saved"].tap()
        XCTAssertTrue(app.buttons["identitySignIn"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons["identitySignIn"].label, labels.signIn)
        app.buttons["tab.account"].tap()
        app.buttons["account.planner"].tap()
        XCTAssertTrue(app.buttons["identitySignIn"].waitForExistence(timeout: 5))
        app.buttons["tab.account"].tap()
        XCTAssertTrue(app.buttons["account.downloads"].waitForExistence(timeout: 5))
        // «دوراتي» keeps the site's layout without the store tabs or buttons.
        app.buttons["tab.courses"].tap()
        XCTAssertTrue(app.buttons["hub.courses"].waitForExistence(timeout: 5))
        XCTAssertEqual([app.buttons["hub.courses"].label, app.buttons["hub.classroom"].label, app.buttons["hub.progress"].label], labels.hub)
        XCTAssertTrue(app.buttons["coursesExplore"].exists)
        XCTAssertTrue(app.buttons["coursesPlanner"].exists)
        assertNoCommerce(app)
        // Without the server the native destinations point back to Home.
        app.buttons["tab.explore"].tap()
        XCTAssertTrue(app.buttons["nativeUnavailableHome"].waitForExistence(timeout: 5))
        app.buttons["nativeUnavailableHome"].tap()
        XCTAssertTrue(app.buttons["tab.home"].isSelected)
        XCTAssertTrue(app.buttons["retryPage"].waitForExistence(timeout: 5))
        app.buttons["accountButton"].tap()
        XCTAssertTrue(app.buttons[labels.signIn].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons[labels.profile].exists)
        XCTAssertTrue(app.buttons[labels.privacy].exists)
        XCTAssertTrue(app.buttons[labels.logout].exists)
        attachScreenshot(app, "Disconnected-native-shell-\(language)")
        #endif
    }

    @MainActor func testEnglishDisconnectedShell() throws {
        try checkShell(language: "en", locale: "en_US", labels: ShellLabels(
            tabs: ["Home", "My lessons", "Explore", "My courses", "My account"], signIn: "Sign in",
            profile: "Profile and account deletion", privacy: "Privacy policy", logout: "Sign out",
            hub: ["My courses", "Virtual classroom", "My progress"]))
    }

    @MainActor func testFrenchDisconnectedShell() throws {
        try checkShell(language: "fr", locale: "fr_FR", labels: ShellLabels(
            tabs: ["Accueil", "Mes leçons", "Explorer", "Mes cours", "Mon compte"], signIn: "Se connecter",
            profile: "Profil et suppression du compte", privacy: "Confidentialité", logout: "Se déconnecter",
            hub: ["Mes cours", "Classe virtuelle", "Ma progression"]))
    }

    @MainActor func testArabicDisconnectedShell() throws {
        try checkShell(language: "ar", locale: "ar_DZ", labels: ShellLabels(
            tabs: arabicTabs, signIn: "تسجيل الدخول",
            profile: "ملفي وحذف الحساب", privacy: "سياسة الخصوصية", logout: "تسجيل الخروج",
            hub: ["دوراتي", "القسم الافتراضي", "تقدّمي"]))
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
    // MARK: - Site shell (owner screenshots IMG_6713 / IMG_6714)

    /// The website's bottom bar, in its order (start edge first).
    private let arabicTabs = ["الرئيسية", "دروسي", "استكشف", "دوراتي", "حسابي"]
    private static let tabIdentifiers = ["tab.home", "tab.lessons", "tab.explore", "tab.courses", "tab.account"]
    /// Store entries of the website that the study-only iPhone app must not show.
    private let commerceLabels = ["شراء دورة", "طلباتي", "طلباتي وحالة التوصيل", "اكتشف الدورات المتاحة",
                                  "اكتشف الدورات", "تصفّح كتالوج الدورات", "تصفّح الدورات"]

    /// The shell's geometry, order and colours with the built-in sample data
    /// (Arabic, right to left), measured from accessibility frames and the
    /// Simulator screenshot's pixels.
    @MainActor func testShellLayoutFixture() throws {
        #if !DEBUG
        throw XCTSkip("Native fixtures are compiled out of Release.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ",
                                "--madrasadz-offline-shell-validation", "--madrasadz-native-fixture"]
        app.launch()
        defer { app.terminate() }
        let header = app.descendants(matching: .any)["shellHeader"]
        let bar = app.descendants(matching: .any)["shellTabBar"]
        XCTAssertTrue(labelled(app, "ماذا تريد أن تتعلم اليوم؟").waitForExistence(timeout: 15))
        XCTAssertTrue(header.exists)
        XCTAssertTrue(bar.exists)
        // The owner's screenshots are dark: start from the dark appearance.
        let theme = app.buttons["themeToggle"]
        if (theme.value as? String) == "فاتح" { theme.tap() }
        XCTAssertEqual(theme.value as? String, "داكن")
        let window = app.frame
        // Bottom bar: right-to-left order, 44 pt targets, «استكشف» raised and centred.
        let frames = Self.tabIdentifiers.map { app.buttons[$0].frame }
        for (identifier, frame) in zip(Self.tabIdentifiers, frames) {
            XCTAssertGreaterThanOrEqual(frame.height, 44, identifier)
            XCTAssertGreaterThanOrEqual(frame.width, 44, identifier)
            XCTAssertLessThanOrEqual(frame.maxY, window.maxY, identifier)
        }
        for index in 1..<frames.count {
            XCTAssertLessThan(frames[index].midX, frames[index - 1].midX,
                              "RTL: \(Self.tabIdentifiers[index]) must be left of \(Self.tabIdentifiers[index - 1])")
        }
        XCTAssertLessThan(frames[2].minY, frames[0].minY - 5, "«استكشف» is raised above the other items")
        XCTAssertEqual(frames[2].midX, window.midX, accuracy: 2, "«استكشف» is centred")
        XCTAssertGreaterThan(bar.frame.minY, window.height * 0.7, "The bar sits at the bottom")
        // Header (72 pt): ☰ at the start (right) edge, logo centred, theme at the end edge.
        XCTAssertEqual(header.frame.height, 72, accuracy: 1)
        XCTAssertGreaterThan(app.buttons["accountButton"].frame.midX, window.midX)
        XCTAssertLessThan(theme.frame.midX, window.midX)
        XCTAssertEqual(app.buttons["shellLogo"].frame.midX, window.midX, accuracy: 2)
        XCTAssertGreaterThanOrEqual(app.buttons["accountButton"].frame.height, 44)
        XCTAssertGreaterThanOrEqual(theme.frame.height, 44)
        // Bring the PLAY card fully between the header and the bar.
        let play = app.buttons["homeTile.play"]
        for _ in 0..<6 where play.frame.maxY >= bar.frame.minY {
            scroll(app, by: 160)
        }
        XCTAssertLessThan(play.frame.maxY, bar.frame.minY)
        XCTAssertGreaterThan(play.frame.minY, header.frame.maxY)
        attachScreenshot(app, "Shell-home-grid-dark")
        // Colours of the site's dark palette (globals.css `.dark`).
        let homeTab = app.buttons["tab.home"].frame
        let lessonsTab = app.buttons["tab.lessons"].frame
        let tile = play.frame
        var points = [CGPoint(x: window.midX, y: header.frame.maxY - 5),            // header: card 92 % #16213A
                      CGPoint(x: bar.frame.minX + 3, y: bar.frame.maxY - 3),         // bar: card #17223B
                      CGPoint(x: homeTab.midX + 17, y: homeTab.minY + 13.5),          // selected pill: secondary #26334F
                      CGPoint(x: lessonsTab.midX + 17, y: lessonsTab.minY + 13.5),    // unselected: card
                      CGPoint(x: tile.minX + 6, y: tile.midY)]                        // card #17223B
        points += stride(from: tile.minY + 4, to: min(tile.maxY, tile.minY + 120), by: 2).map { CGPoint(x: tile.midX + 20, y: $0) }
        let sampled = colors(app, at: points)
        XCTAssertEqual(sampled.count, points.count)
        XCTAssertTrue(sampled[0].near(0x16213A), "header colour \(sampled[0])")
        XCTAssertTrue(sampled[1].near(0x17223B), "bar colour \(sampled[1])")
        XCTAssertTrue(sampled[2].near(0x26334F), "selected pill \(sampled[2])")
        XCTAssertTrue(sampled[3].near(0x17223B), "unselected item \(sampled[3])")
        XCTAssertTrue(sampled[4].near(0x17223B), "home card \(sampled[4])")
        XCTAssertTrue(sampled[5...].contains { $0.near(0xD9FA63, tolerance: 20) }, "lime round PLAY icon")
        // The end of a screen is never under the bar or the raised button.
        for _ in 0..<8 { app.swipeUp() }
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        let last = app.buttons["freeShowAll"]
        XCTAssertTrue(last.exists)
        XCTAssertLessThanOrEqual(last.frame.maxY, bar.frame.minY + 1, "Last row \(last.frame) vs bar \(bar.frame)")
        attachScreenshot(app, "Shell-home-end-dark")
        // Every destination root shows the site header and keeps the bar.
        for identifier in Self.tabIdentifiers {
            app.buttons[identifier].tap()
            XCTAssertTrue(app.buttons[identifier].isSelected, identifier)
            XCTAssertTrue(header.waitForExistence(timeout: 5), identifier)
            XCTAssertTrue(app.buttons["accountButton"].isHittable, identifier)
        }
        // The theme button works like the site's: light palette, then dark again.
        app.buttons["tab.home"].tap()
        theme.tap()
        XCTAssertEqual(theme.value as? String, "فاتح")
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        let light = colors(app, at: [CGPoint(x: window.midX, y: header.frame.maxY - 5)])
        XCTAssertTrue(light.first?.near(0xFEFEFD) == true, "light header \(String(describing: light.first))")
        attachScreenshot(app, "Shell-home-light")
        theme.tap()
        XCTAssertEqual(theme.value as? String, "داكن")
        #endif
    }

    /// Accessibility text sizes: the bar stays usable (44 pt targets, bounded
    /// height) and the home cards remain reachable above it.
    @MainActor func testShellLargeTextFixture() throws {
        #if !DEBUG
        throw XCTSkip("Native fixtures are compiled out of Release.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_DZ",
                                "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXL",
                                "--madrasadz-offline-shell-validation", "--madrasadz-native-fixture"]
        app.launch()
        defer { app.terminate() }
        let bar = app.descendants(matching: .any)["shellTabBar"]
        XCTAssertTrue(app.buttons["homeTile.lessons"].waitForExistence(timeout: 15))
        assertShellTabs(app, labels: arabicTabs)
        for identifier in Self.tabIdentifiers {
            let frame = app.buttons[identifier].frame
            XCTAssertGreaterThanOrEqual(frame.height, 44, identifier)
            XCTAssertLessThanOrEqual(frame.maxY, app.frame.maxY, identifier)
        }
        XCTAssertLessThan(bar.frame.height, 150, "Bar height is bounded at large text sizes")
        attachScreenshot(app, "Shell-large-text-home")
        for identifier in ["homeTile.lessons", "homeTile.courses", "homeTile.exams", "homeTile.play"] {
            let tile = app.buttons[identifier]
            reveal(tile, in: app)
            XCTAssertTrue(tile.isHittable, "\(identifier) can be reached above the bar")
        }
        attachScreenshot(app, "Shell-large-text-grid")
        #endif
    }

    @MainActor private func assertShellTabs(_ app: XCUIApplication, labels: [String],
                                            file: StaticString = #filePath, line: UInt = #line) {
        for (identifier, label) in zip(Self.tabIdentifiers, labels) {
            let tab = app.buttons[identifier]
            XCTAssertTrue(tab.waitForExistence(timeout: 10), "Missing \(identifier)", file: file, line: line)
            XCTAssertEqual(tab.label, label, file: file, line: line)
        }
    }

    @MainActor private func assertNoCommerce(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let predicate = NSPredicate(format: "label IN %@ OR label CONTAINS %@", commerceLabels, "طلباتي")
        let found = app.descendants(matching: .any).matching(predicate)
        XCTAssertEqual(found.count, 0, "Store entry shown in the study-only app: \(found.firstMatch.label)", file: file, line: line)
    }

    @MainActor private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    /// Swipes until `element` can be tapped (on screen and not under a bar).
    @MainActor private func reveal(_ element: XCUIElement, in app: XCUIApplication, attempts: Int = 8) {
        for _ in 0..<attempts where !(element.exists && element.isHittable) {
            scroll(app, by: 220)
        }
    }

    /// A short, controlled upward drag in the middle of the screen.
    @MainActor private func scroll(_ app: XCUIApplication, by distance: CGFloat) {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -distance)))
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))
    }

    private struct RGB: CustomStringConvertible {
        let r: Int
        let g: Int
        let b: Int

        func near(_ hex: Int, tolerance: Int = 14) -> Bool {
            abs(r - ((hex >> 16) & 0xFF)) <= tolerance && abs(g - ((hex >> 8) & 0xFF)) <= tolerance && abs(b - (hex & 0xFF)) <= tolerance
        }

        var description: String { String(format: "#%02X%02X%02X", max(r, 0), max(g, 0), max(b, 0)) }
    }

    /// sRGB colours at points (app coordinates) of one screenshot.
    @MainActor private func colors(_ app: XCUIApplication, at points: [CGPoint]) -> [RGB] {
        guard let image = app.screenshot().image.cgImage, app.frame.width > 0,
              let space = CGColorSpace(name: CGColorSpace.sRGB) else { return [] }
        let scale = CGFloat(image.width) / app.frame.width
        return points.map { point in
            let x = min(max(Int(point.x * scale), 0), image.width - 1)
            let y = min(max(Int(point.y * scale), 0), image.height - 1)
            guard let crop = image.cropping(to: CGRect(x: x, y: y, width: 1, height: 1)) else { return RGB(r: -1, g: -1, b: -1) }
            var pixel = [UInt8](repeating: 0, count: 4)
            let drawn = pixel.withUnsafeMutableBytes { buffer -> Bool in
                guard let context = CGContext(data: buffer.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
                                              space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
                context.draw(crop, in: CGRect(x: 0, y: 0, width: 1, height: 1))
                return true
            }
            return drawn ? RGB(r: Int(pixel[0]), g: Int(pixel[1]), b: Int(pixel[2])) : RGB(r: -1, g: -1, b: -1)
        }
    }
}
