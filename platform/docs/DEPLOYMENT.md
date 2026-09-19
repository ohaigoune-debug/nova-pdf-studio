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

## 0) الإطلاق الحقيقي على نطاقك — الإقلاع الإنتاجي

البيانات التجريبية (`SEED_DEMO=1`) تنشئ حسابات كلمات سرّها **منشورة في README**. لا تستعملها على منصة حقيقية أبداً.

للإطلاق، اضبط هذين المتغيّرين بدلها:

```
ADMIN_EMAIL=you@madrasadz.com
ADMIN_PASSWORD=…              # 12 حرفاً على الأقل
```

عند الإقلاع يُنفَّذ `npm run db:bootstrap` تلقائياً فيُدرج البيانات المرجعية (48 ولاية، المستويات، الشعب، المهارات) وينشئ **أول مشرف عام فقط** — بلا أي بيانات تجريبية. آمن للتكرار: كل نشر لاحق لا يضاعف شيئاً ولا يغيّر كلمة سر المالك.

يدوياً على خادمك:

```sh
ADMIN_EMAIL=you@madrasadz.com ADMIN_PASSWORD=… npm run db:bootstrap
```

> بلا `ADMIN_EMAIL` وبلا `SEED_DEMO` تُطبَّق الهجرات فقط — **ولن يوجد حساب تدخل به**.

### متغيّرات النطاق والتطبيق

| المتغيّر | القيمة |
|---|---|
| `APP_URL` | `https://madrasadz.com` |
| `ANDROID_PACKAGE_NAME` | `dz.madrasa.app` |
| `ANDROID_CERT_FINGERPRINTS` | بصمة SHA-256 من بناء التطبيق (وبصمة Play بعد أول رفع، مفصولتان بفاصلة) |

النطاقان `madrasadz.com` و`madrasa.dz` يجب أن يخدما `/.well-known/assetlinks.json` معاً — انظر `platform/android/README.md`.

## 1) نشر بضغطة زر على Render (مجاني للتجربة)

1. افتح: **https://render.com/deploy?repo=https://github.com/ohaigoune-debug/nova-pdf-studio**
2. سجّل الدخول بحساب GitHub، ثم **Apply**.
3. Render يقرأ `render.yaml` من جذر المستودع: ينشئ قاعدة PostgreSQL مجانية وخدمة ويب، يولّد الأسرار تلقائياً، يطبّق الهجرات، ويزرع البيانات التجريبية (`SEED_DEMO=1`).
4. بعد 3–5 دقائق يظهر الرابط بصيغة `https://madrasa-xxxx.onrender.com` — الحسابات التجريبية في README.

ملاحظات الخطة المجانية: الخدمة تنام بعد 15 دقيقة خمول (أول طلب يستغرق ~30 ثانية)، والملفات المرفوعة على القرص المؤقت تُمسح عند إعادة النشر (اضبط `STORAGE_DRIVER=s3` للإنتاج)، وقاعدة Postgres المجانية محدودة المدة. للإنتاج ارفع الخطة أو استعمل Docker/VPS أدناه.

## 2) خادم VPS (Contabo) — الحزمة الإنتاجية الكاملة

`docker-compose.prod.yml` يشغّل: Caddy (شهادة TLS تلقائية) + التطبيق + Postgres + عامل المهام + خدمة إقلاع تعمل مرة وتنتهي.

### أ) وجّه النطاق أولاً

في Cloudflare أضف سجلّي `A` إلى عنوان الخادم:

| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | عنوان IP للخادم |
| A | `www` | نفس العنوان |

> **مهم:** اجعل السحابة **رمادية (DNS only) لا برتقالية**. مع الوكيل البرتقالي ووضع SSL الافتراضي (Flexible) تدخل في حلقة إعادة توجيه لا تنتهي، ولن يتمكّن Caddy من إصدار شهادته. إن أردت وكيل Cloudflare لاحقاً فاضبط SSL/TLS على **Full (strict)** بعد نجاح الشهادة.

تحقّق قبل المتابعة: `dig +short madrasadz.com` يجب أن يعيد عنوان خادمك.

### ب) على الخادم

```sh
curl -fsSL https://get.docker.com | sh
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable

git clone https://github.com/ohaigoune-debug/nova-pdf-studio.git
cd nova-pdf-studio/platform
cp .env.production.example .env
```

عدّل `.env`: النطاق، والأسرار (`openssl rand -base64 48` لكل واحد)، و`ADMIN_EMAIL` / `ADMIN_PASSWORD`.

```sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f bootstrap   # يجب أن ينتهي بـ ✔
```

**أو بأمر واحد** — يثبّت Docker، يولّد الأسرار، يكتب `.env`، يشغّل الحزمة، ثم يتحقق من الشهادة ويشخّص الفشل:

```sh
bash scripts/deploy-vps.sh
```

آمن للتكرار: إن وُجد `.env` فلن يُمَس. تغيير الأسرار بعد التشغيل يُخرج كل المستخدمين، وتغيير كلمة سر Postgres يجعل قاعدة البيانات الموجودة غير قابلة للفتح.

أي متغيّر ناقص يوقف النشر برسالة صريحة قبل أن يعمل شيء.

### ب-2) إن كان على الخادم خادم ويب بالفعل

تحقّق أولاً:

```sh
ss -tlnp | grep -E ':(80|443)\s'
```

إن وجدت nginx أو Apache أو Caddy أو لوحة تحكّم تستمع عليهما، فحزمتنا لن تستطيع الارتباط بهما. شغّلها خلف الموجود بدل مزاحمته:

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.behind-proxy.yml \
  up -d --build --scale caddy=0
```

التطبيق يُخرَج على `127.0.0.1:3000` فقط — غير مرئي من الإنترنت — ثم تُضيف في خادمك الأمامي موقعاً لـ `madrasadz.com` يمرّر إليه. شرطان: شهادة TLS يديرها خادمك الأمامي، وتمرير `X-Forwarded-For` (المنصة تعتمد عليه للحدّ من المحاولات لكل IP).

### ج) تحقّق

```sh
curl -I https://madrasadz.com/login                      # 200 وشهادة صالحة
curl -s https://madrasadz.com/.well-known/assetlinks.json # JSON بعد إضافة البصمة، وإلا 404
```

ثم ادخل بـ `ADMIN_EMAIL` وأنشئ أول أستاذ من لوحة المشرف.

### د) التحديث والنسخ الاحتياطي

```sh
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

خدمة الإقلاع تعمل عند كل نشر بلا ضرر: لا تضاعف شيئاً ولا تغيّر كلمة سر المالك.

النسخ الاحتياطي **تلقائي**: خدمة `backup` تكتب في `./backups` عند كل إقلاع ثم كل 24 ساعة، وتحتفظ بآخر 14 نسخة من القاعدة والمرفوعات.

```sh
ls -lh backups/                                          # النسخ الموجودة
docker compose -f docker-compose.prod.yml logs backup     # سجلّ الخدمة
```

لا تُعتمد نسخة إلا بعد التحقق من اكتمالها (علامة نهاية `pg_dump` وقراءة الأرشيف كاملاً)، ولا يُحذف القديم إلا بعد نجاح الجديد. فشل النسخ يترك ما عندك سليماً ويُسجّل السبب.

> **انسخها خارج الخادم.** نسخة على نفس القرص تحميك من الخطأ البشري وبطلان الهجرة، لا من تلف القرص:
> ```sh
> rsync -az backups/ you@somewhere:/backups/madrasa/     # أو rclone إلى R2/Drive
> ```

### الاستعادة — جرّبها مرة قبل أن تحتاجها

```sh
cd nova-pdf-studio/platform
docker compose -f docker-compose.prod.yml stop app cron

# القاعدة
gunzip -c backups/db-2026….sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U madrasa -d madrasa

# المرفوعات — حاوية منفصلة، لأن خدمة backup تركّبها للقراءة فقط عمداً
docker run --rm -v platform_uploads:/uploads -v "$PWD/backups:/b:ro" alpine \
  sh -c 'tar xzf /b/uploads-2026….tar.gz -C /uploads'

docker compose -f docker-compose.prod.yml start app cron
```

> استعادة القاعدة فوق بيانات قائمة قد تتعارض؛ للاستعادة الكاملة أنشئ قاعدة نظيفة أولاً
> (`dropdb`/`createdb` داخل حاوية `db`) ثم استورد.

> القاعدة والمرفوعات في volumes باسم `platform_pgdata` و`platform_uploads`؛ لا تحذفها بـ `docker compose down -v`.

## 3) Docker Compose محلياً (تجربة سريعة)

```bash
cd platform
cp .env.example .env            # واضبط الأسرار
SESSION_SECRET=… QR_TOKEN_SECRET=… POSTGRES_PASSWORD=… docker compose up -d --build
docker compose exec app node -e "console.log('ok')"
```

- الخدمات: `db` (Postgres 16)، `app` (Next standalone على 3000)، `cron` (يستدعي العامل كل دقيقة).
- الملفات المرفوعة في volume `uploads` (أو اضبط `STORAGE_DRIVER=s3`).
- أول مشرف في الإنتاج: `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:bootstrap` (القسم 0). أما `npm run db:seed` فيزرع بيانات تجريبية دائماً — للتجربة المحلية فقط.

## 4) خادم Node مباشر (بلا Docker)

```bash
cd platform && npm ci
DATABASE_URL=postgres://… npm run db:migrate
npm run build && PORT=3000 npm start          # أو pm2 start npm --name madrasa -- start
npm run jobs:worker                            # اختياري: عامل مستقل (pm2 كذلك)
```

ضع Nginx/Caddy أمامه مع TLS؛ التطبيق يرسل `Strict-Transport-Security` و`Content-Security-Policy` بـ nonce ويحتاج `X-Forwarded-For` من الوكيل للحدّ من المحاولات لكل IP.

## 5) Vercel / منصّات Serverless

- اربط المستودع، جذر المشروع `platform/`، وأضف المتغيّرات.
- استعمل Postgres مُدار (Neon/Supabase) و`STORAGE_DRIVER=s3` (لا قرص دائم).
- `platform/vercel.json` يعرّف Cron يستدعي `/api/v1/jobs/run` كل دقيقة؛ Vercel يرسل الترويسة `Authorization: Bearer $CRON_SECRET` تلقائياً (المسار يقبلها). اضبط `JOBS_INLINE_WORKER=0` إن أردت التنفيذ عبر Cron فقط.

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

- [ ] **`SEED_DEMO` غير مضبوط** — ولا وجود لأي حساب من `DEMO_ACCOUNTS` في قاعدة الإنتاج
- [ ] `ADMIN_EMAIL` + `ADMIN_PASSWORD` مضبوطان، والدخول بهما مُجرَّب
- [ ] أسرار قوية وفريدة، `NODE_ENV=production`
- [ ] `APP_URL=https://madrasadz.com`
- [ ] TLS + وكيل يمرّر `X-Forwarded-For`
- [ ] `AUTO_MIGRATE=1` أو هجرات مطبّقة
- [ ] بريد حقيقي (`MAIL_PROVIDER`) لإعادة تعيين كلمة السر
- [ ] تخزين S3 أو volume دائم للمرفوعات
- [ ] Cron أو عامل مستقل للمهام
- [ ] RLS مفعّلة على Postgres
- [ ] نسخ احتياطي يعمل (`ls backups/`) **ومُجرَّبة استعادته مرة**، ونسخة منه خارج الخادم
- [ ] `/.well-known/assetlinks.json` يعيد JSON لا 404 (لتطبيق أندرويد)


## الفيديوهات والملفات الكبيرة على الاستضافة

- قرص Render/Railway المجاني **مؤقت**: أي فيديو مرفوع على التخزين المحلي يضيع عند إعادة النشر. للفيديوهات الخاصة اضبط `STORAGE_DRIVER=s3` مع حاوية S3 متوافقة (Cloudflare R2 يقدّم 10 GB مجاناً، Backblaze B2، Supabase Storage).
- مع S3 يرفع المتصفح الفيديو **مباشرة** إلى الحاوية برابط Presigned (لا يمرّ عبر خادم التطبيق)؛ لذلك يلزم ضبط CORS على الحاوية للسماح بـ`PUT` من نطاق المنصة (`AllowedOrigins: https://<domain>`, `AllowedMethods: PUT`, `AllowedHeaders: *`).
- بلا S3 يمرّ الرفع كتيار عبر الخادم (`/api/v1/files/:id/upload`) بحدّ `MAX_VIDEO_UPLOAD_MB` (افتراضياً 500)؛ مناسب للتجربة المحلية أو خادم بقرص دائم.
- `MEDIA_MAX_DEVICES` (افتراضياً 2): أقصى عدد عناوين IP مختلفة تشاهد بنفس الحساب خلال 10 دقائق قبل إيقاف التشغيل وتعليم الحساب.
- فيديوهات يوتيوب لا تحتاج تخزيناً: تُضمَّن داخل التطبيق عبر `youtube-nocookie.com`.
