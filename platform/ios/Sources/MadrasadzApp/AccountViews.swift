import SwiftUI
import UIKit
import MadrasadzCore

/// Screens under «حسابي» (Build 15): «طلباتي» for tracking only (no price, payment or
/// re-order anywhere), and «الدعم والشكاوى» with the platform team.
enum AccountRoute: Hashable {
    case orders
    case support
    case ticket(String)
}

private func kindTitle(_ kind: Support.Kind) -> String { L10n.text("kind." + kind.rawValue) }

private func statusTitle(_ status: Support.Status) -> String { L10n.text("ticket." + status.rawValue) }

private func statusTint(_ status: Support.Status) -> Color {
    switch status {
    case .waitingUser: return .orange
    case .resolved: return Brand.success
    case .closed: return .secondary
    case .open, .inProgress: return Brand.blue
    }
}

private struct Pill: View {
    let text: String
    let tint: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(tint.opacity(0.14), in: Capsule())
    }
}

// MARK: - «طلباتي»

struct OrdersView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<Orders.Page>()
    private let path = "/api/v1/ios/orders"

    var body: some View {
        List {
            if let savedAt = loader.savedAt {
                OfflineBanner(savedAt: savedAt).listRowBackground(Color.clear).listRowInsets(EdgeInsets())
            }
            if let page = loader.value {
                if page.orders.isEmpty {
                    ContentUnavailableView(L10n.text("ordersEmpty"), systemImage: "shippingbox")
                        .listRowBackground(Color.clear)
                        .accessibilityIdentifier("ordersEmpty")
                } else {
                    if !page.current.isEmpty {
                        Section(L10n.text("ordersCurrent")) {
                            ForEach(page.current) { order in orderLink(order) }
                        }
                    }
                    if !page.past.isEmpty {
                        Section(L10n.text("ordersPast")) {
                            ForEach(page.past) { order in orderLink(order) }
                        }
                    }
                }
            } else if let failure = loader.failure {
                FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                    .listRowBackground(Color.clear)
            } else {
                LoadingView().frame(minHeight: 200).listRowBackground(Color.clear)
            }
        }
        .navigationTitle(L10n.text("myOrders"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await loader.load(path, model: model) }
        .refreshable { await loader.load(path, model: model, force: true) }
    }

    private func orderLink(_ order: Orders.Order) -> some View {
        NavigationLink { OrderDetailView(model: model, order: order) } label: { OrderCard(order: order) }
            .accessibilityIdentifier("orderCard-\(order.number)")
    }
}

/// The stages a student follows: four for a parcel, three for a digital order.
private struct StageBar: View {
    let order: Orders.Order

    private var stages: [Orders.Stage] { order.shipped ? Orders.Stage.allCases : [.received, .confirmed, .arrived] }

    private func title(_ stage: Orders.Stage) -> String {
        switch stage {
        case .received: return L10n.text("stageReceived")
        case .confirmed: return L10n.text("stageConfirmed")
        case .onTheWay: return L10n.text("stageOnTheWay")
        case .arrived: return L10n.text(order.shipped ? "stageArrived" : "stageDone")
        }
    }

    var body: some View {
        let reached = order.stage?.rawValue ?? -1
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(stages.enumerated()), id: \.element) { index, stage in
                VStack(spacing: 6) {
                    ZStack {
                        Circle().fill(stage.rawValue <= reached ? Brand.success : Color(.tertiarySystemFill)).frame(width: 22, height: 22)
                        if stage.rawValue <= reached {
                            Image(systemName: "checkmark").font(.caption2.bold()).foregroundStyle(.white)
                        }
                    }
                    Text(title(stage)).font(.caption2.weight(stage.rawValue == reached ? .bold : .regular))
                        .foregroundStyle(stage.rawValue <= reached ? .primary : .secondary)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
                if index < stages.count - 1 {
                    Rectangle().fill(stages[index + 1].rawValue <= reached ? Brand.success : Color(.tertiarySystemFill))
                        .frame(height: 3).frame(maxWidth: 28).padding(.top, 10)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(order.statusText)
    }
}

private struct OrderCard: View {
    let order: Orders.Order

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(String(format: L10n.text("orderNumber"), order.number)).font(.headline)
                Spacer(minLength: 8)
                Pill(text: order.statusText, tint: order.stopped ? Brand.danger : order.status == "DELIVERED" ? Brand.success : Brand.blue)
            }
            Text(order.items).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            if !order.stopped { StageBar(order: order) }
            if let date = order.createdAt {
                Text(date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

struct OrderDetailView: View {
    @ObservedObject var model: AppModel
    let order: Orders.Order
    @State private var writing = false
    @State private var copied = false

    var body: some View {
        List {
            Section { OrderCard(order: order) }
            if order.trackingId != nil || order.deliveryProvider != nil {
                Section {
                    if let provider = order.deliveryProvider { LabeledContent(L10n.text("deliveryCompany"), value: provider) }
                    if let tracking = order.trackingId {
                        Button {
                            UIPasteboard.general.string = tracking
                            copied = true
                        } label: {
                            LabeledContent(L10n.text("trackingNumber")) {
                                HStack(spacing: 6) {
                                    Text(tracking).font(.body.monospaced()).environment(\.layoutDirection, .leftToRight)
                                    Image(systemName: copied ? "checkmark" : "doc.on.doc").foregroundStyle(Brand.blue)
                                }
                            }
                        }
                        .accessibilityIdentifier("orderTracking")
                    }
                }
            }
            if !order.timeline.isEmpty {
                Section(L10n.text("orderHistory")) {
                    ForEach(Array(order.timeline.enumerated()), id: \.offset) { _, step in
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: step.tone == .bad ? "exclamationmark.circle.fill" : step.tone == .done ? "checkmark.circle.fill" : "info.circle.fill")
                                .foregroundStyle(step.tone == .bad ? Brand.danger : step.tone == .done ? Brand.success : Brand.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.label).font(.subheadline)
                                if let at = step.at { Text(at.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary) }
                            }
                        }
                    }
                }
            }
            Section {
                Button { writing = true } label: { Label(L10n.text("orderProblem"), systemImage: "bubble.left.and.exclamationmark.bubble.right") }
                    .accessibilityIdentifier("orderProblem")
            }
        }
        .navigationTitle(String(format: L10n.text("orderNumber"), order.number))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $writing) {
            NewTicketView(model: model, draft: Support.NewTicket(kind: .delivery, subject: String(format: L10n.text("orderNumber"), order.number), orderId: order.id)) { id in
                model.accountPath = [.support, .ticket(id)]
            }
        }
    }
}

// MARK: - «الدعم والشكاوى»

struct SupportListView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<Support.List>()
    @State private var writing = false
    private let path = "/api/v1/ios/support"

    var body: some View {
        List {
            Section {
                Button { writing = true } label: {
                    Label(L10n.text("newTicket"), systemImage: "square.and.pencil").font(.headline)
                }
                .accessibilityIdentifier("supportNew")
            } footer: {
                Text(L10n.text("supportHint"))
            }
            if let list = loader.value {
                if list.tickets.isEmpty {
                    Section { Text(L10n.text("supportEmpty")).foregroundStyle(.secondary) }
                } else {
                    Section {
                        ForEach(list.tickets) { ticket in
                            NavigationLink(value: AccountRoute.ticket(ticket.id)) { TicketRow(ticket: ticket) }
                                .accessibilityIdentifier("ticketRow-\(ticket.number)")
                        }
                    }
                }
            } else if let failure = loader.failure {
                FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                    .listRowBackground(Color.clear)
            } else {
                LoadingView().frame(minHeight: 160).listRowBackground(Color.clear)
            }
        }
        .navigationTitle(L10n.text("supportTitle"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await loader.load(path, model: model, force: true) }
        .refreshable { await loader.load(path, model: model, force: true) }
        .onChange(of: loader.value) { _, list in if let list { model.supportWaiting = list.waiting } }
        .sheet(isPresented: $writing) {
            NewTicketView(model: model, draft: Support.NewTicket()) { id in
                model.accountPath.append(.ticket(id))
            }
        }
    }
}

private struct TicketRow: View {
    let ticket: Support.Ticket

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(ticket.subject).font(.headline).lineLimit(2)
                Spacer(minLength: 8)
                Pill(text: statusTitle(ticket.status), tint: statusTint(ticket.status))
            }
            HStack(spacing: 6) {
                Text("#\(ticket.number)").environment(\.layoutDirection, .leftToRight)
                Text("·")
                Text(kindTitle(ticket.kind))
                if let at = ticket.lastMessageAt {
                    Text("·")
                    Text(at.formatted(.relative(presentation: .named)))
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct NewTicketView: View {
    @ObservedObject var model: AppModel
    @State var draft: Support.NewTicket
    let onSent: (String) -> Void
    @State private var error: String?
    @State private var sending = false
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?

    private enum Field { case subject, body }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker(L10n.text("ticketKind"), selection: $draft.kind) {
                        ForEach(Support.Kind.openable) { Text(kindTitle($0)).tag($0) }
                    }
                    .accessibilityIdentifier("ticketKindPicker")
                } footer: {
                    if draft.kind == .teacher { Text(L10n.text("teacherPrivate")) }
                }
                Section {
                    TextField(L10n.text("ticketSubject"), text: $draft.subject)
                        .focused($focus, equals: .subject)
                        .submitLabel(.next)
                        .onSubmit { focus = .body }
                        .accessibilityIdentifier("ticketSubject")
                    TextField(L10n.text("ticketBody"), text: $draft.body, axis: .vertical)
                        .lineLimit(5...12)
                        .focused($focus, equals: .body)
                        .accessibilityIdentifier("ticketBody")
                }
                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.circle.fill").foregroundStyle(Brand.danger)
                            .accessibilityIdentifier("ticketError")
                    }
                }
            }
            .navigationTitle(L10n.text("newTicket"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.text("cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await send() }
                    } label: {
                        if sending { ProgressView() } else { Text(L10n.text("send")).bold() }
                    }
                    .disabled(sending)
                    .accessibilityIdentifier("ticketSend")
                }
            }
            .onAppear { focus = draft.subject.isEmpty ? .subject : .body }
        }
    }

    private func send() async {
        switch draft.problem {
        case .subject: error = L10n.text("ticketSubjectShort"); focus = .subject; return
        case .body: error = L10n.text("ticketBodyShort"); focus = .body; return
        case nil: break
        }
        sending = true
        defer { sending = false }
        switch await model.openTicket(draft) {
        case .success(let id):
            dismiss()
            // Open the conversation once the sheet has gone.
            try? await Task.sleep(nanoseconds: 450_000_000)
            onSent(id)
        case .failure(let failure):
            error = failure.message
        }
    }
}

struct TicketThreadView: View {
    @ObservedObject var model: AppModel
    let id: String
    @StateObject private var loader = Loader<Support.Thread>()
    @State private var reply = ""
    @State private var sending = false
    @State private var error: String?
    @State private var confirmClose = false
    @FocusState private var typing: Bool

    private var path: String { "/api/v1/ios/support/\(id)" }

    var body: some View {
        Group {
            if let thread = loader.value {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            header(thread)
                            ForEach(thread.messages) { MessageBubble(message: $0).id($0.id) }
                            if !thread.status.canReply {
                                Label(L10n.text("ticketClosed"), systemImage: "lock.fill")
                                    .font(.footnote).foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity).padding(.top, 8)
                                    .accessibilityIdentifier("ticketClosedNote")
                            }
                        }
                        .padding(16)
                    }
                    .onAppear { if let last = thread.messages.last { proxy.scrollTo(last.id, anchor: .bottom) } }
                    .onChange(of: thread.messages.count) { _, _ in
                        if let last = thread.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }
                .safeAreaInset(edge: .bottom) { if thread.status.canReply { composer } }
                .toolbar {
                    if thread.status.canClose {
                        ToolbarItem(placement: .primaryAction) {
                            Menu {
                                Button(role: .destructive) { confirmClose = true } label: { Label(L10n.text("closeTicket"), systemImage: "checkmark.seal") }
                                    .accessibilityIdentifier("closeTicket")
                            } label: { Image(systemName: "ellipsis.circle") }
                                .accessibilityIdentifier("ticketMenu")
                        }
                    }
                }
            } else if let failure = loader.failure {
                FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
            } else {
                LoadingView()
            }
        }
        .background(Brand.page)
        .navigationTitle(loader.value.map { "#\($0.number)" } ?? L10n.text("supportTitle"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await loader.load(path, model: model, force: true) }
        .refreshable { await loader.load(path, model: model, force: true) }
        .confirmationDialog(L10n.text("closeTicket"), isPresented: $confirmClose, titleVisibility: .visible) {
            Button(L10n.text("closeTicket"), role: .destructive) { Task { await close() } }
            Button(L10n.text("cancel"), role: .cancel) {}
        }
    }

    private func header(_ thread: Support.Thread) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(thread.subject).font(.headline)
                Spacer(minLength: 8)
                Pill(text: statusTitle(thread.status), tint: statusTint(thread.status))
            }
            Text(kindTitle(thread.kind)).font(.caption).foregroundStyle(.secondary)
            if let number = thread.orderNumber {
                Label(String(format: L10n.text("orderNumber"), number), systemImage: "shippingbox").font(.caption).foregroundStyle(.secondary)
            }
            if let course = thread.courseTitle {
                Label(course, systemImage: "book").font(.caption).foregroundStyle(.secondary)
            }
        }
        .card()
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let error {
                Text(error).font(.caption.weight(.semibold)).foregroundStyle(Brand.danger)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField(L10n.text("replyPlaceholder"), text: $reply, axis: .vertical)
                    .lineLimit(1...5)
                    .focused($typing)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .accessibilityIdentifier("replyField")
                Button {
                    Task { await send() }
                } label: {
                    Group {
                        if sending { ProgressView().tint(.white) } else { Image(systemName: "paperplane.fill").flipsForRightToLeftLayoutDirection(true) }
                    }
                    .frame(width: 44, height: 44)
                    .background(Support.replyIsValid(reply) ? Brand.blue : Color.gray.opacity(0.4), in: Circle())
                    .foregroundStyle(.white)
                }
                .disabled(sending || !Support.replyIsValid(reply))
                .accessibilityLabel(L10n.text("send"))
                .accessibilityIdentifier("replySend")
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.bar)
    }

    private func send() async {
        guard Support.replyIsValid(reply), !sending else { return }
        sending = true
        defer { sending = false }
        if let failure = await model.replyTicket(id: id, body: reply) {
            error = failure
        } else {
            reply = ""
            error = nil
            await loader.load(path, model: model, force: true)
        }
    }

    private func close() async {
        if let failure = await model.closeTicket(id: id) {
            error = failure
        } else {
            await loader.load(path, model: model, force: true)
        }
    }
}

private struct MessageBubble: View {
    let message: Support.Message

    private var author: String {
        if message.staff { return L10n.text("supportTeam") }
        if message.mine { return L10n.text("you") }
        return message.author ?? ""
    }

    var body: some View {
        // The student's own messages sit on the other side, as in chat apps.
        HStack {
            if message.mine { Spacer(minLength: 44) }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    if message.staff { Image(systemName: "checkmark.seal.fill").foregroundStyle(Brand.blue) }
                    Text(author).font(.caption.weight(.semibold)).foregroundStyle(message.staff ? Brand.blue : .secondary)
                }
                Text(message.body).font(.body).textSelection(.enabled)
                if let at = message.createdAt {
                    Text(at.formatted(date: .abbreviated, time: .shortened)).font(.caption2).foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .background(message.mine ? Brand.blue.opacity(0.14) : Brand.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier(message.staff ? "staffMessage" : "myMessage")
            if !message.mine { Spacer(minLength: 44) }
        }
    }
}
