import Foundation

/// Bridges a callback API with a bounded, one-shot continuation. Late or repeated
/// callbacks must not resume a timed-out operation or another account's request.
@MainActor
public final class CallbackDeadline<Value> {
    private var continuation: CheckedContinuation<Value, Error>?
    private var timeout: Task<Void, Never>?

    public init(_ continuation: CheckedContinuation<Value, Error>) {
        self.continuation = continuation
    }

    public func armTimeout(nanoseconds: UInt64) {
        guard continuation != nil, timeout == nil else { return }
        timeout = Task { @MainActor [self] in
            do { try await Task.sleep(nanoseconds: nanoseconds) }
            catch { return }
            finish(.failure(URLError(.timedOut)))
        }
    }

    public func finish(_ result: Result<Value, Error>) {
        guard let pending = continuation else { return }
        continuation = nil
        timeout?.cancel()
        timeout = nil
        pending.resume(with: result)
    }
}
