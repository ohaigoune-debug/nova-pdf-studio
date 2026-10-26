# iPhone validation matrix

Status after follow-up review (2026-10-26): **Linux source preparation; no Xcode, simulator, physical iPhone, signed build or IPA was available.** Every device row below is PENDING, not passed and not failed. Fill the actual build SHA, OS/device, tester, timestamp and evidence path when executed. A JavaScript unit test or source inspection does not mark a WKWebView/device row passed.

## Execution record

| Environment | Status |
|---|---|
| Source/security review | Performed; see AUDIT-AR.md and VALIDATION.md |
| Server/PGlite tests, TypeScript, lint and Next build | PASS on Linux: 661 tests / 102 files; TypeScript/lint/Next build exit0; see VALIDATION.md |
| Earlier separate Linux session (`7c5b223`) | Full suite 661/661 and platform checks passed; Swift unavailable in that session. Its original detailed record is preserved in VALIDATION.md |
| Linux Swift package rerun | BLOCKED by signal-4 process crash; serial retry compiled/linked but suite did not complete. Historical 37-pass result was not reproduced; see VALIDATION.md |
| Linux build-tooling regression tests | PASS: 12 Python tests; CLI fixtures only, not Xcode |
| macOS unsigned Xcode build (Debug / Release) | BLOCKED: this execution host is Linux; Xcode absent |
| XCTest / iPhone simulator | PENDING: three disconnected Debug shell locale tests prepared but not executed |
| Physical iPhone | PENDING |
| TestFlight | NOT UPLOADED; pending signing/membership and validation |
| App Store submission | NOT SUBMITTED; payment/privacy/deletion decisions remain |

## Required cases

| Case | Expected behavior | Simulator | Device |
|---|---|---|---|
| Cold start / reopen | Branded launch, meaningful loading; no indefinite blank WebView | PENDING | PENDING |
| New registration | Existing account server flow, phone gate where configured, no native bypass | PENDING | PENDING |
| Existing login | Real WebKit cookie accepted by the server; same account in native session probe | PENDING | PENDING |
| Kill and relaunch | Session continuity follows server expiry/revocation; no native password storage | PENDING | PENDING |
| Free account | Only public/free and entitled content; locked course stays locked | PENDING | PENDING |
| Entitled account | Authorized lessons/quizzes/video display; no entitlement invented in native code | PENDING | PENDING |
| Expired/revoked session | Account data hidden, native identity cleared, reauthentication offered | PENDING | PENDING |
| Confirmed logout | Server session revoked, cookies/storage purged, local account data and reminders removed | PENDING | PENDING |
| Offline logout attempt | No false server-success claim; clear retry/local lock distinction | PENDING | PENDING |
| Account A → B | No bookmarks/tasks/reminders of A visible to B, including during loading | PENDING | PENDING |
| Password recovery | Email/phone route works; universal/external links handled without losing safety | PENDING | PENDING |
| Password reset elsewhere | Old session rejected on refresh/foreground; no stale study data exposure | PENDING | PENDING |
| Account deletion | In-app route reaches actual confirmation; server session and native state clear after deletion | PENDING | PENDING |
| Offline/online transition | Useful failure message/retry, recovery without duplicate state changes | PENDING | PENDING |
| Arabic keyboard | RTL text, long labels, keyboard avoidance; phone/OTP order remains usable | PENDING | PENDING |
| French/English | Existing locale navigation retained; native labels follow chosen/device localization policy | PENDING | PENDING |
| Accessibility | VoiceOver order/labels, large Dynamic Type, touch targets, contrast and reduced motion | PENDING | PENDING |
| Sizes / rotation | Small iPhone and modern Dynamic Island, safe areas, portrait/landscape, no clipped controls | PENDING | PENDING |
| Native bookmarks | Add/open/delete real allowlisted content links; no exp/sig/reset-token or arbitrary URL storage | PENDING | PENDING |
| Link sharing | Shares canonical study link only; protected signed file URLs cannot be exported | PENDING | PENDING |
| Revision tasks | Add/edit/complete/delete, persist within the correct account, validate bounds | PENDING | PENDING |
| Reminder opt-in | Permission requested on choice, denied state useful, scheduling/edit/delete correct; maximum 50 local reminders enforced | PENDING | PENDING |
| Reminder logout cleanup | Pending/delivered notifications and account state cleaned according to implementation | PENDING | PENDING |
| PDF viewer | Online-authorized PDF renders; no offline course library or video-export feature | PENDING | PENDING |
| Explicit PDF export allowed | Download request reaches dedicated server route; valid STUDENT cookie, phone gate, content/terms access, READY, allowDownload=true, PDF MIME and <=25 MiB checked; valid account echo then iOS share sheet | PENDING | PENDING |
| PDF export permission false | File may be viewed where authorized, but allowDownload=false prevents native export; no temporary share copy survives denial | PENDING | PENDING |
| PDF export expired/revoked | Expired session/subscription or revoked content access rejects export; stale signed/view URLs cannot bypass checks | PENDING | PENDING |
| Account switch during PDF export | Generation/account UUID guard prevents a reply for A from opening after switching to B; temporary bytes are deleted | PENDING | PENDING |
| PDF cleanup and bounds | Reject wrong MIME/magic/oversize/mismatched account/redirect; share completion, context change, logout and relaunch remove app temporary copies | PENDING | PENDING |
| Authorized external PDF copy | UI explains that an intentionally exported copy outside the app cannot be recalled later; no absolute anti-copy promise | PENDING | PENDING |
| Uploaded video | Play/pause/seek/fullscreen/audio/interruption and server permission checks | PENDING | PENDING |
| Bunny/YouTube | Third-party player iframe works while main-frame bridge remains untrusted to it | PENDING | PENDING |
| Video rotation | Fullscreen landscape works; note whether HTML watermark remains visible | PENDING | PENDING |
| External/new-window links | Trusted content stays internal; allowed external links use appropriate iOS presentation | PENDING | PENDING |
| Dangerous URL / bridge | Reject untrusted origins, subframes, malformed commands and unsupported schemes | PENDING | PENDING |
| iOS scope policy | Commerce, code activation and UGC cannot reappear by deep link, redirect, RSC/prefetch or in-site navigation; /ios presentation cookie is not authorization and public web without it remains unchanged | PENDING | PENDING |

## Evidence rules

- Use isolated test accounts/data and a staging server with explicit authorization; do not seed or migrate production for screenshots.
- Do not put student PII, cookies, reset/OTP codes, signed media URLs or credentials in logs/images or Git.
- A production read-only public HTTP check is not an authenticated device test or evidence of production SHA.
- Capture real app screens only after they run; do not use generated brand mockups as execution evidence or App Store screenshots.
- Record defects and limitations. Screen-recording or HTML watermark tests cannot prove absolute anti-piracy.

## Follow-up source changes (2026-10-26)

- Remote PR #26 was open/Draft, branch `codex/ios-app-foundation`, with HEAD
  `a957eac6f1731e2e7b949f5e0749d93fb6befb2e` at the start of this follow-up.
- Linux tooling cases cover unsupported toolchain/SDK, strict simulator UUIDs,
  runtime/device availability and explicit Debug/Release configuration. The fake CLI
  metadata in those unit tests is not evidence that macOS/Xcode exists.
- Three native UI cases now cover AR/FR/EN signed-out tabs/account/error/retry states
  without backend traffic in Debug. They remain PENDING. Their future XCTest screenshot
  attachments must be labeled disconnected shell, not authenticated course evidence.
- Release has no offline test flag and these UI cases skip before launch in Release.
  Neither a Release build nor Release interface validation was executed here.
- Production URL trust and all access/session/PDF restrictions remain unchanged.
- ISOLATED-VALIDATION.md records the unsatisfied HTTPS test-backend requirements.
- No runtime screenshot, native PDF share, Bunny playback, VoiceOver or actual
  notification permission/delivery result is available from this Linux session.


## Later macOS signing evidence — 26 October 2026

- Historical Linux-only preparation records above remain historical.
- Simulator run `40350226821` on `f089e8625d0eb54301d0eb2212b3a7f42615348f`:
  Debug/Release builds PASS, 37 package tests PASS, 3 disconnected Debug language
  cases PASS (AR/EN/FR); no authenticated backend or paid video case covered.
- Signed Release device archive and IPA export PASS on Xcode 26.6, source
  `b3a268c27166c36fab858550ae4d124a686bcda1`, run `40373277061`.
- Physical-device rows, authenticated sessions, accessibility, real video/PDF and
  reminders remain PENDING. No signed IPA was installed or launched on an iPhone.
- TestFlight: NOT UPLOADED; new API-access authorization is pending.
- See VALIDATION.md for failed first attempt, fix, commands, artifact metadata and
  exact boundaries. The signed build result does not overwrite device-test rows.
