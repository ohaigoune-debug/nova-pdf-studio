# Native learning path — architecture (phases 1–3)

Executor: Claude (owner decision 27 Oct 2026). Source of requirements:
`CODEX-NATIVE-APP-PLAN-AR.md`. This document fixes the design before code; it
changes no behaviour by itself.

## 1. Principles carried from the current app

- **One shared main `WKWebView`** owned by `BrowserController`, always hosted in a
  `MediaProtectionWebContainer`, replaced only via `replaceWebView()`. The
  foreground ladder (keep → reattach → replace → Retry), the capture shield and
  the inactive privacy cover stay exactly as they are.
- **The server decides access.** Every new endpoint calls the existing services
  (`iosLearningHome`, `iosCourseHome`, `iosLesson` → `courseHome`,
  `getContentForStudent`, `requireIosLearningStudent`) so role, phone gate,
  enrollment, terms, expiry and visibility are identical to the web pages.
- **Graceful fallback.** A build that ships native screens still works against a
  server that does not have them: `GET /api/v1/ios/capabilities` missing, 404 or
  `apiVersion < 1` ⇒ the Learn tab stays the current web `/ios`.

## 2. Server (phase 1)

### 2.1 Course sections — `src/server/lib/course-sections.ts`

Pure, dependency-free functions:

- `normalizeForMatch(text)` strips tashkeel, tatweel, unifies alef/hamza
  forms, ta marbuta → ha, alef maqsura → ya, lower-cases Latin.
- `parseSessionNumber(title)` reads «الحصة/حصة/الدرس [رقم] N», Arabic-Indic
  digits and the ordinals الأولى…العشرون (masc./fem.), and «Séance N». It
  returns `number | null`.
- `classifyContent({ title, type })` resolves to a section:
  1. homework/test keywords, the earliest one in the title wins;
  2. `VIDEO` ⇒ `videos`;
  3. a session number, or type LESSON/ARTICLE/EXERCISE/QUIZ ⇒ `lessons`;
  4. otherwise ⇒ `files`.
- `displayTitle(title, session)` drops the session phrase that the badge
  already shows; it never returns an empty string.
- `buildCourseSections(items)` returns sections in the fixed order
  lessons, videos, homework, tests, files. Empty sections are omitted. Items
  are sorted by session ascending, then `publishedAt` ascending, then title.
  Every item appears exactly once (unit-tested invariant).

`courseHome` gains a `sections` field computed from the same published items
it already loads (no new query, no permission change). `videos`/`lessons` stay
for compatibility. The web course page and `/ios/course/[slug]` render
`sections`.

### 2.2 iOS JSON API v1

Folder `src/app/api/v1/ios/`. GET only, `jsonOk`/`jsonError`, `iosNoStore`
(private, no-store), no CORS headers. An authenticated response carries
`X-Madrasadz-Account: <user uuid>`, the same contract as the PDF export, so the
client can reject a response that belongs to another account.

| Endpoint | Auth | Reuses |
|---|---|---|
| `capabilities` | public | constant `{ apiVersion: 1, features, minAppBuild }` |
| `home` | guest or STUDENT; other roles 403 `reason=ROLE` | `iosLearningHome` + `groupLessons` |
| `courses/[slug]` | STUDENT | `iosCourseHome` → `courseHome.sections` |
| `lessons/[slug]` | guest (public lessons) or STUDENT | `iosLesson` |

The shared serializers live in `src/server/services/ios-api.service.ts`, which
is unit- and integration-tested with PGlite. Responses contain only what a
screen needs. Signed file URLs, other users, email and phone are never
included. A private video (UPLOAD/BUNNY) is described as
`{ kind: "video", webPath }`; it gets no playable URL.

## 3. App (phases 2–3)

### 3.1 Data layer

- `MadrasadzCore/IOSAPIModels.swift` holds `Decodable` mirrors of the contract.
  Unknown fields are ignored; unknown enum strings map to a safe fallback
  (section → `files`, media kind → `external` with `webPath`).
- `NativeAPIClient` (app target) is built on `AppModel.authenticatedRequest`:
  - It copies the cookies from `WKHTTPCookieStore` into an ephemeral `URLSession`.
  - Redirects are refused.
  - The host must be https `madrasadz.com`.
  - The timeout is 15 s.
  - A response is applied only when its account header equals
    `verifiedAccountID` and the `generation` token is still current (same
    `isCurrent` pattern). Otherwise the result is dropped and identity is
    refreshed.
- `capabilities` is fetched at launch and on foreground after more than
  10 minutes. It is kept in memory only.

### 3.2 Navigation

- The Learn tab's `NavigationStack` gets a `NavigationPath`:
  - Root: `NativeHomeView` when the capability is present, else the existing
    web root.
  - Destinations: `.course(slug)`, `.lesson(slug)`, `.web(path)`.
- **At most one `.web` destination in the path.** Opening a web item when one
  already exists pops back to it and calls `browser.open(path)`; no second
  web host. The `.web` view is the current `PlatformWebView(browser:)` with
  `.id(ObjectIdentifier(browser.webView))`.
- `NavigationPolicy` gains `nativeRoute(for url)`, which maps `/ios`,
  `/ios/course/{slug}` and `/student/courses/{slug}` to native routes when the
  capability is on. A tap inside the web view on such a link is intercepted.
  The redirect is one-way, so there is no loop. `NavigationPolicyTests` cover
  the mapping.
- Bookmarks with `/ios/course/...` open natively.

### 3.3 Protection on native screens

- The app-level `PrivacyProtectionCover` already covers everything while
  inactive.
- Native content lists also observe `sceneCaptureState`. When the screen is
  being captured they show the same opaque cover text. This is a SwiftUI
  overlay, not the web shield; the web shield is untouched.

### 3.4 Caching (phase 5, designed now)

- Last `home`, opened courses and text lessons are stored per account in
  Application Support/NativeCache:
  - complete file protection;
  - excluded from backup;
  - 20 MB cap;
  - purged on sign-out or account switch, and after 30 days without a check.
- Only native-rendered JSON is stored. No video, and no PDF outside
  `OfflineLibrary`.

### 3.5 Tests

- `swift test`: model decoding from fixture JSON produced by the server tests,
  section presentation, navigation mapping.
- UI tests: a Debug-only launch argument serves bundled fixture JSON (no
  network). The tests check:
  - home → course → sections → web item → back;
  - a single web destination;
  - background/foreground with a web destination open (no black screen);
  - simulated capture;
  - dark mode and large type;
  - the no-capability fallback.

## 4. Deliberately unchanged in phase 1

- `/student/videos` is the public channel directory and is not course-scoped.
- `/student/files` lists files across all accessible lessons by date.
- `/student/lessons` is organised by curriculum (`listStudentLessonsOrganized`).

None of these is a per-course list, so session ordering would not apply.
They keep their current organisation.
