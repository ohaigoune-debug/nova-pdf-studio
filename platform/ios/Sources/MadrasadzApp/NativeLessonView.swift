import SwiftUI
import WebKit
import MadrasadzCore

private let lessonBlue = Brand.primary

/// Native lesson page (plan phase 3, Build 9). Text is rendered natively; a YouTube
/// lesson plays in a protected inline player (moving watermark, one-device heartbeat,
/// rotate to fill the screen). PDFs the teacher allows open in the in-app viewer;
/// other PDFs, private videos and links keep the protected web page.
struct NativeLessonView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    @ObservedObject private var downloads: OfflineLibrary
    let slug: String
    @Binding var showingAccount: Bool
    @EnvironmentObject private var capture: SceneCaptureState
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @State private var openDocument: OfflineDocument? = nil
    @State private var preparingDocument = false

    init(model: AppModel, native: NativeLearningModel, slug: String, showingAccount: Binding<Bool>) {
        self.model = model
        self.native = native
        downloads = model.downloads
        self.slug = slug
        _showingAccount = showingAccount
    }

    private var state: NativeLoad<NativeLesson> { native.lesson(slug) }
    private var loaded: NativeLesson? { native.accountKey == nil ? nil : state.value }
    private var isYouTube: Bool { if case .youtube? = loaded?.media { return true }; return false }
    /// iPhone in landscape with a video: the player fills the screen.
    private var playerFills: Bool { isYouTube && verticalSizeClass == .compact }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if native.accountKey == nil {
                        NativeLoadingView()
                    } else {
                        switch state {
                        case .idle, .loading: NativeLoadingView()
                        case .failed(let failure): failureView(failure)
                        case .loaded(let lesson): content(lesson, size: geo.size)
                        }
                    }
                }
                .padding(playerFills ? 0 : 16)
            }
            .scrollDisabled(playerFills)
        }
        .background(playerFills ? Color.black : Brand.background)
        .ignoresSafeArea(edges: playerFills ? .all : [])
        .refreshable { await native.loadLesson(slug) }
        .task(id: native.accountKey) { await native.loadLessonIfNeeded(slug) }
        .navigationTitle(playerFills ? "" : (loaded?.title ?? ""))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(playerFills ? .hidden : .visible, for: .navigationBar)
        // The shell's bottom bar steps aside while the player fills the display.
        .onAppear { model.fullScreenContent = playerFills }
        .onChange(of: playerFills) { _, fills in model.fullScreenContent = fills }
        .onDisappear { model.fullScreenContent = false }
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.personalSpaceReady, let lesson = loaded {
                    Button {
                        Task { await model.saveBookmark(title: lesson.title, path: "/ios/lesson/" + NativeLearningModel.encoded(lesson.slug)) }
                    } label: { Image(systemName: "bookmark") }
                        .accessibilityLabel(L10n.text("bookmark"))
                }
                MenuToolbarButton(showing: $showingAccount)
            }
        }
        .sheet(item: $openDocument) { document in
            NavigationStack {
                OfflinePDFViewer(library: downloads, document: document)
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button(L10n.text("ok")) { openDocument = nil } } }
            }
        }
    }

    @ViewBuilder private func failureView(_ failure: NativeFailure) -> some View {
        VStack(spacing: 14) {
            Image(systemName: failure == .offline || failure == .server ? "wifi.exclamationmark" : "lock.doc")
                .font(.system(size: 40)).foregroundStyle(.secondary)
            Text(L10n.text(failure == .offline || failure == .server ? "nativeLoadFailed" : "lessonUnavailable")).font(.headline)
            HStack(spacing: 12) {
                if failure == .offline || failure == .server {
                    Button(L10n.text("retry")) { Task { await native.loadLesson(slug) } }.buttonStyle(SiteButtonStyle(kind: .primary))
                }
                Button(L10n.text("lessonFullPage")) { native.openWebLesson(slug: slug) }.buttonStyle(SiteButtonStyle(kind: .outline))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    @ViewBuilder private func content(_ lesson: NativeLesson, size: CGSize) -> some View {
        if !playerFills { header(lesson) }
        // The player keeps its place in the view tree in both orientations, so
        // rotating does not reload the video.
        if case .youtube(let id, let contentID) = lesson.media {
            ProtectedYouTubePlayer(native: native, videoID: id, contentID: contentID, viewer: lesson.viewer,
                                   fills: playerFills, capture: capture.captured)
                .frame(width: playerFills ? size.width : nil,
                       height: playerFills ? size.height : max(180, (size.width - 32) * 9 / 16))
        }
        if !playerFills {
            mediaAction(lesson)
            if let body = lesson.bodyMarkdown { LessonBody(markdown: body) }
            Button { native.openWebLesson(slug: lesson.slug) } label: {
                Label(L10n.text("lessonFullPage"), systemImage: "safari")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SiteButtonStyle(kind: .outline, fullWidth: true))
            .accessibilityIdentifier("lessonWebPage")
            Text(L10n.text("lessonFullPageHint")).font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func header(_ lesson: NativeLesson) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(ContentKind.name(lesson.type), systemImage: ContentKind.symbol(lesson.type))
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10).padding(.vertical, 5)
                .foregroundStyle(lessonBlue)
                .background(lessonBlue.opacity(0.12), in: Capsule())
            Text(lesson.title).font(.title2.bold())
            if let summary = lesson.summary { Text(summary).font(.subheadline).foregroundStyle(.secondary) }
        }
    }

    @ViewBuilder private func mediaAction(_ lesson: NativeLesson) -> some View {
        switch lesson.media {
        case .none:
            EmptyView()
        case .youtube:
            Label(L10n.text("rotateHint"), systemImage: "rotate.right").font(.footnote).foregroundStyle(.secondary)
        case .pdf(let contentID, let allowDownload):
            if allowDownload, model.personalSpaceReady {
                Button { Task { await showPDF(contentID) } } label: {
                    Label(L10n.text("lessonShowPDF"), systemImage: "doc.richtext").frame(maxWidth: .infinity)
                }
                .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
                .disabled(preparingDocument)
                .accessibilityIdentifier("lessonPDF")
            } else {
                Button { native.openWebLesson(slug: lesson.slug) } label: {
                    Label(L10n.text("lessonOpenFile"), systemImage: "doc.richtext").frame(maxWidth: .infinity)
                }
                .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
                .accessibilityIdentifier("lessonPDF")
            }
        case .video:
            Button { native.openWebLesson(slug: lesson.slug) } label: {
                Label(L10n.text("lessonPlayVideo"), systemImage: "play.rectangle.fill").frame(maxWidth: .infinity)
            }
            .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
        case .external:
            Button { native.openWebLesson(slug: lesson.slug) } label: {
                Label(L10n.text("lessonOpenLink"), systemImage: "link").frame(maxWidth: .infinity)
            }
            .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
        }
    }

    /// The teacher allows saving: the server re-checks access, stamps the file and
    /// it opens in the in-app viewer (the same offline library as before).
    private func showPDF(_ contentID: UUID) async {
        if let document = downloads.documents.first(where: { $0.id == contentID }), downloads.isUsable(document) {
            openDocument = document
            return
        }
        preparingDocument = true
        defer { preparingDocument = false }
        await downloads.download(contentID: contentID, browser: model.browser, currentAccount: { model.verifiedAccountID })
        if let document = downloads.documents.first(where: { $0.id == contentID }) { openDocument = document }
    }
}

/// Lesson text: headings, bullets and paragraphs with inline Markdown. No HTML is
/// interpreted and links are not made tappable.
private struct LessonBody: View {
    let markdown: String

    private enum Block: Hashable { case heading(String), bullet(String), paragraph(String) }

    private var blocks: [Block] {
        var result: [Block] = []
        var paragraph: [String] = []
        func flush() {
            if !paragraph.isEmpty { result.append(.paragraph(paragraph.joined(separator: "\n"))); paragraph = [] }
        }
        for raw in markdown.prefix(60_000).components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { flush(); continue }
            if line.hasPrefix("#") {
                flush()
                result.append(.heading(line.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces)))
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("• ") {
                flush()
                result.append(.bullet(String(line.dropFirst(2))))
            } else {
                paragraph.append(line)
            }
        }
        flush()
        return result
    }

    private func inline(_ text: String) -> Text {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        if let attributed = try? AttributedString(markdown: text, options: options) { return Text(attributed) }
        return Text(text)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .heading(let text):
                    inline(text).font(.title3.bold()).padding(.top, 4)
                case .bullet(let text):
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(lessonBlue)
                        inline(text)
                    }
                case .paragraph(let text):
                    inline(text).lineSpacing(5)
                }
            }
        }
        .font(.body)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .siteCard()
        .textSelection(.disabled)
        // Links in a teacher's text are shown but not opened from here.
        .environment(\.openURL, OpenURLAction { _ in .discarded })
    }
}

/// YouTube in its own small web view (not the shared site view): privacy-enhanced
/// embed, inline only, no full screen or picture in picture, no navigation away.
/// A moving watermark with the student's name and account code sits above it, and
/// the web players' heartbeat applies the one-device limit.
private struct ProtectedYouTubePlayer: View {
    @ObservedObject var native: NativeLearningModel
    let videoID: String
    let contentID: UUID?
    let viewer: NativeLesson.Viewer?
    let fills: Bool
    let capture: Bool
    @Environment(\.scenePhase) private var scenePhase
    @State private var blocked: String? = nil
    @State private var markPosition = CGPoint(x: 0.08, y: 0.1)

    private var date: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Color.black
                // A recording/mirroring scene or a refused device removes the player.
                if blocked == nil, !capture {
                    #if DEBUG
                    if NativeDebug.fixture {
                        Text("YouTube").foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        YouTubeEmbed(videoID: videoID)
                    }
                    #else
                    YouTubeEmbed(videoID: videoID)
                    #endif
                }
                if let viewer {
                    VStack(alignment: .leading, spacing: 1) {
                        if let name = viewer.name { Text(name) }
                        Text("\(date) · \(viewer.code)")
                    }
                    .font(.system(size: fills ? 13 : 11, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 4))
                    .environment(\.layoutDirection, .leftToRight)
                    .offset(x: markPosition.x * geo.size.width, y: markPosition.y * geo.size.height)
                    .animation(.easeInOut(duration: 1.2), value: markPosition)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
                if let blocked {
                    VStack(spacing: 10) {
                        Image(systemName: "lock.shield.fill").font(.largeTitle).foregroundStyle(.yellow)
                        Text(L10n.text("deviceBlockedTitle")).font(.headline)
                        Text(blocked).font(.footnote).multilineTextAlignment(.center)
                        Button(L10n.text("retry")) { self.blocked = nil }.buttonStyle(SiteButtonStyle(kind: .primary))
                    }
                    .foregroundStyle(.white)
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.black.opacity(0.85))
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: fills ? 0 : 16, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("lessonPlayer")
        .task(id: blocked == nil && scenePhase == .active) {
            guard blocked == nil, scenePhase == .active else { return }
            await runHeartbeats()
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 7_000_000_000)
                markPosition = CGPoint(x: Double.random(in: 0.04...0.6), y: Double.random(in: 0.06...0.78))
            }
        }
    }

    /// Every 15 s while the lesson is on screen and the app is active.
    private func runHeartbeats() async {
        guard let contentID else { return }
        var last = Date()
        var elapsed = 0
        var first = true
        while !Task.isCancelled {
            let now = Date()
            let delta = first ? 0 : min(120, Int(now.timeIntervalSince(last).rounded()))
            first = false
            last = now
            elapsed += delta
            if case .blocked(let message)? = await native.heartbeat(contentID: contentID, position: elapsed, delta: delta) {
                blocked = message
                return
            }
            try? await Task.sleep(nanoseconds: 15_000_000_000)
        }
    }
}

/// The embed page is a fixed local document; only YouTube's player frames load.
private struct YouTubeEmbed: UIViewRepresentable {
    let videoID: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = false
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        load(into: view)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.stopLoading()
        view.loadHTMLString("", baseURL: nil)
    }

    private func load(into view: WKWebView) {
        guard NativeLesson.isYouTubeID(videoID) else { return }
        let source = "https://www.youtube-nocookie.com/embed/\(videoID)?rel=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&color=white&disablekb=1"
        let html = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
        </head><body><iframe src="\(source)" allow="accelerometer; encrypted-media; gyroscope" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
        """
        // The site origin as referrer: YouTube's embed requires one.
        view.loadHTMLString(html, baseURL: URL(string: "https://madrasadz.com/"))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            if action.targetFrame?.isMainFrame == true {
                // Only the local embed document; links in the player never leave it.
                let local = url.absoluteString == "about:blank" || (url.host == "madrasadz.com" && url.path == "/")
                return decisionHandler(local && action.navigationType != .linkActivated ? .allow : .cancel)
            }
            let host = url.host?.lowercased() ?? ""
            let allowed = url.scheme == "about" || (url.scheme == "https" && (host == "www.youtube-nocookie.com" || host.hasSuffix(".youtube.com") || host == "youtube.com" || host.hasSuffix(".google.com") || host.hasSuffix(".doubleclick.net") || host.hasSuffix(".ytimg.com")))
            decisionHandler(allowed ? .allow : .cancel)
        }

        // Pop-ups ("Watch on YouTube") are refused.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }
    }
}
