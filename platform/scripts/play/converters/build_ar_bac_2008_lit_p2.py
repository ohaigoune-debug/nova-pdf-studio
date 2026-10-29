"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (محمّد البشير الإبراهيميّ، «نجوم متألّقة»).
Exam (most faithful source): gdrive 1Z48IhsfM18BggVDT782C0cBJ1iars5zr (file titled «.اختبار اللغة العربية دورة 2018.pdf.docx» — its
content is the 2008 paper, checked against the ONEC paper);
same paper as PDF (owner's copy): gdrive 1wrDR73YuePFL_eKMLkQc51yd-ebUa3XN (BAC 2008 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1uTEmSjvlXbd3xfIzedfijg5JAxcdP72m (01_الموضوع.pdf, pages 2–3, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 1ZoDy-bNz9hZnuUi_pOAgFtC7vFWx9-bu (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2008_sci_p1.py): PARAS below were generated from the .docx with python-docx and spliced into this
file by script (paragraph text read exactly; only outer whitespace and outer direction marks trimmed); every verbatim string
of the JSON is built from PARAS (the fix below applied with _fix, asserted to occur once) and was re-checked programmatically
against the docx. The docx was compared line by line with the ONEC paper (page images enlarged ×2–×5): same five paragraphs,
same questions, same underlines («تَبْني», first word of paragraph 4; «مجتمعةً» in paragraph 5) and bracketed sentences
«(طال في الجهلِ لَيْلُهُ)», «(رَانَ عليها الجهلُ)». The correction PDF has no text layer; the scheme was read from its page
image (enlarged ×2). Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx defect fixed from the ONEC paper: paragraph 5 «إنما تتفاضَلُ وتتَعالى» ⇒ «إنما تفاضَلُ وتعالى» (ONEC, one تاء each).
Other differences are diacritics / labels only (docx kept): «متأّلقةٌ» (shadda on the alif; ONEC «متألّقةٌ»), part labels
«أوّلا-/ثانيا-/ثالثا-» (ONEC «I/II/III ـ»). Part 2 Q3 is two docx paragraphs (the expression on its own line, as on the ONEC
paper) ⇒ joined with a line break.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «آداب وفلسفة» ⇒ LIT.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item; an unsplit mark ⇒ one element.
- Q1 «2», Q2 «1,5», Q4 «02»: one element each. Q3 «2.5» unsplit for «وضّحه» (the writer's four bases) and «بيّن موقفك منه»
  («ملاحظة: موقف الطّالب يكون مدعومًا بالتّعليل») ⇒ one element of 2.5 with interactive steps (1.5) for the writer's stance and
  one essay_builder step (1) for the candidate's stance (rule 11). This 1.5 / 1 step split is ours — owner to confirm.
  Q5 (تلخيص) «2×01» = دلالة المضمون / صحّة اللّغة وسلامة التّعبير ⇒ two deferred elements.
- Part 2 Q1: «0,5» per word / sentence ⇒ four elements. Q2: «0,5» per sentence ⇒ two elements. Q3 «3×0,5» = the type
  (استعارة مكنيّة) / the explanation / the effect. Q4 «3×0,5» with four قرائن listed («…») ⇒ one element of 1.5.
- Part 3 Q1 «01 + 01» = the verdict (طرحه اتّسم بالحياد) / its justification (the objectivity it shows). The scheme gives a
  fixed verdict (no «يُقبل كلّ رأي معلّل») ⇒ interactive. Q2 «01 + 01»: both marks sit beside the list of characteristics;
  read as the two demands of the question (the school «مدرسة الصّنعة اللّفظيّة» / its characteristics) — owner to confirm.
- Distractors avoid what the scheme or usage could accept: no «كناية» for «قادوا الحياة بزمام», no «الزّمام» in the لازم bank
  (the scheme names «قادوا»), no «حال/استئنافيّة» for the نعت sentence, no اسم إشارة («أولئك» occurs) among the قرائن.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
DOCX_ID = "1Z48IhsfM18BggVDT782C0cBJ1iars5zr"
DOCX_TITLE = ".اختبار اللغة العربية دورة 2018.pdf.docx"
PDF_ID = "1wrDR73YuePFL_eKMLkQc51yd-ebUa3XN"
OFFICIAL_ID = "1uTEmSjvlXbd3xfIzedfijg5JAxcdP72m"
CORR_ID = "1ZoDy-bNz9hZnuUi_pOAgFtC7vFWx9-bu"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    34: "الموضوع الثاني",
    35: "النّص:",
    36: "«نجُومٌ متأّلقةٌ في ليل الجزائر الحالك، منها الكبيرةُ ومنها الصَّغيرةُ، ولكل واحدة حظُّها من اللألاَءِ والإشْرَاق، وقِسطها من الإضاءة لِجانبٍ من جَوانب هذا الوطن الذي (طال في الجهلِ لَيْلُهُ)، وأقامَ بالأُمَيّةِ ويْلهُ.",
    37: "حياةُ الأممِ في هذا العصر بالمدارسِ، ما في هذا شكّ، إلاَّ في قلوبٍ (رَانَ عليها الجهلُ)، وغَانَ عليها الفسادُ، ونفوسٍ ختم عليها الضّلال، وضَرَبَ على مشاعرها المسْخُ وطالَ عليها الأمَدُ في الرّق، فصَدِئَتْ منها البصَائِرُ، وعمِيَت الأبصار، فتغيّر نظرها في الحياة ووسائلها، فرضيت بالدُّونِ، ولاَذت بالسُّكون.",
    38: "الحياةُ بالعلم، والمدرسة منبع العلم، ومَشرع العرْفَانِ، وطَريق الهِدَاية إلى الحياةِ الشريفةِ، فَمَن طَلب هذا النَّوع مِن الحياة من غير طريق العلم زَلّ، ومن الْتَمَسَ الهداية إليه من غيرها ضَلّ، وحياةُ الأممِ التي نراها ونُعاشرها شاهِدُ صِدق على ذلك.",
    39: "تَبْني الأممُ أول ما تبني من القُصور، وتشيد ما تشيد من المصانع، وتنسق ما تنسق من الحَدَائق، وتحف ذلك كله بالسُّور المَنيع، فإذا ذلك كلُّه مدينةٌ ضخمةٌ جميلةٌ، ولكنها بغير المدرسةِ عقد بلا واسطةٍ، أو جسم بلا قلبٍ.",
    40: "والأُمَمُ إنما تتفاضَلُ وتتَعالى بالبناء للخير والمنفعة والجمال والقوة، وما عدا هذه الأربعة فهو فضول عابث، لا يدخل في قصد العقلاء. وقد بنى أسلافنا لكل أولئك مجتمعةً ومفَتَرِقةً، بنوا المساجد مظهرًا لْلخير، وشَادُوا المَدَارس مظهرًا للمَنفعة، وأعلوا الحصون مظهرًا للقوة، وسمكوا القُصور مظهرًا للجَمَال، فضموا أطْرَاف الفَخْر، وجَمعُوا حواشي المجدِ، وحازوا آفاق الكَمَال، وقادُوا الحياة بزمام، وأنشأُوا بذلك كله للحَضَارة الإنْسَانية الشَّاملة نَموذَجا من المدِينة الفاضِلَة التي تخيلها حُكماء اليُونان، ولم يُحَقِقها ساسةُ يونان، وإنما حقَّقها من سادَ بالعَدْل، وقَاد بالعَقلِ، وأولئك آبائي !!»",
    41: "محمد البشير الإبراهيمي \"عيون البصائر\"",
    45: "الأسئلة:",
    46: "أوّلا- البناء الفكري: (10 نقاط)",
    47: "وضّح العلاقة بين المدارس والنجوم من خلال النّص.",
    48: "ما العلم الذي يتحدث عنه الكاتب ويدعو إليه؟",
    49: "للكاتب موقف من التّفاضل بين الأمم، وضّحه، وبين موقفك منه.",
    50: "تتجلى في النّص مظاهر الاتّساق. وضّحها.",
    51: "لخّص مضمون النص.",
    52: "ثانيا- البناء اللّغوي: (06 نقاط)",
    53: "أعرب إعرابا تفصيليا ما تحته خط، وما بين قوسين إعراب جمل.",
    54: "عين المسند والمسند إليه فيما يلي: (عميت الأبصار)؛ (المدرسة منبع العلم).",
    55: "في العبارة التالية صورة بيانية؛ حددها ثم اشرحها، وبين أثرها في المعنى:",
    56: "(قادوا الحياة بزمام).",
    57: "ما القرائن التي حققت الانسجام في الفقرة الأخيرة؟",
    58: "ثالثا- التّقويم النقدي: (04 نقاط)",
    59: "هل ترى الكاتب محايدا في هذا الموضوع؟ علل.",
    60: "ما المدرسة التي ينتمي إليها الكاتب من خلال النص؟ أذكر خصائصها.",
    73: "انتهــى الموضوع الثاني",
}


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


# تصويب من الموضوع الرّسميّ (انظر التّوثيق أعلاه)
TEXT_PARAS = [PARAS[36], PARAS[37], PARAS[38], PARAS[39], _fix(PARAS[40], "تتفاضَلُ وتتَعالى", "تفاضَلُ وتعالى")]
P1, P2, P3 = PARAS[46], PARAS[52], PARAS[58]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and TEXT_PARAS[0].startswith("«نجُومٌ")
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[41]},
]


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs=DOCS):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


q("q1", "1", P1, PARAS[47], 2, [el("q1-e1", "العلاقة بين المدارس والنّجوم", 2)])
q("q2", "2", P1, PARAS[48], 1.5, [el("q2-e1", "العلم الّذي يدعو إليه الكاتب", 1.5)])
q("q3", "3", P1, PARAS[49], 2.5, [el("q3-e1", "موقف الكاتب من التّفاضل بين الأمم وموقف المترشّح منه", 2.5)])
q("q4", "4", P1, PARAS[50], 2, [el("q4-e1", "مظاهر الاتّساق في النّصّ", 2)])
q("q5", "5", P1, PARAS[51], 2, [el("q5-e1", "التّلخيص: دلالة المضمون", 1), el("q5-e2", "التّلخيص: صحّة اللّغة وسلامة التّعبير", 1)])
q("q6", "1", P2, PARAS[53], 2, [el("q6-e1", "إعراب «تبني»", 0.5), el("q6-e2", "إعراب «مجتمعةً»", 0.5),
                               el("q6-e3", "محلّ جملة (طال في الجهل ليله)", 0.5), el("q6-e4", "محلّ جملة (ران عليها الجهل)", 0.5)])
q("q7", "2", P2, PARAS[54], 1, [el("q7-e1", "(عميت الأبصار): المسند والمسند إليه", 0.5), el("q7-e2", "(المدرسة منبع العلم): المسند والمسند إليه", 0.5)])
q("q8", "3", P2, PARAS[55] + "\n" + PARAS[56], 1.5, [el("q8-e1", "تحديد الصّورة", 0.5), el("q8-e2", "شرحها", 0.5), el("q8-e3", "أثرها في المعنى", 0.5)])
q("q9", "4", P2, PARAS[57], 1.5, [el("q9-e1", "ثلاث قرائن حقّقت الانسجام (3×0,5)", 1.5)])
q("q10", "1", P3, PARAS[59], 2, [el("q10-e1", "الحكم على حياد الكاتب", 1), el("q10-e2", "التّعليل", 1)])
q("q11", "2", P3, PARAS[60], 2, [el("q11-e1", "المدرسة الّتي ينتمي إليها الكاتب", 1), el("q11-e2", "خصائصها", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("العلاقة بين المدارس والنّجوم علاقة مشابهة، إذ تشبه المدارس النّجوم في كونها تنير درب المتعلّمين إلى برّ الأمان، وإلى المستقبل الآمن "
           "مثلما تهدي النّجوم المسافر ليلًا للوصول إلى مقصده.")
st("s01", "q1", "q1-e1", "mcq", "ما العلاقة بين المدارس والنّجوم من خلال النّصّ؟",
   {"options": ["علاقة مشابهة", "علاقة تضادّ", "علاقة جزء بكلّ", "لا علاقة بينهما"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.link")
st("s02", "q1", "q1-e1", "fill_blank", "وضّح هذه العلاقة:",
   {"text": "تشبه المدارس النّجوم في كونها تنير درب ____ إلى برّ الأمان، مثلما تهدي النّجوم ____ ليلًا للوصول إلى مقصده.",
    "bank": ["المتعلّمين", "المسافر", "الحكّام", "الفلاّح"]},
   {"blanks": [["المتعلّمين"], ["المسافر"]]}, Q1_EXPL, 1, "ar.comprehension.link", "b")
Q2_EXPL = "العلم الّذي تحدّث عنه الكاتب ودعا إليه هو العلم النّافع الّذي يبني الأمم، ويهدي إلى جادّة الصّواب، سواء أكان علمًا دينيًّا أم مادّيًّا تجريبيًّا."
st("s03", "q2", "q2-e1", "mcq", "ما العلم الّذي يتحدّث عنه الكاتب ويدعو إليه؟",
   {"options": ["العلم النّافع الّذي يبني الأمم ويهدي إلى جادّة الصّواب", "علم الجدل والمناظرة", "علم الأنساب وأخبار الملوك", "علم التّنجيم"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.idea")
st("s04", "q2", "q2-e1", "mcq", "هل يقصر الكاتب هذا العلم على نوع واحد؟",
   {"options": ["لا، سواء أكان علمًا دينيًّا أم مادّيًّا تجريبيًّا", "نعم، يقصره على العلم الدّينيّ وحده", "نعم، يقصره على العلم المادّيّ التّجريبيّ وحده"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.details", "b")
Q3_EXPL = ("بنى الكاتب موقفه من التّفاضل على أربع قواعد هي: الخير، المنفعة، الجمال، القوّة؛ فجعل المسجد مظهرًا للخير، والمدرسة للمنفعة، والحصون للقوّة، "
           "والقصور للجمال، وما عدا ذلك فهو عبث. ملاحظة: موقف الطّالب يكون مدعومًا بالتّعليل.")
st("s05", "q3", "q3-e1", "multi", "على أيّ القواعد بنى الكاتب موقفه من التّفاضل بين الأمم؟ (اختر كلّ ما يصحّ)",
   {"options": ["الخير", "المنفعة", "الجمال", "القوّة", "كثرة العدد", "اتّساع الأرض"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s06", "q3", "q3-e1", "matching", "طابق كلّ بناء بما جعله الكاتب مظهرًا له.",
   {"lefts": ["المساجد", "المدارس", "الحصون", "القصور"], "rights": ["الخير", "المنفعة", "القوّة", "الجمال", "الثّروة"]},
   {"pairs": [0, 1, 2, 3]}, Q3_EXPL, 0.75, "ar.comprehension.details", "b")
st("s07", "q3", "q3-e1", "fill_blank", "أكمل من النّصّ:",
   {"text": "وما عدا هذه الأربعة فهو ____ عابث، لا يدخل في قصد العقلاء.", "bank": ["فضول", "فخر", "مجد"]},
   {"blanks": [["فضول"]]}, Q3_EXPL, 0.25, "ar.comprehension.evidence", "c")
essay("s08", "q3", "q3-e1", "موقف الإبراهيميّ من التّفاضل بين الأمم", "موقف المترشّح", "موقف الطّالب يكون مدعومًا بالتّعليل", 1,
      {"task": "بيان موقف المترشّح من موقف الكاتب", "question": PARAS[49],
       "scheme": "«ملاحظة: موقف الطّالب يكون مدعومًا بالتّعليل» (علامة السّؤال 2.5 دون تفصيل؛ قُسّمت هنا 1.5 لموقف الكاتب و1 لموقف المترشّح)",
       "model_example": None},
      Q3_EXPL, "ar.comprehension.opinion", "d")
Q4_EXPL = ("تتجلّى مظاهر الاتّساق في العرض المنطقيّ للأفكار، وذلك من خلال التّعميم ثمّ التّفصيل، للوصول إلى النّتيجة أخيرًا؛ حيث بدأ بتشبيه المدرسة "
           "بالنّجوم، ثمّ فصّل دورها في بناء المجتمع، وعقد مفاضلة بين الأمم ليخلص إلى إقرار ما حقّقته المدرسة من مدنيّة وحضارة في تاريخنا المجيد.")
st("s09", "q4", "q4-e1", "mcq", "فيمَ تتجلّى مظاهر الاتّساق في النّصّ؟",
   {"options": ["في العرض المنطقيّ للأفكار من خلال التّعميم ثمّ التّفصيل للوصول إلى النّتيجة", "في تكرار الفكرة الواحدة دون تطوير",
                "في الانتقال العشوائيّ بين الأفكار", "في الاعتماد على الحوار بين الشّخصيّات"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.cohesion.effect")
st("s10", "q4", "q4-e1", "ordering", "رتّب مراحل عرض الكاتب لأفكاره كما وردت في النّصّ:",
   {"items": ["تشبيه المدرسة بالنّجوم", "تفصيل دور المدرسة في بناء المجتمع", "عقد مفاضلة بين الأمم",
              "إقرار ما حقّقته المدرسة من مدنيّة وحضارة في تاريخنا المجيد"]},
   {"order": [0, 1, 2, 3]}, Q4_EXPL, 1.5, "ar.cohesion.effect", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "محمّد البشير الإبراهيميّ، عيون البصائر (بكالوريا 2008، آداب وفلسفة، الموضوع الثّاني)",
            "scheme": "تلخيص مضمون النّصّ: ويراعى فيه: دلالة المضمون – صحّة اللّغة وسلامة التّعبير (2×01)", "model_example": None}
SUM_EXPL = "تلخيص مضمون النّصّ: ويراعى فيه دلالة المضمون (01)، وصحّة اللّغة وسلامة التّعبير (01). لا تقدّم الإجابة النّموذجيّة نموذجًا للتّلخيص."
essay("s11", "q5", "q5-e1", "تلخيص نصّ الإبراهيميّ «نجوم متألّقة»", "المضمون", "دلالة المضمون", 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s12", "q5", "q5-e2", "تلخيص نصّ الإبراهيميّ «نجوم متألّقة»", "اللّغة والتّعبير", "صحّة اللّغة وسلامة التّعبير", 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s13", "q6", "q6-e1", "mcq", "ما إعراب «تبني» في قوله: «تبني الأممُ أوّلَ ما تبني من القصور»؟",
   {"options": ["فعل مضارع مرفوع بالضّمّة المقدّرة على الياء منع من ظهورها الثّقل", "فعل مضارع مرفوع بالضّمّة الظّاهرة على آخره",
                "فعل مضارع منصوب بالفتحة المقدّرة على الياء", "فعل مضارع مجزوم بحذف حرف العلّة"]},
   {"correct": 0}, "تبني: فعل مضارع مرفوع بالضّمّة المقدّرة على الياء منع من ظهورها الثّقل.", 0.5, "ar.grammar.irab")
st("s14", "q6", "q6-e2", "mcq", "ما إعراب «مجتمعةً» في قوله: «وقد بنى أسلافنا لكلّ أولئك مجتمعةً ومفترقةً»؟",
   {"options": ["حال منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "خبر منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "مجتمعة: حال منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s15", "q6", "q6-e3", "mcq", "ما محلّ جملة (طال في الجهل ليله) من الإعراب في قوله: «هذا الوطن الّذي (طال في الجهل ليله)»؟",
   {"options": ["جملة فعليّة، صلة الموصول، لا محلّ لها من الإعراب", "جملة فعليّة، في محلّ رفع نعت", "جملة فعليّة، في محلّ نصب حال",
                "جملة فعليّة، في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "«طال في الجهل ليله»: جملة فعليّة، صلة الموصول، لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s16", "q6", "q6-e4", "mcq", "ما محلّ جملة (ران عليها الجهل) من الإعراب في قوله: «إلاّ في قلوبٍ (ران عليها الجهل)»؟",
   {"options": ["جملة فعليّة، في محلّ جرّ نعت لـ(قلوب)", "جملة فعليّة، صلة الموصول، لا محلّ لها من الإعراب", "جملة فعليّة، في محلّ رفع خبر",
                "جملة فعليّة، في محلّ نصب مفعول به"]},
   {"correct": 0}, "«ران عليها الجهل»: جملة فعليّة، في محلّ جرّ نعت لـ(قلوب).", 0.5, "ar.grammar.sentence_case")
MS_EXPL = "عميت الأبصار: عميت مسند، الأبصار مسند إليه. المدرسة منبع العلم: المدرسة مسند إليه، منبع مسند."
st("s17", "q7", "q7-e1", "matching", "عيّن المسند والمسند إليه في (عميت الأبصار):",
   {"lefts": ["عميت", "الأبصار"], "rights": ["مسند", "مسند إليه", "فضلة"]},
   {"pairs": [0, 1]}, MS_EXPL, 0.5, "ar.grammar.rules")
st("s18", "q7", "q7-e2", "mcq", "عيّن المسند والمسند إليه في (المدرسة منبع العلم):",
   {"options": ["المدرسة مسند إليه، منبع مسند", "المدرسة مسند، منبع مسند إليه", "المدرسة مسند إليه، العلم مسند", "منبع مسند إليه، العلم مسند"]},
   {"correct": 0}, MS_EXPL, 0.5, "ar.grammar.rules")
IMG_EXPL = ("الصّورة البيانيّة في (قادوا الحياة بزمام): هي استعارة مكنيّة، حيث شبّه الحياة بدابّة لها زمام تنقاد به، وحذف المشبّه به، وترك شيئًا من "
            "لوازمه (قادوا) على سبيل الاستعارة المكنيّة. أثرها: تجسيد المعنى، وتوضيحه.")
st("s19", "q8", "q8-e1", "mcq", "حدّد الصّورة البيانيّة في (قادوا الحياة بزمام):",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه تمثيليّ"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s20", "q8", "q8-e2", "fill_blank", "اشرح الصّورة:",
   {"text": "شبّه ____ بدابّة لها زمام تنقاد به، وحذف المشبّه به، وترك شيئًا من لوازمه (____).", "bank": ["الحياة", "قادوا", "الأسلاف", "العقل"]},
   {"blanks": [["الحياة"], ["قادوا"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s21", "q8", "q8-e3", "mcq", "ما أثر الصّورة في المعنى؟",
   {"options": ["تجسيد المعنى وتوضيحه", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ في العبارة", "إظهار المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
QR_EXPL = ("القرائن الّتي حقّقت الانسجام في الفقرة الأخيرة هي: حروف العطف وهي كثيرة تفيد مطلق الجمع بين المتعاطفين – حروف الجرّ، والضّمائر وبخاصّة "
           "ضمير جمع الغائبين، والتّكرار…")
st("s22", "q9", "q9-e1", "multi", "ما القرائن الّتي حقّقت الانسجام في الفقرة الأخيرة؟ (اختر كلّ ما يصحّ)",
   {"options": ["حروف العطف", "حروف الجرّ", "الضّمائر", "التّكرار", "أدوات الاستفهام", "أدوات النّداء"]},
   {"correct": [0, 1, 2, 3]}, QR_EXPL + " ولا استفهام ولا نداء في الفقرة الأخيرة.", 0.75, "ar.cohesion.connectors")
st("s23", "q9", "q9-e1", "fill_blank", "أكمل:",
   {"text": "حروف العطف وهي كثيرة تفيد ____ الجمع بين المتعاطفين، والضّمائر وبخاصّة ضمير جمع ____.", "bank": ["مطلق", "الغائبين", "المخاطبين", "التّرتيب"]},
   {"blanks": [["مطلق"], ["الغائبين"]]}, QR_EXPL, 0.75, "ar.cohesion.reference", "b")
# ── ثالثًا: التّقويم النّقديّ ──
NEU_EXPL = ("على الرّغم من انتماء الكاتب إلى الحضارة العربيّة الإسلاميّة، وافتخاره بالمدرسة الّتي ينتمي إليها، وإشادته بعمل الآباء والأجداد، إلاّ أنّ "
            "طرحه اتّسم بالحياد، فهو لا يقحم نفسه في الحديث، ملتزمًا الموضوعيّة الّتي تتجلّى في: ابتعاده عن الغلوّ، التّعليل المنطقيّ للأحكام الّتي "
            "أقرّها، والاستشهاد بحوادث التّاريخ.")
st("s24", "q10", "q10-e1", "mcq", "هل ترى الكاتب محايدًا في هذا الموضوع؟",
   {"options": ["نعم، اتّسم طرحه بالحياد رغم انتمائه إلى الحضارة العربيّة الإسلاميّة وافتخاره بها، فهو لا يقحم نفسه في الحديث",
                "لا، لأنّه أقحم ذاته في الحديث وغلا في أحكامه دون تعليل", "لا، لأنّه لم يستشهد بأيّ حادثة من التّاريخ"]},
   {"correct": 0}, NEU_EXPL, 1, "ar.literature.prose")
st("s25", "q10", "q10-e2", "multi", "علّل: فيمَ تتجلّى موضوعيّة الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["ابتعاده عن الغلوّ", "التّعليل المنطقيّ للأحكام الّتي أقرّها", "الاستشهاد بحوادث التّاريخ", "حديثه عن تجاربه الخاصّة وانفعالاته",
                "المبالغة في المدح والذّمّ"]},
   {"correct": [0, 1, 2]}, NEU_EXPL, 1, "ar.literature.prose")
SCH_EXPL = ("ينتمي الكاتب إلى مدرسة الصّنعة اللّفظيّة ومن خصائصها: استخدام المحسّنات كالجناس (ران، غان)، (البصائر، الأبصار)، والصّور البيانيّة من "
            "استعارات وكنايات – استخدام اللّغة الرّاقية الجزلة القويّة، مثل: الحالك، اللألاء، الخ – استخدام التّرادف «اللألاء، الإشراق»، «ران، غان»، "
            "«منبع العلم، ومشرع العرفان»، «زلّ، ضلّ».")
st("s26", "q11", "q11-e1", "mcq", "ما المدرسة الّتي ينتمي إليها الكاتب من خلال النّصّ؟",
   {"options": ["مدرسة الصّنعة اللّفظيّة", "المدرسة الرّومانسيّة", "المدرسة الرّمزيّة", "المدرسة الواقعيّة"]},
   {"correct": 0}, SCH_EXPL, 1, "ar.literature.trend")
st("s27", "q11", "q11-e2", "multi", "اذكر خصائصها: أيّ ممّا يلي من خصائص هذه المدرسة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["استخدام المحسّنات كالجناس", "الصّور البيانيّة من استعارات وكنايات", "استخدام اللّغة الرّاقية الجزلة القويّة", "استخدام التّرادف",
                "البساطة والميل إلى العامّيّة", "التّحرّر من الصّنعة والزّخرفة"]},
   {"correct": [0, 1, 2, 3]}, SCH_EXPL, 0.5, "ar.literature.features")
st("s28", "q11", "q11-e2", "matching", "طابق كلّ خاصّيّة بمثالها من النّصّ.",
   {"lefts": ["الجناس", "اللّغة الرّاقية الجزلة", "التّرادف"], "rights": ["(البصائر، الأبصار)", "الحالك، اللألاء", "(منبع العلم، ومشرع العرفان)"]},
   {"pairs": [0, 1, 2]}, SCH_EXPL, 0.5, "ar.literature.features", "b")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (محمّد البشير الإبراهيميّ: نجوم متألّقة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعبة آداب وفلسفة) في Drive صاحب المنصّة "
         "(ملفّ docx معنون خطأً «دورة 2018»، ومحتواه موضوع 2008)؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص2–3)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «تتفاضَلُ وتتَعالى» ← «تفاضَلُ وتعالى» (الفقرة الأخيرة). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(ص2، صورة ممسوحة قُرئت مكبَّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): موقف المترشّح في س3 "
         "(1 من 2.5، تقسيم من التّحويل) والتّلخيص س5 (2×01).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(ar\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) > 20, "skills.ts not parsed"


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check(total=20):
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    variants = sorted({s for e in els.values() for s in e.get("streams", [])}) or [None]
    for v in variants:
        for qq in Q:
            tot = sum(e["max_points"] for e in qq["rubric_elements"] if v is None or not e.get("streams") or v in e["streams"])
            assert abs(tot - qq["rubric_total"]) < 1e-9, (qq["id"], v, tot)
        steps_v = [s for s in S if v is None or not els[s["rubric_element_id"]].get("streams") or v in els[s["rubric_element_id"]]["streams"]]
        assert abs(sum(s["points"] for s in steps_v) - total) < 1e-9, (v, sum(s["points"] for s in steps_v))
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
            assert len(set(a["correct"])) == len(a["correct"]) and all(0 <= i < len(p["options"]) for i in a["correct"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(bank) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]) and all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:  # القاعدة 12: الإجابة لا تظهر في عنوان وثيقة
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p{PAPER}",
        "kind": "BAC", "year": 2008, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T15:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
