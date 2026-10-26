# Build, TestFlight and App Store readiness

Current classification: **source/project preparation for unsigned macOS validation**. The Linux environment did not compile the iOS target or run a simulator. This is not an IPA, not a TestFlight-ready build, and not a review-ready submission.

## 1. Local macOS validation

- [ ] Clone the development branch and preserve the documented baseline/commit history.
- [ ] Install the Xcode version required by the checked-in project; the intended minimum is Xcode 16 with iOS 17 deployment target. Verify actual SDK compatibility before archiving.
- [ ] Follow `../README.md` for the precise project generation/build/test commands. Do not confuse a Linux syntax/source check with `xcodebuild`.
- [ ] Build Debug and Release for a generic iOS Simulator unsigned; inspect all compiler/linker/asset/Info.plist issues.
- [ ] Run native unit/UI tests available in the project and fill DEVICE-TEST-MATRIX.md with actual results.
- [ ] Verify permitted PDF export and denied/expired/revoked/account-switch cases, 25 MiB bounds, temporary cleanup and clear no-recall limits; do not claim an offline course library.
- [ ] Test against an isolated compatible Next.js server. A deployed `/ios` portal and minimal session APIs are required for live integration; they are not deployed by this task.
- [ ] Inspect app icon/launch resources at all sizes; icon source derives from existing project branding, not a screenshot of the website.
- [ ] Capture real screenshots of learning, bookmarks, planner, login and error states.

## 2. Signing and account setup (owner action)

- [ ] Apple Developer membership active; pending enrollment is not distribution authorization.
- [ ] Confirm legal account owner, rights to the Madrasadz brand and teaching content, contact details and distribution countries.
- [ ] Confirm Bundle Identifier availability in the developer account and reserve the intended App ID. Proposed identifiers in source are not proof of reservation or global availability.
- [ ] Set Team ID in local/untracked configuration or CI secrets; do not commit private keys, certificates, provisioning profiles or App Store Connect API keys.
- [ ] Choose the actual marketing version and monotonically increasing build number. No existing iOS release was inferred from Android versions.
- [ ] Configure correct signing profiles and device registration where needed; build and test on a physical iPhone.

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

## 5. TestFlight (later, explicitly authorized)

- [ ] All preceding build/signing/device/security gates pass and app endpoints are available in the authorized environment.
- [ ] Archive/validate in Xcode; export/upload only after owner authorization. No automatic upload workflow is enabled in this task.
- [ ] Complete export-compliance questions according to actual encryption use and obtain an answer from the owner where required; do not invent an exemption.
- [ ] Add test information, privacy policy and reviewer details; comply with Beta App Review for external testers.
- [ ] Record device tests, crashes and session/content failures before expanding testers.

## 6. App Store submission (later, explicitly authorized)

- [ ] Store listing AR/FR checked against shipped features, URLs/contact details confirmed and screenshot files genuine.
- [ ] App Review notes updated to describe the final commercial basis, access instructions and native value; remove unresolved placeholders only after resolution.
- [ ] Required permissions, data disclosures, age rating, content rights, legal agreements and accessibility tested.
- [ ] No review-only hiding, no unpublished payment switches and no accidental commerce/community escape routes.
- [ ] Obtain separate authorization before submitting, releasing or deploying production.

The provided CI is intended for manual `workflow_dispatch` build/test only on macOS, unsigned and without automatic upload. Creating the workflow is not a CI execution result; no paid CI job is triggered merely to prepare these sources.
