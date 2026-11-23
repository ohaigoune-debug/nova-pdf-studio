#!/usr/bin/env python3
"""Madrasadz 1.1.0 → App Review (owner's word «ارسله للمراجعة», 23 Nov 2026).

MODE=status (read-only): versions, review details, age-rating gaps, localizations, Build 19 state.
MODE=submit: waits for Build 19 VALID, creates version 1.1.0 with MANUAL release (the owner releases it
himself after approval), sets «What's New», attaches Build 19, then submits for review — but stops
without submitting if anything Apple requires is missing (age-rating answers, review contact,
description, screenshots). Never prints the key or the token. Never releases the version.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt  # PyJWT

KID, ISS, KEY = os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], open(os.environ["KEY_PATH"]).read()
MODE = os.environ.get("MODE", "status")
APP = "6827229065"
VERSION, BUILD = "1.1.0", "19"
BASE = "https://api.appstoreconnect.apple.com"
WHATS_NEW = {
    "ar": "• قسم «مواضيع مقترحة» في التّمارين: مواضيع تدريبيّة على نمط البكالوريا مع التّصحيح وسلّم التّنقيط.\n"
          "• «دوراتي»: الدّروس وتمارينها والحصص المباشرة كما في الموقع.\n• تحسينات في السّرعة والاستقرار.",
    "fr": "• Nouvelle rubrique « Sujets proposés » : sujets d’entraînement type BAC avec corrigé et barème.\n"
          "• « Mes cours » : leçons, exercices et séances en direct comme sur le site.\n• Améliorations de stabilité.",
    "en": "• New “Proposed papers” section: BAC-style practice papers with answers and marking scheme.\n"
          "• “My courses”: lessons, exercises and live sessions, as on the website.\n• Speed and stability improvements.",
}
problems = []


def call(method, url, body=None):
    now = int(time.time())
    token = jwt.encode({"iss": ISS, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}, KEY,
                       algorithm="ES256", headers={"kid": KID, "typ": "JWT"})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url if url.startswith("http") else BASE + url, data=data, method=method,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:300].decode(errors="replace")}


def err(d):
    return "; ".join(f"{x.get('code')}: {x.get('detail')}" for x in d.get("errors", [])) or json.dumps(d)[:400]


def get(url):
    st, d = call("GET", url)
    if st != 200:
        print(f"  (GET {url.split('?')[0]} -> {st}: {err(d)})")
        return None
    return d


def section(t):
    print(f"\n== {t}", flush=True)


def lang(locale):
    return locale.split("-")[0].lower()


# ------------------------------------------------------------------ versions
section("App Store versions")
vers = get(f"/v1/apps/{APP}/appStoreVersions?limit=10&filter[platform]=IOS") or {"data": []}
for v in vers["data"]:
    a = v["attributes"]
    print(f"  {a['versionString']}: {a.get('appStoreState')} | release={a.get('releaseType')}")
live = next((v for v in vers["data"] if v["attributes"].get("appStoreState") == "READY_FOR_SALE"), None)
target = next((v for v in vers["data"] if v["attributes"]["versionString"] == VERSION), None)
editable = next((v for v in vers["data"] if v["attributes"].get("appStoreState") in
                 ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")), None)
if editable and editable is not target:
    print(f"  editable version {editable['attributes']['versionString']} exists; it will be renamed to {VERSION}")

# ------------------------------------------------------------------ age rating
section("Age rating")
infos = get(f"/v1/apps/{APP}/appInfos") or {"data": []}
info = next((i for i in infos["data"] if i["attributes"].get("appStoreState") != "READY_FOR_SALE"), None) or (infos["data"][0] if infos["data"] else None)
if info:
    d = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")
    if d:
        a = d["data"]["attributes"]
        missing = sorted(k for k, val in a.items() if val is None)
        print("  answered:", json.dumps({k: v for k, v in a.items() if v is not None}, ensure_ascii=False))
        print("  UNANSWERED:", ", ".join(missing) or "none")
        if missing:
            problems.append("age-rating questions unanswered: " + ", ".join(missing))

# ------------------------------------------------------------------ live version details (copied to 1.1.0)
src = target or editable or live
if src:
    section(f"Version {src['attributes']['versionString']} texts / review details")
    locs = get(f"/v1/appStoreVersions/{src['id']}/appStoreVersionLocalizations") or {"data": []}
    for l in locs["data"]:
        la = l["attributes"]
        sets = get(f"/v1/appStoreVersionLocalizations/{l['id']}/appScreenshotSets") or {"data": []}
        shots = sum(len((get(f"/v1/appScreenshotSets/{s['id']}/appScreenshots") or {"data": []})["data"]) for s in sets["data"])
        print(f"  {la['locale']}: description={'set' if la.get('description') else 'MISSING'} keywords={'set' if la.get('keywords') else '-'} "
              f"supportUrl={'set' if la.get('supportUrl') else 'MISSING'} whatsNew={'set' if la.get('whatsNew') else '-'} screenshots={shots}")
    rd = get(f"/v1/appStoreVersions/{src['id']}/appStoreReviewDetail")
    if rd and rd.get("data"):
        r = rd["data"]["attributes"]
        print(f"  review contact: {'set' if r.get('contactEmail') and r.get('contactPhone') else 'MISSING'} | "
              f"demo account required={r.get('demoAccountRequired')} name={'set' if r.get('demoAccountName') else '-'} "
              f"password={'set' if r.get('demoAccountPassword') else '-'} | notes={'set' if r.get('notes') else '-'}")
    else:
        print("  review details: MISSING")

# ------------------------------------------------------------------ build 19
section(f"Build {BUILD}")
b = get(f"/v1/builds?filter[app]={APP}&filter[version]={BUILD}&limit=5") or {"data": []}
for x in b["data"]:
    print(f"  {x['attributes']['version']}: {x['attributes'].get('processingState')} expired={x['attributes'].get('expired')}")

if MODE != "submit":
    section("Problems (status only, nothing changed)")
    print("\n".join(problems) or "none")
    sys.exit(0)

# ================================================================== submit
section("Submit")
if problems:
    sys.exit("::error::not submitted — " + " | ".join(problems))
build = None
for _ in range(60):
    b = get(f"/v1/builds?filter[app]={APP}&filter[version]={BUILD}&limit=5") or {"data": []}
    if b["data"] and b["data"][0]["attributes"].get("processingState") == "VALID":
        build = b["data"][0]
        break
    print(f"  Build {BUILD} processing…", flush=True)
    time.sleep(30)
if not build:
    sys.exit(f"::error::Build {BUILD} not VALID yet — nothing submitted")

if target is None and editable is not None:
    st, d = call("PATCH", f"/v1/appStoreVersions/{editable['id']}", {"data": {"type": "appStoreVersions", "id": editable["id"], "attributes": {"versionString": VERSION, "releaseType": "MANUAL"}}})
    print("  rename editable version:", "OK" if st == 200 else err(d))
    target = editable
if target is None:
    st, d = call("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "IOS", "versionString": VERSION, "releaseType": "MANUAL"},
                                                         "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})
    if st != 201:
        sys.exit("::error::create version: " + err(d))
    target = d["data"]
    print("  created version", VERSION, "(release: MANUAL)")
else:
    st, d = call("PATCH", f"/v1/appStoreVersions/{target['id']}", {"data": {"type": "appStoreVersions", "id": target["id"], "attributes": {"releaseType": "MANUAL"}}})
    print("  release type MANUAL:", "OK" if st == 200 else err(d))

st, d = call("PATCH", f"/v1/appStoreVersions/{target['id']}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
print(f"  attach Build {BUILD}:", "OK" if st == 204 else err(d))
if st != 204:
    sys.exit(1)

locs = get(f"/v1/appStoreVersions/{target['id']}/appStoreVersionLocalizations") or {"data": []}
for l in locs["data"]:
    text = WHATS_NEW.get(lang(l["attributes"]["locale"]), WHATS_NEW["en"])
    st, d = call("PATCH", f"/v1/appStoreVersionLocalizations/{l['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": l["id"], "attributes": {"whatsNew": text}}})
    print(f"  whatsNew {l['attributes']['locale']}:", "OK" if st == 200 else err(d))
    if not l["attributes"].get("description"):
        problems.append(f"description missing ({l['attributes']['locale']})")
rd = get(f"/v1/appStoreVersions/{target['id']}/appStoreReviewDetail")
if not (rd and rd.get("data") and rd["data"]["attributes"].get("contactEmail")):
    problems.append("App Review contact missing on 1.1.0")
if problems:
    sys.exit("::error::prepared but NOT submitted — " + " | ".join(problems))

st, d = call("POST", "/v1/reviewSubmissions", {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"},
                                                       "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})
if st != 201:
    sys.exit("::error::review submission: " + err(d))
sub = d["data"]["id"]
st, d = call("POST", "/v1/reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems",
                                                           "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub}},
                                                                             "appStoreVersion": {"data": {"type": "appStoreVersions", "id": target["id"]}}}}})
if st != 201:
    sys.exit("::error::add version to submission: " + err(d))
st, d = call("PATCH", f"/v1/reviewSubmissions/{sub}", {"data": {"type": "reviewSubmissions", "id": sub, "attributes": {"submitted": True}}})
if st != 200:
    sys.exit("::error::submit: " + err(d))
print(f"PASS: Madrasadz {VERSION} ({BUILD}) submitted for App Review — state {d['data']['attributes'].get('state')}. Release stays MANUAL (owner releases).")
