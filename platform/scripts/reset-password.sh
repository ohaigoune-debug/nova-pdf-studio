#!/usr/bin/env bash
# إعادة تعيين كلمة سر حساب على خادم الإنتاج.
#   bash scripts/reset-password.sh you@example.com
# تُكتب كلمة السر مخفيّة ومرّتين، ولا تمرّ بسجلّ الأوامر.
set -euo pipefail

cd "$(dirname "$0")/.."

die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

EMAIL=${1:-}
[ -n "$EMAIL" ] || read -rp "بريد الحساب: " EMAIL
[ -n "$EMAIL" ] || die "البريد مطلوب"

read -rsp "كلمة السر الجديدة (12 حرفاً فأكثر): " P1; echo
read -rsp "أعد كتابتها: " P2; echo
[ "$P1" = "$P2" ] || die "الكلمتان غير متطابقتين — لم يتغيّر شيء"
[ "${#P1}" -ge 12 ] || die "كلمة السر أقصر من 12 حرفاً — لم يتغيّر شيء"

# الصورة ذات الشيفرة المصدرية (target: build) هي وحدها التي تشغّل tsx
RESET_EMAIL="$EMAIL" RESET_PASSWORD="$P1" docker compose -f docker-compose.prod.yml run --rm \
  -e RESET_EMAIL -e RESET_PASSWORD \
  bootstrap npx tsx src/server/db/reset-password.ts
