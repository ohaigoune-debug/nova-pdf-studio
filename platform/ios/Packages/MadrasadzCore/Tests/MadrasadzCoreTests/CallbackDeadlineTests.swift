import Foundation
import XCTest
@testable import MadrasadzCore

final class CallbackDeadlineTests: XCTestCase {
    @MainActor func testMissingCallbackEndsWithTimeout() async {
        do {
            let _: Int = try await withCheckedThrowingContinuation { continuation in
                let pending = CallbackDeadline(continuation)
                pending.armTimeout(nanoseconds: 10_000_000)
            }
            XCTFail("A missing callback must not leave checking suspended forever")
        } catch {
            XCTAssertEqual((error as? URLError)?.code, .timedOut)
        }
    }

    @MainActor func testRepeatedCallbacksCannotResumeTwice() async throws {
        let value: Int = try await withCheckedThrowingContinuation { continuation in
            let pending = CallbackDeadline(continuation)
            pending.armTimeout(nanoseconds: 10_000_000)
            pending.finish(.success(7))
            pending.finish(.failure(URLError(.cancelled)))
        }
        XCTAssertEqual(value, 7)
    }

    @MainActor func testLateCallbackAfterTimeoutCannotAffectNextOperation() async throws {
        var old: CallbackDeadline<Int>?
        do {
            let _: Int = try await withCheckedThrowingContinuation { continuation in
                let pending = CallbackDeadline(continuation)
                old = pending
                pending.armTimeout(nanoseconds: 10_000_000)
            }
            XCTFail("Expected the first operation to time out")
        } catch {
            XCTAssertEqual((error as? URLError)?.code, .timedOut)
        }
        let current: Int = try await withCheckedThrowingContinuation { continuation in
            let pending = CallbackDeadline(continuation)
            pending.armTimeout(nanoseconds: 50_000_000)
            old?.finish(.success(99))
            pending.finish(.success(8))
        }
        XCTAssertEqual(current, 8)
    }
}
