#!/bin/bash
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
source_image="$ios_root/Resources/AppIcon-Source.png"
output_image="$ios_root/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
if [[ ! -x /usr/bin/sips ]]; then
  echo "prepare-assets requires macOS /usr/bin/sips. The original opaque icon is committed; run this on your Mac before xcodebuild." >&2
  exit 1
fi
mkdir -p "$(dirname "$output_image")"
/usr/bin/sips --resampleHeightWidth 1024 1024 "$source_image" --out "$output_image" >/dev/null
metadata="$(/usr/bin/sips -g pixelWidth -g pixelHeight -g hasAlpha "$output_image")"
width="$(echo "$metadata" | /usr/bin/awk '/pixelWidth:/{print $2}')"
height="$(echo "$metadata" | /usr/bin/awk '/pixelHeight:/{print $2}')"
alpha="$(echo "$metadata" | /usr/bin/awk '/hasAlpha:/{print $2}')"
if [[ "$width" != "1024" || "$height" != "1024" || "$alpha" != "no" ]]; then
  echo "AppIcon must be exactly 1024×1024 with no alpha channel." >&2
  exit 1
fi
echo "Prepared AppIcon: 1024×1024 opaque PNG."
