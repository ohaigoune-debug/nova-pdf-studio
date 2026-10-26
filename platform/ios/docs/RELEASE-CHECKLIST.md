# Build, TestFlight and App Store readiness

Current classification (26 October 2026): **signed IPA exported, validated and uploaded to Apple; processing VALID, TestFlight blocked by MISSING_EXPORT_COMPLIANCE**. Simulator Debug/Release and the disconnected shell tests have passed on hosted macOS. No physical-iPhone integration test or App Review submission has occurred. See VALIDATION.md for exact source commits and runs.

## 1. Local macOS validation

- [ ] Clone the development branch and preserve the documented baseline/commit history.
- [ ] Install the Xcode version required by the checked-in project; the validation/distribution minimum is Xcode 26 with iOS 26+ SDK (Apple requirement since 2026-04-28); keep the app deployment target at iOS 17. Project-format compatibility with Xcode 16 is not distribution compatibility.
- [ ] Follow `../README.md` for the precise project generation/build/test commands. Do not confuse a Linux syntax/source check with `xcodebuild`.
- [x] Build Debug and Release for a generic iOS Simulator unsigned: hosted macOS run 40350226821 passed on f089e862. This does not establish physical-device behavior.
- [x] Run existing package/native shell tests: 37 core and 3 disconnected AR/FR/EN UI cases passed on hosted macOS; integration/device rows remain pending in DEVICE-TEST-MATRIX.md.
- [ ] Verify permitted PDF export and denied/expired/revoked/account-switch cases, 25 MiB bounds, temporary cleanup and clear no-recall limits; do not claim an offline course library.
- [ ] Follow ISOLATED-VALIDATION.md; offline Debug UI tests never establish backend integration. Test against an isolated compatible Next.js server. A deployed `/ios` portal and minimal session APIs are required for live integration; they are not deployed by this task.
- [ ] Inspect app icon/launch resources at all sizes; icon source derives from existing project branding, not a screenshot of the website.
- [ ] Capture real screenshots of learning, bookmarks, planner, login and error states.

## 2. Signing and account setup (owner action)

- [x] Apple Developer resources accessible: team VN2768K4UH, certificate/profile issued, signed device archive exported and Apple upload accepted. Do not infer future renewal or other agreements from this result.
- [ ] Confirm legal account owner, rights to the Madrasadz brand and teaching content, contact details and distribution countries.
- [x] Reserve explicit App ID com.madrasadz.student under VN2768K4UH; App Store Connect record 6827229065 created.
- [x] Team ID is public signing configuration; encrypted signing material and the owner-approved Developer API key are in GitHub Actions Secrets. No private keys, passwords, certificates or provisioning profiles are in Git.
- [x] Initial upload: marketing version 1.0.0, build 1. Future uploads must increase the build number; no Android version was reused as evidence.
- [x] Configure App Store distribution profile and verify signed Release archive/IPA.
- [ ] Install and test on a physical iPhone after TestFlight compliance and tester setup; no such run occurred.

## 3. Product and policy blockers

- [ ] Resolve digital course / physical book / mixed bundle model under 3.1; see APP-REVIEW-AR.md.
- [ ] If IAP is chosen: create products and agreements in App Store Connect; implement verified/idempotent transactions, account binding, restoration and refund/revocation handling; test StoreKit sandbox. None are completed merely by preparing this project.
- [ ] If a free-only first release is chosen: prove paid access/purchase/code routes are excluded consistently; do not silently reopen them after review.
- [ ] Do not assert Reader App eligibility, regional external-purchase rights or general website purchase exemption without a validated basis.
- [ ] Complete account-data deletion/retention audit and fixes, including user-generated content and related personal data; make deletion discoverable inside the app.
- [ ] Keep unsupported community routes permanently out of scope until report/block/filter/moderation/contact safeguards are complete.
- [ ] Update and publish accurate privacy/support documents only after separate deployment authorization. This work did not publish them.
- [ ] Complete App Privacy, required-reason APIs and archive Privacy Report using actual first-party WebView/server collection and third-party behavior.
- [ ] Complete current age-rating questionnaire and any applicable parental/minor requirements; do not automatically choose Kids Category or 4+.
- [ ] Prepare a normal reviewer account, content access, support contact and phone-verification instructions outside source control.

## 4. Screenshots for the current iPhone-only target

Apple page checked on 2026-10-26: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications . Recheck the final App Store Connect UI before upload; Apple changes device categories.

| Category | Accepted portrait examples | Notes |
|---|---|---|
| iPhone Dynamic Island, medium | **1179×2556** or **1206×2622** | Current page lists this as a required iPhone category; capture a genuine medium set |
| iPhone Dynamic Island, large | 1260×2736, 1290×2796, **1320×2868** | Capture a genuine large set as well to cover scaling/fallback variants |
| iPhone Face ID, large | 1284×2778 or1242×2688 | Page documents fallback when corresponding larger set is absent |
| iPad 13-inch | 2064×2752 or2048×2732 | Only required if iPad is enabled; the present target is iPhone-only |

Landscape uses reversed width/height. One to ten screenshots per device size, JPEG/JPG/PNG without alpha/transparency. Do not stretch a screenshot to another device ratio or fabricate app functionality. A practical set: real learning portal, real authorized lesson, bookmarks, planner and chosen reminder flow. Use Arabic and French captures only for actual supported localized screens. Do not use the generated identity phone mockup as a store screenshot.

## 5. TestFlight (initial upload authorized and completed)

- [ ] Complete remaining integration/device/security gates and matching HTTPS backend checks before expanding testing. The initial internal upload is not evidence that these gates passed.
- [x] Owner-authorized archive/export run 40373277061 passed; validate/upload run 40375418654 passed with VERIFY SUCCEEDED and UPLOAD SUCCEEDED. The initial-only upload workflow pins that successful IPA, not an arbitrary artifact. Apple reports processing VALID; not yet installable because export compliance is missing.
- [ ] No encryption-exemption answer is predeclared in Info.plist. Complete export-compliance questions according to actual encryption use and obtain an answer from the owner where required; do not invent an exemption.
- [ ] Add test information, privacy policy and reviewer details; comply with Beta App Review for external testers.
- [ ] Record device tests, crashes and session/content failures before expanding testers.

## 6. App Store submission (later, explicitly authorized)

- [ ] Store listing AR/FR checked against shipped features, URLs/contact details confirmed and screenshot files genuine.
- [ ] App Review notes updated to describe the final commercial basis, access instructions and native value; remove unresolved placeholders only after resolution.
- [ ] Required permissions, data disclosures, age rating, content rights, legal agreements and accessibility tested.
- [ ] No review-only hiding, no unpublished payment switches and no accidental commerce/community escape routes.
- [ ] Obtain separate authorization before submitting, releasing or deploying production.

CI now separates unsigned Simulator validation, signed IPA export, and the explicitly owner-authorized initial upload. Standard macOS runners are guarded to this public repository/iOS branch. Initial upload workflow changes can trigger its one-build upload; no App Review submission or production deployment is configured. Use actual run logs, never the presence of workflow files, as execution evidence.
