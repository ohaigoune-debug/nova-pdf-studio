/** نصوص الخصوصية والشروط داخل التطبيق (النسخة الكاملة في site/nova-docs/privacy.html و terms.html). */
type Doc = { title: string; body: string[] }
type Lang = 'ar' | 'fr' | 'en'

export const LEGAL: Record<'privacy' | 'terms', Record<Lang, Doc>> = {
  privacy: {
    en: {
      title: 'Privacy policy',
      body: [
        'NOVA Docs is built to work entirely on your device. We do not collect, store or transmit your documents, scans, invoices, customers or any personal data.',
        'Files you open or create stay in the app’s folder on your iPhone or iPad (visible in the Files app) or in the location you choose, such as your own iCloud Drive.',
        'Text recognition (OCR) runs on the device with Apple Vision or the built-in offline engine. Nothing is uploaded.',
        'The camera is used only when you start a scan. Images are processed on the device.',
        'Purchases are processed by Apple. We do not receive your payment details. The app only reads the verified purchase status from StoreKit on your device.',
        'The app contains no advertising, no analytics and no third-party tracking SDKs.',
        'If you contact support by email, we only use your message to answer you.'
      ]
    },
    ar: {
      title: 'سياسة الخصوصية',
      body: [
        'صُمّم NOVA Docs ليعمل بالكامل على جهازك. لا نجمع مستنداتك أو صور المسح أو الفواتير أو بيانات العملاء أو أي بيانات شخصية، ولا نخزنها ولا نرسلها.',
        'تبقى الملفات التي تفتحها أو تنشئها في مجلد التطبيق على آيفون أو آيباد (ويظهر في تطبيق «الملفات») أو في الموقع الذي تختاره مثل iCloud Drive الخاص بك.',
        'يعمل التعرّف الضوئي على النصوص (OCR) على الجهاز عبر Apple Vision أو المحرك المدمج دون إنترنت. لا يُرفع أي شيء.',
        'تُستخدم الكاميرا فقط عندما تبدأ المسح، وتُعالج الصور على الجهاز.',
        'تعالج Apple عمليات الشراء، ولا نتلقى بيانات الدفع. يقرأ التطبيق فقط حالة الشراء الموثّقة من StoreKit على جهازك.',
        'لا يحتوي التطبيق على إعلانات ولا أدوات تحليل ولا أي تتبّع من أطراف ثالثة.',
        'إذا راسلت الدعم عبر البريد فنستعمل رسالتك فقط للرد عليك.'
      ]
    },
    fr: {
      title: 'Politique de confidentialité',
      body: [
        'NOVA Docs fonctionne entièrement sur votre appareil. Nous ne collectons, ne stockons et ne transmettons ni vos documents, ni vos scans, factures, clients ou données personnelles.',
        'Vos fichiers restent dans le dossier de l’app sur votre iPhone ou iPad (visible dans l’app Fichiers) ou à l’emplacement que vous choisissez, comme votre iCloud Drive.',
        'La reconnaissance de texte (OCR) s’exécute sur l’appareil avec Apple Vision ou le moteur intégré hors ligne. Rien n’est envoyé.',
        'La caméra n’est utilisée que lorsque vous lancez un scan. Les images sont traitées sur l’appareil.',
        'Les achats sont traités par Apple. Nous ne recevons pas vos données de paiement ; l’app lit uniquement le statut d’achat vérifié par StoreKit.',
        'Aucune publicité, aucune analyse, aucun traceur tiers.',
        'Si vous écrivez au support, votre message sert uniquement à vous répondre.'
      ]
    }
  },
  terms: {
    en: {
      title: 'Terms of use',
      body: [
        'NOVA Docs is licensed, not sold, under Apple’s Standard Licensed Application End User License Agreement (EULA).',
        'NOVA Pro is a one-time, non-consumable in-app purchase that unlocks the pro features on the devices using the same Apple ID. It can be restored at any time with “Restore purchases”. Refunds are handled by Apple.',
        'You are responsible for the content of the documents and invoices you create, including tax and legal requirements in your country.',
        'Editing adds layers on top of PDF pages; existing text is covered and replaced visually, not rewritten inside the original file.',
        'The app is provided “as is”. Keep backups of important documents.'
      ]
    },
    ar: {
      title: 'شروط الاستخدام',
      body: [
        'يُرخَّص NOVA Docs ولا يُباع، وفق اتفاقية ترخيص المستخدم النهائي القياسية من Apple (EULA).',
        'NOVA Pro شراء داخل التطبيق لمرة واحدة (غير قابل للاستهلاك) يفتح الميزات الاحترافية على الأجهزة التي تستخدم حساب Apple نفسه، ويمكن استعادته في أي وقت عبر «استعادة المشتريات». تتولى Apple طلبات الاسترداد.',
        'أنت مسؤول عن محتوى المستندات والفواتير التي تنشئها، بما في ذلك المتطلبات الضريبية والقانونية في بلدك.',
        'التحرير يضيف طبقات فوق صفحات PDF: النص الموجود يُغطّى ويُستبدل بصريًا ولا يُعاد كتابته داخل الملف الأصلي.',
        'يُقدَّم التطبيق «كما هو». احتفظ بنسخ احتياطية لمستنداتك المهمة.'
      ]
    },
    fr: {
      title: 'Conditions d’utilisation',
      body: [
        'NOVA Docs est concédé sous licence, et non vendu, selon le contrat de licence standard d’Apple (EULA).',
        'NOVA Pro est un achat intégré unique (non consommable) qui débloque les fonctions pro sur les appareils utilisant le même identifiant Apple. Il peut être restauré à tout moment. Les remboursements sont gérés par Apple.',
        'Vous êtes responsable du contenu des documents et factures que vous créez, y compris des obligations fiscales et légales de votre pays.',
        'L’édition ajoute des calques sur les pages : le texte existant est masqué et remplacé visuellement, pas réécrit dans le fichier d’origine.',
        'L’app est fournie « en l’état ». Conservez des sauvegardes de vos documents importants.'
      ]
    }
  }
}

export function legalDoc(doc: 'privacy' | 'terms', language: string): Doc {
  const lang: Lang = language === 'ar' || language === 'fr' ? language : 'en'
  return LEGAL[doc][lang]
}
