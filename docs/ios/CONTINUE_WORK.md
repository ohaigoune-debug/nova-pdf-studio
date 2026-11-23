# تعليمات الاستئناف — NOVA Docs (iOS)

## البيئة
- الفرع: `feature/nova-docs-ios` · PR مسودة: https://github.com/ohaigoune-debug/nova-pdf-studio/pull/95
- التطبيق: `apps/nova-docs/` (مستقل عن حزمة Windows؛ لا يغيّر `package.json` الجذري).

```bash
# على أي جهاز (Linux/macOS/Windows) — الويب والاختبارات
cd apps/nova-docs
npm ci
node scripts/copy-assets.mjs        # WASM + حزم OCR + الخط العربي + pdf.js cmaps
npm run typecheck && npm test       # 87 اختبارًا (منها دقة OCR والأداء وإصلاح العربية)
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
- TestFlight: إيداع على الفرع رسالته تحوي `[testflight]` (بناء 1.0.0 عادي) أو `[testflight-tester]` (0.9.0، Pro مفتوح، للتجربة فقط). دفع الوسوم مرفوض من بيئة العمل. الأسرار الأربعة موجودة.

## الأولويات التالية (مرتبة) — آخر تحديث 17 نوفمبر 07:40 الجزائر
تم (لا تُعِده): كل ما في MORNING_REPORT §1 و§10b، منها إصلاح العربية في الملفات بلا خطوط، 13 خطًا، لوحة تنسيق النص، خطوط المستند، سحب النص، البائع، 162 عملة، أسماء الملفات، أزرار النوافذ، الإصدار الحقيقي.

1. **تأكيدات المالك على 0.9.0 (11):** العربية على كتبه (الخباش)، سحب النص، لوحة التنسيق، الدمج. أي لقطة جديدة منه = أولوية أولى.
2. **بعد الاتفاقية والمنتج:** بناء 1.0.0 جديد (`[testflight]`) ← شراء واستعادة في Sandbox على TestFlight ← تحديث PAYMENTS_STATUS.
3. **مواد المتجر:** إعادة توليد لقطات المتجر من مشاهد المحاكي بميزات 16 نوفمبر؛ اسم تجريبي بديل لـ«ليلى مراد» (بموافقة المالك لأن البيانات مشتركة مع Windows)؛ ملاحظات المراجِع.
4. ممكن على Linux + CI:
   - إصلاح العربية في **المصغّرات** (`PagesSheet`) بالمسار نفسه (`renderPageRepaired`).
   - تنزيل خطوط Google Fonts عند الطلب لمطابقة خط المستند تمامًا (يتطلب قرار خصوصية: اتصال بخوادم Google؛ يُذكر في سياسة الخصوصية).
   - الجداول: تحديد نطاق متعدد الخلايا باللمس، وارتفاع الصفوف.
   - استيراد الفواتير القديمة: رسم مناطق يدوي كما في Windows.
5. على الجهاز فقط: الماسح VisionKit، Apple Pencil، المشاركة، AirPrint، «فتح في»، دقة Apple Vision OCR، قفل التطبيق، زمن المرشحات.
6. نشر `site/nova-docs` بعد موافقة المالك وتعبئة روابط الدعم/الخصوصية في App Store Connect.

## قواعد ثابتة
- لا Lemon Squeezy ولا أي دفع خارجي داخل iOS.
- لا تعديل في `platform/`.
- لا أسرار في GitHub (كلها GitHub Secrets / Xcode).
- لا تقديم للمراجعة ولا إطلاق تجاري دون موافقة صريحة. لا دمج لـ #95 دون موافقة (المالك اختار «لا تدمج الآن»، 16 نوفمبر).
- بناءات 0.9.0 (`NOVA_TESTER_PRO`) لا تُقدَّم للمراجعة أبدًا.
