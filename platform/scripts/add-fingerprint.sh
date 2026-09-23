#!/usr/bin/env bash
# إضافة بصمة توقيع إلى ربط النطاق بالتطبيق (/.well-known/assetlinks.json)، ثم إعادة تشغيل المنصة.
#   bash scripts/add-fingerprint.sh AB:CD:…:EF
#
# متى؟ بعد أول رفع إلى Google Play: Google يعيد توقيع التطبيق بمفتاحه، فتُضاف بصمته إلى بصمتك
# (Play Console ← الإعداد ← سلامة التطبيق ← «شهادة مفتاح توقيع التطبيق» ← SHA-256).
# بدونها يعمل التطبيق المثبَّت من المتجر لكن يظهر فيه شريط المتصفّح.
# البصمة ليست سرّاً — تُنشر للعموم في assetlinks.json.
set -euo pipefail

cd "$(dirname "$0")/.."

ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

APP_CONTAINER=${APP_CONTAINER:-platform-app-1}
[ -f .env ] || die "لا يوجد .env هنا — شغّل هذا من مجلد المنصة على الخادم"

# تُقبل كما يعرضها Play Console أو keytool: بنقطتين أو بدونهما، بأحرف صغيرة أو كبيرة
RAW=$(printf '%s' "${1:-}" | tr -d ':[:space:]' | tr 'a-f' 'A-F')
printf '%s' "$RAW" | grep -Eq '^[0-9A-F]{64}$' || die "هذه ليست بصمة SHA-256 (64 رمزاً ست عشرياً). انسخها كما هي من Play Console"
FP=$(printf '%s' "$RAW" | sed 's/../&:/g; s/:$//')

CHANGED=$(FP="$FP" python3 - <<'PY'
import os, re
fp = os.environ['FP']
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

if [ "$CHANGED" = 1 ]; then
  COMPOSE="docker compose -f docker-compose.prod.yml"
  [ -f docker-compose.edge.yml ] && docker network inspect "${EDGE_NET:-deploy_default}" >/dev/null 2>&1 \
    && COMPOSE="$COMPOSE -f docker-compose.edge.yml"
  $COMPOSE up -d --no-build app
  ok "أُضيفت البصمة"
else
  ok "البصمة موجودة أصلاً"
fi

for _ in $(seq 1 30); do
  docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/.well-known/assetlinks.json 2>/dev/null | grep -q "$FP" && break
  sleep 2
done
docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/.well-known/assetlinks.json 2>/dev/null | grep -q "$FP" \
  && ok "ربط النطاق بالتطبيق يعمل (assetlinks.json)" \
  || printf '\033[1;33m! assetlinks.json لم يُجب بعد — أعد الأمر بعد دقيقة\033[0m\n'
