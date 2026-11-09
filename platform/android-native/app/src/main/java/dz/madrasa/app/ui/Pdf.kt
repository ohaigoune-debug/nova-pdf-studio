package dz.madrasa.app.ui

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DownloadForOffline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/**
 * عارض PDF داخل التطبيق.
 * key: ملف محفوظ في «ملفاتي» (يُفتح دون إنترنت)، path: يُجلب من الخادم بالجلسة؛ save=1 يحفظه أولًا.
 */
@Composable
fun PdfScreen(key: String, title: String, path: String, save: Boolean) {
    val app = LocalApp.current
    val nav = LocalNav.current
    var file by remember { mutableStateOf<File?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }
    var justSaved by remember { mutableStateOf(false) }

    LaunchedEffect(retry) {
        error = null
        val existing = if (key.isNotEmpty()) app.downloads.file(key) else null
        if (existing != null) {
            file = existing
            return@LaunchedEffect
        }
        if (path.isEmpty()) {
            error = T("downloadFailed"); return@LaunchedEffect
        }
        try {
            file = if (save && key.isNotEmpty()) {
                app.downloads.saveFromServer(key, title, path, if (path.contains("/materials/")) "lesson" else "paper").also { justSaved = true }
            } else app.downloads.temporary(path)
        } catch (e: ApiException) {
            app.handle(e)
            error = if (e.kind == ApiException.Kind.OFFLINE) e.userMessage else (e.serverMessage ?: T("downloadFailed"))
        }
    }

    Screen(title.ifEmpty { T("savedFilesTitle") }) { padding ->
        Box(
            Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            val f = file
            when {
                error != null -> Column(Modifier.padding(16.dp)) { FailureView(error!!) { retry++ } }
                f == null -> LoadingView(T("downloading"))
                else -> {
                    PdfView(f)
                    if (justSaved) LaunchedEffect(Unit) { app.notice = T("downloaded") }
                }
            }
        }
    }
}

@Composable
fun PdfView(file: File) {
    val density = LocalDensity.current
    val renderer = remember(file) {
        try {
            PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))
        } catch (e: Exception) {
            null
        }
    }
    val lock = remember { Mutex() }
    DisposableEffect(renderer) { onDispose { try { renderer?.close() } catch (e: Exception) {} } }
    if (renderer == null) {
        EmptyView(T("downloadFailed"))
        return
    }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(Color(0xFF525659))
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(1f, 4f)
                    offset = if (scale == 1f) Offset.Zero else offset + pan
                }
            }
    ) {
        val widthPx = with(density) { maxWidth.toPx() }.toInt().coerceIn(400, 1600)
        LazyColumn(
            Modifier
                .fillMaxSize()
                .graphicsLayer(scaleX = scale, scaleY = scale, translationX = offset.x, translationY = offset.y),
            contentPadding = PaddingValues(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items((0 until renderer.pageCount).toList()) { index ->
                var bitmap by remember(index) { mutableStateOf<Bitmap?>(null) }
                var ratio by remember(index) { mutableFloatStateOf(1.414f) }
                LaunchedEffect(index, widthPx) {
                    bitmap = withContext(Dispatchers.IO) {
                        lock.withLock {
                            try {
                                renderer.openPage(index).use { page ->
                                    ratio = page.height.toFloat() / page.width.toFloat()
                                    val bmp = Bitmap.createBitmap(widthPx, (widthPx * ratio).toInt(), Bitmap.Config.ARGB_8888)
                                    bmp.eraseColor(android.graphics.Color.WHITE)
                                    page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                    bmp
                                }
                            } catch (e: Exception) {
                                null
                            }
                        }
                    }
                }
                val b = bitmap
                if (b != null) Image(b.asImageBitmap(), null, contentScale = ContentScale.FillWidth, modifier = Modifier.fillMaxWidth())
                else Box(
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f / ratio)
                        .background(Color.White)
                )
            }
        }
    }
}

/** «ملفاتي المحفوظة»: ملفات PDF المختومة باسم التلميذ، تعمل دون إنترنت */
@Composable
fun DownloadsScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val files = app.downloads.index.files
    Screen(T("savedFilesTitle")) { padding ->
        RefreshList(padding, false, {}) {
            if (files.isEmpty()) item { EmptyView(T("downloadsEmpty"), T("downloadsEmptyBody"), Icons.Filled.DownloadForOffline) }
            items(files) { f ->
                RowItem(
                    f.title, formatDate(f.savedAt) + " · " + "%.1f MB".format(java.util.Locale.ROOT, f.size / 1_048_576.0),
                    Icons.Filled.Description, Brand.teal,
                    trailing = {
                        IconButton(onClick = { app.downloads.remove(f.key) }) { Icon(Icons.Filled.Delete, T("deleteFile"), tint = Brand.danger) }
                    }
                ) { nav.go("pdf?key=${enc(f.key)}&title=${enc(f.title)}&path=&save=0") }
            }
            if (files.isNotEmpty()) item { Text(T("downloadsFooter"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
