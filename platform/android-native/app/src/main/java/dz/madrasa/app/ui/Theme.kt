package dz.madrasa.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

/** ألوان هوية «مدرسة» (نفسها في تطبيق الآيفون): كحلي وأزرق وأبيض دافئ. */
object Brand {
    val navy = Color(0xFF0C1F4A)
    val blue = Color(0xFF1457C5)
    val sky = Color(0xFFD5E4FC)
    val warm = Color(0xFFFBFAF6)
    val success = Color(0xFF16803D)
    val danger = Color(0xFFB91C1C)
    val teal = Color(0xFF00737A)
    val tealLight = Color(0xFF0D9994)
    val violet = Color(0xFF6B40BF)
    val violetLight = Color(0xFF8C5CDB)
    val navyLight = Color(0xFF294085)
    val blueLight = Color(0xFF337AE6)
    val green = Color(0xFF16803D)
    val greenLight = Color(0xFF2E9E5C)
    val amber = Color(0xFFB45309)
}

private val LightColors = lightColorScheme(
    primary = Brand.blue,
    onPrimary = Color.White,
    primaryContainer = Brand.sky,
    onPrimaryContainer = Brand.navy,
    secondary = Brand.navy,
    onSecondary = Color.White,
    background = Color(0xFFF2F4F8),
    onBackground = Color(0xFF111827),
    surface = Color.White,
    onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFEFF2F7),
    onSurfaceVariant = Color(0xFF4B5563),
    error = Brand.danger,
    outline = Color(0xFFD1D9E6)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF7FA8F5),
    onPrimary = Color(0xFF06142F),
    primaryContainer = Color(0xFF1B3A73),
    onPrimaryContainer = Color(0xFFD5E4FC),
    secondary = Color(0xFFB9C8EA),
    background = Color(0xFF0B1220),
    onBackground = Color(0xFFE5E7EB),
    surface = Color(0xFF141C2E),
    onSurface = Color(0xFFE5E7EB),
    surfaceVariant = Color(0xFF1C2639),
    onSurfaceVariant = Color(0xFFA7B0C0),
    error = Color(0xFFF87171),
    outline = Color(0xFF334155)
)

@Composable
fun MadrasaTheme(appearance: String, content: @Composable () -> Unit) {
    val dark = when (appearance) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors) {
        // الواجهة عربية من اليمين إلى اليسار أيًّا كانت لغة الهاتف
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            content()
        }
    }
}
