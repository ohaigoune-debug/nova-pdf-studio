#!/usr/bin/env bash
# إعادة تعيين كلمة سر حساب على خادم الإنتاج.
#   bash scripts/reset-password.sh you@example.com            # تُكتب مخفيّة ومرّتين
#   bash scripts/reset-password.sh you@example.com --random   # يولّدها الخادم ويعرضها مرّة
# لا تمرّ كلمة السر بسجلّ الأوامر ولا بقائمة العمليات في الحالتين.
set -euo pipefail

cd "$(dirname "$0")/.."

die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

EMAIL=${1:-}
MODE=${2:-}
[ -n "$EMAIL" ] || read -rp "بريد الحساب: " EMAIL
[ -n "$EMAIL" ] || die "البريد مطلوب"

# --random: للطرفيات التي تُسقط محارف عند الكتابة المخفيّة. 16 محرفاً
# من أرقام وحروف صغيرة فقط: لا لبس بين لوحات المفاتيح ولا حاجة لرموز.
if [ "$MODE" = "--random" ]; then
  P1=$(openssl rand -hex 8)
  SHOW=1
else
  read -rsp "كلمة السر الجديدة (12 حرفاً فأكثر): " P1; echo
  read -rsp "أعد كتابتها: " P2; echo
  [ "$P1" = "$P2" ] || die "الكلمتان غير متطابقتين — لم يتغيّر شيء"
  [ "${#P1}" -ge 12 ] || die "كلمة السر أقصر من 12 حرفاً — لم يتغيّر شيء"
  SHOW=0
fi

# الصورة ذات الشيفرة المصدرية (target: build) هي وحدها التي تشغّل tsx
RESET_EMAIL="$EMAIL" RESET_PASSWORD="$P1" docker compose -f docker-compose.prod.yml run --rm \
  -e RESET_EMAIL -e RESET_PASSWORD \
  bootstrap npx tsx src/server/db/reset-password.ts

if [ "$SHOW" = 1 ]; then
  printf '\n\033[1;32mكلمة السر الجديدة:\033[0m  %s\n' "$P1"
  printf 'اكتبها في مكان آمن، ادخل بها، ثم غيّرها من داخل المنصة.\n'
  printf 'امسح الشاشة بعدها:  clear && history -c\n\n'
fi
