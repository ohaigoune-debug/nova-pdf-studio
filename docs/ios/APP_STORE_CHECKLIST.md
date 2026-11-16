# قائمة تجهيز App Store / TestFlight — NOVA Docs 1.0.0

| # | البند | الحالة | ملاحظات |
|---|---|---|---|
| 1 | مشروع Xcode قابل للبناء | **COMPLETE** | CI على macOS-15 / Xcode 26.3: Debug (محاكي) وRelease (جهاز، دون توقيع) — BUILD SUCCEEDED |
| 2 | Bundle ID مستقل عن «مدرسة» | COMPLETE (مقترح) | `com.haigoune.novadocs` — يُسجَّل في Developer ← Identifiers |
| 3 | Version 1.0.0 / Build 1 | COMPLETE | `MARKETING_VERSION = 1.0.0`، `CURRENT_PROJECT_VERSION = 1` |
| 4 | iPhone + iPad (TARGETED_DEVICE_FAMILY 1,2)، iOS 16.0+ | COMPLETE | |
| 5 | الأيقونة 1024×1024 بلا شفافية | COMPLETE | `Assets.xcassets/AppIcon.appiconset` |
| 6 | شاشة الإطلاق | COMPLETE | Splash 2732² بالهوية |
| 7 | Privacy Manifest | COMPLETE | `PrivacyInfo.xcprivacy` |
| 8 | أذونات (الكاميرا) بـ14 لغة | COMPLETE | `xx.lproj/InfoPlist.strings` |
| 9 | Export compliance | COMPLETE | `ITSAppUsesNonExemptEncryption = NO` |
| 10 | منتج StoreKit + ملف اختبار | COMPLETE (شيفرة + 7/7 اختبارات StoreKit Testing) / BLOCKED (App Store Connect) | المنتج يجب أن يُنشأ في App Store Connect بالمعرّف نفسه حرفيًا |
| 11 | وصف المتجر والكلمات المفتاحية ar/fr/en | COMPLETE | `APP_STORE_METADATA.md` (الأطوال محسوبة) |
| 12 | سياسة الخصوصية + الشروط + الدعم | COMPLETE (محتوى) / BLOCKED (نشر) | `site/nova-docs/` — يحتاج استضافة بموافقتك |
| 13 | لقطات iPhone 6.9" وiPad 13" حقيقية | PARTIAL | 8 لكل جهاز من المحاكي الحقيقي بالمقاسات المقبولة (1320×2868 و2064×2752) في `docs/ios/screenshots/`. **راجعها قبل الرفع**: بيانات الفواتير التجريبية مأخوذة من نسخة Windows وفيها اسم «ليلى مراد» (اسم فنانة معروفة) — يُفضَّل استبداله؛ ولقطة المسح هي شاشة المراجعة لصورة مولَّدة (المحاكي بلا كاميرا) ولا لشاشة Pro بسعر حقيقي. |
| 14 | التوقيع (Signing) | BLOCKED | يحتاج Team ID وشهادة (أو مفتاح App Store Connect API للتوقيع التلقائي) |
| 15 | IPA / Release Archive | BLOCKED | سير العمل `nova-docs-testflight.yml` جاهز ويحتاج الأسرار الأربعة |
| 16 | TestFlight | BLOCKED | نفس ما سبق + تسجيل التطبيق في App Store Connect |
| 17 | التقديم للمراجعة | **لن يتم دون موافقتك** | |

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
5. GitHub ← Settings ← Secrets and variables ← Actions: `APPLE_TEAM_ID`، `ASC_KEY_ID`، `ASC_ISSUER_ID`، `ASC_KEY_P8_BASE64` (و`NOVA_SUPPORT_EMAIL` اختياريًا). تحويل المفتاح في PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXX.p8")) | Set-Clipboard`
6. التشغيل: دفع وسم `nova-docs-testflight-<n>` (يعمل من الفرع دون دمج في main). رقم البناء = رقم التشغيل.
7. بعد المعالجة (10–30 دقيقة): TestFlight ← Internal Testing ← مجموعة + إضافة نفسك ← تطبيق TestFlight على iPhone/iPad. الاختبار الداخلي لا يمر بمراجعة Beta ولا يُنشر للعامة.
8. شراء Pro داخل TestFlight يحتاج Paid Apps Agreement + المنتج `nova.docs.pro.lifetime`؛ دونهما يعمل التطبيق وتعرض شاشة Pro «App Store غير متاح». مشتريات TestFlight مجانية (بيئة Sandbox).
