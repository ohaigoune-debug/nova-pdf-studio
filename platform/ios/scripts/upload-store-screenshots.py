#!/usr/bin/env python3
"""Upload the 6.9-inch App Store screenshots to the editable version of Madrasadz.

Owner's request (5 Nov 2026). Writes only the iPhone screenshot set of the primary
language of the version still being prepared. Never touches builds, testers, prices,
text or review state, and never submits anything for review. An existing non-empty
set is left alone unless REPLACE_SCREENSHOTS=1.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

APP = '6827229065'
BUNDLE = 'com.madrasadz.student'
DISPLAY = os.environ.get('SCREENSHOT_DISPLAY_TYPE', 'APP_IPHONE_67')  # «6.9" Display» in App Store Connect
EDITABLE = {'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'}
API = 'https://api.appstoreconnect.apple.com'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def encoded(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=')


def token(key):
    now = int(time.time())
    header = {'alg': 'ES256', 'kid': os.environ['MADRASADZ_ASC_KEY_ID'], 'typ': 'JWT'}
    payload = {'iss': os.environ['MADRASADZ_ASC_ISSUER_ID'], 'iat': now, 'exp': now + 600, 'aud': 'appstoreconnect-v1'}
    message = b'.'.join(encoded(json.dumps(v, separators=(',', ':')).encode()) for v in (header, payload))
    der = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', str(key)], input=message, capture_output=True, check=True).stdout
    assert der[0] == 0x30 and der[1] == len(der) - 2
    integers, offset = [], 2
    for _ in range(2):
        assert der[offset] == 2
        size = der[offset + 1]
        value = der[offset + 2:offset + 2 + size].lstrip(b'\0')
        assert len(value) <= 32
        integers.append(value.rjust(32, b'\0'))
        offset += size + 2
    return (message + b'.' + encoded(b''.join(integers))).decode()


def api(key, method, path, body=None):
    assert path.startswith('/v1/') and '://' not in path
    headers = {'Authorization': 'Bearer ' + token(key), 'Accept': 'application/json'}
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=60) as response:
            raw = response.read(5_000_000)
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail = error.read(20_000).decode(errors='replace')
        sys.exit(f'App Store Connect refused {method} {path.split("?")[0]}: HTTP {error.code}\n{detail}')


def put_part(op, blob):
    part = blob[op['offset']:op['offset'] + op['length']]
    req = urllib.request.Request(op['url'], data=part, method=op['method'])
    for h in op.get('requestHeaders') or []:
        req.add_header(h['name'], h['value'])
    with urllib.request.urlopen(req, timeout=120) as response:
        assert 200 <= response.status < 300, response.status


def main():
    key = Path(sys.argv[1])
    files = [Path(p) for p in sys.argv[2:]]
    assert key.is_file() and files and all(f.is_file() for f in files)

    app = api(key, 'GET', f'/v1/apps/{APP}?fields[apps]=bundleId,name,primaryLocale')['data']
    assert app['attributes']['bundleId'] == BUNDLE, 'Unexpected app'
    primary = app['attributes']['primaryLocale']
    print(f"App: {app['attributes']['name']} ({BUNDLE}), primary language {primary}")

    versions = api(key, 'GET', f'/v1/apps/{APP}/appStoreVersions?filter[platform]=IOS&limit=20')['data']
    for v in versions:
        print(f"  version {v['attributes']['versionString']}: {v['attributes']['appStoreState']}")
    editable = [v for v in versions if v['attributes']['appStoreState'] in EDITABLE]
    if not editable:
        sys.exit('No App Store version is being prepared: create version 1.0 in App Store Connect first. Nothing uploaded.')
    version = editable[0]

    locs = api(key, 'GET', f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")['data']
    print('  languages:', ', '.join(l['attributes']['locale'] for l in locs))
    loc = next((l for l in locs if l['attributes']['locale'] == primary), None) or (locs[0] if locs else None)
    if loc is None:
        sys.exit('The version has no language yet. Nothing uploaded.')
    print(f"Target: version {version['attributes']['versionString']}, language {loc['attributes']['locale']}, display {DISPLAY}")

    sets = api(key, 'GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets?limit=50")['data']
    print('  existing sets:', ', '.join(s['attributes']['screenshotDisplayType'] for s in sets) or 'none')
    shot_set = next((s for s in sets if s['attributes']['screenshotDisplayType'] == DISPLAY), None)
    if shot_set:
        existing = api(key, 'GET', f"/v1/appScreenshotSets/{shot_set['id']}/appScreenshots?limit=20")['data']
        if existing and os.environ.get('REPLACE_SCREENSHOTS') != '1':
            sys.exit(f'{len(existing)} screenshot(s) already in this set; left untouched. Nothing uploaded.')
        for s in existing:
            api(key, 'DELETE', f"/v1/appScreenshots/{s['id']}")
            print('  removed old screenshot', s['attributes'].get('fileName'))
    else:
        shot_set = api(key, 'POST', '/v1/appScreenshotSets', {'data': {
            'type': 'appScreenshotSets',
            'attributes': {'screenshotDisplayType': DISPLAY},
            'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}})['data']
        print('  created set', DISPLAY)

    ids = []
    for f in files:
        blob = f.read_bytes()
        shot = api(key, 'POST', '/v1/appScreenshots', {'data': {
            'type': 'appScreenshots',
            'attributes': {'fileName': f.name, 'fileSize': len(blob)},
            'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': shot_set['id']}}}}})['data']
        for op in shot['attributes']['uploadOperations']:
            put_part(op, blob)
        api(key, 'PATCH', f"/v1/appScreenshots/{shot['id']}", {'data': {
            'type': 'appScreenshots', 'id': shot['id'],
            'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(blob).hexdigest()}}})
        ids.append((shot['id'], f.name))
        print('  uploaded', f.name)

    failed = []
    for sid, name in ids:
        for _ in range(40):
            state = api(key, 'GET', f'/v1/appScreenshots/{sid}')['data']['attributes'].get('assetDeliveryState') or {}
            if state.get('state') in ('COMPLETE', 'FAILED'):
                break
            time.sleep(6)
        print(f"  {name}: {state.get('state')} {json.dumps(state.get('errors') or [], ensure_ascii=False)}")
        if state.get('state') != 'COMPLETE':
            failed.append(name)

    api(key, 'PATCH', f"/v1/appScreenshotSets/{shot_set['id']}/relationships/appScreenshots",
        {'data': [{'type': 'appScreenshots', 'id': sid} for sid, _ in ids]})
    if failed:
        sys.exit(f'Apple did not accept: {", ".join(failed)}')
    print(f'PASS: {len(ids)} screenshots in «{DISPLAY}» for {loc["attributes"]["locale"]}, in order. Nothing submitted for review.')


if __name__ == '__main__':
    main()
