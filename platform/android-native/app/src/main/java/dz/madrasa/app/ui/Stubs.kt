package dz.madrasa.app.ui

import androidx.compose.runtime.Composable

@Composable
fun ClassroomScreen(group: String?) {
    Screen("ClassroomScreen") { }
}

@Composable
fun PlayHomeScreen() {
    Screen("PlayHomeScreen") { }
}

@Composable
fun SubjectScreen(code: String, name: String, lang: String) {
    Screen("SubjectScreen") { }
}

@Composable
fun SetScreen(id: String) {
    Screen("SetScreen") { }
}

@Composable
fun RunnerScreen(id: String) {
    Screen("RunnerScreen") { }
}

@Composable
fun CardGameScreen(id: String) {
    Screen("CardGameScreen") { }
}

@Composable
fun OrdersScreen() {
    Screen("OrdersScreen") { }
}

@Composable
fun SupportScreen() {
    Screen("SupportScreen") { }
}

@Composable
fun TicketScreen(id: String) {
    Screen("TicketScreen") { }
}

@Composable
fun NewTicketScreen() {
    Screen("NewTicketScreen") { }
}

@Composable
fun DeleteAccountScreen() {
    Screen("DeleteAccountScreen") { }
}

@Composable
fun TimetableScreen() {
    Screen("TimetableScreen") { }
}

@Composable
fun TaskEditScreen(id: String?) {
    Screen("TaskEditScreen") { }
}

@Composable
fun PlannerScreen() {
    Screen("PlannerScreen") { }
}

@Composable
fun AccountScreen() {
    Screen("AccountScreen") { }
}
