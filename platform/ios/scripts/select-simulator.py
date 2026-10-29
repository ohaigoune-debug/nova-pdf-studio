#!/usr/bin/env python3
"""Choose an installed iPhone deterministically; never create or download a runtime."""
import json
import re
import sys

UUID = re.compile(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")


def select_device(data, requested=None):
    if requested is not None and not UUID.fullmatch(requested):
        raise ValueError("Expected an installed iPhone Simulator UUID.")
    candidates = []
    for runtime, devices in data.get("devices", {}).items():
        match = re.fullmatch(r"com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)(?:-(\d+))?(?:-(\d+))?", runtime)
        if not match:
            continue
        version = tuple(int(part or 0) for part in match.groups())
        if version[0] < 17:
            continue
        for device in devices:
            identifier = device.get("udid", "")
            if device.get("isAvailable") is not True or not UUID.fullmatch(identifier):
                continue
            if not device.get("name", "").startswith("iPhone"):
                continue
            if requested is None or identifier.lower() == requested.lower():
                candidates.append((version, device.get("state") == "Booted", device["name"], identifier))
    if not candidates:
        raise ValueError("No matching available iPhone Simulator with iOS 17+. Install a runtime in Xcode Settings > Components, or supply an available iPhone UUID.")
    return max(candidates)[3]


if __name__ == "__main__":
    try:
        if len(sys.argv) > 2:
            raise ValueError("Usage: select-simulator.py [SIMULATOR_UUID]")
        print(select_device(json.load(sys.stdin), sys.argv[1] if len(sys.argv) == 2 else None))
    except (ValueError, TypeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
