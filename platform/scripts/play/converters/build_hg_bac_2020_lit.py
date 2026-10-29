"""BAC 2020 (الدورة العادية) – التاريخ والجغرافيا – آداب وفلسفة، من سجلّ المصدر hist-bac-2020-lit.json (نقل ChatGPT، صفّ القائمة 12).
القدوة لتحويل سجلّات التاريخ والجغرافيا: انسخه لكلّ سجلّ وغيّر المعطيات فقط.

    python3 scripts/play/converters/build_hg_bac_2020_lit.py content/play-exams/sets/3AS/HIST/hg-bac-2020-lit-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2020-lit-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). --pdf مطلوب لقصّ الخرائط المطبوعة في ورقة الموضوع.

ما رُوجع قبل البناء:
- record_wordcheck.py على ورقة الموضوع وملفّ التصحيح (طبقة النصّ المركّبة من مواضع الحروف)، ثمّ صورة الصفحة لكلّ كلمة مُعلَّمة
  ولكلّ رقم في الأسئلة والوثائق (الطبقة تقلب الأرقام). الأخطاء المؤكَّدة في FIXES؛ «وإدخال» صحيحة في الصورة (الطبقة بلا همزة).
- الخرائط المقصوصة: ص3 (خريطة العالم، مطبوعة بالعرض كما في الورقة) وص6 (خريطة أوربا). الوثائق p1-d8، p2-d3، p2-d8 في السجلّ
  رسوم الإجابة النموذجيّة من ملفّ التصحيح: لا يحيل إليها سؤال، فلا تُعرض.

قرارات المحوِّل:
- المصطلحات والشخصيّات: mcq، المشتّتات تعريفات مصطلحات/شخصيّات أخرى من تصحيح الورقة نفسها (الموضوعان)، اختيرت حتى لا يصدق
  أحدها على البند (رئيسا الو.م.أ أو الاتحاد السوفياتي يتمايزان بالتاريخ والأحداث المذكورة في التعريف).
- اسم الشخصيّة في السؤال كما في ورقة الموضوع («جون كيندي»، «نكيتا خروتشوف»، «دوايت ايزنهاور»)؛ التصحيح يكتب «كندي».
- «أكمل الجدول» (الموضوع 1، س3): سطر «إعلان مبدأ ترومان» وسطر «23 مارس 1954» تفاعليّان بمشتّتات من تواريخ/أحداث التصحيح نفسه
  غير المطبوعة في الجدول؛ سطر «انعقاد قمة مالطا» مؤجَّل: التصحيح يطبع التاريخ «1989/12/04/03» (سجّله الناقل typo_in_correction)
  ولا نصحّح التصحيح ولا نجعل صيغة مختلّة خيارًا صحيحًا.
- التعليق على جدول أرقام مطبوع (الموضوع 1 س2، الموضوع 2 س3): multi، الصحيح عبارات التصحيح، والخاطئ عبارات تنقضها أرقام الجدول.
- الخرائط والأعمدة البيانيّة والمقالات: مؤجّلة آليًّا (source_record.py).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import comment_step, definition_step, record_path, refs_for, table_step  # noqa: E402
from source_record import build, load  # noqa: E402

NAME = 'hist-bac-2020-lit.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))

FIXES = [
    ('p1-q2', 'جون كندي', 'جون كيندي'),
    ('p1-q2', 'نيكيتا', 'نكيتا'),
    ('p1-d4', 'الثمانينات', 'الثمانينيات'),
    ('p1-d4', 'التسعينات', 'التسعينيات'),
    ('p1-d4', 'أن تسرع', 'أن تشرع'),
    ('p2-q2', 'إيزنهاور', 'ايزنهاور'),
]

d = lambda eid, ds, skill, kind, name=None: [definition_step(REC, eid, ds, skill, kind, name)]

INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e2', 'p1-q1-e3', 'p2-q1-e3'], 'hist.terms', 'term'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e1', 'p1-q1-e3', 'p2-q1-e2'], 'hist.terms', 'term'),
    'p1-q1-e3': d('p1-q1-e3', ['p2-q1-e3', 'p1-q1-e1', 'p1-q1-e2'], 'hist.terms', 'term'),
    'p1-q2-e1': d('p1-q2-e1', ['p2-q2-e2', 'p1-q2-e3', 'p2-q2-e3'], 'hist.figures', 'person', 'جون كيندي'),
    'p1-q2-e2': d('p1-q2-e2', ['p2-q2-e3', 'p1-q2-e3', 'p2-q2-e1'], 'hist.figures', 'person'),
    'p1-q2-e3': d('p1-q2-e3', ['p2-q2-e1', 'p1-q2-e1', 'p2-q2-e2'], 'hist.figures', 'person', 'نكيتا خروتشوف'),
    'p1-q3-e1': [table_step(REC, 'p1-q3-e1', ['1949/04/04', '1958/10/23', '1960/09/10'])],
    'p1-q3-e2': [table_step(REC, 'p1-q3-e2', ['تأسيس جبهة التّحرير الوطني', 'هجومات الشّمال القسنطيني', 'انعقاد مؤتمر الصّومام'], asks='event')],
    'p1-q5-e1': d('p1-q5-e1', ['p1-q5-e2', 'p1-q5-e3', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p1-q5-e2': d('p1-q5-e2', ['p1-q5-e1', 'p1-q5-e3', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p1-q5-e3': d('p1-q5-e3', ['p1-q5-e1', 'p1-q5-e2', 'p2-q5-e1'], 'geo.terms', 'term'),
    'p1-q6-e1': [comment_step(REC, 'p1-q6-e1', [
        'احتلال الو.م.أ المرتبة الأولى في نسبة الصّادرات العالمية.',
        'تقارب نسب مساهمة الدّول في الصّادرات العالمية.',
        'تساهم دول الاتحاد الأوربي الثّلاث بأكثر من نصف حجم الصّادرات العالمية.',
    ], 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).')],
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p2-q1-e2', 'p2-q1-e3', 'p1-q1-e3'], 'hist.terms', 'term'),
    'p2-q1-e2': d('p2-q1-e2', ['p2-q1-e1', 'p2-q1-e3', 'p1-q1-e2'], 'hist.terms', 'term'),
    'p2-q1-e3': d('p2-q1-e3', ['p2-q1-e1', 'p2-q1-e2', 'p1-q1-e3'], 'hist.terms', 'term'),
    'p2-q2-e1': d('p2-q2-e1', ['p1-q2-e3', 'p2-q2-e2', 'p1-q2-e2'], 'hist.figures', 'person'),
    'p2-q2-e2': d('p2-q2-e2', ['p1-q2-e1', 'p2-q2-e1', 'p2-q2-e3'], 'hist.figures', 'person', 'دوايت ايزنهاور'),
    'p2-q2-e3': d('p2-q2-e3', ['p1-q2-e2', 'p1-q2-e3', 'p1-q2-e1'], 'hist.figures', 'person'),
    'p2-q5-e1': d('p2-q5-e1', ['p2-q5-e3', 'p1-q5-e3', 'p1-q5-e1'], 'geo.terms', 'term'),
    'p2-q5-e2': d('p2-q5-e2', ['p1-q5-e2', 'p2-q5-e3', 'p1-q5-e1'], 'geo.terms', 'term'),
    'p2-q5-e3': d('p2-q5-e3', ['p2-q5-e1', 'p2-q5-e2', 'p1-q5-e3'], 'geo.terms', 'term'),
    'p2-q7-e1': [comment_step(REC, 'p2-q7-e1', [
        'احتلال الو. م. أ المرتبة الأولى عالميا في إنتاج القطن.',
        'تفوّق إنتاج القمح على إنتاج الذّرة في الو. م. أ.',
        'تقارب كميات الإنتاج الزّراعي في الو. م. أ.',
    ], 'اختر العبارات التي تصلح تعليقًا على معطيات الجدول (كلّ العبارات الصحيحة).')],
}
DEFER = {'p1-q3-e3'}
FIGURES = {'p2-d2': (6, [0.13, 0.19, 0.87, 0.765])}  # إطار الناقل يقطع حافّتَي الخريطة ويضمّ رأسيّة الصفحة
NOTE = ('سطر «انعقاد قمة مالطا» في جدول الموضوع الأوّل مؤجَّل: التصحيح يطبع تاريخه «1989/12/04/03». '
        'اسم الشخصيّة في السؤال كما في ورقة الموضوع (التصحيح يكتب «كندي»).')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
