# حالة المدفوعات — NOVA Docs (iOS)

**القرار المعتمد (تحديثك بتاريخ 16 نوفمبر 2026 02:04):** Apple StoreKit 2 + App Store Connect **وحدهما** داخل iOS.

| البند | الحالة | الدليل / الملاحظة |
|---|---|---|
| Lemon Squeezy (API، Checkout، Webhooks، مفاتيح ترخيص، خادم، ربط استحقاقات، روابط خارجية) | **أُلغي — لم يُكتب أي سطر له** | `grep -ri lemon apps/ src/` لا يعيد شيئًا في الشيفرة. لا توجد شيفرة Lemon Squeezy لنسخة Windows أصلًا، فلا شيء عُزل أو حُذف. |
| منتج Pro | COMPLETE في الشيفرة | `nova.docs.pro.lifetime` — Non-Consumable — في `NovaStorePlugin.swift`، `lib/features.ts`، `NovaDocs.storekit` |
| السعر | PARTIAL | الهدف 4.99 USD مضبوط في ملف الاختبار المحلي `.storekit`. السعر الفعلي **يُحدد في App Store Connect** (لا يمكنني ضبطه دون حسابك). الواجهة تعرض `displayPrice` المحلي من StoreKit ولا تكتب أي سعر ثابت. |
| شاشة الترقية | COMPLETE | `src/features/Paywall.tsx` (لقطة: `e2e/out/iphone-04-paywall.png` + لقطة المحاكي `07-pro`) |
| الشراء | PARTIAL | Swift يجمع وينجح بناؤه (Xcode 26.3). لم يُجرَ شراء Sandbox حقيقي (يتطلب Paid Apps Agreement). |
| التحقق من المعاملات | COMPLETE (تصميمًا) / PARTIAL (تشغيلًا) | يُمنح Pro فقط لـ `VerificationResult.verified` وبلا `revocationDate`؛ الحالة تُقرأ دائمًا من `Transaction.currentEntitlements` |
| المعاملات المعلّقة (Ask to Buy/SCA) | COMPLETE (منطق) | `pending` لا يمنح شيئًا؛ الفتح يأتي لاحقًا عبر `Transaction.updates` — مختبر بإضافة وهمية |
| الإلغاء | COMPLETE (منطق) | `userCancelled` لا يمنح شيئًا — مختبر |
| الاسترداد وسحب الاستحقاق | COMPLETE (منطق) | حدث `entitlementsChanged` بـ `isPro=false` يقفل فورًا — مختبر؛ زر «طلب استرداد» يفتح ورقة Apple الرسمية |
| استعادة المشتريات | COMPLETE (منطق) / PARTIAL (تشغيلًا) | `AppStore.sync()` ثم الاستحقاقات الموثّقة — مختبر بإضافة وهمية |
| حماية الميزات المدفوعة | COMPLETE | بوابة مركزية `isFeatureAllowed` + فحص أصلي إضافي في Swift لـ OCR (`PRO_REQUIRED`). لا تحفظ الواجهة isPro كمصدر حقيقة. حدود صريحة: لا يوجد تطبيق محلي محصّن 100% على جهاز مكسور الحماية. |
| اختبار StoreKit المحلي (Xcode) | جاهز | Scheme `App` يربط `NovaDocs.storekit` (يُفتح من Xcode ← Run) |
| اختبار Sandbox | BLOCKED | يتطلب: Paid Apps Agreement فعّالة + منتج في App Store Connect + حساب Sandbox Tester |
| حساب Apple جاهز لاستلام الأرباح؟ | **غير معروف — يحتاجك** | انظر `APPLE_PAYMENTS_SETUP.md` (البنك الجزائري يجب التحقق منه، W-8BEN، Small Business Program) |

## اختبارات عقد StoreKit المنفذة فعليًا (`tests/pro-store.test.ts` — 11/11 ناجحة)
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
