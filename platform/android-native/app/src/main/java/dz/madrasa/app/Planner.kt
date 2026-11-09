package dz.madrasa.app

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.serialization.Serializable
import java.io.File
import java.util.Calendar
import java.util.UUID

// ═══════════════════════════════════════════════════════════════════════════
// «منظّمي»: خطة المراجعة على هذا الهاتف فقط (لا تُرسل إلى الخادم)، وتوقيت أسبوعي مقترح لكل شعبة
// خارج أوقات الدراسة (الجمعة والسبت حصص أطول)، مع تذكير اختياري نصّه عام. نفس قواعد تطبيق الآيفون.
// ═══════════════════════════════════════════════════════════════════════════

enum class RevisionSubject(val id: String) {
    ARABIC("arabic"), MATH("math"), PHYSICS("physics"), SCIENCE("science"), PHILOSOPHY("philosophy"),
    HISTORY_GEOGRAPHY("history-geography"), ISLAMIC("islamic"), FRENCH("french"), ENGLISH("english"),
    OTHER_LANGUAGE("other-language"), TAMAZIGHT("tamazight"), ECONOMICS("economics"), ENGINEERING("engineering"), OTHER("other");

    val title: String
        get() = when (this) {
            HISTORY_GEOGRAPHY -> "التاريخ والجغرافيا"
            OTHER_LANGUAGE -> "لغة أجنبية ثالثة"
            else -> T("subj.$id").let { if (it == "subj.$id") id else it }
        }

    companion object {
        fun from(id: String?): RevisionSubject? = entries.firstOrNull { it.id == id }
    }
}

enum class RevisionActivity(val id: String) {
    REVIEW("review"), EXERCISES("exercises"), MEMORIZE("memorize"), MOCK_EXAM("mock-exam"), CORRECTION("correction");

    val title: String
        get() = when (this) {
            MOCK_EXAM -> "امتحان تجريبي"
            else -> T("act.$id").let { if (it == "act.$id") id else it }
        }

    companion object {
        fun from(id: String?): RevisionActivity? = entries.firstOrNull { it.id == id }
    }
}

enum class StudyStream(val id: String) {
    LITERATURE("literature"), LANGUAGES("languages"), SCIENCES("sciences"), MATHEMATICS("mathematics"),
    TECHNICAL("technical"), MANAGEMENT("management"), MIDDLE("middle");

    val title: String get() = T("stream.$id")

    /** الأوزان حسب معاملات البكالوريا لكل شعبة: المواد الأثقل تأخذ حصصًا أكثر */
    val weights: List<Pair<RevisionSubject, Int>>
        get() = when (this) {
            LITERATURE -> listOf(RevisionSubject.ARABIC to 6, RevisionSubject.PHILOSOPHY to 6, RevisionSubject.HISTORY_GEOGRAPHY to 4, RevisionSubject.FRENCH to 3, RevisionSubject.ENGLISH to 3, RevisionSubject.MATH to 2, RevisionSubject.ISLAMIC to 2)
            LANGUAGES -> listOf(RevisionSubject.ARABIC to 5, RevisionSubject.FRENCH to 5, RevisionSubject.ENGLISH to 5, RevisionSubject.OTHER_LANGUAGE to 4, RevisionSubject.HISTORY_GEOGRAPHY to 3, RevisionSubject.PHILOSOPHY to 2, RevisionSubject.MATH to 2, RevisionSubject.ISLAMIC to 2)
            SCIENCES -> listOf(RevisionSubject.SCIENCE to 6, RevisionSubject.PHYSICS to 5, RevisionSubject.MATH to 5, RevisionSubject.ARABIC to 3, RevisionSubject.PHILOSOPHY to 2, RevisionSubject.HISTORY_GEOGRAPHY to 2, RevisionSubject.FRENCH to 2, RevisionSubject.ENGLISH to 2, RevisionSubject.ISLAMIC to 2)
            MATHEMATICS -> listOf(RevisionSubject.MATH to 7, RevisionSubject.PHYSICS to 6, RevisionSubject.ARABIC to 3, RevisionSubject.SCIENCE to 2, RevisionSubject.PHILOSOPHY to 2, RevisionSubject.HISTORY_GEOGRAPHY to 2, RevisionSubject.FRENCH to 2, RevisionSubject.ENGLISH to 2, RevisionSubject.ISLAMIC to 2)
            TECHNICAL -> listOf(RevisionSubject.ENGINEERING to 7, RevisionSubject.MATH to 6, RevisionSubject.PHYSICS to 6, RevisionSubject.ARABIC to 2, RevisionSubject.PHILOSOPHY to 2, RevisionSubject.HISTORY_GEOGRAPHY to 2, RevisionSubject.FRENCH to 2, RevisionSubject.ENGLISH to 2, RevisionSubject.ISLAMIC to 2)
            MANAGEMENT -> listOf(RevisionSubject.ECONOMICS to 11, RevisionSubject.MATH to 5, RevisionSubject.HISTORY_GEOGRAPHY to 4, RevisionSubject.ARABIC to 3, RevisionSubject.OTHER to 2, RevisionSubject.PHILOSOPHY to 2, RevisionSubject.FRENCH to 2, RevisionSubject.ENGLISH to 2, RevisionSubject.ISLAMIC to 2)
            MIDDLE -> listOf(RevisionSubject.ARABIC to 5, RevisionSubject.MATH to 4, RevisionSubject.FRENCH to 3, RevisionSubject.ENGLISH to 2, RevisionSubject.SCIENCE to 2, RevisionSubject.PHYSICS to 2, RevisionSubject.HISTORY_GEOGRAPHY to 2, RevisionSubject.ISLAMIC to 2)
        }

    companion object {
        fun from(id: String?): StudyStream? = entries.firstOrNull { it.id == id }
    }
}

@Serializable
data class TimetableOptions(
    val morning: Boolean = true,
    val morningHour: Int = 6,
    val morningMinute: Int = 15,
    val eveningSessions: Int = 3,
    val eveningHour: Int = 18,
    val weekendSessions: Int = 4
) {
    companion object {
        const val MORNING_MINUTES = 30
        const val EVENING_MINUTES = 45
        const val WEEKEND_MINUTES = 60
        val WEEKEND_STARTS = listOf(9 to 0, 10 to 30, 15 to 0, 16 to 30)
    }
}

@Serializable
data class RevisionTask(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val date: Long,
    val completed: Boolean = false,
    val reminderEnabled: Boolean = false,
    val subjectId: String? = null,
    val activityId: String? = null,
    val durationMinutes: Int? = null,
    val planId: String? = null
) {
    val subject: RevisionSubject? get() = RevisionSubject.from(subjectId)
    val activity: RevisionActivity? get() = RevisionActivity.from(activityId)
    val displayTitle: String get() = subject?.title ?: title
}

@Serializable
data class PlannerState(
    val tasks: List<RevisionTask> = emptyList(),
    val streamId: String? = null,
    val options: TimetableOptions = TimetableOptions(),
    val dailySummary: Boolean = false
)

object Timetable {
    data class Slot(val date: Long, val minutes: Int, val activity: RevisionActivity)

    fun isWeekend(cal: Calendar): Boolean {
        val d = cal.get(Calendar.DAY_OF_WEEK)
        return d == Calendar.FRIDAY || d == Calendar.SATURDAY
    }

    fun slots(now: Long, days: Int, options: TimetableOptions): List<Slot> {
        val result = mutableListOf<Slot>()
        val first = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        for (offset in 0 until maxOf(0, days)) {
            val day = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, offset) }
            fun at(h: Int, m: Int): Long = (day.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m) }.timeInMillis
            val today = mutableListOf<Slot>()
            if (isWeekend(day)) {
                TimetableOptions.WEEKEND_STARTS.take(minOf(4, maxOf(0, options.weekendSessions))).forEachIndexed { index, (h, m) ->
                    val activity = if (index == 3) RevisionActivity.CORRECTION else if (index % 2 == 0) RevisionActivity.EXERCISES else RevisionActivity.REVIEW
                    today.add(Slot(at(h, m), TimetableOptions.WEEKEND_MINUTES, activity))
                }
            } else {
                if (options.morning) today.add(Slot(at(options.morningHour, options.morningMinute), TimetableOptions.MORNING_MINUTES, RevisionActivity.MEMORIZE))
                for (index in 0 until minOf(4, maxOf(0, options.eveningSessions))) {
                    today.add(Slot(at(options.eveningHour + index, 0), TimetableOptions.EVENING_MINUTES, if (index % 2 == 0) RevisionActivity.REVIEW else RevisionActivity.EXERCISES))
                }
            }
            result += today.filter { it.date > now + 300_000 }
        }
        return result
    }

    /** كم حصة لكل مادة: بنسبة وزنها، والباقي للمواد الأثقل أولًا */
    fun quotas(stream: StudyStream, count: Int): Map<RevisionSubject, Int> {
        val weights = stream.weights
        val total = weights.sumOf { it.second }
        if (count <= 0 || total <= 0) return emptyMap()
        val quota = mutableMapOf<RevisionSubject, Int>()
        data class Rest(val subject: RevisionSubject, val rest: Double, val weight: Int)
        val rests = mutableListOf<Rest>()
        for ((subject, weight) in weights) {
            val exact = count.toDouble() * weight / total
            val floor = kotlin.math.floor(exact)
            quota[subject] = floor.toInt()
            rests.add(Rest(subject, exact - floor, weight))
        }
        var left = count - quota.values.sum()
        for (r in rests.sortedWith(compareByDescending<Rest> { it.rest }.thenByDescending { it.weight })) {
            if (left <= 0) break
            quota[r.subject] = (quota[r.subject] ?: 0) + 1
            left--
        }
        return quota
    }

    /** الأسبوع كحصص مراجعة عادية: كل وقت لأكثر مادة بقيت لها حصص، دون تكرار المادة نفسها مرتين متتاليتين */
    fun build(stream: StudyStream, now: Long, days: Int, options: TimetableOptions, reminders: Boolean): List<RevisionTask> {
        val times = slots(now, days, options)
        val left = quotas(stream, times.size).toMutableMap()
        val order = stream.weights.map { it.first }
        var previous: RevisionSubject? = null
        val tasks = mutableListOf<RevisionTask>()
        for (slot in times) {
            val candidates = order.filter { (left[it] ?: 0) > 0 }
            if (candidates.isEmpty()) break
            val preferred = candidates.filter { it != previous }
            val pool = preferred.ifEmpty { candidates }
            val subject = pool.maxWithOrNull(compareBy<RevisionSubject> { left[it] ?: 0 }.thenByDescending { order.indexOf(it) }) ?: break
            left[subject] = (left[subject] ?: 0) - 1
            previous = subject
            tasks.add(
                RevisionTask(
                    title = "${slot.activity.title} — ${subject.title}".take(200), date = slot.date, reminderEnabled = reminders,
                    subjectId = subject.id, activityId = slot.activity.id, durationMinutes = slot.minutes, planId = "weekly-" + stream.id
                )
            )
        }
        return tasks
    }
}

object Phone {
    /** أرقام عربية ومسافات ← 0XXXXXXXXX (05/06/07)، أو null */
    fun normalize(raw: String): String? {
        val digits = StringBuilder()
        for (ch in raw) {
            when (ch) {
                in '0'..'9' -> digits.append(ch)
                in '٠'..'٩' -> digits.append('0' + (ch - '٠'))
                in '۰'..'۹' -> digits.append('0' + (ch - '۰'))
                '+' -> if (digits.isNotEmpty()) return null
                ' ', '-', '(', ')', '.', ' ' -> {}
                else -> return null
            }
        }
        var d = digits.toString()
        if (d.startsWith("213")) d = "0" + d.drop(3)
        if (d.length != 10 || !d.startsWith("0") || d[1] !in "567") return null
        return d
    }

    /** المعرّف (هاتف أو بريد): الأرقام العربية تصير أرقامًا عادية وتُحذف المسافات */
    fun identifier(value: String): String {
        if (value.contains("@")) return value.trim()
        val sb = StringBuilder()
        for (ch in value) {
            when (ch) {
                in '٠'..'٩' -> sb.append('0' + (ch - '٠'))
                in '۰'..'۹' -> sb.append('0' + (ch - '۰'))
                else -> if (!ch.isWhitespace() && ch != '-') sb.append(ch)
            }
        }
        return sb.toString()
    }
}

/** سجلّ المنظّم لهذا الحساب، وجدولة تذكيراته على الهاتف. */
class PlannerStore(private val context: Context, private val files: AccountFiles) {
    private fun file(account: String) = File(files.dir(account), "planner.json")

    fun load(account: String): PlannerState = AccountFiles.readJson(file(account), PlannerState.serializer()) ?: PlannerState()

    fun save(account: String, state: PlannerState) {
        AccountFiles.writeJson(file(account), PlannerState.serializer(), state)
        Reminders.schedule(context, state)
    }
}

object Reminders {
    const val CHANNEL = "planner"
    private const val PREFS = "madrasa.reminders"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(NotificationChannel(CHANNEL, context.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_DEFAULT))
        }
    }

    fun canNotify(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun pending(context: Context, requestCode: Int, body: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).putExtra("body", body)
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /**
     * يلغي كل التذكيرات السابقة ويجدول القادمة (حتى 60): قبل الحصة بعشر دقائق بنص عام دون عنوان الدرس،
     * وملخّص صباحي اختياري. تذكير تقريبي (دون إذن «المنبّه الدقيق» الذي تحصره Google في تطبيقات المنبّه).
     */
    fun schedule(context: Context, state: PlannerState?) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = prefs.getStringSet("codes", emptySet()) ?: emptySet()
        for (code in old) {
            code.toIntOrNull()?.let { am.cancel(pending(context, it, "")) }
        }
        val codes = mutableSetOf<String>()
        if (state != null) {
            val now = System.currentTimeMillis()
            val upcoming = state.tasks.filter { !it.completed && it.reminderEnabled && it.date > now }.sortedBy { it.date }.take(60)
            for (task in upcoming) {
                val early = task.date - 10 * 60_000L
                val (at, body) = if (early > now + 30_000) early to T("reminderSoon") else task.date to T("reminderBody")
                val code = (task.id.hashCode() and 0x7fffffff) % 1_000_000 + 1000
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, code, body))
                codes.add(code.toString())
            }
            if (state.dailySummary) {
                val cal = Calendar.getInstance()
                for (offset in 0 until 7) {
                    val day = (cal.clone() as Calendar).apply {
                        add(Calendar.DAY_OF_MONTH, offset); set(Calendar.HOUR_OF_DAY, 7); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
                    }
                    if (day.timeInMillis <= now) continue
                    val end = day.timeInMillis + 17 * 3_600_000L
                    val count = state.tasks.count { !it.completed && it.date >= day.timeInMillis && it.date < end }
                    if (count == 0) continue
                    val code = 900 + offset
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, day.timeInMillis, pending(context, code, Tf("dailySummaryBody", count)))
                    codes.add(code.toString())
                }
            }
        }
        prefs.edit().putStringSet("codes", codes).apply()
    }

    fun cancelAll(context: Context) {
        schedule(context, null)
        NotificationManagerCompat.from(context).cancelAll()
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Reminders.canNotify(context)) return
        Reminders.createChannel(context)
        val open = PendingIntent.getActivity(
            context, 1, Intent(context, MainActivity::class.java).putExtra("openTab", "planner").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, Reminders.CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_madrasa)
            .setContentTitle("مدرسة")
            .setContentText(intent.getStringExtra("body") ?: T("reminderBody"))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            NotificationManagerCompat.from(context).notify((System.currentTimeMillis() % 100000).toInt(), notification)
        } catch (e: SecurityException) {
        }
    }
}

/** بعد إعادة تشغيل الهاتف أو تحديث التطبيق: تُعاد جدولة التذكيرات من خطة الحساب المحفوظ. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val session = SessionVault(context).session ?: return
        val state = PlannerStore(context, AccountFiles(context)).load(session.accountId)
        Reminders.schedule(context, state)
    }
}
