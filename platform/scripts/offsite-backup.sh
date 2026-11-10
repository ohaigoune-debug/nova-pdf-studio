#!/bin/sh
# نسخ النسخ الاحتياطية خارج الخادم (Google Drive أو أي وجهة يدعمها rclone).
# خدمة backup تكتب في ./backups على القرص نفسه؛ هذه الخدمة ترفع أحدث النسخ إلى وجهة بعيدة
# فلا يضيع شيء إن تلف القرص أو فُقد الخادم.
#
# لا تعمل إلا بعد الإعداد (docs/DEPLOYMENT.md ← «النسخ خارج الخادم»):
#   1) ملف ./rclone/rclone.conf فيه الوجهة   2) OFFSITE_REMOTE في .env (مثال: gdrive:madrasa-backups)
# بلا إعداد تنتظر بهدوء ولا تُفشل النشر.
#
# القواعد:
#   • تُرفع أحدث OFFSITE_KEEP_DB نسخة قاعدة وأحدث OFFSITE_KEEP_UPLOADS نسخة مرفوعات (المرفوعات كبيرة:
#     Drive المجاني 15 غيغا، فالافتراضي نسختان).
#   • ما رُفع من قبل لا يُرفع ثانية.
#   • لا يُحذف شيء من الوجهة إلا بعد نجاح رفع الجديد، وتبقى دائمًا أحدث النسخ.
#   • الملفات غير المكتملة (.part) لا تُمَس.
set -eu

SRC=${OFFSITE_SRC:-/backups}
REMOTE=${OFFSITE_REMOTE:-}
CONF=${RCLONE_CONFIG:-/config/rclone/rclone.conf}
KEEP_DB=${OFFSITE_KEEP_DB:-14}
KEEP_UPLOADS=${OFFSITE_KEEP_UPLOADS:-2}
INTERVAL_HOURS=${OFFSITE_INTERVAL_HOURS:-6}
RCLONE=${RCLONE_BIN:-rclone}

log() { echo "[offsite] $(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

configured() {
  [ -n "$REMOTE" ] && [ -s "$CONF" ]
}

# أسماء الملفات في الوجهة المطابقة للنمط، الأحدث أولًا (الأسماء بتاريخ ISO فالفرز النصّي يكفي)
remote_list() {
  "$RCLONE" --config "$CONF" lsf --files-only --include "$1" "$REMOTE" 2>/dev/null | sort -r
}

# أحدث $2 ملفًا محليًّا مطابقًا للنمط $1
local_newest() {
  # shellcheck disable=SC2012 -- الأسماء مولّدة بتاريخ ISO
  ls -1 "$SRC"/$1 2>/dev/null | sort -r | head -n "$2"
}

# يرفع أحدث النسخ من نوع واحد ثم يحذف من الوجهة ما تجاوز العدد. يعيد 1 إن فشل أي رفع.
sync_kind() {
  pattern="$1"
  keep="$2"
  failed=0
  uploaded=0
  existing=$(remote_list "$pattern" || true)

  for f in $(local_newest "$pattern" "$keep"); do
    name=$(basename "$f")
    if printf '%s\n' "$existing" | grep -qxF "$name"; then
      continue
    fi
    log "رفع $name ($(du -h "$f" | cut -f1))"
    if "$RCLONE" --config "$CONF" copy "$f" "$REMOTE" && remote_list "$pattern" | grep -qxF "$name"; then
      uploaded=$((uploaded + 1))
    else
      log "✖ فشل رفع $name — لن يُحذف شيء من الوجهة في هذه الدورة"
      failed=1
    fi
  done

  if [ "$failed" -eq 0 ]; then
    remote_list "$pattern" | tail -n "+$((keep + 1))" | while read -r old; do
      [ -n "$old" ] || continue
      log "حذف نسخة قديمة من الوجهة: $old"
      "$RCLONE" --config "$CONF" deletefile "$REMOTE/$old" || log "✖ تعذّر حذف $old"
    done
  fi

  [ "$uploaded" -gt 0 ] && log "$pattern: رُفعت $uploaded نسخة"
  return "$failed"
}

run_once() {
  if ! configured; then
    log "غير مُعَدّ: اضبط OFFSITE_REMOTE وضع rclone.conf في ./rclone (docs/DEPLOYMENT.md). لا شيء يُنسخ خارج الخادم الآن."
    return 2
  fi
  if [ -z "$(local_newest 'db-*.sql.gz' 1)" ]; then
    log "لا نسخ محلية بعد في $SRC — انتظار خدمة backup"
    return 0
  fi
  rc=0
  sync_kind 'db-*.sql.gz' "$KEEP_DB" || rc=1
  sync_kind 'uploads-*.tar.gz' "$KEEP_UPLOADS" || rc=1
  if [ "$rc" -eq 0 ]; then
    log "✔ الوجهة محدَّثة: أحدث قاعدة $(remote_list 'db-*.sql.gz' | head -n 1)، أحدث مرفوعات $(remote_list 'uploads-*.tar.gz' | head -n 1)"
  fi
  return "$rc"
}

# دورة واحدة ثم الخروج (للتجربة بعد الإعداد):
#   docker compose -f docker-compose.prod.yml run --rm offsite --once
if [ "${1:-}" = "--once" ]; then
  run_once
  exit $?
fi

log "بدء الخدمة — فحص كل $INTERVAL_HOURS ساعة، الوجهة: ${REMOTE:-غير مضبوطة}"
while true; do
  run_once || true
  sleep "$((INTERVAL_HOURS * 3600))"
done
