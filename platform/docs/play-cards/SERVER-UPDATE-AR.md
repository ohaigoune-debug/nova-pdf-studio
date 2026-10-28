# تحديث تجريبي للخادم: لعبة البطاقات (28 أكتوبر 2026، الليل)

ينفّذه المالك بنفسه كما في التحديثات السابقة. لم يُنشر أي شيء من بيئة Claude.

## المحتوى

- **المصدر:** `5587b28`، من الفرع `claude/play-card-game` (طلب الدمج المسودة رقم 29).
- **الفرق عن النسخة العاملة `f80c956`:** في كود الخادم، لعبة البطاقات وحدها.
- **حدود التغيير:**
  - لا ترحيل لقاعدة البيانات.
  - لا تغيير على `package.json` أو `Dockerfile` أو Android أو `.env`.
  - لا تغيير على الأسئلة ولا على التصحيح والنقاط والصلاحيات.
- **الرجوع داخل الموقع:** إضافة `?view=classic` إلى رابط أي جولة تعرض الواجهة القديمة.

## الأوامر (بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git claude/play-card-game
git worktree add --detach /opt/madrasa/releases/play-5587b28 5587b28
nohup docker build -t platform-app:play-5587b28 --label org.opencontainers.image.revision=5587b28 /opt/madrasa/releases/play-5587b28/platform > /opt/madrasa/releases/build-5587b28.log 2>&1 &
tail -f /opt/madrasa/releases/build-5587b28.log
```

انتظر حتى تظهر كلمة `done`، ثم اضغط Ctrl+C:

```bash
cp /opt/madrasa/releases/ios-f80c956/ios-runtime.override.json /opt/madrasa/releases/play-5587b28/
sed -i 's/platform-app:ios-f80c956/platform-app:play-5587b28/' /opt/madrasa/releases/play-5587b28/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/play-5587b28/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/play-5587b28/ios-runtime.override.json up -d --no-deps --no-build --pull never app
docker ps --format '{{.Image}}  {{.Status}}' | grep platform-app
```

قبل أمر `compose up` يجب أن يُظهر `grep` كلمة `play-5587b28`، و`AUTO_MIGRATE` بقيمة `0`.

## التجربة بعد التحديث

بحساب تلميذ، في Safari على iPhone، ثم داخل التطبيق، ثم على الحاسوب:

1. افتح لعبة الأسئلة، واختر مادة ودرسًا، ثم ابدأ تحديًا.
2. انقر البطاقة الزرقاء: يجب أن تنقلب مرة واحدة وتعرض السؤال.
3. أجب عن سؤال اختيار متعدد، ثم عن سؤال ملء فراغ: يظهر التصحيح، ثم «السؤال التالي».
4. أكمل الجولة: تظهر النتيجة، و«إعادة المحاولة» تبدأ جولة جديدة.
5. تأكد أن النقاط في لوحة اللعبة زادت كالمعتاد.

## الرجوع

أعد أمر `compose up` نفسه، لكن بملف `/opt/madrasa/releases/ios-f80c956/ios-runtime.override.json`.

## سجل التحقق قبل النشر

- **`next build` الإنتاجي على مصدر `5587b28`:** نجح («Compiled successfully»).
- **TypeScript وESLint:** نظيفان.
- **Vitest:** 720 اختبارًا على المستودع كله، ثم `play-cards` و`play` بعد آخر تعديل.
