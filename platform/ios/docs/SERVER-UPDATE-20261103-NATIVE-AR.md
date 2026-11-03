# تحديث الخادم — التطبيق الأصيل لآيفون (3 نوفمبر 2026)

ينفّذه المالك بنفسه كما في كل تحديث. لم يُنشر شيء من بيئة Claude.

## ما يضيفه للخادم

كل التغييرات واجهات برمجية جديدة أو توسيع لواجهات iOS الحالية. **لا ترحيل لقاعدة البيانات**، ولا تغيير على
`package.json` أو `Dockerfile` أو `.env` أو تطبيق أندرويد.

| المسار | ما يفعله |
|---|---|
| `POST /api/v1/auth/login` | يقبل رقم الهاتف كما يقبل البريد (مثل صفحة الدخول في الموقع). |
| `POST /api/v1/ios/account/delete` | حذف التلميذ حسابه من داخل التطبيق بكلمة السر (شرط Apple). |
| `POST /api/v1/ios/play/profile` و`GET /api/v1/ios/play/subjects` | اختيار السنة والشعبة في PLAY من التطبيق. |
| `GET /api/v1/ios/media/{contentId}/player` | رابط مشغّل Bunny الموقّع (ساعتان) مع سطور العلامة المائية. |
| `GET /api/v1/ios/materials/{contentId}/view` | عرض PDF داخل التطبيق دون حفظه. |
| `/api/v1/ios/materials/{contentId}/export` و`view` | كل نسخة PDF تخرج إلى التطبيق مختومة ببريد التلميذ ورمز حسابه والتاريخ. |
| `GET /api/v1/ios/courses/{slug}` و`POST …/terms` | نص شروط الدورة وقبولها داخل التطبيق. |
| `GET /api/v1/ios/lessons/{slug}` | يحمل مزوّد الفيديو (Bunny)، ورابط الدرس الخارجي إن كان https. |

التطبيق القديم (Build 9) يبقى يعمل مع هذا التحديث، فلا ضرر من نشر الخادم قبل تثبيت البناء الجديد.

## الأوامر (بعد الدمج في `work`، ومن `ssh root@80.241.219.166`)

```bash
cd /opt/madrasa && git pull --ff-only origin work && cd platform && docker compose -f docker-compose.prod.yml -f docker-compose.edge.yml up -d --build --scale caddy=0
```

## التحقق

```bash
cd /opt/madrasa/platform && git log --oneline -1
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/api/v1/ios/play/profile -X POST -H 'X-Madrasadz-Client: ios'
curl -s -o /dev/null -w "%{http_code}\n" https://madrasadz.com/api/v1/ios/media/00000000-0000-4000-8000-000000000000/player
```

النجاح يعني:
- السطر الأول يحمل آخر دمج في `work`.
- الأمر الثاني يرجع `401` (المسار موجود ويطلب تسجيل الدخول). إن رجع `404` فالتحديث لم يُنشر.
- الأمر الثالث يرجع `401` كذلك.
