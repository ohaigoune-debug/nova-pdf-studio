# Apple official sources and research scope

Retrieved directly on **2026-10-26 UTC** using public verified HTTPS through the configured session proxy. No Apple login, entitlement request, App Store Connect product creation, upload or signing action was performed. Apple's wording and screenshot categories change; recheck before submission.

| Source | Relevant sections / use |
|---|---|
| https://developer.apple.com/news/upcoming-requirements/?id=04282026a | Since 2026-04-28, App Store Connect uploads require Xcode 26+ and iOS 26+ SDK; distinct from iOS 17 deployment target |
| https://developer.apple.com/app-store/review/guidelines/ | 1.2 user-generated content,3.1 payments,4.2 minimum functionality,4.8 login services,5.1 privacy/deletion |
| https://developer.apple.com/support/reader-apps/ | Primary media functionality, per-bundle External Link Account Entitlement, eligibility conditions; no eligibility assumed |
| https://developer.apple.com/support/offering-account-deletion-in-your-app/ | In-app deletion initiation, related personal data/UGC, confirmation and retention disclosures; redirects to current App Review guidance |
| https://developer.apple.com/app-store/app-privacy-details/ | Categories, linked data, tracking, WebView data disclosure, entirely on-device data |
| https://developer.apple.com/documentation/bundleresources/privacy-manifest-files | PrivacyInfo.xcprivacy structure and purpose |
| https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api | Required-reason API responsibilities |
| https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests | Collected data categories/purposes in manifests |
| https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype | API categories and approved reasons, including UserDefaults CA92.1 |
| https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications | Current medium/large iPhone and iPad screenshot sizes and formats |
| https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions | Current age questionnaire/global values and older OS mappings |

The Apple DocC pages return a JavaScript shell in ordinary HTML. Their corresponding Apple-hosted `/tutorials/data/documentation/...json` documents were fetched to read the actual privacy-manifest, data-use and required-reason content. The current approved reason CA92.1 describes app-only UserDefaults information; it does not permit reading another app's data or fingerprinting.

Research snapshots and SHA-256 records were held outside the repository during preparation at `/workspace/scratch/apple-guidelines/`; they are not an Apple approval or a permanent current-policy guarantee. These documents paraphrase relevant requirements; the linked official sources remain authoritative.

Policy conclusions used here:

- Existing website purchases are not automatically exempt from IAP, and a physical book does not automatically exempt a paid digital unlock.
- United States storefront link rules and region-specific entitlements are not blanket permission for the Algerian storefront.
- A permanent read-only engineering scope does not settle Reader/multiplatform commercial eligibility.
- Own email/password-only login has a current 4.8 exception; add/reassess equivalent login if social sign-in is later introduced.
- Local study utilities can add practical value, but do not guarantee acceptance under4.2.
- App Privacy includes embedded first-party web collection; no native analytics SDK is not equivalent to no collection.
- Source preparation on Linux is not an Xcode build or a TestFlight-ready binary.
