package dz.madrasa.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.bool
import dz.madrasa.app.int
import dz.madrasa.app.obj
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.text
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

private fun query(base: String, vararg pairs: Pair<String, String?>): String {
    val q = pairs.filter { !it.second.isNullOrEmpty() }.joinToString("&") { "${it.first}=${enc(it.second!!)}" }
    return if (q.isEmpty()) base else "$base?$q"
}

@Composable
private fun FilterMenu(label: String, all: String, options: List<Pair<String, String>>, selected: String?, onSelect: (String?) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        FilterChip(
            selected = selected != null,
            onClick = { open = true },
            label = { Text(options.firstOrNull { it.first == selected }?.second ?: label, maxLines = 1) },
            leadingIcon = { Icon(Icons.Filled.FilterList, null) }
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text(all, fontWeight = FontWeight.Bold) }, onClick = { onSelect(null); open = false })
            options.forEach { (id, name) -> DropdownMenuItem(text = { Text(name) }, onClick = { onSelect(id); open = false }) }
        }
    }
}

/** بنك البكالوريات السابقة: المواضيع الرسمية وحلولها، بمرشّحات الشعبة والمادة والسنة */
@Composable
fun BacBankScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var stream by remember { mutableStateOf<String?>(null) }
    var subject by remember { mutableStateOf<String?>(null) }
    var year by remember { mutableStateOf<String?>(null) }
    var streamDefaulted by remember { mutableStateOf(false) }
    val path = query("/api/v1/ios/bac", "stream" to stream, "subject" to subject, "year" to year)
    val load = rememberLoad(path)
    val more = remember(path) { mutableStateListOf<JsonObject>() }
    var cursor by remember(path) { mutableStateOf<String?>(null) }
    var loadingMore by remember { mutableStateOf(false) }
    val data = load.value

    LaunchedEffect(data) {
        cursor = data.str("nextCursor")
        // أول فتح: شعبة التلميذ مختارة تلقائيًا إن عرفها الخادم
        if (!streamDefaulted && data != null) {
            streamDefaulted = true
            data.text("myStreamId")?.let { if (stream == null) stream = it }
        }
    }

    Screen(T("bacBank")) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            item {
                CardBox {
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Icon(Icons.Filled.WorkspacePremium, null, tint = Brand.blue)
                        Text("  " + T("bacBankHint"), fontSize = 14.sp)
                    }
                }
            }
            val facets = data.obj("facets")
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterMenu(T("bacStreamLabel"), T("bacAllStreams"), facets.objs("streams").map { (it.str("id") ?: "") to "${it.str("name")} (${it.int("count") ?: 0})" }, stream) { stream = it }
                    FilterMenu(T("bacSubjectLabel"), T("bacAllSubjects"), facets.objs("subjects").map { (it.str("id") ?: "") to "${it.str("name")} (${it.int("count") ?: 0})" }, subject) { subject = it }
                    FilterMenu(T("bacYearLabel"), T("bacAllYears"), facets.objs("years").map { (it.int("year")?.toString() ?: "") to "${it.int("year")} (${it.int("count") ?: 0})" }, year) { year = it }
                }
            }
            if (data != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            val list = data.objs("items") + more
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                list.isEmpty() -> item { EmptyView(T("bacEmpty"), icon = Icons.Filled.WorkspacePremium) }
                else -> {
                    item { Text(Tf("bacCount", data.int("total") ?: list.size), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) }
                    items(list) { b -> BacRow(b) { nav.go("bacpaper/" + enc(b.str("id") ?: "")) } }
                    if (cursor != null) item {
                        OutlinedButton(onClick = {
                            if (loadingMore) return@OutlinedButton
                            loadingMore = true
                            scope.launch {
                                try {
                                    val page = app.fetch(query("/api/v1/ios/bac", "stream" to stream, "subject" to subject, "year" to year, "cursor" to cursor))
                                    more.addAll(page.objs("items"))
                                    cursor = page.str("nextCursor")
                                } catch (e: ApiException) {
                                    app.notice = e.userMessage
                                }
                                loadingMore = false
                            }
                        }, modifier = Modifier.fillMaxWidth()) { Text(if (loadingMore) T("loading") else T("bacMore")) }
                    }
                }
            }
        }
    }
}

@Composable
private fun BacRow(b: JsonObject, open: () -> Unit) {
    CardBox(onClick = open) {
        Text(b.str("title") ?: "", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            b.int("year")?.let { Chip(it.toString(), Brand.navy, Icons.Filled.CalendarMonth) }
            b.int("topic")?.let { Chip(Tf("bacTopic", it), Brand.blue) }
            if (b.bool("official") == true) Chip(T("bacOfficial"), Brand.success, Icons.Filled.Verified)
            if (b.bool("hasSolution") == true) Chip(T("bacSolution"), Brand.success, Icons.Filled.CheckCircle)
        }
        val meta = listOfNotNull(b.text("subjectName"), b.text("streamName")).joinToString(" · ")
        if (meta.isNotEmpty()) Text(meta, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** موضوع (بكالوريا أو فرض): الورقة والحل داخل التطبيق إن كانا على المنصة، ونسخته التفاعلية في PLAY */
@Composable
fun PaperScreen(id: String, bac: Boolean) {
    val nav = LocalNav.current
    val context = LocalContext.current
    val path = (if (bac) "/api/v1/ios/bac/" else "/api/v1/ios/papers/") + enc(id)
    val load = rememberLoad(path)
    val p = load.value
    val scope = rememberCoroutineScope()
    Screen(if (bac) T("bacPaper") else T("testsBank")) { padding ->
        RefreshList(padding, load.loading && p != null, { load.load(path, force = true) }) {
            when {
                p == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                p == null -> item { LoadingView() }
                else -> {
                    item {
                        CardBox {
                            Text(p.str("title") ?: "", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                p.int("year")?.let { Chip(it.toString(), Brand.navy) }
                                p.int("term")?.let { Chip(Tf("termNumber", it), Brand.teal) }
                                if (p.bool("official") == true) Chip(T("bacOfficial"), Brand.success, Icons.Filled.Verified)
                            }
                            val meta = listOfNotNull(p.text("subjectName"), p.text("streamName")).joinToString(" · ")
                            if (meta.isNotEmpty()) Text(meta, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                            p.obj("source").text("name")?.let { Text(Tf("bacSource", it), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    val play = p.obj("play")
                    if (play != null && play.str("id") != null) item {
                        RowItem(T("openInPlay"), play.str("title"), Icons.Filled.SportsEsports, Brand.violet) { nav.go("set/" + enc(play.str("id")!!)) }
                    }
                    item { FileLink(T("bacPaper"), p.obj("paper"), p.str("title") ?: "", "paper:$id") }
                    item {
                        val solution = p.obj("solution")
                        if (solution != null && solution.str("url") != null) FileLink(T("bacSolution"), solution, (p.str("title") ?: "") + " — " + T("bacSolution"), "solution:$id")
                        else CardBox { Text(T("bacNoSolution"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }
        }
    }
}

@Composable
private fun FileLink(label: String, link: JsonObject?, title: String, key: String) {
    val nav = LocalNav.current
    val context = LocalContext.current
    val app = LocalApp.current
    val url = link.str("url")
    val inApp = link.bool("inApp") == true
    when {
        url == null -> CardBox { Text(T("bacFileUnavailable"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
        // ملف على المنصة نفسها (رابط موقّع): يُعرض داخل التطبيق ويُحفظ دون إنترنت
        inApp && url.startsWith("/api/v1/files/") -> {
            val saved = app.downloads.isSaved(key)
            RowItem(label, if (saved) T("savedOffline") else T("lessonShowPDF"), Icons.Filled.Description, if (saved) Brand.success else Brand.teal) {
                nav.go("pdf?key=${enc(key)}&title=${enc(title)}&path=${enc(url)}&save=1")
            }
        }
        url.startsWith("https://") -> RowItem(label, T("bacOpensBrowser"), Icons.AutoMirrored.Filled.OpenInNew, Brand.blue) { openUrl(context, url) }
        else -> CardBox { Text(T("bacFileUnavailable"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

/** بنك الفروض والاختبارات: الفصل ← السنة ← المادة ← المواضيع ونسخها التفاعلية */
@Composable
fun TestsBankScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var term by remember { mutableStateOf<Int?>(null) }
    var level by remember { mutableStateOf<Pair<String, String>?>(null) }
    var subject by remember { mutableStateOf<Pair<String, String>?>(null) }
    val path = query("/api/v1/ios/tests", "term" to term?.toString(), "level" to level?.first, "subject" to subject?.first)
    val load = rememberLoad(path)
    val data = load.value
    val more = remember(path) { mutableStateListOf<JsonObject>() }
    var cursor by remember(path) { mutableStateOf<String?>(null) }
    LaunchedEffect(data) { cursor = data.str("nextCursor") }

    BackHandler(enabled = term != null) {
        when {
            subject != null -> subject = null
            level != null -> level = null
            else -> term = null
        }
    }

    val title = listOfNotNull(T("testsBank"), term?.let { Tf("termNumber", it) }, level?.second, subject?.second).joinToString(" · ")
    Screen(if (term == null) T("testsBank") else title) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            if (data != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                term == null -> {
                    item { Text(T("testsIntro"), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp) }
                    item { SectionTitle(T("chooseTerm")) }
                    val terms = data.objs("terms").ifEmpty { (1..3).map { kotlinx.serialization.json.buildJsonObject { put("term", kotlinx.serialization.json.JsonPrimitive(it)) } } }
                    items(terms) { t ->
                        val n = t.int("term") ?: 1
                        RowItem(T("term$n").takeIf { it != "term$n" } ?: Tf("termNumber", n), t.int("count")?.let { Tf("papersCount", it) } ?: T("testsTermHint"), Icons.Filled.CalendarMonth, Brand.teal) { term = n }
                    }
                }
                level == null -> {
                    item { SectionTitle(T("chooseYear")) }
                    val my = data.str("myLevelId")
                    items(data.objs("levels")) { l ->
                        val id = l.str("id") ?: ""
                        RowItem(
                            l.str("name") ?: "",
                            listOfNotNull(Tf("papersCount", l.int("count") ?: 0), if (id == my) T("yourYear") else null).joinToString(" · "),
                            Icons.Filled.MenuBook, if (id == my) Brand.teal else Brand.navy
                        ) { level = id to (l.str("name") ?: "") }
                    }
                }
                subject == null -> {
                    item { SectionTitle(T("chooseSubject")) }
                    val subjects = data.objs("subjects")
                    if (subjects.isEmpty()) item { EmptyView(T("testsEmpty")) }
                    items(subjects) { s ->
                        RowItem(s.str("name") ?: "", Tf("papersCount", s.int("count") ?: 0), Icons.Filled.Assignment, Brand.blue) {
                            subject = (s.str("id") ?: "") to (s.str("name") ?: "")
                        }
                    }
                }
                else -> {
                    val interactive = data.objs("interactive")
                    if (interactive.isNotEmpty()) {
                        item { SectionTitle(T("interactiveVersions")) }
                        items(interactive) { s ->
                            RowItem(s.str("title") ?: "", listOfNotNull(s.int("year")?.toString(), T("playItHint")).joinToString(" · "), Icons.Filled.SportsEsports, Brand.violet) {
                                nav.go("set/" + enc(s.str("id") ?: ""))
                            }
                        }
                    }
                    val papers = data.objs("papers") + more
                    if (papers.isNotEmpty()) item { SectionTitle(T("papersAndSolutions")) }
                    items(papers) { p ->
                        RowItem(
                            p.str("title") ?: "",
                            listOfNotNull(p.text("typeLabel"), p.int("year")?.toString(), if (p.bool("hasSolution") == true) T("bacSolution") else null).joinToString(" · "),
                            Icons.Filled.Description, Brand.teal
                        ) { nav.go("paper/" + enc(p.str("id") ?: "")) }
                    }
                    if (papers.isEmpty() && interactive.isEmpty()) item { EmptyView(T("testsEmpty")) }
                    if (cursor != null) item {
                        OutlinedButton(onClick = {
                            scope.launch {
                                try {
                                    val page = app.fetch(query("/api/v1/ios/tests", "term" to term?.toString(), "level" to level?.first, "subject" to subject?.first, "cursor" to cursor))
                                    more.addAll(page.objs("papers"))
                                    cursor = page.str("nextCursor")
                                } catch (e: ApiException) {
                                    app.notice = e.userMessage
                                }
                            }
                        }, modifier = Modifier.fillMaxWidth()) { Text(T("bacMore")) }
                    }
                }
            }
        }
    }
}
