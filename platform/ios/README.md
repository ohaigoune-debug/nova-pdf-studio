# مدرسة — مشروع iPhone

تطبيق SwiftUI مع WKWebView يعيد استعمال خادم Next.js وحسابات المنصة. مشروع Xcode الفعلي هو `Madrasadz.xcodeproj`، والمخطط المشترك `Madrasadz`. لا يحوّل الموقع إلى static export ولا يحتوي خادمًا أو قاعدة حسابات أخرى.

هذا الفرع مخصص للتجهيز والمراجعة. **لا يتضمن رفعًا إلى TestFlight أو App Store، ولا ينشر أي تغيير على خادم المنصة.** راجع [تدقيق المنصة](docs/AUDIT-AR.md)، و[ملاحظات App Review](docs/APP-REVIEW-AR.md)، و[بيانات المتجر بالعربية والفرنسية](docs/STORE-LISTING-AR-FR.md)، و[إفصاحات الخصوصية](docs/PRIVACY-DISCLOSURES-AR.md)، و[مصفوفة اختبار الأجهزة](docs/DEVICE-TEST-MATRIX.md)، و[قائمة تجهيز الإصدار](docs/RELEASE-CHECKLIST.md)، و[مصادر Apple](docs/APPLE-SOURCES.md).

## متطلبات Mac

- macOS مع Xcode **26 أو أحدث** وSDK **iOS 26 أو أحدث** وأدوات Command Line Tools المحددة: `xcode-select -p`. صيغة المشروع نفسها متوافقة مع Xcode 16، لكن ذلك لا يفي بمتطلبات التوزيع الحالية. يبقى أقل نظام تشغيل للتطبيق iOS 17.
- iPhone Simulator مثبت من Xcode Settings → Components؛ أقل نظام مستهدف iOS 17.
- مشروع iPhone فقط؛ `TARGETED_DEVICE_FAMILY = 1`. لا يعلن دعم iPad أو Mac Catalyst.
- لا تحتاج عضوية Apple Developer نشطة أو Team ID لبناء Simulator غير موقّع.
- الاختبار على iPhone فعلي والتوقيع والتوزيع تحتاج إعداد Apple المناسب لاحقًا.

## الإعدادات العامة

`Configuration/Base.xcconfig` يحدد:

- Bundle Identifier المقترح `com.madrasadz.student`. فُحصت النصوص الحالية في المستودع دون تعارض بهذا الاسم؛ **لم يُحجز لدى Apple**، ويجب التأكد من توفره في حساب المطوّر.
- Version `1.0.0` وBuild `1`، قابلان للتعديل في `MARKETING_VERSION` و`CURRENT_PROJECT_VERSION`.
- عنوان HTTPS الافتراضي `https://madrasadz.com` ومسار البداية `/ios`.
- مسار واضح وثابت للاستخدام الدراسي؛ الشراء الرقمي والأكواد والمنتدى غير المدعوم ليست آلية خفية تتغير أثناء مراجعة Apple.

للتوقيع المحلي لاحقًا، انسخ المثال؛ الملف المحلي متجاهل في Git:

```bash
cd platform/ios
cp Configuration/Local.xcconfig.example Configuration/Local.xcconfig
open Madrasadz.xcodeproj
```

يمكن وضع Team ID ومعرّف الحزمة في `Local.xcconfig`، وهما ليسا شهادة توقيع. **لا تضع مفاتيح `.p8` أو `.p12` أو كلمات مرور أو أسرار خادم في المشروع.** تغيير العنوان إلى staging يتطلب نطاق HTTPS موثوقًا ومطابقة سياسة URL الأصلية واختبارها؛ لا تضف استثناء ATS أو تجاوز شهادات لتشغيل عنوان غير جاهز.

خطة مطابقة الخادم المعزول وعوائقها في [ISOLATED-VALIDATION.md](docs/ISOLATED-VALIDATION.md).

إذا لم تُنشر مسارات iOS الجديدة على الخادم بعد، فإن النسخة الحالية من الموقع قد لا تخدم `/ios` أو واجهاتها الجديدة. هذا لا يُعالَج بحذف فحص الجلسات أو بتجاوز الصلاحيات؛ يلزم اختبار الخادم المطابق في بيئة HTTPS معزولة، ثم موافقة منفصلة على نشره لاحقًا.

## تجهيز الأيقونة والبناء غير الموقّع

تحتوي الموارد على الشعار الفعلي من `platform/public/brand/`، ورمز iOS مشتق بصريًا منه، بخلفية زرقاء معتمة. أصل الأيقونة المولّد مقاسه 1254×1254؛ أداة Apple `sips` تعيد تحجيمه إلى 1024×1024 بلا قناة ألفا عند البناء. لا يوجد اعتماد على خدمة توليد صور وقت البناء.

يشغّل build phase «Prepare opaque AppIcon» التحضير قبل تجميع الموارد. للتشغيل الصريح والنتيجة القابلة للفحص:

```bash
cd platform/ios
bash scripts/prepare-assets.sh
python3 scripts/validate-project.py --require-generated-app-icon
bash scripts/check-xcode.sh
bash scripts/build-unsigned.sh Debug
```

الأمر الأخير يستدعي فعليًا:

```bash
xcodebuild \
  -project Madrasadz.xcodeproj \
  -scheme Madrasadz \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build
```

لبناء Release غير موقّع للمحاكي:

```bash
bash scripts/build-unsigned.sh Release
```

لفتح التطبيق على محاكي، اختر جهاز iPhone في Xcode ثم Run. أو بعد بناء Debug شغّل محاكيًا واختر UUID من `xcrun simctl list devices available`:

```bash
xcrun simctl boot SIMULATOR_UUID
xcrun simctl bootstatus SIMULATOR_UUID -b
xcrun simctl install SIMULATOR_UUID DerivedData/Build/Products/Debug-iphonesimulator/Madrasadz.app
xcrun simctl launch SIMULATOR_UUID com.madrasadz.student
```

استبدل `SIMULATOR_UUID` بمعرّف جهاز مثبت، ومعرّف الحزمة إذا غيّرته. بناء المحاكي لا ينتج IPA صالحًا للتوزيع على iPhone.

## الاختبارات

اختبارات الحزمة الأصلية المستقلة:

```bash
swift test --package-path Packages/MadrasadzCore
```

اختبارات iPhone Simulator وSwift package معًا:

```bash
bash scripts/test-ios.sh
# أو اختيار محاكي محدد مثبت:
bash scripts/test-ios.sh SIMULATOR_UUID Debug
# فحص حزمة Swift في Release وبناء test bundle أيضًا؛ حالات الواجهة المعزولة Debug-only وستُتخطى:
bash scripts/test-ios.sh auto Release
```

يختار السكربت محاكي iPhone متاحًا بأحدث runtime مثبت (iOS 17+) عند عدم إعطاء UUID، ويرفض UUID غير موجود أو جهاز iPad أو runtime أقدم، ويكتب نتائج Xcode في `build/SimulatorTests-{Debug|Release}-*.xcresult`. فتحها في Xcode يوضح ما اختُبر فعليًا. حالات UI الحالية ثلاث لغات (ar/fr/en) لواجهة أصلية غير مسجلة وبدون شبكة عبر وسيط `--madrasadz-offline-shell-validation` المحصور في `#if DEBUG`. لا يفتح حسابًا أو يقرأ مفضلة محفوظة أو يزوّر خادم جلسات. يرفض مسار المتصفح فتح/إعادة تحميل صفحات في هذا الوضع. في Release يُترجم الوضع إلى false وتتخطى اختبارات الواجهة هذه الحالات صراحةً قبل تشغيل التطبيق؛ لا يُعد هذا اختبار واجهة Release. اللقطات تُرفق بـxcresult فقط عند التنفيذ الفعلي، وليست دليلًا على الدروس أو الجلسات.

اختبارات UI لا تُعد إثباتًا لاختبار حساب مدفوع أو فيديو حقيقي أو SMS إلا إذا نُفذت تلك الحالات نفسها وسُجلت نتائجها.

عند اختبار الجلسات فعليًا على Mac أو جهاز، سجّل نتائج: تسجيل الدخول، إعادة الفتح، تسجيل الخروج، انتهاء الجلسة، تبديل المستخدم، بوابة الهاتف، استرجاع كلمة السر، والصلاحيات على محتوى مجاني ومقيّد. لا تضع بيانات حسابات أو رموز OTP في لقطات أو سجلات مرفوعة. اختبر التذكير بطلب إذن المستخدم بعد إجراء صريح، ثم إلغاءه عند حذف المهمة والخروج.

## ما يمكن فحصه على Linux

```bash
python3 scripts/validate-project.py
bash -n scripts/check-xcode.sh scripts/prepare-assets.sh scripts/build-unsigned.sh scripts/test-ios.sh
python3 scripts/test_tooling.py
swift test --package-path Packages/MadrasadzCore  # إذا توفر Swift متوافق على Linux
```

المدقّق يقرأ صيغة OpenStep للمشروع ويتحقق من المراجع والمخطط والملفات والأصول وATS وملفات plist/XML. قبل macOS يسمح بأصل الأيقونة المرفق؛ خيار `--require-generated-app-icon` يتطلب تصدير 1024×1024. **نجاحه ليس نجاح Xcode build أو محاكاة iOS أو توقيعًا أو قبولًا من Apple.** لا تتوفر SwiftUI وWebKit وUIKit على Linux، ولا يمكن بناء تطبيق iPhone كامل أو إنشاء IPA به.

## الموارد والخصوصية

- `Resources/Assets.xcassets`: AppIcon وBrandLogo وAccentColor.
- `Resources/LaunchScreen.storyboard`: إطلاق بسيط بخلفية فاتحة والشعار دون معلومات حساب.
- `Resources/{ar,fr,en}.lproj`: الموارد المحلية، مع RTL بحسب اللغة.
- لا توجد أذونات كاميرا أو ميكروفون أو صور أو موقع في Info.plist. طلب التذكير المحلي يتم عبر UserNotifications عند اختيار الطالب فقط.
- ATS لا يسمح بتحميل HTTP عشوائي ولا يتجاوز TLS.
- `PrivacyInfo.xcprivacy` يعلن عدم وجود tracking domains وrequired-reason APIs/SDK collection إضافية في الطبقة الأصلية الحالية. **المصفوفات الفارغة لا تعني أن المنصة لا تجمع بيانات**؛ حسابات الخادم والمحتوى التعليمي ونشاط WebView تحتاج إفصاح App Privacy وسياسة خصوصية وفق السلوك الفعلي. يجب تحديث manifest إذا أضيف SDK أو UserDefaults أو API تتطلب سببًا.
- تستخدم المصادقة جلسات الموقع الحالية عبر مخزن WebKit؛ لا تخزن كلمة السر أو تنسخ رمز الجلسة إلى إعدادات التطبيق. راجع تنفيذ التطبيق واختباراته وحدود التحقق في التسليم النهائي.
- المفضلة وخطة المراجعة بيانات محلية معزولة بالحساب. ملفات الدورات المقيدة والفيديو لا تتحول إلى مكتبة تنزيل تتجاوز سياسة الخادم.

### مشاركة ملف مسموح به

عندما يسمح الخادم بتنزيل مادة PDF ويظل الحساب مخوّلًا بالوصول إليها، يمكن مشاركة نسخة مؤقتة عبر أدوات iOS. يعيد مسار التصدير التحقق من الجلسة والاشتراك وإذن التنزيل والاتفاقات المطلوبة؛ لا تكفي معرفة رابط الملف أو معرّفه. يتحقق التطبيق من الرد ونوع PDF وهوية الحساب، ويرفض الملف الذي يزيد على **25MiB**.

هذه ليست مكتبة دروس تعمل دون اتصال: توضع النسخة في مجلد مؤقت محمي ومعزول بالحساب، ويجري مسحها بعد إنهاء المشاركة أو تغيير سياق الحساب أو إعادة تشغيل المصدّر. لا تُصدّر الفيديوهات أو الملفات التي منع الخادم تنزيلها، ولا يُشارك رابط عرض موقّع بدل الملف. إذا اختار المستخدم حفظ نسخة مسموحة في تطبيق آخر عبر ورقة المشاركة، لا يستطيع التطبيق سحب تلك النسخة الخارجية لاحقًا؛ لا ندّعي منع النسخ أو تصوير الشاشة منعًا مطلقًا.

## التوقيع والأرشفة لاحقًا — دون رفع

متطلبات Apple المفحوصة في 26 أكتوبر 2026: التوزيع منذ 28 أبريل 2026 يحتاج Xcode 26+ وSDK iOS 26+. راجع [المصدر الرسمي](https://developer.apple.com/news/upcoming-requirements/?id=04282026a). حُذف `ITSAppUsesNonExemptEncryption=false` الافتراضي؛ يجب حسم إجابات export compliance مع المالك قبل الأرشفة/التوزيع، ولا توجد إجابة إعفاء مفترضة في الحزمة.

بعد تفعيل العضوية، يفحص المالك Bundle ID في Apple Developer وApp Store Connect ويختار Team وملف التزويد المناسب في Signing & Capabilities. لا تستخدم `-allowProvisioningUpdates` تلقائيًا في هذا الفرع.

لتحضير Archive محلي بعد إكمال التوقيع، دون أي رفع:

```bash
bash scripts/prepare-assets.sh
xcodebuild \
  -project Madrasadz.xcodeproj \
  -scheme Madrasadz \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Madrasadz.xcarchive \
  archive
```

هذا الأمر لم يُنفذ على Linux. الأرشفة الموقعة وتصدير IPA وTestFlight تتطلب تحقق Mac وحساب Apple وإعدادات التوزيع؛ لا توجد خطوة رفع آلية أو شهادة أو API key في المستودع.

## CI

`.github/workflows/ios.yml` يعمل فقط عبر `workflow_dispatch`. لا يبدأ عند push أو PR، ولم يُشغّل لمجرد إضافة الملف. إذا اختار المالك تشغيله فإنه يستخدم macOS، يفحص إصدار Xcode وSDK، ويبني Debug وRelease للمحاكي دون توقيع ويشغّل اختبارات Debug المعزولة؛ لا يرفع التطبيق إلى Apple أو ينشر خادمًا أو يضيف أداة تتبع. تشغيل hosted macOS قد يستهلك حصة حساب GitHub، ولذلك بقي التشغيل يدويًا.

## حدود الجاهزية

المشروع يحتاج تنفيذ الفحوص الفعلية على Xcode، واختبار جلسات WKWebView وفيديو وملفات وحسابات الصلاحيات على iPhone، ثم حسم نموذج الشراء ومتطلبات المجتمع والخصوصية ومعلومات المتجر قبل التقديم. تفعيل Apple Developer وTeam ID والتوقيع والمنتجات إن اختير StoreKit ليست مكتملة بمجرد وجود مشروع Xcode.
