#!/usr/bin/env bash
# اختبار الضغط على نسخة منفصلة من المنصة، على الخادم نفسه، دون لمس الموقع الحقيقي أو قاعدته.
#
#   bash deploy/stress/run.sh
#
# ما يفعله:
#   1) يشغّل مشروع Docker مستقلًّا اسمه madrasa-stress: قاعدة فارغة + نسخة من صورة التطبيق الشغّالة الآن (بلا منفذ مفتوح).
#   2) يجهّز القاعدة: البيانات المرجعية، والمواضيع المعتمدة، و400 حساب تلميذ وهميّ.
#   3) يرفع عدد التلاميذ الوهميين تدريجيًّا (50 ← 100 ← 200 ← 400، دقيقتان لكل مستوى) ويقيس سرعة الردود والأخطاء،
#      ويراقب الموقع الحقيقي كل 10 ثوانٍ: إن بطؤ يتوقف الاختبار فورًا.
#   4) يحذف المشروع المؤقت كله مع قاعدته في النهاية (حتى لو أوقفته بـ Ctrl+C).
#
# خيارات (اختيارية): STRESS_LEVELS="50 100 200 400 800" STRESS_SECONDS=120 bash deploy/stress/run.sh
#   STRESS_MODE=real bash deploy/stress/run.sh   ⇐ 500 ← 1000 ← 2000 ← 3000 تلميذ واقعيّ (قراءة 15–30 ثانية بين الخطوات)
#   APP_IMAGE=platform-app:perf-xxxx TOOLS_IMAGE=platform-tools:perf-xxxx STRESS_WORKERS=4 …   ⇐ صورة مبنيّة للتجربة وعدّة عمليات
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
APP_IMAGE="${APP_IMAGE:-$(docker ps --format '{{.Image}}' | grep -o 'platform-app:[^ ]*' | head -1)}"
[ -n "$APP_IMAGE" ] || { echo "✖ لم أجد صورة platform-app شغّالة"; exit 1; }
TAG="${APP_IMAGE#platform-app:}"
TOOLS_IMAGE="${TOOLS_IMAGE:-platform-tools:$TAG}"
docker image inspect "$APP_IMAGE" >/dev/null || { echo "✖ الصورة $APP_IMAGE غير موجودة"; exit 1; }
docker image inspect "$TOOLS_IMAGE" >/dev/null || { echo "✖ الصورة $TOOLS_IMAGE غير موجودة (تُبنى بـ docker build --target build)"; exit 1; }

# STRESS_MODE=real: تلميذ واقعيّ يقرأ ويفكّر 15–30 ثانية بين كل خطوة وأخرى (لقياس آلاف التلاميذ الحقيقيين)
if [ "${STRESS_MODE:-}" = real ]; then
  LEVELS="${STRESS_LEVELS:-500 1000 2000 3000}"
  export STRESS_THINK_MS="${STRESS_THINK_MS:-15000-30000}" STRESS_SECONDS="${STRESS_SECONDS:-240}" STRESS_RAMP_SECONDS="${STRESS_RAMP_SECONDS:-60}"
else
  LEVELS="${STRESS_LEVELS:-50 100 200 400}"
fi
MAXL=$(echo "$LEVELS" | tr ' ' '\n' | sort -n | tail -1)
export STRESS_ACCOUNTS="${STRESS_ACCOUNTS:-$(( MAXL > 400 ? MAXL : 400 ))}"
export STRESS_LEVELS="$LEVELS"
export APP_IMAGE TOOLS_IMAGE
export STRESS_OUT_DIR="/opt/madrasa/stress/$(date +%Y%m%d-%H%M)"
export STRESS_SESSION_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
export STRESS_QR_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
mkdir -p "$STRESS_OUT_DIR"
P=(docker compose -p madrasa-stress -f "$DIR/docker-compose.stress.yml")

cleanup() {
  [ -n "${STATS_PID:-}" ] && kill "$STATS_PID" 2>/dev/null || true
  echo "• حذف نسخة الاختبار وقاعدتها…"
  "${P[@]}" --profile tools down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$STRESS_OUT_DIR/accounts.json"   # رموز الجلسات الوهمية لا تبقى على القرص
}
trap cleanup EXIT

echo "• الصورة: $APP_IMAGE — عمليات التطبيق: ${STRESS_WORKERS:-1} — النتائج في $STRESS_OUT_DIR"
"${P[@]}" up -d stress-db stress-app
echo "• انتظار جاهزية نسخة الاختبار…"
for i in $(seq 1 90); do
  st=$(docker inspect -f '{{.State.Health.Status}}' "$("${P[@]}" ps -q stress-app)" 2>/dev/null || echo starting)
  [ "$st" = healthy ] && break
  sleep 5
done
[ "$st" = healthy ] || { echo "✖ نسخة الاختبار لم تجهز"; "${P[@]}" logs --tail 40 stress-app; exit 1; }

docker run --rm --entrypoint cat "$APP_IMAGE" /app/.next/server/server-reference-manifest.json > "$STRESS_OUT_DIR/manifest.json"
# جداول القاعدة الفارغة أولًا (التطبيق لا يُنشئها قبل أول طلب يحتاجها)
"${P[@]}" run --rm tools npx tsx src/server/db/migrate.ts
"${P[@]}" exec -T stress-db psql -q -U stress -d stress -c 'create extension if not exists pg_stat_statements' >/dev/null
"${P[@]}" run --rm tools npx tsx scripts/play/exams.ts import-approved --confirm-host stress-db
"${P[@]}" run --rm tools npx tsx scripts/stress/prepare.ts
# بنك أسئلة PLAY الحقيقي (صفحة PLAY الرئيسية تعدّ أسئلة كل مادة ودرس) — كما في الإنتاج
echo "• استيراد بنك أسئلة PLAY…"
"${P[@]}" run --rm tools npx tsx scripts/play/import.ts > "$STRESS_OUT_DIR/play-import.log" 2>&1 || echo "  (تعذّر استيراد البنك — انظر play-import.log؛ يكمل الاختبار دونه)"
tail -2 "$STRESS_OUT_DIR/play-import.log" || true
"${P[@]}" exec -T stress-db psql -q -U stress -d stress -c 'select pg_stat_statements_reset()' >/dev/null

# مراقبة الذاكرة والمعالج لكل الحاويات (الحقيقية والمؤقتة) كل 5 ثوانٍ
( while true; do docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' >> "$STRESS_OUT_DIR/stats.tsv"; sleep 5; done ) &
STATS_PID=$!

"${P[@]}" run --rm tools node scripts/stress/load.mjs | tee "$STRESS_OUT_DIR/result.txt"

kill "$STATS_PID" 2>/dev/null || true
STATS_PID=
echo
echo "══ أثقل الاستعلامات أثناء الاختبار (الوقت الكلّي) ══"
"${P[@]}" exec -T stress-db psql -U stress -d stress -P pager=off -c "select round(total_exec_time::numeric/1000,1) as total_s, calls, round(mean_exec_time::numeric,1) as mean_ms, round(rows::numeric/greatest(calls,1),0) as rows_per_call, left(regexp_replace(query, '\s+', ' ', 'g'), 230) as query from pg_stat_statements where dbid = (select oid from pg_database where datname = 'stress') order by total_exec_time desc limit 12" | tee "$STRESS_OUT_DIR/queries.txt"
echo
echo "══ أعلى استهلاك أثناء الاختبار ══"
awk -F'\t' 'function mib(v){ if (v ~ /GiB/) return v*1024; if (v ~ /KiB/) return v/1024; return v+0 } {gsub("%","",$2); split($3,m," / "); c=$2+0; x=mib(m[1]); if (c>cpu[$1]) cpu[$1]=c; if (x>mem[$1]) mem[$1]=x} END {for (k in cpu) printf "%-32s CPU حتى %6.1f%%   ذاكرة حتى %7.0f MiB\n", k, cpu[k], mem[k]}' "$STRESS_OUT_DIR/stats.tsv" | sort | tee "$STRESS_OUT_DIR/peak.txt"
echo
echo "عدد أنوية المعالج: $(nproc) — الذاكرة الكلية: $(free -h | awk '/Mem:/{print $2}')"
echo "✔ انتهى. أرسل لي ما فوق هذا السطر (أو الملفين $STRESS_OUT_DIR/result.txt و peak.txt)."
