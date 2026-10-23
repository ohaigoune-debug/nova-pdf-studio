# خارطة الأكاديمية المدفوعة على منصة مدرسة (M8) — مسودّة تقنية 2026-10-23

> وثيقة تخطيط لا تنفيذ. الهدف: بناء الدورات المدفوعة فوق ما هو موجود دون أنظمة مكرّرة. القرارات التجارية مأخوذة من المالك؛ ما لم يُقرَّر مكتوب بوصفه خياراً.

## 0. ما يُعاد استعماله (موجود على `work`)

| الحاجة | الموجود | الفجوة |
|---|---|---|
| حسابات وأدوار | `users/profiles/sessions`، أدوار STUDENT/TEACHER/ASSISTANT/SUPER_ADMIN | التسجيل لا يميّز الأستاذ (يُنشأ الأستاذ من الإدارة فقط) — مقبول حالياً |
| المتجر والطلبات | `products/product_files/orders/order_items/downloads` (COD/تحويل/مجاني) | لا ربط «منتج → دورة»، لا OTP، لا حدّ وحدة/منتج، لا شعبة إجبارية |
| الفيديو المحمي | `content.videoProvider=UPLOAD` + `media.service` (رابط موقّع بهوية المشاهد، heartbeat، `media_views`) | التخزين محلي/S3 بلا DRM؛ Bunny Stream غير مدمج |
| الدروس والأفواج | `content/content_targets` (PUBLIC/STUDENTS_ONLY/أفواج)، `groups`، `enrollment_codes` | «الفوج» يصلح كوعاء الدورة: الاشتراك = عضوية فوج بمدّة |
| المنتدى والقسم الافتراضي | `forum_threads/posts` (إشراف، تثبيت، قفل)، `class_posts/comments` لكل فوج | قسم خاص بالدورة = القسم الافتراضي للفوج (موجود) |
| الإشعارات | Web Push + `notifications` + Resend | إشعار «بدأ البث» و«انتهى اشتراكك» |
| PLAY | `play_*`، ربط الدرس بالتحدي عبر `play_lessons` | ربط `content` ↔ `play_lessons` (عمود `playLessonId` اختياري) |
| التوصيل | تكامل NOVA COMMERCE (Yalidine/ZR Express webhooks) في مستودع آخر | يُنقل أو يُستدعى كخدمة |

## 1. نموذج البيانات المقترح (هجرة واحدة `00xx_academy.sql`)

- `courses` (id, title, slug, gradeCode, streamCodes[], subjectCode, teacherWorkspaceId, groupId→groups, season '2026/2027', startsOn, endsOn, accessEndsOn, priceDzd, status)
- `course_products` (courseId, productId) — شراء المنتج (الكتاب) = حق في الدورة.
- `course_enrollments` (id, courseId, studentId, source ENUM(BOOK_ORDER, MANUAL, GIFT), orderId?, activatedAt, expiresAt, acceptedTermsAt, status) — فريد (courseId, studentId).
- `live_sessions` (id, courseId, title, startsAt, durationMin, provider 'ZOOM_WEBINAR', providerMeetingId, joinUrlEncrypted, recordingContentId?) — الحصة القادمة = أقرب `startsAt`.
- `delivery_events` (id, provider, externalId UNIQUE, orderId, status, payload, receivedAt, processedAt) — إزالة التكرار بالمفتاح الخارجي.
- `support_tickets` (id, number SERIAL, userId, courseId?, kind, status, isSensitive) + `support_messages` (ticketId, authorUserId, body, fileId?) — مركز الشكاوى.
- `otp_codes` (id, userId?, phone, purpose ENUM(REGISTER, ORDER), codeHash, expiresAt, attempts).
- تعديلات: `orders` += `otpVerifiedAt`, `streamCode`; `products` += `maxPerOrder=1`, `requiresStream`; `content` += `courseId?`, `playLessonId?`.

## 2. المسارات

### 2.1 الشراء → التفعيل (بلا أكواد)
1. التلميذ (أو الولي) ينشئ حساباً → OTP على الهاتف (SuiviSMS كما في NOVA) → `users.phoneVerifiedAt`.
2. يختار الشعبة (إجباري إذا `product.requiresStream`) → سلة بوحدة واحدة/منتج → OTP ثانٍ عند تأكيد الطلب → فاتورة → إرسال إلى شركة التوصيل.
3. webhook التوصيل (`/api/v1/delivery/webhook`): تحقق التوقيع، سجل في `delivery_events` (idempotent)، عند `DELIVERED` → `course_enrollments` لكل `course_products` في الطلب.
4. **المشتري وليّ أمر**: الطلب يحمل `beneficiaryStudentId` اختياري؛ وإلا يُنشأ «رابط مطالبة» يُرسل بالـSMS يربط الدورة بحساب التلميذ عند أول دخول. لا تفعيل على حساب الولي.
5. قبل أول دخول للدورة: شاشة «قرأت ووافقت» (النظام الداخلي + انتهاء الفيديو بعد البكالوريا) → `acceptedTermsAt`.

### 2.2 الحصص المباشرة
- Zoom Webinar 500: يُتحقَّق من ترخيص Webinar وإمكانية التضمين (Zoom Web SDK / Meeting SDK) قبل الوعد بـ«بلا تطبيق». البديل الآمن: زر «انضم» يفتح Zoom بالمتصفح مع تسجيل الحضور لدينا عبر الانضمام من رابط موقّع.
- لافتة البث القادم في `/student` و`/student/classroom`؛ تذكير Push قبل 30 دقيقة.
- التسجيل يُرفع إلى Bunny ويُربط بـ`content` من نوع VIDEO ضمن الدورة.

### 2.3 الحصص المسجّلة (Bunny Stream)
- `videoProvider='BUNNY'` + `bunnyVideoId`؛ رابط مشاهدة موقّع (token auth) قصير العمر بهوية المشاهد + علامة مائية ديناميكية (اسم/هاتف التلميذ) في المشغّل.
- حفظ التقدّم عبر `media_views` الموجود. **لا يُدّعى أن DRM يمنع تصوير الشاشة**؛ الردع بالعلامة المائية وقصر الروابط ومراقبة التزامن (عدد الجلسات/الحساب).

### 2.4 الاشتراك والانتهاء
- 2026/2027: اشتراك سنوي واحد؛ من الموسم التالي: فصلي. `expiresAt` على العضوية؛ cron يومي يُغلق الوصول ولا يحذف شيئاً (سجلات، مشتريات، نتائج PLAY تبقى).

### 2.5 المنتدى/القسم الافتراضي والدعم
- قسم الدورة = `class_posts` للفوج المرتبط؛ موافقة قبل النشر = حقل `approvedAt` + دور المساعد.
- مركز الشكاوى: `/student/support` و`/admin/support`؛ التذاكر الحساسة (عن أستاذ) تُرى لـSUPER_ADMIN فقط.

## 3. الترتيب المقترح للتنفيذ (بعد إطلاق PLAY)
1. OTP + سياسة المتجر (شعبة إجبارية، وحدة/منتج) — صغير، يفيد المتجر الحالي فوراً.
2. `courses` + `course_enrollments` + التفعيل اليدوي من الإدارة (قبل webhook) — يسمح ببيع الدورة الأولى.
3. webhook التوصيل + `delivery_events` + رابط المطالبة للولي.
4. Bunny Stream (رفع، توكن، مشغّل) ثم ترحيل الفيديوهات المرفوعة.
5. Zoom Webinar (بعد التحقق التقني) + لافتة البث + التذكيرات.
6. الدعم والشكاوى، ثم سياسات الانتهاء.

## 4. ما يجب التحقق منه قبل أي وعد
- ترخيص Zoom Webinar 500 وSDK التضمين داخل الموقع.
- خطة Bunny Stream: token authentication، وجود DRM فعلي (MediaCage) في الخطة المختارة وتكلفته.
- قدرة SuiviSMS على OTP بالحجم المطلوب.
- الالتزام بقانون 18-05 للتجارة الإلكترونية (الفاتورة، شروط البيع) دون نطاق .com.dz حالياً.
