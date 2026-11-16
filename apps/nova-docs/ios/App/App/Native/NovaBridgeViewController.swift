import UIKit
import WebKit
@preconcurrency import Capacitor

/// يسجّل الإضافات الأصلية الخاصة بـ NOVA Docs (Swift) داخل جسر Capacitor.
/// الإضافات المحلية في هدف التطبيق لا تُكتشف تلقائيًا، لذا تُسجَّل هنا صراحة.
class NovaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NovaStorePlugin())
        bridge?.registerPluginInstance(NovaScannerPlugin())
        bridge?.registerPluginInstance(NovaOcrPlugin())
        bridge?.registerPluginInstance(NovaDocumentsPlugin())
        #if DEBUG
        // للّقطات الآلية في CI فقط (نسخة Debug): NOVA_ROUTE="lang/ar,sample" يُمرَّر إلى الواجهة قبل تحميلها،
        // فتفتح الشاشة المطلوبة بنفسها عندما تكون جاهزة (بلا مؤقّت تخميني وبلا نافذة تأكيد الروابط).
        if let route = ProcessInfo.processInfo.environment["NOVA_ROUTE"], !route.isEmpty {
            let safe = route.filter { $0.isLetter || $0.isNumber || "/,-_".contains($0) }
            let script = WKUserScript(source: "window.__NOVA_ROUTE__ = '\(safe)';", injectionTime: .atDocumentStart, forMainFrameOnly: true)
            webView?.configuration.userContentController.addUserScript(script)
        }
        #endif
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // خلفية بلون الهوية أثناء تحميل الواجهة لتجنّب الوميض الأبيض في الوضع الداكن
        view.backgroundColor = UIColor(red: 0x12 / 255, green: 0x3D / 255, blue: 0x36 / 255, alpha: 1)
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
        // سحب الصفحة بالكامل غير مرغوب فيه في واجهة تطبيق أصلية
        webView?.scrollView.bounces = false
        webView?.allowsLinkPreview = false
    }
}
