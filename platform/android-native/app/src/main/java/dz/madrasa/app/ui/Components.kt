package dz.madrasa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import dz.madrasa.app.ApiException
import dz.madrasa.app.AppModel
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

val LocalApp = staticCompositionLocalOf<AppModel> { error("no app") }
val LocalNav = staticCompositionLocalOf<Nav> { error("no nav") }

/** التنقّل داخل تبويب: كل تبويب له مكدّسه (الرئيسية، العب، منظّمي، حسابي) */
class Nav(val controller: NavHostController, val tab: String) {
    fun go(route: String) = controller.navigate("$tab/$route")
    fun back() {
        controller.popBackStack()
    }
}

/** محمّل شاشة: النسخة المحفوظة على الهاتف تظهر فورًا، ثم تُحدَّث من الخادم إن وُجد اتصال. */
class Loaded(private val app: AppModel) {
    var value by mutableStateOf<JsonObject?>(null)
    var savedAt by mutableStateOf<Long?>(null)
    var error by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)

    suspend fun load(path: String, force: Boolean = false) {
        if (value == null) app.cached(path)?.let { (v, at) ->
            value = v
            savedAt = at
        }
        loading = true
        try {
            value = app.fetch(path)
            savedAt = null
            error = null
        } catch (e: ApiException) {
            if (value == null) error = e.userMessage
            else if (!force && savedAt == null) savedAt = System.currentTimeMillis()
            if (force && value != null && e.kind != ApiException.Kind.OFFLINE) app.notice = e.userMessage
        } finally {
            loading = false
        }
    }
}

@Composable
fun rememberLoad(path: String?): Loaded {
    val app = LocalApp.current
    val state = remember(path) { Loaded(app) }
    LaunchedEffect(path) { if (path != null) state.load(path) }
    return state
}

fun formatDate(millis: Long, pattern: String = "d MMM yyyy، HH:mm"): String =
    SimpleDateFormat(pattern, Locale("ar", "DZ")).format(Date(millis))

fun parseIso(value: String?): Long? {
    if (value.isNullOrBlank()) return null
    val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd")
    for (p in patterns) {
        try {
            val f = SimpleDateFormat(p, Locale.ROOT)
            if (p == "yyyy-MM-dd") f.timeZone = java.util.TimeZone.getDefault() else f.timeZone = java.util.TimeZone.getTimeZone("UTC")
            return f.parse(value)?.time
        } catch (e: Exception) {
        }
    }
    return null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen(
    title: String,
    back: Boolean = true,
    actions: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit
) {
    val nav = LocalNav.current
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    if (back) IconButton(onClick = { nav.back() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = T("back"))
                    }
                },
                actions = { actions() },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0)
    ) { padding -> content(padding) }
}

/** قائمة قابلة للسحب للتحديث، بهوامش الصفحة المعتادة */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RefreshList(
    padding: PaddingValues,
    refreshing: Boolean,
    onRefresh: suspend () -> Unit,
    content: LazyListScope.() -> Unit
) {
    val scope = rememberCoroutineScope()
    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { onRefresh() } },
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content
        )
    }
}

@Composable
fun CardBox(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        tonalElevation = 1.dp,
        shadowElevation = 1.dp
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
    }
}

@Composable
fun GradientTile(
    title: String,
    detail: String?,
    icon: ImageVector,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    badge: String? = null,
    onClick: () -> Unit
) {
    Box(
        modifier
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(colors))
            .clickable { onClick() }
            .heightIn(min = 150.dp)
            .padding(16.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(26.dp)) }
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 22.sp)
            if (detail != null) Text(detail, color = Color.White.copy(alpha = 0.88f), fontSize = 12.sp, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (badge != null) Text(
                badge, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.22f))
                    .padding(horizontal = 8.dp, vertical = 2.dp)
            )
        }
    }
}

@Composable
fun RowItem(
    title: String,
    subtitle: String? = null,
    icon: ImageVector? = null,
    tint: Color = MaterialTheme.colorScheme.primary,
    trailing: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null
) {
    CardBox(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Box(
                    Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(tint.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) { Icon(icon, null, tint = tint) }
                Spacer(Modifier.width(12.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
                if (!subtitle.isNullOrBlank()) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            if (trailing != null) trailing()
            else if (onClick != null) Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = modifier.padding(top = 6.dp))
}

@Composable
fun Chip(text: String, color: Color = MaterialTheme.colorScheme.primary, icon: ImageVector? = null) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, null, tint = color, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
        }
        Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun LoadingView(text: String = T("loading")) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CircularProgressIndicator()
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun FailureView(message: String, retry: () -> Unit) {
    CardBox {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Filled.ErrorOutline, null, tint = Brand.danger, modifier = Modifier.size(36.dp))
            Text(message, textAlign = TextAlign.Center)
            OutlinedButton(onClick = retry) { Text(T("retry")) }
        }
    }
}

@Composable
fun EmptyView(title: String, body: String? = null, icon: ImageVector = Icons.Filled.Inbox) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 30.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
        Text(title, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        if (body != null) Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, fontSize = 14.sp)
    }
}

@Composable
fun OfflineBanner(savedAt: Long?) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.amber.copy(alpha = 0.14f))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Filled.CloudOff, null, tint = Brand.amber)
        Spacer(Modifier.width(8.dp))
        Text(
            if (savedAt != null) Tf("offlineSavedAt", formatDate(savedAt)) else T("offlineNow"),
            color = Brand.amber, fontSize = 13.sp, fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun BigButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, color: Color = Brand.blue, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color)
    ) { Text(text, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
}
