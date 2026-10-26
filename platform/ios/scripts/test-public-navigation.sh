#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ios_root/scripts/check-xcode.sh"
simulator_id="$(xcrun simctl list devices available --json | python3 "$ios_root/scripts/select-simulator.py")"
result_path="$ios_root/build/PublicNavigation-$(date -u +%Y%m%dT%H%M%SZ).xcresult"
mkdir -p "$(dirname "$result_path")"
# Real public HTTPS pages only: no credentials, account creation, writes, TLS
# exceptions, seeded entitlements or substituted backend responses.
xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz -configuration Debug \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath "$ios_root/DerivedData" \
  -resultBundlePath "$result_path" \
  -only-testing:MadrasadzUITests/MadrasadzUITests/testPublicLearningNavigation \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO test
