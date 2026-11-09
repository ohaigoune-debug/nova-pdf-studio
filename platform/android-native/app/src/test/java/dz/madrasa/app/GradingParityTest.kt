package dz.madrasa.app

import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * التصحيح على الهاتف يطابق الخادم: العيّنات نفسها التي يختبر بها تطبيق الآيفون
 * (حزمة من خمسة مواضيع منشورة، ونتائج الخادم scoreSteps لثلاث مجموعات إجابات،
 * وحالات لعبة البطاقات كما صحّحها gradePlayAnswer).
 */
class GradingParityTest {
    private fun fixture(name: String): JsonObject {
        val text = javaClass.classLoader!!.getResource("$name.json")!!.readText(Charsets.UTF_8)
        return parseJson(text).asObj()!!
    }

    private fun envelope(name: String): JsonObject = fixture(name).obj("data") ?: fixture(name)

    @Test
    fun packageDecodesEveryStep() {
        val pkg = PlayPackage.parse(envelope("play-package"))
        assertNotNull(pkg)
        val expected = fixture("play-expected")
        assertEquals(expected.dbl("max")!!, pkg!!.steps.sumOf { it.points }, 1e-9)
        assertEquals(expected.dbl("max")!!, pkg.maxScore, 1e-9)
    }

    @Test
    fun scoresExactlyLikeTheServer() {
        val pkg = PlayPackage.parse(envelope("play-package"))!!
        val expected = fixture("play-expected")
        for (case in listOf("correct", "mixed", "empty")) {
            val c = expected.obj(case)!!
            val answers = c["answers"].answerMap()
            assertEquals(case, c.dbl("score")!!, PlayGrading.score(pkg, answers).score, 1e-9)
        }
        assertEquals(10.0, PlayGrading.scaled(Score(0.5, 1.0), 20.0), 1e-9)
    }

    @Test
    fun cardsGradeExactlyLikeTheServer() {
        val pack = CardPack.parse(envelope("cards-pack"))!!
        assertEquals(4, pack.questions.size)
        val cases = fixture("cards-expected").objs("cases")
        assertEquals(11, cases.size)
        for (c in cases) {
            val q = pack.questions.first { it.id == c.str("questionId") }
            val answer = CardAnswer.fromJson(c.obj("answer"))
            val g = CardGrading.grade(q, answer)
            assertEquals(c.toString(), c.bool("isCorrect")!!, g.isCorrect)
            assertEquals(c.toString(), c.dbl("score")!!, g.score, 1e-9)
        }
        assertFalse(CardGrading.grade(pack.questions[0], null).isCorrect)
    }

    @Test
    fun answersEncodeAsTheSyncSchema() {
        assertEquals("""{"type":"MCQ","key":"b"}""", CardAnswer.Mcq("b").toJson().toString())
        assertEquals("""{"type":"mcq","choice":2}""", StepAnswer.Mcq(2).toJson().toString())
        assertEquals("""{"type":"fill_blank","blanks":["أ","ب"]}""", StepAnswer.Fill(listOf("أ", "ب")).toJson().toString())
    }

    @Test
    fun arabicNormalisationMatchesTheServer() {
        assertEquals(PlayGrading.normalizeArabic("الصلاة"), PlayGrading.normalizeArabic("الصَّلاةُ"))
        assertEquals("اسد", PlayGrading.normalizeArabic("أسد"))
        assertTrue(PlayGrading.normalizeArabic("  مرحبا،   بك ") == "مرحبا بك")
    }

    @Test
    fun roundPickingIsStableAndBounded() {
        val pack = CardPack.parse(envelope("cards-pack"))!!
        val a = CardGrading.pickRound(pack, 3, emptyMap(), 42)
        val b = CardGrading.pickRound(pack, 3, emptyMap(), 42)
        assertEquals(a.map { it.id }, b.map { it.id })
        assertEquals(3, a.size)
    }

    @Test
    fun algerianPhonesNormalise() {
        assertEquals("0661234567", Phone.normalize("+213 661 23 45 67"))
        assertEquals("0551234567", Phone.normalize("٠٥٥١٢٣٤٥٦٧"))
        assertEquals(null, Phone.normalize("0412345678"))
    }

    @Test
    fun weeklyTimetableFollowsTheStreamWeights() {
        val q = Timetable.quotas(StudyStream.LITERATURE, 26)
        assertEquals(26, q.values.sum())
        assertTrue((q[RevisionSubject.ARABIC] ?: 0) >= (q[RevisionSubject.MATH] ?: 0))
    }
}
