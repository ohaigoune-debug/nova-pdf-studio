# MadrasadzCore

Dependency-free Foundation package used by the native iPhone app. Run `swift test`
from this directory (Swift 5.9 or newer); iOS UI/WebKit require Xcode separately.

- `NavigationPolicy.production.decision(for:)` classifies internal, external and
  explicitly unsupported URLs. It is a client presentation policy, not a server
  authorization mechanism or proof of App Store payment compliance.
- `StudyStore` is an actor. Call `activate(accountID:)` only after the native app
  verifies the server's authenticated session and phone gate. Keep its returned
  `StudySession`; all reads and mutations require that generation token.
- Use `snapshot(using:)`, `addBookmark(title:url:session:)`,
  `removeBookmark(id:session:)`, `upsertTask(_:session:)` and
  `removeTask(id:session:)`. Models are `Bookmark` and `RevisionTask`.
- `lock()` clears in-memory state and returns pending revision reminder IDs.
  `logout()` also deletes the current account's persisted metadata. Cancel those
  reminder IDs in UserNotifications; notification delivery is outside this package.
  Always cancel reminders on account/session loss, including failures to remove disk
  data. Keep state locked until the server authenticates an account again.
  After session expiry has already called `lock()`, use
  `purgeAccount(accountID:)` with the natively retained last server-verified UUID.
  It rejects a purge for another account while an account is active.
- Account identifiers must be server UUIDs. JSON is partitioned by canonical UUID,
  atomically written and validated on load, with size/count bounds. iOS writes use
  complete file protection and exclude the containing directory from backups.
- Only approved study-page paths are bookmarked. Query strings and fragments are
  discarded to avoid persisting signatures or reset tokens. No lesson/PDF/video
  files, server entitlements, credentials, or account database are stored here.
- Revisiting a bookmark still goes through the live server's access checks.

Tests cover exact-origin navigation, blocked commerce/community/staff paths,
unsafe URLs, session-generation fencing, separate accounts, logout, persistence,
corrupt/poisoned/oversized/symlink files, idempotent concurrent bookmark taps,
model validation and reminder identifiers. Linux tests do not establish behavior
of WKWebView cookies, iOS file protection, notifications, or physical devices.

Validation on 2026-10-26: `swift test --jobs 2` with the official Swift 6.0.3
Ubuntu 22.04 toolchain on Linux x86_64 passed all 37 XCTest cases (16 navigation,
21 local-study state), zero failures. This is a package-only test, not an iOS build.
