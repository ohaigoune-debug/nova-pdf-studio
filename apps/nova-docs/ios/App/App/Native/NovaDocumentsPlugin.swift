import Foundation
import UIKit
@preconcurrency import Capacitor
import WebKit
import UniformTypeIdentifiers

/// تكامل الملفات الأصلي:
/// - فتح ملفات من تطبيق Files / iCloud Drive / أي مزوّد ملفات (UIDocumentPicker، نسخة داخل التطبيق).
/// - تصدير/حفظ نسخة إلى أي موقع يختاره المستخدم (بما فيه iCloud Drive).
/// - استيراد ملف وصل عبر «فتح في NOVA Docs» (قد يكون خارج صندوق التطبيق → وصول مؤقت بنطاق أمني).
/// - الطباعة عبر AirPrint (UIPrintInteractionController).
/// - تحويل HTML (الفواتير) إلى PDF متجهي بخطوط النظام وتشكيل عربي صحيح (WKWebView + UIPrintPageRenderer).
@objc(NovaDocumentsPlugin)
public class NovaDocumentsPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, WKNavigationDelegate {
    public let identifier = "NovaDocumentsPlugin"
    public let jsName = "NovaDocuments"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "printPdf", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "htmlToPdf", returnType: CAPPluginReturnPromise)
    ]

    private enum PickerMode { case open, export }
    private var pickerCallId: String?
    private var pickerMode: PickerMode = .open
    private var renderWebView: WKWebView?
    private var renderCallId: String?
    private var renderOutput: URL?
    private var renderPaper = CGSize(width: 595.28, height: 841.89)
    private var renderMargin: CGFloat = 0

    // MARK: - مساعدات
    private func inboxDirectory() -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("nova-inbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func describe(_ url: URL) -> [String: Any] {
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        var out: [String: Any] = [
            "path": url.path,
            "name": url.lastPathComponent,
            "size": (attrs?[.size] as? NSNumber)?.intValue ?? 0,
            "mimeType": UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        ]
        if let web = bridge?.portablePath(fromLocalURL: url) { out["webPath"] = web.absoluteString }
        return out
    }

    private func uniqueCopy(of source: URL) throws -> URL {
        let target = inboxDirectory().appendingPathComponent("\(Int(Date().timeIntervalSince1970 * 1000))-\(source.lastPathComponent)")
        if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
        try FileManager.default.copyItem(at: source, to: target)
        return target
    }

    private func presentFromBridge(_ controller: UIViewController) {
        guard let presenter = bridge?.viewController else { return }
        if let popover = controller.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        presenter.present(controller, animated: true)
    }

    // MARK: - فتح الملفات
    @objc func pickFiles(_ call: CAPPluginCall) {
        let kinds = call.getArray("types", String.self) ?? ["pdf"]
        var types: [UTType] = []
        if kinds.contains("pdf") { types.append(.pdf) }
        if kinds.contains("image") { types.append(contentsOf: [.jpeg, .png, .heic, .image]) }
        if kinds.contains("spreadsheet") {
            let sheetTypes: [UTType?] = [UTType(filenameExtension: "xlsx"), UTType(filenameExtension: "xls"), UTType.commaSeparatedText]
            types.append(contentsOf: sheetTypes.compactMap { $0 })
        }
        if kinds.contains("backup") {
            let backupTypes: [UTType?] = [UTType(filenameExtension: "novabackup"), UTType.data]
            types.append(contentsOf: backupTypes.compactMap { $0 })
        }
        if types.isEmpty { types = [.pdf] }
        bridge?.saveCall(call)
        pickerCallId = call.callbackId
        pickerMode = .open
        let multiple = call.getBool("multiple") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
            picker.allowsMultipleSelection = multiple
            picker.delegate = self
            self.presentFromBridge(picker)
        }
    }

    @objc func exportFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("path is required", "BAD_ARGS")
            return
        }
        let url = URL(fileURLWithPath: path.replacingOccurrences(of: "file://", with: ""))
        guard FileManager.default.fileExists(atPath: url.path) else {
            call.reject("File not found", "NOT_FOUND")
            return
        }
        bridge?.saveCall(call)
        pickerCallId = call.callbackId
        pickerMode = .export
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            self.presentFromBridge(picker)
        }
    }

    private func takePickerCall() -> CAPPluginCall? {
        guard let id = pickerCallId, let call = bridge?.savedCall(withID: id) else { return nil }
        pickerCallId = nil
        bridge?.releaseCall(call)
        return call
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = takePickerCall() else { return }
        if pickerMode == .export {
            call.resolve(["saved": true, "destinations": urls.map { $0.absoluteString }])
            return
        }
        var files: [[String: Any]] = []
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let copy = try? uniqueCopy(of: url) { files.append(describe(copy)) }
        }
        call.resolve(["files": files, "cancelled": false])
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let call = takePickerCall() else { return }
        if pickerMode == .export {
            call.resolve(["saved": false])
        } else {
            call.resolve(["files": [[String: Any]](), "cancelled": true])
        }
    }

    // MARK: - «فتح في NOVA Docs»
    @objc func importUrl(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw) else {
            call.reject("url is required", "BAD_ARGS")
            return
        }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var error: NSError?
        var result: [String: Any]?
        // NSFileCoordinator يضمن تنزيل ملفات iCloud غير المحمّلة قبل النسخ
        NSFileCoordinator().coordinate(readingItemAt: url, options: [.withoutChanges], error: &error) { readable in
            if let copy = try? self.uniqueCopy(of: readable) { result = self.describe(copy) }
        }
        if let result { call.resolve(result) } else { call.reject("Unable to import file: \(error?.localizedDescription ?? "unknown")", "IMPORT_FAILED") }
    }

    // MARK: - الطباعة
    @objc func printPdf(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("path is required", "BAD_ARGS")
            return
        }
        let url = URL(fileURLWithPath: path.replacingOccurrences(of: "file://", with: ""))
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard UIPrintInteractionController.canPrint(url) else {
                call.reject("This file cannot be printed", "CANNOT_PRINT")
                return
            }
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = call.getString("jobName") ?? url.lastPathComponent
            controller.printInfo = info
            controller.printingItem = url
            let completion: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error { call.reject("Print failed: \(error.localizedDescription)", "PRINT_FAILED", error) } else { call.resolve(["completed": completed]) }
            }
            if UIDevice.current.userInterfaceIdiom == .pad, let view = self.bridge?.viewController?.view {
                controller.present(from: CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1), in: view, animated: true, completionHandler: completion)
            } else {
                controller.present(animated: true, completionHandler: completion)
            }
        }
    }

    // MARK: - HTML → PDF (الفواتير)
    @objc func htmlToPdf(_ call: CAPPluginCall) {
        guard let html = call.getString("html") else {
            call.reject("html is required", "BAD_ARGS")
            return
        }
        renderPaper = CGSize(width: call.getDouble("widthPt") ?? 595.28, height: call.getDouble("heightPt") ?? 841.89)
        renderMargin = CGFloat(call.getDouble("marginPt") ?? 0)
        let name = (call.getString("fileName") ?? "invoice.pdf").replacingOccurrences(of: "/", with: "-")
        renderOutput = inboxDirectory().appendingPathComponent(name)
        bridge?.saveCall(call)
        renderCallId = call.callbackId
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let config = WKWebViewConfiguration()
            let web = WKWebView(frame: CGRect(origin: .zero, size: self.renderPaper), configuration: config)
            web.navigationDelegate = self
            self.renderWebView = web
            web.loadHTMLString(html, baseURL: nil)
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === renderWebView else { return }
        // مهلة قصيرة حتى تكتمل الخطوط والصور المضمّنة (data URLs)، ثم نقرأ عدد صفحات القالب الفعلية (.page):
        // تجاوز ارتفاع الصفحة بكسرٍ من البكسل كان يضيف صفحة بيضاء زائدة (رُصد على محاكي iOS).
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            webView.evaluateJavaScript("document.querySelectorAll('.page').length") { value, _ in
                let declared = (value as? NSNumber)?.intValue ?? 0
                self?.finishRender(webView, declaredPages: declared)
            }
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failRender(error)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failRender(error)
    }

    private func takeRenderCall() -> CAPPluginCall? {
        guard let id = renderCallId, let call = bridge?.savedCall(withID: id) else { return nil }
        renderCallId = nil
        bridge?.releaseCall(call)
        return call
    }

    private func failRender(_ error: Error) {
        renderWebView = nil
        takeRenderCall()?.reject("HTML render failed: \(error.localizedDescription)", "RENDER_FAILED", error)
    }

    private func finishRender(_ webView: WKWebView, declaredPages: Int) {
        guard let call = takeRenderCall(), let output = renderOutput else { return }
        let renderer = UIPrintPageRenderer()
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)
        let paper = CGRect(origin: .zero, size: renderPaper)
        // paperRect/printableRect للقراءة فقط في الواجهة العامة؛ ضبطهما عبر KVC هو الأسلوب المعروف لتوليد PDF بمقاس محدد
        renderer.setValue(NSValue(cgRect: paper), forKey: "paperRect")
        renderer.setValue(NSValue(cgRect: paper.insetBy(dx: renderMargin, dy: renderMargin)), forKey: "printableRect")
        let data = NSMutableData()
        UIGraphicsBeginPDFContextToData(data, paper, nil)
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: renderer.numberOfPages))
        let bounds = UIGraphicsGetPDFContextBounds()
        let available = max(renderer.numberOfPages, 1)
        let pageCount = declaredPages > 0 ? min(declaredPages, available) : available
        for page in 0..<pageCount {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: page, in: bounds)
        }
        UIGraphicsEndPDFContext()
        renderWebView = nil
        do {
            try data.write(to: output, options: .atomic)
            var result = describe(output)
            result["pages"] = pageCount
            call.resolve(result)
        } catch {
            call.reject("Unable to write PDF: \(error.localizedDescription)", "WRITE_FAILED", error)
        }
    }
}
