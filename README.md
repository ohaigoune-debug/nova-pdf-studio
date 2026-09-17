# NOVA PDF Studio

**PDF Editor • Smart Invoice • Spreadsheet • Documents** — free, local-first, 14 languages.

[**⬇ Download for Windows 10/11**](https://github.com/ohaigoune-debug/nova-pdf-studio/releases/latest) · [Release notes](RELEASE_NOTES.md) · [Architecture](ARCHITECTURE.md) · MIT License

Nova PDF is a desktop app that edits PDFs, runs offline OCR (Arabic/French/English), builds smart invoices with integer-safe money math and premium templates, converts old PDF invoices into structured ones, and includes an Excel-like spreadsheet studio. Everything runs on your machine: no account, no internet, no data leaves your computer. The interface is available in Arabic and Persian (full RTL), French, English, Spanish, German, Italian, Portuguese, Turkish, Russian, Chinese, Japanese, Hindi and Indonesian.

> The installer is not code-signed yet. If Windows SmartScreen shows "Unknown publisher", click **More info → Run anyway**.

---

منصة مكتبية متكاملة تعمل محليًا بالكامل (Local-first): قراءة وتعديل PDF، فواتير ذكية بحسابات دقيقة
بوحدات مالية صحيحة، جداول شبيهة بـ Excel، تعرّف ضوئي على النصوص (عربية/فرنسية/إنجليزية)، وطباعة وتصدير.

## ما الذي يفعله

- **PDF**: عارض سريع (صفحات كسولة، بحث، مصغرات، إشارات)، تعديل بطبقة Overlay (نص، صور/توقيع/ختم، أشكال، تظليل، تبييض، تحرير النص الأصلي بالنقر)، أدوات (دمج/تقسيم/استخراج/حذف/ترتيب/تدوير/علامة مائية/ترقيم/ضغط/تحويل إلى صور ونص)، طباعة وتصدير عبر محرك Chromium بحروف عربية صحيحة.
- **OCR بلا إنترنت**: tesseract.js بحزم لغة محلية (عربية/فرنسية/إنجليزية) داخل `resources/tessdata`؛ النص يصبح قابلًا للبحث والنسخ داخل العارض ويُحفظ في قاعدة البيانات، مع تصدير PDF قابل للبحث بطبقة نص خفية.
- **الفواتير الذكية**: عملاء ومنتجات وضرائب وعملات، شبكة بنود بإكمال تلقائي ولصق من Excel، محرك حساب مركزي بوحدات صحيحة (لا أعداد عشرية)، مدفوعات جزئية ورصيد متبقٍ، المبلغ بالحروف (ar/fr/en)، ترقيم تلقائي، قوالب طباعة بمصمم سحب وإفلات، QR، توقيع وختم، سلة محذوفات، حالات (مسودة/مرسلة/مدفوعة/جزئية/متأخرة).
- **PDF → فاتورة ذكية**: كشف تلقائي لرقم الفاتورة والتواريخ والعميل والمجاميع والبنود (عربي/فرنسي/إنجليزي)، رسم مناطق استخراج مع أعمدة البنود، تحققات حسابية، حفظ كقالب استخراج يُتعرَّف عليه تلقائيًا، واستيراد مجموعة ملفات كمسودات.
- **استوديو الجداول**: محرك صيغ خاص (SUM/AVERAGE/MIN/MAX/COUNT/IF/ROUND…)، شبكة افتراضية بواجهة RTL، تنسيق وأوراق متعددة وتراجع/إعادة، استيراد/تصدير Excel وCSV، طباعة وPDF، إنشاء فاتورة من جدول وتصدير بنود الفاتورة إلى جدول.
- **المنصة**: تبويبات كالمتصفح، لوحة أوامر Ctrl+K مع بحث شامل، إشعارات، سمات فاتحة/داكنة، قفل برمز PIN، نسخ احتياطي تلقائي واسترجاع، سجل تدقيق، ملاحظات ومرفقات وحقول مخصصة، مسودات استرجاع تلقائية، بيانات تجريبية، معالج أول تشغيل.

## التشغيل من المصدر

المتطلبات: Node.js 20+ (جُرّب على 24) ونظام Windows 10/11.

```bash
npm install
npm run dev
```

## البناء والتغليف

```bash
npm run typecheck   # فحص الأنواع للعمليتين
npm test            # اختبارات محرّك المال والترقيم وغيرها
npm run build       # حزم الإنتاج في out/
npm run dist        # مثبّت Windows (NSIS) في release/
```

## البنية

راجع [ARCHITECTURE.md](ARCHITECTURE.md): وحدات معزولة في `src/modules/<name>/{main,renderer,shared}`،
عقد IPC مكتوب بالأنواع في `src/shared/ipc.ts`، SQLite محلي مع ترحيلات، ومحرّك مالي بلا أعداد عشرية.

## المنصة التعليمية (platform/)

يحتوي المستودع أيضاً على مشروع مستقل في المجلد [`platform/`](platform/README.md): منصة ويب عربية (Next.js + PostgreSQL) لتعليم اللغة والأدب العربي للثانوي والبكالوريا، متعددة الأساتذة، مع إدارة الأفواج، التسجيل بأكواد، الحضور الذكي بـ QR، وقاعدة الغيابات. راجع [`platform/docs/ARCHITECTURE.md`](platform/docs/ARCHITECTURE.md). تطبيق Nova PDF المكتبي لم يتغيّر.

## اللغات

14 لغة مضمّنة تتغيّر فورًا من الإعدادات بلا إعادة تشغيل: العربية والفارسية (RTL كامل)، الفرنسية، الإنجليزية، الإسبانية، الألمانية، الإيطالية، البرتغالية، التركية، الروسية، الصينية المبسّطة، اليابانية، الهندية، الإندونيسية.
ملفات الترجمة في `src/modules/translations/renderer/locales/` (1233 نصًا لكل لغة، يُتحقق من تطابق المفاتيح والعناصر النائبة).
تسميات الفاتورة المطبوعة والمبلغ بالحروف متوفرة بالعربية/الفرنسية/الإنجليزية، وتُستخدم الإنجليزية لبقية اللغات (ويمكن تعديل التسميات من مصمّم القالب).

## البيانات والخصوصية

كل شيء يُخزَّن في `%APPDATA%\nova-pdf-studio\data\` (قاعدة بيانات SQLite، النسخ الاحتياطية، المستندات المولَّدة).
لا يُرفع أي ملف إلى الإنترنت.
