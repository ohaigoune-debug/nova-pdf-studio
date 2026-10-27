import SwiftUI
import UIKit

/// Bounded technical log for the foreground rendering investigation on a tester's
/// own device. It records lifecycle codes, timings, view sizes, a coarse page
/// category and error domains/codes only. It never records URLs, titles, page
/// text, form values, cookies, tokens, credentials, account identifiers or pixels.
/// Nothing is uploaded: the tester can view, clear or share the text manually.
@MainActor
final class ForegroundDiagnostics: ObservableObject {
    /// Debug and TestFlight (sandbox receipt) installations only. An App Store
    /// installation records nothing and shows no entry.
    static let isAvailable: Bool = {
        #if DEBUG
        return true
        #else
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }()

    @Published private(set) var lines: [String] = []
    private let maximumLines = 300
    private let fileURL: URL?
    private let started = Date()
    private var persistence: Task<Void, Never>?
    private let clock: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()

    init() {
        guard Self.isAvailable else {
            fileURL = nil
            return
        }
        fileURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("MadrasadzDiagnostics", isDirectory: true)
            .appendingPathComponent("foreground-v1.log")
        // Keep earlier runs: a tester may force-quit after seeing the defect.
        if let fileURL, let data = try? Data(contentsOf: fileURL), let text = String(data: data, encoding: .utf8) {
            lines = Array(text.split(separator: "\n").map(String.init).suffix(maximumLines))
        }
        record("launch", Self.environmentSummary)
    }

    static var environmentSummary: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        let simulator = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"].map { " simulator=\($0)" } ?? ""
        let device = UIDevice.current
        return "app=\(version)(\(build)) os=\(device.systemName)-\(device.systemVersion) model=\(modelIdentifier)\(simulator)"
            + " lowPower=\(ProcessInfo.processInfo.isLowPowerModeEnabled) thermal=\(ProcessInfo.processInfo.thermalState.rawValue)"
    }

    private static var modelIdentifier: String {
        var system = utsname()
        uname(&system)
        return withUnsafeBytes(of: &system.machine) { buffer in
            String(decoding: buffer.prefix(while: { $0 != 0 }), as: UTF8.self)
        }
    }

    private static var applicationStateCode: String {
        switch UIApplication.shared.applicationState {
        case .active: return "A"
        case .inactive: return "I"
        case .background: return "B"
        @unknown default: return "?"
        }
    }

    /// `detail` must contain only codes, counts, sizes and booleans.
    func record(_ event: String, _ detail: String = "") {
        guard Self.isAvailable else { return }
        let elapsed = String(format: "%.1f", Date().timeIntervalSince(started))
        let suffix = detail.isEmpty ? "" : " " + detail
        lines.append("\(clock.string(from: Date())) +\(elapsed)s [\(Self.applicationStateCode)] \(event)\(suffix)")
        if lines.count > maximumLines { lines.removeFirst(lines.count - maximumLines) }
        schedulePersistence()
    }

    var report: String {
        let header = [
            "Madrasadz foreground diagnostics v1",
            "Contains no URLs, page text, cookies, tokens, credentials, account data or pixels.",
            Self.environmentSummary
        ]
        return (header + lines).joined(separator: "\n")
    }

    func clear() {
        guard Self.isAvailable else { return }
        lines.removeAll()
        record("cleared")
        flush()
    }

    private func schedulePersistence() {
        guard persistence == nil else { return }
        persistence = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: 1_000_000_000) }
            catch { return }
            self?.flush()
        }
    }

    /// Written to Caches (excluded from backups); failures never affect learning.
    func flush() {
        persistence?.cancel()
        persistence = nil
        guard Self.isAvailable, let fileURL else { return }
        let text = lines.joined(separator: "\n")
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(),
                                                    withIntermediateDirectories: true)
            try Data(text.utf8).write(to: fileURL, options: [.atomic])
        } catch {}
    }
}

struct DiagnosticsView: View {
    @ObservedObject var diagnostics: ForegroundDiagnostics
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(L10n.text("diagnosticsBody"))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text(diagnostics.report)
                        .font(.system(.caption2, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .environment(\.layoutDirection, .leftToRight)
                        .accessibilityIdentifier("diagnosticsReport")
                }.padding()
            }
            .navigationTitle(L10n.text("diagnostics"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.text("ok")) { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: diagnostics.report) { Image(systemName: "square.and.arrow.up") }
                        .accessibilityLabel(L10n.text("diagnosticsShare"))
                }
                ToolbarItem(placement: .bottomBar) {
                    Button(L10n.text("diagnosticsClear"), role: .destructive) { diagnostics.clear() }
                }
            }
        }
    }
}
