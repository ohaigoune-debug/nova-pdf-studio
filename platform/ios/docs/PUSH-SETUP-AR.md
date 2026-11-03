# تشغيل إشعارات المنصة على الآيفون (Build 15)

الشيفرة جاهزة في الخادم والتطبيق، وتبقى **مطفأة** حتى تُنجز الخطوات الثلاث أدناه. لا شيء منها يدخل Git.

## 1) تفعيل الإشعارات لمعرّف التطبيق (مرة واحدة)

1. developer.apple.com ← Certificates, Identifiers & Profiles ← **Identifiers** ← `com.madrasadz.student`.
2. فعّل **Push Notifications** ← Save (لا حاجة لشهادة: نستعمل مفتاح .p8).
3. **Profiles** ← ملف App Store الخاص بـ `com.madrasadz.student` ← Edit ← Save ← Download.
4. حدّث سرّ GitHub `MADRASADZ_IOS_PROFILE_BASE64` بمحتوى الملف الجديد:
   `base64 -i Madrasadz_AppStore.mobileprovision | pbcopy` ثم الصق في Settings ← Secrets and variables ← Actions.

سكربت التوقيع يكتشف ذلك وحده: يكتب في السجل `Push notifications: on`. قبل تحديث الملف يكتب `off` ويُبنى التطبيق عاديًا.

## 2) مفتاح الإرسال (مرة واحدة)

1. **Keys** ← + ← اختر **Apple Push Notifications service (APNs)** ← Continue ← Register.
2. نزّل `AuthKey_XXXXXXXXXX.p8` (يُنزَّل مرة واحدة فقط — احفظه في مكان آمن خارج Git) وانسخ **Key ID**.

## 3) على الخادم (ملف ‎.env فقط)

```
ssh root@80.241.219.166
cd /opt/madrasa/platform
base64 -w0 /المسار/AuthKey_XXXXXXXXXX.p8      # انسخ الناتج (سطر واحد)
nano .env
```

أضف في آخره:

```
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=VN2768K4UH
APNS_PRIVATE_KEY=<الناتج>
```

ثم `bash scripts/deploy-edge.sh`، واحذف ملف ‎.p8 من الخادم بعد ذلك (`shred -u`).

## ما يصل إلى الآيفون

كل إشعار يظهر للتلميذ في الموقع (ردّ الدعم، حالة الطلب، واجب، تذكير حصة…) **إلا** ما فيه سعر أو دفع أو شراء
أو خصم (مرشّح في `ios-push.service.ts`)، وروابط لوحات الإدارة. الضغط على الإشعار يفتح المحادثة أو «طلباتي».
يُطلب إذن الإشعارات من التلميذ أول مرة يرسل فيها رسالة دعم (أو يكون قد سمح به لتذكيرات منظّمه).
