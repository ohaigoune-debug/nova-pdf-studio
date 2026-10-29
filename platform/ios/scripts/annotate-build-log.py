#!/usr/bin/env python3
"""Surface compiler/linker errors from an xcodebuild log as GitHub annotations.

Job logs are not always readable by reviewers; check-run annotations are. Only
the file name, line and the compiler's message are emitted (no paths outside
the repository, environment, or credentials).
Usage: annotate-build-log.py LOG [TITLE]
"""
import pathlib
import re
import sys

PATTERN = re.compile(r'^(?P<file>/[^:]+):(?P<line>\d+):(?:(?P<col>\d+):)? (?:fatal )?error: (?P<message>.+)$')


def escape(text: str) -> str:
    return text.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')


def main() -> int:
    if len(sys.argv) < 2:
        print('Usage: annotate-build-log.py LOG [TITLE]', file=sys.stderr)
        return 2
    log = pathlib.Path(sys.argv[1])
    title = sys.argv[2] if len(sys.argv) > 2 else 'xcodebuild'
    if not log.is_file():
        return 0
    seen = set()
    emitted = 0
    for raw in log.read_text(encoding='utf-8', errors='replace').splitlines():
        line = raw.strip()
        match = PATTERN.match(line)
        if match:
            name = pathlib.Path(match.group('file')).name
            text = f"{name}:{match.group('line')}: {match.group('message')}"
        elif line.startswith('error: ') or ' error: ' in line and line.startswith(('ld:', 'clang:', 'xcodebuild:')):
            text = line
        else:
            continue
        if text in seen:
            continue
        seen.add(text)
        print(f'::error title={escape(title)}::{escape(text[:1500])}')
        emitted += 1
        if emitted >= 25:
            break
    return 0


if __name__ == '__main__':
    sys.exit(main())
