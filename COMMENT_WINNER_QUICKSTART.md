# 🚀 Comment Winner - Quick Start

أسرع طريقة للبدء!

---

## ⚡ 5 دقائق فقط

### 1️⃣ شغّل الخادم

```bash
cd nova-pdf-studio
npm run winner:dev
```

**انتظر حتى تظهر:**
```
✓ Database initialized
🎉 Comment Winner Server running on http://localhost:3000
```

### 2️⃣ افتح المتصفح

```
http://localhost:3000
```

### 3️⃣ أدخل الإعدادات

اضغط **⚙️ الإعدادات**:
1. **Meta Access Token**: ألصق token من Meta
2. **Facebook Page ID** (اختياري): `123456789`
3. **Instagram ID** (اختياري): `12345678901234567`
4. اضغط **💾 حفظ**

### 4️⃣ جرّب الميزات

#### أ) سحب بيانات وهمية
```
منصة: Facebook
رابط: https://facebook.com/pages/my-page/posts/123456789
اضغط: سحب التعليقات
```

يظهر 50 تعليق وهمي للاختبار ✅

#### ب) طبّق الفلاتر
- ✅ حذف المكررات
- ✅ الحد الأدنى للمنشنات: 1
- اضغط: أي شيء يتغير

#### ج) اسحب الفائزين
- اختر 3 فائزين
- اضغط: 🎉 اختيار الفائزين
- سترى 3 فائزين عشوائيين

#### د) صدّر النتائج
- **📊 Export CSV** - ملف CSV
- **📄 Export Excel** - ملف XLSX

---

## 📋 الخطوات المفصلة

### الحصول على Meta Access Token

**الخطوة 1: إنشاء Meta App**

1. https://developers.facebook.com
2. **My Apps** → **Create App**
3. Type: **Business** → **Next**
4. اسم التطبيق: `Comment Winner` → **Create App**

**الخطوة 2: احصل على Token**

1. في Meta App Dashboard
2. **Tools** → **Graph API Explorer**
3. في الأعلى، اختر تطبيقك
4. اختر: **Get Token** → **Page Access Token**
5. اختر صفحتك من القائمة
6. انسخ الـ Token الطويل

**الخطوة 3: استبدله بـ Long-Lived Token**

الـ Token الحالي ينتهي بعد ساعتين. لـ Token طويل المدى:

في Graph API Explorer، اكتب:
```
GET /oauth/access_token
?grant_type=fb_exchange_token
&client_id=YOUR_APP_ID
&client_secret=YOUR_APP_SECRET
&fb_exchange_token=SHORT_TOKEN
```

انسخ الـ Token الجديد من الرد ✅

---

## 🧪 اختبر بسرعة

### 1. السيرفر يعمل؟

```bash
curl http://localhost:3000/api/health
```

**الناتج المتوقع:**
```json
{"status":"ok","timestamp":"2026-09-19T..."}
```

### 2. URL Parsing يعمل؟

```bash
curl -X POST http://localhost:3000/api/posts/resolve \
  -H "Content-Type: application/json" \
  -d '{"url":"https://instagram.com/p/ABC123xyz/","platform":"instagram"}'
```

**الناتج:**
```json
{"postId":"ABC123xyz","platform":"instagram",...}
```

### 3. Draw Comments يعمل؟

في المتصفح:
1. اختر منصة
2. ألصق رابط وهمي
3. اضغط "سحب التعليقات"
4. ستظهر 50 تعليق ✅

---

## 🎯 الاستخدام الفعلي

### متطلبات Facebook

```
✅ حساب Facebook بصلاحيات Admin
✅ صفحة Facebook (Business page)
✅ Meta App مُنشأ
✅ Facebook Login Product مُفعّل
✅ Permissions: pages_read_engagement, pages_read_user_content
```

### متطلبات Instagram

```
✅ حساب Instagram Professional (Business/Creator)
✅ مرتبط بصفحة Facebook
✅ صلاحيات: instagram_business_basic
```

### الخطوة الأولى

1. افتح Facebook صفحتك
2. اذهب لمنشور أو Reel
3. انسخ الرابط
4. في Comment Winner، اختر **Facebook**
5. الصق الرابط
6. اضغط "سحب التعليقات"

**النتيجة:**
- عدد التعليقات
- أسماء المعلقين
- نصوص التعليقات
- التواريخ

---

## 🔥 حالات الاستخدام

### مسابقة أضف صديقك

```
التصفية:
☑️ الحد الأدنى للمنشنات: 2 (يجب @mention صديق)
☑️ كلمة إجبارية: "تم"

النتيجة: 150 تعليق مؤهل

الفائزون:
🏆 1. أحمد محمود (@ahmed_m)
🥈 2. فاطمة علي (@fatima_a)
```

### مسابقة الإعجاب

```
منشور: Reel محبوب
التصفية:
☑️ حد أدنى للمنشنات: 0
☑️ بدون فلاتر أخرى

النتيجة: 500+ تعليق

الفائز: تم اختياره عشوائياً بأمان ✅
```

### مسابقة الرد

```
التصفية:
☑️ احسب replies فقط (بدون top-level)
☑️ كلمة: "أحلى تعليق"

النتيجة: أفضل الردود
```

---

## ⚠️ الأخطاء الشائعة

### "Access Token expired"
**الحل:** احصل على token جديد من Meta

### "Cannot extract Post ID"
**الحل:** استخدم رابط مباشر (بدون shortened URLs)

### "Instagram account is not Professional"
**الحل:** تحويل حسابك إلى Professional في Instagram

### "Facebook Page not found"
**الحل:** تأكد من Page ID صحيح وأنك Admin

---

## 📊 البيانات المُصدّرة

### معلومات التعليق

| الحقل | المثال |
|-------|--------|
| Platform | facebook |
| Name | أحمد محمود |
| Username | ahmed_m |
| User ID | 123456789 |
| Comment | "تم المشاركة ✅" |
| Mentions | 1 |
| Date | 2026-09-19 |
| Post URL | https://facebook.com/... |
| Eligible | Yes |
| Winner Rank | 1 |

---

## 💾 حفظ المشروع

### أين تُحفظ البيانات؟

```
database.db         # كل التعليقات والفائزين
database.db-shm    # عارضة (SQLite)
database.db-wal    # عارضة (SQLite)
```

### كيفية النسخ الاحتياطي

```bash
# ننسخ قاعدة البيانات
cp database.db database.db.backup

# أو استخدم Export CSV/Excel من التطبيق
```

---

## 🛑 إيقاف التطبيق

```bash
# في الطرفية
Ctrl+C
```

### إعادة التشغيل

```bash
npm run winner:dev
```

البيانات محفوظة ✅

---

## 🎓 الخطوات التالية

### تعميق الاستخدام

1. ✅ جرّب Meta API الفعلية (استبدل mock data)
2. ✅ أضف Webhook للتحديثات الحية
3. ✅ رفع على VPS (Render, Railway, etc)
4. ✅ أضف مزيد من الفلاتر

### دليل المطورين

اقرأ:
- `COMMENT_WINNER_README.md` - شامل
- `COMMENT_WINNER_ARCHITECTURE.md` - تقني

---

## 🆘 الدعم

### مشكلة؟

1. تحقق من `http://localhost:3000` (السيرفر يعمل؟)
2. افتح Console (F12) - أي errors؟
3. تحقق من .env - القيم صحيحة؟
4. أعد تشغيل السيرفر

### لا تزال عالقاً؟

- اقرأ `COMMENT_WINNER_README.md` بتمعّن
- تحقق من Meta Documentation
- افتح Issue في GitHub

---

**🎉 الآن أنت جاهز! استمتع بسحب الفائزين 🎊**

