"""BAC 2022 (الدورة العادية) – التاريخ والجغرافيا – علوم تجريبية، رياضيات، تقني رياضي، من سجلّ المصدر hist-bac-2022-sci.json
(نقل ChatGPT، صفّ القائمة 3). مبنيّ على القدوة build_hg_bac_2020_lit.py.

    python3 scripts/play/converters/build_hg_bac_2022_sci.py content/play-exams/sets/3AS/HIST/hg-bac-2022-sci-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2022-sci-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). لا شكل مطبوعًا في ورقة الموضوع يحيل إليه سؤال (p1-d6 رسم الإجابة النموذجيّة من ملفّ التصحيح: لا يُعرض).

ما رُوجع قبل البناء:
- record_wordcheck.py على الورقة والتصحيح، ثمّ صورة الصفحة (300 نقطة) لكلّ كلمة مُعلَّمة ولكلّ رقم في الأسئلة والوثائق.
  طبقة النصّ مشوّهة في معظم الفقرات (حروف بديلة)، والصورة تطابق السجلّ إلّا ما في FIXES: «كمية الانتاج» بلا همزة في رأس جدول p2-d5،
  و«1989/12/04-03» في جدول p2-d2 بشرطة عاديّة (حرفها في الطبقة 0x2d؛ الشرطة الطويلة في السجلّ تقلب الترتيب عند العرض من اليمين).
  الشكل (الحركات) لم يُراجَع حرفًا حرفًا.

قرارات المحوِّل:
- المصطلحات: definition_step، المشتّتات من مصطلحات التصحيح نفسه (الموضوعان)، تاريخ مع تاريخ وجغرافيا مع جغرافيا.
- TRIMS: جملة من التعريف الرسميّ تسمّي البند نفسه تُحذف كاملة من نصّ الخيار (لا يُضاف حرف ولا يُعاد صوغ)، والشرح يبقى بالنصّ الكامل:
  «مثل: المفاوضات بين…»، «وتدعو إلى تحرير التجارة العالمية»، «يتحقق النمو بفضل…»، «وأهم البورصات: …».
  ما يبدأ به التعريف نفسه (جنسه) يبقى كما في القدوة («منظّمة الدّول المصدرة…» للأوبيك): «هجوم عسكري…»، «منظمة عالمية تجارية…»،
  «شركات عابرة للقارات…»، «يطلق عليها البلدان الصاعدة…».
- الشخصيّات: ثلاث فقط في التصحيح كلّه (الموضوع 1)، فكلّ «من هو» mcq بثلاثة خيارات (definition_step يشترط ثلاثة مشتّتات).
- «أكمل الجدول» (الموضوع 2، س2): الأسطر الثلاثة تفاعليّة؛ المشتّتات أحداث/تواريخ من التصحيح نفسه غير مطبوعة في الجدول وغير أجوبة
  لأسطره الأخرى، والتاريخ «1958/19/19» (typo_in_correction) لا يُستعمل. نصّ سؤال سطر مالطا يكتب التاريخ بشرطة عاديّة كما في الورقة.
- التعليق على جدول أرقام مطبوع (الموضوع 2، س2 جغرافيا): multi من العبارات بعد ❖ (comment_step يعدّ سطر العنوان قبل أوّل ❖ عبارةً
  صحيحة)، والعبارات الخاطئة تنقضها أرقام الجدول.
- الأعمدة البيانيّة والمقالات: مؤجّلة آليًّا.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import _TRAIL, definition_step, elements, record_path, refs_for, split_definition, table_step  # noqa: E402
from source_record import build, load, mcq, multi  # noqa: E402

NAME = 'hist-bac-2022-sci.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))
E = elements(REC)

FIXES = [
    ('p2-d2', '1989/12/04–03', '1989/12/04-03'),
    ('p2-d5', 'كمية الإنتاج', 'كمية الانتاج'),
]

TRIMS = {
    'p1-q1-e1': [(' مثل: المفاوضات بين جبهة التحرير الوطني والحكومة الفرنسية', '')],
    'p1-q4-e1': [(' وتدعو إلى تحرير التجارة العالمية', '')],
    'p1-q4-e2': [(' يتحقق النمو بفضل الاستهلاك والاستثمار والصادرات والانفاق العمومي', '')],
    'p2-q4-e1': [('، وأهم البورصات: وول ستريت (و.م.ا) وباريس وطوكيو ولندن', '')],
}


def _trimmed(eid: str) -> str:
    t = split_definition(E[eid]['official_answer'])[1]
    for a, b in TRIMS[eid]:
        assert t.count(a) == 1, (eid, a)
        t = t.replace(a, b)
    return t


REPL = {split_definition(E[k]['official_answer'])[1]: _trimmed(k) for k in TRIMS}


def trim(steps: list[dict]) -> list[dict]:
    for s in steps:
        if s['type'] == 'mcq':
            s['payload']['options'] = [REPL.get(o, o) for o in s['payload']['options']]
    return steps


d = lambda eid, ds, skill, kind, name=None: trim([definition_step(REC, eid, ds, skill, kind, name)])


def person3(eid: str, ds: list[str]) -> list[dict]:
    """«من هو…؟» بخيارين مشتّتين (لا شخصيّات غيرها في التصحيح)؛ بصيغة definition_step نفسها."""
    name, right = split_definition(E[eid]['official_answer'])
    assert len(ds) == 2 and eid not in ds
    opts = [right] + [split_definition(E[x]['official_answer'])[1] for x in ds]
    return trim([mcq(f'من هو {name}؟', opts, 0, f'«{name}» في الإجابة النموذجيّة: {right}.', E[eid]['marks'], 'hist.figures')])


def comment(eid: str, false_statements: list[str], prompt: str) -> list[dict]:
    """comment_step بلا سطر العنوان الذي يسبق أوّل ❖ في الإجابة النموذجيّة."""
    e = E[eid]
    assert e['answer_type'] == 'alternatives'
    rights = [_TRAIL.sub('', x.strip()) for x in re.split(r'❖', e['official_answer'])[1:] if x.strip()]
    opts = rights + [_TRAIL.sub('', x.strip()) for x in false_statements]
    assert 2 <= len(rights) <= 5 and 2 <= len(false_statements) <= 3 and len(set(opts)) == len(opts), eid
    expl = 'التعليق في الإجابة النموذجيّة: ' + ' — '.join(rights) + '.'
    return [multi(prompt, opts, list(range(len(rights))), expl, e['marks'], 'geo.data')]


def dash(steps: list[dict]) -> list[dict]:
    """التاريخ بشرطة عاديّة كما في الورقة والتصحيح (الشرطة الطويلة تقلب الترتيب عند العرض من اليمين)."""
    for s in steps:
        s['prompt'] = s['prompt'].replace('1989/12/04–03', '1989/12/04-03')
        s['explanation'] = s['explanation'].replace('1989/12/04–03', '1989/12/04-03')
    return steps


INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e2', 'p1-q1-e3', 'p2-q1-e1'], 'hist.terms', 'term'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e1', 'p1-q1-e3', 'p2-q1-e2'], 'hist.terms', 'term'),
    'p1-q1-e3': d('p1-q1-e3', ['p1-q1-e1', 'p1-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q2-e1': person3('p1-q2-e1', ['p1-q2-e2', 'p1-q2-e3']),
    'p1-q2-e2': person3('p1-q2-e2', ['p1-q2-e3', 'p1-q2-e1']),
    'p1-q2-e3': person3('p1-q2-e3', ['p1-q2-e2', 'p1-q2-e1']),
    'p1-q4-e1': d('p1-q4-e1', ['p1-q4-e3', 'p2-q4-e1', 'p2-q4-e2'], 'geo.terms', 'term'),
    'p1-q4-e2': d('p1-q4-e2', ['p1-q4-e3', 'p2-q4-e1', 'p1-q4-e1'], 'geo.terms', 'term'),
    'p1-q4-e3': d('p1-q4-e3', ['p1-q4-e1', 'p1-q4-e2', 'p2-q4-e1'], 'geo.terms', 'term'),
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p2-q1-e2', 'p2-q1-e3', 'p1-q1-e2'], 'hist.terms', 'term'),
    'p2-q1-e2': d('p2-q1-e2', ['p2-q1-e1', 'p2-q1-e3', 'p1-q1-e1'], 'hist.terms', 'term'),
    'p2-q1-e3': d('p2-q1-e3', ['p2-q1-e1', 'p2-q1-e2', 'p1-q1-e3'], 'hist.terms', 'term'),
    'p2-q2-e1': [table_step(REC, 'p2-q2-e1', ['1956/10/22', '1958/02/08', '1961/10/17'])],
    'p2-q2-e2': dash([table_step(REC, 'p2-q2-e2', ['تأسيس حركة عدم الانحياز', 'العدوان الثلاثي على مصر', 'قنبلة ساقية سيدي يوسف'], asks='event')]),
    'p2-q2-e3': [table_step(REC, 'p2-q2-e3', ['مظاهرات المهاجرين الجزائريين في فرنسا', 'قنبلة ساقية سيدي يوسف', 'اختطاف أعضاء الوفد الخارجي الجزائري الخمسة'], asks='event')],
    'p2-q4-e1': d('p2-q4-e1', ['p2-q4-e2', 'p2-q4-e3', 'p1-q4-e3'], 'geo.terms', 'term'),
    'p2-q4-e2': d('p2-q4-e2', ['p2-q4-e1', 'p2-q4-e3', 'p1-q4-e1'], 'geo.terms', 'term'),
    'p2-q4-e3': d('p2-q4-e3', ['p2-q4-e1', 'p2-q4-e2', 'p1-q4-e3'], 'geo.terms', 'term'),
    'p2-q5-e1': comment('p2-q5-e1', [
        'احتلال و.م.ا المرتبة الأولى في إنتاج القمح.',
        'تفوّق إنتاج كندا على إنتاج فرنسا.',
        'تقارب كمية الإنتاج بين البلدان الواردة في الجدول.',
    ], 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).'),
}
assert all(_trimmed(k) in INTERACTIVE[k][0]['payload']['options'] for k in TRIMS), 'TRIMS غير مطبَّق'
DEFER: set[str] = set()
FIGURES: dict = {}
NOTE = ('الشخصيّات الثلاث (الموضوع الأوّل) mcq بثلاثة خيارات: لا شخصيّات أخرى في التصحيح. '
        'حُذفت من نصّ الخيار (لا من الشرح) جمل التعريف الرسميّ التي تسمّي البند: «مثل: المفاوضات بين جبهة التحرير الوطني والحكومة الفرنسية»، '
        '«وتدعو إلى تحرير التجارة العالمية»، «يتحقق النمو بفضل…»، «وأهم البورصات: …». '
        'مشتّتات جدول الموضوع الثاني من التصحيح نفسه (لا يُستعمل تاريخ الحكومة المؤقتة «1958/19/19» المطبوع خطأً في التصحيح).')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
