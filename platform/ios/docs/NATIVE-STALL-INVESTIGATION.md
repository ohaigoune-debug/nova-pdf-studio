# Native checking/navigation stall investigation — 26 October 2026

After server deployment, the owner reports an indefinitely checking native account
gate, flickering/hidden interface, and nonresponding login controls. Screenshots
IMG_6662/IMG_6663 show the checking gate and the real /ios document with a broken
logo. These are device-reported failures; do not mark authenticated native use passed.

Normal-TLS checks with the study-only presentation cookie verified matching CSP
and HTML script nonces, the PNG logo and two JS bundles returning 200 with the
correct MIME types. A normal Chromium browser successfully followed the public
login link to /login?next=/ios. This is not WKWebView or an authenticated login.

A real public, unauthenticated Simulator navigation regression was added in source
e3aa1e6. Run 40405503078 is the unmodified-app reproduction run; its final result is
not yet known in this record. Existing offline AR/FR/EN cases remain separate from
this explicitly networked public test. The new case enters no credentials, submits
no forms and tests only the home/login/native tab controls. CI retains genuine
Simulator xcresult diagnostics for one day; it does not sign/upload from that job.

Identified native code paths addressed by the Build 2 candidate:

- Coalesce overlapping ordinary identity refreshes instead of restarting the check
  and hiding the snapshot for every page-finished/retry callback.
- Supersede/cancel an old check when cookies or app foreground context change;
  debounce a cookie burst for 150 ms. Clear personal data before suspension, retain
  UUID/server checks and generation guards; no authentication/entitlement bypass.
- Bound the overall checking period to 25 seconds without extending it for every
  overlapping event. Timeout locks data and shows the existing retry state; stale
  completions cannot reactivate a previous account.
- Bound the WebKit cookie callback wait to 5 seconds with a one-shot continuation.
  Missing/repeated/late callbacks are covered by three new core regression tests.
  Their actual execution is pending the candidate macOS run.
- Start the WebView once per AppModel lifetime; reappearance is not a cold reload.
- Keep a usable native sign-in control during checking and use an inline title on
  bookmarks/planner instead of the oversized unavailable-state header.
- Retry with reloadFromOrigin to revalidate resource caches after server updates.

Build number is incremented to 2. The unchanged Apple-OS-only encryption use is
recorded in Info.plist using the owner's already-approved exemption classification;
no new cryptography, third-party SDK or DRM was introduced. Existing signing Secrets
are reused only by the separate signed export job. Upload workflow still points to
the historical initial artifact until a successful replacement is selected.

Linux structural/tooling checks and diff checks pass; native candidate compilation,
public navigation test and iPhone retest are PENDING. These changes address concrete
unbounded/redundant paths but are not yet proof of the root cause of every reported
unresponsive button. No production server or database update accompanies this patch.
