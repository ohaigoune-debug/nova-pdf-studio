#!/usr/bin/env python3
"""Validate project references and public build metadata without claiming an Xcode build."""

import argparse
import json
from pathlib import Path
import plistlib
import re
import struct
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


class OpenStepParser:
    """Small OpenStep plist reader for this committed pbxproj (no third-party dependency)."""

    def __init__(self, text):
        pattern = r'\s+|//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|[{}()=;,]|[^\s{}()=;,"]+'
        self.tokens = [
            token for token in re.findall(pattern, text, flags=re.S)
            if not token.isspace() and not token.startswith(('//', '/*'))
        ]
        self.position = 0

    def take(self, expected=None):
        token = self.tokens[self.position]
        self.position += 1
        if expected is not None and token != expected:
            raise ValueError(f'Expected {expected!r}, found {token!r}')
        return token

    def value(self):
        token = self.take()
        if token == '{':
            result = {}
            while self.tokens[self.position] != '}':
                key = self.take()
                key = json.loads(key) if key.startswith('"') else key
                if key in result:
                    raise ValueError(f'Duplicate OpenStep key: {key}')
                self.take('=')
                result[key] = self.value()
                self.take(';')
            self.take('}')
            return result
        if token == '(':
            result = []
            while self.tokens[self.position] != ')':
                result.append(self.value())
                if self.tokens[self.position] == ',':
                    self.take(',')
                elif self.tokens[self.position] != ')':
                    raise ValueError('Expected comma in OpenStep array')
            self.take(')')
            return result
        return json.loads(token) if token.startswith('"') else token

    def parse(self):
        value = self.value()
        if self.position != len(self.tokens):
            raise ValueError('Unparsed trailing OpenStep data')
        return value


def png_header(path):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {path}'
    width, height, bit_depth, color_type = struct.unpack('>IIBB', data[16:26])
    assert bit_depth == 8, f'Unexpected bit depth in {path}'
    offset = 8
    transparent = color_type in (4, 6)
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        transparent |= kind == b'tRNS'
        offset += length + 12
    return width, height, transparent


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--allow-pending-sources', action='store_true')
    args.add_argument('--require-generated-app-icon', action='store_true')
    options = args.parse_args()

    project_path = ROOT / 'Madrasadz.xcodeproj/project.pbxproj'
    project = OpenStepParser(project_path.read_text()).parse()
    objects = project['objects']
    assert len(objects) == len(set(objects))
    assert objects[project['rootObject']]['isa'] == 'PBXProject'
    assert project['objectVersion'] == '77', 'Synchronized groups require Xcode 16+'

    ids = re.compile(r'^[0-9A-F]{24}$')

    def validate_references(value):
        if isinstance(value, dict):
            for entry in value.values():
                validate_references(entry)
        elif isinstance(value, list):
            for entry in value:
                validate_references(entry)
        elif isinstance(value, str) and ids.fullmatch(value):
            assert value in objects, f'Broken project object reference: {value}'

    validate_references(project)
    root_project = objects[project['rootObject']]
    targets = [objects[target] for target in root_project['targets']]
    assert {target['name'] for target in targets} == {'Madrasadz', 'MadrasadzUITests'}
    app = next(target for target in targets if target['name'] == 'Madrasadz')
    assert objects[app['buildPhases'][0]]['isa'] == 'PBXShellScriptBuildPhase'
    assert 'prepare-assets.sh' in objects[app['buildPhases'][0]]['shellScript']
    assert app['packageProductDependencies'], 'Core package is not linked'
    for reference in root_project['packageReferences']:
        package = objects[reference]
        assert package['isa'] == 'XCLocalSwiftPackageReference'
        if not options.allow_pending_sources:
            assert (ROOT / package['relativePath'] / 'Package.swift').is_file()

    scheme = ET.parse(ROOT / 'Madrasadz.xcodeproj/xcshareddata/xcschemes/Madrasadz.xcscheme')
    for reference in scheme.findall('.//BuildableReference'):
        target = objects[reference.attrib['BlueprintIdentifier']]
        assert target['name'] == reference.attrib['BlueprintName']
    assert scheme.find('.//TestableReference').attrib['skipped'] == 'NO'

    info = plistlib.loads((ROOT / 'Configuration/Info.plist').read_bytes())
    privacy = plistlib.loads((ROOT / 'Resources/PrivacyInfo.xcprivacy').read_bytes())
    assert info['NSAppTransportSecurity']['NSAllowsArbitraryLoads'] is False
    assert 'NSExceptionDomains' not in info['NSAppTransportSecurity']
    assert set(info['CFBundleLocalizations']) == {'ar', 'fr', 'en'}
    assert info['MadrasadzDistributionMode'] == 'study-only'
    assert 'ITSAppUsesNonExemptEncryption' not in info, 'Export-compliance classification requires an owner decision before distribution'
    assert privacy['NSPrivacyTracking'] is False
    assert not privacy['NSPrivacyTrackingDomains']
    assert not any(key.endswith('UsageDescription') for key in info), 'Unexpected sensitive permission'
    ET.parse(ROOT / 'Resources/LaunchScreen.storyboard')

    source_width, source_height, source_alpha = png_header(ROOT / 'Resources/AppIcon-Source.png')
    assert source_width == source_height and source_width >= 1024 and not source_alpha
    logo_width, logo_height, _ = png_header(ROOT / 'Resources/Assets.xcassets/BrandLogo.imageset/BrandLogo.png')
    assert (logo_width, logo_height) == (2172, 724)
    for catalog in (ROOT / 'Resources/Assets.xcassets').rglob('Contents.json'):
        json.loads(catalog.read_text())
    generated = ROOT / 'Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
    if generated.exists():
        assert png_header(generated) == (1024, 1024, False)
    else:
        assert not options.require_generated_app_icon, 'Run scripts/prepare-assets.sh on macOS first'

    if not options.allow_pending_sources:
        for filename in ('MadrasadzApp.swift', 'AppModel.swift', 'BrowserController.swift', 'StudyViews.swift'):
            assert (ROOT / 'Sources/MadrasadzApp' / filename).is_file(), f'Missing app source: {filename}'
        assert (ROOT / 'Tests/MadrasadzUITests/MadrasadzUITests.swift').is_file()
    print(f'PASS: OpenStep project parsed; {len(objects)} references resolved; scheme/plists/storyboard/assets valid.')
    if not generated.exists():
        print('AppIcon export: pending macOS sips (build phase and scripts/prepare-assets.sh).')
    if options.allow_pending_sources:
        print('Source existence checks skipped by explicit --allow-pending-sources; not a complete implementation validation.')
    print('This is structural validation, not an iOS compile, Simulator run, signing check, or App Store validation.')


if __name__ == '__main__':
    main()
