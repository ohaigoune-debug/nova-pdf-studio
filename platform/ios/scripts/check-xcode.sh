#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]] || ! command -v xcodebuild >/dev/null 2>&1 || ! command -v xcrun >/dev/null 2>&1; then
  echo "iOS validation requires macOS with Xcode 26+ and an iOS 26+ SDK. Linux checks cannot build or run this app." >&2
  exit 1
fi
version="$(xcodebuild -version)"
major="$(printf '%s\n' "$version" | awk '/^Xcode / {split($2, parts, "."); print parts[1]; exit}')"
if [[ ! "$major" =~ ^[0-9]+$ ]] || (( major < 26 )); then
  echo "Select Xcode 26 or newer with xcode-select (or DEVELOPER_DIR); Xcode 16 is not sufficient for current distribution validation." >&2
  exit 1
fi
for sdk in iphoneos iphonesimulator; do
  sdk_version="$(xcodebuild -version -sdk "$sdk" SDKVersion)"
  sdk_major="${sdk_version%%.*}"
  if [[ ! "$sdk_major" =~ ^[0-9]+$ ]] || (( sdk_major < 26 )); then
    echo "The selected Xcode must include the iOS 26+ $sdk SDK." >&2
    exit 1
  fi
done
printf '%s\n' "$version"
echo "Toolchain preflight passed. This does not build, sign, or run the app."
