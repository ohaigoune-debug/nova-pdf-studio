import SwiftUI
import UIKit

// The student shell of madrasadz.com on a phone (owner screenshots IMG_6713 /
// IMG_6714, website `shell-client.tsx`): a header with the logo, the five-item
// bottom navigation with the raised «استكشف» button, and the site's colour
// tokens (`globals.css`, `:root` and `.dark`). Real SwiftUI controls only.

// MARK: - Colour tokens

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

/// The website's design tokens, light (`:root`) and dark (`.dark`).
enum Brand {
    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }

    /// --background: #F6F5F0 / #0E1528
    static let background = adaptive(0xF6F5F0, 0x0E1528)
    /// --card: #FFFFFF / #17223B
    static let card = adaptive(0xFFFFFF, 0x17223B)
    /// The sticky header: card at 92 % over the background (`.brand-header`).
    static let header = adaptive(0xFEFEFD, 0x16213A)
    /// --foreground: #111B35 / #F6F5F0
    static let foreground = adaptive(0x111B35, 0xF6F5F0)
    /// --primary: #3155F5 / #92AAFF (the readable blue on navy)
    static let primary = adaptive(0x3155F5, 0x92AAFF)
    /// --primary-foreground: white / navy
    static let onPrimary = adaptive(0xFFFFFF, 0x111B35)
    /// --secondary: #EBEFFF / #26334F
    static let secondary = adaptive(0xEBEFFF, 0x26334F)
    /// --secondary-foreground: #263FC6 / #E2E8FF
    static let onSecondary = adaptive(0x263FC6, 0xE2E8FF)
    /// --muted: #EEF0F5 / #22304A
    static let muted = adaptive(0xEEF0F5, 0x22304A)
    /// --muted-foreground: #59647A / #BBC5DA
    static let mutedForeground = adaptive(0x59647A, 0xBBC5DA)
    /// --border: #D7DDE8 / #394966
    static let border = adaptive(0xD7DDE8, 0x394966)
    /// --accent (lime, both themes) with navy text on it.
    static let accent = adaptive(0xD9FA63, 0xD9FA63)
    static let onAccent = adaptive(0x111B35, 0x111B35)
    /// --success: #157548 / #79D7A3
    static let success = adaptive(0x157548, 0x79D7A3)
    /// --destructive: #B42318 / #FFB4AB
    static let destructive = adaptive(0xB42318, 0xFFB4AB)
    /// --brand-paper: the light plate behind the navy logo on dark surfaces.
    static let paper = adaptive(0xF6F5F0, 0xF6F5F0)
}

/// The header's sun/moon button, as on the website. Dark (the owner's
/// screenshots) until the student chooses light. Stored on this device only.
enum AppAppearance: String {
    case dark, light
    static let storageKey = "madrasadz.appearance.v1"
    var scheme: ColorScheme { self == .light ? .light : .dark }
}

// MARK: - Destinations of the bottom bar

/// The five destinations of the website's student bottom navigation, in its
/// order (first item at the start edge: the right in Arabic).
enum ShellTab: Int, CaseIterable, Identifiable {
    case home, lessons, explore, courses, account

    var id: Int { rawValue }

    var key: String {
        switch self {
        case .home: return "home"
        case .lessons: return "lessons"
        case .explore: return "explore"
        case .courses: return "courses"
        case .account: return "account"
        }
    }

    var title: String { L10n.text("tab." + key) }
    var identifier: String { "tab." + key }

    /// SF Symbols closest to the site's lucide icons (Home, BookOpenText,
    /// Compass, GraduationCap, UserRound).
    var symbol: String {
        switch self {
        case .home: return "house"
        case .lessons: return "book"
        case .explore: return "safari"
        case .courses: return "graduationcap"
        case .account: return "person"
        }
    }
}

// MARK: - Logo

/// The MADRASADZ logo as the site draws it in the header: `<Logo width={132}>`
/// on a light plate (`px-2 py-1`, 12 pt corners) in dark mode, bare in light
/// mode. The BrandLogo asset is 2172×724 px with transparent margins around
/// the artwork (x 236–1964, y 129–627); it is scaled so the artwork has the
/// site's size and the margins are clipped.
struct BrandLogoPlate: View {
    /// Plate width in points (the site: 132 + 2 × 8).
    let width: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let box = width - 16
        // The site's file (600 px) carries the artwork over 584 px of its width.
        let scale = box * (584.0 / 600.0) / 1728.0
        Image("BrandLogo")
            .resizable()
            .interpolation(.high)
            .frame(width: 2172 * scale, height: 724 * scale)
            // Artwork centre (y 378 px) onto the box centre (y 362 px).
            .offset(y: -16 * scale)
            .frame(width: box, height: box * 184.0 / 600.0)
            .clipped()
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(colorScheme == .dark ? Brand.paper : Color.clear,
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: - Header

/// The sticky site header (`brand-header`, 72 pt): ☰ at the start edge, the
/// logo in the middle, notifications and the theme button at the end edge.
/// Shown on the five root screens; pushed screens keep the system bar with
/// its back button.
struct ShellHeader: View {
    @ObservedObject var model: AppModel
    @Binding var showingAccount: Bool
    @AppStorage(AppAppearance.storageKey) private var appearance = AppAppearance.dark.rawValue

    private var isDark: Bool { appearance != AppAppearance.light.rawValue }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                HeaderIconButton(symbol: "line.3.horizontal", label: L10n.text("menu"), identifier: "accountButton") {
                    showingAccount = true
                }
                Spacer(minLength: 0)
            }
            .frame(width: 96)
            ViewThatFits(in: .horizontal) {
                logo(148)
                logo(128)
                logo(108)
            }
            .frame(maxWidth: .infinity)
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                // Notifications only for a verified student; no unread badge
                // because the iOS API does not report a count.
                if model.personalSpaceReady {
                    HeaderIconButton(symbol: "bell", label: L10n.text("menuNotifications"), identifier: "headerNotifications") {
                        model.openWebsite(path: "/student/notifications")
                    }
                }
                HeaderIconButton(symbol: isDark ? "sun.max" : "moon", label: L10n.text("theme"), identifier: "themeToggle") {
                    appearance = isDark ? AppAppearance.light.rawValue : AppAppearance.dark.rawValue
                }
                .accessibilityValue(L10n.text(isDark ? "themeDark" : "themeLight"))
            }
            .frame(width: 96)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .frame(height: 72)
        .background { Brand.header.ignoresSafeArea(edges: .top) }
        .overlay(alignment: .bottom) { Brand.border.frame(height: 1) }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("shellHeader")
    }

    private func logo(_ width: CGFloat) -> some View {
        Button { model.selectTab(.home) } label: { BrandLogoPlate(width: width) }
            .buttonStyle(.plain)
            .accessibilityLabel("مدرسة — MADRASADZ")
            .accessibilityHint(L10n.text("tab.home"))
            .accessibilityIdentifier("shellLogo")
    }
}

private struct HeaderIconButton: View {
    let symbol: String
    let label: String
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .regular))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Brand.foreground)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Bottom bar

/// The site's `student-bottom-nav`: card background with a top border, five
/// equal columns (at most 512 pt wide), 68 pt high above the home indicator.
/// The selected item is primary with its icon in a secondary pill; «استكشف» is
/// a 48 pt primary circle with a 4 pt card ring, raised above the bar.
struct ShellBottomBar: View {
    let selected: ShellTab
    let select: (ShellTab) -> Void

    /// Transparent strip above the bar for the raised button, included in the
    /// inset so the end of a scrolled screen is never under the circle.
    static let raise: CGFloat = 14

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            ForEach(ShellTab.allCases) { tab in
                ShellTabButton(tab: tab, selected: tab == selected) { select(tab) }
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: 512, minHeight: 68)
        .frame(maxWidth: .infinity)
        .background {
            Brand.card
                .overlay(alignment: .top) { Brand.border.frame(height: 1) }
                .ignoresSafeArea(edges: .bottom)
        }
        .padding(.top, Self.raise)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.text("shellNav"))
        .accessibilityIdentifier("shellTabBar")
    }
}

private struct ShellTabButton: View {
    let tab: ShellTab
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                if tab == .explore {
                    Image(systemName: tab.symbol)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(Brand.onPrimary)
                        .frame(width: 48, height: 48)
                        .background(Brand.primary, in: Circle())
                        .overlay { Circle().strokeBorder(Brand.card, lineWidth: 4).padding(-4) }
                        .shadow(color: .black.opacity(0.07), radius: 6, y: 2)
                } else {
                    Image(systemName: tab.symbol)
                        .font(.system(size: 18, weight: .medium))
                        .frame(minWidth: 20, minHeight: 24)
                        .padding(.horizontal, 12)
                        .background {
                            if selected { Capsule().fill(Brand.secondary) }
                        }
                }
                Text(tab.title)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(selected ? Brand.primary : Brand.mutedForeground)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // The site lifts the circle 20 pt (`-mt-5`); moving the whole item
        // keeps the circle inside its own touch area.
        .offset(y: tab == .explore ? -10 : 0)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier(tab.identifier)
        .accessibilityShowsLargeContentViewer()
    }
}

// MARK: - Chrome modifiers

/// Root screen of a destination: the site header replaces the navigation bar.
private struct ShellRootChrome: ViewModifier {
    @ObservedObject var model: AppModel
    @Binding var showingAccount: Bool
    let title: String

    func body(content: Content) -> some View {
        content
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                ShellHeader(model: model, showingAccount: $showingAccount)
            }
    }
}

extension View {
    func shellRoot(model: AppModel, showingAccount: Binding<Bool>, title: String) -> some View {
        modifier(ShellRootChrome(model: model, showingAccount: showingAccount, title: title))
    }

    /// Pushed screens: the system bar (back button, title) on the header colour.
    func siteNavigationBar() -> some View {
        toolbarBackground(Brand.header, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }

    /// List screens pushed on the shell: the site background behind the rows.
    func siteListBackground() -> some View {
        scrollContentBackground(.hidden)
            .background(Brand.background)
    }

    /// The site's `Card`: card colour, 1 pt border, `rounded-lg` (18 pt).
    func siteCard(radius: CGFloat = 18) -> some View {
        background(Brand.card, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Brand.border, lineWidth: 1)
            }
    }
}

// MARK: - Buttons

/// The site's `Button`: `rounded-md` (12 pt), semibold text, 48 pt (`sm`: 44 pt).
/// primary = bg-primary / primary-foreground; outline = card with a border.
struct SiteButtonStyle: ButtonStyle {
    enum Kind { case primary, outline, secondary }
    var kind: Kind = .primary
    var fullWidth = false
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        SiteButtonBody(configuration: configuration, kind: kind, fullWidth: fullWidth, compact: compact)
    }
}

private struct SiteButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let kind: SiteButtonStyle.Kind
    let fullWidth: Bool
    let compact: Bool
    @Environment(\.isEnabled) private var isEnabled

    private var fill: Color {
        switch kind {
        case .primary: return Brand.primary
        case .outline: return Brand.card
        case .secondary: return Brand.secondary
        }
    }

    private var text: Color {
        switch kind {
        case .primary: return Brand.onPrimary
        case .outline: return Brand.foreground
        case .secondary: return Brand.onSecondary
        }
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        configuration.label
            .font(.subheadline.weight(.semibold))
            .multilineTextAlignment(.center)
            .padding(.horizontal, compact ? 14 : 20)
            .padding(.vertical, 8)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: compact ? 44 : 48)
            .foregroundStyle(text)
            .background(fill, in: shape)
            .overlay {
                if kind == .outline { shape.strokeBorder(Brand.border, lineWidth: 1) }
            }
            .contentShape(shape)
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.5)
    }
}

/// The site's hub tabs (`HubTabs`): a row of links with a 2 pt primary
/// underline under the current one and a bottom border.
struct SiteHubTabs: View {
    struct Item: Identifiable {
        let id: String
        let title: String
        let selected: Bool
        let action: () -> Void
    }

    let items: [Item]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(items) { item in
                    Button(action: item.action) {
                        Text(item.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(item.selected ? Brand.primary : Brand.mutedForeground)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .overlay(alignment: .bottom) {
                                if item.selected { Brand.primary.frame(height: 2) }
                            }
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(item.selected ? .isSelected : [])
                    .accessibilityIdentifier(item.id)
                }
            }
        }
        .overlay(alignment: .bottom) { Brand.border.frame(height: 1) }
    }
}
