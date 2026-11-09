package dz.madrasa.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.BuildConfig
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.bool
import dz.madrasa.app.int
import dz.madrasa.app.objs
import dz.madrasa.app.str
import dz.madrasa.app.text
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Composable
fun AccountScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmLogout by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { app.refreshSupportBadge() }

    Screen(T("tabAccount"), back = false) { padding ->
        RefreshList(padding, false, { app.validate() }) {
            item {
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.AccountCircle, null, tint = Brand.blue, modifier = Modifier.size(52.dp))
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(app.session?.name ?: T("student"), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            app.session?.email?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                }
            }
            if (app.phoneRequired) item { RowItem(T("phoneAction"), T("phoneBody"), Icons.Filled.Warning, Brand.amber) { nav.go("phone") } }
            item { RowItem(T("myOrders"), T("myOrdersHint"), Icons.Filled.LocalShipping, Brand.amber) { nav.go("orders") } }
            item {
                RowItem(
                    T("supportTitle"), T("supportRowHint"), Icons.Filled.SupportAgent, Brand.blue,
                    trailing = if (app.supportWaiting > 0) supportBadge(app.supportWaiting) else null
                ) { nav.go("support") }
            }
            item { RowItem(T("savedFilesTitle"), null, Icons.Filled.Folder, Brand.success) { nav.go("downloads") } }
            item {
                CardBox {
                    Text(T("appearance"), fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("system" to T("appearanceSystem"), "light" to T("appearanceLight"), "dark" to T("appearanceDark")).forEach { (k, label) ->
                            FilterChip(selected = app.appearance == k, onClick = { app.chooseAppearance(k) }, label = { Text(label) })
                        }
                    }
                }
            }
            item {
                CardBox {
                    Text(T("offlineSection"), fontWeight = FontWeight.Bold)
                    InfoLine(T("connectionStatus"), if (app.online) T("onlineNow") else T("offlineNow"))
                    InfoLine(T("savedSets"), app.play.index.downloaded.size.toString())
                    InfoLine(T("savedFiles"), app.downloads.index.files.size.toString())
                    if (app.play.pendingCount > 0) TextButton(onClick = { scope.launch { app.play.sync() } }, enabled = app.online) {
                        Icon(Icons.Filled.Sync, null); Text(" " + Tf("pendingSync", app.play.pendingCount))
                    }
                }
            }
            item { RowItem(T("privacy"), null, Icons.Filled.PanTool, Brand.navy) { openUrl(context, siteUrl("/privacy")) } }
            item {
                OutlinedButton(onClick = { confirmLogout = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.AutoMirrored.Filled.Logout, null, tint = Brand.danger); Text(" " + T("logout"), color = Brand.danger)
                }
            }
            item {
                OutlinedButton(onClick = { nav.go("deleteaccount") }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.DeleteForever, null, tint = Brand.danger); Text(" " + T("deleteAccount"), color = Brand.danger)
                }
            }
            item { Text(T("deleteAccountFooter"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item { Text(T("version") + " " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
    if (confirmLogout) AlertDialog(
        onDismissRequest = { confirmLogout = false },
        title = { Text(T("logout")) },
        text = { Text(T("logoutNative")) },
        confirmButton = { TextButton(onClick = { confirmLogout = false; scope.launch { app.logout() } }) { Text(T("logout"), color = Brand.danger) } },
        dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text(T("cancel")) } }
    )
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row {
        Text(label, modifier = Modifier.weight(1f), fontSize = 14.sp)
        Text(value, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** حذف الحساب نهائيًا من داخل التطبيق (سياسة Google Play) */
@Composable
fun DeleteAccountScreen() {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var password by remember { mutableStateOf("") }
    var understood by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    Screen(T("deleteAccount")) { padding ->
        RefreshList(padding, false, {}) {
            item {
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Warning, null, tint = Brand.danger)
                        Text("  " + T("deleteAccountWarning"), fontWeight = FontWeight.Bold, color = Brand.danger)
                    }
                    Text(T("deleteAccountBody"), fontSize = 14.sp)
                }
            }
            item {
                OutlinedTextField(
                    password, { password = it }, label = { Text(T("loginPassword")) }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth()
                )
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = understood, onCheckedChange = { understood = it })
                    Text(T("deleteAccountUnderstood"))
                }
            }
            if (error != null) item { Text(error!!, color = Brand.danger, fontWeight = FontWeight.SemiBold) }
            item {
                BigButton(if (working) T("loading") else T("deleteAccountAction"), enabled = understood && password.isNotEmpty() && !working, color = Brand.danger) {
                    working = true
                    scope.launch {
                        error = app.deleteAccount(password)
                        working = false
                    }
                }
            }
        }
    }
}

// ── طلباتي: للتتبّع فقط (دون سعر ولا دفع داخل التطبيق) ──

@Composable
fun OrdersScreen() {
    val nav = LocalNav.current
    val path = "/api/v1/ios/orders"
    val load = rememberLoad(path)
    val scope = rememberCoroutineScope()
    val data = load.value
    Screen(T("myOrders")) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            item { Text(T("myOrdersHint"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (data != null && load.savedAt != null) item { OfflineBanner(load.savedAt) }
            val orders = data.objs("orders")
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                orders.isEmpty() -> item { EmptyView(T("ordersEmpty"), icon = Icons.Filled.LocalShipping) }
                else -> items(orders) { o ->
                    CardBox {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(Tf("orderNumber", o.str("number") ?: ""), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Chip(o.str("statusText") ?: "", if (o.str("status") == "DELIVERED") Brand.success else Brand.amber)
                        }
                        o.text("items")?.let { Text(it, fontSize = 14.sp) }
                        parseIso(o.str("createdAt"))?.let { Text(formatDate(it), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        o.text("deliveryProvider")?.let { Text(T("deliveryCompany") + ": " + it, fontSize = 13.sp) }
                        o.text("trackingId")?.let { Text(T("trackingNumber") + ": " + it, fontSize = 13.sp, fontWeight = FontWeight.SemiBold) }
                        val timeline = o.objs("timeline")
                        if (timeline.isNotEmpty()) {
                            Text(T("orderHistory"), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            timeline.forEach { t ->
                                val done = t.str("tone") == "done"
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null, tint = if (done) Brand.success else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                                    Text("  " + (t.str("label") ?: ""), fontSize = 13.sp, modifier = Modifier.weight(1f))
                                    parseIso(t.str("at"))?.let { Text(formatDate(it, "d MMM"), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                            }
                        }
                        TextButton(onClick = { nav.go("newticket") }) { Text(T("orderProblem")) }
                    }
                }
            }
        }
    }
}

// ── الدعم والشكاوى ──

@Composable
fun SupportScreen() {
    val nav = LocalNav.current
    val path = "/api/v1/ios/support"
    val load = rememberLoad(path)
    val scope = rememberCoroutineScope()
    val data = load.value
    Screen(T("supportTitle"), actions = { TextButton(onClick = { nav.go("newticket") }) { Text(T("newTicket")) } }) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            item { Text(T("supportHint"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            val tickets = data.objs("tickets")
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                tickets.isEmpty() -> item { EmptyView(T("supportEmpty"), icon = Icons.Filled.SupportAgent) }
                else -> items(tickets) { t ->
                    val status = t.str("status") ?: "OPEN"
                    RowItem(
                        "#${t.int("number") ?: ""} · " + (t.str("subject") ?: ""),
                        listOfNotNull(T("kind.${t.str("kind")}"), T("ticket.$status")).joinToString(" · "),
                        Icons.Filled.SupportAgent, if (status == "WAITING_USER") Brand.amber else Brand.blue
                    ) { nav.go("ticket/" + enc(t.str("id") ?: "")) }
                }
            }
            item {
                BigButton(T("newTicket")) { nav.go("newticket") }
            }
        }
    }
}

@Composable
fun TicketScreen(id: String) {
    val app = LocalApp.current
    val path = "/api/v1/ios/support/" + enc(id)
    val load = rememberLoad(path)
    val scope = rememberCoroutineScope()
    val data = load.value
    var reply by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    Screen(data.str("subject") ?: T("supportTitle")) { padding ->
        RefreshList(padding, load.loading && data != null, { load.load(path, force = true) }) {
            when {
                data == null && load.error != null -> item { FailureView(load.error!!) { scope.launch { load.load(path, true) } } }
                data == null -> item { LoadingView() }
                else -> {
                    val status = data.str("status") ?: "OPEN"
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Chip("#${data.int("number") ?: ""}", Brand.navy)
                            Chip(T("ticket.$status"), if (status == "WAITING_USER") Brand.amber else Brand.blue)
                            data.text("orderNumber")?.let { Chip(Tf("orderNumber", it), Brand.teal) }
                        }
                    }
                    items(data.objs("messages")) { m ->
                        val mine = m.bool("mine") == true
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (mine) Brand.blue.copy(alpha = 0.10f) else MaterialTheme.colorScheme.surface)
                                .padding(12.dp)
                        ) {
                            Text(if (mine) T("you") else (m.text("author") ?: T("supportTeam")), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (mine) Brand.blue else Brand.navy)
                            Text(m.str("body") ?: "", fontSize = 15.sp)
                            parseIso(m.str("createdAt"))?.let { Text(formatDate(it), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    if (status == "CLOSED" || status == "RESOLVED") item { Text(T("ticketClosed"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    else {
                        item {
                            OutlinedTextField(
                                reply, { reply = it }, placeholder = { Text(T("replyPlaceholder")) }, modifier = Modifier.fillMaxWidth(),
                                trailingIcon = {
                                    IconButton(enabled = reply.trim().length >= 2 && !working, onClick = {
                                        working = true
                                        scope.launch {
                                            try {
                                                app.post("$path/reply", buildJsonObject { put("body", reply.trim()) })
                                                reply = ""
                                                load.load(path, force = true)
                                                app.refreshSupportBadge()
                                            } catch (e: ApiException) {
                                                app.notice = e.userMessage
                                            }
                                            working = false
                                        }
                                    }) { Icon(Icons.AutoMirrored.Filled.Send, T("send"), tint = Brand.blue) }
                                }
                            )
                        }
                        item {
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        app.post("$path/close", buildJsonObject { })
                                        load.load(path, force = true)
                                        app.refreshSupportBadge()
                                    } catch (e: ApiException) {
                                        app.notice = e.userMessage
                                    }
                                }
                            }) { Text(T("closeTicket")) }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NewTicketScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var kind by remember { mutableStateOf("TECHNICAL") }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    Screen(T("newTicket")) { padding ->
        RefreshList(padding, false, {}) {
            item {
                CardBox {
                    Text(T("ticketKind"), fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("DELIVERY", "ACCESS", "CONTENT", "TECHNICAL", "TEACHER", "OTHER").forEach { k ->
                            FilterChip(selected = kind == k, onClick = { kind = k }, label = { Text(T("kind.$k")) })
                        }
                    }
                    if (kind == "TEACHER") Text(T("teacherPrivate"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item { OutlinedTextField(subject, { subject = it }, label = { Text(T("ticketSubject")) }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
            item { OutlinedTextField(body, { body = it }, label = { Text(T("ticketBody")) }, minLines = 5, modifier = Modifier.fillMaxWidth()) }
            if (error != null) item { Text(error!!, color = Brand.danger) }
            item {
                BigButton(if (working) T("loading") else T("send"), enabled = !working) {
                    if (subject.trim().length < 3) {
                        error = T("ticketSubjectShort"); return@BigButton
                    }
                    if (body.trim().length < 2) {
                        error = T("ticketBodyShort"); return@BigButton
                    }
                    working = true
                    scope.launch {
                        try {
                            val r = app.post("/api/v1/ios/support", buildJsonObject {
                                put("kind", kind); put("subject", subject.trim()); put("body", body.trim())
                            })
                            nav.back()
                            r.str("id")?.let { nav.go("ticket/" + enc(it)) }
                        } catch (e: ApiException) {
                            error = e.userMessage
                        }
                        working = false
                    }
                }
            }
        }
    }
}

private fun supportBadge(count: Int): @Composable () -> Unit = { Badge { Text(count.toString()) } }
