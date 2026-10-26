#!/bin/bash
# Export a signed IPA locally. This script never uploads to Apple.
set -euo pipefail
set +x
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ios_root/scripts/check-xcode.sh"
for name in MADRASADZ_IOS_P12_BASE64 MADRASADZ_IOS_P12_PASSWORD MADRASADZ_IOS_PROFILE_BASE64; do
  if [[ -z "${!name:-}" ]]; then echo "Missing signing secret: $name" >&2; exit 1; fi
done
work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/madrasadz-signing.XXXXXX")"
chmod 700 "$work"
keychain="$work/signing.keychain-db"
profile_path=""
cleanup() {
  security delete-keychain "$keychain" >/dev/null 2>&1 || true
  if [[ -s "$work/keychains.json" ]]; then
    python3 - "$work/keychains.json" <<'PY'
import json, subprocess, sys
subprocess.run(['security', 'list-keychains', '-d', 'user', '-s', *json.load(open(sys.argv[1]))], check=False)
PY
  fi
  if [[ -n "$profile_path" ]]; then rm -f -- "$profile_path"; fi
  rm -rf -- "$work"
}
trap cleanup EXIT
python3 - "$work" <<'PY'
import base64, json, os, pathlib, secrets, shlex, subprocess, sys
root = pathlib.Path(sys.argv[1])
for env, name in [('MADRASADZ_IOS_P12_BASE64', 'distribution.p12'), ('MADRASADZ_IOS_PROFILE_BASE64', 'profile.mobileprovision')]:
    path = root / name
    path.write_bytes(base64.b64decode(os.environ[env], validate=True))
    path.chmod(0o600)
(root / 'keychain-password').write_text(secrets.token_urlsafe(36))
(root / 'keychains.json').write_text(json.dumps(shlex.split(subprocess.check_output(['security', 'list-keychains', '-d', 'user'], text=True))))
PY
keychain_password="$(cat "$work/keychain-password")"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$work/distribution.p12" -P "$MADRASADZ_IOS_P12_PASSWORD" -k "$keychain" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain" >/dev/null
python3 - "$work/keychains.json" "$keychain" <<'PY'
import json, subprocess, sys
subprocess.run(['security', 'list-keychains', '-d', 'user', '-s', sys.argv[2], *json.load(open(sys.argv[1]))], check=True)
PY
security cms -D -i "$work/profile.mobileprovision" > "$work/profile.plist"
python3 - "$work" <<'PY'
import datetime, hashlib, pathlib, plistlib, re, sys
root = pathlib.Path(sys.argv[1])
p = plistlib.loads((root / 'profile.plist').read_bytes())
e = p['Entitlements']
assert p['TeamIdentifier'] == ['VN2768K4UH'], 'Unexpected signing team'
assert e['application-identifier'] == 'VN2768K4UH.com.madrasadz.student', 'Unexpected app ID'
assert e.get('get-task-allow') is False, 'Development profiles are not distribution profiles'
assert 'ProvisionedDevices' not in p and not p.get('ProvisionsAllDevices'), 'Expected an App Store profile'
assert p['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Expired profile'
assert re.fullmatch(r'[0-9a-fA-F-]{36}', p['UUID']), 'Invalid profile UUID'
assert len(p['DeveloperCertificates']) == 1, 'Expected one distribution certificate'
identity = hashlib.sha1(p['DeveloperCertificates'][0]).hexdigest().upper()
(root / 'profile-uuid').write_text(p['UUID'])
(root / 'identity').write_text(identity)
with (root / 'ExportOptions.plist').open('wb') as f:
    plistlib.dump({'method': 'app-store-connect', 'destination': 'export', 'teamID': 'VN2768K4UH',
                  'signingStyle': 'manual', 'signingCertificate': identity,
                  'provisioningProfiles': {'com.madrasadz.student': p['Name']},
                  'manageAppVersionAndBuildNumber': False, 'uploadSymbols': False}, f)
PY
profile_uuid="$(cat "$work/profile-uuid")"
identity="$(cat "$work/identity")"
profile_directory="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$profile_directory"
target_profile="$profile_directory/$profile_uuid.mobileprovision"
if [[ -e "$target_profile" ]]; then echo 'Profile already installed; refusing to overwrite it.' >&2; exit 1; fi
cp "$work/profile.mobileprovision" "$target_profile"
profile_path="$target_profile"
chmod 600 "$profile_path"
unset MADRASADZ_IOS_P12_BASE64 MADRASADZ_IOS_P12_PASSWORD MADRASADZ_IOS_PROFILE_BASE64
"$ios_root/scripts/prepare-assets.sh"
python3 "$ios_root/scripts/validate-project.py" --require-generated-app-icon
output="$ios_root/build/Signed"
if [[ -e "$output" ]]; then echo 'Signed output exists; refusing to overwrite it.' >&2; exit 1; fi
mkdir -p "$output"
xcodebuild -project "$ios_root/Madrasadz.xcodeproj" -scheme Madrasadz \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$ios_root/DerivedDataSigned" -archivePath "$output/Madrasadz.xcarchive" \
  DEVELOPMENT_TEAM=VN2768K4UH CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$identity" \
  PROVISIONING_PROFILE_SPECIFIER="$profile_uuid" archive
codesign --verify --deep --strict "$output/Madrasadz.xcarchive/Products/Applications/Madrasadz.app"
xcodebuild -exportArchive -archivePath "$output/Madrasadz.xcarchive" \
  -exportPath "$output/IPA" -exportOptionsPlist "$work/ExportOptions.plist"
python3 - "$output/IPA" <<'PY'
import pathlib, plistlib, sys, zipfile
files = list(pathlib.Path(sys.argv[1]).glob('*.ipa'))
assert len(files) == 1, 'Expected exactly one IPA'
with zipfile.ZipFile(files[0]) as z:
    info = plistlib.loads(z.read('Payload/Madrasadz.app/Info.plist'))
    assert info['CFBundleIdentifier'] == 'com.madrasadz.student'
    assert 'Payload/Madrasadz.app/embedded.mobileprovision' in z.namelist()
print('PASS: exported signed IPA with expected bundle ID and embedded profile. No Apple upload performed.')
PY
