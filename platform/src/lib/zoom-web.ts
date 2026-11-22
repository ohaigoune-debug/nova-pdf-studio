/**
 * نسخة Zoom Meeting SDK للويب التي تُحمَّل من خادم Zoom (source.zoom.us) في صفحة الحصة /live/[id].
 * Client View: صفحة الاجتماع الكاملة، وهي المخصّصة للهاتف (Component View للحاسوب فقط).
 * تحتاج React 18 عبر خريطة استيراد (importmap) كما في مثال Zoom الرسمي؛ تطبيقنا يبقى على React 19.
 * للترقية: غيّر الرقم هنا فقط (وراجع ملاحظات الإصدار).
 */
export const ZOOM_WEB_SDK_VERSION = '6.10.0'

export const ZOOM_CLIENT_VIEW_URL = `https://source.zoom.us/${ZOOM_WEB_SDK_VERSION}/esm/client-view.es.min.js`

export const ZOOM_IMPORT_MAP = {
  imports: {
    react: 'https://esm.sh/react@18.3.1',
    'react-dom': 'https://esm.sh/react-dom@18.3.1?deps=react@18.3.1',
    'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1'
  }
}

/** لغة واجهة Zoom: لا عربية فيها، والفرنسية أقرب للتلميذ الجزائري */
export const ZOOM_UI_LANG = 'fr-FR'
