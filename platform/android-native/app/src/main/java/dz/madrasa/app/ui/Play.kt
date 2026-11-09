package dz.madrasa.app.ui

import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.AppModel
import dz.madrasa.app.Excerpt
import dz.madrasa.app.PlayAttempt
import dz.madrasa.app.PlayGrading
import dz.madrasa.app.PlayMedia
import dz.madrasa.app.PlayPackage
import dz.madrasa.app.PlayStep
import dz.madrasa.app.Score
import dz.madrasa.app.SourceQuestion
import dz.madrasa.app.StepAnswer
import dz.madrasa.app.StepPayload
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.bool
import dz.madrasa.app.dbl
import dz.madrasa.app.int
import dz.madrasa.app.obj
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.text
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.Locale
import kotlin.math.roundToInt

fun scoreText(v: Double): String =
    if (v == Math.floor(v)) v.toLong().toString() else String.format(Locale.ROOT, "%.2f", v).trimEnd('0').trimEnd('.')

fun kindName(kind: String): String = when (kind) {
    "BAC" -> T("kindBac")
    "DEVOIR" -> T("kindDevoir")
    else -> T("kindTest")
}

fun hexColor(hex: String?, fallback: Color = Brand.blue): Color {
    if (hex == null || !hex.startsWith("#") || hex.length != 7) return fallback
    return try {
        Color(android.graphics.Color.parseColor(hex))
    } catch (e: Exception) {
        fallback
    }
}

// ── صور PLAY (البورتريه، وثائق السؤال) ──

private val imageCache = LruCache<String, ImageBitmap>(40)

@Composable
fun RemoteImage(path: String, description: String, modifier: Modifier = Modifier) {
    val app = LocalApp.current
    var bitmap by remember(path) { mutableStateOf(imageCache.get(path)) }
    LaunchedEffect(path) {
        if (bitmap != null) return@LaunchedEffect
        try {
            val bytes = app.api.bytes(path, accept = "image/*")
            val b = withContext(Dispatchers.Default) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }
            if (b != null) {
                imageCache.put(path, b)
                bitmap = b
            }
        } catch (e: Exception) {
        }
    }
    val b = bitmap
    if (b != null) Image(b, description, modifier = modifier, contentScale = ContentScale.Fit)
    else Box(
        modifier
            .heightIn(min = 120.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant)
    )
}

// ── الصفحة الرئيسية لـ PLAY ──

private const val SUBJECTS = "/api/v1/ios/play/subjects"

@Composable
fun PlayHomeScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val load = rememberLoad(SUBJECTS)
    val data = load.value
    val play = app.play

    Screen(T("playTitle"), back = false) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(SUBJECTS, force = true); play.sync() }) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brush.linearGradient(listOf(Brand.blue, Brand.navy)))
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(T("playHeadline"), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    Text(T("playOffline"), color = Color.White.copy(alpha = 0.88f), fontSize = 14.sp)
                }
            }
            if (data != null && (load.savedAt != null || !app.online)) item { OfflineBanner(load.savedAt) }
            if (play.pendingCount > 0) item {
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.CloudUpload, null, tint = Brand.amber)
                        Spacer(Modifier.width(8.dp))
                        Text(Tf("pendingSync", play.pendingCount), fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        if (play.syncing) androidx.compose.material3.CircularProgressIndicator(Modifier.size(22.dp))
                        else TextButton(onClick = { scope.launch { play.sync() } }, enabled = app.online) { Text(T("syncNow")) }
                    }
                }
            }
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(SUBJECTS, true) } } }
                data == null -> item { LoadingView() }
                data.str("gradeCode") == null -> item { ProfilePicker(data) { scope.launch { load.load(SUBJECTS, true) } } }
                else -> {
                    val subjects = data.objs("subjects")
                    if (subjects.isEmpty()) item { EmptyView(T("playNoSubjects")) }
                    else {
                        item { SectionTitle(T("playSubjects")) }
                        subjects.chunked(2).forEach { pair ->
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    pair.forEach { s -> SubjectTile(s, Modifier.weight(1f)) }
                                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
            val downloaded = play.index.downloaded
            if (downloaded.isNotEmpty()) {
                item { SectionTitle(T("savedSets")) }
                items(downloaded) { s ->
                    RowItem(
                        s.title, kindName(s.kind) + (s.year?.let { " · $it" } ?: ""), Icons.Filled.DownloadDone, Brand.success,
                        trailing = { IconButton(onClick = { play.removeSet(s.id) }) { Icon(Icons.Filled.Delete, T("delete"), tint = MaterialTheme.colorScheme.onSurfaceVariant) } }
                    ) { nav.go("set/" + enc(s.id)) }
                }
            }
            val attempts = play.index.attempts.take(8)
            if (attempts.isNotEmpty()) {
                item { SectionTitle(T("myResults")) }
                items(attempts) { a -> AttemptRow(a) }
            }
        }
    }
}

@Composable
private fun SubjectTile(s: JsonObject, modifier: Modifier) {
    val nav = LocalNav.current
    val tint = hexColor(s.str("color"))
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .clickable { nav.go("subject/" + enc(s.str("code") ?: "") + "?name=" + enc(s.str("nameAr") ?: "") + "&lang=" + enc(s.str("language") ?: "ar")) },
        color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(20.dp), shadowElevation = 1.dp
    ) {
        Column(
            Modifier
                .padding(14.dp)
                .heightIn(min = 90.dp), verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(tint), contentAlignment = Alignment.Center
            ) { Icon(Icons.Filled.MenuBook, null, tint = Color.White) }
            Text(s.str("nameAr") ?: s.str("code") ?: "", fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 2)
        }
    }
}

@Composable
fun AttemptRow(a: PlayAttempt) {
    val score = if (a.serverScore != null) Score(a.serverScore, a.serverMax ?: a.max) else Score(a.score, a.max)
    CardBox {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(a.title, fontWeight = FontWeight.SemiBold, maxLines = 2, fontSize = 14.sp)
                Text(formatDate(a.finishedAt), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text("${scoreText(score.score)} / ${scoreText(score.max)}", fontWeight = FontWeight.Bold)
                }
                Text(
                    if (a.pending) T("notSynced") else if (a.rejected) T("syncRefused") else T("synced"),
                    fontSize = 11.sp, color = if (a.pending) Brand.amber else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/** أول مرة: يختار التلميذ سنته (وشعبته) في PLAY مرة واحدة، كما في الموقع */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProfilePicker(data: JsonObject, saved: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val grades = data.objs("grades")
    var grade by remember { mutableStateOf<JsonObject?>(null) }
    var stream by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    CardBox {
        Text(T("playChooseYear"), fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Text(T("playChooseYearBody"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (grades.isEmpty()) Text(T("termsUpdateServer"), fontSize = 13.sp)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            grades.forEach { g ->
                FilterChip(selected = grade?.str("code") == g.str("code"), onClick = { grade = g; stream = null }, label = { Text(g.str("nameAr") ?: "") })
            }
        }
        val streams = grade.objs("streams")
        if (streams.isNotEmpty()) {
            Text(T("playStream"), fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                streams.forEach { s -> FilterChip(selected = stream == s.str("code"), onClick = { stream = s.str("code") }, label = { Text(s.str("nameAr") ?: "") }) }
            }
        }
        if (error != null) Text(error!!, color = Brand.danger, fontSize = 13.sp)
        BigButton(if (working) T("loading") else T("save"), enabled = !working && grade != null && (streams.isEmpty() || stream != null)) {
            working = true
            scope.launch {
                try {
                    app.post("/api/v1/ios/play/profile", buildJsonObject {
                        put("gradeCode", grade.str("code") ?: "")
                        if (stream != null) put("streamCode", stream) else put("streamCode", JsonNull)
                    })
                    saved()
                } catch (e: ApiException) {
                    error = e.userMessage
                }
                working = false
            }
        }
    }
}

// ── مادة: الأقسام الأربعة (الدروس بالبطاقات، البكالوريات، الفروض، الاختبارات) ──

@Composable
fun SubjectScreen(code: String, name: String, lang: String) {
    val nav = LocalNav.current
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf("LESSONS") }
    val path = if (mode == "LESSONS") "/api/v1/ios/play/lessons?subject=${enc(code)}" else "/api/v1/ios/play/sets?subject=${enc(code)}&kind=$mode"
    val load = rememberLoad(path)
    val data = load.value

    Screen(name.ifEmpty { code }) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            item {
                val modes = listOf("LESSONS" to T("kindLessons"), "BAC" to T("kindBac"), "DEVOIR" to T("kindDevoir"), "TEST" to T("kindTest"))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    modes.forEachIndexed { i, (k, label) ->
                        SegmentedButton(
                            selected = mode == k, onClick = { mode = k },
                            shape = SegmentedButtonDefaults.itemShape(i, modes.size),
                            icon = {}
                        ) { Text(label, fontSize = 12.sp, maxLines = 1, softWrap = false) }
                    }
                }
            }
            if (data != null && (load.savedAt != null || !app.online)) item { OfflineBanner(load.savedAt) }
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                mode == "LESSONS" -> {
                    val stats = data.obj("stats")
                    if (stats != null) item {
                        CardBox {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Star, null, tint = Brand.amber)
                                Spacer(Modifier.width(6.dp))
                                Text(Tf("xpTotalLevel", stats.int("xpTotal") ?: 0, stats.obj("level").str("title") ?: ""), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                if ((stats.int("streakDays") ?: 0) > 0) Chip(Tf("streakDays", stats.int("streakDays") ?: 0), Brand.danger, Icons.Filled.LocalFireDepartment)
                            }
                            val pct = stats.obj("level").int("progressPct") ?: 0
                            LinearProgressIndicator(progress = { pct / 100f }, modifier = Modifier.fillMaxWidth(), color = Brand.amber)
                        }
                    }
                    val units = data.objs("units")
                    if (units.isEmpty()) item { EmptyView(T("playNoLessons")) }
                    units.forEach { u ->
                        item { SectionTitle(u.str("unitName") ?: "") }
                        items(u.objs("lessons")) { l -> CardLessonRow(l) }
                    }
                }
                else -> {
                    val sets = data.objs("items")
                    if (sets.isEmpty()) item { EmptyView(T("playNoSets")) }
                    items(sets) { s -> SetRow(s) { nav.go("set/" + enc(s.str("id") ?: "")) } }
                }
            }
        }
    }
}

@Composable
private fun CardLessonRow(l: JsonObject) {
    val nav = LocalNav.current
    val questions = l.int("questions") ?: 0
    val mastery = l.int("masteryPct") ?: 0
    CardBox(onClick = if (questions > 0) ({ nav.go("cardlesson/" + enc(l.str("id") ?: "")) }) else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(l.str("lessonName") ?: "", fontWeight = FontWeight.SemiBold)
                l.text("objective")?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2) }
                Text(if (questions > 0) Tf("stepsCount", questions) else T("playNoCards"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (l.bool("mastered") == true) Icon(Icons.Filled.EmojiEvents, null, tint = Brand.amber)
            else if (questions > 0) Icon(Icons.Filled.SportsEsports, null, tint = Brand.blue)
        }
        if (questions > 0) LinearProgressIndicator(progress = { mastery / 100f }, modifier = Modifier.fillMaxWidth(), color = Brand.success)
    }
}

@Composable
private fun SetRow(s: JsonObject, open: () -> Unit) {
    val app = LocalApp.current
    val saved = app.play.index.downloaded.any { it.id == s.str("id") }
    CardBox(onClick = open) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(s.str("title") ?: "", fontWeight = FontWeight.SemiBold)
                Text(
                    listOfNotNull(s.int("year")?.toString(), s.int("term")?.let { Tf("termNumber", it) }, Tf("stepsCount", s.int("stepCount") ?: 0)).joinToString(" · "),
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            s.obj("best")?.let { b ->
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Chip("${scoreText(b.dbl("score") ?: 0.0)}/${scoreText(b.dbl("max") ?: 0.0)}", Brand.blue)
                }
            }
            if (saved) Icon(Icons.Filled.DownloadDone, T("savedOffline"), tint = Brand.success, modifier = Modifier.padding(start = 6.dp))
        }
    }
}


// ── موضوع: التحميل (أو النسخة المحفوظة) ثم البدء ──

@Composable
fun SetScreen(id: String) {
    val app = LocalApp.current
    val nav = LocalNav.current
    var pkg by remember { mutableStateOf<PlayPackage?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }
    LaunchedEffect(retry) {
        error = null
        try {
            pkg = app.play.openSet(id)
        } catch (e: ApiException) {
            error = if (e.kind == ApiException.Kind.OFFLINE) T("setNeedsInternet") else e.userMessage
        }
    }
    val p = pkg
    Screen(p?.title ?: T("playTitle")) { padding ->
        RefreshList(padding, false, { retry++ }) {
            when {
                error != null -> item { FailureView(error!!) { retry++ } }
                p == null -> item { LoadingView(T("preparingSet")) }
                else -> {
                    item {
                        CardBox {
                            Text(p.title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Chip(kindName(p.kind), Brand.violet)
                                p.year?.let { Chip(it.toString(), Brand.navy) }
                                Chip(Tf("stepsCount", p.steps.size), Brand.blue)
                            }
                            Text(T("playItHint"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.DownloadDone, null, tint = Brand.success, modifier = Modifier.size(18.dp))
                                Text("  " + T("savedOffline"), fontSize = 12.sp, color = Brand.success)
                            }
                        }
                    }
                    item {
                        if (p.steps.isEmpty()) EmptyView(T("playNoSteps"))
                        else BigButton(T("startSet"), color = Brand.violet) { nav.go("run/" + enc(p.id)) }
                    }
                    val attempts = app.play.attempts(p.id)
                    if (attempts.isNotEmpty()) {
                        item { SectionTitle(T("myResults")) }
                        items(attempts.take(10)) { AttemptRow(it) }
                    }
                }
            }
        }
    }
}

// ── المشغّل: سؤال بعد سؤال، يُصحَّح على الهاتف ──

/** مسودة إجابة سؤال قبل التحقق */
private class Draft {
    var choice by mutableStateOf<Int?>(null)
    val choices = mutableStateMapOf<Int, Boolean>()
    val blanks = mutableStateMapOf<Int, String>()
    var order by mutableStateOf<List<Int>>(emptyList())
    val pairs = mutableStateMapOf<Int, Int>()
    var text by mutableStateOf("")

    fun answer(step: PlayStep): StepAnswer? = when (val p = step.payload) {
        is StepPayload.Mcq -> choice?.let { StepAnswer.Mcq(it) }
        is StepPayload.Portrait -> choice?.let { StepAnswer.Portrait(it) }
        is StepPayload.Multi -> choices.filterValues { it }.keys.sorted().takeIf { it.isNotEmpty() }?.let { StepAnswer.Multi(it) }
        is StepPayload.Fill -> (0 until step.blankCount).map { blanks[it] ?: "" }.takeIf { l -> l.any { it.isNotEmpty() } }?.let { StepAnswer.Fill(it) }
        is StepPayload.Ordering -> order.takeIf { it.size == p.items.size }?.let { StepAnswer.Ordering(it) }
        is StepPayload.Matching -> if (pairs.size == p.lefts.size) StepAnswer.Matching((p.lefts.indices).map { pairs[it] ?: -1 }) else null
        is StepPayload.Numeric -> text.trim().replace(',', '.').replace('٫', '.').toDoubleOrNull()?.let { StepAnswer.Numeric(it) }
        StepPayload.ShortText -> text.trim().takeIf { it.isNotEmpty() }?.let { StepAnswer.ShortText(it) }
    }
}

@Composable
fun RunnerScreen(id: String) {
    val app = LocalApp.current
    val nav = LocalNav.current
    var pkg by remember { mutableStateOf<PlayPackage?>(app.play.savedPackage(id)) }
    var error by remember { mutableStateOf<String?>(null) }
    var round by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        if (pkg == null) try {
            pkg = app.play.openSet(id)
        } catch (e: ApiException) {
            error = e.userMessage
        }
    }
    val p = pkg
    Surface(Modifier.fillMaxSize().statusBarsPadding(), color = MaterialTheme.colorScheme.background) {
        when {
            error != null -> Column(Modifier.padding(16.dp)) { FailureView(error!!) { nav.back() } }
            p == null -> LoadingView(T("preparingSet"))
            else -> androidx.compose.runtime.key(round) { ExamRunner(p, onClose = { nav.back() }, restart = { round++ }) }
        }
    }
}

@Composable
private fun ExamRunner(pkg: PlayPackage, onClose: () -> Unit, restart: () -> Unit) {
    val app = LocalApp.current
    var index by remember { mutableIntStateOf(0) }
    val answers = remember { mutableStateMapOf<String, StepAnswer>() }
    val checked = remember { mutableStateMapOf<String, Double>() }
    var finished by remember { mutableStateOf<PlayAttempt?>(null) }

    val done = finished
    if (done != null) {
        val live = app.play.index.attempts.firstOrNull { it.id == done.id } ?: done
        ResultView(pkg, live, onClose, restart)
        return
    }
    if (pkg.steps.isEmpty()) {
        EmptyView(T("playNoSteps"))
        return
    }
    val step = pkg.steps[index.coerceAtMost(pkg.steps.size - 1)]
    val draft = remember(step.id) { Draft() }
    val grade = checked[step.id]

    fun advance() {
        if (index + 1 < pkg.steps.size) index++
        else finished = app.play.finish(pkg, answers.toMap())
    }

    Column(
        Modifier
            .fillMaxSize()
            .navigationBarsPadding()
    ) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.Filled.Close, T("close")) }
            LinearProgressIndicator(
                progress = { (index + if (grade != null) 1 else 0).toFloat() / pkg.steps.size },
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp), color = Brand.blue
            )
            Text("${index + 1}/${pkg.steps.size}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row {
                Text(Tf("stepOf", index + 1, pkg.steps.size), color = Brand.blue, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text(Tf("pointsShort", scoreText(step.points)), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            step.rubricLabel?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            CompositionLocalProvider(LocalLayoutDirection provides if (pkg.isLeftToRight) LayoutDirection.Ltr else LayoutDirection.Rtl) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(step.prompt, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 28.sp)
                    step.excerpt?.let { ExcerptView(it) }
                    step.source?.takeIf { it.text.isNotEmpty() || it.documents.isNotEmpty() }?.let { SourceBox(it) }
                    StepInteraction(step, draft, locked = grade != null)
                }
            }
            if (grade != null) FeedbackView(step.correctText, step.explanation, grade)
        }
        Row(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (grade == null) {
                OutlinedButton(onClick = { advance() }, modifier = Modifier.heightIn(min = 50.dp).widthIn(min = 96.dp)) { Text(T("skip"), maxLines = 1, softWrap = false) }
                Button(
                    onClick = {
                        val a = draft.answer(step) ?: return@Button
                        answers[step.id] = a
                        checked[step.id] = PlayGrading.grade(step, a)
                    },
                    enabled = draft.answer(step) != null,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 50.dp),
                    shape = RoundedCornerShape(14.dp)
                ) { Text(T("check"), fontWeight = FontWeight.Bold) }
            } else {
                Button(
                    onClick = { advance() }, modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 50.dp), shape = RoundedCornerShape(14.dp)
                ) { Text(if (index + 1 < pkg.steps.size) T("next") else T("finish"), fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun ExcerptView(e: Excerpt) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.sky.copy(alpha = 0.45f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        when (e) {
            is Excerpt.Verses -> e.rows.forEach { v ->
                Row(verticalAlignment = Alignment.Top) {
                    if (v.number.isNotEmpty()) Text(v.number, color = Brand.blue, fontSize = 12.sp, modifier = Modifier.width(22.dp))
                    Text(v.first, modifier = Modifier.weight(1f), textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold, color = Brand.navy)
                    Text(v.second, modifier = Modifier.weight(1f), textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold, color = Brand.navy)
                }
            }
            is Excerpt.Prose -> e.parts.forEach { Text(it, color = Brand.navy, lineHeight = 24.sp) }
        }
    }
}

@Composable
private fun SourceBox(s: SourceQuestion) {
    var open by remember(s) { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .clickable { open = !open }
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(T("originalQuestion") + (if (open) "  ▲" else "  ▼"), fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Brand.blue)
        if (open) {
            if (s.text.isNotEmpty()) Text(listOf(s.number, s.part).filter { it.isNotEmpty() }.joinToString(" ") + " " + s.text, fontSize = 14.sp)
            s.documents.forEach { d ->
                if (d.caption.isNotEmpty()) Text(d.caption, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                d.text?.let { Text(it, fontSize = 13.sp) }
                d.table.forEach { row -> Text(row.joinToString("  |  "), fontSize = 12.sp) }
                d.media?.let { m -> RemoteImage(m.localPath, m.alt, Modifier.fillMaxWidth()) }
            }
        }
    }
}

@Composable
private fun OptionButton(text: String, selected: Boolean, locked: Boolean, state: Boolean?, onClick: () -> Unit) {
    val border = when (state) {
        true -> Brand.success
        false -> Brand.danger
        null -> if (selected) Brand.blue else MaterialTheme.colorScheme.outline
    }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(if (selected || state != null) 2.dp else 1.dp, border, RoundedCornerShape(14.dp))
            .background(if (selected) Brand.blue.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface)
            .clickable(enabled = !locked) { onClick() }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text, modifier = Modifier.weight(1f), fontSize = 16.sp)
        if (state == true) Icon(Icons.Filled.CheckCircle, null, tint = Brand.success)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepInteraction(step: PlayStep, d: Draft, locked: Boolean) {
    val key = step.key
    when (val p = step.payload) {
        is StepPayload.Mcq, is StepPayload.Portrait -> {
            val options = if (p is StepPayload.Mcq) p.options else (p as StepPayload.Portrait).options
            if (p is StepPayload.Portrait) RemoteImage(p.media.localPath, p.media.alt, Modifier.fillMaxWidth().heightIn(max = 260.dp))
            val correct = when (key) {
                is dz.madrasa.app.StepKey.Mcq -> key.correct
                is dz.madrasa.app.StepKey.Portrait -> key.correct
                else -> -1
            }
            options.forEachIndexed { i, o ->
                OptionButton(o, d.choice == i, locked, if (locked) (if (i == correct) true else if (d.choice == i) false else null) else null) { d.choice = i }
            }
        }
        is StepPayload.Multi -> {
            Text(T("chooseAll"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val correct = (key as? dz.madrasa.app.StepKey.Multi)?.correct?.toSet() ?: emptySet()
            p.options.forEachIndexed { i, o ->
                val sel = d.choices[i] == true
                OptionButton(o, sel, locked, if (locked) (if (i in correct) true else if (sel) false else null) else null) { d.choices[i] = !sel }
            }
        }
        is StepPayload.Fill -> {
            val parts = p.text.split("____")
            Text(
                parts.mapIndexed { i, s -> if (i < parts.size - 1) s + "【" + (d.blanks[i]?.ifEmpty { null } ?: "  ${i + 1}  ") + "】" else s }.joinToString(""),
                fontSize = 17.sp, lineHeight = 30.sp
            )
            var active by remember(step.id) { mutableIntStateOf(0) }
            for (i in 0 until step.blankCount) {
                Text(Tf("blankNumber", i + 1), fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = if (active == i) Brand.blue else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable(enabled = !locked) { active = i })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    p.bank.forEach { w ->
                        FilterChip(
                            selected = d.blanks[i] == w, enabled = !locked,
                            onClick = { d.blanks[i] = if (d.blanks[i] == w) "" else w; active = minOf(i + 1, step.blankCount - 1) },
                            label = { Text(w) }
                        )
                    }
                }
            }
        }
        is StepPayload.Ordering -> {
            Text(T("tryOrder"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            d.order.forEachIndexed { pos, item ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Brand.blue), contentAlignment = Alignment.Center
                    ) { Text("${pos + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                    Spacer(Modifier.width(8.dp))
                    Text(p.items.getOrElse(item) { "" }, fontSize = 15.sp)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                p.items.forEachIndexed { i, item ->
                    if (i !in d.order) FilterChip(selected = false, enabled = !locked, onClick = { d.order = d.order + i }, label = { Text(item) })
                }
            }
            if (!locked && d.order.isNotEmpty()) TextButton(onClick = { d.order = emptyList() }) {
                Icon(Icons.Filled.Refresh, null); Text(" " + T("reset"))
            }
        }
        is StepPayload.Matching -> {
            Text(T("chooseMatch"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val correct = (key as? dz.madrasa.app.StepKey.Matching)?.pairs ?: emptyList()
            p.lefts.forEachIndexed { li, left ->
                CardBox {
                    Text(left, fontWeight = FontWeight.SemiBold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        p.rights.forEachIndexed { ri, right ->
                            FilterChip(selected = d.pairs[li] == ri, enabled = !locked, onClick = { d.pairs[li] = ri }, label = { Text(right) })
                        }
                    }
                    if (locked && correct.getOrNull(li) != null && correct[li] != d.pairs[li]) {
                        Text("✓ " + p.rights.getOrElse(correct[li]) { "" }, color = Brand.success, fontSize = 13.sp)
                    }
                }
            }
        }
        is StepPayload.Numeric -> OutlinedTextField(
            d.text, { d.text = it }, enabled = !locked, singleLine = true,
            label = { Text(T("numericHint") + (p.unit?.let { " ($it)" } ?: "")) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth()
        )
        StepPayload.ShortText -> OutlinedTextField(d.text, { d.text = it }, enabled = !locked, label = { Text(T("shortHint")) }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
fun FeedbackView(correctText: String, explanation: String, grade: Double) {
    val color = if (grade >= 1) Brand.success else if (grade > 0) Brand.amber else Brand.danger
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            if (grade >= 1) T("correct") else if (grade > 0) Tf("partial", (grade * 100).roundToInt()) else T("wrong"),
            color = color, fontWeight = FontWeight.Bold, fontSize = 16.sp
        )
        if (grade < 1 && correctText.isNotEmpty()) Text(T("rightAnswer") + ": " + correctText, fontSize = 14.sp)
        if (explanation.isNotEmpty()) Text(explanation, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun ResultView(pkg: PlayPackage, attempt: PlayAttempt, onClose: () -> Unit, restart: () -> Unit) {
    val score = if (attempt.serverScore != null) Score(attempt.serverScore, attempt.serverMax ?: attempt.max) else Score(attempt.score, attempt.max)
    val scaled = PlayGrading.scaled(score, pkg.scoreTotal)
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.size(24.dp))
        Icon(Icons.Filled.EmojiEvents, null, tint = Brand.amber, modifier = Modifier.size(72.dp))
        Text(T("setDone"), fontWeight = FontWeight.Bold, fontSize = 24.sp)
        Text(pkg.title, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text("${scoreText(score.score)} / ${scoreText(score.max)}", fontWeight = FontWeight.Bold, fontSize = 40.sp, color = Brand.blue)
        }
        Text(Tf("scaledScore", scoreText(scaled), scoreText(pkg.scoreTotal)), textAlign = TextAlign.Center)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (attempt.pending) Icons.Filled.CloudUpload else Icons.Filled.CloudDone, null, tint = if (attempt.pending) Brand.amber else Brand.success)
            Text("  " + if (attempt.pending) T("resultPending") else if (attempt.rejected) T("syncRefused") else T("resultSynced"), fontSize = 13.sp)
        }
        BigButton(T("tryAgain"), color = Brand.violet) { restart() }
        OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(T("close")) }
    }
}

@Suppress("unused")
private fun mediaPath(app: AppModel, m: PlayMedia) = app.api.absolute(m.localPath)
