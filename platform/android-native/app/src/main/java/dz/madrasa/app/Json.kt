package dz.madrasa.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

/**
 * قراءة متسامحة لردود الخادم (مثل تطبيق الآيفون): حقل ناقص أو بنوع آخر لا يُسقط الشاشة،
 * بل يُقرأ كقيمة فارغة. الشيفرة تقرأ الحقول بالأسماء نفسها التي في واجهة /api/v1/ios.
 */
val JsonCodec: Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
    explicitNulls = false
}

fun parseJson(text: String): JsonElement? = try {
    JsonCodec.parseToJsonElement(text)
} catch (e: Exception) {
    null
}

private fun JsonObject?.prim(key: String): JsonPrimitive? {
    val v = this?.get(key) ?: return null
    if (v is JsonNull) return null
    return v as? JsonPrimitive
}

fun JsonObject?.str(key: String): String? = prim(key)?.content

/** نص غير فارغ أو null */
fun JsonObject?.text(key: String): String? = str(key)?.trim()?.takeIf { it.isNotEmpty() }

fun JsonObject?.int(key: String): Int? {
    val p = prim(key) ?: return null
    return p.intOrNull ?: p.doubleOrNull?.toInt() ?: p.content.toIntOrNull()
}

fun JsonObject?.long(key: String): Long? {
    val p = prim(key) ?: return null
    return p.longOrNull ?: p.doubleOrNull?.toLong()
}

fun JsonObject?.dbl(key: String): Double? {
    val p = prim(key) ?: return null
    return p.doubleOrNull ?: p.content.toDoubleOrNull()
}

fun JsonObject?.bool(key: String): Boolean? {
    val p = prim(key) ?: return null
    return p.booleanOrNull ?: when (p.content) {
        "true", "1" -> true
        "false", "0" -> false
        else -> null
    }
}

fun JsonObject?.obj(key: String): JsonObject? = this?.get(key) as? JsonObject

fun JsonObject?.arr(key: String): List<JsonElement> = (this?.get(key) as? JsonArray) ?: emptyList()

fun JsonObject?.objs(key: String): List<JsonObject> = arr(key).mapNotNull { it as? JsonObject }

fun JsonObject?.strs(key: String): List<String> =
    arr(key).mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p !is JsonNull }?.content }

fun JsonObject?.ints(key: String): List<Int> =
    arr(key).mapNotNull { (it as? JsonPrimitive)?.let { p -> p.intOrNull ?: p.doubleOrNull?.toInt() } }

fun JsonElement?.asObj(): JsonObject? = this as? JsonObject

fun JsonElement?.asText(): String? = (this as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
