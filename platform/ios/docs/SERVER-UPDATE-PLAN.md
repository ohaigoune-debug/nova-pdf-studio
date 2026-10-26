# iOS server mismatch: observed defect and gated update plan

## Confirmed on 26 October 2026

The owner installed version 1.0.0 (1) from TestFlight. Apple reports INSTALLED;
the owner supplied genuine iPhone screenshots of the native tabs, an initial
learning error and a subsequently rendered Arabic login form. These are evidence
of installation/native launch/login-form rendering, not completed authentication,
content playback, PDF export or session continuity. The owner reports very slow
loading; no device trace or timing measurement has been captured.

Unauthenticated HTTPS GETs with normal certificate verification returned:

| Path | Without study-only header | With study-only header |
|---|---|---|
| /ios | 404 HTML, 6.576 s | 404 HTML, 6.950 s |
| /api/v1/ios/session | 404 HTML, 7.267 s | 404 HTML, 6.731 s |
| /login | 200 HTML, 7.327 s | Not repeated |

See IOS-ENDPOINT-CHECKS.json for timestamp and scope. These are elapsed observations
from the validation environment, including its network path; they do not establish
origin-server latency, on-device performance, or the deployed source SHA. No cookies,
credentials, login submission, write endpoint or direct database access was used.
The web retrieval service could not access these URLs; the figures above are from
normal-TLS HTTP requests, not web-search results.

The current native BrowserController opens /ios and marks main-frame 404 as failure.
AppModel requires the existing /api/v1/ios/session JSON contract after login before
unlocking personal study data. The observed missing endpoints explain why a public
login page can render while learning/account-dependent features remain blocked.
Do not remove these checks or point learning at the unrestricted storefront.

## Source scope prepared for review

PR #26 includes the dynamic /ios layout/home/course/lesson pages and labels, the
three /api/v1/ios handlers, ios-session/ios-learning/ios-file-export services,
ios-presentation middleware support, public layout/app-shell integration and the
precise Bunny iframe CSP entry. The comparison from baseline 09dc07f to reviewed
source 9c1f89f contains no schema or migration change. Dependencies may still differ
from the live deployment, whose SHA/schema have not been inspected.

Linux verification rerun on reviewed source:

`npm exec vitest run tests/ios-session.test.ts tests/ios-learning.test.ts tests/ios-file-export.test.ts tests/ios-presentation.test.ts`

Result: exit 0; **49/49 tests, 4/4 files**, PGlite in-memory fixtures. This is not a
real WebKit session test. No new Swift/Xcode build or App Store upload was run.

## Owner authorization and current execution blocker

After reviewing this diagnosis, the owner explicitly approved updating the
madrasadz.com production server to support the iOS app, retaining the prohibition
on database migrations. This authorization supersedes the earlier production
no-deploy restriction for this narrowly scoped server update only. Do not request
the same approval again. No merge, force push, .env edit, database migration,
Android change, paid service or App Store submission is authorized.

A noninteractive SSH attempt from this environment to the previously documented
Contabo host failed before authentication: `Network is unreachable` (exit 255).
No SSH agent is available here. No remote command, production change or deployment
ran; this network error is not evidence that the VPS is offline. No credentials
were requested, printed or copied. Actual production SHA/path/launch mechanism
are still unknown. See OPERATOR-HANDOFF-AR.md for the authorized operator workflow.

## Deployment gates (not executed)

1. Obtain authorized access to the actual deployment and record its source/image
   SHA, launch mechanism and compatibility with this narrowly scoped patch. Preserve
   other changes. No real database login or content extraction is authorized here.
2. Prepare an exact reviewed web-only candidate based on that deployment; do not
   replace production with an unknown whole branch. Preserve its environment, uploads,
   public sales behavior, origin policy and signing/session secrets.
3. Validate the matching candidate against isolated PGlite accounts over an
   explicitly trusted test HTTPS origin as specified in ISOLATED-VALIDATION.md.
   No staging hostname or access has been supplied; this gate is still blocked.
4. Show the final candidate SHA, affected paths, isolated results and rollback image
   before switching production. The owner has now approved the narrow iOS server
   update; apply that approval within the recorded constraints. Merge/force-push
   remain unauthorized, and this environment currently cannot reach the VPS.
5. Do not run scripts/deploy-vps.sh, start:hosted or a full compose up as a shortcut:
   the checked-in deployment path enables AUTO_MIGRATE and may run bootstrap/seed.
   A reviewed app-only launch with migrations disabled and no bootstrap/worker/DB
   recreation is required under the owner's no-real-DB-migration constraint. This
   cannot be prescribed as a blind command without observing the actual deployment.

## Acceptance and rollback within the approved server-update scope

- /ios serves the study portal (or its documented authentication flow), not 404.
- An unauthenticated /api/v1/ios/session returns the documented 401 JSON response
  with private, no-store caching; authenticated student tests must then verify the
  minimal UUID/role/phone-gate contract, relaunch, expiry, account switch and logout.
- Verify video/fullscreen, PDF permission and cleanup, reminders and native local
  state against real authorized test content before expanding testers.
- Profile first-load/repeat-load and navigation timings on the actual iPhone and
  the matching server. Avoid a blanket cache override for private/session/media
  data; optimize only after attributing the delay.
- Keep the previous app image/configuration for rollback; perform no database
  rollback or schema migration as part of this patch.

Current verdict: **TestFlight installed and native shell running; functional iOS
learning integration BLOCKED by missing production endpoints. Slow-loading report
is unresolved. App Review and public release remain blocked.**
