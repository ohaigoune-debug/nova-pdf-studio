import SwiftUI
import MadrasadzCore

// MARK: - Home: a greeting and four large doors (Build 14)

/// The owner's layout: no long lists on Home. Four large tiles open My courses, the past
/// BAC papers, the tests bank and the free lessons; one line shows what is next in the planner.
struct HomeView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<NativeHome>()
    @State private var confirmingPhone = false

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                greeting
                if loader.value != nil, loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                if model.phoneVerificationRequired { phoneStrip }
                LazyVGrid(columns: columns, spacing: 12) {
                    NavigationLink { MyCoursesView(model: model) } label: {
                        HomeTile(title: L10n.text("myCourses"), detail: coursesDetail, icon: "graduationcap.fill", colors: [Brand.navy, Color(red: 0.16, green: 0.25, blue: 0.52)])
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeTile-courses")
                    NavigationLink { BacBankView(model: model) } label: {
                        HomeTile(title: L10n.text("bacBankShort"), detail: L10n.text("bacTileHint"), icon: "scroll.fill", colors: [Brand.blue, Color(red: 0.20, green: 0.48, blue: 0.90)])
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeTile-bac")
                    NavigationLink { TestsBankView(model: model) } label: {
                        HomeTile(title: L10n.text("testsBank"), detail: L10n.text("testsTileHint"), icon: "doc.on.clipboard.fill", colors: [Color(red: 0.0, green: 0.45, blue: 0.47), Color(red: 0.05, green: 0.60, blue: 0.58)])
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeTile-tests")
                    NavigationLink { FreeLessonsView(model: model) } label: {
                        HomeTile(title: L10n.text("freeLessons"), detail: L10n.text("lessonsTileHint"), icon: "book.fill", colors: [Brand.success, Color(red: 0.18, green: 0.62, blue: 0.36)])
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeTile-lessons")
                }
                NextTaskCard(model: model)
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("appName"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load("/api/v1/ios/home", model: model, force: true) }
        .task { await loader.load("/api/v1/ios/home", model: model) }
        .sheet(isPresented: $confirmingPhone, onDismiss: { Task { await loader.load("/api/v1/ios/home", model: model, force: true) } }) {
            NavigationStack { PhoneVerifyView(model: model) }
        }
        // A new account: the phone confirmation opens by itself once the server asks for it.
        .onChange(of: model.phoneVerificationRequired) { _, required in
            if required, model.takePhonePrompt() { confirmingPhone = true }
        }
    }

    private var coursesDetail: String {
        guard let courses = loader.value?.courses else { return L10n.text("coursesTileHint") }
        let active = courses.filter { $0.status == .active }.count
        return active > 0 ? String(format: L10n.text("coursesActiveCount"), active) : L10n.text("coursesTileHint")
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(String(format: L10n.text("greeting"), Self.partOfDay(), model.displayName?.split(separator: " ").first.map(String.init) ?? L10n.text("student")))
                .font(.title2.bold())
            Text(Date.now, format: .dateTime.weekday(.wide).day().month(.wide))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("homeGreeting")
    }

    static func partOfDay(_ date: Date = .now, calendar: Calendar = .current) -> String {
        let hour = calendar.component(.hour, from: date)
        return L10n.text(hour >= 5 && hour < 12 ? "goodMorning" : "goodEvening")
    }

    private var phoneStrip: some View {
        Button { confirmingPhone = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "phone.badge.checkmark").font(.title3).foregroundStyle(Brand.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L10n.text("phoneTitle")).font(.subheadline.bold()).foregroundStyle(.primary)
                    Text(L10n.text("phoneBody")).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
            }
            .padding(14)
            .background(Brand.sky.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("phoneAction")
    }
}

/// One large door of Home: a coloured square with its icon, title and one short line.
struct HomeTile: View {
    let title: String
    let detail: String
    let icon: String
    let colors: [Color]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.title2.weight(.semibold))
                .foregroundStyle(colors.first ?? Brand.blue)
                .frame(width: 50, height: 50)
                .background(.white, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            Spacer(minLength: 0)
            Text(title)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 168, alignment: .topLeading)
        .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: (colors.first ?? .black).opacity(0.18), radius: 8, y: 4)
        .accessibilityElement(children: .combine)
    }
}

/// «Next in my planner»: one line from the personal plan, opening the planner tab.
struct NextTaskCard: View {
    @ObservedObject var model: AppModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            if model.personalSpaceReady, let next = RevisionAgenda.next(model.snapshot.tasks, now: context.date) {
                Button { model.selectedTab = .planner } label: {
                    HStack(spacing: 12) {
                        SubjectBadge(subject: next.subject, activity: next.activity, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L10n.text("nextInPlanner")).font(.caption.weight(.semibold)).foregroundStyle(Brand.blue)
                            Text(next.title).font(.subheadline.bold()).foregroundStyle(.primary).lineLimit(1)
                            Text(next.date, format: .dateTime.weekday(.wide).hour().minute()).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                    }
                    .card()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeNextTask")
            } else if model.personalSpaceReady {
                Button { model.selectedTab = .planner } label: {
                    Label(L10n.text("plannerInvite"), systemImage: "calendar.badge.plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homePlannerInvite")
            }
        }
    }
}

// MARK: - My courses (only what the student already has)

struct MyCoursesView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<NativeHome>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let home = loader.value {
                    if loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                    if home.courses.isEmpty {
                        ContentUnavailableView(L10n.text("noCourses"), systemImage: "graduationcap")
                            .padding(.top, 40)
                            .accessibilityIdentifier("noCourses")
                    } else {
                        ForEach(home.courses) { course in
                            NavigationLink { CourseView(model: model, slug: course.slug, title: course.title) } label: { CourseRow(course: course) }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("course-\(course.slug)")
                        }
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load("/api/v1/ios/home", model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 240)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("myCourses"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load("/api/v1/ios/home", model: model, force: true) }
        .task { await loader.load("/api/v1/ios/home", model: model) }
    }
}

// MARK: - Free lessons

struct FreeLessonsView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<NativeHome>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let home = loader.value {
                    if loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                    if home.freeLessons.isEmpty {
                        ContentUnavailableView(L10n.text("noFreeLessons"), systemImage: "book")
                            .padding(.top, 40)
                    }
                    ForEach(home.freeLessons) { entry in
                        switch entry {
                        case .single(let link):
                            NavigationLink { LessonView(model: model, slug: link.slug) } label: { FreeLessonRow(title: link.label, detail: link.summary, type: link.type) }
                                .buttonStyle(.plain)
                        case .group(let heading, let detail, let items):
                            VStack(alignment: .leading, spacing: 10) {
                                Text(heading).font(.headline)
                                if let detail { Text(detail).font(.footnote).foregroundStyle(.secondary) }
                                ForEach(items) { link in
                                    NavigationLink { LessonView(model: model, slug: link.slug) } label: {
                                        HStack {
                                            Image(systemName: icon(for: link.type)).foregroundStyle(Brand.blue)
                                            Text(link.label).foregroundStyle(.primary)
                                            Spacer()
                                            Image(systemName: "chevron.forward").font(.footnote).foregroundStyle(.tertiary)
                                        }
                                        .padding(.vertical, 6)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .card()
                        }
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load("/api/v1/ios/home", model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 240)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("freeLessons"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load("/api/v1/ios/home", model: model, force: true) }
        .task { await loader.load("/api/v1/ios/home", model: model) }
    }
}
