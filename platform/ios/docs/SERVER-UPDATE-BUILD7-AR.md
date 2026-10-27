# تحديث خادم iOS — صفحة البداية الأهدأ والقسم الافتراضي (27 أكتوبر 2026)

هذا التحديث **للخادم فقط**، ولا يُنفّذ إلا بقرار المالك من جلسة SSH الخاصة به، بنفس
الطريقة التي نجحت في 26 أكتوبر (انظر SERVER-DEPLOYMENT-20261026.md). لم يُنفَّذ أي نشر
من بيئة الوكيل.

## المحتوى

- المصدر: `deb03f6` على فرع `codex/ios-app-foundation`.
- مقارنة بالمصدر المنشور حاليًا `65d1bb9`: لا تغيّر خارج `src/app/ios/*` و
  `src/lib/ios-presentation.ts` واختباراتهما. لا ترحيل قاعدة بيانات، ولا تغيير على
  `package.json` أو القفل أو `Dockerfile` أو `next.config` أو Android أو `.env`.
- التغييرات: صفحة `/ios` دون رأس مكرر (الشعار مرة واحدة وزر دخول واحد)، وتجميع
  عناوين السلاسل الطويلة تحت عنوان واحد، وبطاقة «هذا التطبيق مخصص للتلاميذ» مع زر خروج
  لحساب الأستاذ والإدارة، وصفحات الدورة والدرس أهدأ، والسماح بعرض القسم الافتراضي
  `/student/classroom` داخل التطبيق (قرار المالك لنسخة الاختبار الداخلي).
- الاختبارات على Linux: `tsc` نظيف، وeslint نظيف، و4 مجموعات اختبار iOS للخادم (30 اختبارًا) ناجحة.

## الأوامر (ينفّذها المالك على الخادم)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-deb03f6 deb03f6
docker build -t platform-app:ios-deb03f6 \
  --label org.opencontainers.image.revision=deb03f6 \
  /opt/madrasa/releases/ios-deb03f6/platform
cp /opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json /opt/madrasa/releases/ios-deb03f6/
sed -i 's/platform-app:ios-65d1bb9/platform-app:ios-deb03f6/' /opt/madrasa/releases/ios-deb03f6/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-deb03f6/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml \
  -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-deb03f6/ios-runtime.override.json \
  up -d --no-deps --no-build --pull never app
```

قبل الأمر الأخير يجب أن يُظهر `grep` الصورة `platform-app:ios-deb03f6` و`AUTO_MIGRATE` بقيمة `0`.
لا تشغّل `deploy-vps.sh` ولا `compose up` كاملًا ولا bootstrap.

## التحقق

- `https://madrasadz.com/ios` يرد 200، ويظهر في التطبيق بالشكل الجديد.
- `/api/v1/ios/session` دون دخول يرد 401.
- بحساب أستاذ: تظهر بطاقة «هذا التطبيق مخصص للتلاميذ» وزر الخروج يعيد إلى صفحة الدخول.

## الرجوع

أعد أمر `compose up` نفسه، لكن مع ملف `/opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json`
بدل الملف الجديد. لا رجوع لقاعدة البيانات، فلا يوجد تغيير في المخطط.
