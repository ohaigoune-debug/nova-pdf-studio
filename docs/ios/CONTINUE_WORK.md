# تعليمات الاستئناف — NOVA Docs (iOS)

## البيئة
- الفرع: `feature/nova-docs-ios` · PR مسودة: https://github.com/ohaigoune-debug/nova-pdf-studio/pull/95
- التطبيق: `apps/nova-docs/` (مستقل عن حزمة Windows؛ لا يغيّر `package.json` الجذري).

```bash
# على أي جهاز (Linux/macOS/Windows) — الويب والاختبارات
cd apps/nova-docs
npm ci
node scripts/copy-assets.mjs        # WASM + حزم OCR + الخط العربي + pdf.js cmaps
npm run typecheck && npm test       # 57 اختبارًا (منها دقة OCR والأداء)
npm run build && npx vite preview --port 4173 &
node e2e/smoke.mjs                  # 13 خطوة واجهة في Chrome (يتطلب google-chrome)

# macOS فقط
npx cap sync ios && python3 scripts/patch-xcode-project.py
open ios/App/App.xcodeproj
# اختبارات StoreKit الحقيقية (StoreKit Testing، بلا حساب):
cd ios/App && xcodebuild test -project App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' CODE_SIGNING_ALLOWED=NO
```

## إعادة توليد الأصول
- الأيقونة وشاشة الإطلاق وأيقونات الموقع: `node scripts/generate-brand-assets.mjs` (من `brand/nova-icon.svg`).
- ترجمات أذونات iOS: `python3 scripts/ios-localize.py` ثم `python3 scripts/patch-xcode-project.py`.
- صفحات الخصوصية/الشروط/الدعم من نصوص التطبيق: `node scripts/build-site-legal.mjs`.
- صور اختبار OCR: `python3 tests/fixtures/make_fixtures.py`.

## CI
- `NOVA Docs iOS` يعمل تلقائيًا على كل push للفرع: فحوص Windows + اختبارات التطبيق + بناء Xcode حقيقي (Debug محاكٍ + Release جهاز) + لقطات محاكٍ (NOVA_ROUTE عبر WKUserScript في نسخة Debug فقط) + 7 اختبارات StoreKit.
- حالة التشغيل: `gh api repos/ohaigoune-debug/nova-pdf-studio/commits/<sha>/check-runs` (واجهة Actions API محجوبة في بيئة العمل؛ check-runs تعمل).
- النتائج واللقطات تُنشر في فرع `ci/nova-docs-ios-results` (و Artifacts).
- TestFlight: سير العمل اليدوي `NOVA Docs → TestFlight (manual)` بعد إضافة الأسرار.

## الأولويات التالية (مرتبة) — آخر تحديث 16 نوفمبر ~08:00 الجزائر
تم (لا تُعِده): التحرير على الصفحات المدوّرة (والطبقة العربية عليها)، تنسيق خلايا الجداول، الدمج وعرض الأعمدة، فاتورة من جدول، قفل التطبيق، تحسين ذاكرة/زمن المرشحات، مرشحات المسح الجديدة، طبقة بحث للنص العربي المضاف، الكلمات اللاتينية في OCR العربي، أمان الاستعادة، رقم الفاتورة عند الاستيراد، اختبارات StoreKit 7/7، مشاهد المحاكي الذاتية (OCR، تصدير الفاتورة، مراجعة المسح).

1. **على جهاز حقيقي (يحتاج المالك/TestFlight):** الماسح VisionKit، Apple Pencil، المشاركة، AirPrint، «فتح في»، دقة Apple Vision OCR، الأداء والذاكرة.
2. **Sandbox** بعد Paid Apps Agreement والمنتج في App Store Connect.
3. ممكن على Linux + CI:
   - قراءة نتيجة مشهد CI رقم 16 (زمن المرشحات داخل WKWebView) وتسريع المعاينة بدقة أقل إن تجاوزت ~1.5 ث للصفحة.
   - قفل التطبيق: **مبني** (`NovaLockPlugin.swift`، `features/AppLock.tsx`) — يبقى اختباره على جهاز.
   - الجداول: تحديد نطاق متعدد الخلايا باللمس، وارتفاع الصفوف.
   - استيراد الفواتير القديمة: رسم مناطق يدوي كما في Windows.
   - مراجعة اللقطات: بيانات تجريبية بلا أسماء أشخاص حقيقيين (قرار المالك، لأنها مشتركة مع Windows).
4. نشر `site/nova-docs` بعد موافقة المالك وتعبئة روابط الدعم/الخصوصية في App Store Connect.

## قواعد ثابتة
- لا Lemon Squeezy ولا أي دفع خارجي داخل iOS.
- لا تعديل في `platform/`.
- لا أسرار في GitHub (كلها GitHub Secrets / Xcode).
- لا تقديم للمراجعة ولا إطلاق تجاري دون موافقة صريحة.
