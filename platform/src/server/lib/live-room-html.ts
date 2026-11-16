/**
 * صفحة الحصة المباشرة داخل المنصة: HTML مستقل (بلا React المنصة) يحمّل Zoom Meeting SDK للويب
 * (Client View) من CDN الخاص بـ Zoom وينضمّ بالتوقيع الذي ولّده الخادم. دوال نقية تُختبر وحدويًّا.
 *
 * لماذا صفحة مستقلة: مكتبة Zoom تحمل React 18 الخاص بها وتحتاج سياسة CSP أوسع من بقية الموقع
 * (انظر src/lib/live-room.ts)، فعزلها في صفحة وحدها يحمي بقية المنصة ولا يثقل حزمها.
 */
import type { ZoomRoomConfig } from '@/server/services/live.service'

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** JSON داخل <script type="application/json">: لا يُغلق الوسم ولا يُفسَّر كـ HTML */
function safeJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

const BASE_STYLE = `
  html,body{margin:0;height:100%;background:#0b1424;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .mdz-wait{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;z-index:2147483646;background:#0b1424}
  .mdz-wait h1{font-size:20px;margin:0}
  .mdz-wait p{margin:0;opacity:.85;font-size:15px;line-height:1.7;max-width:34rem}
  .mdz-wait a,.mdz-wait button{display:inline-block;margin-top:6px;padding:10px 18px;border-radius:10px;border:0;background:#c9a227;color:#0b1424;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer}
  .mdz-spin{width:38px;height:38px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#c9a227;animation:mdz 1s linear infinite}
  @keyframes mdz{to{transform:rotate(360deg)}}
`

/** صفحة الانضمام. السكربت المضمّن يقرأ الإعداد من وسم JSON ولا يضع أي قيمة داخل الشيفرة نفسها. */
export function renderLiveRoomHtml(cfg: ZoomRoomConfig): string {
  const v = encodeURIComponent(cfg.sdkVersion)
  const lib = `${cfg.cdn}/${v}/lib`
  const data = {
    v: cfg.sdkVersion,
    lib,
    lang: cfg.lang,
    signature: cfg.signature,
    meetingNumber: cfg.meetingNumber,
    passcode: cfg.passcode,
    userName: cfg.userName,
    coursePath: cfg.coursePath
  }
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(cfg.title)} — حصة مباشرة</title>
<link rel="stylesheet" href="${cfg.cdn}/${v}/css/bootstrap.css">
<link rel="stylesheet" href="${cfg.cdn}/${v}/css/react-select.css">
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="mdz-wait" id="mdz-wait" role="status" aria-live="polite">
  <div class="mdz-spin" id="mdz-spin"></div>
  <h1 id="mdz-title">${esc(cfg.title)}</h1>
  <p id="mdz-msg">جارٍ الدخول إلى الحصة المباشرة… اسمح للمتصفح باستعمال الميكروفون إن أردت المشاركة بالصوت.</p>
  <p style="font-size:13px">${esc(cfg.courseTitle)}</p>
  <a id="mdz-back" href="${esc(cfg.coursePath)}" style="display:none">العودة إلى الدورة</a>
  <button type="button" id="mdz-retry" style="display:none">إعادة المحاولة</button>
</div>
<script type="application/json" id="mdz-cfg">${safeJson(data)}</script>
<script src="${lib}/vendor/react.min.js"></script>
<script src="${lib}/vendor/react-dom.min.js"></script>
<script src="${lib}/vendor/redux.min.js"></script>
<script src="${lib}/vendor/redux-thunk.min.js"></script>
<script src="${lib}/vendor/lodash.min.js"></script>
<script src="${cfg.cdn}/zoom-meeting-${v}.min.js"></script>
<script>${LIVE_ROOM_BOOT_JS}</script>
</body>
</html>`
}

/**
 * تشغيل Client View: preLoadWasm → prepareWebSDK → لغة الواجهة → init → join.
 * الحصة تخفي رقم الاجتماع ورمزه ورابط الدعوة (meetingInfo: العنوان والمضيف فقط، disableInvite).
 * أخطاء Zoom الشائعة تُترجم إلى رسالة عربية مع زر إعادة المحاولة.
 */
export const LIVE_ROOM_BOOT_JS = `(function(){
  var cfg = JSON.parse(document.getElementById('mdz-cfg').textContent);
  var wait = document.getElementById('mdz-wait');
  function fail(msg){
    document.getElementById('mdz-spin').style.display='none';
    document.getElementById('mdz-msg').textContent = msg;
    document.getElementById('mdz-back').style.display='inline-block';
    var r = document.getElementById('mdz-retry'); r.style.display='inline-block'; r.onclick=function(){ location.reload(); };
    wait.style.display='flex';
  }
  function reason(e){
    var code = e && (e.errorCode || e.code || (e.result && e.result.errorCode));
    var map = {
      3008: 'لم يبدأ الأستاذ الحصة بعد. أعد المحاولة بعد قليل.',
      3000: 'تعذّر الاتصال بالحصة. تحقّق من الإنترنت ثم أعد المحاولة.',
      3706: 'الحصة ممتلئة: بلغ عدد الحاضرين الحدّ الأقصى.',
      3707: 'الحصة ممتلئة: بلغ عدد الحاضرين الحدّ الأقصى.',
      3712: 'انتهت صلاحية الدخول. أعد فتح الحصة من صفحة الدورة.',
      3713: 'انتهت صلاحية الدخول. أعد فتح الحصة من صفحة الدورة.',
      200: 'هذه الحصة غير مهيّأة للدخول من المنصة. أبلغ الإدارة.',
      1: 'تعذّر تشغيل الحصة في هذا المتصفح. جرّب Chrome أو Safari محدَّثًا.'
    };
    return (code && map[code]) || ('تعذّر الدخول إلى الحصة' + (code ? ' (رمز ' + code + ')' : '') + '. أعد المحاولة.');
  }
  if (typeof ZoomMtg === 'undefined') { fail('تعذّر تحميل مكتبة الحصة. تحقّق من الإنترنت ثم أعد المحاولة.'); return; }
  var leaveUrl = new URL(cfg.coursePath, location.origin).href;
  var started = false;
  function start(){
    if (started) return; started = true;
    ZoomMtg.init({
      leaveUrl: leaveUrl,
      patchJsMedia: true,
      leaveOnPageUnload: true,
      disableCORP: !window.crossOriginIsolated,
      disableInvite: true,
      disableCallOut: true,
      disableRecord: true,
      isSupportChat: true,
      meetingInfo: ['topic', 'host'],
      success: function(){
        ZoomMtg.join({
          signature: cfg.signature,
          meetingNumber: cfg.meetingNumber,
          passWord: cfg.passcode,
          userName: cfg.userName,
          userEmail: '',
          success: function(){ wait.style.display='none'; },
          error: function(e){ fail(reason(e)); }
        });
      },
      error: function(e){ fail(reason(e)); }
    });
  }
  try {
    ZoomMtg.setZoomJSLib(cfg.lib, '/av');
    ZoomMtg.preLoadWasm();
    ZoomMtg.prepareWebSDK();
    ZoomMtg.i18n.load(cfg.lang);
    if (ZoomMtg.i18n.onLoad) ZoomMtg.i18n.onLoad(start);
    setTimeout(start, 6000);
  } catch (e) { fail(reason(e)); }
})();`

const ERROR_TEXT: Record<string, string> = {
  LIVE_NOT_OPEN: 'الحصة غير مفتوحة الآن. يُفتح الدخول قبل الموعد بـ15 دقيقة ويُغلق بعد نهاية الحصة بنصف ساعة، وبعد قبول شروط الدورة.',
  COURSE_NOT_ENROLLED: 'هذه الحصة لمشتركي الدورة فقط. فعّل اشتراكك أولًا.',
  LIVE_NOT_FOUND: 'لم نجد هذه الحصة.'
}

/** صفحة خطأ عربية بسيطة بنفس الهوية (لا سكربت فيها) */
export function renderLiveRoomError(code: string, backPath = '/student'): string {
  const msg = ERROR_TEXT[code] ?? 'تعذّر فتح الحصة الآن. أعد المحاولة بعد قليل.'
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>الحصة المباشرة</title>
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="mdz-wait" role="alert">
  <h1>الحصة المباشرة</h1>
  <p>${esc(msg)}</p>
  <a href="${esc(backPath)}">العودة</a>
</div>
</body>
</html>`
}
