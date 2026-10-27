#!/usr/bin/env python3
"""Enable only Build 5 in the existing owner-only group; never invite or submit."""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

APP = '6827229065'
GROUP = 'ac16c2d4-e99a-4d94-8b53-e71cd5fb39ca'
OWNER = 'ouhaigoune@icloud.com'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def encoded(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=')


def token(key):
    now = int(time.time())
    header = {'alg': 'ES256', 'kid': os.environ['MADRASADZ_ASC_KEY_ID'], 'typ': 'JWT'}
    payload = {'iss': os.environ['MADRASADZ_ASC_ISSUER_ID'], 'iat': now, 'exp': now + 120, 'aud': 'appstoreconnect-v1'}
    message = b'.'.join(encoded(json.dumps(v, separators=(',', ':')).encode()) for v in (header, payload))
    result = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', str(key)], input=message, capture_output=True, check=True)
    # OpenSSL ECDSA DER sequence -> JWT fixed-width r || s. P-256 signatures
    # have short ASN.1 lengths; reject anything outside this exact shape.
    der = result.stdout
    assert len(der) < 128 and der[0] == 0x30 and der[1] == len(der) - 2
    integers, offset = [], 2
    for _ in range(2):
        assert der[offset] == 2
        size = der[offset + 1]
        value = der[offset + 2:offset + 2 + size]
        assert 1 <= size <= 33 and len(value) == size and value[0] < 128
        value = value.lstrip(b'\0')
        assert len(value) <= 32
        integers.append(value.rjust(32, b'\0'))
        offset += size + 2
    assert offset == len(der)
    return (message + b'.' + encoded(b''.join(integers))).decode()


def request(key, path, body=None):
    assert path.startswith('/v1/') and '://' not in path
    headers = {'Authorization': 'Bearer ' + token(key), 'Accept': 'application/json'}
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, data=data, headers=headers)
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
        raw = response.read(2_000_000)
        return json.loads(raw) if raw else None


def main():
    key = Path(sys.argv[1])
    assert key.is_file()
    build = None
    for _ in range(20):
        result = request(key, f'/v1/builds?filter[app]={APP}&filter[version]=5&limit=10')
        assert len(result['data']) <= 1, 'Ambiguous build selection'
        if result['data']:
            candidate = result['data'][0]
            state = candidate['attributes']['processingState']
            assert state not in ('FAILED', 'INVALID'), 'Apple rejected processing'
            if state == 'VALID':
                build = candidate
                break
        print('Build 5 processing pending.', flush=True)
        time.sleep(30)
    assert build is not None, 'Processing deadline reached; no group change made'
    assert build['attributes']['version'] == '5'
    assert build['attributes']['usesNonExemptEncryption'] is False
    assert request(key, f"/v1/builds/{build['id']}/app")['data']['id'] == APP
    group = request(key, f'/v1/betaGroups/{GROUP}')['data']
    assert group['attributes']['isInternalGroup'] is True
    assert not group['attributes'].get('publicLinkEnabled')
    assert request(key, f'/v1/betaGroups/{GROUP}/app')['data']['id'] == APP
    testers = request(key, f'/v1/betaGroups/{GROUP}/betaTesters?limit=200')
    assert not testers.get('links', {}).get('next')
    assert len(testers['data']) == 1 and testers['data'][0]['attributes']['email'].lower() == OWNER
    request(key, f'/v1/betaGroups/{GROUP}/relationships/builds', {'data': [{'type': 'builds', 'id': build['id']}]})
    assigned = request(key, f'/v1/betaGroups/{GROUP}/builds?limit=200')
    assert any(v['id'] == build['id'] for v in assigned['data']), 'Assignment not verified'
    for _ in range(10):
        detail = request(key, f"/v1/builds/{build['id']}/buildBetaDetail")['data']['attributes']
        if detail['internalBuildState'] == 'IN_BETA_TESTING':
            break
        time.sleep(5)
    assert detail['internalBuildState'] == 'IN_BETA_TESTING', 'Assigned but internal availability not confirmed'
    print('PASS: Build 5 VALID and IN_BETA_TESTING in existing owner-only internal group. Build ID=' + build['id'])


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        # Do not echo headers, tokens, response bodies or credential metadata.
        print('App Store Connect HTTP error:', error.code, file=sys.stderr)
        sys.exit(1)
