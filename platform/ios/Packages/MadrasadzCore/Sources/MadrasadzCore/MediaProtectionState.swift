/// Pure presentation policy for the native media shield. UIKit supplies the
/// scene capture, visibility and attachment facts; this model grants no content
/// access, controls no player, and cannot prevent an ordinary still screenshot.
public struct MediaProtectionState: Equatable, Sendable {
    public enum CaptureStatus: Equatable, Sendable {
        case unknown
        case inactive
        case active
    }

    public enum Visibility: Equatable, Sendable {
        case active
        case inactive
        case background
    }

    public enum Reason: Equatable, Sendable {
        case initializing
        case capture
        case inactive
    }

    public var capture: CaptureStatus
    public var visibility: Visibility
    public var isAttached: Bool

    /// Start covered until a view attached to a known, active scene has observed
    /// that the scene is not captured. Trait registration alone has no initial event.
    public init(capture: CaptureStatus = .unknown,
                visibility: Visibility = .inactive,
                isAttached: Bool = false) {
        self.capture = capture
        self.visibility = visibility
        self.isAttached = isAttached
    }

    public var mustCover: Bool {
        !isAttached || capture != .inactive || visibility != .active
    }

    /// Capture takes precedence even during a transition or detachment. Missing
    /// scene facts fail closed; only a fully known-safe active scene is uncovered.
    public var reason: Reason? {
        if capture == .active { return .capture }
        if !isAttached || capture == .unknown { return .initializing }
        if visibility != .active { return .inactive }
        return nil
    }
}
