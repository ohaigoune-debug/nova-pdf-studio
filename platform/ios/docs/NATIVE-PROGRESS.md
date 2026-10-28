# Native app plan — progress log

One line per push: date (Algiers), phase, SHA, what changed, CI and results,
blockers. Plan: `CODEX-NATIVE-APP-PLAN-AR.md`. Design: `NATIVE-ARCHITECTURE.md`.

| Date | Phase | SHA | Change | Checks | Blockers |
|---|---|---|---|---|---|
| 2026-10-28 16:10 | 0 | 89d34e0 | Baseline recorded; architecture and progress docs. No behaviour change. | Linux: `tsc` 0 errors. `eslint src tests`: 0 errors, 10 pre-existing warnings (css tags / img / unused expressions in unrelated files). vitest: 21 files, 228 tests pass (store, orders, confirmer, courses, delivery, iOS server suites) on the same server source as `0e27f98`. Last iOS CI: unsigned 40525444544 and signed 40525444553 on `deb03f6` pass; upload 40530906662 pass. | Server `0e27f98` (confirmer powers + /ios redesign + classroom) awaits the owner's deployment. |
| 2026-10-28 16:40 | 1a | 9e3665a | Course sections classifier; web + iOS course pages render lessons/videos/homework/tests/files with session badges; teacher naming hint; CONTENT-NAMING-AR.md. `/student/videos|files|lessons` intentionally unchanged (not per-course lists, see NATIVE-ARCHITECTURE §4). | Linux: tsc 0; eslint 0 on changed files; vitest course-sections 23 + ios-learning/courses/academy-catalog — 66 tests pass. | Server deploy (G1) pending. |
| 2026-10-28 17:10 | 1b | b5a7752 | iOS JSON API v1 (capabilities, home, courses/[slug], lessons/[slug]) reusing iosLearningHome/iosCourseHome/iosLesson; private/no-store, account header, ROLE/PHONE reasons, 404 for not-found; IOS-API-V1.md. | Linux: tsc 0; eslint 0; tests/ios-api.test.ts 11 pass (guest/student/other student/teacher/admin, phone gate, terms, expiry, no signed URLs/email/phone). | — |
| 2026-10-28 17:25 | 1c | 662680b | Display-title tag rule; tiles grid; previews; SERVER-UPDATE-20261028-PHASE1-AR.md (supersedes BUILD7 and 0e27f98 runbooks; incremental if 0e27f98 already deployed). | Linux: 25 files / 302 tests pass; tsc 0; production `next build` (standalone) passes; diff vs 65d1bb9 touches no drizzle/package/Dockerfile/next.config/.env/android. Previews: iOS course page dark+light 390px, web course page light 1100px / dark 390px (PGlite sample data). | **Gate G1**: owner deploys server; then phase 2 (native home/course, Build 8). |

## Phase 1 handover (G1)

- SHA `662680b` (server source). Files: `src/server/lib/course-sections.ts`, `src/server/lib/group-lessons.ts` (moved), `src/server/services/ios-api.service.ts`, `src/app/api/v1/ios/{_respond.ts,capabilities,home,courses/[slug],lessons/[slug]}`, course pages (web + iOS), `courses.service.ts` (`sections`), content form hint, docs IOS-API-V1.md / CONTENT-NAMING-AR.md / NATIVE-ARCHITECTURE.md.
- Not tested on production or on the phone: real course titles may need renaming to show session numbers; native screens do not exist yet (phase 2).
- Owner actions: deploy per SERVER-UPDATE-20261028-PHASE1-AR.md; send the four verification outputs; optionally rename old content per CONTENT-NAMING-AR.md.
