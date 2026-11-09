package dz.madrasa.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.Phone
import dz.madrasa.app.R
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import dz.madrasa.app.asObj
import dz.madrasa.app.bool
import dz.madrasa.app.int
import dz.madrasa.app.objs
import dz.madrasa.app.str
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

fun openUrl(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
    }
}

fun siteUrl(path: String) = "https://madrasadz.com$path"

@Composable
fun SignedOutRoot() {
    var signingUp by remember { mutableStateOf(false) }
    if (signingUp) {
        BackHandler { signingUp = false }
        SignupScreen(onClose = { signingUp = false })
    } else {
        LoginScreen(onSignup = { signingUp = true })
    }
}

@Composable
private fun LoginScreen(onSignup: () -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    fun submit() {
        if (working) return
        working = true
        error = null
        scope.launch {
            error = app.login(identifier, password)
            working = false
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Brand.navy, Brand.blue)))
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Spacer(Modifier.height(24.dp))
            Surface(shape = RoundedCornerShape(22.dp), color = Color.White) {
                Image(
                    painterResource(R.drawable.brand_logo), contentDescription = T("appName"),
                    modifier = Modifier
                        .padding(horizontal = 18.dp, vertical = 8.dp)
                        .widthIn(max = 230.dp)
                )
            }
            Text(T("appTagline"), color = Color.White.copy(alpha = 0.9f), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 520.dp)
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(T("signIn"), fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    OutlinedTextField(
                        value = identifier, onValueChange = { identifier = it },
                        label = { Text(T("loginIdentifier")) }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = password, onValueChange = { password = it },
                        label = { Text(T("loginPassword")) }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        // كلمات السر في الموقع بالحروف اللاتينية: لوحة لاتينية حتى لو كانت لوحة الهاتف عربية
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onGo = { submit() }),
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (error != null) Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.ErrorOutline, null, tint = Brand.danger, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(6.dp))
                        Text(error!!, color = Brand.danger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    BigButton(if (working) T("loading") else T("signIn"), enabled = !working) { submit() }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(T("loginHint"), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                        TextButton(onClick = { openUrl(context, siteUrl("/forgot-password")) }) { Text(T("forgotPassword"), fontSize = 13.sp) }
                    }
                    HorizontalDivider()
                    OutlinedButton(
                        onClick = onSignup, modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp), shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Filled.PersonAdd, null)
                        Spacer(Modifier.size(8.dp))
                        Text(T("register"), fontWeight = FontWeight.Bold)
                    }
                }
            }
            TextButton(onClick = { openUrl(context, siteUrl("/privacy")) }) {
                Text(T("privacy"), color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
            }
        }
    }
}

private data class Option(val id: String, val name: String, val secondary: Boolean = false)

@Composable
private fun Picker(label: String, options: List<Option>, selected: String, error: Boolean, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.id == selected }?.name ?: T("signupChoose")
    Box {
        OutlinedTextField(
            value = current, onValueChange = {}, readOnly = true, label = { Text(label) }, isError = error,
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null) },
            modifier = Modifier.fillMaxWidth()
        )
        Box(
            Modifier
                .matchParentSize()
                .clickable { open = true })
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = { TextButton(onClick = { open = false }) { Text(T("cancel")) } },
            title = { Text(label) },
            text = {
                LazyColumn(Modifier.height(380.dp)) {
                    items(options) { o ->
                        Text(
                            o.name, fontSize = 16.sp,
                            fontWeight = if (o.id == selected) FontWeight.Bold else FontWeight.Normal,
                            color = if (o.id == selected) Brand.blue else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(o.id); open = false }
                                .padding(vertical = 12.dp)
                        )
                    }
                }
            }
        )
    }
}

@Composable
private fun SignupScreen(onClose: () -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var wilayas by remember { mutableStateOf<List<Option>>(emptyList()) }
    var levels by remember { mutableStateOf<List<Option>>(emptyList()) }
    var streams by remember { mutableStateOf<List<Option>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var guardian by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var wilaya by remember { mutableStateOf("") }
    var level by remember { mutableStateOf("") }
    var stream by remember { mutableStateOf("") }
    var badField by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    LaunchedEffect(reload) {
        try {
            val data = app.api.get("/api/v1/ios/register", requireSession = false).first.asObj()
            wilayas = data.objs("wilayas").mapNotNull { o -> o.str("id")?.let { Option(it, o.str("name") ?: it) } }
            levels = data.objs("levels").mapNotNull { o -> o.str("id")?.let { Option(it, o.str("name") ?: it, o.bool("secondary") ?: false) } }
            streams = data.objs("streams").mapNotNull { o -> o.str("id")?.let { Option(it, o.str("name") ?: it) } }
            loadError = null
        } catch (e: ApiException) {
            loadError = e.userMessage
        }
    }

    val secondary = levels.firstOrNull { it.id == level }?.secondary ?: false

    fun firstInvalid(): String? {
        if (fullName.trim().length < 3) return "fullName"
        if (!Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$").matches(email.trim())) return "email"
        if (Phone.normalize(phone) == null) return "phone"
        if (Phone.normalize(guardian) == null) return "guardianPhone"
        if (password.length < 8) return "password"
        if (wilaya.isEmpty()) return "wilayaId"
        if (levels.none { it.id == level }) return "levelId"
        if (secondary && stream.isEmpty()) return "streamId"
        return null
    }

    fun submit() {
        if (working) return
        val invalid = firstInvalid()
        if (invalid != null) {
            badField = invalid
            error = T("signupField.$invalid")
            return
        }
        badField = null
        error = null
        working = true
        val payload: JsonObject = buildJsonObject {
            put("fullName", fullName.trim())
            put("email", email.trim().lowercase())
            put("phone", Phone.normalize(phone) ?: phone)
            put("guardianPhone", Phone.normalize(guardian) ?: guardian)
            put("password", password)
            put("wilayaId", wilaya)
            put("levelId", level)
            if (secondary && stream.isNotEmpty()) put("streamId", stream) else put("streamId", JsonNull)
        }
        scope.launch {
            val failure = app.register(payload)
            working = false
            if (failure != null) {
                badField = failure.field
                error = failure.message
            }
        }
    }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .imePadding()
        ) {
            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onClose) { Text(T("cancel")) }
                Text(T("register"), fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                Spacer(Modifier.size(64.dp))
            }
            Column(
                Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.PersonAdd, null, tint = Brand.blue, modifier = Modifier.size(32.dp))
                        Spacer(Modifier.size(10.dp))
                        Text(T("signupIntro"), fontSize = 14.sp)
                    }
                }
                if (loadError != null) FailureView(loadError!!) { reload++ }
                SectionTitle(T("signupContact"))
                OutlinedTextField(fullName, { fullName = it }, label = { Text(T("signupFullName")) }, singleLine = true, isError = badField == "fullName", modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    email, { email = it }, label = { Text(T("signupEmail")) }, singleLine = true, isError = badField == "email",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    phone, { phone = it }, label = { Text(T("signupPhone")) }, singleLine = true, isError = badField == "phone",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    guardian, { guardian = it }, label = { Text(T("signupGuardianPhone")) }, singleLine = true, isError = badField == "guardianPhone",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    password, { password = it }, label = { Text(T("signupPassword")) }, singleLine = true, isError = badField == "password",
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth()
                )
                SectionTitle(T("signupStudies"))
                Picker(T("signupWilaya"), wilayas, wilaya, badField == "wilayaId") { wilaya = it }
                Picker(T("signupLevel"), levels, level, badField == "levelId") { level = it; if (levels.firstOrNull { l -> l.id == it }?.secondary != true) stream = "" }
                if (secondary) Picker(T("signupStream"), streams, stream, badField == "streamId") { stream = it }
                if (error != null) Text(error!!, color = Brand.danger, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                BigButton(if (working) T("loading") else T("signupSubmit"), enabled = !working && loadError == null) { submit() }
                TextButton(onClick = { openUrl(context, siteUrl("/privacy")) }, modifier = Modifier.fillMaxWidth()) {
                    Text(T("signupPrivacy"), fontSize = 12.sp, textAlign = TextAlign.Center)
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

/** تأكيد الهاتف كما في الموقع: رمز برسالة قصيرة، أو اتصال من الهاتف المسجّل برقم المنصة. */
@Composable
fun PhoneVerifyScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<JsonObject?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var sentTo by remember { mutableStateOf<String?>(null) }
    var cooldown by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(reload) {
        try {
            val s = app.api.getObj("/api/v1/ios/phone")
            status = s
            if (phone.isEmpty()) phone = s.str("phone") ?: ""
            if (s.bool("required") == false) {
                app.phoneRequired = false
                done = true
            }
            loadError = null
        } catch (e: ApiException) {
            app.handle(e)
            loadError = e.userMessage
        }
    }
    LaunchedEffect(cooldown) {
        if (cooldown > 0) {
            delay(1000)
            cooldown--
        }
    }

    Screen(T("phoneScreenTitle")) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            CardBox {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Brand.blue.copy(alpha = 0.12f)), contentAlignment = Alignment.Center
                    ) { Icon(Icons.Filled.PhoneAndroid, null, tint = Brand.blue) }
                    Spacer(Modifier.size(12.dp))
                    Column {
                        Text(T("phoneTitle"), fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text(T("phoneBody"), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            when {
                done -> {
                    CardBox { Text(T("phoneDone"), color = Brand.success, fontWeight = FontWeight.Bold) }
                    BigButton(T("ok")) { nav.back() }
                }
                loadError != null -> FailureView(loadError!!) { reload++ }
                status == null -> LoadingView()
                else -> {
                    val sms = status.bool("sms") ?: false
                    val callNumber = status.str("callNumber")
                    if (!sms && callNumber == null) CardBox { Text(T("phoneNoChannel")) }
                    if (sms) {
                        Text(T("phoneSmsIntro"), fontSize = 14.sp)
                        OutlinedTextField(
                            phone, { phone = it }, label = { Text(T("phoneNumber")) }, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedButton(
                            onClick = {
                                val normalized = Phone.normalize(phone)
                                if (normalized == null) {
                                    message = T("signupField.phone"); return@OutlinedButton
                                }
                                working = true
                                scope.launch {
                                    try {
                                        val r = app.api.post("/api/v1/ios/phone/request", buildJsonObject { put("phone", normalized) }).asObj()
                                        cooldown = r.int("cooldown") ?: 60
                                        sentTo = normalized
                                        message = null
                                    } catch (e: ApiException) {
                                        app.handle(e)
                                        message = e.userMessage
                                    }
                                    working = false
                                }
                            },
                            enabled = !working && cooldown == 0,
                            modifier = Modifier.fillMaxWidth()
                        ) { Text(if (cooldown > 0) Tf("phoneResend", cooldown) else T("phoneSend")) }
                        if (sentTo != null) {
                            Text(Tf("phoneSentTo", sentTo), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            OutlinedTextField(
                                code, { code = it }, label = { Text(T("phoneCode")) }, singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth()
                            )
                            BigButton(T("phoneConfirm"), enabled = !working) {
                                val digits = Phone.identifier(code)
                                if (digits.length !in 4..8) {
                                    message = T("phoneCodeInvalid"); return@BigButton
                                }
                                working = true
                                scope.launch {
                                    try {
                                        val r = app.api.post("/api/v1/ios/phone/verify", buildJsonObject { put("phone", sentTo ?: ""); put("code", digits) }).asObj()
                                        if (r.bool("verified") == true) {
                                            app.phoneRequired = false
                                            done = true
                                            app.scope.launch { app.validate() }
                                        } else message = T("phoneCodeInvalid")
                                    } catch (e: ApiException) {
                                        app.handle(e)
                                        message = e.userMessage
                                    }
                                    working = false
                                }
                            }
                        }
                    }
                    if (callNumber != null) {
                        HorizontalDivider()
                        Text(T("phoneCallIntro"), fontSize = 14.sp)
                        TextButton(onClick = { openUrl(context, "tel:" + callNumber.replace(" ", "")) }) {
                            Text(callNumber, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        }
                        OutlinedButton(onClick = {
                            scope.launch {
                                if (app.refreshPhoneGate()) done = true else message = T("phoneStillPending")
                            }
                        }, modifier = Modifier.fillMaxWidth()) { Text(T("phoneCalled")) }
                    }
                    if (message != null) Text(message!!, color = Brand.danger, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
