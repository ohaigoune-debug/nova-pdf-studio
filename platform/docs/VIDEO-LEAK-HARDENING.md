# Video leak hardening — web

Date: 2026-10-27. Branch: `codex/video-leak-hardening`, based on `work @ 09dc07ffa2382596a7ee54c0123fa24709060aec`.
This is source for review; no production deployment, migration, Android change or Apple upload was performed.

## What changed

- `secure-video-player.tsx` and `video-frame.tsx`: custom fullscreen targets the container that contains both media and watermark. The Bunny iframe does not receive `allowFullScreen` or the fullscreen permission. Uploaded video has `nofullscreen`, inline playback and a scoped WebKit fullscreen-control rule. Standard and WebKit-prefixed element fullscreen are supported; if unavailable or rejected, CSS fixed/inset fullscreen keeps the same watermarked container, with Escape, a visible exit button and scroll restoration.
- Device/access denials remove the video/iframe rather than putting a dismissible message over a continuing player. There is no button that clears a denial; reload performs fresh server checks.
- Heartbeats have one in-flight request, a ten-second timeout and a terminal four-consecutive-failure policy. A successful response resets a transient streak; it never clears a terminal denial. Pausing/returning resets elapsed watch-time accounting separately, never the failure counter.
- `video-playback-guard.ts` strictly checks HTTP status and `ok === true`. Device limits and authentication/access loss stop immediately. Other failures tolerate three consecutive attempts and stop on the fourth, approximately a minute. Explicit device errors remain device denials even if a gateway maps them to403.
- `media.service.ts` shares the observed-IP guard between initial Bunny URL admission and heartbeats. Missing IP cannot skip the check; client-chosen `viewerKey` cannot remove a different IP from the count. `BunnyMedia` passes IP from server request metadata.
- Bunny embed TTL is300seconds. The signed URL includes officially documented inline/no-casting options. No unknown `fullscreen=false` parameter was invented.
- `bunny-player.ts` loads the official player.js SDK from its fixed documented HTTPS URL. The client renews one minute early, verifies a newer expiry and the fixed Bunny embed origin, and preserves time and paused/playing state with player.js. A single SDK instance rebinds events when its iframe document changes. The previous `Date.now() >= expires` unmount has been removed; expiry is a renewal schedule, not a local playback cutoff.
- `/api/v1/media/bunny/refresh`: exact configured Origin, authenticated actor, student phone gate, strict input schema, per-account60/600s rate limit and ordinary content/IP checks. Returns only `{url, expires}`; success and errors are private/no-store. IP comes from server metadata, never JSON.
- `middleware.ts` permits the existing Bunny iframe origin in CSP; form-action and frame-ancestors restrictions remain. It does not add a wildcard.
- Arabic, French and English playback/fullscreen/failure messages are provided.

## Official Bunny sources checked

- https://bunny.net/docs/stream/embedding.md
- https://bunny.net/docs/stream/token-authentication.md
- https://bunny.net/docs/stream/signed-embeds.md
- https://bunny.net/docs/stream/playback-api.md
- Official SDK: https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js

The embedding documentation specifies `playsinline=true` and `disableIosPlayer=true` for inline iPhone playback, plus `disableAirPlay=true` and `chromecast=false`. This is a documented provider setting, not an actual iPhone test result.

## A3: what was and was not established

Official documentation describes token validation when an iframe loads and recommends short admission windows. It does not conclusively specify whether an already-started stream, unbuffered seek or a particular CDN/DRM configuration stops at that boundary.

**No controlled, signed Bunny playback-expiry experiment was available.** A test-only signed link was requested from the owner; no private library key, environment file or production database was read. Neither a token-signing unit test, a mocked player nor an HTTP403 from a fresh iframe would establish what an existing playback session does.

The renewal path is a conservative implementation that does not rely on either outcome: obtain a fresh authorized URL before expiry, capture current time/paused state, navigate the same iframe, reattach player.js events and restore position. Network failures retry briefly; repeated renewal failure stops with a reload message. The implementation does not promise a seamless hour-long session on a real provider or iPhone until the test below passes. Some browsers may require a user play gesture after iframe navigation; the preserved position should be tested as well.

### Required controlled provider experiment (PENDING)

1. Use a non-sensitive test video longer than the expiry and a controlled five-minute signed embed. Record only timings/results, not the URL/token or personal watermark in public logs.
2. Start playback, stay on that document past300seconds and record whether buffered playback and seeking into an unbuffered section work. Distinguish a fresh load of the expired URL from the original session.
3. Test with the actual library's token/CDN/DRM/referer settings; do not infer this behavior from a different demo library.
4. With the new client, watch for at least an hour through repeated renewals. Confirm position, pause state, volume/browser autoplay behavior, visibility changes and device/access revocation.
5. Repeat on Safari and an actual iPhone/WKWebView. Confirm inline playback and that container fullscreen/CSS fallback retains the watermark. If evidence supports avoiding iframe renewal for the active configuration, revise with that evidence rather than claiming an untested outcome.

## Actual automated verification

- Server tests use PGlite only. New admission cases failed before the fix and passed afterward, including third-IP denial, unknown-IP handling, spoofed viewerKey and300second expiry.
- Complete Vitest run:101files,672tests passed, no failures or skips. This run includes37guard cases and13renewal-route cases.
- The final watch-time-only client adjustment was followed by TypeScript, ESLint,37guard cases, a fresh Next build and the browser run below. The complete suite was not repeated after that adjustment; no server logic changed in it.
- Chromium154/Playwright1.62 runs the actual React components and Tailwind CSS with local API/SDK fixtures:16browser cases passed. These cover container fullscreen for uploaded/Bunny media, CSS fallback/scroll restoration/Escape/unmount, WebKit API-contract simulation, device/access rejection and frame removal, four failed heartbeats, streak reset, and renewal position/pause preservation.
- The long fixture case performed15renewals and15position checks over more than3,620,000milliseconds of virtual time. **It is not a real hour of Bunny playback.** The mocked SDK emits `ready` deterministically; a real provider that never emits it may leave renewal pending and still needs the controlled test.
- Official player.js callback waits and SDK loading are bounded; no real provider credentials were used in browser tests. No authenticated production account or real delivery/SMS service was involved.

Actual command logs, source fingerprints, browser JSON and fixture screenshots accompany the delivery. Do not substitute the local fixture screenshots for evidence of an actual provider session.

## Limits and manual checks

- The limit is observed IPs over ten minutes, not a physical-device fingerprint. Shared NATs and simultaneous URL issuance before the first heartbeat are not a provider-side license lock. No admission reservation was added to viewing statistics or the database schema.
- Trusted proxy configuration must supply trustworthy request metadata. A browser-supplied viewerKey or IP field is not authentication.
- DOM watermarks and client watchdogs are deterrents, not DRM or burned-in watermarks. A modified client can remove its own DOM; a short admission URL alone does not prove that an iframe already opened elsewhere will stop at expiry.
- Verify fullscreen behavior on actual iPhone/Safari, native controls on other browsers, recording/AirPlay, long-session renewal and real network outages. Web code cannot promise prevention of screenshots or an external camera.
- The separate iOS branch contains native capture shielding; this web branch does not merge or deploy that work.

## Reproduction commands

From `platform/`, using the existing dependencies and an isolated PGlite test configuration:

```sh
npx --no-install tsc --noEmit -p .
npx --no-install eslint .
npx --no-install vitest run
npx --no-install next build
node scripts/video-security-browser-test.mjs
```

The browser script needs Chromium/Playwright and uses local mock endpoints; its report identifies the exact tested source hashes. Do not run production migration, seeding or reset commands for this task.
