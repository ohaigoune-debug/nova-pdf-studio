# الدخول والتسجيل بـ Google وApple (iCloud)

قرار المالك (5 نوفمبر 2026): زرّا «المتابعة بحساب Google» و«المتابعة بحساب Apple» في الموقع وتطبيق أندرويد وتطبيق الآيفون.
بعد أول دخول يكمل التلميذ: الهاتف (ثم رمز تأكيد كالتسجيل العادي)، وهاتف الولي، والمستوى، والشعبة، والولاية.

**لا يظهر أي زر قبل أن تضع المفاتيح على الخادم.** كل زر مستقل: يمكن تفعيل Google وحده أولًا.

## كيف يعمل

| الحالة | ما يحدث |
|---|---|
| هوية Google/Apple مربوطة بحساب | دخول مباشر |
| بريد مؤكَّد لتلميذ مسجّل سابقًا (مثلًا سجّل بـ Gmail وكلمة سر) | يُربط بحسابه نفسه ويدخل، وتبقى كلمة سرّه صالحة |
| حساب جديد | صفحة «خطوة أخيرة» ثم تأكيد الهاتف برمز |
| حساب أستاذ أو مشرف أو موظف | مرفوض: كلمة السر وحدها |

- حساب أُنشئ بـ Google أو Apple لا كلمة سر له. يضعها التلميذ متى شاء من «نسيت كلمة السر» أو استعادة الهاتف.
- حذف هذا الحساب يكون بكتابة كلمة «حذف» بدل كلمة السر، ويُلغى معه إذن Apple (شرط Apple).
- تطبيق أندرويد (TWA) يستعمل مسار الموقع نفسه، فلا يحتاج بناءً جديدًا. على الهواتف القديمة جدًا (WebView) يُخفى زر Google وحده لأن Google يرفضه هناك.

## 1. Google (نحو 10 دقائق)

1. ادخل [Google Cloud Console](https://console.cloud.google.com/) واختر مشروعك (يصلح مشروع مفتاح يوتيوب نفسه).
2. **Google Auth Platform ← Branding**: اسم التطبيق «مدرسة»، بريد الدعم، والنطاق المعتمد `madrasadz.com`، ورابط الخصوصية `https://madrasadz.com/privacy`.
3. **Audience**: نوع External، ثم **Publish app** (حالة In production). الصلاحيات المطلوبة `openid email profile` فقط، فلا تحتاج مراجعة Google.
4. **Clients ← Create client** من نوع **Web application**:
   - Authorized JavaScript origins: `https://madrasadz.com`
   - Authorized redirect URIs: `https://madrasadz.com/api/auth/oauth/google/callback`
5. انسخ **Client ID** و**Client secret**.

تطبيق الآيفون يستعمل هذا العميل نفسه (عبر نافذة النظام)، فلا تُنشئ عميل iOS.

## 2. Apple (نحو 15 دقيقة)

في [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/):

1. **Identifiers ←** `com.madrasadz.student` ← فعّل **Sign in with Apple** (Enable as a primary App ID) ← Save.
2. **Keys ← +**: اسم «Madrasa Sign in with Apple»، فعّل **Sign in with Apple** ← Configure ← Primary App ID `com.madrasadz.student` ← Register.
   نزّل ملف `AuthKey_XXXXXXXXXX.p8` (يُنزَّل **مرة واحدة فقط**) واحفظ **Key ID**.
3. **للموقع وأندرويد — Identifiers ← + ← Services IDs**: المعرّف `com.madrasadz.web`، الوصف «مدرسة — الموقع».
   فعّل Sign in with Apple ← Configure: Primary App ID `com.madrasadz.student`، Domains `madrasadz.com`،
   Return URLs `https://madrasadz.com/api/auth/oauth/apple/callback` ← Save.
   دون هذه الخطوة يبقى Apple في الآيفون وحده.
4. **البريد المخفي (اختياري لكن مستحسن)**: من يختار «إخفاء بريدي» يعطي Apple بريدًا وسيطًا. لتصله رسائل «نسيت كلمة السر»:
   Services ← **Sign in with Apple for Email Communication** ← أضف النطاق `madrasadz.com` وعنوان المرسل نفسه الذي في `MAIL_FROM`.
5. **Profiles**: بعد تفعيل الخدمة على App ID يجب **إعادة توليد** ملف App Store لـ `com.madrasadz.student`،
   ثم تحديث السرّ `MADRASADZ_IOS_PROFILE_BASE64` في GitHub. سكربت البناء يقرأ الملف: إن كان فيه
   Sign in with Apple أضافه إلى التطبيق، وإلا بنى التطبيق دونه (ويكتب ذلك في السجل).

## 3. الخادم

```bash
cd /opt/madrasa/platform
nano .env
```

أضف (القيم من الخطوتين السابقتين):

```dotenv
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxx
APPLE_TEAM_ID=VN2768K4UH
APPLE_SIGNIN_KEY_ID=XXXXXXXXXX
APPLE_BUNDLE_ID=com.madrasadz.student
APPLE_SERVICES_ID=com.madrasadz.web
```

ثم المفتاح سطرًا واحدًا (ارفع الملف إلى الخادم أولًا، مثلًا إلى `/root/`):

```bash
echo "APPLE_SIGNIN_PRIVATE_KEY=$(base64 -w0 /root/AuthKey_XXXXXXXXXX.p8)" >> .env
```

ثم النشر المعتاد. الترحيل `0045_oauth_sign_in` (جدولان جديدان فقط) يُطبَّق وحده.

## 4. التجربة

1. افتح `https://madrasadz.com/login` في متصفح خاص: يجب أن يظهر الزران.
2. «المتابعة بحساب Google» بحساب Gmail لا حساب له في مدرسة ← صفحة «خطوة أخيرة» ← بعد الإرسال رمز تأكيد الهاتف.
3. سجّل خروجك، ثم Google مرة ثانية ← دخول مباشر.
4. في الآيفون (بناء جديد بعد إعادة توليد الملف): زر Apple الأسود فوق نموذج الدخول.

## المتغيرات

| المتغير | إلزامي لـ | ملاحظة |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google | عميل Web |
| `APPLE_TEAM_ID` | Apple | يُستعمل `APNS_TEAM_ID` إن تُرك فارغًا |
| `APPLE_SIGNIN_KEY_ID` / `APPLE_SIGNIN_PRIVATE_KEY` | Apple | مفتاح .p8؛ يلزم لإلغاء الإذن عند حذف الحساب |
| `APPLE_BUNDLE_ID` | Apple في الآيفون | الافتراضي `com.madrasadz.student` |
| `APPLE_SERVICES_ID` | Apple في الموقع وأندرويد | بدونه يبقى Apple في الآيفون وحده |
