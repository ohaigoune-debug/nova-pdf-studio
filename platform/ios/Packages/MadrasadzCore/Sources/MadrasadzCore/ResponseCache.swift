import Foundation

/// The last good answer of each read-only API path, per account, so the home,
/// courses, lessons and PLAY lists open without internet. Only what the server
/// already sent to this account is kept; sign-out removes it.
public actor ResponseCache {
    public struct Entry: Sendable {
        public let data: Data
        public let savedAt: Date
    }

    public static let maximumBytes = 4 * 1024 * 1024
    public static let maximumEntries = 400

    private let root: URL

    public init(root: URL) {
        self.root = root
    }

    private func directory(_ account: String) -> URL {
        root.appendingPathComponent(account.lowercased(), isDirectory: true)
    }

    /// A stable file name for a path (FNV-1a 64-bit, hex).
    static func fileName(for path: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in path.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100000001b3
        }
        return String(format: "%016llx", hash) + ".json"
    }

    public func store(_ data: Data, path: String, account: String) {
        guard data.count <= Self.maximumBytes, UUID(uuidString: account) != nil else { return }
        var dir = directory(account)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? dir.setResourceValues(values)
            try data.write(to: dir.appendingPathComponent(Self.fileName(for: path)), options: [.atomic, .completeFileProtection])
            trim(dir)
        } catch {}
    }

    public func load(path: String, account: String) -> Entry? {
        guard UUID(uuidString: account) != nil else { return nil }
        let url = directory(account).appendingPathComponent(Self.fileName(for: path))
        guard let data = try? Data(contentsOf: url) else { return nil }
        let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
        return Entry(data: data, savedAt: date)
    }

    public func purge(account: String) {
        try? FileManager.default.removeItem(at: directory(account))
    }

    public func purgeAll() {
        try? FileManager.default.removeItem(at: root)
    }

    private func trim(_ dir: URL) {
        guard let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey]),
              files.count > Self.maximumEntries else { return }
        let sorted = files.sorted {
            let a = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
            let b = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
            return a < b
        }
        for file in sorted.prefix(files.count - Self.maximumEntries) { try? FileManager.default.removeItem(at: file) }
    }
}
