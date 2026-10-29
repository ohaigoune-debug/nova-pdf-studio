"""
فحص النقل الحرفيّ لسجلّ مصدر مقابل طبقة نصّ ورقة الموضوع (PDF رقميّ).

    python3 scripts/play/record_wordcheck.py <record.json> <paper.pdf> [--topic 1|2] [--correction <correction.pdf>]
    python3 scripts/play/record_wordcheck.py --lines <paper.pdf>   ⇐ يطبع أسطر طبقة النصّ المركّبة (للمقارنة اليدويّة)

يطبع لكلّ سؤال/وثيقة يحيل إليها سؤالٌ الكلماتِ التي لا توجد في طبقة النصّ، ثمّ بين [ ] الكلماتِ التي لا تختلف إلّا
في الهمزة أو التاء المربوطة أو الياء. ليس حكمًا نهائيًّا: طبقة نصّ أوراق الديوان تخزّن قطع الكلمة بالترتيب البصريّ
(يُعاد تركيبها هنا من مواضع الحروف)، وتقلب الأرقام أو تبدّلها (لا تُقارن الأرقام). كلّ كلمة مطبوعة تُراجَع على صورة الصفحة.
التشكيل والتطويل وعلامات الترقيم لا تُقارَن.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata

BIDI = ''.join(chr(c) for c in (0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x200E, 0x200F, 0x2066, 0x2067, 0x2068, 0x2069))
HARAKAT = re.compile('[' + chr(0x064B) + '-' + chr(0x065F) + chr(0x0670) + chr(0x0640) + ']')  # تشكيل وتطويل


def strict(w: str) -> str:
    """بلا تشكيل ولا تطويل ولا ترقيم؛ الهمزات والتاء المربوطة والياء كما هي."""
    w = HARAKAT.sub('', unicodedata.normalize('NFKC', w))
    return re.sub(r'[^\w]', '', w)


def norm(w: str) -> str:
    w = strict(w)
    return re.sub('[أإآٱ]', 'ا', w).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')


def lig(w: str) -> str:
    """الطبقة تخزّن «لا» المركّبة «ال» بعد القلب: تُقلب في كلمة السجلّ للمقارنة."""
    return re.sub('ل([اأإآ])', r'\1ل', w)


def layer_lines(pdf: str) -> list[str]:
    """أسطر الورقة من مواضع الحروف (pdftotext -bbox): القطع مخزّنة بالترتيب البصريّ، فتُرتَّب من اليمين وتُقلب
    القطع العربيّة، وتُلصق القطع المتلاصقة (فجوة < 1.2 نقطة) وتُفصل البقيّة بمسافة."""
    html = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True, check=True).stdout
    rows: dict[tuple[int, float], list[tuple[float, float, str]]] = {}
    page = 0
    for m in re.finditer(r'<page |<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>', html):
        if m.group(0).startswith('<page'):
            page += 1
            continue
        x0, y0, x1, t = float(m.group(1)), round(float(m.group(2)), 1), float(m.group(3)), m.group(4)
        t = t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
        t = ''.join(ch for ch in t if ch not in BIDI)
        rows.setdefault((page, y0), []).append((x0, x1, t))
    lines = []
    for key in sorted(rows):
        frags = sorted(rows[key], key=lambda f: -f[1])
        out, prev_x0 = '', None
        for x0, x1, t in frags:
            piece = t if re.fullmatch(r'[\x00-\x7f]+', t) else t[::-1]
            if prev_x0 is not None and prev_x0 - x1 > 1.2:
                out += ' '
            out += piece
            prev_x0 = x0
        lines.append(out)
    return lines


def layer_words(pdf: str) -> set[str]:
    """كلمات الطبقة بصيغتها الصارمة."""
    words: set[str] = set()
    for line in layer_lines(pdf):
        for tok in line.split():
            words.update(strict(x) for x in [tok, *re.split(r'[^\w]+', tok)] if strict(x))
    return words


def check(record: str, pdf: str, topic: int | None = None) -> int:
    rec = json.load(open(record, encoding='utf-8'))
    have = layer_words(pdf)
    loose = {norm(w) for w in have}
    bad_total = 0
    for t in rec['topics']:
        if topic and t['paper'] != topic:
            continue
        used = {i for q in t['questions'] for i in q.get('documents') or []}
        units = [(f"{q['id']} (سؤال)", q['text']) for q in t['questions']]
        units += [(f"{d['id']} (وثيقة)", d.get('text') or ' '.join(c for row in (d.get('table') or []) for c in row))
                  for d in t['documents'] if d['kind'] != 'figure' and d['id'] in used]
        for where, text in units:
            miss, hamza = [], []
            for w in re.split(r'\s+', text or ''):
                if not strict(w) or re.search(r'\d', w):
                    continue
                if strict(w) in have or lig(strict(w)) in have:
                    continue
                (hamza if norm(w) in loose or norm(lig(strict(w))) in loose else miss).append(w)
            if miss or hamza:
                bad_total += len(miss) + len(hamza)
                print(f'الموضوع {t["paper"]} {where}: ' + ' | '.join(miss) + (f'  [همزة/تاء/ياء: {" | ".join(hamza)}]' if hamza else ''))
    print(f'— {bad_total} كلمة لا توجد في طبقة النصّ (راجعها على الصورة).')
    return bad_total


def check_answers(record: str, corr_pdf: str, topic: int | None = None) -> int:
    """الأجوبة الرسميّة للعناصر الثابتة (fixed/alternatives/table) مقابل طبقة نصّ ملفّ التصحيح: هي التي تصير خيارات صحيحة."""
    rec = json.load(open(record, encoding='utf-8'))
    have = layer_words(corr_pdf)
    loose = {norm(w) for w in have}
    bad_total = 0
    for t in rec['topics']:
        if topic and t['paper'] != topic:
            continue
        for q in t['questions']:
            for e in q['rubric']:
                if e['answer_type'] not in ('fixed', 'alternatives', 'table'):
                    continue
                miss, hamza = [], []
                for w in re.split(r'\s+', e.get('official_answer') or ''):
                    if not strict(w) or re.search(r'\d', w) or strict(w) in have or lig(strict(w)) in have:
                        continue
                    (hamza if norm(w) in loose or norm(lig(strict(w))) in loose else miss).append(w)
                if miss or hamza:
                    bad_total += len(miss) + len(hamza)
                    print(f'التصحيح {e["id"]}: ' + ' | '.join(miss) + (f'  [همزة/تاء/ياء: {" | ".join(hamza)}]' if hamza else ''))
    print(f'— {bad_total} كلمة من الأجوبة الرسميّة لا توجد في طبقة نصّ التصحيح.')
    return bad_total


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--lines':
        print('\n'.join(layer_lines(a[1])))
        sys.exit(0)
    tp = int(a[a.index('--topic') + 1]) if '--topic' in a else None
    check(a[0], a[1], tp)
    if '--correction' in a:
        check_answers(a[0], a[a.index('--correction') + 1], tp)
