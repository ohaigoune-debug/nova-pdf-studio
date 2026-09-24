#!/usr/bin/env bash
# جلب روابط مواضيع البكالوريا السابقة من DzExams إلى تبويب «بكالوريات سابقة».
#   bash scripts/bac-sync.sh --dry              تجربة: يطبع ما وجده في مادة واحدة بلا حفظ
#   bash scripts/bac-sync.sh                    كل المواد (المرّة الأولى 30–60 دقيقة: طلب كل ثانية)
#   bash scripts/bac-sync.sh --subject=arabe    مادة واحدة
#   bash scripts/bac-sync.sh --refresh          يعيد فحص المحفوظ لتحديث روابطه
# روابط فقط — لا يُنزَّل ولا يُخزَّن أي ملف.
set -euo pipefail

cd "$(dirname "$0")/.."

# نفس أسلوب reset-password: صورة البناء (فيها tsx) مع شيفرة القرص للقراءة،
# فتعمل الأداة فور git pull بلا إعادة بناء
docker compose -f docker-compose.prod.yml run --rm -T \
  -v "$PWD/src:/app/src:ro" \
  bootstrap npx tsx src/server/bac/sync-cli.ts "$@"
