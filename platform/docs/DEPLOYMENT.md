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
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | `mock` افتراضياً؛ `anthropic` أو `openai` مع مفتاح لمزوّد حقيقي |
| `AI_BASE_URL` | `openai` فقط: خادم متوافق بدل `api.openai.com` |
| `YOUTUBE_API_KEY` | اختياري: استيراد قوائم التشغيل كاملة؛ بدونه آخر ١٥ فيديو من كل قائمة |
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

#### تفعيل وساطة Cloudflare (السحابة البرتقالية)

الوساطة تخفي عنوان الخادم، وتصدّ هجمات الإغراق، وتخدم الملفات الثابتة من مراكز Cloudflare (منها الجزائر العاصمة وعنابة وقسنطينة). بعدها يصل كل طلب إلى الخادم من عناوين Cloudflare لا من التلميذ.

**المنصة تتكفّل بعنوان التلميذ وحدها** (`src/server/lib/client-ip.ts`): إن كان من اتصل بالخادم (`X-Real-IP` الذي يكتبه Caddy) من نطاقات Cloudflare، أخذت عنوان التلميذ من `CF-Connecting-IP`، وهي ترويسة يكتبها Cloudflare بنفسه. ومن يتصل بالخادم مباشرة ويزوّرها لا يُصدَّق. فلا حاجة إلى تعديل Caddyfile الوكيل المشترك. نطاقات Cloudflare في `src/server/lib/cloudflare-ips.ts`، ومصدرها <https://www.cloudflare.com/ips/>:

```
173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
```

**قبل التحويل** (لوحة Cloudflare ← النطاق madrasadz.com):

1. **SSL/TLS ← Overview:** اختر **Full (strict)**. لا Flexible: يسبّب حلقة إعادة توجيه لا تنتهي.
2. **SSL/TLS ← Edge Certificates ← Always Use HTTPS:** **Off**. Caddy يحوّل إلى HTTPS بنفسه، ويترك مسار تجديد الشهادة (`/.well-known/acme-challenge/`) مفتوحًا على HTTP. لو حوّله Cloudflare لتعذّر تجديد شهادة Caddy بعد شهرين.
3. **Speed ← Optimization:** **Rocket Loader: Off**. يعيد كتابة السكربتات فيكسر سياسة CSP بالـnonce، ولا تعمل الصفحات.
4. **Scrape Shield ← Email Address Obfuscation: Off**. يحقن سكربتًا تحجبه CSP.
5. **Security ← Bots ← Bot Fight Mode: Off**. يحجب تطبيقَي آيفون وأندرويد (طلبات `/api/v1/*` لا تحلّ اختبار المتصفح). وضع «Under Attack» للطوارئ فقط، وبقاعدة WAF تستثني `/api/`.
6. **Caching:** اتركه على الافتراضي (الملفات الثابتة فقط). لا تضع «Cache Everything». ردود الملفات المحمية (PDF بالاسم، الوسائط، Word) ترسل `Cache-Control: private, no-store` فلا تُخزَّن.

**التحويل:** DNS ← سجلّا `madrasadz.com` و`www` ← اضغط السحابة لتصير **برتقالية (Proxied)**.

**التحقق** (خلال دقيقة إلى خمس):

- `curl -sI https://madrasadz.com | grep -i cf-ray` يجب أن يعيد سطرًا ينتهي برمز مركز (مثل `-ALG`).
- لوحة الإدارة ← **الأمان**: بطاقة «عنوانك كما تراه المنصة» تقول «الطلب مرّ عبر Cloudflare»، والعنوان المعروض هو عنوان شبكتك (قارنه بـifconfig.me على هاتفك). إن ظهر تحذير أحمر فأعد السحابة رمادية فورًا.
- سجّل الدخول، وافتح درسًا بفيديو وملف PDF، وجرّب تطبيق آيفون.

**حدود Cloudflare المجانية:** جسم الطلب حتى 100 MB (فيديوهات الدورات تُرفع من المتصفح إلى Bunny مباشرة فلا تتأثر، أما رفع ملف أكبر إلى خادمنا فيفشل)، ومهلة الرد 100 ثانية.

**التراجع:** أعد السحابة رمادية. لا شيء في المنصة يحتاج تغييرًا، فهي تعمل بالوضعين.

**إن أردت لاحقًا أن يحوّل Caddy العنوان بنفسه** (اختياري): في الكتلة العامة أعلى Caddyfile الوكيل أضف `servers { trusted_proxies static <النطاقات أعلاه> ; client_ip_headers CF-Connecting-IP }`، وفي كتلة `madrasadz.com` غيّر `{remote_host}` إلى `{client_ip}` (Caddy 2.7 فأحدث). المنصة تقبل الوضعين.


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

### ب-3) إن كان الخادم الأمامي Caddy داخل Docker

`127.0.0.1` للخادم لا تصله حاوية. بدل فتح منفذ، تُضمّ حاوية التطبيق إلى شبكة الوكيل فيصل إليها باسمها — ولا يُفتح أي منفذ على الخادم أصلاً:

```sh
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' bash scripts/deploy-edge.sh
```

السكربت يولّد `.env`، يبني الحزمة بلا Caddy خاص بها، ينتظر استجابة التطبيق، يُلحق كتلة الموقع من `deploy/madrasadz.caddy` بـ Caddyfile الوكيل بعد أخذ نسخة منه، **يتحقّق من صحّة الإعداد قبل إعادة التحميل** ويعيد النسخة إن فسد — فلا تتوقف المواقع الأخرى. إن اختلفت أسماء خادمك مرّر:

```sh
EDGE_NET=…_default EDGE_CADDY=…-caddy-1 EDGE_CADDYFILE=/path/Caddyfile
```

### ج) تحقّق

```sh
curl -I https://madrasadz.com/login                      # 200 وشهادة صالحة
curl -s https://madrasadz.com/.well-known/assetlinks.json # JSON بعد إضافة البصمة، وإلا 404
```

ثم ادخل بـ `ADMIN_EMAIL` وأنشئ أول أستاذ من لوحة المشرف.

**نسيت كلمة سر المالك؟** لا أحد فوقه ليعيدها، ولا يصل بريد استعادة قبل ضبط `MAIL_PROVIDER`. أعِدها من الخادم:

```sh
bash scripts/reset-password.sh you@example.com
```

تُكتب مخفيّة ومرّتين، ولا تمرّ بسجلّ الأوامر. كل جلسات ذلك الحساب تُنهى، فمن كان داخلاً بالقديمة يخرج.

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

#### النسخ خارج الخادم (Google Drive)

نسخة على القرص نفسه تحميك من الخطأ البشري وبطلان الهجرة، لا من تلف القرص أو فقدان الخادم. خدمة `offsite` ترفع أحدث النسخ إلى Google Drive كل 6 ساعات: آخر 14 نسخة من القاعدة وآخر نسختين من المرفوعات (المرفوعات كبيرة، وDrive المجاني 15 غيغا). الإعداد مرة واحدة:

1. **على حاسوبك** (لا على الخادم، لأن الربط يفتح متصفحًا): ثبّت [rclone](https://rclone.org/downloads/) ثم نفّذ `rclone config`، واختر `n` (وجهة جديدة)، الاسم `gdrive`، النوع `drive`، واترك الباقي على الافتراضي، ووافق في المتصفح بحساب Google الذي تريد النسخ إليه.
2. اعرض مكان ملف الإعداد بـ `rclone config file`، وانسخ هذا الملف إلى الخادم:
   ```sh
   scp rclone.conf root@SERVER:/opt/madrasa/platform/rclone/rclone.conf
   ```
   الملف فيه رمز وصول إلى حسابك: مجلد `rclone/` مستثنى من Git، ولا يُرسَل لأحد.
3. **على الخادم** أضف إلى `.env`:
   ```sh
   OFFSITE_REMOTE=gdrive:madrasa-backups
   ```
4. شغّل الخدمة وجرّب دورة واحدة:
   ```sh
   docker compose -f docker-compose.prod.yml up -d offsite
   docker compose -f docker-compose.prod.yml run --rm offsite --once
   ```
   يجب أن ينتهي السجل بسطر `✔ الوجهة محدَّثة`، وأن يظهر مجلد `madrasa-backups` في Drive وفيه ملف `db-….sql.gz` وملف `uploads-….tar.gz`.

المتابعة: `docker compose -f docker-compose.prod.yml logs --tail 20 offsite`. بلا إعداد تكتب الخدمة «غير مُعَدّ» وتنتظر، ولا تُفشل النشر. لا يُحذف شيء من Drive إلا بعد نجاح رفع الجديد.

#### تنظيف مخلّفات Docker

كل نشر يترك ذاكرة بناء (build cache) تتراكم حتى تملأ القرص: بلغت 83 غيغا في نوفمبر 2026. أضف إلى crontab الخادم (`crontab -e`) تنظيفًا أسبوعيًا يُبقي ذاكرة آخر أسبوع فيبقى النشر سريعًا:

```sh
# كل أحد 04:00 — يحذف ذاكرة البناء الأقدم من 7 أيام فقط؛ لا يمسّ الحاويات ولا الصور المستعملة ولا البيانات
0 4 * * 0 docker builder prune -af --filter until=168h >/var/log/docker-prune.log 2>&1
```

لا تستعمل `docker system prune -a` ولا `--volumes`: الأول يحذف صور الرجوع، والثاني قد يحذف البيانات.

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
