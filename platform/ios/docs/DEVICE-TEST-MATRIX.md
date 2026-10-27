# iPhone validation matrix

Current status (27 October 2026): **Build 2 is available to the sole owner in internal TestFlight. Owner screenshots IMG_6665/IMG_6666 show the authenticated learning home and the Arabic literature course card, but a blank learning document after leaving and returning to the app. Foreground reliability FAILED on the owner's device.** Course detail/video/PDF behavior remains unverified. Build 3 recovery is a candidate under hosted macOS validation; it is not yet uploaded or device-proven. Use the latest dated evidence below; historical records remain for audit. A unit test does not establish a device pass.

## Execution record

| Environment | Status |
|---|---|
| Source/security review | Performed; see AUDIT-AR.md and VALIDATION.md |
| Server/PGlite tests, TypeScript, lint and Next build | PASS on Linux: 661 tests / 102 files; TypeScript/lint/Next build exit0; see VALIDATION.md |
| Earlier separate Linux session (`7c5b223`) | Full suite 661/661 and platform checks passed; Swift unavailable in that session. Its original detailed record is preserved in VALIDATION.md |
| Linux Swift package rerun | BLOCKED by signal-4 process crash; serial retry compiled/linked but suite did not complete. Historical 37-pass result was not reproduced; see VALIDATION.md |
| Linux build-tooling regression tests | PASS: 12 Python tests; CLI fixtures only, not Xcode |
| macOS unsigned Xcode build (Debug / Release) | PASS on hosted macOS, run 40350226821; local host remains Linux |
| XCTest / iPhone simulator | PASS: 37 core package and 3 disconnected Debug locale cases on hosted macOS |
| Physical iPhone | PARTIAL: authenticated learning home and course card observed; background/return blank document FAILED; course detail/media unverified |
| TestFlight | Build 2 Testing in owner-only internal group; no external distribution |
| App Store submission | NOT SUBMITTED; payment/privacy/deletion decisions remain |

## Required cases

| Case | Expected behavior | Simulator | Device |
|---|---|---|---|
| Cold start / reopen | Branded launch, meaningful loading; no indefinite blank WebView | PENDING | FAIL on first learning load: /ios 404; shell launched. Reopen/session persistence PENDING |
| New registration | Existing account server flow, phone gate where configured, no native bypass | PENDING | PENDING |
| Existing login | Real WebKit cookie accepted by the server; same account in native session probe | PENDING | PENDING: Arabic form rendered; session 404 resolved by server update, authenticated retest not yet observed |
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


## Initial Apple upload evidence — 26 October 2026

- Upload run 40375418654 PASS; Apple validation and delivery both succeeded.
- Version 1.0.0 (1), build UUID 762c7bc3-0c7f-4a4e-98f8-53c78d324194,
  processing VALID, internal/external states MISSING_EXPORT_COMPLIANCE.
- Internal group prepared without testers/builds/public links. No device installed
  the build; all authenticated/device cases remain PENDING.
- These later records supersede earlier NOT UPLOADED/PENDING-API status only for
  delivery/API setup; they do not promote any native integration row to passed.


## Owner-only TestFlight invitation — 26 October 2026

- Owner-approved export-compliance declaration saved and read back as
  `usesNonExemptEncryption=false`; the missing-compliance blocker is resolved.
- Version 1.0.0 (1) is assigned to Madrasadz Internal: one build, one internal
  tester (the owner only), status **Invited**. Apple API state: **IN_BETA_TESTING**.
- This supersedes the earlier blocked/unassigned TestFlight status. Invitation
  acceptance, device installation and launch have not been observed. All physical
  device/authenticated backend/video/PDF/accessibility/reminder cases stay PENDING.
- No external tester, public link or App Store review/release was created.


## First owner device run — 26 October 2026

- Binary: TestFlight 1.0.0 (1), signed source b3a268c27166c36fab858550ae4d124a686bcda1.
- Apple API reports INSTALLED; owner confirms app opened. Genuine screenshots show
  native Arabic tabs, learning failure, signed-out account gate and login form.
- Exact device/OS, font settings, account category and authenticated state were not
  supplied; do not infer them from general account/device history.
- Learning integration: FAIL/BLOCKED by observed /ios and session endpoint 404s.
  Loading performance: owner reports slow; no on-device timing trace collected.
- All video/PDF/session-continuity/account-switch/reminder/accessibility cases remain
  PENDING. SERVER-UPDATE-PLAN.md records required deployment gates and scope.


## Owner-executed production server update — 26 October 2026

- Source 65d1bb9 built as platform-app:ios-65d1bb9, background Docker build exit 0.
- Owner switched app only with --no-deps/--no-build/--pull never; effective runtime
  AUTO_MIGRATE=0. Original worktree, .env and other services were not targeted.
- Owner checks: /ios 200 (0.446760 s), anonymous session 401 (0.056746 s).
  Independent normal-TLS GETs confirm 200 and AUTH_REQUIRED JSON/private no-store.
- Public endpoint availability is now PASS. First device failure remains historical;
  no authenticated device/relaunch/media/PDF/reminder/accessibility retest is claimed.
- See SERVER-DEPLOYMENT-20261026.md and IOS-POST-DEPLOY-CHECKS.json for evidence,
  timing limits, persistent fourth Compose file and rollback instructions.

## Device report — 27 October 2026

- IMG_6665/IMG_6666: learning home shows account navigation, a course titled
  «دورة الادب العربي الفصل الأول» and «متابعة التعلّم». This is evidence of the
  course card, not of course detail access or video playback.
- Owner reports the document disappears after leaving and returning; the blank
  screenshot still shows native tabs/toolbars. Mark foreground restoration FAILED.
- App Store Connect earlier identified the sole installed tester device as iPhone
  13 Pro Max / iOS 27.0.1. Screenshots alone do not independently verify OS/build.
- Candidate Build 3 records background across intermediate inactive states and
  restores the allowed document using persistent WebKit cookies; it adds a bounded
  renderer/navigation recovery. No server, enrollment or database change.
- Retest must include repeated background/activation while signed in, opening
  «متابعة التعلّم», video/fullscreen, session expiry and account switching.
