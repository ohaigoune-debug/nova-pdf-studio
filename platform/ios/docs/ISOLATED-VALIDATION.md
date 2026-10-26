# Isolated validation and remaining integration blocker

The source is prepared locally on Linux. No staging deployment, certificate, DNS change,
production API call, real database connection, native run, or account login was performed.
The new disconnected Debug shell is NOT a substitute for a matching HTTPS backend.

## What can run without a backend on a Mac

`bash scripts/test-ios.sh auto Debug` runs the core package and three native-shell UI
cases (Arabic, French and English). The app is launched with a Debug-only offline flag.
Its WebView open/retry paths do not load URLs and its identity stays signed out: no
cookie injection, account bypass, seeded personal data, video or fake subscription.
The existing account/sidebar, tabs and connection retry state are exercised. Screenshots
are created by XCTest only if it actually runs; they show a disconnected shell only.
Release compiles the flag to false. The three offline UI cases explicitly skip before
launching a Release app; package tests can run in Release but are not Release UI evidence.

## Requirements before real WebKit/session/media tests

The native trust boundary is still exactly `https://madrasadz.com` on standard HTTPS.
Changing Local.xcconfig alone to localhost/staging will fail closed and is not a solution.
Choose one reviewed setup before running real account tests:

1. An operator-managed isolated network resolves that exact hostname to the test
   deployment only. The connection must have an ordinarily valid trusted certificate
   for that hostname, without a TLS delegate override, ATS exception or trust bypass.
   The environment must prevent accidental fallback to production. Do not copy
   production certificates/private keys, cookies, databases or secrets into Git.
2. Alternatively, the owner provides an actual dedicated HTTPS validation hostname.
   Add that exact hostname only to a reviewed Debug origin policy and the test server's
   APP_URL checks (not a wildcard). Release must remain pinned to production. This
   source change has NOT been made because no validation hostname was supplied.

The test deployment must use this branch's web source, with PGlite test-only storage,
local synthetic secrets and test-only accounts/content. Do not use a real database
URL or production SMS/payment/video keys. Keep any setup/migrations confined to the
isolated PGlite database. Confirm server SHA independently; a 200 response or the
presence of `/ios` does not prove the source version.

The matching deployment must serve `/ios`, course/lesson routes, and:

- `GET /api/v1/ios/session`
- `POST /api/v1/ios/logout`
- `GET /api/v1/ios/materials/[contentId]/export`

Use normal Secure/HttpOnly cookies through real HTTPS. Set APP_URL to the exact test
origin on the isolated server. Disable outbound SMS/mail/payment/AI integrations;
prepare synthetic verified/free/entitled/expired accounts via the test-only database.
A Bunny playback case additionally needs an authorized test video/library and provider
configuration supplied outside Git; do not enable a paid library or use student videos
as fixtures automatically.

## Evidence to record when the environment is available

For each DEVICE-TEST-MATRIX row: app commit, backend commit, Xcode/SDK, runtime/device,
tester/time, exact account category (no credentials), result and sanitized evidence.
Exercise login/relaunch/expiry/revocation/A→B, offline logout, permitted/denied PDF and
late export completion, notifications permission/cleanup, video fullscreen/rotation,
RTL/keyboard/safe areas/Dynamic Type/VoiceOver. Mask PII and signatures in evidence.
Record failures and pending cases; never promote an offline shell or PGlite unit test
to an authenticated iPhone result.
