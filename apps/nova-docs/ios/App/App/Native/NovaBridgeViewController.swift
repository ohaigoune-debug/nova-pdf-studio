import UIKit
import Capacitor

/// يسجّل الإضافات الأصلية الخاصة بـ NOVA Docs (Swift) داخل جسر Capacitor.
/// الإضافات المحلية في هدف التطبيق لا تُكتشف تلقائيًا، لذا تُسجَّل هنا صراحة.
class NovaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NovaStorePlugin())
        bridge?.registerPluginInstance(NovaScannerPlugin())
        bridge?.registerPluginInstance(NovaOcrPlugin())
        bridge?.registerPluginInstance(NovaDocumentsPlugin())
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
