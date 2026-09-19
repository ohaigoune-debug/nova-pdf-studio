# 🎉 Comment Winner - أداة سحب الفائزين

أداة **خفيفة وآمنة** لسحب الفائزين تلقائياً من تعليقات **Facebook** و **Instagram**.

> ✅ محلية 100% • لا توجد عمليات سحب وهمية • Meta Graph API الرسمية • بدون إشتراكات

---

## 📋 المحتويات

- [المميزات](#المميزات)
- [المتطلبات](#المتطلبات)
- [التثبيت](#التثبيت)
- [إعداد Meta API](#إعداد-meta-api)
- [التشغيل](#التشغيل)
- [الاستخدام](#الاستخدام)
- [الفلاتر والشروط](#الفلاتر-والشروط)
- [التصدير](#التصدير)
- [الأمان](#الأمان)
- [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## المميزات

✨ **الأساسيات**
- سحب التعليقات من Facebook و Instagram مباشرة
- عرض إحصائيات التعليقات الفورية
- سحب عشوائي آمن باستخدام `crypto.getRandomValues`
- منع الفوز المكرر (لا يفوز نفس الشخص مرتين)

🔧 **الفلاتر والشروط**
- حد أدنى للمنشنات (@mentions)
- كلمة إجبارية في التعليق
- حذف التعليقات المكررة
- تجاهل Replies (احسب Top Level فقط)
- بحث سريع في التعليقات
- تجاهل التعليقات الفارغة

📊 **التصدير والحفظ**
- تصدير CSV
- تصدير Excel (.xlsx)
- معلومات كاملة: اسم، username، التعليق، المنصة، الرابط

🌍 **واجهة احترافية**
- العربية (RTL) 100%
- Dark Mode متطور
- ألوان: أسود/كحلي + أخضر + ذهبي
- Mobile First (يعمل على الهاتف بكفاءة)

🔐 **الأمان**
- Access Token يُحفظ محليًا فقط (localStorage)
- لا يُرسل إلى الخادم إلا للتحقق
- لا تسجيل للـ tokens في السجلات
- SQLite محلية

---

## المتطلبات

- **Node.js 18+** (جُرّب على 22)
- **npm 8+**
- **اتصال إنترنت** (لتحميل بيانات من Meta API)

```bash
node --version  # v18.0.0 أو أحدث
npm --version   # 8.0.0 أو أحدث
```

---

## التثبيت

### 1️⃣ استنساخ أو استخدام المستودع

```bash
cd /path/to/nova-pdf-studio
```

### 2️⃣ تثبيت المكتبات

المكتبات مثبتة بالفعل! إذا أردت إعادة التثبيت:

```bash
npm install
```

**المكتبات الرئيسية:**
- `express` - خادم ويب
- `better-sqlite3` - قاعدة بيانات محلية
- `axios` - طلبات HTTP
- `xlsx` - تصدير Excel
- `dotenv` - متغيرات البيئة

---

## إعداد Meta API

هذا هو الجزء الأهم! اتبع الخطوات بحذر:

### الخطوة 1️⃣: إنشاء Meta Developer App

1. اذهب إلى https://developers.facebook.com
2. اضغط **"My Apps"** (الزاوية العلوية اليسرى)
3. اضغط **"Create App"**
4. اختر **App Type: Business**
5. ملء التفاصيل:
   - **App Name**: `Comment Winner` (أو أي اسم)
   - **App Contact Email**: بريدك الإلكتروني
   - **App Purpose**: اختر "Marketing"
6. اضغط **"Create App"**

### الخطوة 2️⃣: إضافة Products

بعد إنشاء الـ App:

1. في لوحة التحكم، ابحث عن **"Products"** في الشريط الجانبي
2. ابحث عن **"Facebook Login"** وأضفه
3. ابحث عن **"Graph API"** (عادة موجودة بالفعل)
4. اضغط **"Next"** على أي نوافذ تظهر

### الخطوة 3️⃣: ربط صفحة Facebook

#### A) احصل على Facebook Page ID:

1. اذهب إلى صفحتك على Facebook
2. الرابط يكون مثل: `https://facebook.com/your-page-name/`
3. افتح Tools من Meta: https://developers.facebook.com/tools/explorer
4. في القائمة **"Meta App"** اختر تطبيقك
5. في **"Get Token"** اختر **"Page Access Token"**
6. سيظهر معك خيار لاختيار صفحتك
7. اختر صفحتك ✅
8. انسخ **Page Access Token** الذي يظهر

#### B) احصل على Page ID:

في نفس الـ Token Box:

```
GET /{page-id}
```

استبدل `{page-id}` برقم صفحتك (مثل `123456789`) واضغط **"Submit"**

الرد سيحتوي على `"id": "123456789"`

### الخطوة 4️⃣: ربط Instagram Professional Account

**ملاحظة مهمة**: حسابك على Instagram **يجب أن يكون Professional/Business Account** وليس شخصي!

#### اجعل حسابك Professional:

1. افتح تطبيق Instagram أو اذهب إلى instagram.com
2. اذهب إلى **Settings & Privacy** (الإعدادات)
3. اضغط **"Account Type and Tools"**
4. اختر **"Switch to Professional Account"**
5. اختر **"Business"** أو **"Creator"**
6. أكمل الخطوات

#### احصل على Instagram Business Account ID:

بعد ربط صفحة Facebook:

1. في Meta App Explorer (الرابط أعلاه)
2. تأكد من استخدام **Page Access Token**
3. اكتب في الـ Query:

```
GET /{page-id}/instagram_business_accounts
```

استبدل `{page-id}` برقم صفحتك

**الرد:**
```json
{
  "data": [
    {
      "id": "your-instagram-id",
      "username": "your_username"
    }
  ]
}
```

انسخ **id** (هو رقم طويل)

### الخطوة 5️⃣: احصل على Access Token (الطويل المدى)

الـ Token الذي نسختها يصلح 2 ساعة فقط. تحتاج token طويل المدى:

في Meta App Dashboard:
1. اذهب إلى **Settings** > **Basic**
2. انسخ **App ID** و **App Secret**
3. في Graph API Explorer:

```
GET /oauth/access_token?
grant_type=fb_exchange_token&
client_id={your-app-id}&
client_secret={your-app-secret}&
fb_exchange_token={short-lived-token}
```

استبدل القيم وأرسل الطلب

**الرد يحتوي على:**
```json
{
  "access_token": "very-long-token...",
  "token_type": "bearer"
}
```

هذا Token يعمل **شهرين!**

### الخطوة 6️⃣: تحقق من الصلاحيات (Permissions)

تأكد أن التطبيق لديه هذه الصلاحيات:

**Facebook:**
- `pages_read_engagement` - قراءة تفاعلات الصفحة
- `pages_read_user_content` - قراءة محتوى المستخدمين
- `pages_manage_posts` - إدارة المنشورات (اختياري)

**Instagram:**
- `instagram_business_basic` - معلومات الحساب الأساسية
- `instagram_business_content_publish` - غير مطلوب للقراءة

تحقق من الصلاحيات:
1. Settings > **Basic** أو **Roles**
2. تحت **App Roles** اختر دورك
3. تأكد من الصلاحيات

---

## الإعدادات

### ملف .env

انسخ `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

ثم عدّل `.env` وأضف القيم:

```env
# Meta Access Token (الطويل المدى)
META_ACCESS_TOKEN=EAA...very-long-token...

# Facebook Page ID (رقم صفحتك)
FACEBOOK_PAGE_ID=123456789

# Instagram Business Account ID (الرقم الطويل)
INSTAGRAM_BUSINESS_ACCOUNT_ID=12345678901234567

# Server
PORT=3000
NODE_ENV=development
```

⚠️ **تحذير:** لا تضع `.env` في Git!

---

## التشغيل

### التطوير (Development)

```bash
npm run winner:dev
```

أو:

```bash
node server.js
```

**الناتج:**
```
✓ Database initialized

🎉 Comment Winner Server running on http://localhost:3000
📊 Database: /home/user/nova-pdf-studio/database.db
⚙️  Environment: development
```

افتح المتصفح:
```
http://localhost:3000
```

### الإنتاج (Production)

```bash
NODE_ENV=production npm run winner
```

أو على VPS:

```bash
node server.js &
```

لإبقاء التطبيق شغّالاً استخدم `pm2`:

```bash
npm install -g pm2
pm2 start server.js --name "comment-winner"
pm2 startup
pm2 save
```

---

## الاستخدام

### الشاشة الرئيسية

1. **اختر المنصة**: Facebook أو Instagram
2. **ألصق رابط المنشور**:
   - Facebook: `https://facebook.com/your-page/posts/123456789`
   - Instagram: `https://instagram.com/p/ABC123xyz/`
3. اضغط **"التحقق من الرابط"** (يستخرج الرقم تلقائياً)
4. اضغط **"سحب التعليقات"**

### الفلاتر

بعد السحب، تظهر خيارات الفلاتر:

| الخيار | التأثير |
|--------|--------|
| حذف المكررات | نفس الشخص مرة واحدة فقط |
| مشاركة واحدة/مستخدم | يُطبّق نفس المنطق |
| تجاهل صاحب الصفحة | لا تحسب تعليقات الـ Admin |
| تجاهل التعليقات الفارغة | احذف التعليقات بدون نص |
| Top Level فقط | احسب التعليقات الأساسية (بدون ردود) |
| الحد الأدنى للمنشنات | مثال: 3 = يجب أن يكون بالتعليق 3 أشخاص منشونين |
| كلمة إجبارية | مثال: "تم" = يجب أن تكون الكلمة في التعليق |
| البحث | ابحث في التعليقات المعروضة |

### سحب الفائزين

1. اختر **عدد الفائزين** (1, 2, 3, 5, 10...)
2. اختيارياً: فعّل **"استبعاد الفائزين السابقين"**
3. اضغط **"🎉 اختيار الفائزين"**

**الخوارزمية:**
- استخدم `crypto.getRandomValues()` للعشوائية الآمنة
- Fisher-Yates Shuffle
- لا توجد نتائج مكررة

### إعادة السحب

- **إعادة القرعة**: اختر فائزين جدد من نفس المجموعة
- **فائز بديل**: أضف فائز إضافي (لم يفز من قبل)

---

## التصدير

### CSV

```
Platform,Name,Username,User ID,Comment,Mentions,Date,Post URL,Comment ID,Eligible,Winner Rank
Facebook,أحمد محمود,ahmed_m,123456,تم المشاركة,1,2024-09-19,https://...,123,Yes,1
```

### Excel

ملف `.xlsx` احترافي مع:
- أعمدة عريضة قابلة للقراءة
- معلومات كاملة عن كل تعليق
- ترقيم الفائزين

---

## الأمان

### حماية Access Token

✅ **ما يعمل:**
- يُحفظ في `localStorage` محليًا
- لا يُرسل إلى خادم خارجي
- يُحذف عند مسح بيانات المتصفح
- لا يُظهر في HTML مطلقاً

⚠️ **تحذيرات:**
- لا تشاركه مع أحد
- إذا تسرّب، أعد توليده من Meta
- استخدم Token طويل المدى (شهرين)
- استبدله كل شهر للأمان

### قاعدة البيانات

- SQLite محلية (بدون خادم خارجي)
- معرّفة بـ WAL mode للأداء
- تُحفظ في `database.db`
- ليس بها تشفير (إذا أردت، استخدم `db.pragma('cipher_key')`)

### السجلات (Logs)

لا نسجل:
- Access Tokens
- كلمات المرور
- بيانات شخصية

نسجل فقط:
- أخطاء الاتصال
- الأخطاء التقنية
- وقت التشغيل

---

## استكشاف الأخطاء

### "Access Token is not configured"

**الحل:**
1. اذهب إلى ⚙️ الإعدادات
2. أدخل Meta Access Token صحيح
3. اضغط "💾 حفظ الإعدادات"

### "Cannot extract Post ID from URL"

**المشاكل الممكنة:**
- رابط مختصر (bit.ly)
- رابط قديم
- رابط ليس للمنشور

**الحل:**
- ادخل Post ID يدويًا
- استخدم رابط مباشر من Facebook/Instagram

### "Instagram account is not Professional"

**الحل:**
1. افتح Instagram
2. Settings > Account Type
3. اختر "Professional Account" > "Business"
4. أعد المحاولة

### "Facebook Page not found"

**التحقق:**
1. تأكد من Page ID صحيح
2. تأكد من أن الـ Access Token لديه صلاحيات
3. تأكد أنك مسؤول الصفحة

### "Media not found"

**الحل:**
1. تأكد من أن المنشور عام
2. تأكد من أن الحساب Professional
3. ادخل Media ID يدويًا

### الخادم لا يستجيب

```bash
# تحقق من المنفذ
lsof -i :3000

# قتل العملية القديمة
kill -9 <PID>

# أعد التشغيل
npm run winner:dev
```

---

## الإيقاف الآمن

### على Linux/Mac

```bash
Ctrl+C
```

### على Windows

```
Ctrl+C أو أغلق الطرفية
```

---

## النشر على VPS

### مثال على DigitalOcean / Linode / Vultr:

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# استنساخ المشروع
git clone https://github.com/ohaigoune-debug/nova-pdf-studio.git
cd nova-pdf-studio

# تثبيت المكتبات
npm install --production

# إنشاء .env
nano .env
# ألصق المحتوى وأضف البيانات

# تثبيت pm2
sudo npm install -g pm2

# بدء التطبيق
pm2 start server.js --name "comment-winner"
pm2 startup
pm2 save

# إعداد Nginx (اختياري)
sudo apt install -y nginx
# أنشئ config في /etc/nginx/sites-available/
```

---

## الأسئلة الشائعة

### هل يعمل مع حسابات Instagram شخصية؟
❌ لا. يجب أن يكون **Professional Account**.

### هل أحتاج VPS؟
❌ لا. يعمل محليًا على جهازك.

### هل الفائزون عشوائيون حقاً؟
✅ نعم. استخدم `crypto.getRandomValues()` (آمن تشفيري).

### هل يُحفظ Access Token بأمان؟
✅ نعم. في `localStorage` محليًا فقط.

### هل يدعم دمج Facebook + Instagram؟
🔄 في الإصدار الحالي لا، لكن التعليقات تُحفظ بشكل منفصل.

### كم عدد التعليقات التي يمكن سحبها؟
📊 بدون حد. لكن Meta API بطيئة بـ 100 تعليق كل طلب.

---

## الترخيص

MIT License - استخدم بحرية!

---

## التطوير المستقبلي

- [ ] دعم Webhook للتحديثات التلقائية
- [ ] دمج التعليقات من Facebook و Instagram
- [ ] اكتشاف تلقائي لصاحب الصفحة
- [ ] مشاركة النتائج على وسائل التواصل
- [ ] Dark/Light Mode Toggle

---

## الدعم

### مشكلة في Meta API؟

- 📖 [Meta Graph API Docs](https://developers.facebook.com/docs/graph-api)
- 📖 [Instagram API](https://developers.facebook.com/docs/instagram-api)
- 🐛 [البحث في Issues](https://github.com/ohaigoune-debug/nova-pdf-studio/issues)

### مشكلة في التطبيق؟

افتح Issue مع:
- رسالة الخطأ الدقيقة
- خطوات إعادة إنتاج المشكلة
- نسخة Node.js

---

## المطورون

مبني بـ ❤️ بـ Express + SQLite + Vanilla JavaScript

---

**آخر تحديث:** سبتمبر 2026

