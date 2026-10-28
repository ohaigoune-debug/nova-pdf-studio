# Native app plan — progress log

One line per push: date (Algiers), phase, SHA, what changed, CI and results,
blockers. Plan: `CODEX-NATIVE-APP-PLAN-AR.md`. Design: `NATIVE-ARCHITECTURE.md`.

| Date | Phase | SHA | Change | Checks | Blockers |
|---|---|---|---|---|---|
| 2026-10-28 16:10 | 0 | (this commit) | Baseline recorded; architecture and progress docs. No behaviour change. | Linux: `tsc` 0 errors. `eslint src tests`: 0 errors, 10 pre-existing warnings (css tags / img / unused expressions in unrelated files). vitest: 21 files, 228 tests pass (store, orders, confirmer, courses, delivery, iOS server suites) on the same server source as `0e27f98`. Last iOS CI: unsigned 40525444544 and signed 40525444553 on `deb03f6` pass; upload 40530906662 pass. | Server `0e27f98` (confirmer powers + /ios redesign + classroom) awaits the owner's deployment. |
