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

### 3.1 Data layer (as built in phase 2, Build 8)

- `MadrasadzCore/IOSAPIModels.swift` holds `Decodable` mirrors of the contract.
  Unknown fields are ignored; unknown enum strings map to a safe fallback
  (section → `files`, course status → not active); a list entry of an unknown
  shape is skipped (`LossyArray`), never failing the whole response.
- `AppModel.nativeFetch(path:)` is built on `authenticatedRequest`:
  - It copies the `madrasa_session` cookie from `WKHTTPCookieStore` into an
    ephemeral `URLSession`; without a cookie the request is a guest request.
  - Redirects are refused; the host must be https `madrasadz.com`; 15 s timeout.
  - The path must start with `/api/v1/ios/`.
  - A response is dropped when the identity `generation` changed, and when its
    `X-Madrasadz-Account` differs from `verifiedAccountID` (identity is then
    re-checked).
- `NativeLearningModel` (app target) owns the screens' state:
  - `accountKey` is derived from the settled identity (`guest`, the account,
    `phone`, `role`, `unavailable`); it is nil while the account is checked and
    the screens then show placeholders only. A different key discards all
    cached home/course data and native course screens on the stack.
  - Loads retry a few times while the account is re-checked, then fail with
    a Retry card. Errors map from status/code/reason only (401 → sign in,
    403 `PHONE_VERIFICATION_REQUIRED` / `ROLE`, `COURSE_NOT_ENROLLED`, 404).
- `capabilities` is fetched cookie-less at launch and on foreground after more
  than 10 minutes. The last answer is kept in one `UserDefaults` flag so the
  next launch starts on the right root (declared in `PrivacyInfo.xcprivacy`,
  reason `CA92.1`). With no answer yet the tab shows a short progress view and
  falls back to the web root after 8 s; a 404 (older server) turns native off.

### 3.2 Navigation (as built)

- The Study tab's `NavigationStack(path:)` holds `[LearnRoute]`:
  - Root: `NativeHomeView` when native learning is on, else the Build 7 web
    root (`WebLearningScreen`, unchanged behaviour).
  - Destinations: `.course(slug)` and `.web`. Lessons stay in the web view in
    phase 2 (`/ios/lesson/{slug}`); `.lesson` arrives with phase 3.
- **At most one `.web` destination, always last.** Opening a web page while
  it is on top loads the page in it. Its back button walks the page history
  back to the page it opened with (`historyFloor`), then pops to native. A
  placeholder covers the previous page until the new one commits.
- `NavigationPolicy.nativeRoute(for:)` maps `/ios`, `/`, `/student`,
  `/student/courses`, `/ios/course/{slug}` and `/student/courses/{slug}`.
  App-initiated loads, main-frame link taps (including back/forward) and
  client-side URL changes to those pages are handed to the native screens.
  The mapping is one-way, so it cannot loop.
- Exceptions that must load the web `/ios` pages: phone verification (the
  `PhoneGate` lives in the `/ios` layout) and a course's terms (`TermsGate`).
- Closing the web destination re-checks a failed home, a course waiting for
  terms, and the identity (sign-in and phone verification happen on the web).
- Bookmarks, the ☰ menu and the sign-in buttons of the other tabs go through
  the same routing (`AppModel.openWebsite`).

### 3.2a Site shell (as built, branch `claude/ios-site-match`)

The owner's screenshots of madrasadz.com on iPhone (IMG_6713, IMG_6714) replace
the three system tabs (Learn, Bookmarks, Revision plan) with the website's
student shell. Element-by-element comparison and every adaptation:
`IOS_VISUAL_COMPARISON.md`.

- **One `NavigationStack(path: [LearnRoute])`.** Its root is the destination
  selected in the custom five-item bottom bar (`ShellTab`: home, lessons,
  explore, courses, account). Selecting a destination sets the root and clears
  the path (a web destination is closed through the usual `path` observer), as
  the website's links do; re-selecting returns to the root.
- Pushed routes (`course`, `lesson`, `collection`, `web`, and the personal
  space `saved`, `planner`, `downloads`) open on top of the current
  destination. `NativeRoute.home` from a web page selects «الرئيسية».
- Root screens hide the system bar and show `ShellHeader` (72 pt: ☰, centred
  logo, notifications for a verified student, theme). Pushed screens keep the
  system bar (back button) on the header colour. The Build 7 web root, used
  when the server offers no native screens, keeps its system bar too.
- `ShellBottomBar` is a `safeAreaInset` of the stack, including the raised
  part of «استكشف», so content is never under it. It is hidden while the
  keyboard is shown and while the landscape lesson player fills the screen
  (`AppModel.fullScreenContent`).
- Colours are the website's tokens (`Brand`, light and dark). The theme button
  stores `madrasadz.appearance.v1` (dark by default) and applies
  `preferredColorScheme`, which the web pages follow too.
- Study-only presentation is unchanged: no store, catalogue, order, payment or
  activation entry. «استكشف» opens the server's practice tools and the bac
  bank instead of the catalogue.

### 3.3 Protection on native screens (as built)

- The app-level `PrivacyProtectionCover` already covers everything while
  inactive.
- A zero-size `SceneCaptureProbe` at the tab root observes
  `UITraitSceneCaptureState`; the capture cover shows when either it or the
  web container reports an active capture. The web shield is untouched.

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
