import Foundation
import LocalAuthentication
@preconcurrency import Capacitor

/// قفل التطبيق بـ Face ID / Touch ID / Optic ID، مع رمز الجهاز كبديل (deviceOwnerAuthentication).
/// لا يخزّن أي سر: النظام وحده يتحقق من هوية المالك، والتطبيق يتلقى نجاحًا أو فشلًا فقط.
@objc(NovaLockPlugin)
public class NovaLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NovaLockPlugin"
    public let jsName = "NovaLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        var biometry = "none"
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            switch context.biometryType {
            case .faceID: biometry = "faceID"
            case .touchID: biometry = "touchID"
            default:
                if #available(iOS 17.0, *), context.biometryType == .opticID { biometry = "opticID" }
            }
        }
        call.resolve(["available": available, "biometry": biometry])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock NOVA Docs"
        let context = LAContext()
        context.localizedFallbackTitle = call.getString("fallbackTitle")
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            call.reject(error?.localizedDescription ?? "Authentication unavailable", "UNAVAILABLE")
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
            if success {
                call.resolve(["success": true])
                return
            }
            let code = (authError as? LAError)?.code
            switch code {
            case .userCancel?, .appCancel?, .systemCancel?:
                call.reject("Cancelled", "CANCELLED")
            default:
                call.reject(authError?.localizedDescription ?? "Authentication failed", "FAILED")
            }
        }
    }
}
