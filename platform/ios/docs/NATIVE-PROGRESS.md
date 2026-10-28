# Native app plan — progress log

One line per push: date (Algiers), phase, SHA, what changed, CI and results,
blockers. Plan: `CODEX-NATIVE-APP-PLAN-AR.md`. Design: `NATIVE-ARCHITECTURE.md`.

| Date | Phase | SHA | Change | Checks | Blockers |
|---|---|---|---|---|---|
| 2026-10-28 16:10 | 0 | 89d34e0 | Baseline recorded; architecture and progress docs. No behaviour change. | Linux: `tsc` 0 errors. `eslint src tests`: 0 errors, 10 pre-existing warnings (css tags / img / unused expressions in unrelated files). vitest: 21 files, 228 tests pass (store, orders, confirmer, courses, delivery, iOS server suites) on the same server source as `0e27f98`. Last iOS CI: unsigned 40525444544 and signed 40525444553 on `deb03f6` pass; upload 40530906662 pass. | Server `0e27f98` (confirmer powers + /ios redesign + classroom) awaits the owner's deployment. |
| 2026-10-28 16:40 | 1a | 9e3665a | Course sections classifier; web + iOS course pages render lessons/videos/homework/tests/files with session badges; teacher naming hint; CONTENT-NAMING-AR.md. `/student/videos|files|lessons` intentionally unchanged (not per-course lists, see NATIVE-ARCHITECTURE §4). | Linux: tsc 0; eslint 0 on changed files; vitest course-sections 23 + ios-learning/courses/academy-catalog — 66 tests pass. | Server deploy (G1) pending. |
