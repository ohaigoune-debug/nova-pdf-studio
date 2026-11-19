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
    m = re.search(re.escape(owner_id) + r'(?: /\*[^*]*\*/)? = \{.*?' + key + r' = \((.*?)\);', s, re.S)
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

# ---------------------------------------------------------------- AppTests: StoreKit Testing (SKTestSession) unit tests
# هدف اختبار مستضاف داخل التطبيق؛ يُبنى فقط عند `xcodebuild test` (ليس ضمن الأرشفة/TestFlight).
PROJECT_ID = '504EC2FC1FED79650016851F'
PRODUCTS_GROUP = '504EC3051FED79650016851F'
MAIN_GROUP = re.search(r'mainGroup = (\w+);', s).group(1)
TEST_TARGET = uid('target:AppTests')
tests_dir = os.path.join(IOS, 'AppTests')
test_sources = sorted(f for f in os.listdir(tests_dir) if f.endswith('.swift')) if os.path.isdir(tests_dir) else []
if test_sources and TEST_TARGET not in s:
    product_ref = uid('ref:AppTests.xctest')
    tgroup = uid('group:AppTests')
    src_phase, res_phase, fw_phase = uid('phase:tests:sources'), uid('phase:tests:resources'), uid('phase:tests:frameworks')
    proxy, dep = uid('proxy:tests->app'), uid('dep:tests->app')
    cfg_list, cfg_debug, cfg_release = uid('cfglist:tests'), uid('cfg:tests:debug'), uid('cfg:tests:release')
    # ملفات الاختبار + الملف المشترك مع التطبيق + ملف StoreKit كمورد
    kids = ''
    for f in test_sources:
        ref = uid('ref:tests:' + f)
        insert_in_section('PBXFileReference', f'\t\t{ref} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};\n')
        kids += f'\t\t\t\t{ref} /* {f} */,\n'
    insert_in_section('PBXFileReference', f'\t\t{product_ref} /* AppTests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = AppTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};\n')
    insert_in_section('PBXGroup', f'\t\t{tgroup} /* AppTests */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n{kids}\t\t\t);\n\t\t\tpath = AppTests;\n\t\t\tsourceTree = "<group>";\n\t\t}};\n')
    add_to_list(MAIN_GROUP, 'children', f'{tgroup} /* AppTests */')
    add_to_list(PRODUCTS_GROUP, 'children', f'{product_ref} /* AppTests.xctest */')
    src_files = ''
    for f in test_sources:
        b = uid('build:tests:' + f)
        insert_in_section('PBXBuildFile', f'\t\t{b} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid("ref:tests:" + f)} /* {f} */; }};\n')
        src_files += f'\t\t\t\t{b} /* {f} in Sources */,\n'
    shared = 'NovaEntitlements.swift'
    b = uid('build:tests:' + shared)
    insert_in_section('PBXBuildFile', f'\t\t{b} /* {shared} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid("ref:" + shared)} /* {shared} */; }};\n')
    src_files += f'\t\t\t\t{b} /* {shared} in Sources */,\n'
    sk = uid('build:tests:storekit')
    insert_in_section('PBXBuildFile', f'\t\t{sk} /* NovaDocs.storekit in Resources */ = {{isa = PBXBuildFile; fileRef = {uid("ref:storekit")} /* NovaDocs.storekit */; }};\n')
    insert_in_section('PBXSourcesBuildPhase', f'\t\t{src_phase} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n{src_files}\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n')
    insert_in_section('PBXResourcesBuildPhase', f'\t\t{res_phase} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t{sk} /* NovaDocs.storekit in Resources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n')
    insert_in_section('PBXFrameworksBuildPhase', f'\t\t{fw_phase} /* Frameworks */ = {{\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n')
    insert_in_section('PBXContainerItemProxy', f'\t\t{proxy} /* PBXContainerItemProxy */ = {{\n\t\t\tisa = PBXContainerItemProxy;\n\t\t\tcontainerPortal = {PROJECT_ID} /* Project object */;\n\t\t\tproxyType = 1;\n\t\t\tremoteGlobalIDString = {TARGET_ID};\n\t\t\tremoteInfo = App;\n\t\t}};\n')
    insert_in_section('PBXTargetDependency', f'\t\t{dep} /* PBXTargetDependency */ = {{\n\t\t\tisa = PBXTargetDependency;\n\t\t\ttarget = {TARGET_ID} /* App */;\n\t\t\ttargetProxy = {proxy} /* PBXContainerItemProxy */;\n\t\t}};\n')
    def cfg(cid, name):
        return (f'\t\t{cid} /* {name} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n'
                f'\t\t\t\tBUNDLE_LOADER = "$(TEST_HOST)";\n'
                f'\t\t\t\tCODE_SIGN_STYLE = Automatic;\n'
                f'\t\t\t\tCURRENT_PROJECT_VERSION = {BUILD};\n'
                f'\t\t\t\tGENERATE_INFOPLIST_FILE = YES;\n'
                f'\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT};\n'
                f'\t\t\t\tMARKETING_VERSION = {VERSION};\n'
                f'\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID}.storekittests;\n'
                f'\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";\n'
                f'\t\t\t\tSDKROOT = iphoneos;\n'
                f'\t\t\t\tSWIFT_EMIT_LOC_STRINGS = NO;\n'
                f'\t\t\t\tSWIFT_VERSION = 5.0;\n'
                f'\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";\n'
                f'\t\t\t\tTEST_HOST = "$(BUILT_PRODUCTS_DIR)/App.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/App";\n'
                f'\t\t\t}};\n\t\t\tname = {name};\n\t\t}};\n')
    insert_in_section('XCBuildConfiguration', cfg(cfg_debug, 'Debug') + cfg(cfg_release, 'Release'))
    insert_in_section('XCConfigurationList', f'\t\t{cfg_list} /* Build configuration list for PBXNativeTarget "AppTests" */ = {{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t{cfg_debug} /* Debug */,\n\t\t\t\t{cfg_release} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}};\n')
    insert_in_section('PBXNativeTarget', f'\t\t{TEST_TARGET} /* AppTests */ = {{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {cfg_list} /* Build configuration list for PBXNativeTarget "AppTests" */;\n\t\t\tbuildPhases = (\n\t\t\t\t{src_phase} /* Sources */,\n\t\t\t\t{fw_phase} /* Frameworks */,\n\t\t\t\t{res_phase} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t\t{dep} /* PBXTargetDependency */,\n\t\t\t);\n\t\t\tname = AppTests;\n\t\t\tproductName = AppTests;\n\t\t\tproductReference = {product_ref} /* AppTests.xctest */;\n\t\t\tproductType = "com.apple.product-type.bundle.unit-test";\n\t\t}};\n')
    add_to_list(PROJECT_ID, 'targets', f'{TEST_TARGET} /* AppTests */')
    changed.append('AppTests target (%d test files)' % len(test_sources))

# ---------------------------------------------------------------- build settings
before = s
s = re.sub(r'IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;', f'IPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT};', s)
s = re.sub(r'MARKETING_VERSION = [\d.]+;', f'MARKETING_VERSION = {VERSION};', s)
s = re.sub(r'CURRENT_PROJECT_VERSION = \d+;', f'CURRENT_PROJECT_VERSION = {BUILD};', s)
s = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = (?![\w.\-]*\.storekittests;)[\w.\-]+;', f'PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};', s)
s = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = [\w.\-]*\.storekittests;', f'PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID}.storekittests;', s)
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
testables = ''
if test_sources:
    testables = f'''<Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{TEST_TARGET}"
               BuildableName = "AppTests.xctest"
               BlueprintName = "AppTests"
               ReferencedContainer = "container:App.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>'''
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
      {testables}
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
