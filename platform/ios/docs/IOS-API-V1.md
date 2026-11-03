# iOS JSON API v1

Read-only endpoints for the native screens (plan phase 1). Implementation:
`src/server/services/ios-api.service.ts`, routes under `src/app/api/v1/ios/`, tests
in `tests/ios-api.test.ts` (PGlite).

## Common rules

- `GET` only. The website's own HttpOnly session cookie is used; there is no token.
- Every response sends `Cache-Control: private, no-store`, `Pragma: no-cache` and
  `Vary: Cookie`. No CORS headers are sent.
- An authenticated response carries `X-Madrasadz-Account: <user uuid>`. The app
  drops a response whose header differs from its verified account.
- Body: `{"ok": true, "data": …}` or
  `{"ok": false, "error": {"code", "message", "reason"?}}`.
- Status codes:

  | Status | Code | `reason` |
  |---|---|---|
  | 401 | `AUTH_REQUIRED` | — |
  | 403 | `FORBIDDEN` | `ROLE` (staff account) or `PHONE_VERIFICATION_REQUIRED` |
  | 404 | any `*_NOT_FOUND` | — |
  | as the existing service returns | `COURSE_NOT_ENROLLED` (expired or cancelled access) | — |

- Permissions are those of the `/ios` pages, by construction: the routes call
  `iosLearningHome`, `iosCourseHome` and `iosLesson`.
- Never included: signed file URLs, `exp`/`sig` parameters, email, phone, other
  students, password data.

## `GET /api/v1/ios/capabilities` — public

```json
{"ok":true,"data":{"apiVersion":1,"features":["home","course","lesson"],"minAppBuild":1}}
```

The app shows native screens only if this succeeds with `apiVersion >= 1`.

## `GET /api/v1/ios/home` — guest or student

```json
{"ok":true,"data":{
  "account":{"id":"uuid"} | null,
  "courses":[{"slug":"…","title":"…","teacherName":"…","season":"2026/2027","status":"ACTIVE|ENDED","accessEndsOn":"YYYY-MM-DD"|null,"termsAccepted":true}],
  "freeLessons":[
    {"kind":"group","heading":"سلسلة الفروض","detail":"الثالثة ثانوي"|null,"items":[{"slug":"…","label":"علوم","type":"LESSON"}]},
    {"kind":"single","slug":"…","label":"…","summary":"…"|null,"type":"PDF"}
  ],
  "tools":[{"id":"play","webPath":"/student/play"},{"id":"practice","webPath":"/student/practice"},{"id":"quizzes","webPath":"/student/quizzes"},{"id":"exams","webPath":"/student/exams"}]
}}
```

- A guest gets `account: null`, empty `courses` and empty `tools`.
- `freeLessons` uses the same grouping as the `/ios` page (`server/lib/group-lessons.ts`).

## `GET /api/v1/ios/courses/{slug}` — student

```json
{"ok":true,"data":{
  "needsTerms":false,
  "course":{"slug":"…","title":"…","teacherName":"…","season":"…","description":"…"|null,"accessEndsOn":"…"|null},
  "sections":[{"id":"lessons|videos|homework|tests|files","items":[{"slug":"…","title":"…","displayTitle":"…","session":3|null,"type":"PDF","videoProvider":"YOUTUBE"|null,"publishedAt":"ISO"|null}]}],
  "upcoming":[{"title":"…","startsAt":"ISO","durationMinutes":60}],
  "webPath":"/ios/course/{slug}"
}}
```

- The sections are those of `server/lib/course-sections.ts`, in a fixed order.
  Empty sections are omitted. Inside a section, items are sorted by session,
  then by publish date.
- When the course terms must be accepted, the response is only
  `{"needsTerms":true,"course":{"slug","title"},"webPath"}`. The app opens
  `webPath`, where the existing `TermsGate` collects the acceptance.

## `GET /api/v1/ios/lessons/{slug}` — guest (public lessons) or student

```json
{"ok":true,"data":{"lesson":{
  "slug":"…","title":"…","summary":"…"|null,"type":"LESSON",
  "bodyMarkdown":"…"|null,
  "media":{"kind":"none"} | {"kind":"youtube","youtubeId":"…","contentId":"uuid"} | {"kind":"pdf","contentId":"uuid","allowDownload":true} | {"kind":"video","contentId":"uuid"} | {"kind":"external"},
  "webPath":"/ios/lesson/{slug}"
},
 "viewer":{"name":"…"|null,"code":"8 hex"} | null
}}
```

- `bodyMarkdown` is raw text. The app renders it without executing HTML.
- `pdf` carries only the content id. Viewing and saving go through the existing
  protected export (`/api/v1/ios/materials/{id}/export`), and only when
  `allowDownload` is true. Otherwise the app opens `webPath`.
- Private video (`UPLOAD`/`BUNNY`) is `{"kind":"video","contentId"}` and has no playable URL.
  The app opens `webPath`.
- `contentId` on `youtube`/`video` lets the native player send the existing
  `POST /api/v1/media/heartbeat` (views report and the one-device limit), as the
  web players do. Added 2026-10-28; older servers omit it and the app then plays
  without heartbeats.
- `viewer` (signed-in students only) feeds the native moving watermark: the
  student's own name and the first 8 characters of the account id, the same
  code the web watermark shows. No email or phone.

## Build 13 additions (3 November 2026)

PLAY is free in the app: every `/api/v1/ios/*` request marks its account as coming from
the iPhone app (`actor.channel = 'ios-app'`), and the PLAY access check lets it play with
no trial and no lock. No trial row is written, so the website's 72-hour trial is unchanged.
Other permissions (courses, PDFs, videos) are exactly the website's.

### `GET /api/v1/ios/bac?stream=&subject=&year=&cursor=` — public, free

The past BAC papers bank, as on `/bac`. `stream`/`subject` are uuids, `year` four digits,
`cursor` the previous `nextCursor`. Anything else is 422.

```
{"items":[{"id","title","year","session","subjectName","streamName","topic","official","hasPaper","hasSolution"}],
 "nextCursor":"…"|null,
 "facets":{"streams":[{"id","name","count"}],"subjects":[…],"years":[{"year","count"}]},
 "total":n, "myStreamId":"uuid"|null}
```

### `GET /api/v1/ios/bac/{id}` — public, free

```
{"id","title","year","session","official","subjectName","streamName","source":{"name","attribution"}|null,
 "paper":{"url","inApp"}|null, "solution":{"url","inApp"}|null}
```

`inApp: true` — a signed `/api/v1/files/…` path (30 minutes) the app downloads and shows in
PDFKit. `inApp: false` — an `https` page or file at the source, opened in the browser.
A non-https source link is never returned.

### `GET /api/v1/ios/register` — public

Registration choices: `{"wilayas":[{"id","name"}],"levels":[{"id","name","secondary"}],"streams":[{"id","name"}]}`.

### `POST /api/v1/ios/register` — public, `X-Madrasadz-Client: ios`

Body `{fullName,email,phone,guardianPhone,password,wilayaId,levelId,streamId?}` with the
website's rules (Algerian mobiles, 8-character password, stream required for secondary).
No invitation code (it concerns credit for purchases, which the app never mentions).
Success: `{"token","expiresAt","role":"STUDENT"}` exactly like the login. A field error is
422 `{"code":"VALIDATION","message","field"}`; `EMAIL_TAKEN`, `WEAK_PASSWORD`, `RATE_LIMITED`
as on the website.

### `GET /api/v1/ios/phone` — student

`{"required","phone","sms","callNumber"}`: whether the phone gate applies, the account's own
number, and the confirmation channels.

### `POST /api/v1/ios/phone/request` and `/api/v1/ios/phone/verify` — student, `X-Madrasadz-Client: ios`

`{phone}` sends a 6-digit SMS code (`{"cooldown":60}`); `{phone,code}` checks it and marks the
phone confirmed (`{"verified":true}`), the same services and rate limits as the website.
