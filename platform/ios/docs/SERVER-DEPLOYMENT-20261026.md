# Authorized iOS server deployment — 26 October 2026

## Execution and provenance

The owner explicitly approved the narrow production iOS server update while
retaining no migrations/.env edits/Android changes/merge/force-push constraints.
SSH from the agent environment remained unreachable. The owner executed the
provided commands in their own root SSH session; host-level results below are
owner-provided terminal evidence, not an agent SSH execution/audit.

- Checkout: /opt/madrasa, detached at 2be52ea24802b0ac4d1f63ae20ce268c5e25b808.
- Existing work ref: 09dc07ffa2382596a7ee54c0123fa24709060aec (merged branding PR25).
  The iOS source contains that ref; source comparison verified no changes to
  drizzle, package/lock, Android, Dockerfile or next.config relative to it.
- Selected server source: **65d1bb93969ff2fdf1628d79b7e46a4068151d49**.
- Isolated worktree: /opt/madrasa/releases/ios-65d1bb9. Existing dirty/untracked
  files in the original checkout were preserved; no checkout/reset/merge was run.
- Old running image, also verified under platform-app:before-ios-c4a833fda79e:
  sha256:c4a833fda79e7f6a873c8ffbf5c1717c342a1ad0bf03e9f18e363fce2788f57e.
- Candidate tag: platform-app:ios-65d1bb9, revision label set to selected source.
  Initial foreground Docker build was interrupted by SSH disconnection; no image
  was produced. Background nohup retry completed with **exit 0**, including
  Next standalone build and final image export. Exported image configuration digest:
  sha256:e4cb0c5225da6c0eb3c8f9cb3f31096d1d5d06206bcf7c8237a9f6e68d167fcd.
  This digest is from the build log; no later container image-ID read was supplied.

## App-only runtime configuration

Compose project **platform**, original files under /opt/madrasa/platform:

1. docker-compose.prod.yml
2. docker-compose.override.yml
3. docker-compose.edge.yml
4. /opt/madrasa/releases/ios-65d1bb9/ios-runtime.override.json (new override)

The fourth file specifies candidate image, entrypoint [node], command [server.js],
AUTO_MIGRATE=0 and NODE_ENV=production. A filtered effective-config check showed
only /app/data mounted and no lifecycle hooks. Other environment values, volumes,
networking and services inherit the original configuration; .env was not edited.

After checking that the running image was still the expected old image and the
rollback tag existed, the owner ran Compose **up -d --no-deps --no-build --pull never
app** with those four files. The returned app status was initially health: starting;
the runtime check reported **AUTO_MIGRATE=0**. The selected command does not launch
db/bootstrap/other services. No direct database command, migration or seed was
issued. This is command/config evidence, not a comprehensive database write audit;
normal application traffic still uses the existing server database.

## Post-deploy checks

Owner's normal-TLS unauthenticated public HTTPS requests:

| Path | HTTP | Elapsed from VPS |
|---|---|---|
| /ios | 200 | 0.446760 s |
| /api/v1/ios/session | 401 | 0.056746 s |

Independent checks from the agent environment confirmed /ios 200 HTML and session
401 JSON with ok=false, AUTH_REQUIRED and private, no-store. See
IOS-POST-DEPLOY-CHECKS.json. Independent elapsed times were about 6.25 s through a
different network path. Do not compare these/VPS times as an on-device speedup.
The earlier /ios and session 404 deployment blocker is resolved. Docker's eventual
healthy status and all other services' unchanged start times were not supplied.
No authenticated login, relaunch/account switch, media/PDF/reminder or accessibility
case has passed just because the endpoints now exist. The owner's slow-on-iPhone
report still needs retesting. TestFlight remains 1.0.0 (1), binary source b3a268c;
no replacement IPA, external beta review, App Store submission or public release ran.

## Operating and rollback notes

Keep the release worktree, new runtime override and old image tag. Container restarts
retain its configured image/environment, but a future Compose update MUST include
the fourth override (or a separately reviewed equivalent). Running only the old
three-file configuration can revert the image and re-enable AUTO_MIGRATE=1.

If rollback is needed, create an additional image-only override selecting
platform-app:before-ios-c4a833fda79e and layer it AFTER the fourth file above. Validate
that AUTO_MIGRATE remains 0 and entrypoint/command remain direct node/server.js,
then apply to app only with --no-deps --no-build --pull never. Do not run bootstrap,
restart databases or perform schema rollback; no schema change belongs to this update.

Verdict: **server iOS endpoint availability/anonymous session contract verified after
owner-executed deployment; authenticated iPhone regression and performance retest
pending; not ready for App Review.**
