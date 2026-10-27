import XCTest
@testable import MadrasadzCore

final class MediaProtectionStateTests: XCTestCase {
    func testDefaultStateStartsCoveredBeforeAnySceneFactsArrive() {
        let state = MediaProtectionState()
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .initializing)
    }

    func testEveryCaptureVisibilityAndAttachmentCombination() {
        typealias Case = (capture: MediaProtectionState.CaptureStatus,
                          visibility: MediaProtectionState.Visibility,
                          attached: Bool,
                          covered: Bool,
                          reason: MediaProtectionState.Reason?)
        let cases: [Case] = [
            (.unknown, .active, false, true, .initializing),
            (.unknown, .inactive, false, true, .initializing),
            (.unknown, .background, false, true, .initializing),
            (.unknown, .active, true, true, .initializing),
            (.unknown, .inactive, true, true, .initializing),
            (.unknown, .background, true, true, .initializing),
            (.inactive, .active, false, true, .initializing),
            (.inactive, .inactive, false, true, .initializing),
            (.inactive, .background, false, true, .initializing),
            (.inactive, .active, true, false, nil),
            (.inactive, .inactive, true, true, .inactive),
            (.inactive, .background, true, true, .inactive),
            (.active, .active, false, true, .capture),
            (.active, .inactive, false, true, .capture),
            (.active, .background, false, true, .capture),
            (.active, .active, true, true, .capture),
            (.active, .inactive, true, true, .capture),
            (.active, .background, true, true, .capture),
        ]
        XCTAssertEqual(cases.count, 18)
        for scenario in cases {
            let state = MediaProtectionState(capture: scenario.capture,
                                             visibility: scenario.visibility,
                                             isAttached: scenario.attached)
            let context = "capture=\(scenario.capture), visibility=\(scenario.visibility), attached=\(scenario.attached)"
            XCTAssertEqual(state.mustCover, scenario.covered, context)
            XCTAssertEqual(state.reason, scenario.reason, context)
        }
    }

    func testRecordingStartsAndStopsInForegroundWithoutChangingVisibility() {
        var state = MediaProtectionState(capture: .inactive, visibility: .active, isAttached: true)
        XCTAssertFalse(state.mustCover)

        state.capture = .active
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .capture)

        state.capture = .inactive
        XCTAssertFalse(state.mustCover)
        XCTAssertNil(state.reason)
        // No playback/autoplay state exists here: uncovering is not a play command.
    }

    func testStoppingRecordingWhileInactiveDoesNotRevealTheLesson() {
        var state = MediaProtectionState(capture: .active, visibility: .inactive, isAttached: true)
        XCTAssertEqual(state.reason, .capture)

        state.capture = .inactive
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .inactive)

        state.visibility = .background
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .inactive)

        state.visibility = .active
        XCTAssertFalse(state.mustCover)
        XCTAssertNil(state.reason)
    }

    func testDetachingOrLosingCaptureFactsKeepsARecoveredViewCovered() {
        var state = MediaProtectionState(capture: .inactive, visibility: .active, isAttached: true)
        XCTAssertFalse(state.mustCover)

        state.isAttached = false
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .initializing)

        state.capture = .unknown
        state.isAttached = true
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .initializing)

        state.capture = .active
        XCTAssertTrue(state.mustCover)
        XCTAssertEqual(state.reason, .capture)

        state.capture = .inactive
        XCTAssertFalse(state.mustCover)
        XCTAssertNil(state.reason)
    }
}
