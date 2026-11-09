package dz.madrasa.app.ui

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color as AColor
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DownloadForOffline
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import dz.madrasa.app.ApiException
import dz.madrasa.app.Heartbeat
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.bool
import dz.madrasa.app.int
import dz.madrasa.app.obj
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.strs
import dz.madrasa.app.text
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.random.Random

private val SECTION_ORDER = listOf("lessons", "videos", "homework", "tests", "files")

@Composable
fun CourseScreen(slug: String) {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val path = "/api/v1/ios/courses/" + enc(slug)
    val load = rememberLoad(path)
    val data = load.value
    val course = data.obj("course")
    var accepting by remember { mutableStateOf(false) }

    Screen(course.str("title") ?: T("myCourses")) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            if (data != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            when {
                data == null && load.error != null -> item {
                    EmptyView(T("courseMissingTitle"), load.error, Icons.Filled.School)
                    FailureView(load.error!!) { scope.launch { load.load(path, force = true) } }
                }
                data == null -> item { LoadingView() }
                else -> {
                    item {
                        CardBox {
                            Text(course.str("title") ?: "", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            val meta = listOfNotNull(course.text("teacherName"), course.text("season")).joinToString(" · ")
                            if (meta.isNotEmpty()) Text(meta, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                            parseIso(course.str("accessEndsOn"))?.let { Chip(Tf("accessEnds", formatDate(it, "d MMMM yyyy")), Brand.success, Icons.Filled.Event) }
                            course.text("description")?.let { Text(it, fontSize = 14.sp) }
                        }
                    }
                    val groupId = course.text("groupId")
                    if (groupId != null) item {
                        RowItem(T("classroom"), T("classroomHint"), Icons.Filled.Forum, Brand.violet) { nav.go("classroom?group=" + enc(groupId)) }
                    }
                    val upcoming = data.objs("upcoming")
                    if (upcoming.isNotEmpty()) {
                        item { SectionTitle(T("upcomingTitle")) }
                        items(upcoming) { u ->
                            val at = parseIso(u.str("startsAt"))
                            RowItem(
                                u.str("title") ?: "",
                                listOfNotNull(at?.let { formatDate(it, "EEEE d MMMM، HH:mm") }, u.int("durationMinutes")?.let { Tf("minutesShort", it) }).joinToString(" · "),
                                Icons.Filled.Event, Brand.amber
                            )
                        }
                    }
                    if (data.bool("needsTerms") == true) {
                        item {
                            val terms = data.obj("terms")
                            CardBox {
                                Text(T("termsTitle"), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                Text(T("termsBody"), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                                terms.text("text")?.let { MarkdownText(it) }
                                if (terms != null) BigButton(if (accepting) T("loading") else T("termsAccept"), enabled = !accepting) {
                                    accepting = true
                                    scope.launch {
                                        try {
                                            app.post(path + "/terms", buildJsonObject { put("version", terms.int("version") ?: 0) })
                                            load.load(path, force = true)
                                        } catch (e: ApiException) {
                                            app.notice = e.userMessage
                                        }
                                        accepting = false
                                    }
                                }
                                else Text(T("termsUpdateServer"), fontSize = 13.sp)
                            }
                        }
                    } else {
                        val sections = data.objs("sections").groupBy { s -> s.str("id")?.takeIf { it in SECTION_ORDER } ?: "files" }
                        val ordered = SECTION_ORDER.mapNotNull { id -> sections[id]?.flatMap { it.objs("items") }?.takeIf { it.isNotEmpty() }?.let { id to it } }
                        if (ordered.isEmpty()) item { EmptyView(T("courseEmpty")) }
                        ordered.forEach { (id, list) ->
                            item { SectionTitle(T("section.$id")) }
                            items(list) { it -> CourseItemRow(it) { nav.go("lesson/" + enc(it)) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseItemRow(item: JsonObject, open: (String) -> Unit) {
    val type = item.str("type")
    val session = item.int("session")
    RowItem(
        title = item.text("displayTitle") ?: item.str("title") ?: "",
        subtitle = listOfNotNull(session?.let { Tf("sessionNumber", it) }, type?.let { T("type.$it") }).joinToString(" · "),
        icon = iconFor(type),
        tint = colorFor(type)
    ) { open(item.str("slug") ?: "") }
}

/** جزء من الدرس: فيديو يوتيوب، فيديو Bunny، ملف PDF، رابط، أو ما لا يُعرض في التطبيق */
private sealed class Part {
    data class YouTube(val id: String, val contentId: String?) : Part()
    data class Video(val contentId: String?, val provider: String?) : Part()
    data class Pdf(val contentId: String, val allowDownload: Boolean) : Part()
    data class Link(val url: String) : Part()
    data object External : Part()
    data object None : Part()
}

private val YT_ID = Regex("^[A-Za-z0-9_-]{11}$")
private val UUID_RE = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

private fun part(m: JsonObject?): Part {
    val kind = m.str("kind") ?: return Part.External
    val content = m.str("contentId")?.takeIf { UUID_RE.matches(it) }
    return when (kind) {
        "none" -> Part.None
        "youtube" -> m.str("youtubeId")?.takeIf { YT_ID.matches(it) }?.let { Part.YouTube(it, content) } ?: Part.External
        "pdf" -> content?.let { Part.Pdf(it, m.bool("allowDownload") ?: false) } ?: Part.External
        "external" -> m.str("url")?.takeIf { it.startsWith("https://") }?.let { Part.Link(it) } ?: Part.External
        "video" -> Part.Video(content, m.str("provider")?.uppercase())
        else -> Part.External
    }
}

@Composable
fun LessonScreen(slug: String) {
    val nav = LocalNav.current
    val context = LocalContext.current
    val path = "/api/v1/ios/lessons/" + enc(slug)
    val load = rememberLoad(path)
    val data = load.value
    val lesson = data.obj("lesson")
    val viewer = data.obj("viewer")
    val code = viewer.str("code")?.lowercase()?.takeIf { it.length == 8 && it.all { c -> c.isDigit() || c in 'a'..'f' } }
    val watermark = if (code != null) listOfNotNull(viewer.text("name")?.take(80), code) else emptyList()
    val landscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE

    val parts: List<Part> = remember(data) {
        val list = lesson.objs("parts").map { part(it) }.filter { it != Part.None }.distinct()
        if (lesson?.containsKey("parts") == true) list else listOf(part(lesson.obj("media"))).filter { it != Part.None }
    }
    val firstVideo = parts.firstOrNull { it is Part.YouTube || it is Part.Video }

    if (landscape && firstVideo != null && data != null) {
        // أفقيًا: الفيديو يملأ الشاشة والعلامة المائية فوقه
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) { VideoPart(firstVideo, watermark, Modifier.fillMaxSize()) }
        return
    }

    Screen(lesson.str("title") ?: T("lessonName")) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (data != null && load.savedAt != null) OfflineBanner(load.savedAt)
            when {
                data == null && load.error != null -> EmptyView(T("lessonUnavailable"), load.error, Icons.Filled.Lock)
                data == null -> LoadingView()
                else -> {
                    Text(lesson.str("title") ?: "", fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    lesson.text("summary")?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    for (p in parts) {
                        when (p) {
                            is Part.YouTube, is Part.Video -> {
                                VideoPart(
                                    p, watermark,
                                    Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(16f / 9f)
                                        .clip(RoundedCornerShape(16.dp))
                                )
                                Text(T("rotateHint"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            is Part.Pdf -> PdfPart(p, lesson.str("title") ?: "", slug)
                            is Part.Link -> OutlinedButton(onClick = { openUrl(context, p.url) }, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.AutoMirrored.Filled.OpenInNew, null)
                                Spacer(Modifier.width(8.dp))
                                Text(T("lessonOpenLink"))
                            }
                            else -> CardBox { Text(T("contentNotInApp"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    lesson.text("bodyMarkdown")?.let { CardBox { MarkdownText(it) } }
                    if (parts.isEmpty() && lesson.text("bodyMarkdown") == null) EmptyView(T("lessonEmpty"))
                }
            }
        }
    }
}

@Composable
private fun PdfPart(p: Part.Pdf, title: String, slug: String) {
    val nav = LocalNav.current
    val app = LocalApp.current
    val saved = app.downloads.isSaved(p.contentId)
    CardBox {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Description, null, tint = Brand.teal)
            Spacer(Modifier.width(8.dp))
            Text(title, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (saved) Chip(T("savedOffline"), Brand.success, Icons.Filled.CheckCircle)
        }
        if (saved) {
            Button(
                onClick = { nav.go("pdf?key=${enc(p.contentId)}&title=${enc(title)}&path=&save=0") },
                modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Brand.success)
            ) { Text(T("lessonOpenSaved")) }
        }
        OutlinedButton(
            onClick = { nav.go("pdf?key=&title=${enc(title)}&path=${enc("/api/v1/ios/materials/${p.contentId}/view")}&save=0") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Filled.Visibility, null)
            Spacer(Modifier.width(8.dp))
            Text(T("lessonShowPDF"))
        }
        if (p.allowDownload && !saved) {
            Button(
                onClick = { nav.go("pdf?key=${enc(p.contentId)}&title=${enc(title)}&path=${enc("/api/v1/ios/materials/${p.contentId}/export")}&save=1") },
                modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Brand.blue)
            ) {
                Icon(Icons.Filled.DownloadForOffline, null)
                Spacer(Modifier.width(8.dp))
                Text(T("lessonSavePDF"))
            }
            Text(T("watermarkNote"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun VideoPart(p: Part, watermark: List<String>, modifier: Modifier) {
    val app = LocalApp.current
    when (p) {
        is Part.YouTube -> ProtectedPlayer(
            frame = "https://www.youtube-nocookie.com/embed/${p.id}?rel=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1",
            contentId = p.contentId, watermark = watermark, modifier = modifier
        )
        is Part.Video -> {
            if (p.provider != "BUNNY" || p.contentId == null) {
                Box(modifier.background(Color.Black), contentAlignment = Alignment.Center) {
                    Text(T("videoNotInApp"), color = Color.White, modifier = Modifier.padding(16.dp))
                }
                return
            }
            var player by remember(p.contentId) { mutableStateOf<JsonObject?>(null) }
            var error by remember(p.contentId) { mutableStateOf<String?>(null) }
            var retry by remember { mutableIntStateOf(0) }
            LaunchedEffect(p.contentId, retry) {
                try {
                    player = app.fetch("/api/v1/ios/media/${p.contentId}/player")
                    error = null
                } catch (e: ApiException) {
                    error = if (e.kind == ApiException.Kind.OFFLINE) T("videoNeedsInternet") else e.userMessage
                }
            }
            val url = player.str("url")
            when {
                error != null -> Box(modifier.background(Color.Black), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(error!!, color = Color.White, modifier = Modifier.padding(16.dp))
                        OutlinedButton(onClick = { retry++ }) { Text(T("retry"), color = Color.White) }
                    }
                }
                url != null && isBunny(url) -> ProtectedPlayer(url, p.contentId, player.strs("watermark").ifEmpty { watermark }, modifier)
                else -> Box(modifier.background(Color.Black), contentAlignment = Alignment.Center) { LoadingView() }
            }
        }
        else -> {}
    }
}

private fun hostOf(url: String): String = try {
    android.net.Uri.parse(url).host?.lowercase() ?: ""
} catch (e: Exception) {
    ""
}

private fun isBunny(url: String): Boolean {
    if (!url.startsWith("https://")) return false
    val h = hostOf(url)
    return h == "mediadelivery.net" || h.endsWith(".mediadelivery.net") || h.endsWith(".b-cdn.net") || h.endsWith(".bunnycdn.com") || h.endsWith(".bunny.net")
}

private fun isYouTube(h: String): Boolean =
    h == "www.youtube-nocookie.com" || h == "youtube.com" || h.endsWith(".youtube.com") || h.endsWith(".google.com") ||
        h.endsWith(".doubleclick.net") || h.endsWith(".ytimg.com") || h.endsWith(".googlevideo.com")

/**
 * مشغّل محمي: صفحة محلية ثابتة فيها إطار المشغّل وحده (يوتيوب أو Bunny الموقّع)، فلا يغادر الإطار الرئيسي
 * أبدًا ولا تُفتح نوافذ. فوقه علامة مائية متحرّكة باسم التلميذ ورمز حسابه، ونبضة كل 45 ثانية كالموقع
 * تفرض جهازًا واحدًا لكل حساب. لا حماية تسوّد الشاشة: حماية Bunny نفسها هي المعتمدة.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ProtectedPlayer(frame: String, contentId: String?, watermark: List<String>, modifier: Modifier) {
    val app = LocalApp.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var blocked by remember(frame) { mutableStateOf<String?>(null) }
    var resumed by remember { mutableStateOf(true) }
    var webView by remember { mutableStateOf<WebView?>(null) }

    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> { resumed = false; webView?.onPause() }
                Lifecycle.Event.ON_RESUME -> { resumed = true; webView?.onResume() }
                else -> {}
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }

    if (contentId != null) LaunchedEffect(contentId, blocked == null, resumed) {
        if (blocked != null || !resumed) return@LaunchedEffect
        var last = System.currentTimeMillis()
        var elapsed = 0
        var first = true
        while (isActive) {
            val now = System.currentTimeMillis()
            val delta = if (first) 0 else minOf(120, ((now - last) / 1000).toInt())
            first = false
            last = now
            elapsed += delta
            val r = app.heartbeat(contentId, elapsed, delta)
            if (r is Heartbeat.Blocked) {
                blocked = r.message
                return@LaunchedEffect
            }
            delay(45_000)
        }
    }

    BoxWithConstraints(modifier.background(Color.Black)) {
        val w = maxWidth
        val h = maxHeight
        var mark by remember { mutableStateOf(0.06f to 0.08f) }
        LaunchedEffect(Unit) {
            while (isActive) {
                delay(7_000)
                mark = Random.nextDouble(0.03, 0.45).toFloat() to Random.nextDouble(0.06, 0.75).toFloat()
            }
        }
        if (blocked == null) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    WebView(ctx).apply {
                        setBackgroundColor(AColor.BLACK)
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = true
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        settings.setSupportMultipleWindows(false)
                        settings.javaScriptCanOpenWindowsAutomatically = false
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                // الإطار الرئيسي لا يغادر الصفحة المحلية؛ إطار المشغّل يتنقّل داخل مزوّده فقط
                                if (request.isForMainFrame) return true
                                val host = request.url.host?.lowercase() ?: return true
                                return !(request.url.scheme == "https" && (isYouTube(host) || isBunny(request.url.toString())))
                            }
                        }
                        val escaped = frame.replace("&", "&amp;").replace("\"", "&quot;")
                        val html = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
</head><body><iframe src="$escaped" allow="accelerometer; encrypted-media; gyroscope" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>"""
                        // أصل الموقع كمُحيل: المشغّلان يقبلان التضمين من madrasadz.com فقط
                        loadDataWithBaseURL("https://madrasadz.com/", html, "text/html", "utf-8", null)
                        webView = this
                    }
                },
                onRelease = { v ->
                    v.stopLoading()
                    v.loadUrl("about:blank")
                    v.destroy()
                    webView = null
                }
            )
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Filled.Lock, null, tint = Color.White, modifier = Modifier.size(36.dp))
                Text(T("deviceBlockedTitle"), color = Color.White, fontWeight = FontWeight.Bold)
                Text(blocked!!, color = Color.White, fontSize = 13.sp)
                Spacer(Modifier.size(8.dp))
                Button(onClick = { blocked = null }) { Text(T("retry")) }
            }
        }
        if (watermark.isNotEmpty() && blocked == null) {
            // العلامة بالاتجاه اللاتيني ومن الزاوية اليسرى، فتبقى داخل الإطار مهما كان اتجاه الواجهة
            androidx.compose.runtime.CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
              Box(Modifier.fillMaxSize()) {
                Column(
                    Modifier
                        .align(Alignment.TopStart)
                        .offset(x = w * mark.first, y = h * mark.second)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.35f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    watermark.forEach { Text(it, color = Color.White.copy(alpha = 0.8f), fontSize = 11.sp, fontFamily = FontFamily.Monospace, maxLines = 1) }
                }
              }
            }
        }
    }
}

// ── عرض نص الدرس (Markdown مبسّط: عناوين، قوائم، فقرات، **غامق**) ──

@Composable
fun MarkdownText(source: String) {
    val lines = source.replace("\r\n", "\n").split("\n")
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (raw in lines) {
            val line = raw.trimEnd()
            when {
                line.isBlank() -> Spacer(Modifier.size(2.dp))
                line.startsWith("### ") -> Text(inline(line.drop(4)), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                line.startsWith("## ") -> Text(inline(line.drop(3)), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                line.startsWith("# ") -> Text(inline(line.drop(2)), fontWeight = FontWeight.Bold, fontSize = 20.sp)
                line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ") ->
                    Row { Text("•  ", fontWeight = FontWeight.Bold); Text(inline(line.trimStart().drop(2)), fontSize = 15.sp, lineHeight = 24.sp) }
                Regex("^\\s*\\d+[.)] ").containsMatchIn(line) -> Text(inline(line.trim()), fontSize = 15.sp, lineHeight = 24.sp)
                line.startsWith("> ") -> Text(inline(line.drop(2)), fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> Text(inline(line), fontSize = 15.sp, lineHeight = 25.sp)
            }
        }
    }
}

private fun inline(text: String): AnnotatedString = buildAnnotatedString {
    var rest = text
    while (rest.isNotEmpty()) {
        val start = rest.indexOf("**")
        if (start < 0) {
            append(rest); break
        }
        val end = rest.indexOf("**", start + 2)
        if (end < 0) {
            append(rest); break
        }
        append(rest.substring(0, start))
        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(rest.substring(start + 2, end)) }
        rest = rest.substring(end + 2)
    }
}
