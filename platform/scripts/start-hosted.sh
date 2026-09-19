#!/usr/bin/env sh
# تشغيل على استضافة مُدارة (Render/Railway/Fly/VPS): هجرات ثم إقلاع ثم الخادم
set -e
export AUTO_MIGRATE=1

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  # إنتاج: بيانات مرجعية + أول مشرف، بلا بيانات تجريبية. آمن للتكرار عند كل نشر.
  echo "[start] bootstrapping production data…"
  npx tsx src/server/db/bootstrap.ts
elif [ "$SEED_DEMO" = "1" ]; then
  echo "[start] seeding DEMO data (public passwords — never for a real platform)…"
  npx tsx src/server/db/seed.ts || echo "[start] seed skipped/failed (continuing)"
else
  npx tsx src/server/db/migrate.ts
  echo "[start] no ADMIN_EMAIL/ADMIN_PASSWORD and no SEED_DEMO — لا يوجد حساب مشرف بعد"
fi

exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
