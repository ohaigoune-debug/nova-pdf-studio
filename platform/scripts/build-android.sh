#!/usr/bin/env bash
# بناء تطبيق أندرويد للتلاميذ على الخادم نفسه ونشره للتحميل من المنصة.
#   bash scripts/build-android.sh
#
# لا يحتاج تثبيت شيء: البناء كلّه داخل Docker (JDK + Android SDK في مخبأ دائم).
# المرّة الأولى 10–15 دقيقة (تنزيل الأدوات)، وما بعدها دقيقتان تقريباً.
#
# ما يفعله:
#   1) ينشئ مفتاح التوقيع مرّة واحدة في /opt/madrasa/android-key (خارج المستودع)
#   2) يبني APK موقّعاً، ويزيد رقم الإصدار في كل مرّة فيتحدّث التطبيق فوق القديم
#   3) يضع بصمة المفتاح في .env فيُفتح التطبيق ملء الشاشة بلا شريط متصفّح
#   4) ينشر الملف على https://madrasadz.com/download/android ويظهر زرّه في الصفحة الرئيسية
#
# مفتاح التوقيع لا يُعوَّض: بدونه لا يمكن تحديث التطبيق عند من ثبّته. انسخ مجلده خارج الخادم.
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

KEYDIR=${ANDROID_KEY_DIR:-/opt/madrasa/android-key}
APP_CONTAINER=${APP_CONTAINER:-platform-app-1}
JDK_IMAGE=${JDK_IMAGE:-eclipse-temurin:17-jdk}
ALIAS=madrasa

[ -f .env ] || die "لا يوجد .env هنا — شغّل هذا من مجلد المنصة على الخادم"
[ -f android/gradlew ] || die "مجلد android غير موجود — حدّث الشيفرة أولاً (git pull)"
docker inspect "$APP_CONTAINER" >/dev/null 2>&1 || die "حاوية المنصة '$APP_CONTAINER' لا تعمل"

# ── 1) مفتاح التوقيع ── يُنشأ مرّة واحدة فقط، وكلمة سرّه في ملف لا يقرؤه غير root
mkdir -p "$KEYDIR" && chmod 700 "$KEYDIR"
if [ ! -f "$KEYDIR/madrasa.keystore" ]; then
  say "إنشاء مفتاح التوقيع (مرّة واحدة)"
  [ -f "$KEYDIR/password" ] || { (umask 077; openssl rand -hex 16 > "$KEYDIR/password"); }
  SP=$(cat "$KEYDIR/password") docker run --rm -e SP -v "$KEYDIR:/k" "$JDK_IMAGE" \
    keytool -genkeypair -keystore /k/madrasa.keystore -storetype PKCS12 -alias "$ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 -storepass:env SP -keypass:env SP \
      -dname "CN=Madrasa, O=madrasadz.com, C=DZ" >/dev/null 2>&1
  chmod 600 "$KEYDIR/madrasa.keystore"
  ok "أُنشئ المفتاح في $KEYDIR — انسخ هذا المجلد خارج الخادم واحفظه"
else
  ok "مفتاح التوقيع موجود — يُستعمل نفسه"
fi
SP=$(cat "$KEYDIR/password")

# رقم الإصدار يزيد مع كل بناء: أندرويد لا يقبل التحديث بإصدار أقل أو مساوٍ
CODE=$(( $(cat "$KEYDIR/version-code" 2>/dev/null || echo 0) + 1 ))
NAME="1.0.$CODE"

# ── 2) البناء ── الأدوات تُنزَّل مرّة واحدة إلى مخبأين دائمين في Docker
say "بناء التطبيق — الإصدار $NAME (المرّة الأولى قد تأخذ 15 دقيقة)"
rm -rf android/app/build/outputs/apk/release
ANDROID_KEYSTORE_PASSWORD="$SP" ANDROID_KEY_PASSWORD="$SP" \
docker run --rm \
  -e ANDROID_KEYSTORE_PASSWORD -e ANDROID_KEY_PASSWORD \
  -e ANDROID_KEYSTORE_PATH=/k/madrasa.keystore -e ANDROID_KEY_ALIAS="$ALIAS" \
  -e VNAME="$NAME" -e VCODE="$CODE" \
  -v "$PWD/android:/src" -v "$KEYDIR:/k:ro" \
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
    ./gradlew --no-daemon --console=plain -PmadrasaVersionName="$VNAME" -PmadrasaVersionCode="$VCODE" assembleRelease
  '
APK=android/app/build/outputs/apk/release/app-release.apk
[ -s "$APK" ] || die "لم يُنتج البناء ملف APK موقّعاً — انظر الرسائل أعلاه"
echo "$CODE" > "$KEYDIR/version-code"
ok "بُني: $(du -h "$APK" | cut -f1)"

# ── 3) البصمة في .env ── تُضاف إلى الموجود (مثل بصمة Play لاحقاً) ولا تستبدله
FP=$(SP="$SP" docker run --rm -e SP -v "$KEYDIR:/k:ro" "$JDK_IMAGE" \
  keytool -list -v -keystore /k/madrasa.keystore -alias "$ALIAS" -storepass:env SP 2>/dev/null \
  | sed -n 's/.*SHA256: *//p' | head -1 | tr -d '[:space:]')
[ -n "$FP" ] || die "تعذّرت قراءة بصمة المفتاح"
CHANGED=$(FP="$FP" python3 - <<'PY'
import os, re
fp = os.environ['FP'].upper()
lines = open('.env', encoding='utf-8').read().splitlines()
changed = '0'
for i, line in enumerate(lines):
    m = re.match(r'\s*ANDROID_CERT_FINGERPRINTS\s*=(.*)', line)
    if m:
        have = [x.strip().upper() for x in m.group(1).strip().strip('"').split(',') if x.strip()]
        if fp not in have:
            lines[i] = 'ANDROID_CERT_FINGERPRINTS=' + ','.join(have + [fp])
            changed = '1'
        break
else:
    lines.append('ANDROID_CERT_FINGERPRINTS=' + fp)
    changed = '1'
if changed == '1':
    open('.env', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(changed)
PY
)
chmod 600 .env

# ── 4) النشر ── في مجلد البيانات الدائم للمنصة، باستبدال ذرّي فلا يُحمَّل ملف ناقص
say "نشر التطبيق على المنصة"
docker exec -i "$APP_CONTAINER" sh -c \
  'mkdir -p /app/data/downloads && cat > /app/data/downloads/madrasa.apk.tmp && mv /app/data/downloads/madrasa.apk.tmp /app/data/downloads/madrasa.apk' < "$APK"
ok "نُشر"

if [ "$CHANGED" = 1 ]; then
  say "إعادة تشغيل المنصة لتفعيل ربط التطبيق بالنطاق"
  COMPOSE="docker compose -f docker-compose.prod.yml"
  [ -f docker-compose.edge.yml ] && docker network inspect "${EDGE_NET:-deploy_default}" >/dev/null 2>&1 \
    && COMPOSE="$COMPOSE -f docker-compose.edge.yml"
  $COMPOSE up -d --no-build app
fi

# التحقّق من داخل الحاوية: الربط والتحميل
for _ in $(seq 1 30); do
  docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/.well-known/assetlinks.json 2>/dev/null | grep -q "$FP" && break
  sleep 2
done
docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/.well-known/assetlinks.json 2>/dev/null | grep -q "$FP" \
  && ok "ربط النطاق بالتطبيق يعمل (assetlinks.json)" \
  || printf '\033[1;33m! assetlinks.json لم يُجب بعد — سيعمل التطبيق لكن قد يظهر شريط المتصفّح\033[0m\n'

printf '\n\033[1;32mتمّ. التطبيق للتحميل:\033[0m  https://madrasadz.com/download/android\n'
printf 'وزرّه ظاهر الآن في الصفحة الرئيسية للمنصة.\n'
printf '\033[1;33mاحفظ نسخة من المجلد %s خارج الخادم — بدونه لا يمكن تحديث التطبيق.\033[0m\n\n' "$KEYDIR"
