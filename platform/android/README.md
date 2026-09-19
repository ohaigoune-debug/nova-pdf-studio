# تطبيق أندرويد لمنصة "مدرسة"

غلاف **Trusted Web Activity**: التطبيق يفتح المنصة نفسها ملء الشاشة، بلا شريط عنوان وبلا نسخة ثانية من الكود. كل تحديث تنشره على الخادم يصل المستخدمين فوراً بلا تحديث من المتجر.

| | |
|---|---|
| المعرّف | `dz.madrasa.app` |
| أقل إصدار | أندرويد 5.0 (API 21) |
| الحجم التقريبي | أقل من 1 ميغابايت |
| الإشعارات | Web Push الموجود في المنصة يظهر كإشعار أندرويد |
| بلا اتصال | نفس صفحة `/offline` والمسودات المحفوظة على الجهاز |

## النطاقان

التطبيق يثق باثنين معاً — هذا مقصود:

| | |
|---|---|
| `madrasadz.com` | يُطلق عليه التطبيق. متاح فوراً |
| `madrasa.dz` | النطاق الوطني، يحتاج ملفاً لدى NIC.dz |

فائدة ذلك: حين يجهز `.dz` تُحوّل `.com` إليه، ويبقى التطبيق ملء الشاشة **بلا إصدار APK جديد**. بلا هذا الترتيب كان الانتقال يعني ظهور شريط المتصفح لكل من لم يُحدّث.

الشرط: **كلا النطاقين يخدم `/.well-known/assetlinks.json` بنفس بصمة التوقيع.**

كل النطاقات في ملف واحد: `app/src/main/res/values/strings.xml`.

## الخطوات (مرة واحدة)

### 1. انشر المنصة على نطاق HTTPS
التطبيق مجرّد غلاف؛ لا يعمل قبل أن يكون الموقع منشوراً.

### 2. أنشئ مفتاح التوقيع واحتفظ به
فقدان هذا الملف يعني أنك **لن تستطيع تحديث التطبيق على Play أبداً**. انسخه في مكان آمن.

```sh
keytool -genkeypair -v -keystore madrasa.keystore \
  -alias madrasa -keyalg RSA -keysize 2048 -validity 10000
```

### 3. ابنِ التطبيق

**عبر GitHub** (بلا تثبيت شيء): ارفع المفتاح كأسرار في المستودع
(`Settings → Secrets → Actions`):

| السرّ | القيمة |
|------|--------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 madrasa.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة سر المفتاح |
| `ANDROID_KEY_ALIAS` | `madrasa` |
| `ANDROID_KEY_PASSWORD` | كلمة سر الاسم المستعار |

ثم `Actions → بناء تطبيق أندرويد → Run workflow`. ينزل الـ APK والـ AAB كملفات، وتظهر بصمة SHA-256 في ملخّص التشغيل.

**محلياً** (يتطلب Android SDK):

```sh
cd platform/android
./gradlew assembleRelease   # APK للتجربة المباشرة
./gradlew bundleRelease     # AAB لرفعه على Play
```

### 4. اربط النطاق بالتطبيق — الخطوة الحاسمة
بلا هذه الخطوة يظهر **شريط عنوان المتصفح داخل التطبيق**. خذ بصمة SHA-256:

```sh
keytool -list -v -keystore madrasa.keystore -alias madrasa | grep SHA256
```

وضعها في متغيّرات بيئة الخادم:

```
ANDROID_PACKAGE_NAME=dz.madrasa.app
ANDROID_CERT_FINGERPRINTS=AA:BB:CC:…
```

تحقّق بفتح `https://<نطاقك>/.well-known/assetlinks.json` — يجب أن يعيد JSON لا 404.

> **بعد أول رفع إلى Play:** يعيد Google توقيع التطبيق بمفتاحه (Play App Signing). خذ البصمة الجديدة من
> `Play Console → Setup → App integrity` وأضفها إلى نفس المتغيّر مفصولة بفاصلة عن بصمتك:
> `ANDROID_CERT_FINGERPRINTS=بصمتك,بصمة-Play`. بلا هذا سيعمل التطبيق عندك ويفشل عند المستخدمين.

### 5. ارفع على Play Store
- رسوم التسجيل: **25 دولاراً مرة واحدة**
- ارفع ملف `.aab`
- أيقونة المتجر جاهزة: `platform/public/icon-play-512.png`

## تغيير الإصدار

```sh
./gradlew bundleRelease -PmadrasaVersionName=1.1.0 -PmadrasaVersionCode=2
```

`madrasaVersionCode` يجب أن يزيد مع كل رفع إلى Play، وإلا يُرفض الملف.

## الانتقال من .com إلى .dz لاحقاً

لا تحتاج إصداراً جديداً. يكفي أن:

1. يخدم `madrasa.dz` نفس المنصة ونفس `/.well-known/assetlinks.json`
2. تُحوّل `madrasadz.com` إليه (301)

التطبيق يُطلق على `.com`، يتبع التحويل إلى `.dz`، ويبقى ملء الشاشة لأن الاثنين في `additional_trusted_origins`.

أما لو أردت تبديل نطاق الإطلاق نفسه فعدّل `strings.xml` وارفع إصداراً جديداً.
