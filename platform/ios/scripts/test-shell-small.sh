#!/bin/bash
# Site shell on a small iPhone (iPhone SE, 375 × 667 pt, no Dynamic Island):
# runs the fixture shell tests on a temporary Simulator device created from an
# already installed iOS runtime. Never downloads a runtime; the device is deleted
# afterwards. If no installed runtime supports an iPhone SE, the step says so
# with a warning annotation instead of claiming a small-screen run.
set -euo pipefail
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ios_root/scripts/check-xcode.sh"
selection="$(xcrun simctl list runtimes available --json | python3 -c '
import json, re, sys
best = None
for runtime in json.load(sys.stdin).get("runtimes", []):
    match = re.fullmatch(r"com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)(?:-(\d+))?(?:-(\d+))?", runtime.get("identifier", ""))
    if not match or not runtime.get("isAvailable", True):
        continue
    version = tuple(int(part or 0) for part in match.groups())
    if version[0] < 17:
        continue
    types = [t for t in runtime.get("supportedDeviceTypes", []) if t.get("name", "").startswith("iPhone SE")]
    if types:
        chosen = sorted(types, key=lambda t: t.get("name", ""))[-1]
        candidate = (version, runtime["identifier"], chosen["identifier"], chosen["name"])
        if best is None or candidate[0] > best[0]:
            best = candidate
if best:
    print(best[1], best[2], best[3], sep="\t")
')"
if [[ -z "$selection" ]]; then
  echo "::warning title=Small iPhone run skipped::No installed iOS runtime supports an iPhone SE device type; the shell was not tested at 375 x 667."
  exit 0
fi
IFS=$'\t' read -r runtime_id device_type device_name <<<"$selection"
echo "Small iPhone: $device_name on $runtime_id"
simulator_id="$(xcrun simctl create "Madrasadz Small Shell" "$device_type" "$runtime_id")"
trap 'xcrun simctl shutdown "$simulator_id" >/dev/null 2>&1 || true; xcrun simctl delete "$simulator_id" >/dev/null 2>&1 || true' EXIT
mkdir -p "$ios_root/build"
result_path="$ios_root/build/ShellSmall-$(date -u +%Y%m%dT%H%M%SZ).xcresult"
test_log="$ios_root/build/xcodebuild-shell-small.log"
if ! xcodebuild \
  -project "$ios_root/Madrasadz.xcodeproj" \
  -scheme Madrasadz -configuration Debug \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath "$ios_root/DerivedData" \
  -resultBundlePath "$result_path" \
  -only-testing:MadrasadzUITests/MadrasadzUITests/testShellLayoutFixture \
  -only-testing:MadrasadzUITests/MadrasadzUITests/testShellLargeTextFixture \
  -only-testing:MadrasadzUITests/MadrasadzUITests/testNativeLearningFixture \
  -only-testing:MadrasadzUITests/MadrasadzUITests/testArabicDisconnectedShell \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO test 2>&1 | tee "$test_log"; then
  [[ -n "${GITHUB_ACTIONS:-}" ]] && python3 "$ios_root/scripts/annotate-build-log.py" "$test_log" "small iPhone test build"
  exit 1
fi
echo "::notice title=Small iPhone run::Shell fixture tests passed on $device_name ($runtime_id)."
