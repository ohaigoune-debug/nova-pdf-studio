# 🏗️ Comment Winner - البنية التقنية

توثيق شامل لـ MVP الأول من Comment Winner.

---

## 📁 هيكل المشروع

```
nova-pdf-studio/
├── server.js                      # Express server + API
├── package.json                   # Dependencies
├── .env.example                   # Environment template
├── .env                          # Local config (git ignored)
├── database.db                   # SQLite database
├── public/
│   ├── index.html               # Arabic RTL interface
│   ├── app.js                   # Frontend logic
│   └── style.css                # Dark mode styling
├── COMMENT_WINNER_README.md      # Setup guide
└── COMMENT_WINNER_ARCHITECTURE.md # This file
```

---

## 🗄️ قاعدة البيانات

### Schema

#### `contests` - المسابقات
```sql
CREATE TABLE contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `posts` - المنشورات
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('facebook', 'instagram')),
  post_id TEXT NOT NULL,
  post_url TEXT NOT NULL,
  post_type TEXT,
  total_comments INTEGER DEFAULT 0,
  fetched_at DATETIME,
  UNIQUE(contest_id, platform, post_id)
);
```

#### `comments` - التعليقات
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL,
  comment_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  username TEXT,
  name TEXT NOT NULL,
  text TEXT,
  likes_count INTEGER DEFAULT 0,
  created_time DATETIME,
  is_reply INTEGER DEFAULT 0,
  parent_comment_id TEXT,
  mentions_count INTEGER DEFAULT 0,
  is_eligible INTEGER DEFAULT 1,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**الأعمدة المهمة:**
- `mentions_count`: عدد @mentions (يُحسب تلقائياً)
- `is_reply`: هل هو رد على تعليق آخر
- `is_eligible`: هل يمكن الفوز (بعد الفلاتر)

#### `winners` - الفائزون
```sql
CREATE TABLE winners (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL,
  comment_id TEXT NOT NULL,
  user_id TEXT,
  username TEXT,
  name TEXT NOT NULL,
  comment_text TEXT,
  winner_rank INTEGER,
  drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `settings` - الإعدادات
```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Endpoints

### Health & Status

#### `GET /api/health`
التحقق من صحة الخادم.

```bash
curl http://localhost:3000/api/health
```

**الرد:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-19T16:48:10.702Z"
}
```

---

### Meta API

#### `GET /api/meta/pages`
الحصول على قائمة صفحات Facebook المرتبطة.

**التطوير المستقبلي:** سيتصل بـ Meta Graph API.

```json
{
  "pages": [
    {
      "id": "123456789",
      "name": "My Page",
      "instagram_account": "12345678901234567"
    }
  ]
}
```

---

### معالجة المنشورات

#### `POST /api/posts/resolve`
استخراج معرّف المنشور من الرابط.

**Request:**
```json
{
  "url": "https://facebook.com/pages/page-name/posts/123456789",
  "platform": "facebook"
}
```

**الرد (نجح):**
```json
{
  "postId": "123456789",
  "platform": "facebook",
  "url": "https://facebook.com/pages/page-name/posts/123456789"
}
```

**الرد (خطأ):**
```json
{
  "error": "Cannot extract Post ID from URL",
  "message": "Please enter the Post ID manually or use a direct post link"
}
```

**الخوارزمية:**

للـ Facebook:
- `/posts/(\d+)` - رابط مباشر
- `/fbid=(\d+)` - رابط القديم
- `/photo\.php\?fbid=(\d+)` - صور
- `/video\.php\?v=(\d+)` - فيديو
- `/reel/(\d+)` - Reels

للـ Instagram:
- `/p/([A-Za-z0-9_-]+)` - Post
- `/reel/([A-Za-z0-9_-]+)` - Reel
- `/tv/([A-Za-z0-9_-]+)` - IGTV

---

#### `POST /api/comments/fetch`
سحب التعليقات من المنشور.

**Request:**
```json
{
  "platform": "facebook",
  "postId": "123456789",
  "contestId": "contest_1"
}
```

**الرد:**
```json
{
  "commentsFetched": 250,
  "hasMore": false
}
```

**الخطوات:**
1. التحقق من Access Token
2. نداء Meta Graph API (Pagination)
3. استخراج البيانات من الرد
4. حساب عدد @mentions
5. تخزين في قاعدة البيانات

---

### التعليقات

#### `GET /api/comments?contestId=1&platform=facebook`
الحصول على التعليقات المُحفوظة.

**Query Parameters:**
- `contestId` (مطلوب)
- `platform` (اختياري)

**الرد:**
```json
[
  {
    "id": 1,
    "comment_id": "123456789_987654321",
    "username": "ahmed_m",
    "name": "أحمد محمود",
    "text": "تم المشاركة ✅",
    "mentions_count": 0,
    "is_eligible": 1,
    "platform": "facebook",
    "post_url": "https://facebook.com/..."
  }
]
```

---

### السحب والفائزون

#### `POST /api/draw`
سحب الفائزين من التعليقات المؤهلة.

**Request:**
```json
{
  "contestId": 1,
  "winnerCount": 3,
  "minMentions": 0,
  "requiredKeyword": "",
  "filterDuplicates": true,
  "excludePageOwner": false,
  "excludeReplies": true
}
```

**الرد:**
```json
{
  "success": true,
  "winnersCount": 3,
  "winners": [
    {
      "rank": 1,
      "name": "أحمد محمود",
      "username": "ahmed_m",
      "comment": "تم المشاركة ✅",
      "platform": "facebook"
    }
  ]
}
```

**الخوارزمية الآمنة:**
```javascript
// Fisher-Yates Shuffle باستخدام Crypto
for (let i = array.length - 1; i > 0; i--) {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  const j = randomBytes[0] % (i + 1);
  [array[i], array[j]] = [array[j], array[i]];
}
```

---

### التصدير

#### `GET /api/export/csv?contestId=1`
تصدير بصيغة CSV.

**Header:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="contest_1_1234567890.csv"
```

**الأعمدة:**
```
Platform,Name,Username,User ID,Comment,Mentions,Date,Post URL,Comment ID,Eligible,Winner Rank
```

---

#### `GET /api/export/xlsx?contestId=1`
تصدير بصيغة Excel.

**تفاصيل:**
- استخدام مكتبة `xlsx`
- أعمدة بعرض محدد
- ورقة واحدة "Comments"
- دعم الأحرف العربية

---

## 🎨 الواجهة الأمامية

### البنية (HTML)

```html
├── Header (شعار + عنوان)
├── Settings Button (زر الإعدادات)
├── Main Sections:
│   ├── Platform & URL (اختيار + إدخال الرابط)
│   ├── Stats (إحصائيات + فلاتر)
│   ├── Draw (سحب الفائزين)
│   └── Winners (عرض الفائزين)
├── Modals:
│   └── Settings Modal
└── Messages & Loaders
```

### التصميم (CSS)

**المتغيرات الرئيسية:**
```css
--primary-dark: #1a1f3a     /* Background الرئيسي */
--secondary-dark: #2d3561   /* Cards/sections */
--accent-green: #00d084     /* CTA primary */
--accent-gold: #ffd700      /* Winner/headers */
--text-light: #e0e0e0       /* Text primary */
--text-lighter: #b0b0b0     /* Text secondary */
```

**Responsive Breakpoints:**
- Desktop: 1200px+
- Tablet: 768px - 1199px
- Mobile: < 768px

**أنماط خاصة:**
- RTL بالكامل (Arabic)
- Dark Mode دائم
- Dark cards مع borders خضراء
- Animation على الأزرار والـ cards

---

### JavaScript

**الحالة العامة (Global State):**
```javascript
let appState = {
  currentPlatform: 'facebook',
  currentContestId: null,
  currentPostId: null,
  allComments: [],        // كل التعليقات
  filteredComments: [],   // بعد الفلاتر
  winners: [],            // الفائزون المختارون
  restoredSettings: false
};
```

**التدفق الرئيسي:**
1. `selectPlatform()` - اختيار منصة
2. `resolvePostUrl()` - استخراج معرّف المنشور
3. `fetchComments()` - سحب التعليقات
4. `applyFilters()` - تطبيق الفلاتر
5. `drawWinners()` - سحب الفائزين
6. `displayWinners()` - عرض النتائج
7. `exportCSV()/exportXLSX()` - تصدير

**تخزين الإعدادات:**
```javascript
localStorage.setItem('metaSettings', JSON.stringify({
  accessToken,
  facebookPageId,
  instagramAccountId,
  savedAt: '2026-09-19T...'
}));
```

---

## 🔒 الأمان

### حماية الـ Token

**في Frontend:**
- تخزين في `localStorage` محليًا
- لا يُعرض في HTML
- لا يُرسل في Logs

**في Backend:**
- يُستقبل من الـ Frontend
- لا يُحفظ في Database
- لا يُسجل في Console
- مُستخدم فقط للـ API calls

### تجنب الأخطار الشائعة

```javascript
// ❌ لا تفعل
console.log('Token: ' + token);
res.json({ token: accessToken });

// ✅ افعل
console.log('Token received');
res.json({ success: true });
```

---

## 📊 البيانات الوهمية (Mock Data)

في الإصدار الحالي، تُستخدم بيانات وهمية لـ Testing:

```javascript
function generateMockComments(platform, postId) {
  const names = ['أحمد محمود', 'فاطمة علي', ...];
  const commentTexts = ['تم المشاركة ✅', ...];
  
  // Generate 50 random comments
  return comments;
}
```

**الخطة المستقبلية:**
استبدال بـ `fetchFromMetaAPI()` الفعلية:
```javascript
// TODO: Real implementation
const response = await axios.get(
  `https://graph.facebook.com/v18.0/${postId}/comments`,
  { params: { access_token, fields } }
);
```

---

## 🚀 الأداء

### التحسينات المطبقة

1. **Database Optimization:**
   - WAL mode للسرعة
   - Indexes على `post_id` و `is_eligible`

2. **Frontend:**
   - Vanilla JS (بدون frameworks ثقيلة)
   - CSS في ملف واحد
   - Lazy loading للصور (مستقبلاً)

3. **API:**
   - Pagination للتعليقات (100 في كل طلب)
   - Compression (مستقبلاً)
   - Caching (مستقبلاً)

---

## 📈 قابلية التوسع

### إضافة Platforms جديدة

لإضافة Twitter/X مثلاً:

```javascript
// 1. في database schema
CHECK(platform IN ('facebook', 'instagram', 'twitter'))

// 2. في app.js
if (platform === 'twitter') {
  postId = extractTwitterPostId(url);
}

// 3. في server.js (Meta API call أو بديل)
async function fetchTwitterComments(postId) { ... }
```

### إضافة Filters جديدة

```javascript
// في applyFilters()
if (document.getElementById('minLikes').value) {
  const minLikes = parseInt(...);
  filtered = filtered.filter(c => c.likes_count >= minLikes);
}
```

---

## 🧪 Testing (المستقبل)

الخطة:
```bash
npm test
```

Tests مقترحة:
- Unit: `extractPostId()`, `extractMentions()`
- Integration: API endpoints
- E2E: سحب كامل من البداية للنهاية

---

## 🐛 Known Limitations

### الإصدار الحالي

1. **بيانات وهمية:** تُستخدم mock data بدل Meta API الفعلي
2. **بدون Webhook:** لا تحديثات تلقائية للتعليقات الجديدة
3. **لا دمج المنصات:** Facebook و Instagram منفصلة
4. **محلي فقط:** بدون Database خارجية

### الحلول المخطط

| المشكلة | الحل | الأولوية |
|--------|------|---------|
| Mock Data | Meta API integration | High |
| No real-time | Webhook + Socket.io | Medium |
| Platform merge | Matching algorithm | Medium |
| Cloud hosting | AWS/Render setup | Low |

---

## 📝 Logging Strategy

### معلومات تُسجل:
```
✓ Database initialized
✓ Server running on port 3000
✓ Filters applied: 150 eligible comments
✓ [POST /api/posts/resolve] Success
```

### معلومات لا تُسجل:
```
✗ Access Tokens
✗ User IDs
✗ Comment texts
✗ API credentials
```

---

## 🔄 Update Cycle

### الإصدار 1.0 (الحالي - MVP)
- ✅ Core sحب التعليقات
- ✅ Sحب الفائزين
- ✅ Filtering
- ✅ Export

### الإصدار 1.1 (Planned)
- [ ] Meta API integration (real)
- [ ] Platform detection
- [ ] User profile matching

### الإصدار 2.0 (Roadmap)
- [ ] Webhook support
- [ ] Multi-platform merge
- [ ] Cloud deployment
- [ ] Mobile app

---

## 📚 المراجع

- [Express.js Docs](https://expressjs.com/)
- [SQLite Docs](https://www.sqlite.org/)
- [Meta Graph API](https://developers.facebook.com/docs/graph-api)
- [Instagram API](https://developers.facebook.com/docs/instagram-api)

---

**آخر تحديث:** سبتمبر 2026
**الإصدار:** 1.0 MVP
