#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Unsigned iOS builds require macOS with Xcode 16 or newer." >&2
  exit 1
fi
"$ios_root/scripts/prepare-assets.sh"
python3 "$ios_root/scripts/validate-project.py" --require-generated-app-icon
xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz \
  -configuration "${1:-Debug}" \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$ios_root/DerivedData" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build
