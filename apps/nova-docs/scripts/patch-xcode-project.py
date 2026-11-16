#!/usr/bin/env python3
"""
يضيف ملفات NOVA Docs الأصلية إلى مشروع Xcode الذي يولّده Capacitor (عملية متكررة الأمان / idempotent):
  - App/Native/*.swift                → مصادر الهدف App
  - App/PrivacyInfo.xcprivacy         → موارد الهدف
  - App/xx.lproj/InfoPlist.strings    → مجموعة ترجمات (14 لغة)
  - App/NovaDocs.storekit             → مرجع فقط (لا يُضمَّن في الحزمة؛ يُستعمل من المخطط Scheme)
  - إعدادات البناء: iOS 16.0، الإصدار 1.0.0 (1)، Bundle ID مستقل
ويكتب مخطط Scheme مشتركًا يربط ملف StoreKit للاختبار المحلي.
"""
import hashlib, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
IOS = os.path.join(HERE, '..', 'ios', 'App')
PBX = os.path.join(IOS, 'App.xcodeproj', 'project.pbxproj')
APP_DIR = os.path.join(IOS, 'App')
TARGET_ID = '504EC3031FED79650016851F'
APP_GROUP = '504EC3061FED79650016851F'
SOURCES_PHASE = '504EC3001FED79650016851F'
RESOURCES_PHASE = '504EC3021FED79650016851F'
BUNDLE_ID = os.environ.get('NOVA_BUNDLE_ID', 'com.haigoune.novadocs')
VERSION = '1.0.0'
BUILD = os.environ.get('NOVA_BUILD_NUMBER', '1')
DEPLOYMENT = '16.0'

def uid(name: str) -> str:
    return hashlib.md5(('nova:' + name).encode()).hexdigest()[:24].upper()

s = open(PBX, encoding='utf-8').read()

def insert_in_section(section: str, text: str):
    global s
    marker = f'/* End {section} section */'
    if marker not in s:
        # إنشاء القسم إن لم يوجد (قبل القسم التالي أبجديًا لا يهم لـ Xcode)
        s = s.replace('/* Begin PBXVariantGroup section */', f'/* Begin {section} section */\n/* End {section} section */\n\n/* Begin PBXVariantGroup section */')
    s = s.replace(marker, text + marker)

def add_to_list(owner_id: str, key: str, entry: str):
    """يضيف عنصرًا إلى قائمة (children/files) لكائن معيّن."""
    global s
    m = re.search(re.escape(owner_id) + r' /\*[^*]*\*/ = \{.*?' + key + r' = \((.*?)\);', s, re.S)
    if not m:
        raise SystemExit(f'cannot find {key} of {owner_id}')
    if entry.split(' ')[0] in m.group(1):
        return
    start, end = m.span(1)
    s = s[:end] + f'\t\t\t\t{entry},\n\t\t\t' + s[end:].lstrip()

changed = []

# ---------------------------------------------------------------- Swift sources
native = sorted(f for f in os.listdir(os.path.join(APP_DIR, 'Native')) if f.endswith('.swift'))
group_id = uid('group:Native')
if group_id not in s:
    children = ''.join(f'\t\t\t\t{uid("ref:" + f)} /* {f} */,\n' for f in native)
    insert_in_section('PBXGroup', f'\t\t{group_id} /* Native */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n{children}\t\t\t);\n\t\t\tpath = Native;\n\t\t\tsourceTree = "<group>";\n\t\t}};\n')
    add_to_list(APP_GROUP, 'children', f'{group_id} /* Native */')
    changed.append('Native group')
for f in native:
    ref, build = uid('ref:' + f), uid('build:' + f)
    if f'{ref} /* {f} */ = {{isa = PBXFileReference' not in s:
        insert_in_section('PBXFileReference', f'\t\t{ref} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};\n')
        changed.append(f'ref {f}')
    if build not in s:
        insert_in_section('PBXBuildFile', f'\t\t{build} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {f} */; }};\n')
        add_to_list(SOURCES_PHASE, 'files', f'{build} /* {f} in Sources */')
        changed.append(f'source {f}')
    add_to_list(group_id, 'children', f'{ref} /* {f} */')

# ---------------------------------------------------------------- Privacy manifest (resource)
ref, build = uid('ref:PrivacyInfo'), uid('build:PrivacyInfo')
if ref not in s:
    insert_in_section('PBXFileReference', f'\t\t{ref} /* PrivacyInfo.xcprivacy */ = {{isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; }};\n')
    insert_in_section('PBXBuildFile', f'\t\t{build} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; fileRef = {ref} /* PrivacyInfo.xcprivacy */; }};\n')
    add_to_list(APP_GROUP, 'children', f'{ref} /* PrivacyInfo.xcprivacy */')
    add_to_list(RESOURCES_PHASE, 'files', f'{build} /* PrivacyInfo.xcprivacy in Resources */')
    changed.append('PrivacyInfo.xcprivacy')

# ---------------------------------------------------------------- StoreKit configuration (reference only)
ref = uid('ref:storekit')
if ref not in s:
    insert_in_section('PBXFileReference', f'\t\t{ref} /* NovaDocs.storekit */ = {{isa = PBXFileReference; lastKnownFileType = text; path = NovaDocs.storekit; sourceTree = "<group>"; }};\n')
    add_to_list(APP_GROUP, 'children', f'{ref} /* NovaDocs.storekit */')
    changed.append('NovaDocs.storekit')

# ---------------------------------------------------------------- InfoPlist.strings (14 languages)
langs = sorted(d[:-6] for d in os.listdir(APP_DIR) if d.endswith('.lproj') and d != 'Base.lproj' and os.path.exists(os.path.join(APP_DIR, d, 'InfoPlist.strings')))
vg, vbuild = uid('variant:InfoPlist.strings'), uid('build:InfoPlist.strings')
if vg not in s:
    kids = ''.join(f'\t\t\t\t{uid("ref:strings:" + l)} /* {l} */,\n' for l in langs)
    s = s.replace('/* End PBXVariantGroup section */', f'\t\t{vg} /* InfoPlist.strings */ = {{\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n{kids}\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t}};\n/* End PBXVariantGroup section */')
    for l in langs:
        insert_in_section('PBXFileReference', f'\t\t{uid("ref:strings:" + l)} /* {l} */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = {l}; path = {l}.lproj/InfoPlist.strings; sourceTree = "<group>"; }};\n')
    insert_in_section('PBXBuildFile', f'\t\t{vbuild} /* InfoPlist.strings in Resources */ = {{isa = PBXBuildFile; fileRef = {vg} /* InfoPlist.strings */; }};\n')
    add_to_list(APP_GROUP, 'children', f'{vg} /* InfoPlist.strings */')
    add_to_list(RESOURCES_PHASE, 'files', f'{vbuild} /* InfoPlist.strings in Resources */')
    changed.append('InfoPlist.strings x%d' % len(langs))
m = re.search(r'knownRegions = \((.*?)\);', s, re.S)
regions = set(re.findall(r'[\w"-]+', m.group(1)))
missing = [l for l in langs if l not in regions and f'"{l}"' not in regions]
if missing:
    add = ''.join(f'\t\t\t\t{l if "-" not in l else chr(34) + l + chr(34)},\n' for l in missing)
    s = s[:m.end(1)] + add + '\t\t\t' + s[m.end(1):].lstrip()
    changed.append('knownRegions')

# ---------------------------------------------------------------- build settings
before = s
s = re.sub(r'IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;', f'IPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT};', s)
s = re.sub(r'MARKETING_VERSION = [\d.]+;', f'MARKETING_VERSION = {VERSION};', s)
s = re.sub(r'CURRENT_PROJECT_VERSION = \d+;', f'CURRENT_PROJECT_VERSION = {BUILD};', s)
s = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = [\w.\-]+;', f'PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};', s)
s = s.replace('\t\t\t\tSDKROOT = iphoneos;\n\t\t\t\tSDKROOT = iphoneos;\n', '\t\t\t\tSDKROOT = iphoneos;\n')
if s != before:
    changed.append('build settings')

open(PBX, 'w', encoding='utf-8').write(s)

# ---------------------------------------------------------------- shared scheme (StoreKit configuration)
scheme_dir = os.path.join(IOS, 'App.xcodeproj', 'xcshareddata', 'xcschemes')
os.makedirs(scheme_dir, exist_ok=True)
buildable = f'''<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{TARGET_ID}"
               BuildableName = "App.app"
               BlueprintName = "App"
               ReferencedContainer = "container:App.xcodeproj">
            </BuildableReference>'''
scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            {buildable}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {buildable}
      </BuildableProductRunnable>
      <StoreKitConfigurationFileReference
         identifier = "../App/NovaDocs.storekit">
      </StoreKitConfigurationFileReference>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {buildable}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
'''
open(os.path.join(scheme_dir, 'App.xcscheme'), 'w').write(scheme)
print('changed:', ', '.join(changed) or 'nothing (already patched)')
