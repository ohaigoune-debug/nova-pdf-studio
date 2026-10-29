"""BAC 2019 (الدورة العادية) – التاريخ والجغرافيا – تسيير واقتصاد، من سجلّ المصدر hist-bac-2019-ge.json (نقل ChatGPT، صفّ القائمة 13).
منسوخ من القدوة build_hg_bac_2020_lit.py (المعطيات فقط تتغيّر، ومساعدات محلّيّة أدناه لما لم تواجهه القدوة).

    python3 scripts/play/converters/build_hg_bac_2019_ge.py content/play-exams/sets/3AS/HIST/hg-bac-2019-ge-p1.json --pdf <الموضوع.pdf>
    python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/HIST/hg-bac-2019-ge-p1.json   (مرّة واحدة)
(ثمّ p2 بالطريقة نفسها). --pdf مطلوب لقصّ خريطة أوربا المطبوعة في ورقة الموضوع.

ما رُوجع قبل البناء:
- record_wordcheck.py على ورقة الموضوع وملفّ التصحيح: طبقة نصّ الموضوع مشوّهة (288 كلمة مُعلَّمة، الأرقام مقلوبة)، فقورن كلّ سطر
  من الأسئلة والوثائق بصورة الصفحة (110 و300 نقطة/بوصة)، وكلّ رقم كذلك (كلّها مطابقة). الفروق المؤكَّدة في FIXES:
  «بريوني» ← «بيروني» (الورقة تطبع «بيروني»)، «خريطة أوربا» ← «خريطة أوروبا» (الموضوع 1 س3؛ س7 من الموضوع 2 يطبع «أوربا»)،
  فاصلة «من العبارة، واعتمادا» في الموضوع الثاني (س4 وس8)، «لتُجبر»، «تُدعّمها»، «تُخفي»، «تُشكل»، شدّات («التّداعيات»، «النّظر»،
  «التّحول»، «السّوق»، «السّلاح»، «بالشّخصيات»، «قوّة»)، «خط»/«يمثل» بلا شدّة حيث لا تظهر، ونقطة بعد علامة التنصيص الأخيرة لا تظهر
  في الورقة (p1-d1، p1-d5، p2-d4)، ومسافتا «" ... بهدف» في أوّل p2-d1. مدّات التطويل في الكلمات المسطَّرة لم تُنقل (كالقدوة).
- ملفّ التصحيح: كلّ الأجوبة الثابتة وعلاماتها قورنت بالصورة. عبارة التصحيح ليست مادّة حرفيّة؛ يُذكر فقط أنّ الناقل كتب «أفريل»
  (التصحيح «أبريل») في تعريف مؤتمر باندونغ.
- الخريطة: ورقة واحدة (ص5، «خريطة أوربا») لسؤالَي الموضوعين (p1-d2 وp2-d7). إطار الناقل [0.145, 0.01, 0.848, 0.674] يضمّ رأسيّة
  الصفحة وشعار الديوان ⇒ FIGURES بعد القياس على صورة الصفحة (إطار الخريطة وعنوانها 0.146–0.847 × 0.139–0.671، بهامش صغير،
  دون تعليمة «ينجز العمل المطلوب على الخريطة المرفقة…» تحتها). الوثائق p1-d3 وp1-d8 وp2-d8 رسوم الإجابة النموذجيّة: لا تُعرض.

قرارات المحوِّل:
- التصحيح يكتب علامات جزئيّة داخل التعريفات («(0.50 ن)»): تُحذف من نسخة في الذاكرة للأجوبة الثابتة قبل بناء الخيارات (_answers)،
  وإلّا ظهرت العلامات داخل الخيارات ودلّت على مصدرها. لا يُمسّ حرف آخر، ولا يُمسّ ملفّ السجلّ.
- المصطلحات: mcq، المشتّتات التعريفات الثلاثة الأخرى من الصنف نفسه في التصحيح (أربعة مصطلحات تاريخ وأربعة جغرافيا في الموضوعين).
  تعريف «مؤتمر باندونغ» يذكر «بمدينة باندونغ»، ومن مشتّتاته تعريف «الحياد الإيجابي» الذي يذكر «مؤتمر باندونغ» أيضًا (لا يصدق عليه).
- الشخصيّات: عبد الناصر ونهرو كلاهما «من مؤسسي حركة عدم الانحياز» فلا يُعرض أحدهما للآخر ⇒ لكلّ منهما مشتّتان فقط (فرحات عباس
  وفيدال كاسترو) ⇒ mcq بثلاثة خيارات (_definition_2، مطابق لـdefinition_step بمشتّتين). فرحات عباس وكاسترو: ثلاثة مشتّتات.
- «أكمل الجدول» (الموضوع 2 س3): سطر التنقيط «2×01» عنصر واحد في السجلّ لسطرين، وجواب «معركة ديان بيان فو» مدى («13 مارس إلى 07 ماي
  1954») لا مثيل لصيغته في التصحيح ⇒ يبقى مؤجَّلًا (table_fill، آليًّا).
- «ب- علّق على الرّسم» (الموضوع 1 س7): الرسم أعمدةُ الجدول المطبوع بأرقامه (p1-d6) ⇒ comment_step: الصحيح عبارات التصحيح الأربع،
  والخاطئ ثلاث عبارات تنقضها أرقام الجدول. التصحيح يكتبها بنقاط «•» تحت عنوان «3) التعليق على الرسم:»، فتُحوَّل في النسخة التي في
  الذاكرة إلى «❖» بلا العنوان (comment_step يقسم على «❖»).
- «أ- علّق على المعطيات الواردة في الجدول» (الموضوع 2 س6): كلّ عبارة من التصحيح عنصر بعلامته (0.50/0.50/0.50/0.25) ⇒ لكلّ عنصر mcq
  (_comment_line، نمط المشروع التجريبيّ 2008): الصحيح عبارة التصحيح، والمشتّتات ثلاث عبارات تنقضها أرقام الجدول المطبوع.
- الخرائط والأعمدة البيانيّة والمقالات وجدول الأحداث: مؤجّلة آليًّا (source_record.py).
"""
import copy
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hg_record import _norm, _TRAIL, comment_step, definition_step, elements, record_path, refs_for, split_definition  # noqa: E402
from source_record import build, load, mcq  # noqa: E402

NAME = 'hist-bac-2019-ge.json'
OUT = sys.argv[1]
PDF = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else None
REC = load(record_path(NAME))

FIXES = [
    ('p1-d1', 'الكتلتين ...".', 'الكتلتين ... "'),
    ('p1-q1', 'خطّ', 'خط'),
    ('p1-q3', 'خريطة أوربا', 'خريطة أوروبا'),
    ('p1-d5', 'ولكن التداعيات', 'ولكن التّداعيات'),
    ('p1-d5', 'إعادة النظر', 'إعادة النّظر'),
    ('p1-d5', 'التحوّل', 'التّحول'),
    ('p1-d5', 'اقتصاد السوق...".', 'اقتصاد السّوق ..."'),
    ('p1-q6', 'يمثّل', 'يمثل'),
    ('p2-d1', '"...بهدف', '" ... بهدف'),
    ('p2-d1', 'بريوني', 'بيروني'),
    ('p2-d1', 'السلاح', 'السّلاح'),
    ('p2-q2', 'بالشخصيات', 'بالشّخصيات'),
    ('p2-d3', 'تخفي', 'تُخفي'),
    ('p2-d3', 'تشكّل', 'تُشكل'),
    ('p2-q4', 'من العبارة واعتمادا', 'من العبارة، واعتمادا'),
    ('p2-d4', 'لتجبر', 'لتُجبر'),
    ('p2-d4', 'تدعّمها', 'تُدعّمها'),
    ('p2-d4', 'الأجنبي...".', 'الأجنبي..."'),
    ('p2-d9', 'قوة', 'قوّة'),
    ('p2-q8', 'من العبارة واعتمادا', 'من العبارة، واعتمادا'),
]

_MARK = re.compile(r'\s*\(\s*\d+(?:[.,]\d+)?\s*ن\s*\)')
_COMMENT_HEAD = '3) التعليق على الرسم:\n'


def _answers(rec: dict) -> dict:
    """نسخة في الذاكرة: الأجوبة الثابتة بلا العلامات الجزئيّة «(0.50 ن)»، وتعليق الموضوع 1 س7 بـ«❖» بلا عنوانه."""
    r = copy.deepcopy(rec)
    for t in r['topics']:
        for q in t['questions']:
            for e in q['rubric']:
                if e['answer_type'] in ('fixed', 'alternatives') and e.get('official_answer'):
                    e['official_answer'] = _MARK.sub('', e['official_answer'])
                if e['id'] == 'p1-q7-e1':
                    a = e['official_answer']
                    assert a.startswith(_COMMENT_HEAD) and a.count('•') == 4, a
                    e['official_answer'] = a[len(_COMMENT_HEAD):].replace('•', '❖')
    return r


ANS = _answers(REC)


def _definition_2(rec: dict, eid: str, distractor_eids: list[str], skill: str, kind: str, name: str | None = None) -> dict:
    """hg_record.definition_step نفسه لكن بمشتّتين (3 خيارات) حين لا يوجد في التصحيح ثالثٌ صالح."""
    E = elements(rec)
    e = E[eid]
    assert e['answer_type'] == 'fixed' and len(distractor_eids) == 2 and eid not in distractor_eids and len(set(distractor_eids)) == 2, eid
    corr_name, right = split_definition(e['official_answer'])
    name = name or corr_name or (e.get('item') or '').strip()
    opts = [right]
    for x in distractor_eids:
        assert E[x]['answer_type'] == 'fixed', x
        dt = split_definition(E[x]['official_answer'])[1]
        assert dt and _norm(dt) not in {_norm(o) for o in opts}, (eid, x, 'duplicate option')
        opts.append(dt)
    prompt = f'ما المقصود بـ«{name}»؟' if kind == 'term' else f'من هو {name}؟'
    return mcq(prompt, opts, 0, f'«{name}» في الإجابة النموذجيّة: {right}.', e['marks'], skill)


def _comment_line(rec: dict, eid: str, false_statements: list[str], prompt: str, skill: str = 'geo.data') -> dict:
    """عبارة تعليق واحدة = عنصر بعلامته: mcq، الصحيح عبارة التصحيح (بلا «•» ولا النقطة الأخيرة)، والمشتّتات تنقضها أرقام الجدول."""
    e = elements(rec)[eid]
    assert e['answer_type'] == 'alternatives' and e['official_answer'].count('•') == 1, eid
    right = _TRAIL.sub('', e['official_answer'].replace('•', '').strip())
    opts = [right, *[_TRAIL.sub('', x.strip()) for x in false_statements]]
    assert len(false_statements) == 3 and len({_norm(o) for o in opts}) == 4, (eid, 'duplicate option')
    return mcq(prompt, opts, 0, f'من التعليق في الإجابة النموذجيّة: {right}.', e['marks'], skill)


d = lambda eid, ds, skill, kind, name=None: [definition_step(ANS, eid, ds, skill, kind, name)]
d2 = lambda eid, ds, skill, kind, name=None: [_definition_2(ANS, eid, ds, skill, kind, name)]

# عبارات خاطئة يناقضها جدول نسب صادرات الشركاء نحو الجزائر 2013 (p2-d5): الصين 12.4 أعلى نسبة، الأرجنتين 3.2 أدناها،
# الو.م.أ 4.3، ألمانيا 5.2، تركيا 3.8 + الأرجنتين 3.2 = 7.0 مقابل فرنسا 11.4 + إيطاليا 10.3، دولتان فقط من أمريكا من ثمانٍ.
F1 = 'تقارب نسب صادرات الشركاء التجاريين نحو الجزائر.'
F2 = 'معظم الشركاء من قارة أمريكا.'
F3 = 'احتلال الو.م.أ المرتبة الأولى بين الشركاء التجاريين للجزائر.'
F4 = 'ضعف صادرات الصين نحو الجزائر مقارنة بباقي الشركاء.'
F5 = 'تفوق صادرات تركيا والأرجنتين نحو الجزائر على صادرات فرنسا وإيطاليا.'
F6 = 'احتلال ألمانيا المرتبة الأولى بين الشركاء التجاريين للجزائر.'
P2Q6 = 'أيّ العبارات التالية تصلح تعليقًا على معطيات الجدول؟'

INTERACTIVE = {
    # ── الموضوع الأوّل ──
    'p1-q1-e1': d('p1-q1-e1', ['p1-q1-e2', 'p2-q1-e1', 'p2-q1-e2'], 'hist.terms', 'term', 'الصراع شرق – غرب'),
    'p1-q1-e2': d('p1-q1-e2', ['p1-q1-e1', 'p2-q1-e1', 'p2-q1-e2'], 'hist.terms', 'term'),
    'p1-q2-e1': d('p1-q2-e1', ['p1-q2-e2', 'p2-q2-e1', 'p2-q2-e2'], 'hist.figures', 'person'),
    'p1-q2-e2': d('p1-q2-e2', ['p1-q2-e1', 'p2-q2-e1', 'p2-q2-e2'], 'hist.figures', 'person'),
    'p1-q5-e1': d('p1-q5-e1', ['p1-q5-e2', 'p2-q5-e1', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p1-q5-e2': d('p1-q5-e2', ['p1-q5-e1', 'p2-q5-e1', 'p2-q5-e2'], 'geo.terms', 'term', 'اقتصاد السّوق'),
    'p1-q7-e1': [comment_step(ANS, 'p1-q7-e1', [
        'تقارب نسب المبادلات التجارية للو م أ مع مختلف المناطق عام 2017.',
        'ارتفاع نسبة الصادرات مع اليابان والصين.',
        'تفوق نسبة الواردات على نسبة الصادرات مع كندا والمكسيك.',
    ], 'اختر العبارات التي تصلح تعليقًا على الرسم البياني لمعطيات الجدول (كلّ العبارات الصحيحة).')],
    # ── الموضوع الثاني ──
    'p2-q1-e1': d('p2-q1-e1', ['p1-q1-e1', 'p1-q1-e2', 'p2-q1-e2'], 'hist.terms', 'term'),
    'p2-q1-e2': d('p2-q1-e2', ['p1-q1-e1', 'p1-q1-e2', 'p2-q1-e1'], 'hist.terms', 'term'),
    'p2-q2-e1': d2('p2-q2-e1', ['p1-q2-e1', 'p1-q2-e2'], 'hist.figures', 'person'),
    'p2-q2-e2': d2('p2-q2-e2', ['p1-q2-e2', 'p1-q2-e1'], 'hist.figures', 'person'),
    'p2-q5-e1': d('p2-q5-e1', ['p1-q5-e1', 'p1-q5-e2', 'p2-q5-e2'], 'geo.terms', 'term'),
    'p2-q5-e2': d('p2-q5-e2', ['p1-q5-e1', 'p1-q5-e2', 'p2-q5-e1'], 'geo.terms', 'term', 'صندوق النّقد الدولي'),
    'p2-q6-e1': [_comment_line(ANS, 'p2-q6-e1', [F1, F3, F6], P2Q6)],
    'p2-q6-e2': [_comment_line(ANS, 'p2-q6-e2', [F2, F4, F5], P2Q6)],
    'p2-q6-e3': [_comment_line(ANS, 'p2-q6-e3', [F1, F5, F6], P2Q6)],
    'p2-q6-e4': [_comment_line(ANS, 'p2-q6-e4', [F2, F3, F4], P2Q6)],
}
DEFER: set[str] = set()
_MAP = [0.14, 0.133, 0.853, 0.677]  # ص5: إطار «خريطة أوربا» وعنوانها، بلا رأسيّة الصفحة ولا التعليمة تحته
FIGURES = {'p1-d2': (5, _MAP), 'p2-d7': (5, _MAP)}
NOTE = ('جدول أحداث الموضوع الثاني (عنصر واحد «2×01» لسطرين) مؤجَّل: جواب «معركة ديان بيان فو» مدى تاريخيّ لا مثيل لصيغته في التصحيح. '
        'العلامات الجزئيّة «(0.50 ن)» حُذفت من نصوص الخيارات فقط. عبد الناصر ونهرو (مؤسّسا حركة عدم الانحياز) لا يُعرض أحدهما للآخر: '
        'سؤالاهما بثلاثة خيارات. التعليق على جدول الشركاء (الموضوع الثاني): mcq لكلّ عبارة من التصحيح بعلامتها.')

paper = 1 if OUT.endswith('-p1.json') else 2
mine = {k: v for k, v in INTERACTIVE.items() if k.startswith(f'p{paper}-')}
doc = build(record_path(NAME), OUT, interactive=mine, refs=refs_for(NAME), defer=DEFER, pdf=PDF, fixes=FIXES, note=NOTE, figures=FIGURES)
inter = [s for s in doc['steps'] if s['review_status'] == 'needs_human_review']
print(doc['set_id'], len(doc['original_questions']), 'questions', len(doc['steps']), 'steps',
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts)")
