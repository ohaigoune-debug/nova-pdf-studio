import SwiftUI
import MadrasadzCore

/// «القسم الافتراضي» (Build 16): the teacher's posts for the course group and the students' comments.
/// Without a group (Build 17) it is «القسم العام»: posts by teachers and the platform for every student.
/// Another student's comment can be reported (a ticket to the platform and a notice to the teacher) or
/// hidden on this phone, as Apple asks of apps that show what users write (1.2).
struct ClassroomView: View {
    @ObservedObject var model: AppModel
    let groupId: String?
    @StateObject private var loader = Loader<Classroom.Page>()
    @State private var drafts: [String: String] = [:]
    @State private var sending: String?
    @State private var reporting: Classroom.Comment?
    @State private var reportReason = ""
    @State private var hiding: Classroom.Comment?
    @State private var deleting: Classroom.Comment?
    @State private var error: String?
    @FocusState private var typingIn: String?
    @Environment(\.openURL) private var openURL

    private var path: String {
        guard let groupId, let encoded = groupId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return "/api/v1/ios/classroom" }
        return "/api/v1/ios/classroom?group=\(encoded)"
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                if loader.savedAt != nil { OfflineBanner(savedAt: loader.savedAt) }
                if let error {
                    Label(error, systemImage: "exclamationmark.circle.fill").font(.footnote.weight(.semibold)).foregroundStyle(Brand.danger)
                        .accessibilityIdentifier("classroomError")
                }
                if let page = loader.value {
                    if page.posts.isEmpty {
                        ContentUnavailableView(L10n.text("classroomEmpty"), systemImage: "bubble.left.and.text.bubble.right", description: Text(L10n.text(groupId == nil ? "generalClassroomEmptyHint" : "classroomEmptyHint")))
                            .accessibilityIdentifier("classroomEmpty")
                    }
                    ForEach(page.posts) { post in postCard(post) }
                    if model.hiddenClassmates > 0 {
                        Button(String(format: L10n.text("classroomShowHidden"), model.hiddenClassmates)) { model.showHiddenClassmates() }
                            .font(.footnote.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .accessibilityIdentifier("classroomShowHidden")
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 220)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text(groupId == nil ? "generalClassroom" : "classroom"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await loader.load(path, model: model, force: true) }
        .refreshable { await loader.load(path, model: model, force: true) }
        .alert(L10n.text("reportTitle"), isPresented: Binding(get: { reporting != nil }, set: { if !$0 { reporting = nil } })) {
            TextField(L10n.text("reportReason"), text: $reportReason)
            Button(L10n.text("report"), role: .destructive) {
                if let comment = reporting { Task { await report(comment) } }
            }
            Button(L10n.text("cancel"), role: .cancel) { reportReason = "" }
        } message: {
            Text(L10n.text("reportMessage"))
        }
        .confirmationDialog(L10n.text("hideClassmate"), isPresented: Binding(get: { hiding != nil }, set: { if !$0 { hiding = nil } }), titleVisibility: .visible) {
            Button(L10n.text("hideClassmate"), role: .destructive) {
                if let key = hiding?.authorKey { model.hideClassmate(key) }
                hiding = nil
            }
            Button(L10n.text("cancel"), role: .cancel) { hiding = nil }
        } message: {
            Text(String(format: L10n.text("hideClassmateMessage"), hiding?.authorName ?? ""))
        }
        .confirmationDialog(L10n.text("deleteComment"), isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button(L10n.text("deleteComment"), role: .destructive) {
                if let comment = deleting { Task { await remove(comment) } }
            }
            Button(L10n.text("cancel"), role: .cancel) { deleting = nil }
        }
    }

    // MARK: Post

    private func postCard(_ post: Classroom.Post) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "person.crop.circle.fill").font(.title2).foregroundStyle(Brand.blue)
                VStack(alignment: .leading, spacing: 1) {
                    Text(post.authorName).font(.subheadline.bold())
                    if let date = post.createdAt { Text(date.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary) }
                }
                Spacer(minLength: 6)
                if post.pinned {
                    Label(L10n.text("pinned"), systemImage: "pin.fill").font(.caption.weight(.bold)).foregroundStyle(.orange)
                }
            }
            Text(post.body).font(.body).textSelection(.enabled)
            if let link = post.link {
                Button { openURL(link) } label: { Label(link.host() ?? link.absoluteString, systemImage: "link") }
                    .font(.footnote.weight(.semibold))
            }
            if let file = post.file, let url = model.api.url(file.url) {
                Button { openURL(url) } label: { Label(file.name, systemImage: "doc.fill") }
                    .font(.footnote.weight(.semibold))
                    .accessibilityIdentifier("postFile")
            }
            let comments = post.visibleComments(hiding: model.hiddenClassmateKeys)
            if !comments.isEmpty {
                Divider()
                ForEach(comments) { comment in commentRow(comment) }
            }
            if post.allowComments {
                composer(post)
            } else {
                Label(L10n.text("commentsClosed"), systemImage: "lock.fill").font(.caption).foregroundStyle(.secondary)
            }
        }
        .card()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("post-\(post.id)")
    }

    private func commentRow(_ comment: Classroom.Comment) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: comment.teacher ? "checkmark.seal.fill" : "person.circle")
                .foregroundStyle(comment.teacher ? Brand.blue : .secondary)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(comment.mine ? L10n.text("you") : comment.authorName).font(.caption.bold())
                    if comment.teacher { Text(L10n.text("teacher")).font(.caption2.bold()).foregroundStyle(Brand.blue) }
                    if let date = comment.createdAt { Text(date.formatted(.relative(presentation: .named))).font(.caption2).foregroundStyle(.secondary) }
                }
                Text(comment.body).font(.subheadline).textSelection(.enabled)
            }
            Spacer(minLength: 0)
            if comment.mine || comment.reportable {
                Menu {
                    if comment.mine {
                        Button(role: .destructive) { deleting = comment } label: { Label(L10n.text("deleteComment"), systemImage: "trash") }
                    } else {
                        Button(role: .destructive) {
                            reportReason = ""
                            reporting = comment
                        } label: { Label(L10n.text("report"), systemImage: "exclamationmark.bubble") }
                        Button { hiding = comment } label: { Label(L10n.text("hideClassmate"), systemImage: "eye.slash") }
                    }
                } label: {
                    Image(systemName: "ellipsis").frame(width: 32, height: 32).contentShape(Rectangle())
                }
                .accessibilityLabel(L10n.text("commentActions"))
                .accessibilityIdentifier("commentMenu-\(comment.id)")
            }
        }
        .padding(.vertical, 2)
        // Its own container: the identifier stays on the row and the menu inside stays reachable
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(comment.mine ? "myComment" : "comment-\(comment.id)")
    }

    private func composer(_ post: Classroom.Post) -> some View {
        let text = Binding(get: { drafts[post.id] ?? "" }, set: { drafts[post.id] = $0 })
        let valid = Classroom.commentIsValid(text.wrappedValue)
        return HStack(alignment: .bottom, spacing: 8) {
            TextField(L10n.text("commentPlaceholder"), text: text, axis: .vertical)
                .lineLimit(1...4)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .focused($typingIn, equals: post.id)
                .accessibilityIdentifier("commentField-\(post.id)")
            Button {
                Task { await send(post) }
            } label: {
                Group {
                    if sending == post.id { ProgressView().tint(.white) } else { Image(systemName: "paperplane.fill").flipsForRightToLeftLayoutDirection(true) }
                }
                .frame(width: 38, height: 38)
                .background(valid ? Brand.blue : Color.gray.opacity(0.4), in: Circle())
                .foregroundStyle(.white)
            }
            .disabled(!valid || sending != nil)
            .accessibilityLabel(L10n.text("send"))
            .accessibilityIdentifier("commentSend-\(post.id)")
        }
    }

    // MARK: Actions

    private func send(_ post: Classroom.Post) async {
        guard let text = drafts[post.id], Classroom.commentIsValid(text), sending == nil else { return }
        sending = post.id
        defer { sending = nil }
        if let failure = await model.addClassComment(postId: post.id, body: text) {
            error = failure
        } else {
            drafts[post.id] = nil
            error = nil
            typingIn = nil
            await loader.load(path, model: model, force: true)
        }
    }

    private func report(_ comment: Classroom.Comment) async {
        let reason = reportReason
        reporting = nil
        reportReason = ""
        if let failure = await model.reportClassComment(id: comment.id, reason: reason) {
            error = failure
        } else {
            error = nil
            model.notice = L10n.text("reportSent")
        }
    }

    private func remove(_ comment: Classroom.Comment) async {
        deleting = nil
        if let failure = await model.deleteClassComment(id: comment.id) {
            error = failure
        } else {
            await loader.load(path, model: model, force: true)
        }
    }
}
