import Foundation
import UIKit
@preconcurrency import Capacitor
import VisionKit

/// ماسح المستندات الأصلي من Apple (VisionKit):
/// اكتشاف حدود الورقة تلقائيًا، تصحيح المنظور، القص، والمسح متعدد الصفحات — كلها على الجهاز ودون إنترنت.
/// تُعاد الصفحات كملفات JPEG مؤقتة، وتتولى الواجهة تحسين الإضاءة وتحويلها إلى PDF.
@objc(NovaScannerPlugin)
public class NovaScannerPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "NovaScannerPlugin"
    public let jsName = "NovaScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCallId: String?
    private var jpegQuality: CGFloat = 0.85

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": VNDocumentCameraViewController.isSupported])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Document camera is not supported on this device", "UNSUPPORTED")
            return
        }
        jpegQuality = CGFloat(call.getDouble("quality") ?? 0.85)
        bridge?.saveCall(call)
        pendingCallId = call.callbackId
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else { return }
            let camera = VNDocumentCameraViewController()
            camera.delegate = self
            camera.modalPresentationStyle = .fullScreen
            presenter.present(camera, animated: true)
        }
    }

    private func takeCall() -> CAPPluginCall? {
        guard let id = pendingCallId, let call = bridge?.savedCall(withID: id) else { return nil }
        pendingCallId = nil
        bridge?.releaseCall(call)
        return call
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        let call = takeCall()
        let quality = jpegQuality
        let count = scan.pageCount
        // نحتفظ بالصور قبل إغلاق الكاميرا، ثم نكتبها في الخلفية
        var images: [UIImage] = []
        for index in 0..<count { images.append(scan.imageOfPage(at: index)) }
        controller.dismiss(animated: true)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("nova-scans", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            var pages: [[String: Any]] = []
            for (index, image) in images.enumerated() {
                guard let data = image.jpegData(compressionQuality: quality) else { continue }
                let url = dir.appendingPathComponent("scan-\(stamp)-\(index + 1).jpg")
                do {
                    try data.write(to: url, options: .atomic)
                    var page: [String: Any] = [
                        "path": url.path,
                        "width": Int(image.size.width * image.scale),
                        "height": Int(image.size.height * image.scale)
                    ]
                    if let web = self?.bridge?.portablePath(fromLocalURL: url) { page["webPath"] = web.absoluteString }
                    pages.append(page)
                } catch {
                    continue
                }
            }
            DispatchQueue.main.async {
                call?.resolve(["pages": pages, "cancelled": false, "title": scan.title])
            }
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        takeCall()?.resolve(["pages": [[String: Any]](), "cancelled": true])
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        takeCall()?.reject("Scan failed: \(error.localizedDescription)", "SCAN_FAILED", error)
    }
}
