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

### Revised candidate verified on hosted macOS

Source 3e6b4df8531dbf62039a5658dc1cc4a06efe6793, run 40464774168:
Debug/Release PASS, 40 core tests PASS, 3 offline AR/FR/EN UI cases PASS,
public WebKit test PASS after three background/activate cycles and login-link
navigation. Exported cycle-3 PNG was visually inspected: real learning home, logo,
login controls and public lessons visible. Earlier failed-run video extraction
(run 40464915440, artifact 12716625479) visually confirmed the blank document.
The failure was observed and the revised public regression passes; authenticated
physical-device recovery, course-detail access and media are still pending.

Signed archive/export run 40464774116 PASS. Selected artifact 12716446398:
SHA-256 cb667ac02c776cb97432d0b89a69eb08685f055d782a2b3c8b96ddb72a700a35.
The upload workflow pins only this revised artifact, not the failed 9be0799 build.
The existing upload key is reused to check processing and associate Build 3 only
with the existing internal group after verifying the app, no public link and
exactly the existing owner tester. No tester invitation or public release.
The helper uses two-minute in-memory JWTs, normal TLS and refuses redirects; key
cleanup remains in the upload script trap. Local disposable-key checks verified
100 ES256 round-trips; fixtures rejected an external group/wrong owner and
verified one successful assignment without making Apple requests. Bash syntax,
Python compile, project structure, 12 tooling tests and diff checks pass on Linux.
Apple upload/internal availability is pending at this commit.

### Build 3 available internally — verified 27 October 2026

Run 40466174770 / job 122061999288 completed successfully. Metadata assertion,
altool validation and upload PASS; delivery/build UUID
8899fa17-b697-477e-ab7f-9a8b2b9c77a0. At 07:21:44 UTC the API helper verified
VALID and IN_BETA_TESTING after checking app/group ownership, no public link and
the sole existing owner tester, adding the build and reading its group relation
and internal state back. No new invitation or App Review/public release.

Files changed for this repair: Configuration/Base.xcconfig; Sources/MadrasadzApp/
BrowserController.swift, MadrasadzApp.swift, StudyViews.swift; Tests/
MadrasadzUITests/MadrasadzUITests.swift; scripts/upload-testflight.sh and
enable-internal-build.py; .github/workflows/ios.yml, ios-signed.yml,
ios-testflight-upload.yml, ios-diagnostics.yml; README.md and these validation,
device-matrix/release-checklist documents. Native signed source remains 3e6b4df;
upload configuration source bea89e5. Commands on hosted Mac: build-unsigned.sh
Debug / Release, test-ios.sh auto Debug, test-public-navigation.sh, build-signed.sh
and upload-testflight.sh all PASS for the selected candidate. Local Linux Python
tooling/project validation, Python helper compile, bash -n and diff checks PASS;
no Linux iOS build or physical-device test is claimed. Platform/Android/.env,
production server and real database were not modified. Existing unrelated
untracked promotional video was preserved.

Verdict: updated owner-only internal candidate with a reproduced Simulator defect
and a passing revised regression. Still requires owner-device foreground/login
continuity, course detail/video/PDF and account-switch checks. Not App Review ready.

## Build 4 candidate: device black area persists in Build 3 — 27 October 2026

Owner report: Build 1.0.0 (3) is installed (version screenshot supplied). The
learning page shows, then after another app/app switcher the WebView area is
black while native toolbar/tabs stay visible; the switcher card still shows the
page. Device last recorded by App Store Connect: iPhone 13 Pro Max, iOS 27.0.1.
CI Simulator: macos-26 runner, Xcode 26.x, iOS 26.x runtime (the script now
prints the exact SDK/runtime/device/appearance). The Simulator never reproduced
real process suspension; its pass is not device evidence.

Root cause on the device is NOT proven (no device trace exists). Evidence:
the predecessor reproduced a blank document plus a stalled WebKit accessibility
query after repeated reloads (run 40463010411); Build 2 (view untouched) and
Build 3 (view always replaced) both failed on iOS 27.0.1. A comparable public
report exists on iOS 27.0.1 (Tuta issue 11585: white WKWebView after return even
without a termination callback). Code review of Build 3 found these concrete
defects, each consistent with a black area between native bars:

1. Every return destroyed the rendered document and showed a new, empty
   WKWebView (isOpaque=false, systemBackground: black in dark mode) for a cold
   renderer launch plus a cache-bypassing network load, with no native
   placeholder.
2. The replacement was loaded before it was attached to a window, during the
   scene transition. A renderer started for an off-window view can be suspended
   or reclaimed before first paint without any delegate callback.
3. The 30 s navigation deadline was armed only by didStartProvisionalNavigation;
   a load that never started stayed empty indefinitely with no Retry.
4. Nothing verified that the returned document actually rendered or responded.
5. makeUIView returned the controller-owned WKWebView (the concurrent capture
   work since wrapped it in a SwiftUI-owned container, which is kept).

`privacySensitive()` has no documented effect in an app scene and the Build 3
`.background` cover was SwiftUI-drawn above everything (it would also hide the
bars, which the owner sees); it did not affect the switcher card. Both are now
logged (redaction reasons, cover/shield state) so the device report can confirm
or exclude them. The concurrent capture work replaced that cover with an opaque
inactive/background cover and a native black WebView shield; neither existed in
the Build 3 binary the owner tested.

Build 4 changes (source: this commit; build number 4):

- Integrated on top of the concurrent capture-shield commits 6613f2c..196f027:
  SwiftUI owns one `MediaProtectionWebContainer` per WKWebView (keyed by view
  identity), so a replacement gets its own container and capture observer.
  Reattachment re-inserts the same view beneath the opaque shield and asks the
  shield to re-read scene facts (fail-closed). The shield's published state is
  logged on every change and in each foreground check, because a held black
  shield between the native bars is indistinguishable from the reported defect.
- Keep the rendered document on return (scroll/video/form state and history are
  preserved). 0.7 s after activation, verify it: window attachment, a 4 s
  liveness probe (constant boolean in WebKit's isolated `.defaultClient` world,
  no page data returned) and a 32x64 in-memory on-screen sample compared with a
  sample of the same view taken when the scene resigned active.
- Bounded ladder per return (MadrasadzCore `ForegroundRecoveryPlanner`, 11 new
  unit tests): keep → reattach the same view (WebKit re-evaluates window/scene
  visibility, non-destructive) → replace once with the same
  `WKWebsiteDataStore.default()` and GET the current allowed page only after the
  new view is attached → existing Retry. No loop, no periodic reload.
- Navigation deadline armed when the request is issued. A reclaimed renderer is
  replaced on Retry. Termination in background is recovered at activation.
- Native "restoring" placeholder only while a recovery step runs.
- Tester-only technical log (Debug/TestFlight receipt): lifecycle phases,
  window attach/detach, sizes, probe results, actions, navigation stages, HTTP
  status codes, error domain/code, memory warnings, dark mode and SwiftUI
  redaction reasons. No URLs/titles/text/cookies/tokens/credentials/account
  IDs/pixels. Stored in Caches, shown under Account → «تقرير تقني للاختبار»,
  shared manually by the tester only.
- Public UI regression now asserts on-screen pixels of the web area (the
  accessibility tree alone passed while the area could be blank), adds rapid
  repeated switching, runs in light and dark appearance, and attaches the Debug
  technical log.

Status at this commit: Linux syntax parse (tree-sitter-swift), project
validation, 12 tooling tests, shell/YAML syntax and diff checks PASS. Xcode
build, XCTest, Simulator, signing, upload and the owner-device test are PENDING;
this session had no push permission. Upload workflow and its Build 3 guards were
deliberately not changed: update them only after the Build 4 candidate passes.

### Independent review fixes (same day, before any upload)

A separate static review of the candidate found no compile errors (hosted
Debug/Release builds of ebfc11b confirmed this) and five runtime issues, now
fixed: (1) a return while Bookmarks/Planner is selected left the Study view off
window and walked the ladder to Retry — the check now waits for re-attachment;
(2) a navigation deadline started before backgrounding could fire on resume —
it is re-armed on return; (3) a pending page `confirm()` blocks WebKit's main
thread — the liveness probe treats that as responsive; (4) a fragment-only
same-document `open()` (e.g. profile `#delete`) got a 30 s deadline without any
WebKit finish event — no deadline for same-document loads; (5) recovery restores
only an allowed internal page, else `/ios`, and never leaves the placeholder set
while backgrounded/deferred. UI test: 4 consecutive painted samples (~2 s) with
no placeholder or Retry, and nearest-neighbour sampling.

### Hosted macOS results and Build 4 upload pin — 27 October 2026

- ebfc11b: unsigned run 40484092408 SUCCESS (Debug, Release, public foreground
  test light and dark, core + offline UI); signed run 40484092400 SUCCESS. Not
  uploaded (superseded by the review fixes).
- d584c16 (selected candidate): unsigned run 40485140870 SUCCESS — Debug
  build, Release build, public no-account foreground test in light appearance
  (3 cycles + 4 rapid switches, each requiring ~2 s of painted on-screen pixels
  with no placeholder/Retry) and in dark appearance, core package + offline UI
  (including the capture-shield fixtures). Signed run 40485140887 SUCCESS;
  artifact 12724139375 `Madrasadz-signed-IPA-d584c16…`,
  sha256:27841ef80df00381f0bcf7421387732e319c39e407a76ccbfbc1aa33a8d85ecd.
- Job logs and xcresult artifacts could not be downloaded from this session
  (blob storage 403), so per-test counts, the Simulator runtime line and the
  Debug technical-log attachment were not read here; results above are the
  GitHub step conclusions. The same runner image reported Xcode 26.6 /
  iPhoneSimulator 26.5 / iPhone Air iOS 26.5 in run 40481965732.
- The upload workflow, `upload-testflight.sh` (CFBundleVersion 4) and
  `enable-internal-build.py` (version 4) now pin only that artifact. The
  Simulator never suspended processes like the iPhone; device result PENDING.

### Build 4 available internally — 27 October 2026

Upload run 40488738563 / job 122137026635 (10:28–10:39 UTC) completed SUCCESS
on 0e183d3 with the pinned artifact 12724139375 (source d584c16). The step
includes the IPA assertion (com.madrasadz.student 1.0.0 (4)), altool
validate/upload and `enable-internal-build.py`, which exits non-zero unless the
build is VALID, assigned to the existing owner-only group (no public link, sole
owner tester) and reads back IN_BETA_TESTING. The job log could not be
downloaded here (403), so the Apple build UUID is not recorded. No tester,
invitation, App Review submission or public release. Owner-device foreground
test of 1.0.0 (4) is PENDING; follow the protocol in DEVICE-TEST-MATRIX.md and
share the «تقرير تقني للاختبار» text if the area turns black again.

## Build 4 owner-device log: root cause identified — 27 October 2026

The owner installed 1.0.0 (4) (iPhone14,3 = iPhone 13 Pro Max, iOS 27.0.1,
dark appearance) and shared the tester technical log after the WebView area
again stayed black — now behind the capture shield's stale «المحتوى مخفي أثناء
مغادرة التطبيق» message — for over 10 s while the app was active.

Evidence from the log, repeated on every transition:

- On resign: `ui.environment redaction=2` (SwiftUI `.privacy` redaction applied
  by the system to the app-wide `privacySensitive()`), then `web.detached
  size=0x0` and `web.attached size=375x577`: a new representable instance took
  the shared WKWebView (the visible host is 375x634).
- On activation: `web.detached size=375x634` with `container=false` and the
  published shield `reason=initializing attached=false`: that temporary
  instance was discarded and the WKWebView was orphaned (no superview, no
  window). The visible container kept its last shield state, because its
  refresh requires owning the view — exactly the screenshot. Builds 2/3 had no
  shield, so the same orphaning showed the empty host (black in dark mode)
  between the native bars, while the switcher snapshot (taken while the
  temporary instance held the view) still showed the page.
- After a real background, the Build 4 check found `attached=false`, reattach
  could not help (the view was not in the visible host), and the single
  replacement restored the page after ~1.5 s with web history reset (gray back
  button). After inactive→active without background (Control Center,
  Notification Center, switcher peek) Build 4 ran no check, so it stayed stuck.
- Script probe 0–33 ms, `terminated=false`, `document=true` throughout: the
  renderer was alive; this was not a WebKit process death or a slow network.

Build 5 fix (source: this commit, build number 5):

1. Remove the app-wide `privacySensitive()`; keep it on the personal
   Bookmarks and Planner lists. The opaque inactive cover and the native shield
   still hide content when the scene is not active.
2. `MediaProtectionWebContainer` never takes the shared WKWebView from a
   container that is on screen; the container that moves into a window claims
   it beneath its shield; a container leaving the window hands it back to an
   on-screen sibling (registry of live instances in `BrowserController`).
3. Recovery `reattach` moves the view into the on-screen container, so a
   detached/orphaned view is restored without reload or history loss.
4. Every activation (also inactive→active) runs one bounded check.

Diagnostics add `host.created` and `host.left-window handedBack=` events.
Device confirmation of Build 5 is PENDING.

### Build 5 hosted validation and upload pin

Source e9f291c: unsigned run 40492742751 SUCCESS (Debug, Release, public
foreground test light and dark, core + offline UI incl. capture-shield
fixtures); signed run 40492742830 SUCCESS, artifact 12729130441,
sha256:3910673b9149d2618a8b4865b49d2eea08d6030011744b5f8a78826fb978da1d. The
upload workflow and both build guards now pin Build 5 only. The Simulator did
not reproduce the device redaction/orphaning sequence; device result PENDING.

### Build 5 available internally

Upload run 40495265190 on 3793053 completed SUCCESS with the pinned artifact
12729130441 (source e9f291c): IPA assertion 1.0.0 (5), altool validate/upload,
and the owner-only group helper (VALID, assigned, IN_BETA_TESTING read back).
Job log not downloadable here (403). Owner-device retest of 1.0.0 (5) PENDING:
app switcher, Control Center/Notification Center, >5 min away, a lesson, and
the shared «تقرير تقني للاختبار» (expect `host.left-window handedBack=1` and
`fg.check ... attached=true ... action=keep`).
