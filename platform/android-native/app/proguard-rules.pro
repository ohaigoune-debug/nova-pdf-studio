# kotlinx.serialization: سجلات التطبيق المحلية (المنظّم، PLAY، الملفات)
-keepattributes *Annotation*, InnerClasses, Signature
-dontnote kotlinx.serialization.**
-keep,includedescriptorclasses class dz.madrasa.app.**$$serializer { *; }
-keepclassmembers class dz.madrasa.app.** {
    *** Companion;
}
-keepclasseswithmembers class dz.madrasa.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# OkHttp
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
# واجهة جافاسكربت في مشغّل الفيديو
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
