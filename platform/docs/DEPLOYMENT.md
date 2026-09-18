# دليل النشر — DEPLOYMENT

## المتطلبات

- Node.js 22+ (أو Docker)
- PostgreSQL 14+ (Supabase / Neon / RDS / خادم ذاتي). محلياً يكفي PGlite بلا خادم.
- أسرار: `SESSION_SECRET`, `QR_TOKEN_SECRET` (أنشئها بـ `openssl rand -base64 48`)، و`CRON_SECRET` إن استعملت Cron خارجياً.

## المتغيّرات (انظر `.env.example`)

| المتغيّر | الوظيفة |
|---|---|
| `DATABASE_URL` | `postgres://…` للإنتاج أو `pglite://./data/pglite` محلياً |
| `AUTO_MIGRATE=1` | تطبيق الهجرات من `drizzle/` عند الإقلاع (أو `npm run db:migrate` يدوياً) |
| `APP_URL` | عنوان الموقع العام (روابط البريد وإعادة التعيين) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | `mock` افتراضياً؛ `anthropic` مع مفتاح لمزوّد حقيقي |
| `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM` | `console` افتراضياً؛ `resend` أو `webhook` (`MAIL_WEBHOOK_URL`) للإنتاج |
| `STORAGE_DRIVER` | `local` (مجلد `UPLOADS_DIR`) أو `s3` مع `S3_BUCKET/S3_REGION/S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY` (متوافق مع R2/MinIO/Supabase) |
| `JOBS_INLINE_WORKER` | `1` افتراضياً: العامل داخل عملية الخادم؛ `0` للاعتماد على Cron/العامل المستقل فقط |
| `CRON_SECRET` | سرّ `POST /api/v1/jobs/run` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | إشعارات الدفع؛ ولّدها بـ `npm run push:keys` (بدونها تبقى الإشعارات داخل التطبيق) |

لا يوجد أي متغيّر بادئته `NEXT_PUBLIC_`؛ لا مفاتيح في المتصفح.

## 1) Docker Compose (أسرع طريقة)

```bash
cd platform
cp .env.example .env            # واضبط الأسرار
SESSION_SECRET=… QR_TOKEN_SECRET=… POSTGRES_PASSWORD=… docker compose up -d --build
docker compose exec app node -e "console.log('ok')"
```

- الخدمات: `db` (Postgres 16)، `app` (Next standalone على 3000)، `cron` (يستدعي العامل كل دقيقة).
- الملفات المرفوعة في volume `uploads` (أو اضبط `STORAGE_DRIVER=s3`).
- أول مشرف: `npm run db:seed` يزرع بيانات تجريبية؛ في الإنتاج أنشئ المشرف عبر `ensureSuperAdmin` (سكربت `db:seed` بدون `SEED_DEMO`) أو من لوحة المشرف لاحقاً.

## 2) خادم Node مباشر (VPS)

```bash
cd platform && npm ci
DATABASE_URL=postgres://… npm run db:migrate
npm run build && PORT=3000 npm start          # أو pm2 start npm --name madrasa -- start
npm run jobs:worker                            # اختياري: عامل مستقل (pm2 كذلك)
```

ضع Nginx/Caddy أمامه مع TLS؛ التطبيق يرسل `Strict-Transport-Security` و`Content-Security-Policy` بـ nonce ويحتاج `X-Forwarded-For` من الوكيل للحدّ من المحاولات لكل IP.

## 3) Vercel / منصّات Serverless

- اربط المستودع، جذر المشروع `platform/`، وأضف المتغيّرات.
- استعمل Postgres مُدار (Neon/Supabase) و`STORAGE_DRIVER=s3` (لا قرص دائم).
- فعّل Cron في `vercel.json` لاستدعاء `/api/v1/jobs/run` كل دقيقة مع الترويسة `x-cron-secret`، واضبط `JOBS_INLINE_WORKER=0` إن أردت التنفيذ عبر Cron فقط.

## Row Level Security (Postgres/Supabase)

```bash
DATABASE_URL=postgres://… npm run db:rls
```

يطبّق `src/server/db/rls.sql`. التطبيق يعزل المستأجرين في الخدمات؛ RLS طبقة دفاع ثانية تتطلب ضبط `app.user_id / app.role / app.workspace_id` في كل معاملة (انظر PERMISSIONS.md).

## الصيانة

- مهمة `CLEANUP` تُجدوَل تلقائياً كل 24 ساعة من العامل/Cron: جلسات منتهية، nonces، رموز إعادة تعيين، حدود المحاولات، مهام قديمة (ما عدا التقارير).
- النسخ الاحتياطي: `pg_dump` لقاعدة البيانات + مجلد الرفع أو الدلو.
- المراقبة: `/admin/ai` (المهام الفاشلة)، `/admin/security` (الجلسات والدخول)، `/admin/logs` (التدقيق).

## قائمة ما قبل الإطلاق

- [ ] أسرار قوية وفريدة، `NODE_ENV=production`
- [ ] TLS + وكيل يمرّر `X-Forwarded-For`
- [ ] `AUTO_MIGRATE=1` أو هجرات مطبّقة
- [ ] بريد حقيقي (`MAIL_PROVIDER`) لإعادة تعيين كلمة السر
- [ ] تخزين S3 أو volume دائم للمرفوعات
- [ ] Cron أو عامل مستقل للمهام
- [ ] RLS مفعّلة على Postgres
- [ ] نسخ احتياطي مجدول
