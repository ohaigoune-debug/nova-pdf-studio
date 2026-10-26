#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v xcrun >/dev/null 2>&1 || ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Simulator tests require macOS with Xcode 16 or newer and an installed iPhone Simulator." >&2
  exit 1
fi
"$ios_root/scripts/prepare-assets.sh"
python3 "$ios_root/scripts/validate-project.py" --require-generated-app-icon
swift test --package-path "$ios_root/Packages/MadrasadzCore"
if [[ $# -gt 0 ]]; then
  simulator_id="$1"
else
  simulator_id="$(xcrun simctl list devices available --json | python3 -c 'import json,sys; data=json.load(sys.stdin); devices=[device for runtime,items in data["devices"].items() if ".iOS-" in runtime for device in items if device.get("isAvailable") and device["name"].startswith("iPhone")]; assert devices,"No available iPhone Simulator. Install an iOS runtime in Xcode Settings > Components."; print(devices[0]["udid"])')"
fi
if [[ ! "$simulator_id" =~ ^[0-9A-Fa-f-]{36}$ ]]; then
  echo "Expected an installed iPhone Simulator UUID." >&2
  exit 1
fi
result_path="$ios_root/build/SimulatorTests-$(date -u +%Y%m%dT%H%M%SZ).xcresult"
mkdir -p "$(dirname "$result_path")"
xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath "$ios_root/DerivedData" \
  -resultBundlePath "$result_path" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  test
