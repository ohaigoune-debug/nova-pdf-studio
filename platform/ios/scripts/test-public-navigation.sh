#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
appearance="${1:-light}"
if [[ $# -gt 1 || ( "$appearance" != "light" && "$appearance" != "dark" ) ]]; then
  echo "Usage: test-public-navigation.sh [light|dark]" >&2
  exit 2
fi
bash "$ios_root/scripts/check-xcode.sh"
simulator_id="$(xcrun simctl list devices available --json | python3 "$ios_root/scripts/select-simulator.py")"
# Record the actual Simulator runtime/device and SDK: they are not the owner's iPhone/iOS.
echo "Simulator SDK: $(xcodebuild -version -sdk iphonesimulator SDKVersion)"
xcrun simctl list devices available --json | python3 -c '
import json, sys
wanted = sys.argv[1]
for runtime, devices in json.load(sys.stdin)["devices"].items():
    for device in devices:
        if device.get("udid") == wanted:
            print("Simulator device:", device.get("name"), "| runtime:", runtime.rsplit(".", 1)[-1])
' "$simulator_id"
xcrun simctl boot "$simulator_id" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$simulator_id" -b >/dev/null
xcrun simctl ui "$simulator_id" appearance "$appearance"
echo "Simulator appearance: $(xcrun simctl ui "$simulator_id" appearance)"
result_path="$ios_root/build/PublicNavigation-$appearance-$(date -u +%Y%m%dT%H%M%SZ).xcresult"
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
