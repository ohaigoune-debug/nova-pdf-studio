package dz.madrasa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.bool
import dz.madrasa.app.obj
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.text
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * القسم الافتراضي: «القسم العام» لكل التلاميذ، أو قسم دورة. منشورات الأساتذة والإدارة، وتعليقات التلاميذ،
 * مع الإبلاغ عن تعليق (تذكرة للإدارة وإشعار للأستاذ) وإخفاء تعليقات تلميذ على هذا الهاتف — سياسة المحتوى من المستخدمين.
 */
@Composable
fun ClassroomScreen(group: String?) {
    val app = LocalApp.current
    val context = LocalContext.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val path = if (group == null) "/api/v1/ios/classroom" else "/api/v1/ios/classroom?group=" + enc(group)
    val load = rememberLoad(path)
    val data = load.value
    var hidden by remember { mutableStateOf(app.hiddenClassmates()) }
    var showHidden by remember { mutableStateOf(false) }
    val drafts = remember { mutableStateMapOf<String, String>() }
    var reporting by remember { mutableStateOf<JsonObject?>(null) }
    var reason by remember { mutableStateOf("") }

    val title = if (group == null) T("generalClassroom") else (data.objs("groups").firstOrNull { it.str("id") == group }?.str("name") ?: T("classroom"))
    Screen(title) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            item { Text(if (group == null) T("generalClassroomHint") else T("classroomHint"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (data != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            val posts = data.objs("posts")
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                posts.isEmpty() -> item { EmptyView(T("classroomEmpty"), if (group == null) T("generalClassroomEmptyHint") else T("classroomEmptyHint"), Icons.Filled.Forum) }
                else -> items(posts, key = { it.str("id") ?: it.hashCode().toString() }) { post ->
                    val postId = post.str("id") ?: ""
                    CardBox {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(post.str("authorName") ?: "", fontWeight = FontWeight.Bold, color = Brand.navy)
                                Text(
                                    listOfNotNull(post.text("groupName"), parseIso(post.str("createdAt"))?.let { formatDate(it) }).joinToString(" · "),
                                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (post.bool("pinned") == true) Chip(T("pinned"), Brand.amber, Icons.Filled.PushPin)
                        }
                        Text(post.str("body") ?: "", fontSize = 15.sp, lineHeight = 24.sp)
                        post.text("linkUrl")?.takeIf { it.startsWith("https://") }?.let { url ->
                            TextButton(onClick = { openUrl(context, url) }) { Icon(Icons.AutoMirrored.Filled.OpenInNew, null); Text(" " + T("lessonOpenLink")) }
                        }
                        post.obj("file")?.let { f ->
                            val url = f.str("url") ?: ""
                            val name = f.str("name") ?: ""
                            TextButton(onClick = {
                                if (url.startsWith("/api/v1/files/") && name.lowercase().endsWith(".pdf")) nav.go("pdf?key=&title=${enc(name)}&path=${enc(url)}&save=0")
                                else if (url.startsWith("https://")) openUrl(context, url)
                                else if (url.startsWith("/")) openUrl(context, siteUrl(url))
                            }) { Icon(Icons.Filled.AttachFile, null); Text(" $name") }
                        }
                        val comments = post.objs("comments")
                        val visible = comments.filter { c -> showHidden || c.str("authorKey") == null || c.str("authorKey") !in hidden || c.bool("teacher") == true }
                        visible.forEach { c -> CommentRow(c, onReport = { reporting = c; reason = "" }, onHide = { key, name ->
                            hidden = hidden + key
                            app.setHiddenClassmates(hidden)
                            app.notice = Tf("hideClassmateMessage", name)
                        }, onDelete = {
                            scope.launch {
                                try {
                                    app.post("/api/v1/ios/classroom/comments/${enc(c.str("id") ?: "")}/delete", buildJsonObject { })
                                    load.load(path, force = true)
                                } catch (e: ApiException) {
                                    app.notice = e.userMessage
                                }
                            }
                        }) }
                        if (post.bool("allowComments") == false) Text(T("commentsClosed"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        else OutlinedTextField(
                            drafts[postId] ?: "", { drafts[postId] = it.take(2000) },
                            placeholder = { Text(T("commentPlaceholder")) }, modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                val text = (drafts[postId] ?: "").trim()
                                IconButton(enabled = text.length >= 2, onClick = {
                                    scope.launch {
                                        try {
                                            app.post("/api/v1/ios/classroom/posts/${enc(postId)}/comments", buildJsonObject { put("body", text) })
                                            drafts[postId] = ""
                                            load.load(path, force = true)
                                        } catch (e: ApiException) {
                                            app.notice = e.userMessage
                                        }
                                    }
                                }) { Icon(Icons.AutoMirrored.Filled.Send, T("send"), tint = Brand.blue) }
                            }
                        )
                    }
                }
            }
            val hiddenCount = hidden.size
            if (hiddenCount > 0) item {
                TextButton(onClick = { showHidden = !showHidden }) { Text(Tf("classroomShowHidden", hiddenCount)) }
            }
        }
    }

    val target = reporting
    if (target != null) AlertDialog(
        onDismissRequest = { reporting = null },
        title = { Text(T("reportTitle")) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(T("reportMessage"), fontSize = 13.sp)
                OutlinedTextField(reason, { reason = it.take(500) }, label = { Text(T("reportReason")) }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = {
                reporting = null
                scope.launch {
                    try {
                        app.post("/api/v1/ios/classroom/comments/${enc(target.str("id") ?: "")}/report", buildJsonObject { put("reason", reason.trim()) })
                        app.notice = T("reportSent")
                    } catch (e: ApiException) {
                        app.notice = e.userMessage
                    }
                }
            }) { Text(T("report"), color = Brand.danger) }
        },
        dismissButton = { TextButton(onClick = { reporting = null }) { Text(T("cancel")) } }
    )
}

@Composable
private fun CommentRow(c: JsonObject, onReport: () -> Unit, onHide: (String, String) -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val mine = c.bool("mine") == true
    val teacher = c.bool("teacher") == true
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (teacher) Brand.sky.copy(alpha = 0.4f) else MaterialTheme.colorScheme.surfaceVariant)
            .padding(start = 10.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.Top
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                (if (mine) T("you") else c.str("authorName") ?: "") + (if (teacher) " · " + T("teacher") else ""),
                fontWeight = FontWeight.Bold, fontSize = 12.sp, color = if (teacher) Brand.blue else Brand.navy
            )
            Text(c.str("body") ?: "", fontSize = 14.sp)
        }
        Box {
            IconButton(onClick = { menu = true }, modifier = Modifier.size(36.dp)) { Icon(Icons.Filled.MoreVert, T("commentActions"), modifier = Modifier.size(18.dp)) }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                if (mine) DropdownMenuItem(text = { Text(T("deleteComment")) }, onClick = { menu = false; onDelete() })
                else {
                    DropdownMenuItem(text = { Text(T("report")) }, onClick = { menu = false; onReport() })
                    val key = c.str("authorKey")
                    if (key != null && !teacher) DropdownMenuItem(text = { Text(T("hideClassmate")) }, onClick = { menu = false; onHide(key, c.str("authorName") ?: "") })
                }
            }
        }
    }
}
