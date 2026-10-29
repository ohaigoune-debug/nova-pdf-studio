"""BAC 2022 (الدورة العادية) – التاريخ والجغرافيا – آداب وفلسفة، من سجلّ المصدر hist-bac-2022-lit.json (نقل ChatGPT، صفّ القائمة 4).
مبنيّ على القدوة build_hg_bac_2020_lit.py.

    python3 scripts/play/converters/build_hg_bac_2022_lit.py content/play-exams/sets/3AS/HIST/hg-bac-2022-lit-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2022-lit-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). --pdf مطلوب لقصّ الخريطتين المطبوعتين في ورقة الموضوع.

ما رُوجع قبل البناء:
- record_wordcheck.py على الورقة والتصحيح، ثمّ صورة الصفحة (300 نقطة) لكلّ كلمة مُعلَّمة ولكلّ رقم في الأسئلة والوثائق.
  طبقة النصّ مشوّهة في معظم الفقرات، والصورة تطابق السجلّ إلّا ما في FIXES: «الو م أ» بلا نقاط في رأس جدول p1-d7، «م3» (رقم عاديّ لا
  «م³») في نصّ السؤال p1-q6 وسطر الوحدة p1-d8، «جودانوف» في جدول p2-d2 (السجلّ يكتبها «جدانوف» كما في التصحيح)، وعلامة % قبل
  «الصادرات»/«الواردات» في رأس جدول p2-d5 كما تظهر في الورقة (الناقل نقلها بالترتيب البصريّ من اليسار). الحركات لم تُراجَع حرفًا حرفًا.
- الخرائط المقصوصة: ص2 (خريطة الجزائر التاريخيّة للمناطق العسكريّة) وص6 (خريطة العالم، مطبوعة بالعرض كما في الورقة). إطار الناقل
  يقطع إطار العنوان (ص2) أو العنوان وحافّة الإطار السفلى (ص6): FIGURES بعد قياس خطوط الإطار على صورة الصفحة، بلا رأسيّة الصفحة ولا
  مستطيل «ينجز العمل المطلوب على الخريطة…». الوثائق p1-d4 وp1-d9 وp2-d8 (رسوم الإجابة النموذجيّة) وp2-d10 (خاتمة من التصحيح)
  لا يحيل إليها سؤال، فلا تُعرض.

قرارات المحوِّل:
- المصطلحات: definition_step، المشتّتات من مصطلحات التصحيح نفسه (الموضوعان)، تاريخ مع تاريخ وجغرافيا مع جغرافيا؛ «الأسواق» لا تُعرض
  مشتّتًا لـ«المواد الأولية» (تعريفها يذكر «المواد الأولية»).
- «ملء الفراغ» (alternatives: تعريفان بينهما «أو يقصد به»): mcq خياره الصحيح التعريف الأوّل، والشرح يذكر التعريفين.
- TRIMS: جملة من التعريف الرسميّ تسمّي البند نفسه تُحذف كاملة من نصّ الخيار، والشرح يبقى بالنصّ الكامل: «مما أدى إلى تقسيم كوريا…»،
  «(كفاح)»، «تسيير النقد الدّولي، و».
- الشخصيّات: ثلاث فقط في التصحيح كلّه (الموضوع 2)، فكلّ «من هو» mcq بثلاثة خيارات (definition_step يشترط ثلاثة مشتّتات).
- «أكمل الجدول» (الموضوعان، س2): الأسطر الستّة تفاعليّة. المشتّتات من التصحيح نفسه وغير مطبوعة في جدول السؤال؛ التواريخ «20 أوت 1955»
  و«20 أوت 1956» و«8 ماي 1945» بصيغة الجدول. تاريخا باندونغ وجدانوف مدى أيّام («1955/04/24-18»، «1947/10/6-5») ولا مدى غيرهما في
  التصحيح، فكلٌّ منهما مشتّت للآخر (خانتا تاريخهما فارغتان في الجدول) حتى لا تدلّ الصيغة على الجواب؛ وتُكتب الشرطة عاديّة كما في
  التصحيح (حرفها في الطبقة 0x2d). «سريان وقف اطلاق النار(عيد النصر)» يُعرض خيارًا بلا ما بين القوسين (الوحيد بقوسين)، والشرح كامل.
  اسم «جودانوف» في نصّ السؤال كما في ورقة الموضوع.
- التعليق (الموضوع 1 س2-ب على الأعمدة الممثِّلة لجدول مطبوع، الموضوع 2 س2 على جدول مطبوع): multi من العبارات بعد ❖ (comment_step
  يعدّ سطر العنوان قبل أوّل ❖ عبارةً صحيحة). عبارة التصحيح الرابعة في الموضوع 2 تطبع «الواردات 42.2 %» ومجموع الجدول 11.5+13.7+19.0
  = 44.2: يُعرض الخيار بلا الأرقام («ارتفاع نسب المبادلات التجارية الامريكية مع الدول الثلاثة مجتمعة»).
- الخرائط والأعمدة البيانيّة والمقالات: مؤجّلة آليًّا. سطر «سطر تنقيط غير محسوم» (p2-q8-e3، 0.5، بلا جواب) مؤجَّل كما سجّله الناقل.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import _TRAIL, definition_step, elements, record_path, refs_for, split_definition, table_step  # noqa: E402
from source_record import build, load, mcq, multi  # noqa: E402

NAME = 'hist-bac-2022-lit.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))
E = elements(REC)

FIXES = [
    ('p1-d7', 'الو.م.أ', 'الو م أ'),
    ('p1-q6', 'مليار م³)', 'مليار م3)'),
    ('p1-q6', '100 مليار م³.', '100 مليار م3.'),
    ('p1-d8', 'مليار م³', 'مليار م3'),
    ('p2-d2', 'جدانوف', 'جودانوف'),
    ('p2-d5', 'الصادرات %', '% الصادرات'),
    ('p2-d5', 'الواردات %', '% الواردات'),
]

TRIMS = {
    'p1-q1-e1': [('، مما أدى إلى تقسيم كوريا إلى دولتين عند خط °38 شمالا، كوريا الجنوبية الرأسمالية وكوريا الشمالية الشيوعية', '')],
    'p2-q1-e3': [(' (كفاح)', '')],
    'p2-q5-e2': [('تسيير النقد الدّولي، و', '')],
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


def alt_term(eid: str, ds: list[str]) -> list[dict]:
    """مصطلح alternatives («… أو يقصد به …»): الصحيح التعريف الأوّل، والشرح بالتعريفين."""
    e = E[eid]
    assert e['answer_type'] == 'alternatives' and len(ds) == 3
    name, body = split_definition(e['official_answer'])
    first, second = [_TRAIL.sub('', x.strip()) for x in body.split('\nأو يقصد به')]
    opts = [first] + [REPL.get(o, o) for o in (split_definition(E[x]['official_answer'])[1] for x in ds)]
    expl = f'«{name}» في الإجابة النموذجيّة: {first}؛ أو يقصد به {second}.'
    return [mcq(f'ما المقصود بـ«{name}»؟', opts, 0, expl, e['marks'], 'hist.terms')]


def comment(eid: str, false_statements: list[str], prompt: str, cut: tuple[str, str] | None = None) -> list[dict]:
    """comment_step بلا سطر العنوان الذي يسبق أوّل ❖؛ cut يحذف من عبارة صحيحة ما تنقضه أرقام الجدول."""
    e = E[eid]
    assert e['answer_type'] == 'alternatives'
    rights = [_TRAIL.sub('', x.strip()) for x in re.split(r'❖', e['official_answer'])[1:] if x.strip()]
    if cut:
        hit = [i for i, r in enumerate(rights) if cut[0] in r]
        assert len(hit) == 1, (eid, cut)
        rights[hit[0]] = rights[hit[0]].replace(cut[0], cut[1])
    opts = rights + [_TRAIL.sub('', x.strip()) for x in false_statements]
    assert 2 <= len(rights) <= 5 and 2 <= len(false_statements) <= 3 and len(set(opts)) == len(opts), eid
    expl = 'التعليق في الإجابة النموذجيّة: ' + ' — '.join(rights) + '.'
    return [multi(prompt, opts, list(range(len(rights))), expl, e['marks'], 'geo.data')]


def fix_step(steps: list[dict], pairs: list[tuple[str, str]], fields=('prompt', 'options', 'explanation')) -> list[dict]:
    for s in steps:
        for a, b in pairs:
            if 'prompt' in fields:
                s['prompt'] = s['prompt'].replace(a, b)
            if 'explanation' in fields:
                s['explanation'] = s['explanation'].replace(a, b)
            if 'options' in fields:
                s['payload']['options'] = [o.replace(a, b) for o in s['payload']['options']]
    return steps


INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e2', 'p2-q1-e1', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e1', 'p2-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q1-e3': alt_term('p1-q1-e3', ['p1-q1-e1', 'p1-q1-e2', 'p2-q1-e3']),
    'p1-q2-e1': [table_step(REC, 'p1-q2-e1', ['1955/08/20', '1945/05/08', '1961/10/17'])],
    'p1-q2-e2': fix_step([table_step(REC, 'p1-q2-e2', ['انعقاد مؤتمر الصومام', 'مظاهرات المهاجرين الجزائريين في فرنسا', 'انهزام فرنسا في معركة ديان بيان فو'], asks='event')],
                         [('سريان وقف اطلاق النار(عيد النصر)', 'سريان وقف اطلاق النار')], fields=('options',)),
    'p1-q2-e3': [table_step(REC, 'p1-q2-e3', ['1961/10/17', '1956/08/20', '1945/05/08'])],
    'p1-q5-e1': d('p1-q5-e1', ['p1-q5-e2', 'p2-q5-e1', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p1-q5-e2': d('p1-q5-e2', ['p1-q5-e1', 'p2-q5-e1', 'p2-q5-e3'], 'geo.terms', 'term'),
    'p1-q5-e3': d('p1-q5-e3', ['p1-q5-e2', 'p2-q5-e3', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p1-q7-e1': comment('p1-q7-e1', [
        'تقارب كمية استهلاك الغاز الطبيعي بين الدّول الواردة في الجدول.',
        'تفوّق استهلاك الصين للغاز الطبيعي على استهلاك روسيا.',
        'احتلال روسيا المرتبة الأولى في استهلاك الغاز الطبيعي.',
    ], 'اختر العبارات التي تصلح تعليقًا على الرسم البياني الممثِّل لمعطيات الجدول (كلّ العبارات الصحيحة).'),
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p1-q1-e1', 'p2-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p2-q1-e2': d('p2-q1-e2', ['p2-q1-e1', 'p2-q1-e3', 'p1-q1-e2'], 'hist.terms', 'term'),
    'p2-q1-e3': d('p2-q1-e3', ['p2-q1-e1', 'p2-q1-e2', 'p1-q1-e1'], 'hist.terms', 'term'),
    'p2-q2-e1': fix_step([table_step(REC, 'p2-q2-e1', ['1947/10/6-5', '1955/05/14', '1956/08/20'])], [('–', '-')]),
    'p2-q2-e2': fix_step([table_step(REC, 'p2-q2-e2', ['1955/04/24-18', '1945/05/08', '1955/05/14'])], [('–', '-'), ('جدانوف', 'جودانوف')]),
    'p2-q2-e3': [table_step(REC, 'p2-q2-e3', ['انعقاد مؤتمر الصومام', 'سريان وقف اطلاق النار', 'انهزام فرنسا في معركة ديان بيان فو'], asks='event')],
    'p2-q3-e1': person3('p2-q3-e1', ['p2-q3-e2', 'p2-q3-e3']),
    'p2-q3-e2': person3('p2-q3-e2', ['p2-q3-e3', 'p2-q3-e1']),
    'p2-q3-e3': person3('p2-q3-e3', ['p2-q3-e1', 'p2-q3-e2']),
    'p2-q5-e1': d('p2-q5-e1', ['p2-q5-e2', 'p2-q5-e3', 'p1-q5-e1'], 'geo.terms', 'term'),
    'p2-q5-e2': d('p2-q5-e2', ['p2-q5-e1', 'p2-q5-e3', 'p1-q5-e3'], 'geo.terms', 'term'),
    'p2-q5-e3': d('p2-q5-e3', ['p2-q5-e1', 'p2-q5-e2', 'p1-q5-e2'], 'geo.terms', 'term'),
    'p2-q6-e1': comment('p2-q6-e1', [
        'تفوّق نسب صادرات الولايات المتحدة الأمريكية للصين على صادراتها لكندا.',
        'تفوّق نسب واردات الولايات المتحدة الأمريكية من كندا على وارداتها من الصين.',
        'تقارب نسب الصادرات ونسب الواردات بين شركاء الولايات المتحدة الأمريكية.',
    ], 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).',
        cut=(': الواردات 42.2 %، الصادرات41.4 %', '')),
}
assert all(_trimmed(k) in INTERACTIVE[k][0]['payload']['options'] for k in TRIMS), 'TRIMS غير مطبَّق'
DEFER: set[str] = set()
FIGURES = {
    'p1-d3': (2, [0.135, 0.128, 0.852, 0.7729]),  # إطار الناقل يبدأ تحت إطار العنوان ويضمّ مستطيل «ينجز العمل…»
    'p2-d7': (6, [0.13, 0.0985, 0.885, 0.8868]),  # إطار الناقل بلا العنوان «خريطة العالم» ويقطع حافّة الإطار السفلى
}
NOTE = ('الشخصيّات الثلاث (الموضوع الثاني) mcq بثلاثة خيارات: لا شخصيّات أخرى في التصحيح. «ملء الفراغ» (تعريفان بديلان): الصحيح '
        'التعريف الأوّل. حُذفت من نصّ الخيار (لا من الشرح) جمل التعريف الرسميّ التي تسمّي البند: «مما أدى إلى تقسيم كوريا…»، «(كفاح)»، '
        '«تسيير النقد الدّولي، و». جدولا الأحداث تفاعليّان كاملًا؛ تاريخا باندونغ وجودانوف (مدى أيّام) مشتّت كلٌّ منهما للآخر، بشرطة عاديّة '
        'كما في التصحيح. التعليق على جدول الشركاء التجاريّين: عبارة التصحيح الرابعة تطبع «الواردات 42.2 %» ومجموع الجدول 44.2 %، '
        'فعُرضت بلا الأرقام. سطر p2-q8-e3 (0.5، بلا جواب) مؤجَّل كما سجّله الناقل (ambiguous_mark_position).')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
