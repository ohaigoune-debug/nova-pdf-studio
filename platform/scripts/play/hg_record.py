"""
أدوات بناء مجموعات التاريخ والجغرافيا من سجلّ مصدر «madrasa-play-source/1» (فوق source_record.py).

قرارات الدليل (docs/play-exams/CONVERSION_GUIDE.md، «History & geography — decisions fixed by the pilot»):
- المصطلح/الشخصيّة: mcq، الخيار الصحيح = تعريف التصحيح الرسميّ بلا اسم المصطلح أو الشخصيّة (ما قبل النقطتين)،
  والمشتّتات = تعريفات مصطلحات/شخصيّات أخرى من التصحيح نفسه (الموضوعان)، يختارها المحوِّل باليد حتى لا يصدق أحدها على البند.
- خانة جدول الأحداث: mcq، الخيار الصحيح = جواب التصحيح، والمشتّتات تواريخ/أحداث من التصحيح نفسه لم تُطبع في الجدول.
- التعليق على جدول أرقام مطبوع: multi، الصحيح = عبارات التصحيح (❖)، والخاطئ عبارات تنقضها أرقام الجدول المطبوع نفسه.
تُحذف من آخر التعريف النقاط/علامة الحذف فقط (عرض موحّد للخيارات حتى لا يدلّ وجودها على الجواب)؛ لا يُغيَّر حرف من المتن.
"""
from __future__ import annotations

import re

import csv
from pathlib import Path

from source_record import ROOT, mcq, multi

QUEUE = ROOT / 'outputs' / 'play-subjects' / 'PLAY_SOURCES_QUEUE.csv'

_TRAIL = re.compile(r'[\s.…]+$')
_LEAD_DOTS = re.compile(r'^[\s.…]+')


def refs_for(record_name: str) -> dict:
    """معرّفات Drive للورقة وتصحيحها من صفّ قائمة المصادر الذي أنتج السجلّ."""
    for r in csv.DictReader(open(QUEUE, encoding='utf-8-sig')):
        if r['output_file'] == record_name:
            fid = lambda u: u.split('/d/')[1].split('/')[0]
            return {'paper_id': fid(r['paper_url']), 'paper_title': r['paper_title'], 'correction_id': fid(r['correction_url']), 'correction_title': r['correction_title'], 'queue_row': r['row']}
    raise KeyError(record_name)


def record_path(record_name: str) -> Path:
    return ROOT / 'content' / 'play-exams' / 'records' / record_name.split('-')[0] / record_name


def elements(rec: dict) -> dict[str, dict]:
    return {e['id']: {**e, '_part': q['part'], '_q': q['id']} for t in rec['topics'] for q in t['questions'] for e in q['rubric']}


def split_definition(answer: str) -> tuple[str, str]:
    """«الاسم: التعريف…» ⇒ (الاسم، التعريف بلا نقاط الحذف الأخيرة). بلا نقطتين ⇒ ('', النص)."""
    a = answer.strip()
    m = re.match(r'^([^:\n]{1,60}?)\s*:\s*(.+)$', a, re.S)
    if not m:
        return '', _TRAIL.sub('', a)
    return m.group(1).strip(), _LEAD_DOTS.sub('', _TRAIL.sub('', m.group(2).strip()))


def _norm(s: str) -> str:
    s = re.sub(r'[ً-ْـ]', '', s)
    s = re.sub('[أإآ]', 'ا', s).replace('ة', 'ه').replace('ى', 'ي')
    return re.sub(r'\s+', ' ', s).strip()


def definition_step(rec: dict, eid: str, distractor_eids: list[str], skill: str, kind: str, name: str | None = None, drop: list[str] | None = None) -> dict:
    """kind: 'term' (ما المقصود بـ«…»؟) أو 'person' (من هو …؟). name: الاسم كما في ورقة الموضوع إن خالف رسمُه التصحيحَ.
    مشتّتان أو ثلاثة (بعض التصحيحات لا تعرّف إلّا ثلاث شخصيّات). drop: عبارات تسمّي البند داخل تعريفه («صاحب مشروع ايزنهاور»)
    تُحذف من الخيار الصحيح وحده (حذف فقط، كلّ عبارة ترد مرّة واحدة)، ويبقى التعريف كاملًا في الشرح."""
    E = elements(rec)
    e = E[eid]
    assert e['answer_type'] == 'fixed', (eid, e['answer_type'])
    assert len(distractor_eids) in (2, 3) and eid not in distractor_eids and len(set(distractor_eids)) == len(distractor_eids), eid
    corr_name, full = split_definition(e['official_answer'])
    name = name or corr_name or (e.get('item') or '').strip()
    assert name and full, eid
    right = full
    for x in drop or []:
        assert right.count(x) == 1, (eid, 'drop', x)
        right = right.replace(x, '')
    if drop:  # ما خلّفه الحذف من مسافة مضاعفة أو فاصلة يتيمة فقط
        right = re.sub(r'\s{2,}', ' ', right).strip(' ،,')
    opts = [right]
    for d in distractor_eids:
        assert E[d]['answer_type'] == 'fixed', d
        dn, dt = split_definition(E[d]['official_answer'])
        assert dt and _norm(dt) not in {_norm(o) for o in opts}, (eid, d, 'duplicate option')
        opts.append(dt)
    prompt = f'ما المقصود بـ«{name}»؟' if kind == 'term' else f'من هو {name}؟'
    return mcq(prompt, opts, 0, f'«{name}» في الإجابة النموذجيّة: {full}.', e['marks'], skill)


def table_step(rec: dict, eid: str, distractors: list[str], skill: str = 'hist.dates', asks: str = 'date', item: str | None = None, right: str | None = None) -> dict:
    """خانة جدول: asks='date' (ما تاريخ «الحدث»؟) أو 'event' (ما الحدث الذي وقع في …؟). المشتّتات من التصحيح نفسه (2 أو 3).
    item: البند كما في ورقة الموضوع إن خالف السجلّ؛ right: الجواب بصيغة العرض (شرطة عاديّة بدل –) دون تغيير مضمونه."""
    E = elements(rec)
    e = E[eid]
    assert e['answer_type'] == 'table' and e.get('official_answer') and e.get('item'), eid
    item = (item or e['item']).strip()
    right = right or _TRAIL.sub('', e['official_answer'].strip())
    assert len(distractors) in (2, 3) and len({_norm(x) for x in [right, *distractors]}) == len(distractors) + 1, (eid, 'duplicate option')
    prompt = f'ما تاريخ «{item}»؟' if asks == 'date' else f'ما الحدث الذي وقع في {item}؟'
    expl = f'في الإجابة النموذجيّة: {item} — {right}.'
    return mcq(prompt, [right, *distractors], 0, expl, e['marks'], skill)


def comment_statements(answer: str) -> list[str]:
    """عبارات التعليق في التصحيح: بنود ❖ أو • ؛ ما قبل أوّل بند عنوانٌ («2) التعليق على…:») لا عبارة."""
    parts = re.split(r'[❖•]', answer)
    return [_TRAIL.sub('', x.strip()) for x in parts[1:] if x.strip()] if len(parts) > 1 else [_TRAIL.sub('', answer.strip())]


def comment_step(rec: dict, eid: str, false_statements: list[str], prompt: str, skill: str = 'geo.data') -> dict:
    """«علّق على المعطيات» (جدول أرقام مطبوع): اختر كلّ العبارات الصحيحة. الصحيح = عبارات التصحيح كما هي."""
    E = elements(rec)
    e = E[eid]
    assert e['answer_type'] == 'alternatives', eid
    rights = comment_statements(e['official_answer'])
    assert 2 <= len(rights) <= 6 and 2 <= len(false_statements) <= 4, (eid, len(rights))
    opts = rights + [_TRAIL.sub('', x.strip()) for x in false_statements]  # بلا نقطة أخيرة مثل عبارات التصحيح
    assert len({_norm(o) for o in opts}) == len(opts), (eid, 'duplicate option')
    expl = 'التعليق في الإجابة النموذجيّة: ' + ' — '.join(rights) + '.'
    return multi(prompt, opts, list(range(len(rights))), expl, e['marks'], skill)
