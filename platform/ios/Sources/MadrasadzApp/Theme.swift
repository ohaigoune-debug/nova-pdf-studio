import SwiftUI

/// «مدرسة — بوابة المعرفة»: blue, navy and warm white; no bright yellow.
enum Brand {
    static let navy = Color(red: 0.047, green: 0.122, blue: 0.290)
    static let blue = Color(red: 0.078, green: 0.341, blue: 0.773)
    static let sky = Color(red: 0.835, green: 0.894, blue: 0.988)
    static let warm = Color(red: 0.984, green: 0.980, blue: 0.965)
    static let success = Color(red: 0.086, green: 0.502, blue: 0.239)
    static let danger = Color(red: 0.725, green: 0.110, blue: 0.110)
    static let card = Color(.secondarySystemGroupedBackground)
    static let page = Color(.systemGroupedBackground)
}

struct CardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

extension View {
    func card() -> some View { modifier(CardBackground()) }
}

/// Shown above a screen that is displaying its last saved copy.
struct OfflineBanner: View {
    let savedAt: Date?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
            if let savedAt {
                Text(String(format: L10n.text("offlineSavedAt"), savedAt.formatted(date: .abbreviated, time: .shortened)))
            } else {
                Text(L10n.text("offlineNow"))
            }
        }
        .font(.footnote.weight(.semibold))
        .foregroundStyle(Brand.navy)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.sky, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityIdentifier("offlineBanner")
    }
}

struct LoadingView: View {
    var body: some View {
        ProgressView(L10n.text("loading"))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(40)
    }
}

struct FailureView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label(L10n.text("nativeLoadFailed"), systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button(L10n.text("retry"), action: retry).buttonStyle(.borderedProminent).tint(Brand.blue)
        }
        .accessibilityIdentifier("failureView")
    }
}

/// Wrapping layout for word chips (fill-in bank).
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width { x = 0; y += row + spacing; row = 0 }
            x += size.width + spacing
            row = max(row, size.height)
        }
        return CGSize(width: width, height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > bounds.width { x = 0; y += row + spacing; row = 0 }
            view.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}

/// Numbers shown like the website: at most two decimals, no trailing zeros.
func scoreText(_ value: Double) -> String {
    let rounded = (value * 100).rounded() / 100
    if rounded == rounded.rounded() { return String(Int(rounded)) }
    return String(format: "%.2f", rounded).replacingOccurrences(of: #"0+$"#, with: "", options: .regularExpression)
}
