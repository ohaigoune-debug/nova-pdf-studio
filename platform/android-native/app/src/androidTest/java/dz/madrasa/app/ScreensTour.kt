package dz.madrasa.app

import android.graphics.Bitmap
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * جولة على كل شاشات التطبيق بلقطات شاشة (للمراجعة البصرية مقابل تطبيق الآيفون):
 * أولًا التسجيل مع الخادم الحقيقي (قوائم الولايات والمستويات من madrasadz.com)، ثم كل الشاشات بالخادم التجريبي.
 * اللقطات في files/shots من مجلد التطبيق، ويسحبها سير العمل في GitHub.
 */
@RunWith(AndroidJUnit4::class)
class ScreensTour {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    private val target = InstrumentationRegistry.getInstrumentation().targetContext
    private val dir = File(target.filesDir, "shots").apply { deleteRecursively(); mkdirs() }
    private val report = StringBuilder()
    private var n = 0

    private fun shot(name: String) {
        rule.waitForIdle()
        Thread.sleep(900)
        val bmp: Bitmap? = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        n++
        bmp?.let { File(dir, "%02d-%s.png".format(n, name)).outputStream().use { o -> it.compress(Bitmap.CompressFormat.PNG, 90, o) } }
    }

    private fun waitText(text: String, timeout: Long = 15_000) {
        rule.waitUntil(timeout) { rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun tap(text: String, index: Int = 0) {
        waitText(text)
        rule.onAllNodesWithText(text, substring = true)[index].performClick()
        rule.waitForIdle()
    }

    private fun back() {
        Espresso.pressBack()
        rule.waitForIdle()
        Thread.sleep(300)
    }

    private fun step(name: String, block: () -> Unit) {
        try {
            block()
            report.append("OK   $name\n")
        } catch (t: Throwable) {
            report.append("FAIL $name: ${t.javaClass.simpleName}: ${t.message?.take(300)}\n")
            try { shot("FAIL-$name") } catch (_: Throwable) {}
        }
    }

    @Test
    fun tour() {
        step("login-screen") { waitText(T("register")); shot("login") }

        // الخادم الحقيقي: نموذج التسجيل يجلب الولايات والمستويات من madrasadz.com
        step("signup-real-server") {
            tap(T("register"))
            waitText(T("signupSubmit"))
            Thread.sleep(6000)
            shot("signup-real")
            tap(T("signupWilaya"))
            Thread.sleep(1500)
            shot("signup-wilayas-real")
            back()
            back()
        }

        // الخادم التجريبي لبقية الجولة
        Fixtures.install(target)
        step("login") {
            waitText(T("register"))
            val fields = rule.onAllNodes(hasSetTextAction())
            fields[0].performTextInput("0661234567")
            fields[1].performTextInput("password123")
            tap(T("signIn"), 1)
            waitText(T("myCourses"))
            shot("home")
        }
        step("my-courses") {
            tap(T("myCourses"))
            waitText("بكالوريا تجريبية")
            shot("courses")
            tap("بكالوريا تجريبية")
            waitText(T("section.lessons"))
            shot("course")
        }
        step("lesson-text") {
            tap("المدخل")
            waitText("مقدمة")
            shot("lesson-text")
            back()
        }
        step("lesson-video") {
            tap("شرح")
            Thread.sleep(3000)
            shot("lesson-video")
            back()
        }
        step("lesson-pdf") {
            tap("ملخص الدرس")
            waitText(T("lessonShowPDF"))
            shot("lesson-pdf")
            back(); back(); back()
        }
        step("bac-bank") {
            tap(T("bacBankShort"))
            waitText("بكالوريا 2024")
            shot("bac-bank")
            tap("بكالوريا 2024")
            waitText(T("bacSolution"))
            shot("bac-paper")
            back(); back()
        }
        step("tests-bank") {
            tap(T("testsBank"))
            waitText(T("chooseTerm"))
            shot("tests-terms")
            tap(T("term1"))
            waitText("الثالثة ثانوي")
            shot("tests-years")
            tap("الثالثة ثانوي")
            waitText(T("chooseSubject"))
            shot("tests-subjects")
            tap("اللغة العربية")
            waitText("الفرض الأول")
            shot("tests-list")
            back(); back(); back(); back()
        }
        step("free-lessons") {
            tap(T("freeLessons"))
            waitText("منهجية المقالة")
            shot("free-lessons")
            back()
        }
        step("classroom") {
            tap(T("generalClassroom"))
            waitText("منهجية المقالة")
            shot("classroom")
            back()
        }
        step("play-home") {
            tap(T("tabPlay"))
            waitText(T("playSubjects"))
            shot("play-home")
        }
        step("play-subject-lessons") {
            tap("اللغة العربية")
            waitText("الصور البيانية")
            shot("play-lessons")
        }
        step("play-cards") {
            tap("الصور البيانية")
            waitText(T("tapToReveal"))
            shot("cards-back")
            tap(T("tapToReveal"))
            Thread.sleep(800)
            shot("cards-face")
            back()
        }
        step("play-bac-sets") {
            tap(T("kindBac"))
            waitText("الموضوع الأول")
            shot("play-sets")
            tap("الموضوع الأول")
            waitText(T("startSet"))
            shot("set")
            tap(T("startSet"))
            waitText(Tf("stepOf", 1, 14))
            shot("runner")
            back(); back(); back()
        }
        step("planner") {
            tap(T("tabPlanner"))
            waitText(T("timetableTitle"))
            shot("planner")
            tap(T("timetableTitle"))
            waitText(T("timetableStream"))
            shot("timetable")
            back()
        }
        step("account") {
            tap(T("tabAccount"))
            waitText(T("myOrders"))
            shot("account")
            tap(T("myOrders"))
            waitText("MD-1042")
            shot("orders")
            back()
            tap(T("supportTitle"))
            waitText("تأخّر كتاب")
            shot("support")
            back()
        }

        File(dir, "report.txt").writeText(report.toString())
    }
}
