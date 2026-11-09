package dz.madrasa.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.AppModel
import dz.madrasa.app.MainActivity
import dz.madrasa.app.Reminders
import dz.madrasa.app.RevisionActivity
import dz.madrasa.app.RevisionSubject
import dz.madrasa.app.RevisionTask
import dz.madrasa.app.StudyStream
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.str
import dz.madrasa.app.Timetable
import dz.madrasa.app.TimetableOptions
import java.util.Calendar

private fun dayStart(millis: Long): Long = Calendar.getInstance().apply {
    timeInMillis = millis; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
}.timeInMillis

private fun bucket(task: RevisionTask, now: Long): Pair<Int, String> {
    if (task.completed) return 9 to T("bucketDone")
    val today = dayStart(now)
    val day = dayStart(task.date)
    val diff = ((day - today) / 86_400_000L).toInt()
    return when {
        task.date + (task.durationMinutes ?: 30) * 60_000L < now -> 0 to T("bucketOverdue")
        diff <= 0 -> 1 to T("bucketToday")
        diff == 1 -> 2 to T("bucketTomorrow")
        diff < 7 -> (2 + diff) to formatDate(task.date, "EEEE d MMMM")
        else -> 8 to T("bucketLater")
    }
}

/** يطلب إذن الإشعارات عند الحاجة فقط؛ إن رُفض يُحفظ الموعد دون تذكير ويُقال ذلك للتلميذ. */
fun ensureNotifications(app: AppModel, context: android.content.Context, done: (Boolean) -> Unit) {
    val activity = context as? MainActivity
    if (activity == null) {
        done(Reminders.canNotify(context)); return
    }
    activity.requestNotifications { granted ->
        if (!granted) app.notice = T("androidNotifDenied")
        done(granted)
    }
}

@Composable
fun PlannerScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val context = LocalContext.current
    val state = app.planner
    val now = System.currentTimeMillis()
    val weekStart = dayStart(now)
    val weekEnd = weekStart + 7 * 86_400_000L
    val week = state.tasks.filter { it.date in weekStart until weekEnd }
    val doneWeek = week.count { it.completed }
    val minutes = week.sumOf { it.durationMinutes ?: 0 }
    val next = state.tasks.filter { !it.completed && it.date + (it.durationMinutes ?: 30) * 60_000L > now }.minByOrNull { it.date }

    Screen(T("planner"), back = false, actions = {
        IconButton(onClick = { nav.go("task") }) { Icon(Icons.Filled.Add, T("add")) }
    }) { padding ->
        RefreshList(padding, false, {}) {
            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brush.linearGradient(listOf(Brand.amber, Color(0xFFD97706))))
                        .clickable { nav.go("timetable") }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(T("timetableTitle"), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text(T("timetableCardHint"), color = Color.White.copy(alpha = 0.9f), fontSize = 12.sp)
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, null, tint = Color.White)
                }
            }
            item {
                CardBox {
                    Text(T("plannerWeek"), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(Tf("plannerProgress", doneWeek, week.size), fontSize = 14.sp)
                    LinearProgressIndicator(progress = { if (week.isEmpty()) 0f else doneWeek.toFloat() / week.size }, modifier = Modifier.fillMaxWidth(), color = Brand.success)
                    Text(Tf("plannerMinutes", minutes), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.size(4.dp))
                    Text(T("plannerNext"), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(if (next != null) next.displayTitle + " · " + formatDate(next.date, "EEEE HH:mm") else T("plannerNothingNext"), fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(T("dailySummary"), fontWeight = FontWeight.SemiBold)
                            Text(T("dailySummaryFooter"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = state.dailySummary, onCheckedChange = { on ->
                            if (on) ensureNotifications(app, context) { ok -> if (ok) app.updatePlanner { it.copy(dailySummary = true) } }
                            else app.updatePlanner { it.copy(dailySummary = false) }
                        })
                    }
                }
            }
            if (state.tasks.isEmpty()) {
                item { EmptyView(T("planEmpty"), T("planBody"), Icons.Filled.Schedule) }
            } else {
                val groups = state.tasks.sortedBy { it.date }.groupBy { bucket(it, now) }.toSortedMap(compareBy({ it.first }, { it.second }))
                groups.forEach { (b, list) ->
                    item { SectionTitle(b.second) }
                    items(list.let { if (b.first == 9) it.sortedByDescending { t -> t.date }.take(30) else it }, key = { it.id }) { task -> TaskRow(task) }
                }
            }
            item { Text(T("reminderPrivacy"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item {
                OutlinedButton(onClick = { nav.go("task") }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Add, null); Text(" " + T("add"))
                }
            }
        }
    }
}

@Composable
private fun TaskRow(task: RevisionTask) {
    val app = LocalApp.current
    val nav = LocalNav.current
    val subject = task.subject
    CardBox(onClick = { nav.go("task?id=" + enc(task.id)) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = {
                app.updatePlanner { s -> s.copy(tasks = s.tasks.map { if (it.id == task.id) it.copy(completed = !it.completed) else it }) }
            }) {
                Icon(if (task.completed) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, T("complete"), tint = if (task.completed) Brand.success else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    subject?.title ?: task.title, fontWeight = FontWeight.SemiBold,
                    textDecoration = if (task.completed) TextDecoration.LineThrough else null
                )
                Text(
                    listOfNotNull(task.activity?.title ?: task.title.takeIf { subject != null }, formatDate(task.date, "EEEE HH:mm"), task.durationMinutes?.let { Tf("minutesShort", it) }).joinToString(" · "),
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (task.reminderEnabled && !task.completed) Icon(Icons.Filled.NotificationsActive, null, tint = Brand.amber, modifier = Modifier.size(18.dp))
        }
    }
}

/** توقيت أسبوعي مقترح حسب الشعبة ومعاملاتها، خارج أوقات الدراسة (الجمعة والسبت حصص أطول) */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TimetableScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val context = LocalContext.current
    var stream by remember { mutableStateOf(StudyStream.from(app.planner.streamId) ?: streamFromPlay(app)) }
    var options by remember { mutableStateOf(app.planner.options) }
    var remind by remember { mutableStateOf(true) }
    val preview = Timetable.build(stream, System.currentTimeMillis(), 7, options, remind)

    fun apply(withReminders: Boolean) {
        val now = System.currentTimeMillis()
        val tasks = Timetable.build(stream, now, 7, options, withReminders)
        app.updatePlanner { s ->
            // يحلّ الأسبوع المقترح الجديد محلّ الحصص المقترحة القادمة غير المنجزة
            val kept = s.tasks.filter { !(it.planId?.startsWith("weekly-") == true && !it.completed && it.date > now) }
            s.copy(tasks = (kept + tasks).sortedBy { it.date }.takeLast(300), streamId = stream.id, options = options)
        }
        nav.back()
    }

    Screen(T("timetableTitle")) { padding ->
        RefreshList(padding, false, {}) {
            item { Text(T("timetableIntro"), fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item {
                CardBox {
                    Text(T("timetableStream"), fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        StudyStream.entries.forEach { s -> FilterChip(selected = stream == s, onClick = { stream = s }, label = { Text(s.title) }) }
                    }
                }
            }
            item {
                CardBox {
                    Text(T("timetableWhen"), fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(T("timetableMorning") + " (%02d:%02d)".format(options.morningHour, options.morningMinute), modifier = Modifier.weight(1f), fontSize = 14.sp)
                        Switch(checked = options.morning, onCheckedChange = { options = options.copy(morning = it) })
                    }
                    if (options.morning) {
                        OutlinedButton(onClick = {
                            TimePickerDialog(context, { _, h, m ->
                                if (h < 6) app.notice = T("timetableSleepWarning")
                                options = options.copy(morningHour = h.coerceIn(5, 7), morningMinute = m)
                            }, options.morningHour, options.morningMinute, true).show()
                        }) { Text(T("timetableMorningTime")) }
                    }
                    Text(Tf("timetableEvening", options.eveningSessions), fontSize = 14.sp)
                    Slider(value = options.eveningSessions.toFloat(), onValueChange = { options = options.copy(eveningSessions = it.toInt()) }, valueRange = 1f..4f, steps = 2)
                    Text(Tf("timetableWeekend", options.weekendSessions), fontSize = 14.sp)
                    Slider(value = options.weekendSessions.toFloat(), onValueChange = { options = options.copy(weekendSessions = it.toInt()) }, valueRange = 0f..4f, steps = 3)
                    Text(T("timetableSleep"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(T("timetableRemind"), modifier = Modifier.weight(1f), fontSize = 14.sp)
                        Switch(checked = remind, onCheckedChange = { remind = it })
                    }
                }
            }
            item { SectionTitle(Tf("timetablePreview", preview.size)) }
            items(preview.take(40)) { t ->
                RowItem(t.subject?.title ?: t.title, (t.activity?.title ?: "") + " · " + formatDate(t.date, "EEEE HH:mm") + " · " + Tf("minutesShort", t.durationMinutes ?: 0), Icons.Filled.Schedule, Brand.amber)
            }
            item {
                BigButton(Tf("timetableAdd", preview.size), enabled = preview.isNotEmpty(), color = Brand.amber) {
                    if (remind) ensureNotifications(app, context) { ok -> apply(ok) } else apply(false)
                }
            }
        }
    }
}

/** إضافة حصة أو تعديلها */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TaskEditScreen(id: String?) {
    val app = LocalApp.current
    val nav = LocalNav.current
    val context = LocalContext.current
    val existing = app.planner.tasks.firstOrNull { it.id == id }
    val defaultDate = remember {
        Calendar.getInstance().apply {
            if (get(Calendar.HOUR_OF_DAY) >= 17) add(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 17); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
    var title by remember { mutableStateOf(existing?.title?.takeIf { existing.subject == null } ?: "") }
    var subject by remember { mutableStateOf(existing?.subject) }
    var activity by remember { mutableStateOf(existing?.activity ?: RevisionActivity.REVIEW) }
    var date by remember { mutableLongStateOf(existing?.date ?: defaultDate) }
    var duration by remember { mutableIntStateOf(existing?.durationMinutes ?: 45) }
    var remind by remember { mutableStateOf(existing?.reminderEnabled ?: false) }

    fun save(withReminder: Boolean) {
        val finalTitle = title.trim().ifEmpty { listOfNotNull(activity.title, subject?.title).joinToString(" — ") }.take(200)
        val task = (existing ?: RevisionTask(title = finalTitle, date = date)).copy(
            title = finalTitle, date = date, reminderEnabled = withReminder, subjectId = subject?.id, activityId = activity.id, durationMinutes = duration
        )
        app.updatePlanner { s -> s.copy(tasks = (s.tasks.filter { it.id != task.id } + task).sortedBy { it.date }) }
        nav.back()
    }

    Screen(if (existing == null) T("add") else T("edit")) { padding ->
        RefreshList(padding, false, {}) {
            item {
                OutlinedTextField(title, { title = it }, label = { Text(T("title")) }, placeholder = { Text(T("titleHint")) }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
            item {
                CardBox {
                    Text(T("subject"), fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        RevisionSubject.entries.forEach { s -> FilterChip(selected = subject == s, onClick = { subject = if (subject == s) null else s }, label = { Text(s.title) }) }
                    }
                    if (subject == null) Text(T("planChooseSubject"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                CardBox {
                    Text(T("activity"), fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        RevisionActivity.entries.forEach { a -> FilterChip(selected = activity == a, onClick = { activity = a }, label = { Text(a.title) }) }
                    }
                }
            }
            item {
                CardBox {
                    Text(T("date"), fontWeight = FontWeight.Bold)
                    Text(formatDate(date, "EEEE d MMMM yyyy، HH:mm"), fontSize = 16.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            val c = Calendar.getInstance().apply { timeInMillis = date }
                            DatePickerDialog(context, { _, y, m, d ->
                                date = Calendar.getInstance().apply { timeInMillis = date; set(Calendar.YEAR, y); set(Calendar.MONTH, m); set(Calendar.DAY_OF_MONTH, d) }.timeInMillis
                            }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
                        }) { Text(T("date")) }
                        OutlinedButton(onClick = {
                            val c = Calendar.getInstance().apply { timeInMillis = date }
                            TimePickerDialog(context, { _, h, m ->
                                date = Calendar.getInstance().apply { timeInMillis = date; set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m) }.timeInMillis
                            }, c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE), true).show()
                        }) { Text("⏰ " + formatDate(date, "HH:mm")) }
                    }
                    Text(T("duration") + ": " + Tf("minutesShort", duration), fontSize = 14.sp)
                    Slider(value = duration.toFloat(), onValueChange = { duration = (it / 5).toInt() * 5 }, valueRange = 15f..180f)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(T("reminder"), modifier = Modifier.weight(1f))
                        Switch(checked = remind, onCheckedChange = { remind = it })
                    }
                }
            }
            item {
                BigButton(T("save")) {
                    if (remind) ensureNotifications(app, context) { ok -> save(ok) } else save(false)
                }
            }
            if (existing != null) item {
                OutlinedButton(onClick = {
                    app.updatePlanner { s -> s.copy(tasks = s.tasks.filter { it.id != existing.id }) }
                    nav.back()
                }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Delete, null, tint = Brand.danger); Text(" " + T("delete"), color = Brand.danger)
                }
            }
        }
    }
}

/** الشعبة المقترحة من ملف PLAY المحفوظ (السنة والشعبة التي اختارها التلميذ) */
private fun streamFromPlay(app: AppModel): StudyStream {
    val profile = app.cached("/api/v1/ios/play/subjects")?.first
    val grade = profile.str("gradeCode") ?: ""
    if (grade.endsWith("AM")) return StudyStream.MIDDLE
    return when (profile.str("streamCode")) {
        "SCI", "TC_SCI" -> StudyStream.SCIENCES
        "MATH" -> StudyStream.MATHEMATICS
        "TM" -> StudyStream.TECHNICAL
        "GE" -> StudyStream.MANAGEMENT
        "LANG" -> StudyStream.LANGUAGES
        else -> StudyStream.LITERATURE
    }
}
