# تحديث تجريبي للخادم: لعبة الأسئلة بالهوية البصرية المعتمدة (29 أكتوبر 2026)

ينفّذه المالك بنفسه كما في التحديثات السابقة. لم يُنشر أي شيء من بيئة Claude.

## المحتوى

- **المصدر:** `b9c3019`، من الفرع `claude/play-card-game` (طلب الدمج المسودة رقم 29).
  - يحلّ محل التحديث التجريبي السابق `5587b28` إن كان قد نُشر.
- **الفرق عن النسخة العاملة `f80c956`:** في كود الخادم، لعبة الأسئلة وحدها:
  - الشاشة الأولى `/student/play`.
  - الجولة بالبطاقات.
  - شاشة النتيجة، كما في حزمة `Madrasa_PLAY_Visual_Identity`.
- **حدود التغيير:**
  - لا ترحيل لقاعدة البيانات.
  - لا تغيير على `package.json` أو `Dockerfile` أو Android أو `.env`.
  - لا تغيير على الأسئلة ولا على التصحيح والنقاط والصلاحيات.
- **الرجوع داخل الموقع:** إضافة `?view=classic` إلى رابط أي جولة تعرض الواجهة القديمة.

## الأوامر (بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git claude/play-card-game
git worktree add --detach /opt/madrasa/releases/play-b9c3019 b9c3019
nohup docker build -t platform-app:play-b9c3019 --label org.opencontainers.image.revision=b9c3019 /opt/madrasa/releases/play-b9c3019/platform > /opt/madrasa/releases/build-b9c3019.log 2>&1 &
tail -f /opt/madrasa/releases/build-b9c3019.log
```

انتظر حتى تظهر كلمة `done`، ثم اضغط Ctrl+C:

```bash
cp /opt/madrasa/releases/ios-f80c956/ios-runtime.override.json /opt/madrasa/releases/play-b9c3019/
sed -i 's/platform-app:ios-f80c956/platform-app:play-b9c3019/' /opt/madrasa/releases/play-b9c3019/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/play-b9c3019/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/play-b9c3019/ios-runtime.override.json up -d --no-deps --no-build --pull never app
docker ps --format '{{.Image}}  {{.Status}}' | grep platform-app
```

قبل أمر `compose up` يجب أن يُظهر `grep` كلمة `play-b9c3019`، و`AUTO_MIGRATE` بقيمة `0`.

## التجربة بعد التحديث

بحساب تلميذ، في Safari على iPhone، ثم داخل التطبيق، ثم على الحاسوب:

1. افتح «لعبة الأسئلة»: يجب أن تظهر السنة والمادة والدرس وزر «ابدأ اللعب».
2. ابدأ: تظهر البطاقة الزرقاء، وتختفي ترويسة الموقع على الهاتف.
3. انقر البطاقة: يجب أن تدور مرة واحدة وتتسع لتعرض السؤال.
4. المس خيارًا: تُرسل الإجابة فورًا وتظهر «إجابة صحيحة» أو «إجابة خاطئة»، ثم «السؤال التالي».
5. في سؤال ملء الفراغ: ضع الكلمات، ثم «تحقّق من الإجابة».
6. أكمل الجولة: تظهر الكأس والنتيجة، و«تابع اللعب» يبدأ جولة جديدة.
7. تأكد أن النقاط زادت كالمعتاد، وأن الموقع في الوضع الداكن لا يغيّر ألوان اللعبة.

## الرجوع

أعد أمر `compose up` نفسه، لكن بملف `/opt/madrasa/releases/ios-f80c956/ios-runtime.override.json`.

## سجل التحقق قبل النشر

- **`next build` الإنتاجي على مصدر `b9c3019`:** نجح («Compiled successfully»).
- **TypeScript وESLint:** نظيفان.
- **Vitest:** 106 ملفات و724 اختبارًا.
