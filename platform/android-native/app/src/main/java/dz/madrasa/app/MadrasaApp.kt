package dz.madrasa.app

import android.Manifest
import android.app.Application
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import dz.madrasa.app.ui.AppRoot

class MadrasaApp : Application() {
    lateinit var model: AppModel
        private set

    override fun onCreate() {
        super.onCreate()
        Reminders.createChannel(this)
        model = AppModel(this)
        model.start()
    }
}

val android.content.Context.app: AppModel get() = (applicationContext as MadrasaApp).model

class MainActivity : ComponentActivity() {
    private var permissionCallback: ((Boolean) -> Unit)? = null

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionCallback?.invoke(granted)
        permissionCallback = null
    }

    /** يُطلب إذن الإشعارات فقط حين يفعّل التلميذ تذكيرًا في «منظّمي». */
    fun requestNotifications(done: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        ) {
            done(Reminders.canNotify(this))
            return
        }
        permissionCallback = done
        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        handle(intent)
        setContent { AppRoot(app) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        val model = app
        if (model.signedIn && model.online) model.scope.launchSafe { model.play.sync() }
    }

    private fun handle(intent: Intent?) {
        intent?.getStringExtra("openTab")?.let { app.pendingTab = it }
    }
}
