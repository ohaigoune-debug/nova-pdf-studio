import UIKit
import XCTest

/// The fully native app (November 2026) against the Debug-only sample server
/// (`--madrasadz-fixture`): no network, no account, no web page. Screenshots are
/// attached so the owner can see each screen without a Mac.
final class MadrasadzUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor private func launch(signedIn: Bool, language: String = "ar", locale: String = "ar_DZ", extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale, "--madrasadz-fixture"]
        if signedIn { app.launchArguments.append("--madrasadz-fixture-signed-in") }
        app.launchArguments += extra
        app.launch()
        return app
    }

    /// Any element with this accessibility identifier (button, text or container).
    @MainActor private func find(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    /// Visible labels, put in the failure message (CI logs and screenshots are not always readable).
    @MainActor private func visible(_ app: XCUIApplication) -> String {
        let texts = app.staticTexts.allElementsBoundByIndex.prefix(20).map(\.label)
        let buttons = app.buttons.allElementsBoundByIndex.prefix(20).map { $0.identifier.isEmpty ? $0.label : $0.identifier }
        let fields = (app.textFields.allElementsBoundByIndex + app.secureTextFields.allElementsBoundByIndex)
            .map { "\($0.elementType.rawValue):\($0.identifier)=\(String(describing: $0.value ?? "nil")).count(\(String(describing: $0.value ?? "")).count)" }
        return "texts=\(texts) buttons=\(buttons) fields=\(fields)"
    }

    /// The notification permission belongs to the system: answer it if it is on screen.
    @MainActor private func answerSystemAlert(timeout: TimeInterval = 3) {
        let alert = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch
        guard alert.waitForExistence(timeout: timeout) else { return }
        let buttons = alert.buttons
        if buttons.count > 0 { buttons.element(boundBy: buttons.count - 1).tap() }
    }

    /// Lists draw only what is on screen: swipe up until the element exists.
    @MainActor private func scrollTo(_ app: XCUIApplication, _ element: XCUIElement, swipes: Int = 6) {
        var left = swipes
        while !element.exists && left > 0 {
            app.swipeUp()
            left -= 1
        }
    }

    @MainActor private func snapshot(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor private func signIn(_ app: XCUIApplication, password value: String) {
        let identifier = app.textFields["loginIdentifier"]
        XCTAssertTrue(identifier.waitForExistence(timeout: 15), visible(app))
        identifier.tap()
        identifier.typeText("0661234567")
        let password = app.secureTextFields["loginPassword"]
        XCTAssertTrue(password.waitForExistence(timeout: 5), visible(app))
        password.tap()
        password.typeText(value)
        let typedID = (identifier.value as? String) ?? ""
        XCTAssertTrue(typedID.contains("0661234567"), "identifier not typed: \(visible(app))")
        let typedPassword = (password.value as? String) ?? ""
        XCTAssertEqual(typedPassword.filter { $0 == "•" }.count, value.count, "password not typed: \(visible(app))")
        // Return on the password field submits the form, like a student would.
        password.typeText("\n")
    }

    @MainActor func testNativeSignIn() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: false)
        XCTAssertTrue(find(app, "loginIdentifier").waitForExistence(timeout: 15))
        XCTAssertEqual(app.webViews.count, 0, "The sign-in screen is native")
        snapshot(app, "01-sign-in")
        signIn(app, password: "secret")
        // Signed in: the tab bar of the native app appears.
        XCTAssertTrue(app.tabBars.buttons["العب"].waitForExistence(timeout: 20), visible(app))
        snapshot(app, "02-home")
        #endif
    }

    @MainActor func testWrongPasswordIsRefused() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: false)
        // The sample server refuses only the exact password "wrong".
        signIn(app, password: "wrong")
        XCTAssertTrue(find(app, "loginError").waitForExistence(timeout: 10), visible(app))
        XCTAssertFalse(app.tabBars.buttons["العب"].exists)
        snapshot(app, "01b-sign-in-refused")
        #endif
    }

    @MainActor func testNativeCourseAndLesson() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let door = find(app, "homeTile-courses")
        XCTAssertTrue(door.waitForExistence(timeout: 15), visible(app))
        snapshot(app, "03-home")
        door.tap()
        let course = find(app, "course-fixture-ar")
        XCTAssertTrue(course.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "03b-my-courses")
        course.tap()
        let lesson = find(app, "item-t1")
        XCTAssertTrue(lesson.waitForExistence(timeout: 10))
        snapshot(app, "04-course")
        lesson.tap()
        XCTAssertTrue(find(app, "lessonTitle").waitForExistence(timeout: 10))
        XCTAssertEqual(app.webViews.count, 0, "Lesson text is native")
        snapshot(app, "05-lesson-text")
        // Back by the navigation bar, then open the video lesson.
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let video = find(app, "item-v1")
        XCTAssertTrue(video.waitForExistence(timeout: 10))
        video.tap()
        XCTAssertTrue(find(app, "lessonPlayer").waitForExistence(timeout: 10))
        snapshot(app, "06-lesson-video")
        #endif
    }

    @MainActor func testNativePlayOffline() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let tab = app.tabBars.buttons["العب"]
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.tap()
        let subject = find(app, "subject-AR")
        XCTAssertTrue(subject.waitForExistence(timeout: 10))
        snapshot(app, "07-play-home")
        subject.tap()
        // Lessons (cards) open first; the BAC papers are the second tab.
        let bac = app.buttons["بكالوريا"]
        XCTAssertTrue(bac.waitForExistence(timeout: 10), visible(app))
        bac.tap()
        let set = find(app, "set-fixture-bac")
        XCTAssertTrue(set.waitForExistence(timeout: 10))
        snapshot(app, "08-play-sets")
        set.tap()
        // Step 1 (mcq): choose the right answer and check it.
        let option = find(app, "option-1")
        XCTAssertTrue(option.waitForExistence(timeout: 10))
        option.tap()
        find(app, "playCheck").tap()
        XCTAssertTrue(find(app, "playFeedback").waitForExistence(timeout: 5))
        snapshot(app, "09-play-feedback")
        // Skip the remaining steps, then finish.
        find(app, "playNext").tap()
        for _ in 0..<4 {
            let skip = find(app, "playSkip")
            XCTAssertTrue(skip.waitForExistence(timeout: 5))
            skip.tap()
        }
        XCTAssertTrue(find(app, "playScore").waitForExistence(timeout: 10))
        snapshot(app, "10-play-result")
        #endif
    }

    @MainActor func testSignupInsideTheApp() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: false)
        let open = find(app, "openSignup")
        XCTAssertTrue(open.waitForExistence(timeout: 15), visible(app))
        open.tap()
        // The website's form, native: no web page, no purchase, no invitation code.
        XCTAssertTrue(find(app, "signup-fullName").waitForExistence(timeout: 10), visible(app))
        XCTAssertTrue(find(app, "signup-guardianPhone").exists)
        XCTAssertEqual(app.webViews.count, 0)
        snapshot(app, "15-signup")
        let submit = find(app, "signupSubmit")
        if !submit.isHittable { app.swipeUp() }
        submit.tap()
        XCTAssertTrue(find(app, "signupError").waitForExistence(timeout: 5), visible(app))
        snapshot(app, "16-signup-check")
        #endif
    }

    @MainActor func testPhoneConfirmationInsideTheApp() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true, extra: ["--madrasadz-fixture-phone"])
        let action = find(app, "phoneAction")
        XCTAssertTrue(action.waitForExistence(timeout: 15), visible(app))
        action.tap()
        let send = find(app, "phone-send")
        XCTAssertTrue(send.waitForExistence(timeout: 10), visible(app))
        send.tap()
        let code = find(app, "phone-code")
        XCTAssertTrue(code.waitForExistence(timeout: 10), visible(app))
        code.tap()
        code.typeText("123456")
        snapshot(app, "17-phone-code")
        find(app, "phone-confirm").tap()
        XCTAssertTrue(find(app, "phoneDone").waitForExistence(timeout: 10), visible(app))
        snapshot(app, "18-phone-done")
        #endif
    }

    @MainActor func testBacBankIsFree() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let door = find(app, "homeTile-bac")
        XCTAssertTrue(door.waitForExistence(timeout: 15), visible(app))
        door.tap()
        let subject = find(app, "bacSubject-sub-ar")
        XCTAssertTrue(subject.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "19-bac-subjects")
        subject.tap()
        let paper = find(app, "bac-66666666-6666-4666-8666-666666666666")
        XCTAssertTrue(paper.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "19b-bac-years")
        paper.tap()
        XCTAssertTrue(find(app, "bacOpenPaper").waitForExistence(timeout: 10), visible(app))
        XCTAssertTrue(find(app, "bacOpenSolution").exists)
        XCTAssertTrue(find(app, "paperPlay").exists, "The interactive version opens from the paper")
        snapshot(app, "20-bac-paper")
        #endif
    }

    @MainActor func testTestsBankStepByStep() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let door = find(app, "homeTile-tests")
        XCTAssertTrue(door.waitForExistence(timeout: 15), visible(app))
        door.tap()
        let term = find(app, "testsTerm-1")
        XCTAssertTrue(term.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "21-tests-terms")
        term.tap()
        let level = find(app, "testsLevel-3AS")
        XCTAssertTrue(level.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "22-tests-years")
        level.tap()
        let subject = find(app, "testsSubject-sub-ar")
        XCTAssertTrue(subject.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "23-tests-subjects")
        subject.tap()
        XCTAssertTrue(find(app, "testsPlay-11111111-2222-4333-8444-555555555555").waitForExistence(timeout: 10), visible(app))
        let paper = find(app, "testsPaper-88888888-8888-4888-8888-888888888888")
        XCTAssertTrue(paper.exists)
        snapshot(app, "24-tests-list")
        paper.tap()
        XCTAssertTrue(find(app, "bacOpenPaper").waitForExistence(timeout: 10), visible(app))
        XCTAssertTrue(find(app, "paperPlay").exists)
        snapshot(app, "25-tests-paper")
        #endif
    }

    @MainActor func testSuggestedWeekInThePlanner() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let tab = app.tabBars.buttons["منظّمي"]
        XCTAssertTrue(tab.waitForExistence(timeout: 15), visible(app))
        tab.tap()
        let suggest = find(app, "suggestTimetable")
        XCTAssertTrue(suggest.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "26-planner")
        suggest.tap()
        let add = find(app, "timetableAdd")
        XCTAssertTrue(add.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "27-timetable")
        // No system permission prompt in the test: the reminders are switched off first.
        let remind = app.switches["timetableRemindToggle"]
        scrollTo(app, remind)
        XCTAssertTrue(remind.waitForExistence(timeout: 5), visible(app))
        remind.tap()
        add.tap()
        // If the reminders stayed on, iOS asks for permission once: answer it.
        answerSystemAlert(timeout: 5)
        XCTAssertTrue(add.waitForNonExistence(timeout: 10), "The week is added and the sheet closes")
        snapshot(app, "28-planner-week")
        #endif
    }

    @MainActor func testNativeCardGame() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let tab = app.tabBars.buttons["العب"]
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.tap()
        let subject = find(app, "subject-AR")
        XCTAssertTrue(subject.waitForExistence(timeout: 10))
        subject.tap()
        let lesson = find(app, "lesson-44444444-4444-4444-8444-444444444444")
        XCTAssertTrue(lesson.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "13-play-lessons")
        lesson.tap()
        // Three cards: easy (MCQ) first, then medium (fill-in), then hard (ordering).
        let back = find(app, "cardBack")
        XCTAssertTrue(back.waitForExistence(timeout: 10), visible(app))
        snapshot(app, "14-card-back")
        back.tap()
        let option = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "استعارة مكنية")).firstMatch
        XCTAssertTrue(option.waitForExistence(timeout: 5), visible(app))
        snapshot(app, "15-card-front")
        option.tap()
        find(app, "cardCheck").tap()
        XCTAssertTrue(find(app, "cardFeedback").waitForExistence(timeout: 5), visible(app))
        snapshot(app, "16-card-feedback")
        find(app, "cardNext").tap()
        for _ in 0..<2 {
            let next = find(app, "cardBack")
            XCTAssertTrue(next.waitForExistence(timeout: 5), visible(app))
            next.tap()
            let skip = find(app, "cardSkip")
            XCTAssertTrue(skip.waitForExistence(timeout: 5), visible(app))
            skip.tap()
        }
        let score = find(app, "cardsScore")
        XCTAssertTrue(score.waitForExistence(timeout: 10), visible(app))
        XCTAssertTrue(app.staticTexts["1 / 3"].exists, visible(app))
        snapshot(app, "17-card-result")
        #endif
    }

    @MainActor func testAccountAndDeletionScreen() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        answerSystemAlert(timeout: 1)
        let tab = app.tabBars.buttons.element(boundBy: 3)
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.tap()
        XCTAssertTrue(find(app, "accountSavedFiles").waitForExistence(timeout: 10), "Saved files live in My account")
        snapshot(app, "11-account")
        // Appearance: light and dark from inside the app, then back to automatic.
        let picker = find(app, "appearancePicker")
        XCTAssertTrue(picker.waitForExistence(timeout: 5), visible(app))
        app.buttons["نهاري"].tap()
        snapshot(app, "11b-account-light")
        app.buttons["ليلي"].tap()
        snapshot(app, "11c-account-dark")
        app.buttons["تلقائي"].tap()
        let delete = find(app, "deleteAccountButton")
        scrollTo(app, delete)
        XCTAssertTrue(delete.waitForExistence(timeout: 5), visible(app))
        delete.tap()
        let confirm = find(app, "deleteConfirm")
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        XCTAssertFalse(confirm.isEnabled, "Deletion needs the password and the confirmation")
        snapshot(app, "12-delete-account")
        #endif
    }

    @MainActor func testFrenchAndEnglishSignInScreens() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        for (language, locale) in [("fr", "fr_DZ"), ("en", "en_US")] {
            let app = launch(signedIn: false, language: language, locale: locale)
            XCTAssertTrue(find(app, "loginIdentifier").waitForExistence(timeout: 15))
            snapshot(app, "sign-in-\(language)")
            app.terminate()
        }
        #endif
    }
}
