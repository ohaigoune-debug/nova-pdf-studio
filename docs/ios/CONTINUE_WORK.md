# تعليمات الاستئناف — NOVA Docs (iOS)

## البيئة
- الفرع: `feature/nova-docs-ios` · PR مسودة: https://github.com/ohaigoune-debug/nova-pdf-studio/pull/95
- التطبيق: `apps/nova-docs/` (مستقل عن حزمة Windows؛ لا يغيّر `package.json` الجذري).

```bash
# على أي جهاز (Linux/macOS/Windows) — الويب والاختبارات
cd apps/nova-docs
npm ci
node scripts/copy-assets.mjs        # WASM + حزم OCR + الخط العربي + pdf.js cmaps
npm run typecheck && npm test       # 45 اختبارًا (منها دقة OCR الحقيقية)
npm run build && npx vite preview --port 4173 &
node e2e/smoke.mjs                  # 12 خطوة واجهة في Chrome (يتطلب google-chrome)

# macOS فقط
npx cap sync ios && python3 scripts/patch-xcode-project.py
open ios/App/App.xcodeproj
```

## إعادة توليد الأصول
- الأيقونة وشاشة الإطلاق وأيقونات الموقع: `node scripts/generate-brand-assets.mjs` (من `brand/nova-icon.svg`).
- ترجمات أذونات iOS: `python3 scripts/ios-localize.py` ثم `python3 scripts/patch-xcode-project.py`.
- صفحات الخصوصية/الشروط/الدعم من نصوص التطبيق: `node scripts/build-site-legal.mjs`.
- صور اختبار OCR: `python3 tests/fixtures/make_fixtures.py`.

## CI
- `NOVA Docs iOS` يعمل تلقائيًا على كل push للفرع: فحوص Windows + اختبارات التطبيق + بناء Xcode حقيقي + لقطات محاكٍ (NOVA_ROUTE في نسخة Debug فقط).
- النتائج واللقطات تُنشر في فرع `ci/nova-docs-ios-results` (و Artifacts).
- TestFlight: سير العمل اليدوي `NOVA Docs → TestFlight (manual)` بعد إضافة الأسرار.

## الأولويات التالية (مرتبة)
1. على جهاز حقيقي: الماسح (VisionKit)، Apple Pencil، المشاركة، AirPrint، «فتح في»، تصدير الفاتورة PDF.
2. Sandbox: شراء/إلغاء/معلّق/استعادة/استرداد (بعد Paid Apps Agreement).
3. تحرير صفحات مدوّرة بدقة؛ كتابة العربية المضافة كنص حقيقي (خط مضمّن + تشكيل) بدل الصورة.
4. الجداول: تنسيق الخلايا، «فاتورة من جدول».
5. استيراد الفواتير القديمة: رسم مناطق يدوي كما في Windows.
6. اختبارات e2e إضافية للجداول والنسخ الاحتياطي.
7. نشر `site/nova-docs` على نطاق تختاره (بموافقتك) وتعبئة روابط الدعم/الخصوصية في App Store Connect.

## قواعد ثابتة
- لا Lemon Squeezy ولا أي دفع خارجي داخل iOS.
- لا تعديل في `platform/`.
- لا أسرار في GitHub (كلها GitHub Secrets / Xcode).
- لا تقديم للمراجعة ولا إطلاق تجاري دون موافقة صريحة.
