"""Linux-hosted validation of build tooling, NOT an Xcode/Simulator test."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('selector', ROOT / 'select-simulator.py')
selector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selector)

OLD = '11111111-1111-1111-1111-111111111111'
NEW = '22222222-2222-2222-2222-222222222222'


def device(identifier, name='iPhone 16', available=True, state='Shutdown'):
    return dict(udid=identifier, name=name, isAvailable=available, state=state)


class SimulatorSelectionTests(unittest.TestCase):
    def setUp(self):
        self.data = {'devices': {
            'com.apple.CoreSimulator.SimRuntime.iOS-17-5': [device(OLD)],
            'com.apple.CoreSimulator.SimRuntime.iOS-26-1': [device(NEW)]}}

    def test_selects_newest_runtime_independent_of_input_order(self):
        self.assertEqual(selector.select_device(self.data), NEW)
        self.data['devices'] = dict(reversed(list(self.data['devices'].items())))
        self.assertEqual(selector.select_device(self.data), NEW)

    def test_can_explicitly_select_supported_older_runtime(self):
        self.assertEqual(selector.select_device(self.data, OLD), OLD)

    def test_filters_unavailable_ipad_and_wrong_os(self):
        self.data['devices']['com.apple.CoreSimulator.SimRuntime.iOS-27-0'] = [device(NEW, available=False), device(NEW, name='iPad Pro')]
        self.data['devices']['com.apple.CoreSimulator.SimRuntime.tvOS-27-0'] = [device(NEW)]
        self.assertEqual(selector.select_device(self.data), NEW)

    def test_rejects_unsupported_runtime(self):
        with self.assertRaises(ValueError):
            selector.select_device({'devices': {'com.apple.CoreSimulator.SimRuntime.iOS-16-4': [device(OLD)]}})

    def test_rejects_unavailable_explicit_uuid(self):
        with self.assertRaises(ValueError):
            selector.select_device(self.data, '33333333-3333-3333-3333-333333333333')

    def test_rejects_uuid_shaped_argument_with_wrong_grouping(self):
        with self.assertRaises(ValueError):
            selector.select_device(self.data, '-' * 36)

    def test_prefers_booted_device_within_newest_runtime(self):
        self.data['devices']['com.apple.CoreSimulator.SimRuntime.iOS-26-1'].append(device(OLD, state='Booted'))
        self.assertEqual(selector.select_device(self.data), OLD)


class ToolchainPreflightTests(unittest.TestCase):
    def run_preflight(self, host='Darwin', xcode='26.1', sdk='26.1'):
        # Stub CLI outputs exercise parsing and fail-closed gates only.
        # They are never used to claim native compilation or Mac availability.
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            scripts = {
                'uname': f'#!/bin/sh\necho "{host}"\n',
                'xcodebuild': f'#!/bin/sh\nif [ "$#" -eq 1 ]; then printf "Xcode {xcode}\\nBuild version fixture\\n"; else echo "{sdk}"; fi\n',
                'xcrun': '#!/bin/sh\nexit 0\n'}
            for name, content in scripts.items():
                path = folder / name
                path.write_text(content)
                path.chmod(0o700)
            environment = dict(os.environ, PATH=f'{directory}:/usr/bin:/bin')
            return subprocess.run(['bash', str(ROOT / 'check-xcode.sh')], env=environment, capture_output=True, text=True)

    def test_rejects_linux_even_when_cli_names_exist(self):
        self.assertNotEqual(self.run_preflight(host='Linux').returncode, 0)

    def test_rejects_old_xcode(self):
        self.assertNotEqual(self.run_preflight(xcode='16.4').returncode, 0)

    def test_rejects_missing_or_old_sdk(self):
        self.assertNotEqual(self.run_preflight(sdk='18.5').returncode, 0)
        self.assertNotEqual(self.run_preflight(sdk='unknown').returncode, 0)

    def test_accepts_current_and_future_toolchain_metadata(self):
        self.assertEqual(self.run_preflight().returncode, 0)
        self.assertEqual(self.run_preflight(xcode='27.0', sdk='27.0').returncode, 0)

    def test_build_and_test_reject_unknown_configuration_before_tools(self):
        for name, arguments in [('build-unsigned.sh', ['Unknown']), ('test-ios.sh', ['auto', 'Unknown'])]:
            result = subprocess.run(['bash', str(ROOT / name), *arguments], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn('Usage:', result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
