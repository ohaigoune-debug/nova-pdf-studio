# مدرسة — منصة اللغة والأدب العربي (SaaS متعدد الأساتذة)

منصة تعليمية عربية (RTL أولاً) لطلبة الثانوي والبكالوريا تجمع: محتوى عام، إدارة أفواج وطلاب لكل أستاذ في مساحة معزولة، تسجيل بأكواد، حضور ذكي ببطاقة QR ديناميكية وقارئ USB/Bluetooth، قاعدة الغيابات والتعليق، ملف شامل لكل طالب، ولاحقاً الواجبات والتصحيح بمساعدة الذكاء الاصطناعي وخريطة المهارات.

الوثائق: [الهندسة](docs/ARCHITECTURE.md) · [قاعدة البيانات](docs/DATABASE_SCHEMA.md) · [الصلاحيات](docs/PERMISSIONS.md) · [خطة التنفيذ](docs/IMPLEMENTATION_PLAN.md) · [الأمان](docs/SECURITY.md)

## التشغيل محلياً (بلا خادم قاعدة بيانات)

```bash
cd platform
cp .env.example .env.local        # ثم غيّر SESSION_SECRET و QR_TOKEN_SECRET
npm install
npm run db:seed                   # يطبّق الـMigrations ويزرع بيانات تجريبية عربية على PGlite (./data)
npm run dev                       # http://localhost:3000
```

حسابات تجريبية (بعد `db:seed`):

| الدور | البريد | كلمة السر |
|---|---|---|
| مشرف عام | admin@madrasa.dz | Admin@12345 |
| أستاذ (حيقون أسامة — قالمة) | osama@madrasa.dz | Teacher@12345 |
| أستاذة ثانية (عزل المستأجرين) | nadia@madrasa.dz | Teacher@12345 |
| طالب (محمد أحمد) | mohamed@madrasa.dz | Student@12345 |

`npm run db:reset` يحذف قاعدة PGlite المحلية بالكامل.

## الإنتاج (PostgreSQL / Supabase / Neon)

```bash
DATABASE_URL=postgres://user:pass@host:5432/db npm run db:migrate
npm run build && npm start
```

ثم فعّل سياسات RLS اختيارياً: `psql "$DATABASE_URL" -f src/server/db/rls.sql`.

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript صارم |
| `npm run lint` | ESLint |
| `npm test` | اختبارات تكامل على PostgreSQL حقيقي في الذاكرة (PGlite) |
| `npm run db:generate` | توليد Migration من الـSchema |
| `npm run db:migrate` / `db:seed` / `db:reset` | قاعدة البيانات |

## المسار الكامل (Vertical Slice) — يعمل ومختبَر

المشرف ينشئ أستاذاً → الأستاذ ينشئ فوجاً → يولّد أكواداً (طباعة/CSV) → الطالب ينشئ حساباً ويدخل الكود → ينضم تلقائياً → الأستاذ يبدأ حصة → الطالب يفتح بطاقة الحضور (QR موقّع يتجدد كل 60 ث) → الأستاذ يمسح في وضع السكانر → يُسجَّل حاضراً/متأخراً فوراً مع صوت → إنهاء الحصة يحوّل الغائبين إلى "غياب غير مبرر" → 4 غيابات تعلّق التسجيل (بلا حذف) → تبرير الغياب وإعادة التفعيل يدوياً → كل شيء يظهر في ملف الطالب وخطه الزمني وسجل التدقيق.

## واجهة API (للجوال)

كل الخدمات مكشوفة تحت `/api/v1` بنفس الجلسة (كوكي أو `Authorization: Bearer <token>`):

- `POST /api/v1/auth/login` → token · `GET /api/v1/auth/me`
- `GET /api/v1/student/attendance-token?groupId=` → رمز QR موقّع
- `GET|POST /api/v1/teacher/sessions` · `POST /api/v1/teacher/sessions/:id/close` · `GET /api/v1/teacher/sessions/:id/attendance`
- `POST /api/v1/attendance/scan` `{ classSessionId, token }`
- `GET /api/v1/files/:id?exp=&sig=` → تنزيل ملف عبر رابط موقّع فقط

## الواجبات (المرحلة 4)

الأستاذ ينشئ واجباً ويسنده لأفواج أو طلاب محددين → الطالب **يكتب إجابته نصاً كرسالة** (مسودة تُحفظ تلقائياً، ثم إرسال نهائي) → الأستاذ يقرأ ويعلّق في سلسلة الرسائل ويعتمد التصحيح (نقطة، ما أحسن فيه، ما يحتاج تحسينه) → تصل الطالب علامة معتمدة ورسالة تصحيح، ويستطيع الردّ. لا تصوير ولا OCR؛ المرفقات مواد داعمة فقط.

## البنية

```
src/app         الصفحات (public / student / teacher / admin / api)
src/components  UI (shadcn-style) + مكوّنات المجال
src/server      auth · db (schema, migrations, seed) · services (قواعد العمل) · actions · queries
src/i18n        القاموس العربي (بنية جاهزة لإضافة fr/en)
tests           اختبارات التكامل
```
