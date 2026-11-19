import Foundation
import UIKit
import PDFKit
@preconcurrency import Capacitor

/// عرض صفحات PDF بمحرك iOS نفسه (PDFKit / Core Graphics) — مثل تطبيق «الملفات» تمامًا.
/// السبب: على iPhone حقيقي ظهر ملف عربي مقطّع الحروف في pdf.js داخل WKWebView؛ محرك النظام يرسم الخطوط
/// المضمّنة بمعرّفات الحروف مباشرة فلا يتأثر بتحويل الخطوط في pdf.js.
/// الصورة تُكتب في مجلد التخزين المؤقت (JPEG) ويُعاد مسارها للواجهة؛ المفتاح يشمل حجم الملف وتاريخ تعديله.
@objc(NovaPdfRenderPlugin)
public class NovaPdfRenderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NovaPdfRenderPlugin"
    public let jsName = "NovaPdfRender"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "renderPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCache", returnType: CAPPluginReturnPromise)
    ]

    /// طابور تسلسلي: PDFDocument لا يُستعمل من عدة خيوط في وقت واحد
    private let queue = DispatchQueue(label: "nova.pdf.render", qos: .userInitiated)
    private var openDoc: (key: String, doc: PDFDocument)?

    private func cacheDirectory() -> URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("nova-render", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// تجزئة ثابتة بين التشغيلات (hashValue في Swift عشوائية لكل تشغيل)
    private func stableHash(_ s: String) -> String {
        var h: UInt64 = 0xcbf29ce484222325
        for b in s.utf8 { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        return String(h, radix: 36)
    }

    private func fileURL(from raw: String) -> URL? {
        if raw.hasPrefix("file://") { return URL(string: raw) }
        if raw.hasPrefix("/") { return URL(fileURLWithPath: raw) }
        return nil
    }

    @objc func renderPage(_ call: CAPPluginCall) {
        guard let raw = call.getString("path"), let url = fileURL(from: raw), url.isFileURL else {
            return call.reject("Invalid path", "BAD_PATH")
        }
        // ملفات التطبيق فقط
        let home = URL(fileURLWithPath: NSHomeDirectory()).resolvingSymlinksInPath().path
        guard url.resolvingSymlinksInPath().path.hasPrefix(home) else { return call.reject("Outside app container", "BAD_PATH") }
        let pageIndex = call.getInt("page") ?? 0
        let width = max(32, min(call.getInt("width") ?? 1200, 4096))

        queue.async { [weak self] in
            guard let self else { return }
            let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
            let size = (attrs?[.size] as? NSNumber)?.int64Value ?? 0
            let mtime = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
            let fileKey = "\(self.stableHash(url.path))-\(size)-\(Int64(mtime * 1000))"
            let out = self.cacheDirectory().appendingPathComponent("\(fileKey)-p\(pageIndex)-w\(width).jpg")

            if FileManager.default.fileExists(atPath: out.path), let img = UIImage(contentsOfFile: out.path) {
                return call.resolve(self.payload(out, img.size))
            }
            let doc: PDFDocument
            if let cached = self.openDoc, cached.key == fileKey {
                doc = cached.doc
            } else {
                guard let d = PDFDocument(url: url) else { return call.reject("Cannot open PDF", "OPEN_FAILED") }
                if d.isLocked { return call.reject("Encrypted PDF", "LOCKED") }
                self.openDoc = (fileKey, d)
                doc = d
            }
            guard let page = doc.page(at: pageIndex) else { return call.reject("No such page", "NO_PAGE") }

            // أبعاد العرض (مع الدوران) من مربع القص، كما في pdf.js
            let box = page.bounds(for: .cropBox)
            let turned = abs(page.rotation) % 180 == 90
            let pageW = turned ? box.height : box.width
            let pageH = turned ? box.width : box.height
            guard pageW > 0, pageH > 0 else { return call.reject("Empty page", "EMPTY") }
            let target = CGSize(width: CGFloat(width), height: max(1, (CGFloat(width) * pageH / pageW).rounded()))

            // thumbnail يحترم الدوران ونسبة المربع؛ نرسمه فوق خلفية بيضاء (الصفحات الشفافة)
            let thumb = page.thumbnail(of: target, for: .cropBox)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            format.opaque = true
            let image = UIGraphicsImageRenderer(size: target, format: format).image { ctx in
                UIColor.white.setFill()
                ctx.fill(CGRect(origin: .zero, size: target))
                let s = thumb.size
                let origin = CGPoint(x: (target.width - s.width) / 2, y: (target.height - s.height) / 2)
                thumb.draw(in: CGRect(origin: origin, size: s))
            }
            guard let data = image.jpegData(compressionQuality: 0.9) else { return call.reject("Encode failed", "ENCODE") }
            do {
                try data.write(to: out, options: .atomic)
            } catch {
                return call.reject("Write failed", "WRITE")
            }
            call.resolve(self.payload(out, target))
        }
    }

    private func payload(_ file: URL, _ size: CGSize) -> [String: Any] {
        var out: [String: Any] = ["path": file.path, "width": Int(size.width), "height": Int(size.height)]
        if let web = bridge?.portablePath(fromLocalURL: file) { out["webPath"] = web.absoluteString }
        return out
    }

    @objc func clearCache(_ call: CAPPluginCall) {
        queue.async { [weak self] in
            guard let self else { return }
            self.openDoc = nil
            try? FileManager.default.removeItem(at: self.cacheDirectory())
            call.resolve()
        }
    }
}
