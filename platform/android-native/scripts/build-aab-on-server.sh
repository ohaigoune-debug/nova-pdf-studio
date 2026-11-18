#!/usr/bin/env bash
# بناء ملف AAB موقّع لتطبيق «مدرسة» الأصيل (أندرويد) على خادم المالك — للرفع على مسار الاختبار المغلق Alpha نفسه.
#
#   rm -rf /opt/madrasa/android-native-src \
#     && git clone --depth 1 -b <الفرع> https://github.com/ohaigoune-debug/nova-pdf-studio /opt/madrasa/android-native-src \
#     && bash /opt/madrasa/android-native-src/platform/android-native/scripts/build-aab-on-server.sh [--publish]
#
#   --publish : بعد البناء والتحقق، يضع ملف APK الأصيل مكان التطبيق المنشور في الموقع
#               (https://madrasadz.com/download/android) باستبدال ذرّي — بدل غلاف الموقع القديم.
#
# ما يفعله، وما لا يفعله:
#   - يبني من نسخة مستقلة من الفرع (android-native-src)، فلا يلمس /opt/madrasa/platform ولا تعديلاته المحلية ولا يعمل pull هناك.
#   - يستعمل مفتاح التوقيع الموجود في /opt/madrasa/android-key للقراءة فقط (مُركَّب read-only داخل Docker):
#     لا ينسخه، ولا يغيّره، ولا يكتب شيئًا في مجلده، ولا يطبع كلمة سرّه.
#   - رقم الإصدار من gradle.properties في الفرع: versionCode 8 و versionName 1.1.0 (أكبر من 7 على Play).
#   - لا ينشر شيئًا على الموقع إلا مع --publish (ملف التحميل وحده)، ولا يغيّر .env ولا البصمات أبدًا.
#   - يضع الملفين في /opt/madrasa/android-release:
#       madrasa-<الإصدار>-native.aab  ← يُرفع على Play Console (الاختبار المغلق Alpha)
#       madrasa-<الإصدار>-native.apk  ← للتجربة على هاتفك قبل الرفع (موقّع بالمفتاح نفسه فيُثبَّت فوق النسخة الحالية)
set -euo pipefail

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

PUBLISH=0
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=1 ;;
    *) die "خيار غير معروف: $arg (المتاح: --publish)" ;;
  esac
done

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
APP_CONTAINER=${APP_CONTAINER:-platform-app-1}
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
# غلاف الموقع القديم (scripts/build-android.sh) يحفظ آخر رقم بناه هنا — رقم عادي ليس سرًّا.
# أندرويد يرفض التثبيت فوق رقم أكبر، فلا نبني إن كان رقمنا لا يتجاوزه.
TWA_CODE=$(cat "$KEYDIR/version-code" 2>/dev/null || echo 0)
[ "$CODE" -gt "${TWA_CODE:-0}" ] || die "versionCode ($CODE) يجب أن يتجاوز آخر رقم للغلاف القديم في الموقع ($TWA_CODE): ارفعه في gradle.properties"
if [ "$PUBLISH" = 1 ]; then
  docker inspect "$APP_CONTAINER" >/dev/null 2>&1 || die "حاوية المنصة '$APP_CONTAINER' لا تعمل — لا يمكن النشر (ضع APP_CONTAINER=اسمها)"
fi

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
    # هوية الملف المبني: الحزمة والإصدار (يُقرأ قبل النشر)
    /sdk/build-tools/35.0.0/aapt2 dump badging app/build/outputs/apk/release/app-release.apk | head -1 > app/build/outputs/badging.txt
  '
unset ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD

AAB="$PROJECT/app/build/outputs/bundle/release/app-release.aab"
APK="$PROJECT/app/build/outputs/apk/release/app-release.apk"
[ -s "$AAB" ] || die "لم يُنتج البناء ملف AAB — انظر الرسائل أعلاه"
mkdir -p "$RELDIR"
cp "$AAB" "$RELDIR/madrasa-$NAME-native.aab"
[ -s "$APK" ] && cp "$APK" "$RELDIR/madrasa-$NAME-native.apk"
ok "ملف Google Play: $RELDIR/madrasa-$NAME-native.aab"

if [ "$PUBLISH" = 1 ]; then
  [ -s "$APK" ] || die "لا يوجد APK موقّع للنشر"
  BADGE=$(cat "$PROJECT/app/build/outputs/badging.txt" 2>/dev/null || true)
  echo "$BADGE" | grep -q "name='dz.madrasa.app'" || die "الملف المبني ليس حزمة dz.madrasa.app — لم يُنشر شيء ($BADGE)"
  echo "$BADGE" | grep -q "versionCode='$CODE'" || die "رقم إصدار الملف لا يطابق $CODE — لم يُنشر شيء ($BADGE)"
  say "نشر التطبيق الأصيل $NAME على الموقع بدل الغلاف القديم"
  # استبدال ذرّي في مجلد البيانات الدائم للمنصة (نفسه الذي يقرأ منه /download/android) فلا يُحمَّل ملف ناقص
  docker exec -i "$APP_CONTAINER" sh -c \
    'mkdir -p /app/data/downloads && cat > /app/data/downloads/madrasa.apk.tmp && mv /app/data/downloads/madrasa.apk.tmp /app/data/downloads/madrasa.apk' < "$APK"
  ok "نُشر: https://madrasadz.com/download/android ($(du -h "$APK" | cut -f1))"
fi
[ -s "$APK" ] && ok "للتجربة على هاتفك: $RELDIR/madrasa-$NAME-native.apk"
printf '\nارفع ملف .aab في Play Console ← الاختبار ← الاختبار المغلق (Alpha) ← إنشاء إصدار جديد.\n'
printf 'البصمة المطبوعة أعلاه يجب أن تطابق «شهادة مفتاح التحميل» في Play Console ← سلامة التطبيق.\n\n'
