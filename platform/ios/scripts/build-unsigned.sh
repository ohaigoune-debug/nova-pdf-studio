#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
configuration="${1:-Debug}"
if [[ $# -gt 1 || ( "$configuration" != "Debug" && "$configuration" != "Release" ) ]]; then
  echo "Usage: build-unsigned.sh [Debug|Release]" >&2
  exit 2
fi
bash "$ios_root/scripts/check-xcode.sh"
"$ios_root/scripts/prepare-assets.sh"
python3 "$ios_root/scripts/validate-project.py" --require-generated-app-icon
xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz \
  -configuration "$configuration" \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$ios_root/DerivedData" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build
