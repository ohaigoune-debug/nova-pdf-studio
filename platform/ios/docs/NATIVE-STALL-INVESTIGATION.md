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

## Verified 27 October 2026 — internal replacement upload

Source 48d1d888838b43dfa121a5130631f2a004cd946b: macOS Simulator run
40406930734 completed successfully, including Debug, Release, core/native UI and
public unauthenticated WebKit navigation. Baseline run 40405503078 also passed;
the device failure was not reproduced in this public navigation case. Signed
archive/export run 40406930730 succeeded. These results do not establish successful
authenticated sessions or resolution on the owner's iPhone.

The owner authorized proceeding with internal Build 2 on 27 October. The upload
workflow selects only the existing signed artifact from run 40406930730, with
bundle/version/build assertions. Artifact ID 12690069380; artifact ZIP SHA-256
 d360a0fb59a1cace57db6506152f7c91ed9dde56b51dc0249001cb109ce877da.
Apple upload/processing/group availability remain pending at this commit. No new
tester, App Review submission, server deployment or database change is authorized
by this workflow. Update through TestFlight and retest login/navigation on device.

## Completed upload and internal availability

On 27 October 2026, upload run 40457792781 / job 122035069116 succeeded:
IPA metadata assertion passed; altool VERIFY SUCCEEDED and UPLOAD SUCCEEDED with
no errors. Delivery/build UUID fea85afe-3b2e-4518-8227-bf6d1b85e44a.
App Store Connect then showed Build 2 Ready to Test. Added only this build to the
existing Madrasadz Internal group ac16c2d4-e99a-4d94-8b53-e71cd5fb39ca.
The refreshed group visibly shows 1 Tester, 2 Builds, with 1.0.0 (2) Testing.
The existing sole tester is the owner; no tester was added or reinvited. No export
compliance prompt, new agreement, App Review submission or public release occurred.

Candidate macOS logs confirm 40 core XCTest tests and 3 offline UI tests passed;
the separate public WebKit navigation case also passed. Linux checks for this
upload change: bash -n upload-testflight.sh and git diff --check exit 0.
Device confirmation of the replacement, authenticated login, account switching,
video and PDF behavior is still pending. This is an internal test candidate.

## Build 3 candidate: device foreground blank document

Owner screenshots IMG_6665/IMG_6666 show an authenticated learning home with the
Arabic literature course card, followed by a blank document after leaving and
returning. The card is visible; following its protected course link is not yet
verified. No course visibility/entitlement or database change is made.

The old foreground handler required previous==background and phase==active;
background->inactive->active would skip it. The candidate records background
explicitly and restores the current allowed URL as a GET once on return, with
the existing WebKit data store and server authorization unchanged. This resets
page-local form/video state on return, a deliberate temporary reliability tradeoff.
A terminated WebKit content process gets at most one automatic recovery before
Retry. A navigation deadline prevents an unbounded blank/loading document; stale
navigation completions cannot settle a replacement request. The existing public
Simulator test now backgrounds/activates three times before login navigation.

Build number 3; compile, Simulator run, signing and device validation PENDING.
No production server or real database operations accompany this candidate.

### First foreground candidate failed; not uploaded

Source 9be0799, Simulator run 40463010411: Debug/Release and offline UI passed;
public test failed after the third background/activate cycle (assertion at line 29;
WebKit accessibility query stalled). Signed export 40463010445 passed, but this
artifact must NOT be uploaded. Reloading the same WKWebView was insufficient.
The revised candidate replaces the view attachment on foreground/renderer failure,
while retaining WKWebsiteDataStore.default() and all navigation/session checks.
Old view KVO/navigation callbacks are ignored, and SwiftUI keys the representable
to the new WebView identity. Page-local state and native web back history reset on
return; server cookies persist. Runtime validation of this revision is pending.
