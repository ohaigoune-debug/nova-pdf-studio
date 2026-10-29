"""BAC 2020 (الدورة العادية) – التاريخ والجغرافيا – لغات أجنبية، من سجلّ المصدر hist-bac-2020-lang.json (نقل ChatGPT، صفّ القائمة 10).
على قدوة build_hg_bac_2020_lit.py.

    python3 scripts/play/converters/build_hg_bac_2020_lang.py content/play-exams/sets/3AS/HIST/hg-bac-2020-lang-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2020-lang-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). لا شكل معروضًا في هذه الورقة (لا خريطة ولا رسم مطبوع يحيل إليه سؤال)، فـ--pdf اختياريّ.

ما رُوجع قبل البناء:
- record_wordcheck.py على ورقة الموضوع وملفّ التصحيح، ثمّ صورة الصفحة (110 ثمّ 280–700 نقطة/بوصة) لكلّ كلمة مُعلَّمة ولكلّ رقم
  ولكلّ وثيقة وسؤال سطرًا سطرًا (الفحص لا يقارن الشدّات). الأخطاء المؤكَّدة في FIXES، أهمّها: «منحنى» و«متمثّلة» (السجلّ: «منحى»،
  «ممثّلة»)، «الأوربية»، «الانسانية»/«الافريقية»/«الاحصائية» بلا همزة كما طُبعت، «oïl» كما طُبعت في مرجع الجدول، وسقوط الفاصلة
  في «على ما درست اكتب» (الموضوع 1). المدى «(2005–2015)» يُعرض كما طُبع (2005 يمينًا) فلم يُمسّ. جدولا الأرقام (ص2، ص4) طابقا
  الصورة رقمًا رقمًا؛ خانات «34%» تُعرض في السطر العربيّ «34%» والورقة تطبعها «%34» — المعنى واحد فلم تُمسّ. الكشيدة غير منقولة.
- أجوبة التصحيح المستعملة خيارات قوبلت بصورة ملفّ التصحيح.
- p2-d6 في السجلّ منحنى الإجابة النموذجيّة من ملفّ التصحيح: لا يحيل إليه سؤال، فلا يُعرض.

قرارات المحوِّل:
- المصطلحات: mcq، المشتّتات تعريفات مصطلحات أخرى من التصحيح نفسه (ستّة تاريخيّة وستّة جغرافيّة). لا يُعرض «العالم الثالث» و«بلدان
  الجنوب» أحدهما مشتّتًا للآخر (تعريفان يصدق كلّ منهما على الآخر تقريبًا)، ولا «العالم الثالث» مشتّتًا لـ«النظام الرأسمالي» (يذكر
  «الغربي الرّأسمالي»)، ولا «قروض» مشتّتًا لـ«المؤسسات المالية» (يذكر «المؤسسات المالية»)، ولا «هجومات الشمال القسنطيني» مشتّتًا لـ«تدويل
  القضية الجزائرية» (يذكرها). «الحرب الباردة» مشتّت في سؤال «المعسكرين» لأنّ كليهما يذكر «المعسكر» فلا تدلّ الكلمة على الجواب.
- REDACT: «إلى الاتحاد الأوربي» داخل تعريف الاتحاد الأوربي يُحذف من نصّ الخيار وحده (الشرح يعرض التصحيح كاملًا). حذفٌ بلا إضافة.
- الشخصيّات: في التصحيح ثلاث شخصيّات فقط (ستالين، بوش الأب، كريم بلقاسم) — definition_step يشترط ثلاثة مشتّتات ولا تُخلط الشخصيّات
  بالمصطلحات، فلكلّ شخصيّة mcq بثلاثة خيارات (الاثنتان الأخريان)؛ definition2 أدناه هو definition_step نفسه بمشتّتين.
- أسماء البنود في السؤال كما في ورقة الموضوع («التعايش السلمي»، «المؤسّسات المالية»، «النّظام الرأسمالي»، «هجومات الشمال القسنطيني»،
  «مؤتمر الصومام»، «الاتّحاد الأوربي»).
- «أكمل الجدول» (الموضوع 1): mcq لكلّ سطر؛ المشتّتات من التصحيح نفسه غير مطبوعة في الجدول. سطر «1962/03/19» لا يُعرض فيه «مفاوضات/اتفاقية
  إيفيان» (وُقّعت عشيّة وقف إطلاق النار). سطر «تأسيس حلف وارسو»: «1960-12-11» في التصحيح كُتب بصيغة الجدول 1960/12/11.
- التعليق على جدول المبادلات (الموضوع 1): comment_step كالقدوة (أربع عبارات + ثلاث تنقضها أرقام الجدول).
- المنحنى والمقالات: مؤجّلة آليًّا (source_record.py).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import _norm, comment_step, definition_step, elements, record_path, refs_for, split_definition, table_step  # noqa: E402
from source_record import build, load, mcq  # noqa: E402

NAME = 'hist-bac-2020-lang.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))
E = elements(REC)

FIXES = [
    ('p1-d1', 'منحى', 'منحنى'),
    ('p1-d1', 'ممثّلة', 'متمثّلة'),
    ('p1-d1', 'انتقل الصراع', 'انتقل الصّراع'),
    ('p1-d3', 'قوة', 'قوّة'),
    ('p1-q3', 'درست، اكتب', 'درست اكتب'),
    ('p1-d4', 'المؤسسات المالية', 'المؤسّسات المالية'),
    ('p1-d4', 'هذه المؤسسات', 'هذه المؤسّسات'),
    ('p1-d4', 'العالم الثالث', 'العالم الثّالث'),
    ('p1-d4', 'الداخلية', 'الدّاخلية'),
    ('p1-d4', 'منها الدول', 'منها الدّول'),
    ('p1-d4', 'النظام الرأسمالي', 'النّظام الرأسمالي'),
    ('p1-d4', 'الإنسانية', 'الانسانية'),
    ('p1-q5', 'الإحصائية', 'الاحصائية'),
    ('p1-d7', 'امتلاك قوة', 'امتلاك قوّة'),
    ('p1-q6', 'عوامل القوة', 'عوامل القوّة'),
    ('p2-d1', 'خاصة بعد', 'خاصّة بعد'),
    ('p2-d1', 'هجومات الشّمال', 'هجومات الشمال'),
    ('p2-d1', 'بين الشّعب', 'بين الشعب'),
    ('p2-d1', 'للثّورة ...', 'للثورة ...'),
    ('p2-d1', 'لابد', 'لابُد'),
    ('p2-d1', 'الإفريقية', 'الافريقية'),
    ('p2-d2', 'في الصراع', 'في الصّراع'),
    ('p2-d2', 'للعالم الثالث', 'للعالم الثّالث'),
    ('p2-q3', 'العالم الثالث', 'العالم الثّالث'),
    ('p2-d3', 'بين المؤسسات', 'بين المؤسّسات'),
    ('p2-d3', 'الأوروبية', 'الأوربية'),
    ('p2-d3', 'في مؤسسات الاتحاد', 'في مؤسّسات الاتّحاد'),
    ('p2-d3', 'حين الشراكة', 'حين الشّراكة'),
    ('p2-q5', 'تطوّر', 'تطور'),
    ('p2-q5', 'منظّمة', 'منظمة'),
    ('p2-q5', 'الإحصائية', 'الاحصائية'),
    ('p2-d5', 'oil', 'oïl'),
    ('p2-d7', 'العوامل الداخلية', 'العوامل الدّاخلية'),
    ('p2-d7', 'العالم الثالث', 'العالم الثّالث'),
    ('p2-q6', 'العالم الثالث', 'العالم الثّالث'),
]

# ما يسمّي البند داخل تعريفه الرسميّ: يُحذف من نصّ الخيار (في كلّ خطوة يظهر فيها)، لا من الشرح.
REDACT = [(' إلى الاتحاد الأوربي', '')]

_OFFICIAL = ' '.join([e.get('official_answer') or '' for e in E.values()] + [c for t in REC['topics'] for d in t['documents'] for row in (d.get('table') or []) for c in row])


def d(eid, ds, skill, kind, name=None):
    return [definition_step(REC, eid, ds, skill, kind, name)]


def definition2(eid, ds, skill, kind, name=None):
    """definition_step بمشتّتين (حين لا يضمّ التصحيح إلّا ثلاثة بنود من النوع نفسه): mcq بثلاثة خيارات."""
    e = E[eid]
    assert e['answer_type'] == 'fixed' and len(ds) == 2 and eid not in ds and len(set(ds)) == 2, eid
    corr_name, right = split_definition(e['official_answer'])
    name = name or corr_name or (e.get('item') or '').strip()
    opts = [right]
    for x in ds:
        assert E[x]['answer_type'] == 'fixed', x
        _, dt = split_definition(E[x]['official_answer'])
        assert dt and _norm(dt) not in {_norm(o) for o in opts}, (eid, x)
        opts.append(dt)
    prompt = f'ما المقصود بـ«{name}»؟' if kind == 'term' else f'من هو {name}؟'
    return [mcq(prompt, opts, 0, f'«{name}» في الإجابة النموذجيّة: {right}.', e['marks'], skill)]


def t(eid, distractors, asks='date', item=None, src=None):
    """table_step؛ كلّ مشتّت يرد حرفيًّا في التصحيح، أو (src) تاريخ من التصحيح نفسه مكتوب بصيغة الجدول: src = {المشتّت: نصّه في التصحيح}."""
    src = src or {}
    for x in distractors:
        assert (src.get(x) or x) in _OFFICIAL, (eid, x)
    s = table_step(REC, eid, distractors, asks=asks)
    if item:
        old = E[eid]['item'].strip()
        s['prompt'], s['explanation'] = s['prompt'].replace(old, item), s['explanation'].replace(old, item)
    return [s]


CMT = 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).'

INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e3', 'p1-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e1', 'p1-q1-e3', 'p2-q1-e2'], 'hist.terms', 'term', 'التعايش السلمي'),
    'p1-q1-e3': d('p1-q1-e3', ['p1-q1-e1', 'p1-q1-e2', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q2-e1': t('p1-q2-e1', ['اتفاقية بروتون وودز', 'معاهدة روما', 'مؤتمر باندونغ'], asks='event'),
    'p1-q2-e2': t('p1-q2-e2', ['1955/08/20', '1956/08/20', '1960/12/11'], src={'1960/12/11': '1960-12-11'}),
    'p1-q2-e3': t('p1-q2-e3', ['هجومات الشّمال القسنطيني', 'مؤتمر الصّومام', 'مؤتمر باندونغ'], asks='event'),
    'p1-q4-e1': d('p1-q4-e1', ['p1-q4-e3', 'p2-q4-e1', 'p2-q4-e2'], 'geo.terms', 'term', 'المؤسّسات المالية'),
    'p1-q4-e2': d('p1-q4-e2', ['p1-q4-e1', 'p1-q4-e3', 'p2-q4-e1'], 'geo.terms', 'term'),
    'p1-q4-e3': d('p1-q4-e3', ['p1-q4-e1', 'p2-q4-e3', 'p2-q4-e2'], 'geo.terms', 'term', 'النّظام الرأسمالي'),
    'p1-q5-e1': [comment_step(REC, 'p1-q5-e1', [
        'الفائض التّجاري للولايات المتحدة الأمريكية مع الصّين.',
        'تقارب نسبة التّوزيع الجغرافي لصادرات وواردات الولايات المتحدة الأمريكية.',
        'احتلال اليابان المرتبة الأولى في صادرات الولايات المتحدة الأمريكية.',
    ], CMT)],
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p2-q1-e3', 'p2-q1-e2', 'p1-q1-e2'], 'hist.terms', 'term', 'هجومات الشمال القسنطيني'),
    'p2-q1-e2': d('p2-q1-e2', ['p2-q1-e3', 'p1-q1-e2', 'p1-q1-e1'], 'hist.terms', 'term'),
    'p2-q1-e3': d('p2-q1-e3', ['p2-q1-e1', 'p2-q1-e2', 'p1-q1-e3'], 'hist.terms', 'term', 'مؤتمر الصومام'),
    'p2-q2-e1': definition2('p2-q2-e1', ['p2-q2-e2', 'p2-q2-e3'], 'hist.figures', 'person'),
    'p2-q2-e2': definition2('p2-q2-e2', ['p2-q2-e1', 'p2-q2-e3'], 'hist.figures', 'person'),
    'p2-q2-e3': definition2('p2-q2-e3', ['p2-q2-e1', 'p2-q2-e2'], 'hist.figures', 'person'),
    'p2-q4-e1': d('p2-q4-e1', ['p1-q4-e1', 'p1-q4-e3', 'p2-q4-e2'], 'geo.terms', 'term', 'الاتّحاد الأوربي'),
    'p2-q4-e2': d('p2-q4-e2', ['p1-q4-e1', 'p2-q4-e1', 'p2-q4-e3'], 'geo.terms', 'term'),
    'p2-q4-e3': d('p2-q4-e3', ['p1-q4-e1', 'p1-q4-e3', 'p2-q4-e2'], 'geo.terms', 'term'),
}

_used = set()
for steps in INTERACTIVE.values():
    for s in steps:
        opts = s['payload']['options']
        for i, o in enumerate(opts):
            for a, b in REDACT:
                if a in o:
                    o = o.replace(a, b)
                    _used.add(a)
            opts[i] = o
        assert len(set(opts)) == len(opts), s['prompt']
assert _used == {a for a, _ in REDACT}, set(a for a, _ in REDACT) - _used

DEFER = set()
FIGURES = {}
NOTE = ('أسماء البنود في الأسئلة كما في ورقة الموضوع. الشخصيّات الثلاث (الموضوع الثاني) mcq بثلاثة خيارات: لا شخصيّة رابعة في التصحيح. '
        'حُذف «إلى الاتحاد الأوربي» من نصّ خيار تعريف الاتحاد الأوربي (يسمّي البند)؛ الشرح يعرض جواب التصحيح كاملًا. '
        'في سطر «تأسيس حلف وارسو» التاريخ «1960-12-11» من التصحيح نفسه مكتوب بصيغة الجدول 1960/12/11.')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
