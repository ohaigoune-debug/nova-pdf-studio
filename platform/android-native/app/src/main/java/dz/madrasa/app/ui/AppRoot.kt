package dz.madrasa.app.ui

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dz.madrasa.app.AppModel
import dz.madrasa.app.Phase
import dz.madrasa.app.T

private data class Tab(val key: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("home", "tabHome", Icons.Filled.Home),
    Tab("play", "tabPlay", Icons.Filled.SportsEsports),
    Tab("planner", "tabPlanner", Icons.Filled.CalendarMonth),
    Tab("account", "tabAccount", Icons.Filled.AccountCircle)
)

@Composable
fun AppRoot(app: AppModel) {
    MadrasaTheme(app.appearance) {
        CompositionLocalProvider(LocalApp provides app) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
            ) {
                when (app.phase) {
                    Phase.LAUNCHING -> Box(
                        Modifier
                            .fillMaxSize()
                            .background(Brand.navy), contentAlignment = Alignment.Center
                    ) { CircularProgressIndicator(color = Color.White) }
                    Phase.SIGNED_OUT -> SignedOutRoot()
                    Phase.READY -> MainTabs(app)
                }
                val notice = app.notice
                if (notice != null) {
                    AlertDialog(
                        onDismissRequest = { app.notice = null },
                        confirmButton = { TextButton(onClick = { app.notice = null }) { Text(T("ok")) } },
                        title = { Text(T("notice")) },
                        text = { Text(notice) }
                    )
                }
            }
        }
    }
}

@Composable
private fun MainTabs(app: AppModel) {
    val controller = rememberNavController()
    val entry by controller.currentBackStackEntryAsState()
    val destination = entry?.destination
    val route = destination?.route ?: ""
    val immersive = route.contains("/run/") || route.contains("/cardlesson/") || route.contains("/video/")

    fun open(tab: String) {
        controller.navigate("tab_$tab") {
            popUpTo(controller.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    LaunchedEffect(app.pendingTab) {
        val tab = app.pendingTab
        if (tab != null) {
            app.pendingTab = null
            open(tab)
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (!immersive) NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEach { tab ->
                    val selected = destination?.hierarchy?.any { it.route == "tab_${tab.key}" } == true
                    val badge = when (tab.key) {
                        "play" -> app.play.pendingCount
                        "account" -> app.supportWaiting
                        else -> 0
                    }
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            if (selected) controller.popBackStack("${tab.key}/root", inclusive = false)
                            else open(tab.key)
                        },
                        icon = {
                            if (badge > 0) BadgedBox(badge = { Badge { Text(badge.toString()) } }) { Icon(tab.icon, null) }
                            else Icon(tab.icon, null)
                        },
                        label = { Text(T(tab.label)) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = controller,
            startDestination = "tab_home",
            modifier = Modifier.padding(padding),
            enterTransition = { EnterTransition.None },
            exitTransition = { ExitTransition.None }
        ) {
            tabGraph(controller, "home") { HomeScreen() }
            tabGraph(controller, "play") { PlayHomeScreen() }
            tabGraph(controller, "planner") { PlannerScreen() }
            tabGraph(controller, "account") { AccountScreen() }
        }
    }
}

/** كل تبويب رسمٌ تنقّل مستقل له الشاشات المشتركة نفسها، فيبقى مكدّس كل باب كما تركه التلميذ. */
private fun NavGraphBuilder.tabGraph(controller: NavHostController, tab: String, root: @Composable () -> Unit) {
    navigation(startDestination = "$tab/root", route = "tab_$tab") {
        fun screen(path: String, args: List<String> = emptyList(), body: @Composable (Map<String, String>) -> Unit) {
            val query = path.substringAfter('?', "")
            composable(
                "$tab/$path",
                arguments = args.map { name ->
                    navArgument(name) {
                        type = NavType.StringType
                        // معاملات الاستعلام اختيارية؛ معاملات المسار إلزامية
                        if (query.contains("{$name}")) {
                            nullable = true
                            defaultValue = null
                        }
                    }
                }
            ) { e ->
                val values = args.associateWith { (e.arguments?.getString(it) ?: "") }
                CompositionLocalProvider(LocalNav provides Nav(controller, tab)) { body(values) }
            }
        }
        screen("root") { root() }
        screen("courses") { MyCoursesScreen() }
        screen("course/{slug}", listOf("slug")) { CourseScreen(it.getValue("slug")) }
        screen("lesson/{slug}", listOf("slug")) { LessonScreen(it.getValue("slug")) }
        screen("free") { FreeLessonsScreen() }
        screen("bac") { BacBankScreen() }
        screen("bacpaper/{id}", listOf("id")) { PaperScreen(it.getValue("id"), bac = true) }
        screen("tests") { TestsBankScreen() }
        screen("paper/{id}", listOf("id")) { PaperScreen(it.getValue("id"), bac = false) }
        screen("classroom?group={group}", listOf("group")) { ClassroomScreen(it.getValue("group").ifEmpty { null }) }
        screen("pdf?key={key}&title={title}&path={path}&save={save}", listOf("key", "title", "path", "save")) {
            PdfScreen(it.getValue("key"), it.getValue("title"), it.getValue("path"), it.getValue("save") == "1")
        }
        screen("subject/{code}?name={name}&lang={lang}", listOf("code", "name", "lang")) {
            SubjectScreen(it.getValue("code"), it.getValue("name"), it.getValue("lang"))
        }
        screen("set/{id}", listOf("id")) { SetScreen(it.getValue("id")) }
        screen("run/{id}", listOf("id")) { RunnerScreen(it.getValue("id")) }
        screen("cardlesson/{id}", listOf("id")) { CardGameScreen(it.getValue("id")) }
        screen("downloads") { DownloadsScreen() }
        screen("orders") { OrdersScreen() }
        screen("support") { SupportScreen() }
        screen("ticket/{id}", listOf("id")) { TicketScreen(it.getValue("id")) }
        screen("newticket") { NewTicketScreen() }
        screen("deleteaccount") { DeleteAccountScreen() }
        screen("phone") { PhoneVerifyScreen() }
        screen("timetable") { TimetableScreen() }
        screen("task?id={id}", listOf("id")) { TaskEditScreen(it.getValue("id").ifEmpty { null }) }
    }
}
