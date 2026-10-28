# تحديث الخادم — المرحلة 1 من التطبيق المتكامل (28 أكتوبر 2026)

ينفّذه المالك بنفسه من جلسة SSH الخاصة به، بالطريقة نفسها التي نجحت في 26 أكتوبر. لم يُنفَّذ أي
نشر من بيئة Claude.

## المحتوى

- المصدر: `662680b` على فرع `codex/ios-app-foundation`. يشمل كل ما في `0e27f98` (صفحة iPhone
  الأهدأ، والقسم الافتراضي، وصلاحيات موظف التأكيد) ويضيف:
  - **أقسام الدورة**: الحصص بالأرقام (حصة 1، 2، 3…)، والفيديوهات، والفروض، والاختبارات،
    والملفات. تظهر في صفحة الدورة على الموقع وفي التطبيق.
  - **تلميح التسمية** في نموذج إنشاء المحتوى عند الأستاذ.
  - **واجهة بيانات iOS v1** للقراءة فقط: `/api/v1/ios/capabilities`، و`home`،
    و`courses/{slug}`، و`lessons/{slug}`. تستعملها الشاشات الأصلية القادمة، بنفس الصلاحيات
    الحالية حرفيًا.
- مقارنة بالمنشور حاليًا `65d1bb9`: التغيير محصور في `src/app`، و`src/components`،
  و`src/server`، و`src/lib`، و`src/i18n`، و`tests`.
- **لا ترحيل لقاعدة البيانات**، ولا تغيير على `package.json` أو القفل أو `Dockerfile` أو
  `next.config` أو `drizzle/` أو Android أو `.env`.
- **التحقق على Linux:**
  - `tsc` نظيف، وeslint نظيف على الملفات المعدلة.
  - 25 ملف اختبار و302 اختبار ناجحة: المتجر، والطلبات، والموظف، والدورات، والتوصيل، وأقسام
    الدورة، وواجهة iOS، وصفحات iOS.
  - `next build` الإنتاجي (standalone كما في Dockerfile) ناجح.

## إن كنت قد نشرت `0e27f98` بالفعل

الأوامر نفسها أدناه تكفي، فهذا المصدر يتضمنه. للرجوع خطوة واحدة استعمل ملف override الموجود
في `ios-0e27f98` بدل `ios-65d1bb9`.

## الأوامر (سطرًا سطرًا، بعد `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa
git fetch https://github.com/ohaigoune-debug/nova-pdf-studio.git codex/ios-app-foundation
git worktree add --detach /opt/madrasa/releases/ios-662680b 662680b
nohup docker build -t platform-app:ios-662680b --label org.opencontainers.image.revision=662680b /opt/madrasa/releases/ios-662680b/platform > /opt/madrasa/releases/build-662680b.log 2>&1 &
tail -f /opt/madrasa/releases/build-662680b.log
```

انتظر `naming to docker.io/library/platform-app:ios-662680b` ثم `done`، ثم Ctrl+C.

```bash
cp /opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json /opt/madrasa/releases/ios-662680b/
sed -i 's/platform-app:ios-65d1bb9/platform-app:ios-662680b/' /opt/madrasa/releases/ios-662680b/ios-runtime.override.json
grep -n 'platform-app\|AUTO_MIGRATE' /opt/madrasa/releases/ios-662680b/ios-runtime.override.json
cd /opt/madrasa/platform
docker compose -p platform -f docker-compose.prod.yml -f docker-compose.override.yml -f docker-compose.edge.yml -f /opt/madrasa/releases/ios-662680b/ios-runtime.override.json up -d --no-deps --no-build --pull never app
```

قبل الأمر الأخير يجب أن يُظهر `grep` `ios-662680b` و`AUTO_MIGRATE` بقيمة `0`. لا تشغّل
`deploy-vps.sh` ولا `compose up` كاملًا ولا bootstrap.

## التحقق

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/ios
curl -s https://madrasadz.com/api/v1/ios/capabilities
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/api/v1/ios/home
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/api/v1/ios/courses/test
```

النتائج المتوقعة بالترتيب:

| الأمر | النتيجة |
|---|---|
| `/ios` | `200` |
| `capabilities` | `{"ok":true,"data":{"apiVersion":1,...}}` |
| `home` (زائر) | `200` |
| `courses` دون دخول | `401` |

## الرجوع

أعد أمر `compose up` نفسه بملف `/opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json`، أو
`ios-0e27f98` إن كان منشورًا قبل هذا. لا رجوع لقاعدة البيانات، فلا تغيير في المخطط.
