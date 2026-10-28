# Native app plan — progress log

One line per push: date (Algiers), phase, SHA, what changed, CI and results,
blockers. Plan: `CODEX-NATIVE-APP-PLAN-AR.md`. Design: `NATIVE-ARCHITECTURE.md`.

| Date | Phase | SHA | Change | Checks | Blockers |
|---|---|---|---|---|---|
| 2026-10-28 16:10 | 0 | 89d34e0 | Baseline recorded; architecture and progress docs. No behaviour change. | Linux: `tsc` 0 errors. `eslint src tests`: 0 errors, 10 pre-existing warnings (css tags / img / unused expressions in unrelated files). vitest: 21 files, 228 tests pass (store, orders, confirmer, courses, delivery, iOS server suites) on the same server source as `0e27f98`. Last iOS CI: unsigned 40525444544 and signed 40525444553 on `deb03f6` pass; upload 40530906662 pass. | Server `0e27f98` (confirmer powers + /ios redesign + classroom) awaits the owner's deployment. |
| 2026-10-28 16:40 | 1a | 9e3665a | Course sections classifier; web + iOS course pages render lessons/videos/homework/tests/files with session badges; teacher naming hint; CONTENT-NAMING-AR.md. `/student/videos|files|lessons` intentionally unchanged (not per-course lists, see NATIVE-ARCHITECTURE §4). | Linux: tsc 0; eslint 0 on changed files; vitest course-sections 23 + ios-learning/courses/academy-catalog — 66 tests pass. | Server deploy (G1) pending. |
| 2026-10-28 17:10 | 1b | b5a7752 | iOS JSON API v1 (capabilities, home, courses/[slug], lessons/[slug]) reusing iosLearningHome/iosCourseHome/iosLesson; private/no-store, account header, ROLE/PHONE reasons, 404 for not-found; IOS-API-V1.md. | Linux: tsc 0; eslint 0; tests/ios-api.test.ts 11 pass (guest/student/other student/teacher/admin, phone gate, terms, expiry, no signed URLs/email/phone). | — |
| 2026-10-28 17:25 | 1c | 662680b | Display-title tag rule; tiles grid; previews; SERVER-UPDATE-20261028-PHASE1-AR.md (supersedes BUILD7 and 0e27f98 runbooks; incremental if 0e27f98 already deployed). | Linux: 25 files / 302 tests pass; tsc 0; production `next build` (standalone) passes; diff vs 65d1bb9 touches no drizzle/package/Dockerfile/next.config/.env/android. Previews: iOS course page dark+light 390px, web course page light 1100px / dark 390px (PGlite sample data). | **Gate G1**: owner deploys server; then phase 2 (native home/course, Build 8). |
| 2026-10-28 16:48 | G1 | 662680b | **Owner deployed the server** (app-only, `AUTO_MIGRATE=0`). Owner-run checks on the VPS: running image `platform-app:ios-662680b` "Up 3 minutes (healthy)"; `/api/v1/ios/capabilities` → `{"ok":true,"data":{"apiVersion":1,...}}`; `/`, `/login`, `/ios` → 200. A Safari 404 seen once during the switch was not reproduced. | Owner terminal evidence (agent egress to madrasadz.com is blocked). | Phase 2 may start. |
| 2026-10-28 17:16 | 2 | fd06d43 | Native home + course screens (Build 8): `NativeLearningModel`, `NativeScreens`, single web destination with history floor, capability gate, scene-capture probe; server fix ad11459 (session phrase at the end of a sentence kept; not deployed yet). | Signed 40724312663: pass (first attempt cancelled — no macOS runner, re-run). Unsigned 40724312634: Debug/Release build and both public runs (WebKit + public native against production) pass; package test failed (`/ios/` expectation). | — |
| 2026-10-28 17:47 | 2 | 566208e | Test expectation fixed; `test-ios.sh` annotates `swift test` failures (job logs unreadable from the agent). | Unsigned 40729381293: package pass; fixture UI test failed (section identifier replaced `lessonRow`); public native (light) failed once (capability request lost at launch, dark passed). | — |
| 2026-10-28 18:13 | 2 | cbcb95a / 3f6e054 | Identifier fix; first capability check retried (2/5/15 s, 30 s on foreground until answered). Signed Revision 12. | Unsigned 40733694677 on cbcb95a: **pass** (Debug/Release, public WebKit + public native light/dark, core package, native fixture + offline/capture UI). Signed 40733783125 on 3f6e054 (app source = cbcb95a): pass, artifact 12837260307. | — |
| 2026-10-28 18:49 | 2 | b2f57ce | Upload pinned to artifact 12837260307; guards '8'. | Upload 40737751607: **pass** — Build 8 VALID and IN_BETA_TESTING in the existing owner-only internal group (script asserts one tester = owner, no public link). | Device test by the owner pending (gate for phase 3). |
| 2026-10-28 20:11 | protection | 994d609 | **Owner deployed** one-device viewing limit (fixed at 1, device key), protected YouTube embeds for signed-in users, Arabic activity labels, display-title fix (SERVER-UPDATE-20261028-PROTECTION-AR.md). | Linux: tsc 0; eslint 0 on changed files; full vitest 704 (the one failure fixed in 994d609 and re-run); `next build` passes. Owner: `platform-app:ios-994d609 Up 47 seconds (healthy)`. | Owner's manual device/watermark check pending. |
| 2026-10-28 21:05 | web | 83c5006 | **Owner deployed and confirmed** staff landing on their dashboard, admin command tiles, watermark-safe enlarge (SERVER-UPDATE-20261028-STAFF-AR.md). | Linux: tsc 0; eslint 0; media + activity-label tests pass; `next build` passes; local renders of tiles and expanded frame. Owner: «يعمل بشكل ممتاز وكما أريده». Earlier: watermark visible on YouTube on the owner's iPhone (994d609). | — |

## Phase 1 handover (G1)

- SHA `662680b` (server source). Files: `src/server/lib/course-sections.ts`, `src/server/lib/group-lessons.ts` (moved), `src/server/services/ios-api.service.ts`, `src/app/api/v1/ios/{_respond.ts,capabilities,home,courses/[slug],lessons/[slug]}`, course pages (web + iOS), `courses.service.ts` (`sections`), content form hint, docs IOS-API-V1.md / CONTENT-NAMING-AR.md / NATIVE-ARCHITECTURE.md.
- Not tested on production or on the phone: real course titles may need renaming to show session numbers; native screens do not exist yet (phase 2).
- Owner actions: deploy per SERVER-UPDATE-20261028-PHASE1-AR.md; send the four verification outputs; optionally rename old content per CONTENT-NAMING-AR.md.

## Phase 2 handover (Build 8)

- Simulator: native home/course verified against production (signed out) and
  with fixtures; not yet on the phone.
- Owner phone checks: signed out → native welcome card; sign in → native home
  with courses; course → sections with session badges; lesson → web page and
  back; ☰ menu; background/return; teacher account → "for students" card;
  screen recording on a native screen → cover.
- Server: ad11459 (display-title rule) ships with the next owner deployment.
