package dz.madrasa.confirm;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

/**
 * تطبيق عامل التأكيد في منصة «مدرسة».
 *
 * نشاط واحد يفتح صفحات /worker داخل WebView: الدخول بالهاتف وكلمة السر، الحجوزات، «اتصل»، النتيجة،
 * والبحث والتفعيل. كل منطق العمل والصلاحيات في الخادم، فأي تحسين يصل العمّال فورًا بلا تحديث للتطبيق.
 *
 * ما يضيفه التطبيق على المتصفح:
 *  - «اتصل» يطلب الرقم مباشرة (إذن CALL_PHONE)، فيكفي العامل لمسة واحدة مع سماعات الأذن.
 *  - عند الرجوع من المكالمة يُبلَّغ الموقع (حدث madrasa:resume) فتظهر لوحة «نتيجة المكالمة».
 *  - يبقى داخل نطاق المنصة؛ أي رابط آخر (واتساب، موقع خارجي) يُفتح في تطبيقه.
 */
public class MainActivity extends Activity {

    private static final int REQ_CALL = 41;
    private static final String OFFLINE_HTML =
            "<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{font-family:sans-serif;background:#f5f8fb;color:#0b1220;display:flex;min-height:100vh;"
            + "align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}"
            + "a{display:inline-block;margin-top:16px;background:#1d8f7f;color:#fff;padding:14px 28px;border-radius:12px;"
            + "text-decoration:none;font-weight:bold;font-size:18px}</style></head><body><div>"
            + "<h2>تعذّر الاتصال بالمنصة</h2><p>تأكّد من الإنترنت ثم أعد المحاولة.</p>"
            + "<a href='%s'>أعد المحاولة</a></div></body></html>";

    private WebView web;
    private ProgressBar progress;
    private String pendingNumber;
    private OnBackInvokedCallback backCallback;
    private boolean backRegistered;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F5F8FB"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));
        setContentView(root);
        applyInsets(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " MadrasaConfirm/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    progress.setVisibility(View.GONE);
                    view.loadDataWithBaseURL(null, String.format(OFFLINE_HTML, BuildConfig.START_URL), "text/html", "utf-8", null);
                }
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                updateBackCallback();
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BuildConfig.START_URL);
        setupBack();
    }

    /** المنصة داخل التطبيق؛ الاتصال يُطلب مباشرة؛ كل ما سوى ذلك في تطبيقه */
    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("tel")) {
            call(uri.getSchemeSpecificPart());
            return true;
        }
        if ((scheme.equals("https") || scheme.equals("http")) && isOurHost(uri.getHost())) return false;
        openExternal(uri);
        return true;
    }

    private boolean isOurHost(String host) {
        if (host == null) return false;
        String h = host.toLowerCase();
        return h.equals(BuildConfig.HOST) || h.endsWith("." + BuildConfig.HOST);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // لا تطبيق يفتح هذا الرابط: يُتجاهل بهدوء
        }
    }

    /** اتصال مباشر إن أُذن به، وإلا تُفتح لوحة الأرقام والرقم مكتوب فيها */
    private void call(String number) {
        String clean = number == null ? "" : number.replaceAll("[^0-9+]", "");
        if (clean.isEmpty()) return;
        if (checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
            startCall(clean, true);
        } else {
            pendingNumber = clean;
            requestPermissions(new String[] {Manifest.permission.CALL_PHONE}, REQ_CALL);
        }
    }

    private void startCall(String number, boolean direct) {
        Uri tel = Uri.fromParts("tel", number, null);
        try {
            startActivity(new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, tel));
        } catch (ActivityNotFoundException | SecurityException e) {
            if (direct) startCall(number, false);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CALL || pendingNumber == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        String number = pendingNumber;
        pendingNumber = null;
        startCall(number, granted);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // الرجوع من المكالمة: الصفحة تفتح لوحة «نتيجة المكالمة» للزبون الأخير
        web.evaluateJavascript("window.dispatchEvent(new Event('madrasa:resume'))", null);
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (backRegistered && Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        web.destroy();
        super.onDestroy();
    }

    /* ───── زر الرجوع: صفحة سابقة داخل المنصة، وإلا يُغلق التطبيق ───── */

    private void setupBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = () -> {
                if (web.canGoBack()) web.goBack();
                updateBackCallback();
            };
            updateBackCallback();
        }
    }

    /** أندرويد 13+: يُسجَّل الاعتراض ما دام في السجلّ صفحة سابقة فقط، فيبقى رجوع النظام التنبّئي سليمًا */
    private void updateBackCallback() {
        if (Build.VERSION.SDK_INT < 33 || backCallback == null) return;
        boolean want = web.canGoBack();
        if (want && !backRegistered) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
            backRegistered = true;
        } else if (!want && backRegistered) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backRegistered = false;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /*
     * ───── الحواف ─────
     * التطبيق يستهدف أندرويد 16، فيُرسَم على أندرويد 15+ تحت شريطي الحالة والتنقّل ولا يتقلّص مع لوحة المفاتيح:
     * تُترك مسافتها يدويًّا. الأقدم يتكفّل بها النظام (adjustResize والسمة).
     */
    private void applyInsets(View root) {
        if (Build.VERSION.SDK_INT < 35) return;
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsets.CONSUMED;
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
