#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
configuration="${2:-Debug}"
if [[ $# -gt 2 || ( "$configuration" != "Debug" && "$configuration" != "Release" ) ]]; then
  echo "Usage: test-ios.sh [SIMULATOR_UUID|auto] [Debug|Release]" >&2
  exit 2
fi
bash "$ios_root/scripts/check-xcode.sh"
"$ios_root/scripts/prepare-assets.sh"
python3 "$ios_root/scripts/validate-project.py" --require-generated-app-icon
swift test --configuration "$(printf '%s' "$configuration" | tr '[:upper:]' '[:lower:]')" --package-path "$ios_root/Packages/MadrasadzCore"
if [[ $# -gt 0 && "$1" != "auto" ]]; then
  simulator_id="$1"
  xcrun simctl list devices available --json | python3 "$ios_root/scripts/select-simulator.py" "$simulator_id" >/dev/null
else
  simulator_id="$(xcrun simctl list devices available --json | python3 "$ios_root/scripts/select-simulator.py")"
fi
result_path="$ios_root/build/SimulatorTests-$configuration-$(date -u +%Y%m%dT%H%M%SZ).xcresult"
mkdir -p "$(dirname "$result_path")"
echo "Testing $configuration on iPhone Simulator $simulator_id; results: $result_path"
xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz \
  -configuration "$configuration" \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath "$ios_root/DerivedData" \
  -resultBundlePath "$result_path" \
  -skip-testing:MadrasadzUITests/MadrasadzUITests/testPublicLearningNavigation \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  test
