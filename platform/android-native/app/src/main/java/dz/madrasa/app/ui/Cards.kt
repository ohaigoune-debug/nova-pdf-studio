package dz.madrasa.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dz.madrasa.app.ApiException
import dz.madrasa.app.CardAnswer
import dz.madrasa.app.CardAnswerRecord
import dz.madrasa.app.CardGrade
import dz.madrasa.app.CardGrading
import dz.madrasa.app.CardKey
import dz.madrasa.app.CardPack
import dz.madrasa.app.CardPayload
import dz.madrasa.app.CardQuestion
import dz.madrasa.app.CardSegment
import dz.madrasa.app.R
import dz.madrasa.app.T
import dz.madrasa.app.Tf
import kotlin.math.roundToInt

/** لعبة البطاقات: جولة من أسئلة الدرس، بطاقة بعد بطاقة؛ اضغط ظهر البطاقة فتنقلب وأجب على وجهها الأبيض. */
@Composable
fun CardGameScreen(id: String) {
    val app = LocalApp.current
    val nav = LocalNav.current
    var pack by remember { mutableStateOf<CardPack?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var round by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        try {
            pack = app.play.openCardLesson(id)
        } catch (e: ApiException) {
            error = if (e.kind == ApiException.Kind.OFFLINE) T("setNeedsInternet") else e.userMessage
        }
    }
    Surface(Modifier.fillMaxSize().statusBarsPadding(), color = MaterialTheme.colorScheme.background) {
        val p = pack
        when {
            error != null -> Column(Modifier.padding(16.dp)) { FailureView(error!!) { nav.back() } }
            p == null -> LoadingView(T("preparingCards"))
            p.questions.isEmpty() -> Column(Modifier.padding(16.dp)) {
                EmptyView(T("playNoCards"))
                OutlinedButton(onClick = { nav.back() }, modifier = Modifier.fillMaxWidth()) { Text(T("close")) }
            }
            else -> key(round) { CardRoundView(p, onClose = { nav.back() }, again = { round++ }) }
        }
    }
}

private class CardDraft {
    var key by mutableStateOf<String?>(null)
    val blanks = mutableStateMapOf<Int, String>()
    var order by mutableStateOf<List<String>>(emptyList())
    val matches = mutableStateMapOf<String, String>()
}

private fun answerOf(payload: CardPayload, d: CardDraft): CardAnswer? = when (payload) {
    is CardPayload.Mcq -> d.key?.let { CardAnswer.Mcq(it) }
    is CardPayload.Fill -> (0 until payload.blanks).map { d.blanks[it] ?: "" }.takeIf { l -> l.all { it.isNotEmpty() } }?.let { CardAnswer.Fill(it) }
    is CardPayload.Ordering -> d.order.takeIf { it.size == payload.items.size }?.let { CardAnswer.Ordering(it) }
    is CardPayload.Matching -> if (d.matches.size == payload.lefts.size) CardAnswer.Matching(d.matches.toMap()) else null
}

@Composable
private fun CardRoundView(pack: CardPack, onClose: () -> Unit, again: () -> Unit) {
    val app = LocalApp.current
    val seed = remember { System.currentTimeMillis() }
    val questions = remember { CardGrading.pickRound(pack, pack.roundSize, app.play.index.cardMemory, seed) }
    var index by remember { mutableIntStateOf(0) }
    var revealed by remember { mutableStateOf(false) }
    val results = remember { mutableStateMapOf<String, CardGrade>() }
    val records = remember { mutableStateListOf<CardAnswerRecord>() }
    var startedAt by remember { mutableStateOf(System.currentTimeMillis()) }
    var finishedRound by remember { mutableStateOf<String?>(null) }
    var estimated by remember { mutableIntStateOf(0) }

    val doneId = finishedRound
    if (doneId != null) {
        val r = app.play.round(doneId)
        RoundSummary(pack, records.count { it.correct }, records.size, r?.xpEarned ?: estimated, r?.pending ?: true, r?.lessonMastered == true, onClose, again)
        return
    }

    val q = questions[index.coerceAtMost(questions.size - 1)]
    val shown = remember(q.id) { CardGrading.shuffled(q.payload, seed + q.id.hashCode()) }
    val draft = remember(q.id) { CardDraft() }
    val grade = results[q.id]

    fun next() {
        if (index + 1 < questions.size) {
            index++
            revealed = false
            startedAt = System.currentTimeMillis()
        } else {
            estimated = CardGrading.estimatedXp(questions, results.toMap(), pack.xp, complete = records.size == questions.size)
            finishedRound = app.play.finishRound(pack, records.toList(), estimated)?.id ?: "local"
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .navigationBarsPadding()
    ) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.Filled.Close, T("close")) }
            LinearProgressIndicator(
                progress = { (index + if (grade != null) 1 else 0).toFloat() / questions.size },
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp), color = Brand.blue
            )
            Text(Tf("cardOf", index + 1, questions.size), fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Text(pack.lessonName, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 16.dp))
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            val flip by animateFloatAsState(if (revealed) 180f else 0f, tween(450), label = "flip")
            if (flip < 90f) {
                CardBack(Modifier.graphicsLayer { rotationY = flip; cameraDistance = 12f * density }) { revealed = true }
            } else {
                Column(
                    Modifier
                        .graphicsLayer { rotationY = flip - 180f; cameraDistance = 12f * density }
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color.White)
                        .border(2.dp, Brand.sky, RoundedCornerShape(24.dp))
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Chip(
                            when (q.difficulty) {
                                "EASY" -> T("difficultyEasy"); "HARD" -> T("difficultyHard"); else -> T("difficultyMedium")
                            },
                            when (q.difficulty) {
                                "EASY" -> Brand.success; "HARD" -> Brand.danger; else -> Brand.amber
                            }
                        )
                    }
                    CompositionLocalProvider(LocalLayoutDirection provides if (q.isLeftToRight) LayoutDirection.Ltr else LayoutDirection.Rtl) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(q.text, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 28.sp, color = Brand.navy)
                            CardInteraction(q, shown, draft, locked = grade != null)
                        }
                    }
                }
                if (grade != null) FeedbackView(q.correctText, q.explanation, grade.score.let { if (grade.isCorrect) 1.0 else it })
            }
        }
        if (revealed) Row(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (grade == null) {
                OutlinedButton(onClick = { next() }, modifier = Modifier.heightIn(min = 50.dp)) { Text(T("skip")) }
                Button(
                    onClick = {
                        val a = answerOf(shown, draft) ?: return@Button
                        val g = CardGrading.grade(q, a)
                        results[q.id] = g
                        records.add(CardAnswerRecord(q.id, a.toJson(), (System.currentTimeMillis() - startedAt).toInt().coerceAtMost(3_600_000), g.isCorrect))
                    },
                    enabled = answerOf(shown, draft) != null,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 50.dp),
                    shape = RoundedCornerShape(14.dp)
                ) { Text(T("check"), fontWeight = FontWeight.Bold) }
            } else {
                Button(
                    onClick = { next() }, modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 50.dp), shape = RoundedCornerShape(14.dp)
                ) { Text(if (index + 1 < questions.size) T("nextCard") else T("finish"), fontWeight = FontWeight.Bold) }
            }
        }
    }
}

/** ظهر البطاقة: بطاقة زرقاء في إطار أبيض (الشكل المعتمد) */
@Composable
private fun CardBack(modifier: Modifier, onTap: () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(0.72f)
            .clip(RoundedCornerShape(26.dp))
            .background(Color.White)
            .border(2.dp, Brand.sky, RoundedCornerShape(26.dp))
            .clickable { onTap() }
            .padding(14.dp)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(Brand.blue, Brand.navy))),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(painterResource(R.mipmap.ic_launcher_foreground), null, modifier = Modifier.size(120.dp))
            Text("مدرسة PLAY", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Spacer(Modifier.size(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.TouchApp, null, tint = Color.White.copy(alpha = 0.85f))
                Text(" " + T("tapToReveal"), color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CardInteraction(q: CardQuestion, payload: CardPayload, d: CardDraft, locked: Boolean) {
    when (payload) {
        is CardPayload.Mcq -> {
            val correct = (q.key as? CardKey.Mcq)?.correct
            payload.options.forEach { o ->
                val sel = d.key == o.key
                val state = if (locked) (if (o.key == correct) true else if (sel) false else null) else null
                val border = when (state) {
                    true -> Brand.success; false -> Brand.danger; null -> if (sel) Brand.blue else Color(0xFFD1D9E6)
                }
                Text(
                    o.text, fontSize = 16.sp, color = Brand.navy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .border(if (sel || state != null) 2.dp else 1.dp, border, RoundedCornerShape(14.dp))
                        .background(if (sel) Brand.blue.copy(alpha = 0.08f) else Color.White)
                        .clickable(enabled = !locked) { d.key = o.key }
                        .padding(14.dp)
                )
            }
        }
        is CardPayload.Fill -> {
            var active by remember(q.id) { mutableIntStateOf(0) }
            FlowRow(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                payload.segments.forEach { s ->
                    when (s) {
                        is CardSegment.Text -> Text(s.text, fontSize = 17.sp, color = Brand.navy)
                        is CardSegment.Blank -> {
                            val v = d.blanks[s.index]
                            Text(
                                v?.ifEmpty { null } ?: "  ${s.index + 1}  ",
                                fontSize = 16.sp, fontWeight = FontWeight.Bold,
                                color = if (v.isNullOrEmpty()) Color.Gray else Brand.blue,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .border(2.dp, if (active == s.index) Brand.blue else Color(0xFFD1D9E6), RoundedCornerShape(8.dp))
                                    .clickable(enabled = !locked) { active = s.index; d.blanks[s.index] = "" }
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                payload.bank.forEach { w ->
                    FilterChip(
                        selected = d.blanks.values.contains(w), enabled = !locked,
                        onClick = {
                            d.blanks[active] = w
                            val nextEmpty = (0 until payload.blanks).firstOrNull { d.blanks[it].isNullOrEmpty() }
                            if (nextEmpty != null) active = nextEmpty
                        },
                        label = { Text(w) }
                    )
                }
            }
        }
        is CardPayload.Ordering -> {
            Text(T("tryOrder"), fontSize = 13.sp, color = Color.Gray)
            d.order.forEachIndexed { pos, k ->
                val item = payload.items.firstOrNull { it.key == k }?.text ?: ""
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Brand.blue), contentAlignment = Alignment.Center
                    ) { Text("${pos + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                    Spacer(Modifier.width(8.dp))
                    Text(item, fontSize = 15.sp, color = Brand.navy)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                payload.items.forEach { o ->
                    if (o.key !in d.order) FilterChip(selected = false, enabled = !locked, onClick = { d.order = d.order + o.key }, label = { Text(o.text) })
                }
            }
            if (!locked && d.order.isNotEmpty()) TextButton(onClick = { d.order = emptyList() }) {
                Icon(Icons.Filled.Refresh, null); Text(" " + T("reset"))
            }
            if (locked) (q.key as? CardKey.Ordering)?.let { k ->
                Text("✓ " + k.order.mapNotNull { key -> payload.items.firstOrNull { it.key == key }?.text }.joinToString(" ← "), color = Brand.success, fontSize = 13.sp)
            }
        }
        is CardPayload.Matching -> {
            Text(T("chooseMatch"), fontSize = 13.sp, color = Color.Gray)
            val pairs = (q.key as? CardKey.Matching)?.pairs ?: emptyMap()
            payload.lefts.forEach { left ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Brand.sky.copy(alpha = 0.35f))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(left.text, fontWeight = FontWeight.SemiBold, color = Brand.navy)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        payload.rights.forEach { right ->
                            FilterChip(selected = d.matches[left.key] == right.key, enabled = !locked, onClick = { d.matches[left.key] = right.key }, label = { Text(right.text) })
                        }
                    }
                    if (locked && pairs[left.key] != null && pairs[left.key] != d.matches[left.key]) {
                        Text("✓ " + (payload.rights.firstOrNull { it.key == pairs[left.key] }?.text ?: ""), color = Brand.success, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun RoundSummary(pack: CardPack, correct: Int, answered: Int, xp: Int, pending: Boolean, mastered: Boolean, onClose: () -> Unit, again: () -> Unit) {
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
        Text(T("roundDone"), fontWeight = FontWeight.Bold, fontSize = 24.sp)
        Text(pack.lessonName, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text("$correct / $answered", fontWeight = FontWeight.Bold, fontSize = 40.sp, color = Brand.blue)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Star, null, tint = Brand.amber)
            Text(" +$xp XP", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Brand.amber)
        }
        if (answered > 0) LinearProgressIndicator(progress = { correct.toFloat() / answered }, modifier = Modifier.fillMaxWidth(), color = Brand.success)
        if (mastered) Chip(T("lessonMasteredNow"), Brand.success, Icons.Filled.EmojiEvents)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (pending) Icons.Filled.CloudUpload else Icons.Filled.CloudDone, null, tint = if (pending) Brand.amber else Brand.success)
            Text("  " + if (pending) T("resultPending") else T("resultSynced"), fontSize = 13.sp)
        }
        BigButton(T("newRound"), color = Brand.violet) { again() }
        OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(T("close")) }
        Text("${(if (answered > 0) correct * 100f / answered else 0f).roundToInt()}٪", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
