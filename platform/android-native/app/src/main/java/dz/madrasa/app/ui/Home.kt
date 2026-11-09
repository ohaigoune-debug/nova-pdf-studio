package dz.madrasa.app.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.text
import java.util.Calendar
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

fun enc(value: String): String = Uri.encode(value)

private const val HOME = "/api/v1/ios/home"

@Composable
fun HomeScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val load = rememberLoad(HOME)

    LaunchedEffect(app.phoneRequired) {
        // حساب جديد: يُفتح تأكيد الهاتف وحده مرة واحدة حين يطلبه الخادم
        if (app.phoneRequired && app.takePhonePrompt()) nav.go("phone")
    }

    Screen(T("appName"), back = false) { padding ->
        RefreshList(padding, load.loading && load.value != null, { load.load(HOME, force = true) }) {
            item { Greeting(app.session?.name) }
            if (load.value != null && (load.savedAt != null || !app.online)) item { OfflineBanner(load.savedAt) }
            if (app.phoneRequired) item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brand.sky.copy(alpha = 0.55f))
                        .clickable { nav.go("phone") }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.PhoneAndroid, null, tint = Brand.blue)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(T("phoneTitle"), fontWeight = FontWeight.Bold, color = Brand.navy)
                        Text(T("phoneBody"), fontSize = 12.sp, color = Brand.navy.copy(alpha = 0.8f))
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, null, tint = Brand.navy)
                }
            }
            item {
                val courses = load.value.objs("courses")
                val active = courses.count { it.str("status") == "ACTIVE" }
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        GradientTile(
                            T("myCourses"), if (active > 0) Tf("coursesActiveCount", active) else T("coursesTileHint"),
                            Icons.Filled.School, listOf(Brand.navy, Brand.navyLight), Modifier.weight(1f)
                        ) { nav.go("courses") }
                        GradientTile(
                            T("bacBankShort"), T("bacTileHint"), Icons.Filled.WorkspacePremium,
                            listOf(Brand.blue, Brand.blueLight), Modifier.weight(1f)
                        ) { nav.go("bac") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        GradientTile(
                            T("testsBank"), T("testsTileHint"), Icons.Filled.Assignment,
                            listOf(Brand.teal, Brand.tealLight), Modifier.weight(1f)
                        ) { nav.go("tests") }
                        GradientTile(
                            T("freeLessons"), T("lessonsTileHint"), Icons.AutoMirrored.Filled.MenuBook,
                            listOf(Brand.green, Brand.greenLight), Modifier.weight(1f)
                        ) { nav.go("free") }
                    }
                }
            }
            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brush.linearGradient(listOf(Brand.violet, Brand.violetLight)))
                        .clickable { nav.go("classroom") }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(50.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color.White.copy(alpha = 0.18f)), contentAlignment = Alignment.Center
                    ) { Icon(Icons.Filled.Forum, null, tint = Color.White) }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(T("generalClassroom"), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(T("generalClassroomHint"), color = Color.White.copy(alpha = 0.88f), fontSize = 12.sp, maxLines = 2)
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, null, tint = Color.White.copy(alpha = 0.8f))
                }
            }
            item { NextTaskCard() }
            if (load.value == null && load.error != null) item { FailureView(load.error!!) { app.scope.launchLoad(load, HOME) } }
        }
    }
}

@Composable
private fun Greeting(name: String?) {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val salute = if (hour in 5..11) T("goodMorning") else T("goodEvening")
    val first = name?.trim()?.split(" ")?.firstOrNull()?.takeIf { it.isNotEmpty() }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(if (first != null) Tf("greeting", salute, first) else salute, fontWeight = FontWeight.Bold, fontSize = 24.sp)
        Text(T("homeIntro"), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
    }
}

@Composable
private fun NextTaskCard() {
    val app = LocalApp.current
    val now = System.currentTimeMillis()
    val next = app.planner.tasks.filter { !it.completed && it.date + (it.durationMinutes ?: 30) * 60_000L > now }.minByOrNull { it.date }
    RowItem(
        title = if (next != null) next.displayTitle else T("plannerInvite"),
        subtitle = if (next != null) T("nextInPlanner") + " · " + formatDate(next.date, "EEEE HH:mm") else T("timetableCardHint"),
        icon = Icons.Filled.CalendarMonth,
        tint = Brand.amber,
        onClick = { app.pendingTab = "planner" }
    )
}

@Composable
fun MyCoursesScreen() {
    val nav = LocalNav.current
    val app = LocalApp.current
    val load = rememberLoad(HOME)
    Screen(T("myCourses")) { padding ->
        RefreshList(padding, load.loading && load.value != null, { load.load(HOME, force = true) }) {
            if (load.value != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            val courses = load.value.objs("courses")
            when {
                load.value == null && load.error != null -> item { FailureView(load.error!!) { app.scope.launchLoad(load, HOME) } }
                load.value == null -> item { LoadingView() }
                courses.isEmpty() -> item { EmptyView(T("noCourses"), icon = Icons.Filled.School) }
                else -> items(courses) { c ->
                    val ended = c.str("status") == "ENDED"
                    val ends = parseIso(c.str("accessEndsOn"))
                    val subtitle = listOfNotNull(
                        c.text("teacherName"), c.text("season"),
                        if (ended) T("courseEnded") else ends?.let { Tf("accessEnds", formatDate(it, "d MMMM yyyy")) }
                    ).joinToString(" · ")
                    RowItem(c.str("title") ?: "", subtitle, Icons.Filled.School, if (ended) Color.Gray else Brand.navy) {
                        nav.go("course/" + enc(c.str("slug") ?: ""))
                    }
                }
            }
        }
    }
}

fun CoroutineScope.launchLoad(load: Loaded, path: String) {
    launch { load.load(path, force = true) }
}

@Composable
fun FreeLessonsScreen() {
    val nav = LocalNav.current
    val app = LocalApp.current
    val load = rememberLoad(HOME)
    Screen(T("freeLessons")) { padding ->
        RefreshList(padding, load.loading && load.value != null, { load.load(HOME, force = true) }) {
            if (load.value != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            val entries = load.value.objs("freeLessons")
            when {
                load.value == null && load.error != null -> item { FailureView(load.error!!) { app.scope.launchLoad(load, HOME) } }
                load.value == null -> item { LoadingView() }
                entries.isEmpty() -> item { EmptyView(T("noFreeLessons")) }
                else -> entries.forEach { e ->
                    if (e.str("kind") == "group") {
                        item { SectionTitle(e.str("heading") ?: "") }
                        e.text("detail")?.let { d -> item { Text(d, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) } }
                        items(e.objs("items")) { l -> LessonLinkRow(l.str("slug") ?: "", l.str("label") ?: "", l.text("summary"), l.str("type")) { nav.go("lesson/" + enc(it)) } }
                    } else {
                        item { LessonLinkRow(e.str("slug") ?: "", e.str("label") ?: "", e.text("summary"), e.str("type")) { nav.go("lesson/" + enc(it)) } }
                    }
                }
            }
        }
    }
}

@Composable
fun LessonLinkRow(slug: String, title: String, summary: String?, type: String?, open: (String) -> Unit) {
    RowItem(title, summary ?: type?.let { T("type.$it") }, iconFor(type), colorFor(type)) { open(slug) }
}

fun iconFor(type: String?) = when (type) {
    "VIDEO" -> Icons.Filled.PlayCircle
    "PDF" -> Icons.Filled.Description
    "QUIZ", "EXERCISE" -> Icons.Filled.Assignment
    else -> Icons.AutoMirrored.Filled.MenuBook
}

fun colorFor(type: String?) = when (type) {
    "VIDEO" -> Brand.danger
    "PDF" -> Brand.teal
    "QUIZ", "EXERCISE" -> Brand.amber
    else -> Brand.blue
}
