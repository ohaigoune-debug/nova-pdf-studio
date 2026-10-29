# تحديث الخادم — لوحة الموظفين والتكبير المحمي (28 أكتوبر 2026، المساء)

ينفّذه المالك بنفسه كما في تحديث `994d609` المنشور. لم يُنفَّذ أي نشر من بيئة Claude.

## المحتوى

المصدر: `83c5006`. يشمل كل ما في `994d609` المنشور، ويضيف:

- **الدخول المباشر إلى اللوحة:** المشرف وموظف التأكيد والأستاذ والمساعد، إن فتحوا الصفحة الرئيسية
  وهم مسجّلون، يُنقلون مباشرة إلى لوحتهم بدل الصفحة التسويقية.
- **أوامر المشرف في مربعات بهوية مدرسة:** في أعلى لوحة المشرف مساحة زرقاء فيها المربعات التالية:
  - طابور التأكيد، مع عدد الطلبات الجديدة؛
  - طلبات الدورات، والتوصيل، والدورات؛
  - النشر، والتلاميذ، والموظفون، والإعدادات.

  وتحتها بقية الأوامر روابط صغيرة.
- **تكبير الفيديو مع بقاء العلامة المائية:**
  - زر «تكبير» خاص بالمنصة فوق المشغّل. يكبّر الفيديو والعلامة معًا: شاشة كاملة على الحاسوب وiPad،
    وملء الشاشة على iPhone (أدِر الهاتف أفقيًا).
  - زر الشاشة الكاملة الأصلي في يوتيوب أُخفي، لأن مشغّل iPhone يعرض الفيديو وحده دون العلامة.
  - في الفيديوهات المرفوعة إلى المنصة، يتحوّل زر الشاشة الكاملة إلى التكبير المحمي.

حدود التغيير:
- **لا ترحيل لقاعدة البيانات**، ولا تغيير على `package.json` أو `Dockerfile` أو `drizzle/` أو
  Android أو `.env`.
- التحقق: `tsc` نظيف، وeslint نظيف على الملفات المعدّلة، واختبارات الوسائط وأسماء الأحداث ناجحة.
  عُرضت المربعات وغطاء التكبير محليًا (iPhone 390px داكن، وحاسوب فاتح).

## الأوامر (بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-83c5006 83c5006
nohup docker build -t platform-app:ios-83c5006 --label org.opencontainers.image.revision=83c5006 /opt/madrasa/releases/ios-83c5006/platform > /opt/madrasa/releases/build-83c5006.log 2>&1 &
tail -f /opt/madrasa/releases/build-83c5006.log
```

انتظر حتى تظهر كلمة `done`، ثم اضغط Ctrl+C:

```bash
cp /opt/madrasa/releases/ios-994d609/ios-runtime.override.json /opt/madrasa/releases/ios-83c5006/
sed -i 's/platform-app:ios-994d609/platform-app:ios-83c5006/' /opt/madrasa/releases/ios-83c5006/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-83c5006/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-83c5006/ios-runtime.override.json up -d --no-deps --no-build --pull never app
docker ps --format '{{.Image}}  {{.Status}}' | grep platform-app
```

قبل أمر `compose up` يجب أن يُظهر `grep` كلمة `ios-83c5006`، و`AUTO_MIGRATE` بقيمة `0`.

## التجربة

1. افتح `madrasadz.com` وأنت مسجّل بحساب المشرف. يجب أن تنتقل مباشرة إلى لوحة المشرف، وفي أعلاها
   المربعات الزرقاء.
2. افتح فيديو يوتيوب بحساب تلميذ، واضغط زر التكبير في الزاوية العلوية. يجب أن يملأ الفيديو الشاشة،
   والعلامة المائية فوقه.

## الرجوع

أعد أمر `compose up` نفسه، لكن بملف `/opt/madrasa/releases/ios-994d609/ios-runtime.override.json`.

## سجل التحقق قبل النشر

- `next build` الإنتاجي على `83c5006` نجح (Compiled successfully).

## التنفيذ (28 أكتوبر 2026، 21:05، المالك)

- نشر المالك التحديث بنفسه، ثم دخل الموقع وأكّد: «يعمل بشكل ممتاز وكما أريده».
- لم يُرسَل ناتج `docker ps`، فالتأكيد هنا من تجربة المالك على الموقع، لا من طرفية الخادم.
