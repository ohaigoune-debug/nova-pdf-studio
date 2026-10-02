#!/usr/bin/env bash
# بناء بنك البكالوريا على الخادم بالذكاء الاصطناعي الحقيقي (مفتاح لوحة الإدارة أو AI_API_KEY).
#   bash scripts/bac-bank.sh --report                 جرد فقط
#   bash scripts/bac-bank.sh --dry --all              يعرض ما سيفعله بلا كتابة
#   bash scripts/bac-bank.sh --sync --all             الجولة الأولى: جلب DzExams ثم تسجيل → معالجة → توثيق آلي → حلول مفصّلة
#   bash scripts/bac-bank.sh --all                    الجولات التالية (ما ينتظر فقط)
#   bash scripts/bac-bank.sh --process=20 --subject=MATH   دفعة محدودة لمادة واحدة
#   bash scripts/bac-bank.sh --retry-failed --process       إعادة ما فشل (الممسوح ضوئياً يبقى للمراجعة)
# يُستأنف بأمان: كل وثيقة/تمرين يُحفظ فور إتمامه (نقطة تحقّق)، وCtrl+C يوقف بعد الوثيقة الحالية.
# يُفضَّل تشغيله داخل tmux أو nohup لأن الجولة الأولى قد تأخذ ساعات:
#   nohup bash scripts/bac-bank.sh --sync --all > data/bac-bank.log 2>&1 &
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml --profile tools run --rm -T tools npx tsx src/server/bac/bank-cli.ts "$@"
