# تحديث الخادم — صفحة iPhone الأهدأ، والقسم الافتراضي، وصلاحيات موظف التأكيد (28 أكتوبر 2026)

هذا التحديث **للخادم فقط**، ولا يُنفّذ إلا بقرار المالك من جلسة SSH الخاصة به، بنفس
الطريقة التي نجحت في 26 أكتوبر (انظر SERVER-DEPLOYMENT-20261026.md). لم يُنفَّذ أي نشر
من بيئة الوكيل.

## المحتوى

يحل هذا الدليل محل `SERVER-UPDATE-BUILD7-AR.md`، فلا تنفّذ الاثنين.

- المصدر: `0e27f98` على فرع `codex/ios-app-foundation`.
- مقارنة بالمصدر المنشور حاليًا `65d1bb9`: التغيير محصور في `src/app`، و`src/components`،
  و`src/server`، و`src/lib`، و`src/i18n`، و`tests`.
- لا ترحيل لقاعدة البيانات، ولا تغيير على `package.json` أو القفل أو `Dockerfile` أو
  `next.config` أو `drizzle/` أو Android أو `.env`.
- صفحة `/ios`:
  - دون رأس مكرر، والشعار مرة واحدة، وزر دخول واحد.
  - عناوين السلاسل الطويلة مجمّعة تحت عنوان واحد.
  - بطاقة «هذا التطبيق مخصص للتلاميذ» مع زر خروج لحساب الأستاذ والإدارة.
  - صفحات الدورة والدرس أهدأ.
- **القسم الافتراضي** `/student/classroom` يظهر داخل التطبيق (قرار المالك لنسخة الاختبار).
- **موظف التأكيد** (قرار المالك 28 أكتوبر):
  - يرى ويدير كل الطلبات: الكتب، والدورات، والملفات، والتحويلات.
  - يغيّر الشعبة قبل الشحن.
  - يغيّر المبلغ قبل الشحن، بسبب إلزامي.
  - يؤكد، ويلغي بسبب.
  - «سُلّم وتفعيل»: يفعّل الدورة المرتبطة بالطلب.
  - يرسل كود التفعيل.
  - يحظر الزبون: يوقف حسابه ويلغي طلباته التي لم تُشحن. رفع الحظر للمشرف من صفحة
    المستخدمين.
  - كل عملية تظهر في سجل النشاط بصفحة الموظفين.
- **الاختبارات على Linux:**
  - `tsc` نظيف، وeslint نظيف.
  - اختبارات المتجر والطلبات والموظف والدورات والتوصيل: 19 ملفًا و217 اختبارًا ناجحة.
  - اختبارات iOS للخادم ناجحة.

## الأوامر (ينفّذها المالك على الخادم)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-0e27f98 0e27f98
docker build -t platform-app:ios-0e27f98 \
  --label org.opencontainers.image.revision=0e27f98 \
  /opt/madrasa/releases/ios-0e27f98/platform
cp /opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json /opt/madrasa/releases/ios-0e27f98/
sed -i 's/platform-app:ios-65d1bb9/platform-app:ios-0e27f98/' /opt/madrasa/releases/ios-0e27f98/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-0e27f98/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml \
  -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-0e27f98/ios-runtime.override.json \
  up -d --no-deps --no-build --pull never app
```

قبل الأمر الأخير يجب أن يُظهر `grep` الصورة `platform-app:ios-0e27f98` و`AUTO_MIGRATE` بقيمة `0`.
لا تشغّل `deploy-vps.sh` ولا `compose up` كاملًا ولا bootstrap.

## التحقق

- `https://madrasadz.com/ios` يرد 200، ويظهر في التطبيق بالشكل الجديد.
- `/api/v1/ios/session` دون دخول يرد 401.
- بحساب أستاذ في التطبيق: تظهر بطاقة «هذا التطبيق مخصص للتلاميذ»، وزر الخروج يعيد إلى صفحة الدخول.
- بحساب الموظف: `/admin/store` يعرض كل الطلبات. في كل طلب يظهر «تعديل الطلب» (الشعبة،
  والمبلغ، والحظر). وتظهر «سُلّم وتفعيل» للطلبات المؤكدة.
- بحساب المشرف: صفحة الموظفين تعرض التعديلات في سجل النشاط.

## الرجوع

أعد أمر `compose up` نفسه، لكن مع ملف `/opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json`
بدل الملف الجديد. لا رجوع لقاعدة البيانات، فلا يوجد تغيير في المخطط.
