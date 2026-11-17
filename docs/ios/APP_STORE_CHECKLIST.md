# قائمة تجهيز App Store / TestFlight — NOVA Docs 1.0.0

| # | البند | الحالة | ملاحظات |
|---|---|---|---|
| 1 | مشروع Xcode قابل للبناء | **COMPLETE** | CI على macOS-15 / Xcode 26.3: Debug (محاكي) وRelease (جهاز، دون توقيع) — BUILD SUCCEEDED |
| 2 | Bundle ID مستقل عن «مدرسة» | COMPLETE | `com.haigoune.novadocs` — مسجّل (تقرير المالك 16 نوفمبر) ومستعمل في كل البناءات المرفوعة |
| 3 | Version 1.0.0 | COMPLETE | `MARKETING_VERSION = 1.0.0`؛ رقم البناء = رقم تشغيل CI. **مطلوب بناء 1.0.0 جديد** قبل التقديم (آخر 1.0.0 مرفوع هو (3)، قبل إصلاحات 16 نوفمبر) |
| 4 | iPhone + iPad (TARGETED_DEVICE_FAMILY 1,2)، iOS 16.0+ | COMPLETE | |
| 5 | الأيقونة 1024×1024 بلا شفافية | COMPLETE | `Assets.xcassets/AppIcon.appiconset` |
| 6 | شاشة الإطلاق | COMPLETE | Splash 2732² بالهوية |
| 7 | Privacy Manifest | COMPLETE | `PrivacyInfo.xcprivacy` |
| 8 | أذونات (الكاميرا) بـ14 لغة | COMPLETE | `xx.lproj/InfoPlist.strings` |
| 9 | Export compliance | COMPLETE | `ITSAppUsesNonExemptEncryption = NO` |
| 10 | منتج StoreKit + ملف اختبار | COMPLETE (شيفرة + 7/7 اختبارات StoreKit Testing) / BLOCKED (App Store Connect) | المنتج يجب أن يُنشأ في App Store Connect بالمعرّف نفسه حرفيًا |
| 11 | وصف المتجر والكلمات المفتاحية ar/fr/en | COMPLETE | `APP_STORE_METADATA.md` (الأطوال محسوبة) |
| 12 | سياسة الخصوصية + الشروط + الدعم | COMPLETE (محتوى) / BLOCKED (نشر + بريد الدعم) | `site/nova-docs/` — يحتاج موافقتك على مكان النشر؛ بريد الدعم سرّ `NOVA_SUPPORT_EMAIL` |
| 13 | لقطات iPhone 6.9" وiPad 13" حقيقية | PARTIAL | 8 لكل جهاز في `docs/ios/screenshots/` بالمقاسات المقبولة (1320×2868 و2064×2752) — **قديمة**: تُحدَّث بميزات 16 نوفمبر (تنسيق النص، الخطوط، البائع) وباستبدال الاسم التجريبي «ليلى مراد» (قرارك، البيانات مشتركة مع Windows). لا تُستعمل لقطة Pro بسعر غير حقيقي. |
| 14 | التوقيع (Signing) | COMPLETE | توقيع سحابي Apple Distribution عند التصدير (مفتاح API بدور Admin)؛ اختبار التوقيع نجح (التشغيل 2) |
| 15 | IPA / Release Archive | COMPLETE | `nova-docs-testflight.yml` — 5 رفعات ناجحة (1.0.0 (3)، 0.9.0 (4، 6، 8، 11)) |
| 16 | TestFlight | COMPLETE (داخلي) | 1.0.0 (3) و0.9.0 (6) مثبّتان على iPhone المالك (تأكيده)؛ (8) و(11) رُفعا ولم يُؤكَّد ظهورهما |
| 17 | منتج الشراء في App Store Connect | BLOCKED | `nova.docs.pro.lifetime` + Paid Apps Agreement + البنك + الضرائب (حسابك) |
| 18 | Sandbox: شراء + استعادة على TestFlight | BLOCKED | بعد البند 17، على بناء 1.0.0 (لا 0.9.0) |
| 19 | App Privacy + التصنيف العمري + الفئة + السعر | NOT STARTED | في App Store Connect (حسابك)؛ الجواب المقترح للخصوصية: Data Not Collected |
| 20 | ملاحظات المراجِع (Review Notes) | NOT STARTED | تُكتب مع البناء النهائي: لا تسجيل دخول، ميزات Pro، طريقة الوصول للشراء |
| 21 | التقديم للمراجعة | **لن يتم دون موافقتك** | |

## خطوات TestFlight عندما تصبح جاهزًا
1. App Store Connect ← Users and Access ← Integrations ← **App Store Connect API** ← Generate Key (دور **App Manager**). احفظ: Key ID، Issuer ID، ملف `.p8` (يُنزَّل مرة واحدة).
2. GitHub ← Settings ← Secrets and variables ← Actions ← أضف: `APPLE_TEAM_ID`، `ASC_KEY_ID`، `ASC_ISSUER_ID`، `ASC_KEY_P8_BASE64` (`base64 -i AuthKey_XXXX.p8`). أنشئ Environment باسم `apple-release` (يمكن جعله يتطلب موافقتك قبل كل تشغيل).
3. App Store Connect ← Apps ← **+** New App ← iOS، الاسم، Bundle ID، SKU `NOVADOCS-IOS-001`.
4. Actions ← «NOVA Docs → TestFlight (manual)» ← Run workflow ← build number = 1.
5. بعد المعالجة (10–30 دقيقة): TestFlight ← Internal Testing ← أضف نفسك.
6. **لا ترسل للمراجعة العامة** إلا بعد اختبار الشراء في Sandbox والمسح الحقيقي بالكاميرا على جهاز.

## بديل يدوي (Mac)
```bash
cd apps/nova-docs && npm ci && node scripts/copy-assets.mjs && npm run build && npx cap sync ios && python3 scripts/patch-xcode-project.py
open ios/App/App.xcodeproj   # Signing & Capabilities ← Team ← Product ← Archive ← Distribute ← TestFlight
```

## TestFlight — الخطوات بالترتيب (16 نوفمبر)
1. عضوية Apple Developer Program فعّالة.
2. developer.apple.com ← Identifiers ← App ID من نوع App بمعرّف صريح `com.haigoune.novadocs` (الشراء داخل التطبيق مفعّل افتراضيًا).
3. App Store Connect ← Apps ← New App: iOS، الاسم «NOVA Docs: PDF & Invoices»، المعرّف أعلاه، SKU `NOVADOCS-IOS-001`.
4. App Store Connect ← Users and Access ← Integrations ← App Store Connect API ← Team Keys ← مفتاح بدور **Admin** (دور App Manager يُرفض في التوقيع السحابي للتوزيع). نزّل ملف `.p8` (مرة واحدة فقط)، وسجّل Key ID وIssuer ID، وTeam ID من Membership.
5. GitHub ← Settings ← Secrets and variables ← Actions: `APPLE_TEAM_ID`، `ASC_KEY_ID`، `ASC_ISSUER_ID`، و**`ASC_KEY_P8`** = نص ملف `.p8` كما هو (افتحه بالمفكرة وانسخ كل الأسطر) — أو بديلًا عنه `ASC_KEY_P8_BASE64` (و`NOVA_SUPPORT_EMAIL` اختياريًا). تحويل base64 إن اخترته، في PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXX.p8")) | Set-Clipboard`
5b. **اختبار التوقيع قبل الرفع (اختياري، موصى به):** `.github/workflows/nova-docs-sign-test.yml` يوقّع Release ويصدّر IPA على خادم macOS فقط (`destination=export`)، ويتحقق من Bundle ID والإصدار وصحة التوقيع وأن الشهادة Apple Distribution وأن ملف التزويد App Store بلا أجهزة. **لا يرفع شيئًا إلى Apple**، ولا ينشر ملف IPA (المستودع عام). التشغيل بوسم `nova-docs-sign-test-<n>`.
6. التشغيل: دفع وسم `nova-docs-testflight-<n>` (يعمل من الفرع دون دمج في main). رقم البناء = رقم التشغيل.
7. بعد المعالجة (10–30 دقيقة): TestFlight ← Internal Testing ← مجموعة + إضافة نفسك ← تطبيق TestFlight على iPhone/iPad. الاختبار الداخلي لا يمر بمراجعة Beta ولا يُنشر للعامة.
8. شراء Pro داخل TestFlight يحتاج Paid Apps Agreement + المنتج `nova.docs.pro.lifetime`؛ دونهما يعمل التطبيق وتعرض شاشة Pro «App Store غير متاح». مشتريات TestFlight مجانية (بيئة Sandbox).

**الحالة حسب تقرير المالك (16 نوفمبر، 12:30):** العضوية فعّالة · المعرّف `com.haigoune.novadocs` مسجّل · التطبيق أُنشئ في App Store Connect باسم «NOVA Docs: PDF & Invoices» · مجموعة TestFlight الداخلية «Owner» جاهزة · السرّان `APPLE_TEAM_ID` و`ASC_ISSUER_ID` مضافان. **الناقص:** مفتاح API بدور Admin + السرّان `ASC_KEY_ID` و`ASC_KEY_P8`. (لا أستطيع التحقق من حساب Apple ولا من أسرار GitHub من بيئة العمل؛ واجهة الأسرار محجوبة.)

**بناء اختبار داخلي (Pro مفتوح للتجربة فقط):** إيداع على `feature/nova-docs-ios` رسالته تحوي `[testflight-tester]` ← سير العمل نفسه يرفع الإصدار **0.9.0** بشرط `NOVA_TESTER_PRO`. يظهر في TestFlight كإصدار منفصل 0.9.0؛ أضفه إلى مجموعة Owner. **لا تختره أبدًا لإصدار المراجعة** (ولن يظهر لإصدار 1.0 أصلًا). الشراء الحقيقي يُختبر فقط على بناء 1.0.0 بعد إنشاء المنتج وتفعيل الاتفاقية.

**16 نوفمبر 13:07:** مفتاح API والأسرار الأربعة جاهزة · اختبار التوقيع نجح (التشغيل 2) · **البناء 1.0.0 (3) رُفع إلى App Store Connect**. التشغيل من بيئة العمل يتم بإيداع على الفرع رسالته تحوي الكلمة المفتاحية (دفع الوسوم مرفوض من بيئة العمل).

## التقديم النهائي — الخطة المعتمدة (17 نوفمبر 2026)
قرارات المالك: صفحات الخصوصية والدعم على **GitHub Pages**، **بريد دعم مستقل جديد**، التصريح في DSA بأنه **تاجر (Trader)**، واستبدال الاسم التجريبي في نسخة iOS.

| # | الخطوة | من ينفذها | الحالة |
|---|---|---|---|
| 1 | اتفاقية التطبيقات المدفوعة + البنك + الضرائب | المالك | ✅ Active |
| 2 | منتج `nova.docs.pro.lifetime` محفوظ | المالك | ✅ Prepare for Submission |
| 3 | اسم تجريبي محايد في بيانات العرض (iOS فقط) | Claude | ✅ `src/lib/demoData.ts` + اختبار (88/88) |
| 4 | ملفات نصوص المتجر en/fr/ar لـ fastlane + سير عمل رفعها دون تقديم | Claude | ✅ `apps/nova-docs/fastlane/`، `nova-docs-appstore-metadata.yml` (لم يُشغَّل) |
| 5 | لقطات متجر جديدة (6.9" و13") بالأسماء المحايدة | Claude (CI) | ⏳ |
| 6 | نشر `privacy.html` و`support.html` و`terms.html` تحت `docs/nova-docs/` على main (طلب دمج صغير مستقل عن #95) | Claude | ⏳ بانتظار بريد الدعم |
| 7 | سرّ `NOVA_SUPPORT_EMAIL` (والاختيارية: `NOVA_REVIEW_PHONE`, `NOVA_REVIEW_FIRST_NAME`, `NOVA_REVIEW_LAST_NAME`) | المالك | ⏳ |
| 8 | DSA: التصريح بصفة تاجر | المالك (ويب) | ⏳ |
| 9 | App Privacy: Data Not Collected | المالك (ويب) | ⏳ |
| 10 | التصنيف العمري: «لا» لكل الأسئلة | المالك (ويب) | ⏳ |
| 11 | مختبر Sandbox + شراء تجريبي على 1.0.0 (12) أو أحدث | المالك (جهاز) | ⏳ |
| 12 | لقطة شاشة مراجعة المنتج (شاشة الشراء بالسعر) | المالك | ⏳ |
| 13 | رفع النصوص واللقطات، اختيار البناء، ربط المنتج | Claude (API) + المالك | ⏳ |
| 14 | ملخص نهائي للمالك ثم Submit for Review | Claude بعد نجاح الخطوة 11 | ⏳ |

> لا يُقدَّم أي بناء 0.9.0 (نسخ المختبِر الداخلية). لا يُعدّ التطبيق منشورًا قبل رسالة Apple «Ready for Distribution».
