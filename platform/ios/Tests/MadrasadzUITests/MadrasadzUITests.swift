import XCTest

/// These tests require an actual iOS Simulator. They test the signed-out native
/// shell only; authenticated WebKit/device scenarios remain a separate matrix.
final class MadrasadzUITests: XCTestCase {
    @MainActor func testSignedOutNativeNavigationAndAccountSheet() {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Learn"].waitForExistence(timeout: 10))
        app.tabBars.buttons["Bookmarks"].tap()
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 10))
        app.tabBars.buttons["Revision plan"].tap()
        XCTAssertTrue(app.buttons["Sign in"].exists)
        app.tabBars.buttons["Learn"].tap()
        app.buttons["accountButton"].tap()
        XCTAssertTrue(app.buttons["Profile and account deletion"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Privacy policy"].exists)
        XCTAssertTrue(app.buttons["Sign out"].exists)
    }
}
