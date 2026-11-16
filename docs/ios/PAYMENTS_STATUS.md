# حالة المدفوعات — NOVA Docs (iOS)

**القرار المعتمد (تحديثك بتاريخ 16 نوفمبر 2026 02:04):** Apple StoreKit 2 + App Store Connect **وحدهما** داخل iOS.

| البند | الحالة | الدليل / الملاحظة |
|---|---|---|
| Lemon Squeezy (API، Checkout، Webhooks، مفاتيح ترخيص، خادم، ربط استحقاقات، روابط خارجية) | **أُلغي — لم يُكتب أي سطر له** | `grep -ri lemon apps/ src/` لا يعيد شيئًا في الشيفرة. لا توجد شيفرة Lemon Squeezy لنسخة Windows أصلًا، فلا شيء عُزل أو حُذف. |
| منتج Pro | COMPLETE في الشيفرة | `nova.docs.pro.lifetime` — Non-Consumable — في `NovaStorePlugin.swift`، `lib/features.ts`، `NovaDocs.storekit` |
| السعر | PARTIAL | الهدف 4.99 USD مضبوط في ملف الاختبار المحلي `.storekit`. السعر الفعلي **يُحدد في App Store Connect** (لا يمكنني ضبطه دون حسابك). الواجهة تعرض `displayPrice` المحلي من StoreKit ولا تكتب أي سعر ثابت. |
| شاشة الترقية | COMPLETE | `src/features/Paywall.tsx` (لقطة: `e2e/out/iphone-04-paywall.png` + لقطة المحاكي `07-pro`) |
| الشراء | COMPLETE (StoreKit Testing) / BLOCKED (Sandbox) | شراء StoreKit 2 حقيقي في بيئة StoreKit Testing من Apple على محاكي iOS: **ناجح** (`test02`). لم يُجرَ شراء Sandbox (يتطلب Paid Apps Agreement + المنتج في App Store Connect). |
| التحقق من المعاملات | COMPLETE | يُمنح Pro فقط لـ `VerificationResult.verified` وبلا `revocationDate`؛ الحالة تُقرأ دائمًا من `Transaction.currentEntitlements` — المنطق في `NovaEntitlements.swift` ومختبر على StoreKit الحقيقي |
| المعاملات المعلّقة (Ask to Buy/SCA) | COMPLETE | `pending` لا يمنح شيئًا؛ الموافقة تفتح والرفض لا يفتح — **مختبر على StoreKit** (`test03`، `test04`) + عقد الواجهة |
| الإلغاء / الفشل | COMPLETE | `userCancelled` لا يمنح شيئًا (عقد الواجهة)؛ الشراء الفاشل لا يفتح — **مختبر على StoreKit** (`test06`) |
| الاسترداد وسحب الاستحقاق | COMPLETE | الاسترداد يسحب Pro — **مختبر على StoreKit** (`test05`)؛ الواجهة تقفل فورًا عند `entitlementsChanged`؛ زر «طلب استرداد» يفتح ورقة Apple الرسمية (غير مختبر) |
| استعادة المشتريات | COMPLETE (منطق) / PARTIAL (تشغيلًا) | شراء من جهاز آخر يظهر في الاستحقاقات — **مختبر على StoreKit** (`test07`)؛ `AppStore.sync()` نفسه يحتاج تسجيل دخول Apple فلم يُختبر |
| حماية الميزات المدفوعة | COMPLETE | بوابة مركزية `isFeatureAllowed` + فحص أصلي إضافي في Swift لـ OCR (`PRO_REQUIRED`). لا تحفظ الواجهة isPro كمصدر حقيقة. حدود صريحة: لا يوجد تطبيق محلي محصّن 100% على جهاز مكسور الحماية. |
| اختبار StoreKit المحلي (StoreKit Testing) | **COMPLETE — 7/7 ناجحة في CI** | هدف `AppTests` (SKTestSession + `NovaDocs.storekit`)؛ يعمل مع كل دفعة على محاكي iPhone 16 Pro Max. والـ Scheme يربط الملف نفسه للتشغيل اليدوي من Xcode |
| اختبار Sandbox | BLOCKED | يتطلب: Paid Apps Agreement فعّالة + منتج في App Store Connect + حساب Sandbox Tester |
| حساب Apple جاهز لاستلام الأرباح؟ | **غير معروف — يحتاجك** | انظر `APPLE_PAYMENTS_SETUP.md` (البنك الجزائري يجب التحقق منه، W-8BEN، Small Business Program) |

## اختبارات StoreKit الحقيقية (Apple StoreKit Testing — `ios/App/AppTests/StoreKitFlowTests.swift`) — 7/7
المنتج Non-Consumable بـ 4.99 وليس اشتراكًا · شراء موثّق يفتح · Ask to Buy معلّق ثم الموافقة تفتح · الرفض لا يفتح · الاسترداد يسحب · الفشل لا يفتح · شراء من جهاز آخر يُعترف به. (التفاصيل والأزمنة في `TEST_RESULTS.md` §8.)

## اختبارات عقد StoreKit في الواجهة (`tests/pro-store.test.ts` — 13/13 ناجحة)
1. Free: القراءة/التوقيع/الأدوات الأساسية مفتوحة، والمحترفة مقفلة.
2. Pro يفتح كل شيء والقائمتان لا تتداخلان.
3. البداية مقفلة مع عرض السعر المحلي (مثال: `600,00 DA`).
4. `require()` يفتح شاشة الترقية للميزة المقفلة.
5. شراء موثّق يفتح Pro ويغلق الشاشة.
6. `pending` و`cancelled` و`unverified` لا تفتح شيئًا.
7. شراء معلّق يُعتمد لاحقًا يفتح Pro عبر التحديثات.
8. الاسترداد يقفل فورًا.
9. الاستعادة: «تمت» مقابل «لا شيء للاستعادة».
10. خطأ StoreKit لا يفتح شيئًا أبدًا.
11. منع شراء مزدوج متزامن.
12. المنتج غير متاح ← «App Store غير متاح» + إعادة المحاولة (بدل «جارٍ التحميل» إلى الأبد — خطأ اكتُشف على المحاكي).
13. StoreKit لا يرد ← «غير متاح» بعد 10 ث، والسعر المتأخر يظهر.
