#!/bin/sh
# نسخ احتياطي دوري: قاعدة البيانات + الملفات المرفوعة، مع حذف ما تجاوز عدد النسخ المحفوظة.
# يعمل أولاً عند الإقلاع ثم كل BACKUP_INTERVAL_HOURS ساعة.
set -eu

OUT=/backups
KEEP=${BACKUP_KEEP:-14}
INTERVAL_HOURS=${BACKUP_INTERVAL_HOURS:-24}

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

# النسخة تُكتب باسم مؤقت ولا تُعتمد إلا بعد التحقق من اكتمالها، ثم تُنقَل إلى اسمها النهائي.
# لا نعتمد على حالة خروج pg_dump: في أنبوب `pg_dump | gzip` تكون الحالة حالة gzip وهو ينجح
# دائماً، فينتج ملف مضغوط "صالح" وفارغ. علامة نهاية التفريغ وحدها تثبت أنه اكتمل.
dump_db() {
  tmp="$1.part"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U madrasa -d madrasa | gzip -9 > "$tmp" || true
  if ! gzip -t "$tmp" 2>/dev/null || ! gzip -dc "$tmp" 2>/dev/null | tail -5 | grep -q 'PostgreSQL database dump complete'; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$1"
}

dump_uploads() {
  tmp="$1.part"
  tar czf "$tmp" -C /uploads . 2>/dev/null || true
  # قراءة الأرشيف كاملاً تكشف الانقطاع في منتصفه
  if ! tar tzf "$tmp" >/dev/null 2>&1; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$1"
}

# لا يُحذف شيء إلا بعد نجاح النسخة الجديدة، والأحدث دائماً محفوظ
prune() {
  pattern="$1"
  # shellcheck disable=SC2012 -- الأسماء مولّدة بتاريخ ISO فالفرز النصّي يكفي
  ls -1 "$OUT"/$pattern 2>/dev/null | sort -r | tail -n "+$((KEEP + 1))" | while read -r old; do
    log "حذف نسخة قديمة: $(basename "$old")"
    rm -f "$old"
  done
}

run_once() {
  ts=$(date -u '+%Y%m%dT%H%M%SZ')
  mkdir -p "$OUT"
  rm -f "$OUT"/*.part 2>/dev/null || true

  if dump_db "$OUT/db-$ts.sql.gz"; then
    log "قاعدة البيانات: db-$ts.sql.gz ($(du -h "$OUT/db-$ts.sql.gz" | cut -f1))"
    prune 'db-*.sql.gz'
  else
    log "✖ فشل نسخ قاعدة البيانات — النسخ القديمة لم تُمَس"
    return 1
  fi

  if dump_uploads "$OUT/uploads-$ts.tar.gz"; then
    log "المرفوعات: uploads-$ts.tar.gz ($(du -h "$OUT/uploads-$ts.tar.gz" | cut -f1))"
    prune 'uploads-*.tar.gz'
  else
    log "✖ فشل نسخ المرفوعات — النسخ القديمة لم تُمَس"
    return 1
  fi
}

log "بدء الخدمة — كل $INTERVAL_HOURS ساعة، الاحتفاظ بآخر $KEEP نسخة في $OUT"
while true; do
  run_once || log "✖ دورة فاشلة؛ إعادة المحاولة في الدورة القادمة"
  sleep "$((INTERVAL_HOURS * 3600))"
done
