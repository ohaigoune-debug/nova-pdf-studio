#!/usr/bin/env bash
# بناء ملف AAB موقّع لتطبيق «مدرسة» الأصيل (أندرويد) على خادم المالك — للرفع على مسار الاختبار المغلق Alpha نفسه.
#
#   rm -rf /opt/madrasa/android-native-src \
#     && git clone --depth 1 -b android-parity https://github.com/ohaigoune-debug/nova-pdf-studio /opt/madrasa/android-native-src \
#     && bash /opt/madrasa/android-native-src/platform/android-native/scripts/build-aab-on-server.sh
#
# ما يفعله، وما لا يفعله:
#   - يبني من نسخة مستقلة من الفرع (android-native-src)، فلا يلمس /opt/madrasa/platform ولا تعديلاته المحلية ولا يعمل pull هناك.
#   - يستعمل مفتاح التوقيع الموجود في /opt/madrasa/android-key للقراءة فقط (مُركَّب read-only داخل Docker):
#     لا ينسخه، ولا يغيّره، ولا يكتب شيئًا في مجلده، ولا يطبع كلمة سرّه.
#   - رقم الإصدار من gradle.properties في الفرع: versionCode 8 و versionName 1.1.0 (أكبر من 7 على Play).
#   - لا ينشر شيئًا على الموقع ولا يغيّر .env ولا البصمات.
#   - يضع الملفين في /opt/madrasa/android-release:
#       madrasa-<الإصدار>-native.aab  ← يُرفع على Play Console (الاختبار المغلق Alpha)
#       madrasa-<الإصدار>-native.apk  ← للتجربة على هاتفك قبل الرفع (موقّع بالمفتاح نفسه فيُثبَّت فوق النسخة الحالية)
set -euo pipefail

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
KEYDIR=${ANDROID_KEY_DIR:-/opt/madrasa/android-key}
RELDIR=${ANDROID_RELEASE_DIR:-/opt/madrasa/android-release}
JDK_IMAGE=${JDK_IMAGE:-eclipse-temurin:17-jdk}
ALIAS=${ANDROID_KEY_ALIAS_NAME:-madrasa}

[ -f "$PROJECT/gradlew" ] || die "لم أجد مشروع android-native في $PROJECT"
[ -r "$KEYDIR/madrasa.keystore" ] || die "لم أجد مفتاح التوقيع في $KEYDIR (لا يُنشأ مفتاح جديد هنا: التطبيق على Play موقّع بالمفتاح الموجود)"
[ -r "$KEYDIR/password" ] || die "لم أجد ملف كلمة السر في $KEYDIR"
command -v docker >/dev/null || die "Docker غير مثبّت"

NAME=$(sed -n 's/^madrasaVersionName=//p' "$PROJECT/gradle.properties")
CODE=$(sed -n 's/^madrasaVersionCode=//p' "$PROJECT/gradle.properties")
[ "${CODE:-0}" -gt 7 ] || die "versionCode يجب أن يكون أكبر من 7 (الموجود: $CODE)"

say "بناء «مدرسة» الأصيل — الإصدار $NAME (رقم $CODE) — المرة الأولى قد تأخذ 10–15 دقيقة"
rm -rf "$PROJECT/app/build/outputs"
# كلمة السر تُقرأ إلى متغيّر بيئة يُمرَّر إلى الحاوية فقط، ولا تُطبع
export ANDROID_KEYSTORE_PASSWORD
ANDROID_KEYSTORE_PASSWORD=$(cat "$KEYDIR/password")
export ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
docker run --rm \
  -e ANDROID_KEYSTORE_PASSWORD -e ANDROID_KEY_PASSWORD \
  -e ANDROID_KEYSTORE_PATH=/k/madrasa.keystore -e ANDROID_KEY_ALIAS="$ALIAS" \
  -v "$PROJECT:/src" -v "$KEYDIR:/k:ro" \
  -v madrasa-android-sdk:/sdk -v madrasa-android-gradle:/root/.gradle \
  -w /src "$JDK_IMAGE" bash -euo pipefail -c '
    export ANDROID_HOME=/sdk ANDROID_SDK_ROOT=/sdk
    SM=/sdk/cmdline-tools/latest/bin/sdkmanager
    if [ ! -x "$SM" ]; then
      echo "تنزيل أدوات أندرويد…"
      command -v unzip >/dev/null && command -v curl >/dev/null \
        || { apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null; }
      for v in 13114758 11076708; do
        curl -fsSL -o /tmp/ct.zip "https://dl.google.com/android/repository/commandlinetools-linux-${v}_latest.zip" && break
      done
      rm -rf /sdk/cmdline-tools && mkdir -p /sdk/cmdline-tools
      unzip -q /tmp/ct.zip -d /sdk/cmdline-tools && mv /sdk/cmdline-tools/cmdline-tools /sdk/cmdline-tools/latest
    fi
    (yes | "$SM" --licenses >/dev/null 2>&1) || true
    "$SM" --install "platforms;android-36" "build-tools;35.0.0" >/dev/null
    chmod +x gradlew
    ./gradlew --no-daemon --console=plain printSigningReady bundleRelease assembleRelease
    # تحقّق من التوقيع (البصمة العامة للشهادة ليست سرًّا)
    /sdk/build-tools/35.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk | grep -i "SHA-256" | head -1
  '
unset ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD

AAB="$PROJECT/app/build/outputs/bundle/release/app-release.aab"
APK="$PROJECT/app/build/outputs/apk/release/app-release.apk"
[ -s "$AAB" ] || die "لم يُنتج البناء ملف AAB — انظر الرسائل أعلاه"
mkdir -p "$RELDIR"
cp "$AAB" "$RELDIR/madrasa-$NAME-native.aab"
[ -s "$APK" ] && cp "$APK" "$RELDIR/madrasa-$NAME-native.apk"
ok "ملف Google Play: $RELDIR/madrasa-$NAME-native.aab"
[ -s "$APK" ] && ok "للتجربة على هاتفك: $RELDIR/madrasa-$NAME-native.apk"
printf '\nارفع ملف .aab في Play Console ← الاختبار ← الاختبار المغلق (Alpha) ← إنشاء إصدار جديد.\n'
printf 'البصمة المطبوعة أعلاه يجب أن تطابق «شهادة مفتاح التحميل» في Play Console ← سلامة التطبيق.\n\n'
