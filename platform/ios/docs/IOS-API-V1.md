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

## Build 14 additions (3 November 2026)

### `GET /api/v1/ios/tests?term=1..3&level=&subject=&cursor=` — guest or student, free

The tests bank, step by step: term → school year → subject → list, the same papers as the
website's `/exams` (homework, tests and exams, without the official BAC papers).

```
{"terms":[{"term","count"}],            // for the student's year (or the chosen one)
 "levels":[{"id","name","code","count"}], "myLevelId":"uuid"|null,   // the student's year first
 "subjects":[{"id","name","count"}],     // with term and level
 "papers":[{"id","title","typeLabel","year","hasSolution","hasFile"}], "nextCursor",   // with subject too
 "interactive":[{"id","title","kind":"DEVOIR"|"TEST","year"}]}      // PLAY versions of that term, the student's PLAY year only
```

### `GET /api/v1/ios/papers/{id}` — guest or student

One paper of any kind, as `/api/v1/ios/bac/{id}` (which now returns the same answer), plus
`term`, `topic` and `play: {"id","title"}|null`, the interactive version in PLAY for the
student's year and stream (opened with the offline exam package `/api/v1/ios/play/sets/{id}`).

## Build 15 additions (3 November 2026)

All four are for a signed-in **student**. Mutations require `X-Madrasadz-Client: ios`.

### `GET /api/v1/ios/orders` — «طلباتي», tracking only

`{orders: [{id, number, status, statusText, createdAt, items, deliveryProvider, trackingId, timeline: [{label, at, tone: done|info|bad}]}]}` — the 30 newest.
No amount, payment method, receipt, cancel action or address is sent (the query does not read them).
`statusText` is the student's wording: `NO_ANSWER` and `CALL_LATER` read «بانتظار التأكيد».

### `GET /api/v1/ios/support` · `POST /api/v1/ios/support`

List: `{tickets: [{id, number, kind, subject, status, lastMessageAt, messages}]}`.
Open: `{kind, subject (3–200), body (2–5000), orderId?}` → `{id, number}`; 10 per hour (same limit as the website).
`kind` ∈ `DELIVERY ACCESS CONTENT TECHNICAL TEACHER OTHER` — `ORDER` («طلب شراء») is refused from the app.
`orderId` must be one of the student's orders (404 otherwise).

### `GET /api/v1/ios/support/{id}` · `POST …/{id}/reply` · `POST …/{id}/close`

Thread: `{id, number, kind, subject, status, createdAt, orderNumber, courseTitle, messages: [{id, mine, staff, author, body, createdAt}]}`.
Internal staff notes never appear; a staff message has `author: null` and is shown as «فريق مدرسة».
Reply `{body}` (60 per hour) reopens a ticket waiting for the student; replying to a closed ticket → `TICKET_CLOSED`.
Another student's ticket → 404.

### `POST /api/v1/ios/push` · `DELETE /api/v1/ios/push` — platform notifications

`{token (APNs hex), environment: production|sandbox}` → `{registered, active}` (`active`: the server has its APNs key).
The app deletes its token before signing out. Every website notification of the student is also sent to the iPhone,
except those mentioning a price, payment or purchase, and admin links (`iosPushAllowed`). The payload carries the
website `link`; the app opens a support thread (`/student/support/{id}`) or «طلباتي» (`/store/orders/…`).
Server settings (`.env`, never Git): `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8` file's contents).
Without them nothing is sent and nothing changes. The signed build turns push on only when the App Store profile
carries `aps-environment` (Push Notifications enabled on the App ID, profile regenerated).

## Build 16 additions (4 November 2026) — the virtual classroom

Student only; mutations require `X-Madrasadz-Client: ios`. Same permissions as `/student/classroom`.

### `GET /api/v1/ios/classroom?group=`

`{groups: [{id, name}], posts: [{id, body, linkUrl, file: {name, url}|null, pinned, allowComments, createdAt, groupName, authorName, comments: [{id, body, createdAt, authorName, teacher, mine, authorKey}]}]}`.
`group` = the course's `course.groupId` (also in `GET /api/v1/ios/courses/{slug}`); without it, all the student's groups.
`authorKey` is a hash of (viewer, author): stable for this viewer only, never an account id; `null` on one's own comments.

### `POST …/posts/{id}/comments` `{body (1–1500)}` · `POST …/comments/{id}/delete` · `POST …/comments/{id}/report` `{reason?}`

Comments: 20 per minute (the website's limit). `COMMENTS_CLOSED` when the teacher closed them. A student deletes only their own.
Report (Apple 1.2): a `CONTENT` support ticket for the platform with the comment, its author and the reason,
plus a notification to the post's teacher, who can delete any comment in their space. Reporting one's own comment → 422.
Hiding a classmate is local to the phone (`classroom.hidden.<account>`), by `authorKey`.

## Build 17 (4 November 2026) — the general classroom

`GET /api/v1/ios/classroom` without `group` is now **«القسم العام»**: posts marked public by teachers (or the
platform) for every registered student, with or without a course, plus older "all my groups" posts for that
teacher's students. With `?group=` it is the course classroom: that group's posts only. Students only comment
(report and hide as in Build 16); in the general classroom another student's name shows shortened («سارة ع.»).
Public posts send no mass notification. A course post's notification link carries `?group=`, and the app opens
that course's classroom.
