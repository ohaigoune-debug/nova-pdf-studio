# تحديث الخادم — حماية الفيديو: جهاز واحد ويوتيوب محمي (28 أكتوبر 2026)

ينفّذه المالك بنفسه من جلسة SSH الخاصة به، بالطريقة نفسها التي نجحت في نشر `662680b`. لم يُنفَّذ
أي نشر من بيئة Claude.

## المحتوى

المصدر: `994d609` على فرع `codex/ios-app-foundation`. يشمل كل ما في `662680b` المنشور حاليًا،
ويضيف:

- **جهاز واحد فقط يشاهد في كل الأحوال** (قرار المالك). الحد ثابت في الكود، ولا يغيّره أي إعداد
  على الخادم.
  - الجهاز يُعرف بمفتاح ثابت في المتصفح أو التطبيق، لا بعنوان الشبكة.
  - تغيّر شبكة الجهاز نفسه (وايفاي ← 4G) لا يحجبه، وجهاز ثانٍ على الشبكة نفسها يُحجب.
  - بعد إغلاق المشاهدة على الجهاز الأول، يعمل الجهاز الآخر خلال دقيقتين.
- **فيديوهات يوتيوب للمسجّلين:** علامة مائية متحركة، وحد الجهاز الواحد، وسجل المشاهدة. وعند الحجب
  يُزال المشغّل فيتوقف التشغيل. الزائر يرى الدروس العامة كما كانت.
- **تقرير الأستاذ:** «اشتباه مشاركة» عند أكثر من عنوانَي شبكة مختلفين خلال 24 ساعة.
- **أسماء عربية** لثلاثة أحداث في سجل النشاط: تغيير الشعبة، وتعديل المبلغ، وإيقاف حساب زبون.
- **عناوين الحصص:** «شرح الحصة 1» يبقى كاملًا ولا يُختصر إلى «شرح».

حدود التغيير:
- التغيير مقارنة بـ`662680b`: `src/components`، و`src/server`، و`src/app/teacher`، و`src/i18n`،
  و`tests`، ونص التعليق في `.env.example`.
- **لا ترحيل لقاعدة البيانات**، ولا تغيير على `package.json` أو القفل أو `Dockerfile` أو
  `next.config` أو `drizzle/` أو Android أو `.env`.
- إن كان في `.env` على الخادم سطر `MEDIA_MAX_DEVICES=2`، فلم يعد يُقرأ، ولا حاجة لتعديله.

التحقق على Linux:
- `tsc` نظيف، وeslint نظيف على الملفات المعدّلة.
- الاختبارات: 105 ملفات و704 اختبارات. الاختبار الوحيد الذي فشل في التشغيل الكامل (أسماء الأحداث)
  صُحّح في `994d609`، ونجح بعدها مع اختبارات الوسائط.
- `next build` الإنتاجي: انظر سجل التنفيذ في آخر هذا الملف.

## الأوامر (سطرًا سطرًا، بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-994d609 994d609
nohup docker build -t platform-app:ios-994d609 --label org.opencontainers.image.revision=994d609 /opt/madrasa/releases/ios-994d609/platform > /opt/madrasa/releases/build-994d609.log 2>&1 &
tail -f /opt/madrasa/releases/build-994d609.log
```

انتظر حتى يظهر `naming to docker.io/library/platform-app:ios-994d609` ثم `done`، ثم اضغط Ctrl+C. إن
انقطع SSH فالبناء يستمر في الخلفية. افتح جلسة جديدة وأعد أمر `tail -f` نفسه.

```bash
cp /opt/madrasa/releases/ios-662680b/ios-runtime.override.json /opt/madrasa/releases/ios-994d609/
sed -i 's/platform-app:ios-662680b/platform-app:ios-994d609/' /opt/madrasa/releases/ios-994d609/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-994d609/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-994d609/ios-runtime.override.json up -d --no-deps --no-build --pull never app
```

قبل الأمر الأخير يجب أن يُظهر `grep` كلمة `ios-994d609`، و`AUTO_MIGRATE` بقيمة `0`. لا تشغّل
`deploy-vps.sh`، ولا `compose up` كاملًا، ولا bootstrap.

## التحقق

```bash
docker ps --format '{{.Image}}  {{.Status}}' | grep platform-app
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/ios
curl -s https://madrasadz.com/api/v1/ios/capabilities
```

| الأمر | النتيجة المتوقعة |
|---|---|
| `docker ps` | `platform-app:ios-994d609  Up … (healthy)` |
| `/ios` | `200` |
| `capabilities` | `{"ok":true,"data":{"apiVersion":1,...}}` |

ثم جرّب بنفسك:

1. افتح درس فيديو بحساب تلميذ على الهاتف. يجب أن تظهر العلامة المائية متحركة، في يوتيوب وفي
   Bunny معًا.
2. افتح الدرس نفسه بالحساب نفسه على جهاز ثانٍ. يجب أن تظهر رسالة «حسابك يشاهد الآن من جهاز آخر…»
   ويتوقف الفيديو.
3. أغلق الدرس في الجهاز الأول، وانتظر دقيقتين، ثم أعد المحاولة في الثاني. يجب أن يعمل.

## الرجوع

أعد أمر `compose up` نفسه، لكن بملف `/opt/madrasa/releases/ios-662680b/ios-runtime.override.json`.
لا رجوع لقاعدة البيانات، لأن المخطط لم يتغيّر.

## سجل التحقق قبل النشر

- 28 أكتوبر 2026: `next build` الإنتاجي على `994d609` نجح (Compiled successfully). المصدر
  نفسه الذي في الأوامر أعلاه.
