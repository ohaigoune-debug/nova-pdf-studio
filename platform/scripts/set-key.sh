#!/usr/bin/env bash
# إدخال مفتاح خدمة خارجية إلى .env على خادم الإنتاج، ثم إعادة تشغيل التطبيق وحده.
#   bash scripts/set-key.sh openai     # مفتاح OpenAI: تنظيم قوائم يوتيوب والتصحيح المساعد
#   bash scripts/set-key.sh youtube    # مفتاح YouTube Data API: جلب القائمة كاملة لا آخر 15 فيديو
#   bash scripts/set-key.sh resend     # مفتاح Resend: رسائل استعادة كلمة السر
#
# المفتاح يُكتب مخفيّاً: لا يظهر على الشاشة ولا في سجلّ الأوامر ولا في قائمة العمليات.
# يُجرَّب عند مزوّده قبل الحفظ، فلا يُحفظ مفتاح مرفوض.
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

KIND=${1:-}
case "$KIND" in
  openai) LABEL='OpenAI'; PREFIX='sk-' ;;
  youtube) LABEL='YouTube Data API'; PREFIX='AIza' ;;
  resend) LABEL='Resend'; PREFIX='re_' ;;
  *) die "اكتب نوع المفتاح: openai أو youtube أو resend" ;;
esac

[ -f .env ] || die "لا يوجد .env هنا — شغّل هذا من مجلد المنصة على الخادم"

read -rsp "الصق مفتاح $LABEL ثم اضغط Enter (لن يظهر): " KEY; echo
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
[ -n "$KEY" ] || die "لم يُلصق شيء — لم يتغيّر شيء"
case "$KEY" in
  "$PREFIX"*) ;;
  *) die "هذا لا يشبه مفتاح $LABEL (يبدأ عادة بـ $PREFIX) — لم يتغيّر شيء" ;;
esac

# ── التجربة عند المزوّد ── الإعداد يمرّ إلى curl عبر stdin لا عبر سطر الأوامر
say "تجربة المفتاح عند $LABEL"
case "$KIND" in
  openai) CONF="url = \"https://api.openai.com/v1/models\"
header = \"Authorization: Bearer $KEY\"" ;;
  youtube) CONF="url = \"https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=$KEY\"" ;;
  resend) CONF="url = \"https://api.resend.com/domains\"
header = \"Authorization: Bearer $KEY\"" ;;
esac
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
CODE=$(printf '%s\n' "$CONF" | curl -sS -m 20 -o "$BODY" -w '%{http_code}' -K - || true)
unset CONF

case "$CODE" in
  200) ok "المفتاح مقبول" ;;
  401|403)
    # مفتاح Resend «للإرسال فقط» لا يحقّ له قراءة النطاقات، وهو صالح للإرسال
    if [ "$KIND" = resend ] && grep -q restricted_api_key "$BODY"; then
      ok "المفتاح مقبول (صلاحية إرسال فقط)"; CODE=restricted
    else die "رفض $LABEL المفتاح (HTTP $CODE) — تأكّد أنه منسوخ كاملاً وأنه مفعّل. لم يتغيّر شيء"
    fi ;;
  400) [ "$KIND" = youtube ] && die "رفض YouTube المفتاح (HTTP 400) — المفتاح غير صالح أو منسوخ ناقصاً. لم يتغيّر شيء"
       die "ردّ $LABEL بـ HTTP 400 — لم يتغيّر شيء" ;;
  *) printf '\033[1;33m! تعذّرت التجربة (HTTP %s) — سيُحفظ المفتاح دون تأكيد\033[0m\n' "${CODE:-000}" ;;
esac

# Resend: الإرسال لا ينجح إلا من نطاق موثَّق
if [ "$KIND" = resend ] && [ "$CODE" = 200 ]; then
  if grep -Eq '"name": *"madrasadz\.com"[^}]*"status": *"verified"' "$BODY"; then
    ok "النطاق madrasadz.com موثَّق في Resend"
  else
    printf '\033[1;33m! النطاق madrasadz.com غير موثَّق بعد في Resend — الرسائل لن تصل حتى يصير Verified\033[0m\n'
  fi
fi

# ── الحفظ في .env ── يُستبدل السطر إن وُجد ويُضاف إن لم يوجد، والباقي كما هو
say "حفظ المفتاح في .env"
cp -p .env ".env.bak.$(date +%Y%m%d%H%M%S)"
case "$KIND" in
  openai) SETS='AI_PROVIDER=openai' ; SECRET_VAR=AI_API_KEY ;;
  youtube) SETS='' ; SECRET_VAR=YOUTUBE_API_KEY ;;
  resend) SETS='MAIL_PROVIDER=resend' ; SECRET_VAR=MAIL_API_KEY ;;
esac
SECRET_VAR="$SECRET_VAR" SECRET_VAL="$KEY" SETS="$SETS" python3 - <<'PY'
import os, re
pairs = {os.environ['SECRET_VAR']: os.environ['SECRET_VAL']}
for kv in os.environ['SETS'].split():
    k, v = kv.split('=', 1)
    pairs[k] = v
lines = open('.env', encoding='utf-8').read().splitlines()
seen = set()
for i, line in enumerate(lines):
    m = re.match(r'\s*([A-Z_][A-Z0-9_]*)\s*=', line)
    if m and m.group(1) in pairs:
        lines[i] = f'{m.group(1)}={pairs[m.group(1)]}'
        seen.add(m.group(1))
lines += [f'{k}={v}' for k, v in pairs.items() if k not in seen]
# Resend يرفض مرسلاً من غير نطاق موثَّق: عنوان المرسل الافتراضي إن كان فارغاً
if os.environ['SECRET_VAR'] == 'MAIL_API_KEY':
    have = [l for l in lines if re.match(r'\s*MAIL_FROM\s*=\s*\S', l)]
    if not have:
        lines = [l for l in lines if not re.match(r'\s*MAIL_FROM\s*=', l)]
        lines.append('MAIL_FROM="مدرسة <no-reply@madrasadz.com>"')
open('.env', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
PY
unset KEY
chmod 600 .env
ok "حُفظ (ونسخة احتياطية من .env القديم بجانبه)"

# ── إعادة تشغيل التطبيق وحده بالإعداد الجديد ── بلا إعادة بناء، والمواقع الأخرى لا تُمسّ
say "إعادة تشغيل المنصة بالمفتاح الجديد"
COMPOSE="docker compose -f docker-compose.prod.yml"
[ -f docker-compose.edge.yml ] && docker network inspect "${EDGE_NET:-deploy_default}" >/dev/null 2>&1 \
  && COMPOSE="$COMPOSE -f docker-compose.edge.yml"
$COMPOSE up -d --no-build --scale caddy=0 app
ok "تمّ. $LABEL مفعّل على المنصة"
