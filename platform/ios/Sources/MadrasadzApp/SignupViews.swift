import SwiftUI
import MadrasadzCore

// MARK: - Create an account (inside the app)

/// The website's registration form, native: the same fields and rules, no purchase
/// and no invitation code. On success the app signs in with the new account.
struct SignupView: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var options: Signup.Options?
    @State private var loadFailure: String?
    @State private var form = Signup.Form()
    @State private var failure: AppModel.SignupFailure?
    @State private var working = false
    @FocusState private var focus: Signup.Field?

    private var levels: [Signup.Level] { options?.levels ?? [] }
    private var needsStream: Bool { levels.first(where: { $0.id == form.levelID })?.secondary ?? false }

    var body: some View {
        Group {
            if let options {
                formView(options)
            } else if let loadFailure {
                FailureView(message: loadFailure) { Task { await loadOptions() } }
            } else {
                LoadingView()
            }
        }
        .navigationTitle(L10n.text("register"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button(L10n.text("close")) { dismiss() } } }
        .task { if options == nil { await loadOptions() } }
    }

    private func formView(_ options: Signup.Options) -> some View {
        Form {
            Section {
                Text(L10n.text("signupIntro")).font(.subheadline).foregroundStyle(.secondary)
            }
            Section(L10n.text("signupContact")) {
                field(.fullName, L10n.text("signupFullName"), text: $form.fullName, content: .name, keyboard: .default)
                field(.email, L10n.text("signupEmail"), text: $form.email, content: .emailAddress, keyboard: .emailAddress)
                field(.phone, L10n.text("signupPhone"), text: $form.phone, content: .telephoneNumber, keyboard: .phonePad)
                field(.guardianPhone, L10n.text("signupGuardianPhone"), text: $form.guardianPhone, content: nil, keyboard: .phonePad)
                SecureField(L10n.text("signupPassword"), text: $form.password)
                    .textContentType(.newPassword)
                    // Passwords on the site are typed in Latin letters.
                    .keyboardType(.asciiCapable)
                    .focused($focus, equals: .password)
                    .listRowBackground(failure?.field == .password ? Brand.danger.opacity(0.08) : nil)
                    .accessibilityIdentifier("signup-password")
            }
            Section(L10n.text("signupStudies")) {
                Picker(L10n.text("signupWilaya"), selection: $form.wilayaID) {
                    Text(L10n.text("signupChoose")).tag("")
                    ForEach(options.wilayas) { wilaya in Text(wilaya.name).tag(wilaya.id) }
                }
                .pickerStyle(.navigationLink)
                .accessibilityIdentifier("signup-wilaya")
                Picker(L10n.text("signupLevel"), selection: $form.levelID) {
                    Text(L10n.text("signupChoose")).tag("")
                    ForEach(options.levels) { level in Text(level.name).tag(level.id) }
                }
                .pickerStyle(.navigationLink)
                .accessibilityIdentifier("signup-level")
                if needsStream {
                    Picker(L10n.text("signupStream"), selection: $form.streamID) {
                        Text(L10n.text("signupChoose")).tag("")
                        ForEach(options.streams) { stream in Text(stream.name).tag(stream.id) }
                    }
                    .pickerStyle(.navigationLink)
                    .accessibilityIdentifier("signup-stream")
                }
            }
            if let failure {
                Section {
                    Label(failure.message, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Brand.danger)
                        .accessibilityIdentifier("signupError")
                }
            }
            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack(spacing: 8) {
                        if working { ProgressView() }
                        Text(L10n.text("signupSubmit")).font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(working)
                .accessibilityIdentifier("signupSubmit")
            } footer: {
                Button(L10n.text("signupPrivacy")) { if let url = model.api.url("/privacy") { openURL(url) } }
                    .font(.footnote)
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func field(_ key: Signup.Field, _ title: String, text: Binding<String>, content: UITextContentType?, keyboard: UIKeyboardType) -> some View {
        TextField(title, text: text)
            .textContentType(content)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focus, equals: key)
            .listRowBackground(failure?.field == key ? Brand.danger.opacity(0.08) : nil)
            .accessibilityIdentifier("signup-\(key.rawValue)")
    }

    private func loadOptions() async {
        loadFailure = nil
        do {
            options = try await model.api.get(Signup.Options.self, "/api/v1/ios/register", requireSession: false).value
        } catch let failure as APIFailure {
            loadFailure = failure.message
        } catch {
            loadFailure = L10n.text("error")
        }
    }

    private func submit() async {
        guard !working else { return }
        focus = nil
        working = true
        failure = await model.register(form, levels: levels)
        working = false
        let typed: [Signup.Field] = [.fullName, .email, .phone, .guardianPhone, .password]
        if let field = failure?.field, typed.contains(field) { focus = field }
    }
}

// MARK: - Confirm the phone (inside the app)

/// As on the website: a 6-digit code by SMS, or a call from the registered phone to
/// the platform's number. Nothing here points anywhere else.
struct PhoneVerifyView: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var status: AppModel.PhoneStatus?
    @State private var loadFailure: String?
    @State private var phone = ""
    @State private var code = ""
    @State private var sentTo: String?
    @State private var cooldown = 0
    @State private var message: String?
    @State private var working = false
    @State private var done = false
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if done {
                ContentUnavailableView {
                    Label(L10n.text("phoneDone"), systemImage: "checkmark.seal.fill")
                } actions: {
                    Button(L10n.text("ok")) { dismiss() }.buttonStyle(.borderedProminent).tint(Brand.blue)
                }
                .accessibilityIdentifier("phoneDone")
            } else if let status {
                content(status)
            } else if let loadFailure {
                FailureView(message: loadFailure) { Task { await load() } }
            } else {
                LoadingView()
            }
        }
        .navigationTitle(L10n.text("phoneScreenTitle"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button(L10n.text("close")) { dismiss() } } }
        .task { await load() }
        .onReceive(tick) { _ in if cooldown > 0 { cooldown -= 1 } }
    }

    private func content(_ status: AppModel.PhoneStatus) -> some View {
        Form {
            if status.sms {
                Section {
                    TextField(L10n.text("phoneNumber"), text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .environment(\.layoutDirection, .leftToRight)
                        .accessibilityIdentifier("phone-number")
                    Button(cooldown > 0 ? String(format: L10n.text("phoneResend"), cooldown) : L10n.text("phoneSend")) {
                        Task { await send() }
                    }
                    .disabled(working || cooldown > 0)
                    .accessibilityIdentifier("phone-send")
                    if sentTo != nil {
                        TextField(L10n.text("phoneCode"), text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .environment(\.layoutDirection, .leftToRight)
                            .accessibilityIdentifier("phone-code")
                        Button(L10n.text("phoneConfirm")) { Task { await verify() } }
                            .disabled(working || code.count < 4)
                            .accessibilityIdentifier("phone-confirm")
                    }
                } footer: {
                    Text(sentTo.map { String(format: L10n.text("phoneSentTo"), $0) } ?? L10n.text("phoneSmsIntro"))
                }
            }
            if let number = status.callNumber {
                Section {
                    Button {
                        let digits = number.filter { $0.isNumber || $0 == "+" }
                        if let url = URL(string: "tel:\(digits)") { openURL(url) }
                    } label: {
                        Label(number, systemImage: "phone.fill").font(.title3.bold().monospacedDigit())
                    }
                    .environment(\.layoutDirection, .leftToRight)
                    .accessibilityIdentifier("phone-call")
                    Button(L10n.text("phoneCalled")) { Task { await checkCall() } }
                        .disabled(working)
                        .accessibilityIdentifier("phone-called")
                } header: {
                    Text(L10n.text("phoneCallIntro"))
                }
            }
            if !status.sms && status.callNumber == nil {
                Section { Text(L10n.text("phoneNoChannel")).foregroundStyle(.secondary) }
            }
            if let message {
                Section {
                    Label(message, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Brand.danger)
                        .accessibilityIdentifier("phone-error")
                }
            }
        }
    }

    private func load() async {
        loadFailure = nil
        do {
            let fresh = try await model.phoneStatus()
            status = fresh
            if phone.isEmpty { phone = fresh.phone ?? "" }
            if !fresh.required { done = true }
        } catch let failure as APIFailure {
            loadFailure = failure.message
        } catch {
            loadFailure = L10n.text("error")
        }
    }

    private func send() async {
        guard !working else { return }
        working = true
        message = nil
        let result = await model.requestPhoneCode(phone: phone)
        working = false
        switch result {
        case .success(let wait):
            sentTo = Signup.phoneHint(Signup.normalizedPhone(phone))
            cooldown = max(wait, 1)
        case .failure(let error):
            message = error.message
        }
    }

    private func verify() async {
        guard !working else { return }
        working = true
        message = await model.verifyPhone(phone: phone, code: code)
        working = false
        if message == nil { done = true }
    }

    private func checkCall() async {
        guard !working else { return }
        working = true
        let confirmed = await model.refreshPhoneGate()
        working = false
        if confirmed { done = true } else { message = L10n.text("phoneStillPending") }
    }
}
