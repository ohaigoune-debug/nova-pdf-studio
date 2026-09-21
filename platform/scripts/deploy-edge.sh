#!/usr/bin/env bash
# نشر منصة "مدرسة" على خادم يستضيف مواقع أخرى خلف Caddy يعمل داخل Docker.
# التطبيق لا يفتح أي منفذ على الخادم: يُضمّ إلى شبكة الوكيل ويُمرَّر إليه باسمه.
#
#   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' bash scripts/deploy-edge.sh
#
# آمن للتكرار: لا يمسّ .env موجوداً، ولا يكرّر موقعاً موجوداً في Caddyfile الوكيل.
set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN=${DOMAIN:-madrasadz.com}
EDGE_NET=${EDGE_NET:-deploy_default}
EDGE_CADDY=${EDGE_CADDY:-deploy-caddy-1}
EDGE_CADDYFILE=${EDGE_CADDYFILE:-/opt/nova-commerce/deploy/Caddyfile}
APP_CONTAINER=${APP_CONTAINER:-platform-app-1}

export EDGE_NET
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.edge.yml"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1) التحقق من الوكيل القائم ───────────────────────────────────────────
docker network inspect "$EDGE_NET" >/dev/null 2>&1 \
  || die "شبكة الوكيل '$EDGE_NET' غير موجودة. مرّر EDGE_NET=اسم_الشبكة."
docker inspect "$EDGE_CADDY" >/dev/null 2>&1 \
  || die "حاوية Caddy '$EDGE_CADDY' غير موجودة. مرّر EDGE_CADDY=اسم_الحاوية."
[ -f "$EDGE_CADDYFILE" ] \
  || die "ملف '$EDGE_CADDYFILE' غير موجود. مرّر EDGE_CADDYFILE=المسار."

# ── 2) الإعداد ───────────────────────────────────────────────────────────
# الأسرار تُولَّد مرة واحدة: تغييرها يُخرج كل المستخدمين، وتغيير كلمة سر
# Postgres يجعل قاعدة البيانات الموجودة غير قابلة للفتح.
if [ -f .env ]; then
  say "ملف .env موجود — يُستعمل كما هو (لن تُغيَّر الأسرار)"
else
  say "إعداد أول مرة"
  if [ -z "${ADMIN_EMAIL:-}" ]; then read -rp "بريد المشرف: " ADMIN_EMAIL; fi
  [ -n "${ADMIN_EMAIL:-}" ] || die "بريد المشرف مطلوب"
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    read -rsp "كلمة سر المشرف (12 حرفاً فأكثر): " ADMIN_PASSWORD; echo
  fi
  [ "${#ADMIN_PASSWORD}" -ge 12 ] || die "كلمة السر أقصر من 12 حرفاً"

  gen() { openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_'; }
  cp .env.production.example .env
  # الأسرار تُكتب بـ python لتفادي محارف خاصة تكسر sed
  DOMAIN="$DOMAIN" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  PG="$(gen)" SS="$(gen)" QR="$(gen)" CR="$(gen)" python3 - <<'PY'
import os, re
d = os.environ['DOMAIN']
vals = {
    'SITE_ADDRESS': f"{d}, www.{d}",
    'APP_URL': f"https://{d}",
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

# ── 3) التشغيل (بلا Caddy خاص بنا: المنفذان محجوزان للوكيل) ───────────────
say "بناء وتشغيل الحزمة (البناء الأول قد يستغرق عدة دقائق)"
$COMPOSE up -d --build --scale caddy=0

say "سجلّ الإقلاع (المرجعيات + أول مشرف)"
$COMPOSE logs --no-log-prefix bootstrap || true

say "انتظار استجابة التطبيق داخل الشبكة"
for _ in $(seq 1 30); do
  if docker exec "$APP_CONTAINER" node -e \
      'fetch("http://127.0.0.1:3000/login").then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))' \
      2>/dev/null; then
    ok=1; break
  fi
  sleep 5
done
[ "${ok:-0}" = 1 ] || die "التطبيق لم يستجب. شخّص بـ: $COMPOSE logs app | tail -40"

# ── 4) ربط النطاق في Caddyfile الوكيل ────────────────────────────────────
if grep -q "^$DOMAIN {" "$EDGE_CADDYFILE"; then
  say "الموقع $DOMAIN موجود في Caddyfile الوكيل — لا تغيير"
else
  say "إضافة $DOMAIN إلى $EDGE_CADDYFILE"
  BAK="$EDGE_CADDYFILE.bak-$(date +%F-%H%M%S)"
  cp "$EDGE_CADDYFILE" "$BAK"
  sed "s/madrasadz\.com/$DOMAIN/g" deploy/madrasadz.caddy >> "$EDGE_CADDYFILE"
  if ! docker exec "$EDGE_CADDY" caddy validate --adapter caddyfile \
        --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    cp "$BAK" "$EDGE_CADDYFILE"
    die "الإعداد الجديد غير صالح — أُعيد Caddyfile كما كان ($BAK)"
  fi
  docker exec -w /etc/caddy "$EDGE_CADDY" caddy reload --config /etc/caddy/Caddyfile
  say "أُعيد تحميل الوكيل (المواقع الأخرى لم تتوقف)"
fi

# ── 5) التحقق من الخارج ──────────────────────────────────────────────────
say "انتظار الشهادة واستجابة الموقع (حتى دقيقتين)"
for _ in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$DOMAIN/login" || true)
  [ "$code" = "200" ] && break
  sleep 5
done

echo
if [ "${code:-000}" = "200" ]; then
  printf '\033[1;32m✔ المنصة تعمل: https://%s\033[0m\n' "$DOMAIN"
  printf '  ادخل ببريد المشرف الذي أدخلته.\n'
else
  printf '\033[1;33m! الموقع لم يستجب بعد (آخر رمز: %s)\033[0m\n' "${code:-لا شيء}"
  printf '   • تحقّق أن %s يشير إلى هذا الخادم: getent hosts %s\n' "$DOMAIN" "$DOMAIN"
  printf '   • سحابة Cloudflare برتقالية؟ اجعلها رمادية ليصدر Caddy الشهادة\n'
  printf '   • سجلّ الوكيل: docker logs --tail 30 %s\n' "$EDGE_CADDY"
fi

echo
printf 'الحالة:\n'; $COMPOSE ps
