# تحديث الخادم — بيانات صفحة الدرس في تطبيق iPhone (28 أكتوبر 2026، الليل)

ينفّذه المالك بنفسه كما في التحديثات السابقة. لم يُنفَّذ أي نشر من بيئة Claude.

## المحتوى

المصدر: `f80c956`. يشمل كل ما في `83c5006` المنشور، ويضيف تعديلًا واحدًا على واجهة iOS
(`/api/v1/ios/lessons/{slug}`):

- **فيديو يوتيوب والفيديو الخاص:** صار الرد يحمل معرّف المحتوى. يستعمله مشغّل التطبيق في نبضات المشاهدة
  نفسها التي يرسلها الموقع، فيعمل حد الجهاز الواحد وسجل المشاهدات في التطبيق أيضًا.
- **التلميذ المسجّل:** صار الرد يحمل `viewer` (اسمه، ورمز حسابه من 8 خانات) للعلامة المائية المتحركة في
  التطبيق. لا يحمل بريدًا ولا هاتفًا.

حدود التغيير:
- التغيير محصور في `src/server/services/ios-api.service.ts` واختباره، وتوثيق الواجهة.
- **لا ترحيل لقاعدة البيانات**، ولا تغيير على `package.json` أو `Dockerfile` أو Android أو `.env`.
- يعمل البناء 9 قبل هذا التحديث أيضًا، لكن دون حد الجهاز الواحد في مشغّله، وبرمز الحساب وحده في
  العلامة.

التحقق: اختبارات `ios-api` (11) ناجحة، و`tsc` نظيف.

## الأوامر (بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-f80c956 f80c956
nohup docker build -t platform-app:ios-f80c956 --label org.opencontainers.image.revision=f80c956 /opt/madrasa/releases/ios-f80c956/platform > /opt/madrasa/releases/build-f80c956.log 2>&1 &
tail -f /opt/madrasa/releases/build-f80c956.log
```

انتظر حتى تظهر كلمة `done`، ثم اضغط Ctrl+C:

```bash
cp /opt/madrasa/releases/ios-83c5006/ios-runtime.override.json /opt/madrasa/releases/ios-f80c956/
sed -i 's/platform-app:ios-83c5006/platform-app:ios-f80c956/' /opt/madrasa/releases/ios-f80c956/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-f80c956/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-f80c956/ios-runtime.override.json up -d --no-deps --no-build --pull never app
docker ps --format '{{.Image}}  {{.Status}}' | grep platform-app
```

قبل أمر `compose up` يجب أن يُظهر `grep` كلمة `ios-f80c956`، و`AUTO_MIGRATE` بقيمة `0`.

## الرجوع

أعد أمر `compose up` نفسه، لكن بملف `/opt/madrasa/releases/ios-83c5006/ios-runtime.override.json`.

## سجل التحقق قبل النشر

- `next build` الإنتاجي على مصدر `f80c956` نجح (Compiled successfully).

## التنفيذ (28 أكتوبر 2026، 21:37، المالك)

- أظهر `grep` الصورة `platform-app:ios-f80c956`، و`AUTO_MIGRATE` بقيمة `0`.
- `compose up`: `Container platform-app-1 Started`.
- `docker ps`: `platform-app:ios-f80c956  Up Less than a second (health: starting)`. لم تُرسَل بعدُ
  حالة `healthy`.
