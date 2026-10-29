"""BAC 2022 (الدورة العادية) – التاريخ والجغرافيا – لغات أجنبية، من سجلّ المصدر hist-bac-2022-lang.json (نقل ChatGPT، صفّ القائمة 2).
مبنيّ على القدوة build_hg_bac_2020_lit.py.

    python3 scripts/play/converters/build_hg_bac_2022_lang.py content/play-exams/sets/3AS/HIST/hg-bac-2022-lang-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2022-lang-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). لا شكل مطبوعًا في ورقة الموضوع يحيل إليه سؤال (p1-d6 رسم الإجابة النموذجيّة من ملفّ التصحيح: لا يُعرض).

ما رُوجع قبل البناء:
- record_wordcheck.py على الورقة والتصحيح، ثمّ صورة الصفحة (300 نقطة) لكلّ كلمة مُعلَّمة ولكلّ رقم في الأسئلة والوثائق.
  طبقة النصّ مشوّهة في الفقرات المضبوطة (حروف بديلة)، فالمُعلَّم فيها كلّه صحيح في الصورة إلّا ما في FIXES:
  «(1991/1815)» في مرجع الوثيقة p1-d1 (الناقل قلبها إلى 1815/1991؛ «/» يُبقي الأرقام سلسلة واحدة، فتُكتب كما تُرى)،
  «stastical» كما طُبعت في المصدر p1-d5، وعلامة % في رأس جدول p2-d5 بعد الكلمة كما تظهر في الورقة (الناقل نقلها بالترتيب البصريّ
  من اليسار، فكانت ستُعرض في الجهة المقابلة). الشكل (الحركات) لم يُراجَع حرفًا حرفًا: يختلف السجلّ عن الورقة في بعض الحركات
  (كُلِيّة/كلّية، مُنَظّما/منظّما، يصدَّر/يصدر، يتميز/يتميّز) ولم يُغيَّر.

قرارات المحوِّل:
- المصطلحات: definition_step، المشتّتات من مصطلحات التصحيح نفسه (الموضوعان، تاريخ مع تاريخ وجغرافيا مع جغرافيا)، مع تجنّب تعريف
  يذكر البند نفسه («المجلس الوطني للثّورة… انبثق عن مؤتمر الصومام» لا يُعرض مشتّتًا لمؤتمر الصومام، و«الأسواق» لا تُعرض للتجارة).
- TRIMS: جملة من تعريف رسميّ تسمّي البند نفسه تُحذف كاملة من نصّ الخيار (لا يُضاف حرف ولا يُعاد صوغ)، والشرح يبقى بالنصّ الكامل:
  «بمدينة باندونغ»، «بواد الصومام» و«وصدر عنه ميثاق الصومام»، «صاحب مبدأ ترومان عام 1947»، «وهناك عدة أنواع من الأسواق…»،
  «وهناك تجارة داخلية وأخرى خارجية»، «(الأموال، النقود والسلع.)».
- الشخصيّات: في التصحيح كلّه ثلاث شخصيّات فقط (الموضوع 1)، فكلّ سؤال «من هو» mcq بثلاثة خيارات (الصحيح + الشخصيّتان الأخريان):
  definition_step يشترط ثلاثة مشتّتات، والقاعدة تمنع خلط الشخصيّات بالمصطلحات.
- «أكمل الجدول» (الموضوع 2، س2): الأسطر الثلاثة تفاعليّة. المشتّتات أحداث/تواريخ من التصحيح نفسه غير مطبوعة في الجدول وغير أجوبة
  لأسطره الأخرى؛ التواريخ «1 نوفمبر 1954» و«20اوت 1955» و«5 جويلية 1962» كُتبت بصيغة الجدول (سنة/شهر/يوم)، و«نقل الثّورة
  (العمليات العسكرية) إلى فرنسا» بلا ما بين القوسين.
- التعليق على جدول أرقام مطبوع (الموضوع 2، س2 جغرافيا): multi. comment_step يعدّ سطر العنوان «2) التعليق على…» (قبل أوّل ❖)
  عبارةً صحيحة، فبُني هنا من العبارات بعد ❖ وحدها؛ العبارات الخاطئة تنقضها أرقام الجدول.
- الأعمدة البيانيّة والمقالات: مؤجّلة آليًّا (source_record.py).
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import _TRAIL, definition_step, elements, record_path, refs_for, split_definition, table_step  # noqa: E402
from source_record import build, load, mcq, multi  # noqa: E402

NAME = 'hist-bac-2022-lang.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))
E = elements(REC)

FIXES = [
    ('p1-d1', '(1815/1991)', '(1991/1815)'),
    ('p1-d5', 'B.P.statistical', 'B.P.stastical'),
    ('p2-d5', '% قطاع الزراعية', 'قطاع الزراعية %'),
    ('p2-d5', '% قطاع الصناعية', 'قطاع الصناعية %'),
    ('p2-d5', '% قطاع الخدمات', 'قطاع الخدمات %'),
]

# جمل من التعريفات الرسميّة تسمّي البند نفسه: تُحذف من نصّ الخيار أينما ظهر (صحيحًا أو مشتّتًا).
TRIMS = {
    'p1-q1-e1': [('بمدينة باندونغ ', '')],
    'p1-q2-e3': [('صاحب مبدأ ترومان عام 1947، ', '')],
    'p2-q1-e1': [('بواد الصومام ', ''), ('وصدر عنه ميثاق الصومام، ', '')],
    'p1-q4-e2': [(' وهناك عدة أنواع من الأسواق: سوق السلع وسوق الأوراق المالية', '')],
    'p1-q4-e3': [(' وهناك تجارة داخلية وأخرى خارجية', '')],
    'p2-q4-e3': [(' (الأموال، النقود والسلع.)', '')],
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


COMMENT_PROMPT = 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).'

INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e2', 'p1-q1-e3', 'p2-q1-e1'], 'hist.terms', 'term'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e3', 'p2-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q1-e3': d('p1-q1-e3', ['p1-q1-e2', 'p1-q1-e1', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q2-e1': person3('p1-q2-e1', ['p1-q2-e2', 'p1-q2-e3']),
    'p1-q2-e2': person3('p1-q2-e2', ['p1-q2-e3', 'p1-q2-e1']),
    'p1-q2-e3': person3('p1-q2-e3', ['p1-q2-e2', 'p1-q2-e1']),
    'p1-q4-e1': d('p1-q4-e1', ['p1-q4-e2', 'p2-q4-e2', 'p2-q4-e3'], 'geo.terms', 'term'),
    'p1-q4-e2': d('p1-q4-e2', ['p1-q4-e1', 'p2-q4-e2', 'p2-q4-e1'], 'geo.terms', 'term'),
    'p1-q4-e3': d('p1-q4-e3', ['p1-q4-e1', 'p2-q4-e3', 'p2-q4-e2'], 'geo.terms', 'term'),
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p1-q1-e1', 'p2-q1-e3', 'p1-q1-e2'], 'hist.terms', 'term'),
    'p2-q1-e2': d('p2-q1-e2', ['p2-q1-e1', 'p2-q1-e3', 'p1-q1-e3'], 'hist.terms', 'term'),
    'p2-q1-e3': d('p2-q1-e3', ['p2-q1-e1', 'p2-q1-e2', 'p1-q1-e3'], 'hist.terms', 'term'),
    'p2-q2-e1': [table_step(REC, 'p2-q2-e1', ['هجومات الشمال القسنطيني', 'نقل الثّورة إلى فرنسا', 'توحيد الألمانيتين'], asks='event')],
    'p2-q2-e2': [table_step(REC, 'p2-q2-e2', ['1954/11/01', '1955/08/20', '1962/07/05'])],
    'p2-q2-e3': [table_step(REC, 'p2-q2-e3', ['هجومات الشمال القسنطيني', 'معركة الجزائر', 'تحطيم جدار برلين'], asks='event')],
    'p2-q4-e1': d('p2-q4-e1', ['p2-q4-e2', 'p2-q4-e3', 'p1-q4-e1'], 'geo.terms', 'term'),
    'p2-q4-e2': d('p2-q4-e2', ['p2-q4-e1', 'p2-q4-e3', 'p1-q4-e3'], 'geo.terms', 'term'),
    'p2-q4-e3': d('p2-q4-e3', ['p2-q4-e1', 'p2-q4-e2', 'p1-q4-e1'], 'geo.terms', 'term'),
    'p2-q5-e1': comment('p2-q5-e1', [
        'ارتفاع مساهمة الصناعة في النّاتج الدّاخلي الخام للولايات المتحدة الأمريكية بين عامي 2015 و2020.',
        'تفوّق مساهمة الصناعة على مساهمة الخدمات في النّاتج الدّاخلي الخام للولايات المتحدة الأمريكية.',
        'تراجع مساهمة الخدمات في النّاتج الدّاخلي الخام للولايات المتحدة الأمريكية بين عامي 2015 و2020.',
    ], COMMENT_PROMPT),
}
assert all(_trimmed(k) in INTERACTIVE[k][0]['payload']['options'] for k in TRIMS), 'TRIMS غير مطبَّق'
DEFER: set[str] = set()
FIGURES: dict = {}
NOTE = ('الشخصيّات الثلاث (الموضوع الأوّل) mcq بثلاثة خيارات: لا شخصيّات أخرى في التصحيح. '
        'حُذفت من نصّ الخيار (لا من الشرح) جمل التعريف الرسميّ التي تسمّي البند: «بمدينة باندونغ»، «بواد الصومام»، «وصدر عنه ميثاق الصومام»، '
        '«صاحب مبدأ ترومان عام 1947»، «وهناك عدة أنواع من الأسواق…»، «وهناك تجارة داخلية وأخرى خارجية»، «(الأموال، النقود والسلع.)». '
        'مشتّتات جدول الموضوع الثاني من التصحيح نفسه، وتواريخها مكتوبة بصيغة الجدول.')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
