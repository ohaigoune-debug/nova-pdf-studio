import Foundation
import UIKit
import Capacitor
import Vision

/// OCR أصلي عبر Apple Vision (على الجهاز، دون إنترنت).
/// اللغات المدعومة تختلف حسب إصدار iOS؛ لذلك نُرجع القائمة الفعلية من الجهاز (supportedRecognitionLanguages)،
/// والواجهة تنتقل تلقائيًا إلى محرك Tesseract المضمّن (ara/fra/eng) إذا كانت لغة مطلوبة غير مدعومة هنا.
/// OCR ميزة Pro: يُتحقق من الاستحقاق هنا أيضًا (دفاع إضافي لا يعتمد على الواجهة وحدها).
@objc(NovaOcrPlugin)
public class NovaOcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NovaOcrPlugin"
    public let jsName = "NovaOcr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "supportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    private func makeRequest() -> VNRecognizeTextRequest {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        return request
    }

    @objc func supportedLanguages(_ call: CAPPluginCall) {
        let request = makeRequest()
        let languages = (try? request.supportedRecognitionLanguages()) ?? []
        call.resolve(["languages": languages, "revision": request.revision])
    }

    @objc func recognize(_ call: CAPPluginCall) {
        let requested = call.getArray("languages", String.self) ?? ["ar-SA", "fr-FR", "en-US"]
        let path = call.getString("path")
        let base64 = call.getString("base64")
        Task {
            guard await NovaStorePlugin.isProActive() else {
                call.reject("OCR requires NOVA Pro", "PRO_REQUIRED")
                return
            }
            DispatchQueue.global(qos: .userInitiated).async {
                var image: UIImage?
                if let path, let data = FileManager.default.contents(atPath: path.replacingOccurrences(of: "file://", with: "")) {
                    image = UIImage(data: data)
                } else if let base64, let data = Data(base64Encoded: base64.components(separatedBy: ",").last ?? base64) {
                    image = UIImage(data: data)
                }
                guard let cgImage = image?.cgImage else {
                    call.reject("Invalid image", "BAD_IMAGE")
                    return
                }
                let request = self.makeRequest()
                let supported = (try? request.supportedRecognitionLanguages()) ?? []
                let usable = requested.filter { supported.contains($0) }
                let missing = requested.filter { !supported.contains($0) }
                if !usable.isEmpty { request.recognitionLanguages = usable }
                if #available(iOS 16.0, *) { request.automaticallyDetectsLanguage = usable.count != 1 }
                let started = Date()
                let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
                do {
                    try handler.perform([request])
                } catch {
                    call.reject("OCR failed: \(error.localizedDescription)", "OCR_FAILED", error)
                    return
                }
                let width = CGFloat(cgImage.width)
                let height = CGFloat(cgImage.height)
                var lines: [[String: Any]] = []
                var texts: [String] = []
                var confidenceSum: Float = 0
                for observation in request.results ?? [] {
                    guard let candidate = observation.topCandidates(1).first else { continue }
                    // Vision: إحداثيات مُطبَّعة من أسفل-يسار → نحوّلها إلى بكسل من أعلى-يسار (مثل Tesseract)
                    let box = observation.boundingBox
                    let x0 = box.minX * width
                    let x1 = box.maxX * width
                    let y0 = (1 - box.maxY) * height
                    let y1 = (1 - box.minY) * height
                    lines.append([
                        "text": candidate.string,
                        "confidence": Double(candidate.confidence) * 100,
                        "x0": Double(x0), "y0": Double(y0), "x1": Double(x1), "y1": Double(y1),
                        "words": []
                    ])
                    texts.append(candidate.string)
                    confidenceSum += candidate.confidence
                }
                let confidence = lines.isEmpty ? 0 : Double(confidenceSum / Float(lines.count)) * 100
                call.resolve([
                    "engine": "vision",
                    "text": texts.joined(separator: "\n"),
                    "confidence": confidence,
                    "lines": lines,
                    "widthPx": Int(width),
                    "heightPx": Int(height),
                    "durationMs": Int(Date().timeIntervalSince(started) * 1000),
                    "languages": usable,
                    "unsupportedLanguages": missing
                ])
            }
        }
    }
}
