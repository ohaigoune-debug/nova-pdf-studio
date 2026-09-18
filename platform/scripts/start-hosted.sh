#!/usr/bin/env sh
# تشغيل على استضافة مُدارة (Render/Railway/Fly): هجرات + بيانات تجريبية (مرة واحدة، عند SEED_DEMO=1) ثم الخادم
set -e
export AUTO_MIGRATE=1
if [ "$SEED_DEMO" = "1" ]; then
  echo "[start] seeding demo data if not seeded yet…"
  npx tsx src/server/db/seed.ts || echo "[start] seed skipped/failed (continuing)"
else
  npx tsx src/server/db/migrate.ts
fi
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
