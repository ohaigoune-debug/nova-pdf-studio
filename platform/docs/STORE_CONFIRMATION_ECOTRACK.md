# المتجر على نسق NOVA COMMERCE: التأكيد، التوصيل (EcoTrack)، الإشعارات

قرار المالك (2026-10-24): «طلب الكتاب = طلب الدورة». السعر سعر الكتاب، يصل الكتاب فتُفعَّل الدورة،
وإن لم تُفعَّل فالتفعيل اليدوي أو كود الكتاب.

## دورة حياة الطلب

```
PENDING ──(لا يردّ)──▶ NO_ANSWER ─┐
   │  ◀──(اتصل لاحقاً)── CALL_LATER ┘  كلّها «طابور التأكيد»
   ▼ تأكيد (لوحة / مكالمة فائتة / رمز SMS)
CONFIRMED ──(إرسال إلى EcoTrack أو تلقائياً)──▶ SHIPPED ──(Livré)──▶ DELIVERED ⇒ تفعيل الدورة
                                                  └──(Retour)──▶ RETURNED (يعود المخزون)
أي حالة غير نهائية ──▶ CANCELLED ──(إعادة فتح)──▶ PENDING
```

- الجدول الكامل في `order-status.service.ts` (`ORDER_TRANSITIONS`)؛ كل تغيير حالة من أي مصدر يمرّ من `transitionOrder`.
- «سُلِّم» من أي مصدر (اللوحة، webhook، مزامنة EcoTrack) يستدعي `activateCoursesForOrder` — الثغرة القديمة (التسليم اليدوي لا يفعّل) أُغلقت.

## التأكيد

| الطريق | كيف | أين |
|---|---|---|
| هاتفي يدوي | طابور التأكيد: الهاتف رابط `tel:`، أزرار تأكيد / لا يردّ / لاحقاً / إلغاء، عدّاد المحاولات | `/admin/store/confirm` |
| مكالمة فائتة (NOVA Call) | التطبيق على هاتف المشرف يبلّغ `POST /api/v1/calls/<secret>`؛ مكالمة من رقم طلب معلّق تؤكّده | إعداد في صفحة الطابور (الرقم، النافذة، قطع المكالمة، عنوان الاقتران) |
| رمز SMS قبل الطلب | سياسة `requireOtp` + SuiviSMS الحقيقي: قالب معتمد أو تحدّي OTP من البوابة (4 أرقام) | `/admin/settings` |

تطبيق NOVA Call نفسه يُقرن بعنوان مدرسة (الحمولة متطابقة: `phone, direction, kind, text, app, at, now`).

## EcoTrack

- الإعداد: `/admin/delivery` → رابط المنصّة `https://<شركتك>.ecotrack.dz` + رمز API (يُختم بـ secret-box). الحفظ يتحقق عبر `GET api/v1/get/wilayas`.
- إرسال الطرد: زر «إرسال إلى EcoTrack» في صف الطلب المؤكَّد، أو تلقائياً عند التأكيد (خيار) عبر مهمة `ECOTRACK_SEND`.
- المزامنة: مهمة `ECOTRACK_SYNC` كل 20 دقيقة (العامل الداخلي أو `/api/v1/jobs/run`)، دفعات 60 طرداً، تحترم `X-RateLimit-Remaining` (احتياطي 1500) وتعالج 429 بإعادة 2/5/10 ثوانٍ.
- خريطة الحالات (`mapEcotrackStatus`) منقولة حرفياً من NOVA: كل `retour_*` مرتجع؛ `livré/encaissé` مسلَّم؛ `tentative/échoué` محاولة فاشلة (إشعار للمشرف ليتصل)؛ `prête à expédier` لم يتحرّك.
- الرسوم: «جلب رسوم التوصيل» يحفظ جدول الولايات (منزل/مكتب) فتعرضه السلة وتحسبه `placeOrder`؛ بلا جدول يبقى `STORE_SHIPPING_DZD`.
- السلة صارت تطلب البلدية وطريقة الاستلام (منزل/مكتب الشركة) لأن EcoTrack تطابق البلدية بالاسم.

## الإشعارات

- الزبون: داخلي + Push عند كل انتقال (مؤكَّد، في الطريق برقم التتبّع، سُلِّم، مرتجع، أُلغي) وعند تفعيل الدورة.
- المشرف: داخلي + Push + تيليغرام (اختياري، `/admin/settings`) عند: طلب جديد، تأكيد بمكالمة/SMS، تسليم (مع عدد الدورات المفعَّلة)، إرجاع، محاولة فاشلة، فشل الإرسال إلى EcoTrack، فشل التفعيل.

## كود الكتاب

- `/admin/courses/<id>/codes`: المشرف يولّد دفعة أكواد لفوج الدورة (الأستاذ ممنوع: `COURSE_GROUP_CODE`).
- التلميذ يُدخل الكود (`/activate-code` أو صفحته الرئيسية) ⇒ `redeemEnrollmentCode` يستدعي `enrollStudent(source: 'CODE')` ويستهلك الكود.

## الترحيل `0030_store_confirmation_ecotrack`

إضافة فقط: قيم جديدة في قيود `orders.status` و`delivery_events.status` و`course_enrollments.source`،
أعمدة `orders.commune/delivery_type/confirm_attempts/last_call_at/returned_at`، `otp_codes.provider_ref`، وجدول `call_events`.
ملف الرجوع في `drizzle/down/`.

## متغيّرات البيئة (اختيارية)

- `SUIVISMS_TEMPLATE_ID` — معرّف القالب المعتمد (أو من اللوحة). بدونه: OTP البوابة.
- `APP_URL` — لازم لعنوان اقتران NOVA Call.
