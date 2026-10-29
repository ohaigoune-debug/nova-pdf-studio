"""
سجلّ مصدر «madrasa-play-source/1» (يُعدّه ChatGPT وفق docs/play-exams/CHATGPT_SOURCE_PROMPT_AR.md)
⇐ مجموعات PLAY (ExamSetDocument) لكل موضوع.

ما يُبنى آليًا من السجلّ (بلا تأليف):
  - المصدر والعنوان والشعب والمراجع، والوثائق حرفيًا (نص/جدول/شكل مقصوص من الورقة الرسمية)،
  - الأسئلة الأصلية حرفيًا وعناصر سلّم التنقيط بعلاماتها،
  - الخطوات المؤجّلة لكل عنصر open/essay/drawing/map/table (needs_engine_support، علامة العنصر كاملة).
ما يكتبه المحوِّل (Claude) يدويًا: الخطوات التفاعلية لعناصر fixed/alternatives في INTERACTIVE،
والجواب الصحيح فيها من official_answer وحده.

الاستعمال من ملف بناء لكل ورقة (scripts/play/converters/build_<subj>_bac_<year>_<slug>.py، القدوة build_hg_bac_2020_lit.py):
    from source_record import build
    build(RECORD, out_path, interactive=INTERACTIVE, refs=REFS, defer=DEFER, pdf=PAPER_PDF)
السجلّات نفسها محفوظة في content/play-exams/records/<subj>/ (لا تُعدَّل: هي نقل ChatGPT كما وصل).
خانة جدول (answer_type «table») لها جواب رسميّ ثابت (تاريخ حدث / حدث تاريخ) تصير تفاعليّة إذا وُضعت خطواتها في INTERACTIVE.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = 'madrasa-play-source/1'
SUBJECTS = {'hist': 'HIST', 'isl': 'ISL', 'en': 'EN', 'fr': 'FR', 'math': 'MATH', 'phys': 'PHYS', 'svt': 'SVT', 'philo': 'PHILO', 'eco': 'ECO', 'acc': 'ACC', 'law': 'LAW', 'tech': 'TECH'}
STREAMS = {'SCI', 'MATH', 'TM', 'GE', 'LIT', 'LANG'}
STREAM_AR = {'SCI': 'علوم تجريبية', 'MATH': 'رياضيات', 'TM': 'تقني رياضي', 'GE': 'تسيير واقتصاد', 'LIT': 'آداب وفلسفة', 'LANG': 'لغات أجنبية'}
DEFERRED = {'open': 'essay_builder', 'essay': 'essay_builder', 'drawing': 'function_plot', 'map': 'map_locate', 'table': 'table_fill'}
INTERACTIVE_TYPES = {'fixed', 'alternatives'}
ORD = {1: 'الأوّل', 2: 'الثّاني'}


class RecordError(Exception):
    pass


def load(path: str | Path) -> dict:
    rec = json.loads(Path(path).read_text(encoding='utf-8'))
    problems = check(rec)
    if problems:
        raise RecordError('سجلّ غير صالح:\n  ' + '\n  '.join(problems))
    return rec


def check(rec: dict) -> list[str]:
    """نفس فحص البرومبت + ما يحتاجه البناء."""
    E: list[str] = []
    if rec.get('schema') != SCHEMA:
        E.append('schema')
    p = rec.get('paper') or {}
    if p.get('subject') not in SUBJECTS:
        E.append(f"paper.subject «{p.get('subject')}» غير مدعوم في PLAY بعد (المدعوم: {', '.join(SUBJECTS)})")
    if not p.get('streams') or not set(p['streams']) <= STREAMS:
        E.append('paper.streams')
    if not isinstance(p.get('year'), int):
        E.append('paper.year')
    ids: set[str] = set()
    for t in rec.get('topics') or []:
        doc_ids = {d['id'] for d in t.get('documents') or []}
        for d in t.get('documents') or []:
            if d['kind'] == 'figure':
                f = d.get('figure') or {}
                b = f.get('bbox') or []
                if not (isinstance(f.get('page'), int) and len(b) == 4 and 0 <= b[0] < b[2] <= 1 and 0 <= b[1] < b[3] <= 1):
                    E.append(f"{d['id']}: figure.page/bbox")
            elif d['kind'] == 'text' and not d.get('text'):
                E.append(f"{d['id']}: text فارغ")
            elif d['kind'] == 'table' and not d.get('table'):
                E.append(f"{d['id']}: table فارغ")
        if t.get('total') != 20:
            E.append(f"الموضوع {t.get('paper')}: total ليس 20")
        variants = {s for q in t['questions'] for e in q['rubric'] for s in (e.get('streams') or [])} or {None}
        for v in variants:
            tot = 0.0
            for q in t['questions']:
                es = [e for e in q['rubric'] if not e.get('streams') or v in e['streams']]
                s = round(sum(e['marks'] for e in es), 4)
                if abs(s - q['total']) > 1e-6:
                    E.append(f"{q['id']}: مجموع العناصر {s} ≠ {q['total']} (شعبة {v})")
                tot += s
            if abs(tot - t['total']) > 1e-6:
                E.append(f"الموضوع {t['paper']}: المجموع {tot} ≠ {t['total']} (شعبة {v})")
        for q in t['questions']:
            for x in [q, *q['rubric']]:
                if x['id'] in ids:
                    E.append(f"id مكرر {x['id']}")
                ids.add(x['id'])
            if not set(q.get('documents') or []) <= doc_ids:
                E.append(f"{q['id']}: وثيقة غير معرّفة")
            for e in q['rubric']:
                if e['answer_type'] not in INTERACTIVE_TYPES | set(DEFERRED):
                    E.append(f"{e['id']}: answer_type")
                if e['answer_type'] in INTERACTIVE_TYPES and not e.get('official_answer'):
                    E.append(f"{e['id']}: {e['answer_type']} بلا official_answer")
                if abs(e['marks'] * 4 - round(e['marks'] * 4)) > 1e-9:
                    E.append(f"{e['id']}: العلامة ليست من مضاعفات 0.25")
                if e.get('streams') and not set(e['streams']) <= set(p.get('streams') or []):
                    E.append(f"{e['id']}: شعبة خارج شعب الورقة")
    if len(rec.get('topics') or []) not in (1, 2):
        E.append('topics: موضوع أو موضوعان')
    return E


def _crop(pdf: Path, page: int, bbox: list[float], set_id: str, name: str) -> dict:
    """قصّ شكل من صفحة الورقة الرسمية (لا رسم): يعيد ما يلزم MediaRef."""
    from PIL import Image

    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / 'p'
        subprocess.run(['pdftoppm', '-r', '200', '-png', '-f', str(page), '-l', str(page), str(pdf), str(base)], check=True)
        png = next(Path(tmp).glob('p*.png'))
        im = Image.open(png).convert('RGB')
        w, h = im.size
        crop = im.crop((round(bbox[0] * w), round(bbox[1] * h), round(bbox[2] * w), round(bbox[3] * h)))
        if crop.width > 1400:
            crop = crop.resize((1400, round(crop.height * 1400 / crop.width)), Image.LANCZOS)
        out_dir = ROOT / 'public' / 'play-exams' / 'figures' / set_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f'{name}.png'
        from PIL import ImageChops
        r, g, b = crop.split()
        gray = max(ImageChops.difference(r, g).getextrema()[1], ImageChops.difference(g, b).getextrema()[1]) < 40
        # ورقة الديوان بالأبيض والأسود غالبًا: رماديّ بـ16 درجة يحفظ الخطوط ويصغّر الملفّ (≈ النصف)
        (crop.convert('L').quantize(16) if gray else crop).save(out, optimize=True)
    data = out.read_bytes()
    return {'local_path': f'/play-exams/figures/{set_id}/{name}.png', 'sha256': hashlib.sha256(data).hexdigest(), 'width': crop.width, 'height': crop.height}


GENERIC_LABEL = re.compile(r'^عنصر (?:الإجابة|الإجابه)\s*\d+$')


def label_of(e: dict) -> str:
    """تسمية العنصر الظاهرة: «عنصر الإجابة 2» العامّة تُستبدل بالبند (المصطلح/الشخصيّة/الحدث) إن وُجد — والبند ليس جوابًا."""
    if GENERIC_LABEL.match(e['label'].strip()) and e.get('item'):
        return e['item'].strip()
    return e['label']


def _deferred_skill(subj: str, part: str, typ: str, answer_type: str) -> str:
    if subj == 'HIST':  # التاريخ والجغرافيا: الجذر من الجزء، والمهارة من نوع العمل (skills.ts)
        root = 'geo' if 'الجغراف' in (part or '') else 'hist'
        if typ == 'map_locate':
            return f'{root}.map'
        if typ == 'essay_builder':
            return 'geo.data' if root == 'geo' and 'الأول' in (part or '') else f'{root}.essay'
        return 'hist.dates' if root == 'hist' and answer_type == 'table' else f'{root}.data'
    return f"{subj.lower()}.{'writing' if typ == 'essay_builder' else answer_type}"


def _deferred_step(e: dict, qid: str, subj: str, part: str = '') -> dict:
    typ = DEFERRED[e['answer_type']]
    spec = {'criterion': e['label'], 'item': e.get('item'), 'official_answer': e.get('official_answer'), 'accepts': e.get('accepts'), 'marks_text': e.get('marks_text')}
    expl = f"يُصحَّح وفق الإجابة النموذجيّة: {e['official_answer']}" if e.get('official_answer') else f"يُصحَّح وفق سلّم التنقيط الرسميّ: {e['label']} — {e['marks']} ن."
    return {
        'source_question_id': qid, 'rubric_element_id': e['id'], 'variant': 'a', 'type': typ,
        'prompt': e['label'] if not e.get('item') or e['item'].strip() == e['label'].strip() else f"{e['label']}: {e['item']}",
        'payload': {'type': typ, 'spec': spec}, 'answer': {'type': typ, 'spec': {'official_answer': e.get('official_answer'), 'accepts': e.get('accepts')}},
        'explanation': expl, 'points': e['marks'], 'skill_id': _deferred_skill(subj, part, typ, e['answer_type']),
        'lesson_ref': None, 'is_verbatim_original': False, 'review_status': 'needs_engine_support',
    }


def set_id_for(record_path: Path, paper_no: int) -> str:
    return f'{record_path.stem}-p{paper_no}'


def apply_fixes(rec: dict, fixes: list[tuple[str, str, str]]) -> None:
    """تصحيح أخطاء النقل بعد مطابقتها لورقة الموضوع (طبقة النصّ + الصورة): (معرّف سؤال/وثيقة/عنصر، القديم، الجديد).
    القديم يجب أن يرد مرّة واحدة بالضبط في هدفه؛ لا يُمسّ ملفّ السجلّ نفسه."""
    targets: dict[str, tuple[dict, str]] = {}
    for t in rec['topics']:
        for q in t['questions']:
            targets[q['id']] = (q, 'text')
            for e in q['rubric']:
                targets[e['id']] = (e, 'element')
        for d in t['documents']:
            targets[d['id']] = (d, 'table' if d['kind'] == 'table' else 'text')
    for tid, a, b in fixes:
        if tid not in targets:
            raise RecordError(f'تصحيح: هدف غير موجود {tid}')
        obj, key = targets[tid]
        if key == 'element':  # عنصر سلّم: البند (ورقة الموضوع) أو التسمية؛ في كلّ حقل يرد فيه
            fields = [k for k in ('item', 'label') if a in (obj.get(k) or '')]
            if not fields:
                raise RecordError(f'تصحيح {tid}: «{a}» لا يرد في البند ولا في التسمية')
            for k in fields:
                obj[k] = obj[k].replace(a, b)
            continue
        if key == 'table':
            hits = [(i, j) for i, row in enumerate(obj['table']) for j, c in enumerate(row) if a in c]
            n = sum(obj['table'][i][j].count(a) for i, j in hits)
            if n != 1:
                raise RecordError(f'تصحيح {tid}: «{a}» يرد {n} مرّة')
            i, j = hits[0]
            obj['table'][i][j] = obj['table'][i][j].replace(a, b)
        else:
            n = (obj.get(key) or '').count(a)
            if n != 1:
                raise RecordError(f'تصحيح {tid}: «{a}» يرد {n} مرّة')
            obj[key] = obj[key].replace(a, b)


def build(record_path: str | Path, out: str | Path, *, interactive: dict[str, list[dict]], refs: dict, defer: set[str] | None = None, pdf: str | Path | None = None, fixes: list[tuple[str, str, str]] | None = None, note: str = '', figures: dict[str, tuple[int, list[float]]] | None = None) -> dict:
    """
    interactive: element_id → خطوات تفاعلية (dict بصيغة الخطوة دون id/source_question_id/rubric_element_id/variant/review_status)
    refs: {'paper_id','paper_title','correction_id','correction_title'} معرّفات Drive
    defer: عناصر fixed/alternatives يقرّر المحوِّل تأجيلها (مع سبب في notes)
    pdf: مسار نسخة ورقة الموضوع الرسمية (لقصّ الأشكال)
    fixes: تصحيحات النقل (apply_fixes) بعد record_wordcheck.py ومراجعة صورة الصفحة
    figures: {معرّف الشكل: (الصفحة، [x0,y0,x1,y1])} يحلّ محلّ إطار الناقل بعد رؤية القصّ
    """
    record_path = Path(record_path)
    out = Path(out)
    rec = load(record_path)
    fixes = fixes or []
    apply_fixes(rec, fixes)
    for fid, (pg, bb) in (figures or {}).items():  # إطار الشكل بعد مراجعة القصّ بالعين (إطار الناقل يقطع الحافّة أو يضمّ الرأسيّة)
        hit = [d for t in rec['topics'] for d in t['documents'] if d['id'] == fid and d['kind'] == 'figure']
        if not hit:
            raise RecordError(f'figures: لا شكل {fid}')
        hit[0]['figure'] = {'page': pg, 'bbox': bb}
    defer = defer or set()
    m = re.search(r'-p([12])\.json$', out.name)
    if not m:
        raise RecordError('اسم الملف الناتج يجب أن ينتهي بـ -p1.json أو -p2.json')
    paper_no = int(m.group(1))
    topic = next((t for t in rec['topics'] if t['paper'] == paper_no), None)
    if not topic:
        raise RecordError(f'لا موضوع {paper_no} في السجلّ')
    p = rec['paper']
    subj = SUBJECTS[p['subject']]
    set_id = out.stem

    docs: dict[str, dict] = {}
    used = {i for q in topic['questions'] for i in q.get('documents') or []}
    # وثيقة لا يحيل إليها أيّ سؤال = مادّة من التصحيح (خريطة/رسم نموذجيّ، فقرة جواب): لا تُعرض على التلميذ ولا تُقصّ
    unused = [d['id'] for d in topic['documents'] if d['id'] not in used]
    for d in topic['documents']:
        if d['id'] not in used:
            continue
        caption = d.get('caption_on_paper') or {'text': 'النّصّ', 'table': 'جدول', 'figure': 'الشّكل'}[d['kind']]
        if d['kind'] == 'figure':
            if not pdf:
                raise RecordError(f"{d['id']}: شكل يحتاج --pdf (ورقة الموضوع الرسمية) لقصّه")
            crop = _crop(Path(pdf), d['figure']['page'], d['figure']['bbox'], set_id, d['id'])
            media = {
                **crop,
                'source_url': f"https://drive.google.com/file/d/{refs['paper_id']}/view",
                'attribution': 'الديوان الوطني للامتحانات والمسابقات — ورقة الموضوع الرسمية',
                'license': 'وثيقة امتحان رسمية منشورة — نسخة مطابقة للاستعمال التعليمي',
                'image_verified_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                'depicts': caption, 'alt': caption,
            }
            docs[d['id']] = {'id': d['id'], 'kind': 'graph', 'caption': caption, 'media': media}
        elif d['kind'] == 'table':
            docs[d['id']] = {'id': d['id'], 'kind': 'table', 'caption': caption, 'table': d['table']}
        else:
            docs[d['id']] = {'id': d['id'], 'kind': 'text', 'caption': caption, 'text': d['text']}

    questions, steps, missing = [], [], []
    known = {e['id']: e for q in topic['questions'] for e in q['rubric']}
    for k in [*interactive, *defer]:
        if k in known:
            continue
        if not any(k == e['id'] for t in rec['topics'] for q in t['questions'] for e in q['rubric']):
            raise RecordError(f'{k}: معرّف عنصر غير موجود في السجلّ')
    for k in interactive:
        if k in known and known[k]['answer_type'] in DEFERRED and not (known[k]['answer_type'] == 'table' and known[k].get('official_answer')):
            raise RecordError(f"{k}: نوعه {known[k]['answer_type']} يبقى مؤجَّلًا (يُقبل تفاعليًّا من المؤجّل خانةُ جدول لها جواب رسميّ ثابت فقط)")
    for q in topic['questions']:
        elements = []
        for e in q['rubric']:
            e = {**e, 'label': label_of(e)}
            el = {'id': e['id'], 'label': e['label'], 'max_points': e['marks'], 'verified': False}
            if e.get('streams'):
                el['streams'] = e['streams']
            elements.append(el)
            promoted = e['answer_type'] == 'table' and e['id'] in interactive
            if (e['answer_type'] in DEFERRED and not promoted) or e['id'] in defer:
                st = _deferred_step({**e, 'answer_type': e['answer_type'] if e['answer_type'] in DEFERRED else 'open'}, q['id'], subj, q['part'])
                steps.append(st)
                continue
            mine = interactive.get(e['id'])
            if not mine:
                missing.append(e['id'])
                continue
            total = round(sum(s['points'] for s in mine), 4)
            if abs(total - e['marks']) > 1e-6:
                raise RecordError(f"{e['id']}: مجموع الخطوات {total} ≠ علامة العنصر {e['marks']}")
            for i, s in enumerate(mine):
                steps.append({
                    'source_question_id': q['id'], 'rubric_element_id': e['id'], 'variant': 'abcdefgh'[i],
                    'lesson_ref': None, 'is_verbatim_original': False, 'review_status': 'needs_human_review', **s,
                    'payload': {'type': s['type'], **s['payload']}, 'answer': {'type': s['type'], **s['answer']},
                })
        questions.append({'id': q['id'], 'number': q['number'], 'part': q['part'], 'verbatim_text': q['text'], 'documents': [docs[i] for i in q.get('documents') or []], 'rubric_total': q['total'], 'rubric_elements': elements})
    if missing:
        raise RecordError('عناصر تفاعلية بلا خطوات في INTERACTIVE (أو أضفها إلى DEFER مع السبب): ' + ', '.join(missing))
    for i, s in enumerate(steps, 1):
        s['id'] = f's{i:02d}'

    streams_ar = '، '.join(STREAM_AR[s] for s in p['streams'])
    issues = rec.get('issues') or []
    notes = (
        f"سجلّ المصدر: {record_path.name} ({SCHEMA}) — نقلُ ChatGPT للموضوع والتصحيح الرسميّين حرفيًّا وفق البرومبت الصارم؛ "
        f"الخطوات التفاعليّة والمشتّتات من إعداد Claude وجوابها من official_answer وحده. سطر الشعبة في الرأس: «{p['streams_header']}». "
        + (f"مشكلات سجّلها الناقل ({len(issues)}): " + ' | '.join(f"{i['type']} @ {i['where']}: {i.get('detail', '')}" for i in issues) if issues else 'لا مشكلات مسجّلة في النقل.')
        + (f" عناصر أُجّلت بقرار المحوِّل: {', '.join(sorted(defer))}." if defer else '')
        + (f" وثائق في السجلّ لا يحيل إليها سؤال (من التصحيح) لم تُعرض: {', '.join(unused)}." if unused else '')
        + (f' {note.strip()}' if note.strip() else '')
        + (" تصحيحات للنقل بعد مطابقة الورقة الرسميّة (طبقة النصّ والصورة): " + '؛ '.join(f'{t}: «{a}» ← «{b}»' for t, a, b in fixes if t.startswith(f'p{paper_no}-')) + '.' if any(t.startswith(f'p{paper_no}-') for t, _, _ in fixes) else '')
    )
    doc = {
        'schema_version': 1,
        'set_id': set_id,
        'status': 'NEEDS_HUMAN_REVIEW',
        'source': {
            'source_id': f"gdrive-{refs['paper_id']}-p{paper_no}", 'kind': 'BAC', 'year': p['year'], 'level': '3AS', 'streams': p['streams'],
            'subject': subj, 'term': None, 'paper': paper_no,
            'title': f"بكالوريا {p['year']} ({p.get('session') or 'عادية'}) – {p.get('subject_ar') or subj} – {streams_ar} – الموضوع {ORD[paper_no]}",
            'original_url': f"https://drive.google.com/file/d/{refs['paper_id']}/view", 'original_file_ref': f"gdrive:{refs['paper_id']} ({refs.get('paper_title') or p.get('paper_file')})",
            'correction_url': f"https://drive.google.com/file/d/{refs['correction_id']}/view" if refs.get('correction_id') else None,
            'correction_file_ref': f"gdrive:{refs['correction_id']} ({refs.get('correction_title') or p.get('correction_file')})" if refs.get('correction_id') else None,
            'trust': 'official_mirror', 'verified': False, 'verified_by': None, 'verified_at': None, 'notes': notes,
        },
        'original_questions': questions,
        'steps': steps,
        'score_total': 20,
        'modes': ['PRACTICE', 'EXAM'],
        'review_log': [{'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'by': 'claude', 'action': 'generated', 'note': f'من سجلّ المصدر {record_path.name}'}],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return doc


def step(typ: str, prompt: str, payload: dict, answer: dict, explanation: str, points: float, skill: str | None = None) -> dict:
    """خطوة تفاعليّة بصيغة INTERACTIVE."""
    return {'type': typ, 'prompt': prompt, 'payload': payload, 'answer': answer, 'explanation': explanation, 'points': points, 'skill_id': skill}


def mcq(prompt: str, options: list[str], correct: int, explanation: str, points: float, skill: str | None = None) -> dict:
    return step('mcq', prompt, {'options': options}, {'correct': correct}, explanation, points, skill)


def multi(prompt: str, options: list[str], correct: list[int], explanation: str, points: float, skill: str | None = None) -> dict:
    return step('multi', prompt, {'options': options}, {'correct': correct}, explanation, points, skill)


def fill(prompt: str, text: str, bank: list[str], blanks: list[list[str]], explanation: str, points: float, skill: str | None = None) -> dict:
    return step('fill_blank', prompt, {'text': text, 'bank': bank}, {'blanks': blanks}, explanation, points, skill)


def match(prompt: str, lefts: list[str], rights: list[str], pairs: list[int], explanation: str, points: float, skill: str | None = None) -> dict:
    return step('matching', prompt, {'lefts': lefts, 'rights': rights}, {'pairs': pairs}, explanation, points, skill)


def order(prompt: str, items: list[str], explanation: str, points: float, skill: str | None = None) -> dict:
    return step('ordering', prompt, {'items': items}, {'order': list(range(len(items)))}, explanation, points, skill)


def numeric(prompt: str, value: float, tolerance: float, unit: str | None, explanation: str, points: float, skill: str | None = None) -> dict:
    return step('numeric', prompt, {'unit': unit}, {'value': value, 'tolerance': tolerance, 'unit': unit}, explanation, points, skill)
