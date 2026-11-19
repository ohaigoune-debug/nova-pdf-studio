#!/usr/bin/env python3
"""App Store Connect release helper — reads (MODE=status) or prepares (MODE=apply) one app version.

It never submits anything for review and never changes prices of in-app purchases.
MODE=apply only: attaches the newest VALID build of VERSION, answers the age-rating
questionnaire with "none" everywhere, declares no third-party content, and sets the app
itself to Free when it has no price yet. Optional: IAP_SCREENSHOT=<png> uploads the review
screenshot of IAP_PRODUCT_ID when it has none.

Env: ASC_KEY_ID, ASC_ISSUER_ID, KEY_PATH, BUNDLE_ID, VERSION, MODE, [IAP_PRODUCT_ID], [IAP_SCREENSHOT]
Never prints the key or the token.
"""
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt  # PyJWT

kid, iss, key_path = os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["KEY_PATH"]
BUNDLE, VERSION = os.environ["BUNDLE_ID"], os.environ["VERSION"]
MODE = os.environ.get("MODE", "status")
IAP_ID = os.environ.get("IAP_PRODUCT_ID", "").strip()
IAP_SHOT = os.environ.get("IAP_SCREENSHOT", "").strip()
KEY = open(key_path).read()
BASE = "https://api.appstoreconnect.apple.com"
problems = []


def call(method, url, body=None, raw_body=None, headers=None):
    now = int(time.time())
    token = jwt.encode({"iss": iss, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}, KEY,
                       algorithm="ES256", headers={"kid": kid, "typ": "JWT"})
    data = raw_body if raw_body is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if headers is not None:
        h = headers
    full = url if url.startswith("http") else BASE + url
    req = urllib.request.Request(full, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw and r.headers.get_content_type() == "application/json" else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:300].decode(errors="replace")}


def err(d):
    return "; ".join(f"{x.get('code')}: {x.get('detail')}" for x in d.get("errors", [])) or json.dumps(d)[:300]


def get(url):
    st, d = call("GET", url)
    if st != 200:
        print(f"  (GET {url.split('?')[0]} -> {st}: {err(d)})")
        return None
    return d


def section(t):
    print(f"\n== {t}")


# ---------------------------------------------------------------- app
d = get("/v1/apps?" + urllib.parse.urlencode({"filter[bundleId]": BUNDLE}))
if not d or not d["data"]:
    sys.exit(f"::error::app {BUNDLE} not found")
app = d["data"][0]
APP = app["id"]
a = app["attributes"]
section("App")
print(f"name: {a.get('name')} | id: {APP} | primary locale: {a.get('primaryLocale')} | "
      f"content rights: {a.get('contentRightsDeclaration')}")

# ---------------------------------------------------------------- app info (age rating, categories, privacy url)
d = get(f"/v1/apps/{APP}/appInfos")
info = None
if d:
    for i in d["data"]:
        if i["attributes"].get("appStoreState") not in ("READY_FOR_SALE", "REPLACED_WITH_NEW_INFO"):
            info = i
    info = info or d["data"][0]
section("App info")
age = None
if info:
    print(f"state: {info['attributes'].get('appStoreState') or info['attributes'].get('state')} | "
          f"age rating: {info['attributes'].get('appStoreAgeRating')}")
    cat = get(f"/v1/appInfos/{info['id']}/primaryCategory")
    print(f"primary category: {cat['data']['id'] if cat and cat.get('data') else 'MISSING'}")
    locs = get(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    for l in (locs or {}).get("data", []):
        la = l["attributes"]
        print(f"  {la.get('locale')}: name={la.get('name')!r} subtitle={la.get('subtitle')!r} "
              f"privacyPolicyUrl={'set' if la.get('privacyPolicyUrl') else 'MISSING'}")
        if not la.get("privacyPolicyUrl"):
            problems.append(f"privacy policy URL missing ({la.get('locale')})")
    age = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")
    if age and age.get("data"):
        vals = age["data"]["attributes"]
        unset = [k for k, v in vals.items() if v is None]
        print(f"age rating answers: {len(vals) - len(unset)} set, {len(unset)} unanswered")

# ---------------------------------------------------------------- version
section(f"Version {VERSION}")
d = get(f"/v1/apps/{APP}/appStoreVersions?" + urllib.parse.urlencode({"filter[platform]": "IOS", "limit": 20}))
ver = next((v for v in (d or {}).get("data", []) if v["attributes"]["versionString"] == VERSION), None)
if not ver:
    editable = [v for v in (d or {}).get("data", [])
                if v["attributes"].get("appStoreState") in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED")]
    for v in (d or {}).get("data", []):
        print(f"  existing: {v['attributes']['versionString']} {v['attributes'].get('appStoreState')}")
    if len(editable) != 1:
        sys.exit(f"::error::version {VERSION} not found in App Store Connect")
    ver = editable[0]
    old = ver["attributes"]["versionString"]
    if MODE == "apply":
        st, r = call("PATCH", f"/v1/appStoreVersions/{ver['id']}",
                     {"data": {"type": "appStoreVersions", "id": ver["id"], "attributes": {"versionString": VERSION}}})
        print(f"rename version {old} -> {VERSION} (to match the builds): {'OK' if st == 200 else err(r)}")
    else:
        print(f"  editable version is named {old}; builds are {VERSION} — apply renames it")
        problems.append(f"App Store version is named {old}, builds are {VERSION}")
VER = ver["id"]
va = ver["attributes"]
print(f"state: {va.get('appStoreState')} / {va.get('appVersionState')} | release: {va.get('releaseType')} | "
      f"copyright: {'set' if va.get('copyright') else 'MISSING'}")
cur = get(f"/v1/appStoreVersions/{VER}/build")
cur_build = (cur or {}).get("data")
print(f"attached build: {cur_build['attributes']['version'] if cur_build else 'NONE'}")
locs = get(f"/v1/appStoreVersions/{VER}/appStoreVersionLocalizations?limit=50")
for l in (locs or {}).get("data", []):
    la = l["attributes"]
    sets = get(f"/v1/appStoreVersionLocalizations/{l['id']}/appScreenshotSets?limit=20")
    counts = []
    for s in (sets or {}).get("data", []):
        n = get(f"/v1/appScreenshotSets/{s['id']}/appScreenshots?limit=20")
        counts.append(f"{s['attributes']['screenshotDisplayType']}={len((n or {}).get('data', []))}")
    print(f"  {la.get('locale')}: description={len(la.get('description') or '')} chars, "
          f"keywords={'set' if la.get('keywords') else 'MISSING'}, support={'set' if la.get('supportUrl') else 'MISSING'}, "
          f"screenshots: {', '.join(counts) or 'NONE'}")
    if not la.get("description"):
        problems.append(f"description missing ({la.get('locale')})")
    if not la.get("supportUrl"):
        problems.append(f"support URL missing ({la.get('locale')})")
    if not counts:
        problems.append(f"screenshots missing ({la.get('locale')})")
rd = get(f"/v1/appStoreVersions/{VER}/appStoreReviewDetail")
if rd and rd.get("data"):
    r = rd["data"]["attributes"]
    print(f"review contact: name={'set' if r.get('contactFirstName') else 'MISSING'}, "
          f"phone={'set' if r.get('contactPhone') else 'MISSING'}, email={'set' if r.get('contactEmail') else 'MISSING'}, "
          f"notes={len(r.get('notes') or '')} chars, demo account required={r.get('demoAccountRequired')}")
else:
    print("review contact: NONE")
    problems.append("App Review contact information missing")

# ---------------------------------------------------------------- builds
section(f"Builds of {VERSION}")
d = get("/v1/builds?" + urllib.parse.urlencode({"filter[app]": APP, "filter[preReleaseVersion.version]": VERSION,
                                                 "sort": "-uploadedDate", "limit": 10}))
builds = (d or {}).get("data", [])
for b in builds:
    ba = b["attributes"]
    print(f"  build {ba['version']}: {ba.get('processingState')} expired={ba.get('expired')} "
          f"uploaded={ba.get('uploadedDate', '')[:16]}")
valid = [b for b in builds if b["attributes"].get("processingState") == "VALID" and not b["attributes"].get("expired")]
best = max(valid, key=lambda b: int(b["attributes"]["version"])) if valid else None

# ---------------------------------------------------------------- price and availability
section("Price and availability")
ps = get(f"/v1/apps/{APP}/appPriceSchedule?include=baseTerritory,manualPrices")
has_price = bool(ps and ps.get("data"))
if has_price:
    base = ps["data"].get("relationships", {}).get("baseTerritory", {}).get("data")
    print(f"price schedule: present (base territory {base['id'] if base else '?'}, "
          f"{len(ps['data'].get('relationships', {}).get('manualPrices', {}).get('data') or [])} manual price(s))")
else:
    print("price schedule: NONE")
av = get(f"/v1/apps/{APP}/appAvailabilityV2")
if av and av.get("data"):
    print(f"availability: present, new territories={av['data']['attributes'].get('availableInNewTerritories')}")
    ta = get(f"/v2/appAvailabilities/{av['data']['id']}/territoryAvailabilities?limit=200")
    avail = [t for t in (ta or {}).get("data", []) if t["attributes"].get("available")]
    print(f"  available in {len(avail)} of {len((ta or {}).get('data', []))} listed territories")
else:
    print("availability: NONE")
    problems.append("availability (territories) not set")

# ---------------------------------------------------------------- in-app purchases
section("In-app purchases")
d = get(f"/v1/apps/{APP}/inAppPurchasesV2?limit=50")
iap = None
for p in (d or {}).get("data", []):
    pa = p["attributes"]
    print(f"  {pa.get('productId')} ({pa.get('inAppPurchaseType')}): {pa.get('state')}")
    if pa.get("productId") == IAP_ID:
        iap = p
if IAP_ID and not iap:
    problems.append(f"IAP {IAP_ID} not found")
iap_shot = None
if iap:
    s = get(f"/v2/inAppPurchases/{iap['id']}/appStoreReviewScreenshot")
    iap_shot = (s or {}).get("data")
    print(f"  review screenshot: {'present (' + str(iap_shot['attributes'].get('assetDeliveryState', {}).get('state')) + ')' if iap_shot else 'MISSING'}")
    sch = get(f"/v2/inAppPurchases/{iap['id']}/iapPriceSchedule")
    print(f"  price schedule: {'present' if sch and sch.get('data') else 'MISSING'}")
    ia = get(f"/v2/inAppPurchases/{iap['id']}/inAppPurchaseAvailability")
    print(f"  availability: {'present' if ia and ia.get('data') else 'MISSING'}")
    l = get(f"/v2/inAppPurchases/{iap['id']}/inAppPurchaseLocalizations?limit=50")
    print(f"  localizations: {', '.join(x['attributes']['locale'] + '=' + str(x['attributes'].get('state')) for x in (l or {}).get('data', [])) or 'NONE'}")
    if not iap_shot:
        problems.append(f"IAP review screenshot missing")

# ---------------------------------------------------------------- apply
if MODE == "apply":
    section("Apply (no submission)")
    if best and (not cur_build or cur_build["id"] != best["id"]):
        st, r = call("PATCH", f"/v1/appStoreVersions/{VER}/relationships/build",
                     {"data": {"type": "builds", "id": best["id"]}})
        print(f"attach build {best['attributes']['version']}: {'OK' if st in (200, 204) else err(r)}")
    elif best:
        print(f"build {best['attributes']['version']} already attached")
    else:
        problems.append("no VALID build to attach")
    if app["attributes"].get("contentRightsDeclaration") is None:
        st, r = call("PATCH", f"/v1/apps/{APP}", {"data": {"type": "apps", "id": APP,
                     "attributes": {"contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT"}}})
        print(f"content rights -> no third-party content: {'OK' if st == 200 else err(r)}")
    if age and age.get("data"):
        cur_vals = age["data"]["attributes"]
        enum_none = {"alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "gunsOrOtherWeapons",
                     "horrorOrFearThemes", "matureOrSuggestiveThemes", "medicalOrTreatmentInformation",
                     "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity",
                     "violenceCartoonOrFantasy", "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic"}
        override = json.loads(os.environ.get("AGE_OVERRIDES", "{}"))
        attrs = {}
        for k, v in cur_vals.items():
            if k in override:
                attrs[k] = override[k]
            elif k in enum_none:
                attrs[k] = "NONE"
            elif isinstance(v, bool) or (v is None and k not in ("kidsAgeBand", "ageRatingOverride",
                                                                 "ageRatingOverrideV2", "koreaAgeRatingOverride",
                                                                 "developerAgeRatingInfoUrl")):
                attrs[k] = False
        st, r = call("PATCH", f"/v1/ageRatingDeclarations/{age['data']['id']}",
                     {"data": {"type": "ageRatingDeclarations", "id": age["data"]["id"], "attributes": attrs}})
        if st != 200:
            # drop the attributes Apple rejects and retry once
            bad = {e.get("source", {}).get("pointer", "").split("/")[-1] for e in r.get("errors", [])}
            attrs = {k: v for k, v in attrs.items() if k not in bad}
            st, r = call("PATCH", f"/v1/ageRatingDeclarations/{age['data']['id']}",
                         {"data": {"type": "ageRatingDeclarations", "id": age["data"]["id"], "attributes": attrs}})
        print(f"age rating ({len(attrs)} answers): {'OK' if st == 200 else err(r)}")
    if not has_price:
        pts = get(f"/v1/apps/{APP}/appPricePoints?" + urllib.parse.urlencode({"filter[territory]": "USA", "limit": 200}))
        free = next((p for p in (pts or {}).get("data", []) if float(p["attributes"].get("customerPrice") or 1) == 0), None)
        if free:
            body = {"data": {"type": "appPriceSchedules", "relationships": {
                        "app": {"data": {"type": "apps", "id": APP}},
                        "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
                        "manualPrices": {"data": [{"type": "appPrices", "id": "${p0}"}]}}},
                    "included": [{"type": "appPrices", "id": "${p0}", "attributes": {"startDate": None},
                                  "relationships": {"appPricePoint": {"data": {"type": "appPricePoints", "id": free["id"]}}}}]}
            st, r = call("POST", "/v1/appPriceSchedules", body)
            print(f"app price -> Free: {'OK' if st in (200, 201) else err(r)}")
        else:
            print("app price: free price point not found")
    terr = get("/v1/territories?limit=200")
    excluded = {t.strip() for t in os.environ.get("EXCLUDE_TERRITORIES", "CHN").split(",") if t.strip()}
    all_t = [t["id"] for t in (terr or {}).get("data", []) if t["id"] not in excluded]
    if av and av.get("data") and excluded:
        ta = get(f"/v2/appAvailabilities/{av['data']['id']}/territoryAvailabilities?limit=200&include=territory")
        for t in (ta or {}).get("data", []):
            tid = t.get("relationships", {}).get("territory", {}).get("data", {}).get("id")
            if tid in excluded and t["attributes"].get("available"):
                st, r = call("PATCH", f"/v1/territoryAvailabilities/{t['id']}", {"data": {
                    "type": "territoryAvailabilities", "id": t["id"], "attributes": {"available": False}}})
                print(f"app availability: remove {tid}: {'OK' if st == 200 else err(r)}")
    if not (av and av.get("data")) and all_t:
        body = {"data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": True},
                         "relationships": {"app": {"data": {"type": "apps", "id": APP}},
                                           "territoryAvailabilities": {"data": [
                                               {"type": "territoryAvailabilities", "id": f"${{t{i}}}"}
                                               for i, _ in enumerate(all_t)]}}},
                "included": [{"type": "territoryAvailabilities", "id": f"${{t{i}}}", "attributes": {"available": True},
                              "relationships": {"territory": {"data": {"type": "territories", "id": t}}}}
                             for i, t in enumerate(all_t)]}
        st, r = call("POST", "/v2/appAvailabilities", body)
        print(f"app availability -> {len(all_t)} territories (without {','.join(sorted(excluded)) or 'none'}): {'OK' if st in (200, 201) else err(r)}")
        if st in (200, 201):
            problems[:] = [p for p in problems if "availability (territories)" not in p]
    if iap and all_t:
        ia = get(f"/v2/inAppPurchases/{iap['id']}/inAppPurchaseAvailability")
        stale = False
        if ia and ia.get("data") and excluded:
            have = get(f"/v1/inAppPurchaseAvailabilities/{ia['data']['id']}/availableTerritories?limit=200")
            stale = any(t["id"] in excluded for t in (have or {}).get("data", []))
        if not (ia and ia.get("data")) or stale:
            st, r = call("POST", "/v1/inAppPurchaseAvailabilities", {"data": {
                "type": "inAppPurchaseAvailabilities", "attributes": {"availableInNewTerritories": True},
                "relationships": {"inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap["id"]}},
                                  "availableTerritories": {"data": [{"type": "territories", "id": t} for t in all_t]}}}})
            print(f"IAP availability -> {len(all_t)} territories (without {','.join(sorted(excluded)) or 'none'}): {'OK' if st in (200, 201) else err(r)}")
    if iap and not iap_shot and IAP_SHOT and os.path.exists(IAP_SHOT):
        blob = open(IAP_SHOT, "rb").read()
        st, r = call("POST", "/v1/inAppPurchaseAppStoreReviewScreenshots", {"data": {
            "type": "inAppPurchaseAppStoreReviewScreenshots",
            "attributes": {"fileName": os.path.basename(IAP_SHOT), "fileSize": len(blob)},
            "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap["id"]}}}}})
        if st == 201:
            sid = r["data"]["id"]
            for op in r["data"]["attributes"]["uploadOperations"]:
                part = blob[op["offset"]:op["offset"] + op["length"]]
                hdrs = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
                req = urllib.request.Request(op["url"], data=part, method=op["method"], headers=hdrs)
                urllib.request.urlopen(req, timeout=120).read()
            st, r = call("PATCH", f"/v1/inAppPurchaseAppStoreReviewScreenshots/{sid}", {"data": {
                "type": "inAppPurchaseAppStoreReviewScreenshots", "id": sid,
                "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(blob).hexdigest()}}})
            print(f"IAP review screenshot upload: {'OK' if st == 200 else err(r)}")
            problems[:] = [p for p in problems if "IAP review screenshot" not in p]
        else:
            print(f"IAP review screenshot: {err(r)}")

section("Still needed before Submit for Review (cannot be checked or done by API: App Privacy, DSA trader status)")
for p in problems:
    print(f"  - {p}")
if not problems:
    print("  nothing found by the API")
print("\nNothing was submitted for review.")
