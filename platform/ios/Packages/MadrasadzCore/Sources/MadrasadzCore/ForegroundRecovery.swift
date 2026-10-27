import Foundation

/// Coarse observations about the hosted web document after the scene returns to
/// the foreground. It intentionally contains no URL, title, page text, cookie,
/// account identifier or pixel data.
public struct WebDocumentHealth: Equatable, Sendable {
    /// The web view is in a window, not hidden and has a non-empty size.
    public var attached: Bool
    /// WebKit still reports a document URL.
    public var hasDocument: Bool
    /// WebKit reported that the content process of this view terminated.
    public var processTerminated: Bool
    /// A read-only isolated-world script returned before its deadline.
    public var scriptResponsive: Bool
    /// WebKit reports an in-flight main-frame load (bounded by the navigation deadline).
    public var loading: Bool
    /// Sample of this same view taken before it resigned active: true when it
    /// showed visible variation. Nil when it was not measured or measurement failed.
    public var renderedBefore: Bool?
    /// Current sample of this view. Nil when measurement is unavailable.
    public var renderedNow: Bool?

    public init(attached: Bool, hasDocument: Bool, processTerminated: Bool, scriptResponsive: Bool,
                loading: Bool, renderedBefore: Bool?, renderedNow: Bool?) {
        self.attached = attached
        self.hasDocument = hasDocument
        self.processTerminated = processTerminated
        self.scriptResponsive = scriptResponsive
        self.loading = loading
        self.renderedBefore = renderedBefore
        self.renderedNow = renderedNow
    }

    /// The renderer cannot show this document any more; only a new view/load helps.
    public var documentLost: Bool { processTerminated || !hasDocument || !scriptResponsive }

    /// The same document showed content before background and is now uniform.
    public var lostVisibleContent: Bool { renderedBefore == true && renderedNow == false }
}

public enum ForegroundRecoveryAction: String, Equatable, Sendable {
    /// Leave the rendered document, its scroll/video/form state and history alone.
    case keep
    /// Remove and re-add the same web view so WebKit observes a fresh window
    /// attachment in the current foreground scene. Non-destructive.
    case reattach
    /// Use a new web view with the same persistent data store and GET the current
    /// allowed page once it is attached to the window.
    case replace
    /// Stop automatic recovery and expose the existing Retry state.
    case retry
}

/// Bounded recovery ladder for one foreground return. Each destructive step runs
/// at most once per return, so a defect cannot become a reload loop.
public struct ForegroundRecoveryPlanner: Equatable, Sendable {
    public private(set) var reattachAttempted = false
    public private(set) var replaceAttempted = false

    public init() {}

    public mutating func reset() {
        reattachAttempted = false
        replaceAttempted = false
    }

    public mutating func next(for health: WebDocumentHealth) -> ForegroundRecoveryAction {
        if health.documentLost {
            guard !replaceAttempted else { return .retry }
            replaceAttempted = true
            return .replace
        }
        // An in-flight load is already bounded by the navigation deadline.
        if health.loading { return .keep }
        guard !health.attached || health.lostVisibleContent else { return .keep }
        if !replaceAttempted && !reattachAttempted {
            reattachAttempted = true
            return .reattach
        }
        if !replaceAttempted {
            replaceAttempted = true
            return .replace
        }
        // After one replacement, a still-detached view means hosting failed.
        // Uniform pixels of a new document are only reported, never retried:
        // there is no earlier sample of that document to compare with.
        return health.attached ? .keep : .retry
    }
}

public enum PixelSample {
    /// True when an RGBA buffer contains visible variation, i.e. some colour channel
    /// spans more than `tolerance`. A fully hidden or unpainted web view samples as
    /// a single colour (black in dark mode, white in light mode).
    public static func hasVisibleVariation(rgba: [UInt8], tolerance: UInt8 = 12) -> Bool {
        guard rgba.count >= 8, rgba.count % 4 == 0 else { return false }
        var minimum: [UInt8] = [255, 255, 255]
        var maximum: [UInt8] = [0, 0, 0]
        var index = 0
        while index < rgba.count {
            for channel in 0..<3 {
                let value = rgba[index + channel]
                if value < minimum[channel] { minimum[channel] = value }
                if value > maximum[channel] { maximum[channel] = value }
            }
            index += 4
        }
        for channel in 0..<3 where maximum[channel] - minimum[channel] > tolerance { return true }
        return false
    }
}
