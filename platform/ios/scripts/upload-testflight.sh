#!/bin/bash
# Owner-authorized upload only; never submits an App Store release for review.
set -euo pipefail
set +x
umask 077
ios_root="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ios_root/scripts/check-xcode.sh"
if [[ $# != 1 || ! -f "$1" ]]; then echo 'Usage: upload-testflight.sh IPA_PATH' >&2; exit 2; fi
for name in MADRASADZ_ASC_PRIVATE_KEY_BASE64 MADRASADZ_ASC_KEY_ID MADRASADZ_ASC_ISSUER_ID; do
  if [[ -z "${!name:-}" ]]; then echo "Missing upload secret: $name" >&2; exit 1; fi
done
if [[ ! "$MADRASADZ_ASC_KEY_ID" =~ ^[A-Z0-9]{10}$ ]] || [[ ! "$MADRASADZ_ASC_ISSUER_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo 'Invalid API key/issuer metadata.' >&2; exit 1
fi
ipa="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
python3 - "$ipa" <<'PY'
import plistlib, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    p = plistlib.loads(z.read('Payload/Madrasadz.app/Info.plist'))
    assert p['CFBundleIdentifier'] == 'com.madrasadz.student', 'Unexpected app'
    assert p['CFBundleShortVersionString'] == '1.0.0', 'Unexpected version'
    assert p['CFBundleVersion'] == '2', 'Unexpected replacement build'
    assert 'Payload/Madrasadz.app/embedded.mobileprovision' in z.namelist()
print('PASS: expected signed Madrasadz 1.0.0 (2) IPA selected for upload.')
PY
key_directory="$HOME/.appstoreconnect/private_keys"
mkdir -p "$key_directory"
key_path="$key_directory/AuthKey_$MADRASADZ_ASC_KEY_ID.p8"
if [[ -e "$key_path" ]]; then echo 'Refusing to overwrite an existing upload key.' >&2; exit 1; fi
cleanup() { rm -f -- "$key_path"; }
trap cleanup EXIT
python3 - "$key_path" <<'PY'
import base64, os, pathlib, sys
p = pathlib.Path(sys.argv[1])
p.write_bytes(base64.b64decode(os.environ['MADRASADZ_ASC_PRIVATE_KEY_BASE64'], validate=True))
p.chmod(0o600)
PY
unset MADRASADZ_ASC_PRIVATE_KEY_BASE64
openssl pkey -in "$key_path" -check -noout >/dev/null
xcrun altool --validate-app --type ios --file "$ipa" \
  --apiKey "$MADRASADZ_ASC_KEY_ID" --apiIssuer "$MADRASADZ_ASC_ISSUER_ID" --output-format json
xcrun altool --upload-app --type ios --file "$ipa" \
  --apiKey "$MADRASADZ_ASC_KEY_ID" --apiIssuer "$MADRASADZ_ASC_ISSUER_ID" --output-format json
echo 'Upload command completed. Confirm processing/status in App Store Connect before claiming TestFlight availability.'
