import XCTest
@testable import MadrasadzCore

final class ForegroundRecoveryTests: XCTestCase {
    private func health(attached: Bool = true, hasDocument: Bool = true, terminated: Bool = false,
                        responsive: Bool = true, loading: Bool = false,
                        before: Bool? = true, now: Bool? = true) -> WebDocumentHealth {
        WebDocumentHealth(attached: attached, hasDocument: hasDocument, processTerminated: terminated,
                          scriptResponsive: responsive, loading: loading,
                          renderedBefore: before, renderedNow: now)
    }

    func testHealthyDocumentIsKeptWithoutReload() {
        var planner = ForegroundRecoveryPlanner()
        XCTAssertEqual(planner.next(for: health()), .keep)
        XCTAssertFalse(planner.reattachAttempted)
        XCTAssertFalse(planner.replaceAttempted)
    }

    func testLostPixelsReattachThenReplaceOnceThenStop() {
        var planner = ForegroundRecoveryPlanner()
        let blank = health(before: true, now: false)
        XCTAssertEqual(planner.next(for: blank), .reattach)
        XCTAssertEqual(planner.next(for: blank), .replace)
        // A replacement document has no earlier sample: uniform pixels are reported, not looped.
        XCTAssertEqual(planner.next(for: health(before: nil, now: false)), .keep)
    }

    func testReattachThatRestoresContentKeepsDocument() {
        var planner = ForegroundRecoveryPlanner()
        XCTAssertEqual(planner.next(for: health(before: true, now: false)), .reattach)
        XCTAssertEqual(planner.next(for: health(before: true, now: true)), .keep)
        XCTAssertFalse(planner.replaceAttempted)
    }

    func testLostDocumentSkipsReattachAndRetriesAfterOneReplacement() {
        for lost in [health(terminated: true), health(hasDocument: false), health(responsive: false)] {
            var planner = ForegroundRecoveryPlanner()
            XCTAssertEqual(planner.next(for: lost), .replace)
            XCTAssertEqual(planner.next(for: lost), .retry)
            XCTAssertEqual(planner.next(for: lost), .retry)
        }
    }

    func testLoadingDocumentIsLeftToNavigationDeadline() {
        var planner = ForegroundRecoveryPlanner()
        XCTAssertEqual(planner.next(for: health(loading: true, before: true, now: false)), .keep)
        XCTAssertFalse(planner.reattachAttempted)
    }

    func testDetachedViewIsReattachedThenReplacedThenRetried() {
        var planner = ForegroundRecoveryPlanner()
        let detached = health(attached: false, before: true, now: nil)
        XCTAssertEqual(planner.next(for: detached), .reattach)
        XCTAssertEqual(planner.next(for: detached), .replace)
        XCTAssertEqual(planner.next(for: health(attached: false, before: nil, now: nil)), .retry)
    }

    func testUnknownSamplesNeverTriggerPixelRecovery() {
        var planner = ForegroundRecoveryPlanner()
        XCTAssertEqual(planner.next(for: health(before: nil, now: false)), .keep)
        XCTAssertEqual(planner.next(for: health(before: true, now: nil)), .keep)
        XCTAssertEqual(planner.next(for: health(before: false, now: false)), .keep)
    }

    func testResetStartsANewBoundedLadderForTheNextReturn() {
        var planner = ForegroundRecoveryPlanner()
        XCTAssertEqual(planner.next(for: health(terminated: true)), .replace)
        planner.reset()
        XCTAssertEqual(planner.next(for: health(before: true, now: false)), .reattach)
    }

    func testUniformSamplesInLightOrDarkHaveNoVisibleVariation() {
        let black = [UInt8](repeating: 0, count: 32 * 64 * 4)
        let white = [UInt8](repeating: 255, count: 32 * 64 * 4)
        XCTAssertFalse(PixelSample.hasVisibleVariation(rgba: black))
        XCTAssertFalse(PixelSample.hasVisibleVariation(rgba: white))
    }

    func testRenderedContentHasVisibleVariation() {
        var page = [UInt8](repeating: 255, count: 32 * 64 * 4)
        // A small blue brand area on a white page.
        for pixel in 0..<40 { page[pixel * 4] = 49; page[pixel * 4 + 1] = 85; page[pixel * 4 + 2] = 245 }
        XCTAssertTrue(PixelSample.hasVisibleVariation(rgba: page))
    }

    func testCompressionNoiseBelowToleranceIsUniform() {
        var noisy = [UInt8](repeating: 20, count: 16 * 4)
        noisy[4] = 28
        noisy[9] = 14
        XCTAssertFalse(PixelSample.hasVisibleVariation(rgba: noisy, tolerance: 12))
        XCTAssertFalse(PixelSample.hasVisibleVariation(rgba: [1, 2, 3]))
    }
}
