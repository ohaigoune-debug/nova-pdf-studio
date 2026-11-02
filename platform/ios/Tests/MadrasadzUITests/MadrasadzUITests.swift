import UIKit
import XCTest

/// The fully native app (November 2026) against the Debug-only sample server
/// (`--madrasadz-fixture`): no network, no account, no web page. Screenshots are
/// attached so the owner can see each screen without a Mac.
final class MadrasadzUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor private func launch(signedIn: Bool, language: String = "ar", locale: String = "ar_DZ") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale, "--madrasadz-fixture"]
        if signedIn { app.launchArguments.append("--madrasadz-fixture-signed-in") }
        app.launch()
        return app
    }

    /// Any element with this accessibility identifier (button, text or container).
    @MainActor private func find(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    @MainActor private func snapshot(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor func testNativeSignIn() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: false)
        let identifier = find(app, "loginIdentifier")
        XCTAssertTrue(identifier.waitForExistence(timeout: 15))
        XCTAssertEqual(app.webViews.count, 0, "The sign-in screen is native")
        snapshot(app, "01-sign-in")
        identifier.tap()
        identifier.typeText("0661234567")
        let password = find(app, "loginPassword")
        password.tap()
        password.typeText("wrong")
        find(app, "loginSubmit").tap()
        XCTAssertTrue(find(app, "loginError").waitForExistence(timeout: 10))
        // The sample server refuses only the exact password "wrong".
        password.tap()
        password.typeText("secret")
        find(app, "loginSubmit").tap()
        XCTAssertTrue(find(app, "homeGreeting").waitForExistence(timeout: 15))
        snapshot(app, "02-home")
        #endif
    }

    @MainActor func testNativeCourseAndLesson() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let course = find(app, "course-fixture-ar")
        XCTAssertTrue(course.waitForExistence(timeout: 15))
        snapshot(app, "03-home-courses")
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
        let tab = app.tabBars.buttons["PLAY"]
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.tap()
        let subject = find(app, "subject-AR")
        XCTAssertTrue(subject.waitForExistence(timeout: 10))
        snapshot(app, "07-play-home")
        subject.tap()
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

    @MainActor func testAccountAndDeletionScreen() throws {
        #if !DEBUG
        throw XCTSkip("Fixtures exist in Debug only.")
        #else
        let app = launch(signedIn: true)
        let tab = app.tabBars.buttons.element(boundBy: 4)
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.tap()
        let delete = find(app, "deleteAccountButton")
        XCTAssertTrue(delete.waitForExistence(timeout: 10))
        snapshot(app, "11-account")
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
