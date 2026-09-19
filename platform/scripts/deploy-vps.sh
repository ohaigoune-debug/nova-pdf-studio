#!/usr/bin/env bash
# نشر منصة "مدرسة" على خادم VPS بأمر واحد.
# يولّد الأسرار، يكتب .env، ويشغّل الحزمة. آمن للتكرار: لا يمسّ .env موجوداً.
#   bash scripts/deploy-vps.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1) Docker ────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  say "تثبيت Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose غير متوفر. ثبّت الإضافة docker-compose-plugin ثم أعد المحاولة."

# ── 2) الإعداد ───────────────────────────────────────────────────────────
# الأسرار لا تُولَّد إلا مرة واحدة: تغييرها لاحقاً يُخرج كل المستخدمين،
# وتغيير كلمة سر Postgres يجعل قاعدة البيانات الموجودة غير قابلة للفتح.
if [ -f .env ]; then
  say "ملف .env موجود — يُستعمل كما هو (لن تُغيَّر الأسرار)"
else
  say "إعداد أول مرة"
  read -rp "النطاق (مثال: madrasadz.com): " DOMAIN
  [ -n "$DOMAIN" ] || die "النطاق مطلوب"
  read -rp "بريد المشرف: " ADMIN_EMAIL
  [ -n "$ADMIN_EMAIL" ] || die "بريد المشرف مطلوب"
  read -rsp "كلمة سر المشرف (12 حرفاً فأكثر): " ADMIN_PASSWORD; echo
  [ "${#ADMIN_PASSWORD}" -ge 12 ] || die "كلمة السر أقصر من 12 حرفاً"

  gen() { openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_'; }
  cp .env.production.example .env
  # الأسرار تُكتب بـ python لتفادي محارف خاصة تكسر sed
  DOMAIN="$DOMAIN" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  PG="$(gen)" SS="$(gen)" QR="$(gen)" CR="$(gen)" python3 - <<'PY'
import os, re
vals = {
    'SITE_ADDRESS': f"{os.environ['DOMAIN']}, www.{os.environ['DOMAIN']}",
    'APP_URL': f"https://{os.environ['DOMAIN']}",
    'POSTGRES_PASSWORD': os.environ['PG'],
    'SESSION_SECRET': os.environ['SS'],
    'QR_TOKEN_SECRET': os.environ['QR'],
    'CRON_SECRET': os.environ['CR'],
    'ADMIN_EMAIL': os.environ['ADMIN_EMAIL'],
    'ADMIN_PASSWORD': os.environ['ADMIN_PASSWORD'],
    'VAPID_SUBJECT': f"mailto:{os.environ['ADMIN_EMAIL']}",
}
text = open('.env', encoding='utf-8').read()
for k, v in vals.items():
    text = re.sub(rf'(?m)^{re.escape(k)}=.*$', f'{k}={v}', text)
open('.env', 'w', encoding='utf-8').write(text)
PY
  chmod 600 .env
  say "كُتب .env — الأسرار مولّدة عشوائياً. احتفظ بنسخة منه في مكان آمن."
fi

# ── 3) التشغيل ───────────────────────────────────────────────────────────
say "بناء وتشغيل الحزمة (قد يستغرق البناء الأول عدة دقائق)"
$COMPOSE up -d --build

say "سجلّ الإقلاع (المرجعيات + أول مشرف)"
$COMPOSE logs --no-log-prefix bootstrap || true

# ── 4) التحقق ────────────────────────────────────────────────────────────
DOMAIN_CHECK=$(grep -E '^APP_URL=' .env | sed 's#^APP_URL=https\?://##')
say "انتظار الشهادة واستجابة الموقع (حتى دقيقتين)"
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$DOMAIN_CHECK/login" || true)
  [ "$code" = "200" ] && break
  sleep 5
done

echo
if [ "${code:-000}" = "200" ]; then
  printf '\033[1;32m✔ المنصة تعمل: https://%s\033[0m\n' "$DOMAIN_CHECK"
  printf '  ادخل ببريد المشرف الذي أدخلته.\n'
else
  printf '\033[1;33m! الموقع لم يستجب بعد (آخر رمز: %s)\033[0m\n' "${code:-لا شيء}"
  printf '  الأسباب الشائعة:\n'
  printf '   • النطاق لا يشير إلى هذا الخادم بعد — تحقّق: dig +short %s\n' "$DOMAIN_CHECK"
  printf '   • سحابة Cloudflare برتقالية — اجعلها رمادية (DNS only) ليصدر Caddy الشهادة\n'
  printf '   • المنفذان 80 و443 مغلقان في جدار الحماية\n'
  printf '  للتشخيص:  %s logs caddy | tail -30\n' "$COMPOSE"
fi

echo
printf 'الحالة:\n'; $COMPOSE ps
printf '\nالخطوة التالية: ابنِ تطبيق أندرويد من تبويب Actions، ثم ضع البصمة في ANDROID_CERT_FINGERPRINTS داخل .env وأعد التشغيل:\n'
printf '  %s up -d app\n' "$COMPOSE"
