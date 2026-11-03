import SwiftUI
import UIKit
import UserNotifications

/// Platform notifications (Build 15): the APNs device token goes to the model, and a tapped
/// notification opens its screen (a support reply, «طلباتي»). Planner reminders, which are
/// local notifications, now also show while the app is open.
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var model: AppModel? {
        didSet { flush() }
    }
    private var pendingToken: Data?
    private var pendingLinks: [String?] = []

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        if let model { model.pushTokenArrived(deviceToken) } else { pendingToken = deviceToken }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // No push for this build or device (simulator, profile without push): reminders still work.
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let remote = notification.request.trigger is UNPushNotificationTrigger
        if remote { await refreshBadge() }
        return [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let link = response.notification.request.content.userInfo["link"] as? String
        let remote = response.notification.request.trigger is UNPushNotificationTrigger
        guard remote else { return }
        await open(link)
    }

    private func refreshBadge() async {
        await model?.refreshSupportBadge()
    }

    private func open(_ link: String?) {
        if let model { model.openNotification(link: link) } else { pendingLinks.append(link) }
    }

    private func flush() {
        guard let model else { return }
        if let token = pendingToken {
            pendingToken = nil
            model.pushTokenArrived(token)
        }
        for link in pendingLinks { model.openNotification(link: link) }
        pendingLinks = []
    }
}
