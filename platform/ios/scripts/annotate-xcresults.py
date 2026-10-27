#!/usr/bin/env python3
"""Surface Simulator test failures and the Debug technical log as GitHub annotations.

Job logs and artifacts can be unavailable to reviewers; check-run annotations are
not. Only test names, assertion messages and the no-account technical log (codes,
timings, sizes — no URLs, page text, cookies or credentials) are emitted.
Usage: annotate-xcresults.py BUILD_DIR
"""
import json
import pathlib
import subprocess
import sys


def escape(text: str) -> str:
    return text.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')


def failures(result: pathlib.Path):
    try:
        raw = subprocess.run(['xcrun', 'xcresulttool', 'get', 'test-results', 'tests', '--path', str(result)],
                             capture_output=True, text=True, timeout=120, check=True).stdout
        data = json.loads(raw)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return []
    found = []

    def walk(node, test=None):
        kind = node.get('nodeType')
        name = node.get('name', '')
        if kind == 'Test Case':
            test = name
        if kind == 'Failure Message':
            found.append(f'{test or "?"}: {name}')
        for child in node.get('children', []) or []:
            walk(child, test)

    for node in data.get('testNodes', []) or []:
        walk(node)
    return found


def technical_logs(attachments: pathlib.Path):
    logs = []
    if not attachments.is_dir():
        return logs
    for path in sorted(attachments.rglob('*')):
        if not path.is_file() or path.stat().st_size > 512_000:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        if text.startswith('Madrasadz foreground diagnostics v1'):
            logs.append(text)
    return logs


def main() -> int:
    build = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('platform/ios/build')
    for result in sorted(build.glob('*.xcresult')):
        for message in failures(result)[:8]:
            print(f'::error title={escape(result.name)}::{escape(message[:3000])}')
        for log in technical_logs(pathlib.Path(str(result) + '-attachments'))[:1]:
            tail = '\n'.join(log.splitlines()[-60:])
            print(f'::notice title=Technical log {escape(result.name)}::{escape(tail[:6000])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
