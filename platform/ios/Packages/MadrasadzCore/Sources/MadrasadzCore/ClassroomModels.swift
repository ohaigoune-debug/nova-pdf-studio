import Foundation

/// «القسم الافتراضي» (`/api/v1/ios/classroom?group=`): the teacher's posts for the course group and the
/// students' comments, with the website's permissions. Other students' comments carry an `authorKey`
/// (stable for this viewer only) so the student can hide them on this phone (Apple 1.2).
public enum Classroom {
    public struct Group: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
    }

    public struct File: Decodable, Equatable, Hashable, Sendable {
        public let name: String
        public let url: String
    }

    public struct Comment: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let body: String
        public let createdAt: Date?
        public let authorName: String
        public let teacher: Bool
        public let mine: Bool
        public let authorKey: String?

        private enum CodingKeys: String, CodingKey { case id, body, createdAt, authorName, teacher, mine, authorKey }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            body = try c.decode(String.self, forKey: .body)
            createdAt = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .createdAt))
            authorName = (try? c.decode(String.self, forKey: .authorName)) ?? "—"
            teacher = (try? c.decode(Bool.self, forKey: .teacher)) ?? false
            mine = (try? c.decode(Bool.self, forKey: .mine)) ?? false
            authorKey = try c.decodeIfPresent(String.self, forKey: .authorKey)
        }

        /// Report and hide apply to other students only (never to oneself or the teacher).
        public var reportable: Bool { !mine && !teacher }
    }

    public struct Post: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let body: String
        public let linkUrl: String?
        public let file: File?
        public let pinned: Bool
        public let allowComments: Bool
        public let createdAt: Date?
        public let groupName: String?
        public let authorName: String
        public let comments: [Comment]

        private enum CodingKeys: String, CodingKey { case id, body, linkUrl, file, pinned, allowComments, createdAt, groupName, authorName, comments }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            body = try c.decode(String.self, forKey: .body)
            linkUrl = try c.decodeIfPresent(String.self, forKey: .linkUrl)
            file = try? c.decodeIfPresent(File.self, forKey: .file)
            pinned = (try? c.decode(Bool.self, forKey: .pinned)) ?? false
            allowComments = (try? c.decode(Bool.self, forKey: .allowComments)) ?? false
            createdAt = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .createdAt))
            groupName = try c.decodeIfPresent(String.self, forKey: .groupName)
            authorName = (try? c.decode(String.self, forKey: .authorName)) ?? "—"
            comments = c.lossyArray(Comment.self, forKey: .comments)
        }

        /// Comments without those of students hidden on this phone.
        public func visibleComments(hiding blocked: Set<String>) -> [Comment] {
            comments.filter { comment in comment.authorKey.map { !blocked.contains($0) } ?? true }
        }

        /// A web link the app may open (https only).
        public var link: URL? {
            guard let linkUrl, let url = URL(string: linkUrl), url.scheme == "https" else { return nil }
            return url
        }
    }

    public struct Page: Decodable, Equatable, Sendable {
        public let groups: [Group]
        public let posts: [Post]

        private enum CodingKeys: String, CodingKey { case groups, posts }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            groups = c.lossyArray(Group.self, forKey: .groups)
            posts = c.lossyArray(Post.self, forKey: .posts)
        }
    }

    public static func commentIsValid(_ text: String) -> Bool {
        let n = text.trimmingCharacters(in: .whitespacesAndNewlines).count
        return n >= 1 && n <= 1500
    }
}
