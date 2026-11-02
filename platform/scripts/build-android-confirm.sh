#!/usr/bin/env bash
# بناء تطبيق عامل التأكيد (أندرويد) على الخادم نفسه ونشره للتحميل من المنصة.
#   bash scripts/build-android-confirm.sh
#
# منفصل تمامًا عن تطبيق التلاميذ: مجلده android-confirm/، ومفتاح توقيعه في /opt/madrasa/android-confirm-key،
# فلا يمسّ android/ ولا /opt/madrasa/android-key. يستعمل مخبأ أدوات أندرويد نفسه في Docker (لا تنزيل جديد).
#
# ما يفعله:
#   1) ينشئ مفتاح توقيع خاصًا بهذا التطبيق مرّة واحدة
#   2) يبني APK موقّعًا ويزيد رقم الإصدار في كل مرّة فيتحدّث التطبيق فوق القديم
#   3) ينشره على https://madrasadz.com/download/confirm-app
#
# احفظ نسخة من مجلد المفتاح خارج الخادم: بدونه لا يُحدَّث التطبيق عند من ثبّته (يُحذف ويُثبَّت من جديد فقط).
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

KEYDIR=${CONFIRM_KEY_DIR:-/opt/madrasa/android-confirm-key}
APP_CONTAINER=${APP_CONTAINER:-platform-app-1}
JDK_IMAGE=${JDK_IMAGE:-eclipse-temurin:17-jdk}
ALIAS=confirm

[ -f android-confirm/gradlew ] || die "مجلد android-confirm غير موجود — حدّث الشيفرة أولاً (git pull)"
docker inspect "$APP_CONTAINER" >/dev/null 2>&1 || die "حاوية المنصة '$APP_CONTAINER' لا تعمل"

# ── 1) مفتاح التوقيع ── مرّة واحدة، وكلمة سرّه في ملف لا يقرؤه غير root
mkdir -p "$KEYDIR" && chmod 700 "$KEYDIR"
if [ ! -f "$KEYDIR/confirm.keystore" ]; then
  say "إنشاء مفتاح التوقيع لتطبيق التأكيد (مرّة واحدة)"
  [ -f "$KEYDIR/password" ] || { (umask 077; openssl rand -hex 16 > "$KEYDIR/password"); }
  SP=$(cat "$KEYDIR/password") docker run --rm -e SP -v "$KEYDIR:/k" "$JDK_IMAGE" \
    keytool -genkeypair -keystore /k/confirm.keystore -storetype PKCS12 -alias "$ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 -storepass:env SP -keypass:env SP \
      -dname "CN=Madrasa Confirm, O=madrasadz.com, C=DZ" >/dev/null 2>&1
  chmod 600 "$KEYDIR/confirm.keystore"
  ok "أُنشئ المفتاح في $KEYDIR — انسخ هذا المجلد خارج الخادم واحفظه"
else
  ok "مفتاح التوقيع موجود — يُستعمل نفسه"
fi
SP=$(cat "$KEYDIR/password")

CODE=$(( $(cat "$KEYDIR/version-code" 2>/dev/null || echo 0) + 1 ))
NAME="1.0.$CODE"

# ── 2) البناء ── مخبأ أدوات أندرويد وGradle نفسه الذي يستعمله build-android.sh
say "بناء تطبيق التأكيد — الإصدار $NAME"
rm -rf android-confirm/app/build/outputs/apk/release
ANDROID_KEYSTORE_PASSWORD="$SP" ANDROID_KEY_PASSWORD="$SP" \
docker run --rm \
  -e ANDROID_KEYSTORE_PASSWORD -e ANDROID_KEY_PASSWORD \
  -e ANDROID_KEYSTORE_PATH=/k/confirm.keystore -e ANDROID_KEY_ALIAS="$ALIAS" \
  -e VNAME="$NAME" -e VCODE="$CODE" \
  -v "$PWD/android-confirm:/src" -v "$KEYDIR:/k:ro" \
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
    ./gradlew --no-daemon --console=plain -PconfirmVersionName="$VNAME" -PconfirmVersionCode="$VCODE" assembleRelease
  '
APK=android-confirm/app/build/outputs/apk/release/app-release.apk
[ -s "$APK" ] || die "لم يُنتج البناء ملف APK موقّعاً — انظر الرسائل أعلاه"
echo "$CODE" > "$KEYDIR/version-code"
ok "بُني: $(du -h "$APK" | cut -f1)"

# ── 3) النشر ── في مجلد البيانات الدائم للمنصة، باستبدال ذرّي
say "نشر التطبيق على المنصة"
docker exec -i "$APP_CONTAINER" sh -c \
  'mkdir -p /app/data/downloads && cat > /app/data/downloads/madrasa-confirm.apk.tmp && mv /app/data/downloads/madrasa-confirm.apk.tmp /app/data/downloads/madrasa-confirm.apk' < "$APK"
ok "نُشر"

printf '\n\033[1;32mتمّ. تطبيق التأكيد للتحميل:\033[0m  https://madrasadz.com/download/confirm-app\n'
printf 'افتح الرابط من هاتف العامل، ثبّت التطبيق، وادخل برقم هاتفه وكلمة سرّه.\n'
printf '\033[1;33mاحفظ نسخة من المجلد %s خارج الخادم — بدونه لا يُحدَّث التطبيق فوق القديم.\033[0m\n\n' "$KEYDIR"
