"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (توفيق الحكيم، «فنّ الأدب»: الإبداع ممتدّ في كلّ أوان).
Exam (most faithful source): gdrive 17jJ_DC865rbddKGOYRwoJr0i7nMc_Pch (بكالوريا العربية 2014 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 1F0Kf1tm1LkjDB9tRUMULJDblHDPrgTqC;
official ONEC paper: gdrive 1ioZ1jh6ZyOb8gJ-R6SaDk9a7VwhJJ1jk (01_الموضوع.pdf, pages 3–4, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1HlxuFWzwAMga-_RcnuUV-1AKs7TnZizl (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2014_sci_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly — inner direction marks of the docx kept; only outer whitespace and outer direction marks trimmed) and every verbatim
string of the JSON was re-checked programmatically against the docx. The docx was compared paragraph by paragraph with the
official ONEC paper (rendered at 130 dpi). The mark scheme was read from the rendered pages (150 dpi, fully legible). Every
mark comes from the official scheme; correct options and explanations condense its wording.

Docx defect fixed from the ONEC paper (PATCHES below): part 2 Q3 quotes «وكلُّ ما (أردناه) هذا» where the ONEC paper and the
text itself read «هنا» ⇒ «هنا». Other differences are labels («الشرح اللغوي» vs «شرح المفردات», «ثالثا- التّقويم النقدي»
vs «… النّقديّ للنّصّ») — docx kept.

Conversion notes / points for the owner's review:
- Streams: لغات أجنبيّة only ⇒ LANG.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; distinct demands ⇒ one element
  per demand.
- Q1 «0.5 + 0.5» = topic / the writer's view. Q2 «0.75 + 0.25 + 0.75 + 0.25» = stance on the present + its expression,
  stance on the future + its expression ⇒ four elements. Q3 «0.5 + 0.5» = what the responsibility is / why.
- Q4 «0.5 + 3×0.5» = the genre (المقال) + three features among five («يكتفي المترشّح بذكر ثلاث خصائص فقط») ⇒ 0.5 + 1.5.
  Q5 «0.5 + 3×0.5» = the type (تفسيريّ) + three indicators among four ⇒ 0.5 + 1.5; the example matching uses the two
  examples the scheme gives.
- Q6 (تلخيص) «0.5 / 01 / 0.5» = فهم المضمون / تقنية التّلخيص / سلامة اللّغة وجودة الأسلوب ⇒ three deferred elements.
- Part 2: Q1 «6×0.25» = three cohesion devices among four + an example for each ⇒ two elements of 0.75 (devices / examples).
  Q2 «4×0.25» (ماضيه, unlabelled) ⇒ one element of 1 (function, mark, the ياء/هاء parsing). Q3 «0.5 + 0.5».
  Q4 «3×0.25» = the figure (طباق الإيجاب) + two examples among many («توجد أمثلة أخرى في النّصّ») ⇒ 0.25 + 0.5.
  Q5 «4×0.25» (المجاز: locate / type / relation / effect) + «3×0.25» (the image: explanation / type / effect) ⇒ seven elements.
- Part 3: أ «3×0.5» three features of the writer's personality («يمكن للمترشّح أن يستنتج ملامح أخرى») ⇒ one element of 1.5;
  ب «2×0.5» content + «2×0.75» form («يمكن للمترشّح أن يشير إلى مظاهر أخرى») ⇒ two elements; all interactive with
  distractors that contradict the text.
- Distractors avoid what usage could accept: no «الآليّة» for the relation of «أقلامًا» (the scheme says السّببيّة, «الآليّة»
  is a common textbook reading), no «كناية» or «فروع» distractor for the مجاز, no «الإيجاز» distractor for the effect of the
  تشبيه بليغ, no «المقابلة»/«الجناس» (cf. «يقفرها ويفقرها») for the badīʿ figure, no «فعل الشّرط لا محلّ لها» for
  «استطعنا ذلك», no «نعت» for «أردناه», no «الحجاجيّ» for the type, and no text passage that also shows his satisfaction
  with the present («وجدنا أشجارًا مملوءةً بعصير الحياة…») among the distractors of Q2.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "17jJ_DC865rbddKGOYRwoJr0i7nMc_Pch"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة لغات اجنبية.docx"
PDF_ID = "1F0Kf1tm1LkjDB9tRUMULJDblHDPrgTqC"
OFFICIAL_ID = "1ioZ1jh6ZyOb8gJ-R6SaDk9a7VwhJJ1jk"
CORR_ID = "1HlxuFWzwAMga-_RcnuUV-1AKs7TnZizl"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    29: "«رأيي أنّ إمكان الإبداع ممتدٌ في كلّ أوان!.. فالإبداع شيءٌ حي متحرك في الزمان والمكان، لا يتعلّق بالماضي وحده، ولكنه كالشجرة يمتد ويتطوّر في مختلف الفصول، يُبدّل ويُغيّر في أوراقه وفي مظاهر إيناعه وإثماره، ماضيه متصل بحاضره، وحاضره مرتبط بحبل مستقبله!.. إنّ المجهودات تُبنى فوق المجهودات.. والمواهب تَنبعُ من المواهب، والإبداع يؤَدّي إلى إبداع... والثمرة تخرج منها الثمرة، وكلّ هذا في فلَك يدور، ولا ينفكُّ عن الدوران إلى آخر الأزمان!..",
    30: "ونحن - إذا جُلنا اليوم في حديقة الأدب العربيّ الحديث - وجدنا أشجاراً مملوءةً بعصير الحياة، يانعةً بأزهار الفن، لا يَنقصها إلاّ أن ننظر إليها بعين الرّضا، وأن نتخيّل ما ستكون عليه غداً من سموق وارتفاع، فلا شيء يُفسد الحديقة ويُقفرها ويُفقرها مثل أن نرى دائماً أشجارها شجيراتٍ، لن تكون يوماً ضخمة الجذوع وارفة الظلال... يجب أن نروّض عيوننا على أن ترى الأشياء والأشخاص في غدها، لا في حاضرها وحده، وأن نعرف كيف نقرأ المستقبل من خلال سطور الحاضر... إذا (استطعنا ذلك)، فما من شك أنّنا واجدون في مختلف فروع الأدب أقلاماً، سيكون لها من الصدارة والقيادة في الأعوام العشرة أو العشرين المقبلة، مثلما كان لأصحاب الصدارة والبروز في العشرة أو العشرين عاماً الماضية...",
    31: "فحديقة الشّباب تزخر بأزهارها طيّبة الأريج، لا سبيل هنا إلى تعداد صنوفها وألوانها!... وكلّ ما (أردناه) هنا هو أن ندعم الأمل في غدنا الأدبي، وأن نتساءل عن واجبنا إزاء هذه النخبة من أعلام الغد ‏ - أولئك الذين يمسكون بطرف الخيط من وجودنا ليصبحوا غداً امتدادنا -‏ وأن نحاسب أنفسنا، نحن الذين تقدمناهم في حلقة الزّمن، عمّا صنعناه من أجلهم ...»",
    32: "توفيق الحكيم ‏- من كتاب «فنّ الأدب»",
    33: "(بتصرف)",
    34: "الشرح اللغوي:",
    35: "إيناع: نضوج.      سموق: علوّ وارتفاع.      وارفة: من ورف الظّل، اتّسع وطال وامتدّ.",
    40: "أوّلا- البناء الفكري: (10 نقاط)",
    41: "ما الموضوع الذي عالجه الكاتب في النّص؟ اشرح وجهة نظره فيه.",
    42: "أفصح الكاتب عن موقفه من حاضر الأدب العربي ومستقبله. وضّح ذلك مدعما إجابتك بعبارتين من النص.",
    43: "يعترف الكاتب في آخر النّص بمسؤوليته نحو جيل الغد. فيم تمثلت؟ ولماذا؟",
    44: "إلى أيّ لون أدبيّ ينتمي النّص؟ اذكر ثلاث خصائص له مع التمثيل.",
    45: "ما النَّمط الغالب على النّص؟ اذكر ثلاثة مؤشرات له مع التمثيل.",
    46: "لخّص مضمون النّص بأسلوبك الخاص.",
    47: "ثانيا- البناء اللّغوي: (06 نقاط)",
    48: "النص نسيجٌ محكم البناء. دُل على ثلاثة مظاهر للاتساق والانسجام فيه مع التمثيل.",
    49: "أعرب ‏ إعراب مفردات ‏ - لفظة «ماضيه» في قول الكاتب: «ماضيه متصلٌ بحاضره».",
    50: "بيّن محل الجملتين الواقعتين بين قوسين من الإعراب في قول الكاتب:",
    51: "«إذا (استطعنا ذلك)».",
    52: "«وكلُّ ما (أردناه) هذا».",
    53: "ما المحسّن البديعي البارز في النّص؟ مثّل له بمثالين.",
    54: "في قول الكاتب: «فما من شك أنّنا واجدون في مختلف فروع الأدب أقلاماً» مجاز. عينه، ثم اذكر نوعه وعلاقته مبيّنا وجه بلاغته.",
    55: "وفي عبارة: «إذا جُلنا اليوم في حديقة الأدب العربيّ الحديث» صورة بيانيّة. اشرحها مبينا نوعها وبلاغتها.",
    56: "ثالثا- التّقويم النقدي: (04 نقاط)",
    57: "أ- يعكس النّص شخصية الكاتب الأدبيّة. استنبط منه ثلاثة ملامح لها.",
    58: "ب- أدّت الصّحافة دورا رئيسيًا في الارتقاء بفنّ المقالة ونشرها منذ فجر النّهضة إلى يومنا هذا.",
    59: "بين - في إيجاز - كيف تجسد فضلُ الصحافة على المقالة في نصّ الكاتب مضمونا وشكلاً.",
}
# عيب docx مصحَّح من الموضوع الرّسميّ: «(أردناه) هذا» ⇐ «(أردناه) هنا»
PATCHES = [(52, "هذا»", "هنا»")]
for _k, _old, _new in PATCHES:
    assert PARAS[_k].count(_old) == 1, (_k, _old)
    PARAS[_k] = PARAS[_k].replace(_old, _new)

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2, P3 = PARAS[40], PARAS[47], PARAS[56]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
assert "(استطعنا ذلك)" in PARAS[30] and "(أردناه) هنا" in PARAS[31] and "ماضيه" in PARAS[29]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": J(29, 30, 31)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": J(32, 33)},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": J(34, 35)},
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



q("q1", "1", P1, J(41), 1, [el("q1-e1", "الموضوع الّذي عالجه الكاتب", 0.5), el("q1-e2", "وجهة نظره فيه", 0.5)])
q("q2", "2", P1, J(42), 2, [el("q2-e1", "موقفه من حاضر الأدب العربيّ", 0.75), el("q2-e2", "العبارة الدّالّة على موقفه من الحاضر", 0.25),
                           el("q2-e3", "موقفه من مستقبل الأدب العربيّ", 0.75), el("q2-e4", "العبارة الدّالّة على موقفه من المستقبل", 0.25)])
q("q3", "3", P1, J(43), 1, [el("q3-e1", "فيمَ تمثّلت مسؤوليّته نحو جيل الغد", 0.5), el("q3-e2", "لماذا", 0.5)])
q("q4", "4", P1, J(44), 2, [el("q4-e1", "اللّون الأدبيّ", 0.5), el("q4-e2", "ثلاث خصائص له (3×0.5)", 1.5)])
q("q5", "5", P1, J(45), 2, [el("q5-e1", "النّمط الغالب", 0.5), el("q5-e2", "ثلاثة مؤشّرات له (3×0.5)", 1.5)])
q("q6", "6", P1, J(46), 2, [el("q6-e1", "التّلخيص: فهم المضمون", 0.5), el("q6-e2", "التّلخيص: تقنية التّلخيص", 1),
                           el("q6-e3", "التّلخيص: سلامة اللّغة وجودة الأسلوب", 0.5)])
q("q7", "1", P2, J(48), 1.5, [el("q7-e1", "ثلاثة مظاهر للاتّساق والانسجام (3×0.25)", 0.75), el("q7-e2", "التّمثيل لها (3×0.25)", 0.75)])
q("q8", "2", P2, J(49), 1, [el("q8-e1", "إعراب «ماضيه» (4×0.25)", 1)])
q("q9", "3", P2, J(50, 51, 52), 1, [el("q9-e1", "محلّ جملة «استطعنا ذلك»", 0.5), el("q9-e2", "محلّ جملة «أردناه»", 0.5)])
q("q10", "4", P2, J(53), 0.75, [el("q10-e1", "المحسّن البديعيّ البارز", 0.25), el("q10-e2", "مثالان له (2×0.25)", 0.5)])
q("q11", "5", P2, J(54, 55), 1.75,
  [el("q11-e1", "المجاز: تعيينه", 0.25), el("q11-e2", "المجاز: نوعه", 0.25), el("q11-e3", "المجاز: علاقته", 0.25), el("q11-e4", "المجاز: وجه بلاغته", 0.25),
   el("q11-e5", "«إذا جلنا… في حديقة الأدب»: شرحها", 0.25), el("q11-e6", "«إذا جلنا… في حديقة الأدب»: نوعها", 0.25),
   el("q11-e7", "«إذا جلنا… في حديقة الأدب»: بلاغتها", 0.25)])
q("q12", "أ", P3, J(57), 1.5, [el("q12-e1", "ثلاثة ملامح لشخصيّة الكاتب الأدبيّة (3×0.5)", 1.5)])
q("q13", "ب", P3, J(58, 59), 2.5, [el("q13-e1", "فضل الصّحافة على المقالة مضمونًا (2×0.5)", 1), el("q13-e2", "فضل الصّحافة على المقالة شكلًا (2×0.75)", 1.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("الموضوع الّذي تناوله الكاتب هو الإبداع في الأدب. ووجهة نظره فيه، أنّه ممتدّ في كلّ أوان، وهو شيء حيّ متحرّك في الزّمان والمكان، "
           "ليس حكرًا على عصر دون آخر.")
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي عالجه الكاتب في النّصّ؟",
   {"options": ["الإبداع في الأدب", "تاريخ الأدب العربيّ القديم", "نقد الأدباء الشّباب", "الصّحافة الأدبيّة"]}, {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل وجهة نظر الكاتب فيه:",
   {"text": "الإبداع ممتدّ في كلّ ____، وهو شيء ____ متحرّك في الزّمان والمكان، ليس حكرًا على عصر دون آخر.", "bank": ["أوان", "حيّ", "ماضٍ", "جامد"]},
   {"blanks": [["أوان"], ["حيّ"]]}, Q1_EXPL, 0.5, "ar.comprehension.explain")
Q2_EXPL = ("موقف الكاتب من حاضر الأدب العربيّ هو موقف الاستحسان والرّضا: «فحديقة الشّباب تزخر بأزهارها طيّبة الأريج.» أمّا مستقبل الأدب فيتوقّع له الكاتب "
           "ازدهارًا ورقيًّا عظيمًا، وذلك في قوله: «…أن نتخيّل ما ستكون عليه غدًا من سموق وارتفاع…»")
st("s03", "q2", "q2-e1", "mcq", "ما موقف الكاتب من حاضر الأدب العربيّ؟",
   {"options": ["موقف الاستحسان والرّضا", "موقف السّخط والرّفض", "موقف اللّامبالاة", "موقف التّشاؤم واليأس"]}, {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.idea")
st("s04", "q2", "q2-e2", "mcq", "أيّ العبارات الآتية تدعم موقفه من حاضر الأدب العربيّ؟",
   {"options": ["«فحديقة الشّباب تزخر بأزهارها طيّبة الأريج»", "«أن نتخيّل ما ستكون عليه غدًا من سموق وارتفاع»",
                "«وأن نحاسب أنفسنا، نحن الّذين تقدّمناهم في حلقة الزّمن»", "«لن تكون يومًا ضخمة الجذوع وارفة الظّلال»"]},
   {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.evidence")
st("s05", "q2", "q2-e3", "mcq", "ما موقف الكاتب من مستقبل الأدب العربيّ؟",
   {"options": ["يتوقّع له ازدهارًا ورقيًّا عظيمًا", "يتوقّع له الانحطاط والجمود", "يرى أنّه سيبقى على حاله دون تغيير", "يخشى عليه من الزّوال"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.idea")
st("s06", "q2", "q2-e4", "fill_blank", "أكمل العبارة الدّالّة على موقفه من المستقبل:",
   {"text": "«…أن نتخيّل ما ستكون عليه غدًا من ____ وارتفاع…»", "bank": ["سموق", "انحطاط", "ذبول"]},
   {"blanks": [["سموق"]]}, Q2_EXPL, 0.25, "ar.comprehension.evidence")
Q3_EXPL = ("تتمثّل مسؤوليّة الكاتب تجاه جيل الغد فيما يلي: دعمه لشباب المستقبل بفتح آفاق الآمال أمامه وشعوره بواجبه في إعداد نخب المستقبل، "
           "وذلك لتحقيق الامتداد والتّواصل بين الجيلين.")
st("s07", "q3", "q3-e1", "mcq", "فيمَ تمثّلت مسؤوليّة الكاتب نحو جيل الغد؟",
   {"options": ["في دعمه لشباب المستقبل بفتح آفاق الآمال أمامه وشعوره بواجبه في إعداد نخب المستقبل", "في نقده اللّاذع لأخطاء الشّباب",
                "في تخلّيه عن الكتابة ليفسح لهم المجال", "في مطالبته الدّولة بتمويل الأدباء"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "mcq", "ولماذا؟",
   {"options": ["لتحقيق الامتداد والتّواصل بين الجيلين", "لإثبات تفوّق جيله على جيل الشّباب", "للتّخلّص من مسؤوليّة الأدب", "لكسب الشّهرة بين الشّباب"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.link")
Q4_EXPL = ("اللّون الأدبيّ: هو فنّ المقال، ومن خصائصه: وحدة الموضوع (قضيّة الإبداع الأدبيّ) – المنهجيّة في العرض (المقدّمة، العرض والخاتمة) – استعمال وسائل "
           "الإقناع من تحليل وتعليل وتمثيل – بروز شخصيّة الكاتب من خلال آرائه ومواقفه – التّرسّل في الأسلوب وخلوّه من التّعقيد وغريب اللّفظ "
           "(يكتفي المترشّح بذكر ثلاث خصائص فقط).")
st("s09", "q4", "q4-e1", "mcq", "إلى أيّ لون أدبيّ ينتمي النّصّ؟",
   {"options": ["فنّ المقال", "القصّة القصيرة", "الخطابة", "المسرحيّة"]}, {"correct": 0}, Q4_EXPL, 0.5, "ar.literature.prose")
st("s10", "q4", "q4-e2", "multi", "أيّ ممّا يلي من خصائص هذا اللّون كما تظهر في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["وحدة الموضوع (قضيّة الإبداع الأدبيّ)", "المنهجيّة في العرض (المقدّمة، العرض والخاتمة)", "استعمال وسائل الإقناع من تحليل وتعليل وتمثيل",
                "بروز شخصيّة الكاتب من خلال آرائه ومواقفه", "الحبكة القصصيّة وتطوّر الشّخصيّات", "الحوار المسرحيّ والإرشادات الرّكحيّة"]},
   {"correct": [0, 1, 2, 3]}, Q4_EXPL, 0.75, "ar.literature.features")
st("s11", "q4", "q4-e2", "fill_blank", "أكمل من خصائص المقال في النّصّ:",
   {"text": "التّرسّل في الأسلوب وخلوّه من ____ وغريب اللّفظ – بروز ____ الكاتب من خلال آرائه ومواقفه.", "bank": ["التّعقيد", "شخصيّة", "الوضوح", "حياد"]},
   {"blanks": [["التّعقيد"], ["شخصيّة"]]}, Q4_EXPL, 0.75, "ar.literature.features", "b")
Q5_EXPL = ("نمط النّصّ: نمط تفسيريّ. ومن مؤشّراته: التزام الموضوعيّة والتّجرّد من الذّاتيّة – عرض الأفكار والآراء بأسلوب منطقيّ يقوم على الشّرح والتّحليل "
           "والتّعليل – استخدام أدوات التّفسير والتّوكيد والاستنتاج، مثل قوله: «…أنّ إمكان الإبداع ممتدّ…» – الاستناد إلى الشّواهد والأمثلة، كقوله: "
           "«… كالشّجرة يمتدّ ويتطوّر…» (يكتفي المترشّح بذكر ثلاثة مؤشّرات فقط).")
st("s12", "q5", "q5-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]}, {"correct": 0}, Q5_EXPL, 0.5, "ar.text.type")
st("s13", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات هذا النّمط في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["التزام الموضوعيّة والتّجرّد من الذّاتيّة", "عرض الأفكار والآراء بأسلوب منطقيّ يقوم على الشّرح والتّحليل والتّعليل",
                "استخدام أدوات التّفسير والتّوكيد والاستنتاج", "الاستناد إلى الشّواهد والأمثلة", "تتابع الأحداث في الزّمن", "كثرة الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2, 3]}, Q5_EXPL, 0.75, "ar.text.type")
st("s14", "q5", "q5-e2", "matching", "مثّل: طابق كلّ مؤشّر بالعبارة الّتي تمثّل له في الإجابة النّموذجيّة.",
   {"lefts": ["استخدام أدوات التّفسير والتّوكيد والاستنتاج", "الاستناد إلى الشّواهد والأمثلة"],
    "rights": ["«…أنّ إمكان الإبداع ممتدّ…»", "«… كالشّجرة يمتدّ ويتطوّر…»", "«لا سبيل هنا إلى تعداد صنوفها وألوانها»"]},
   {"pairs": [0, 1]}, Q5_EXPL, 0.75, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ بالأسلوب الخاصّ", "text": "نصّ توفيق الحكيم من «فنّ الأدب» (بكالوريا 2014، لغات أجنبيّة، الموضوع الثّاني)", "model_example": None}
SUM_EXPL = "التّلخيص: يُراعى فيه فهم المضمون (0.5)، تقنية التّلخيص (1)، سلامة اللّغة وجودة الأسلوب (0.5). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for sid, eid, crit, ind, pts in [("s15", "q6-e1", "المضمون", "فهم المضمون", 0.5), ("s16", "q6-e2", "التّقنية", "احترام تقنية التّلخيص", 1),
                                 ("s17", "q6-e3", "اللّغة والأسلوب", "سلامة اللّغة وجودة الأسلوب", 0.5)]:
    essay(sid, "q6", eid, "تلخيص مضمون نصّ توفيق الحكيم", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
COH_EXPL = ("مظاهر الاتّساق والانسجام في النّصّ: استعمال أسماء الإشارة في مثل قوله: «إذا استطعنا ذلك» يشير به إلى جملة: «يجب أن نروّض عيوننا على أن ترى "
            "الأشياء والأشخاص في غدها…»؛ الضّمائر في مثل قوله: «ولكنّه كالشّجرة..» يعود الضّمير على «الإبداع» في السّطر الأوّل؛ الشّرط وجوابه في مثل قوله: "
            "«إذا جلنا … وجدنا…»؛ أحرف العطف والجرّ كقوله: «يبدّل ويغيّر في أوراقه وفي مظاهر إيناعه وإثماره.» (يكتفي المترشّح بذكر ثلاثة مظاهر فقط).")
st("s18", "q7", "q7-e1", "multi", "أيّ ممّا يلي من مظاهر الاتّساق والانسجام في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["استعمال أسماء الإشارة", "الضّمائر", "الشّرط وجوابه", "أحرف العطف والجرّ", "الوزن والقافية الموحّدة", "الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2, 3]}, COH_EXPL, 0.75, "ar.cohesion.effect")
st("s19", "q7", "q7-e2", "matching", "مثّل: طابق كلّ مظهر بمثاله من النّصّ.",
   {"lefts": ["اسم الإشارة", "الضّمير", "الشّرط وجوابه", "أحرف العطف والجرّ"],
    "rights": ["«إذا استطعنا ذلك»", "«ولكنّه كالشّجرة..»", "«إذا جلنا … وجدنا…»", "«يبدّل ويغيّر في أوراقه وفي مظاهر إيناعه وإثماره»"]},
   {"pairs": [0, 1, 2, 3]}, COH_EXPL, 0.75, "ar.cohesion.reference")
MADI_EXPL = "ماضيه: مبتدأ مرفوع، وعلامة رفعه الضّمّة المقدّرة على الياء للثّقل، وهو مضاف. الهاء: ضمير متّصل مبنيّ على الكسر في محلّ جرّ مضاف إليه."
st("s20", "q8", "q8-e1", "mcq", "ما الوظيفة الإعرابيّة لـ«ماضي» في قول الكاتب: «ماضيه متّصلٌ بحاضره»؟",
   {"options": ["مبتدأ مرفوع", "خبر مرفوع", "فاعل مرفوع", "مفعول به منصوب"]}, {"correct": 0}, MADI_EXPL, 0.25, "ar.grammar.irab")
st("s21", "q8", "q8-e1", "mcq", "ما علامة رفع «ماضي» في «ماضيه»؟",
   {"options": ["الضّمّة المقدّرة على الياء للثّقل", "الضّمّة الظّاهرة على آخره", "الضّمّة المقدّرة على الياء للتّعذّر",
                "الضّمّة المقدّرة منع من ظهورها اشتغال المحلّ بالحركة المناسبة"]}, {"correct": 0}, MADI_EXPL, 0.25, "ar.grammar.irab", "b")
st("s22", "q8", "q8-e1", "fill_blank", "أكمل: «ماضي» مضاف، والهاء:",
   {"text": "الهاء: ضمير متّصل مبنيّ على ____ في محلّ ____ مضاف إليه.", "bank": ["الكسر", "جرّ", "الضّمّ", "نصب"]},
   {"blanks": [["الكسر"], ["جرّ"]]}, MADI_EXPL, 0.5, "ar.grammar.irab", "c")
st("s23", "q9", "q9-e1", "mcq", "ما المحلّ الإعرابيّ لجملة «استطعنا ذلك» في قوله: «إذا (استطعنا ذلك)»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "استطعنا ذلك: جملة فعليّة في محلّ جرّ مضاف إليه.", 0.5, "ar.grammar.sentence_case")
st("s24", "q9", "q9-e2", "mcq", "ما المحلّ الإعرابيّ لجملة «أردناه» في قوله: «وكلّ ما (أردناه) هنا»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "أردناه: جملة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
BADI_EXPL = "المحسّن البديعيّ البارز في النّصّ هو: طباق الإيجاب. المثالان: ماضيه ≠ حاضر، حاضره ≠ مستقبله. (توجد أمثلة أخرى في النّصّ)."
st("s25", "q10", "q10-e1", "mcq", "ما المحسّن البديعيّ البارز في النّصّ؟",
   {"options": ["طباق الإيجاب", "طباق السّلب", "التّورية", "الاقتباس"]}, {"correct": 0}, BADI_EXPL, 0.25, "ar.rhetoric.badi")
st("s26", "q10", "q10-e2", "multi", "مثّل له بمثالين: (اختر كلّ ما يصحّ)",
   {"options": ["ماضيه ≠ حاضره", "حاضره ≠ مستقبله", "المجهودات ≠ المواهب", "الحديقة ≠ الأشجار"]},
   {"correct": [0, 1]}, BADI_EXPL, 0.5, "ar.rhetoric.badi")
MAJ_EXPL = ("المجاز: في كلمة «أقلاما». أطلق لفظة «أقلاما» وأراد «أدباء»، فهو مجاز مرسل علاقته السّببيّة، أي أطلق السّبب (الأقلام) وأراد ما ينتج عنه "
            "(الفكر والأدب). بلاغته: الإيجاز في التّعبير والإشادة بأصحاب الأقلام من الكتّاب والأدباء.")
st("s27", "q11", "q11-e1", "mcq", "عيّن المجاز في قول الكاتب: «فما من شكّ أنّنا واجدون في مختلف فروع الأدب أقلامًا».",
   {"options": ["في كلمة «أقلامًا»", "في كلمة «واجدون»", "في كلمة «شكّ»", "في كلمة «مختلف»"]}, {"correct": 0}, MAJ_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s28", "q11", "q11-e2", "mcq", "ما نوع هذا المجاز؟",
   {"options": ["مجاز مرسل", "استعارة مكنيّة", "تشبيه بليغ", "مجاز عقليّ"]}, {"correct": 0}, MAJ_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s29", "q11", "q11-e3", "mcq", "ما علاقته حسب الإجابة النّموذجيّة؟",
   {"options": ["السّببيّة", "المحلّيّة", "الحاليّة", "الكلّيّة"]}, {"correct": 0}, MAJ_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s30", "q11", "q11-e4", "mcq", "ما وجه بلاغته؟",
   {"options": ["الإيجاز في التّعبير والإشادة بأصحاب الأقلام من الكتّاب والأدباء", "تشخيص المعنويّ في صورة إنسان", "إحداث جرس موسيقيّ تطرب له الأذن",
                "إبراز التّضادّ بين معنيين متقابلين"]}, {"correct": 0}, MAJ_EXPL, 0.25, "ar.rhetoric.effect")
HAD_EXPL = ("والصّورة البيانيّة في قوله: «في حديقة الأدب العربيّ…» شبّه الأدب العربيّ بالحديقة فذكر المشبّه به (الحديقة) مضافًا إلى المشبّه (الأدب العربيّ) "
            "مع حذف الأداة ووجه الشّبه فهو تشبيه بليغ. بلاغته: تجسيد المعنويّ في صورة محسوسة لإبراز جمال الأدب وتنوّعه في كلّ عصر.")
st("s31", "q11", "q11-e5", "matching", "اشرح الصّورة في «إذا جلنا اليوم في حديقة الأدب العربيّ الحديث»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به"], "rights": ["الأدب العربيّ", "الحديقة", "الأشجار"]}, {"pairs": [0, 1]}, HAD_EXPL, 0.25, "ar.rhetoric.simile")
st("s32", "q11", "q11-e6", "mcq", "ما نوع هذه الصّورة؟",
   {"options": ["تشبيه بليغ", "كناية عن صفة", "مجاز مرسل علاقته المحلّيّة", "تشبيه تمثيليّ"]}, {"correct": 0}, HAD_EXPL, 0.25, "ar.rhetoric.simile")
st("s33", "q11", "q11-e7", "mcq", "ما بلاغتها؟",
   {"options": ["تجسيد المعنويّ في صورة محسوسة لإبراز جمال الأدب وتنوّعه في كلّ عصر", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين معنيين متقابلين"]}, {"correct": 0}, HAD_EXPL, 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
PERS_EXPL = ("من ملامح شخصيّة الكاتب كما تظهر في النّصّ: سمة المربّي الحكيم الدّاعي إلى الاهتمام بجيل الأدباء الشّباب؛ الحسّ النّقديّ والفنّيّ ويظهر ذلك "
             "في تعامله مع الأدب والإبداع، وما وظّفه من صور بديعة؛ الموضوعيّة في نظرته إلى الإبداع والأجيال الأدبيّة بعيدًا عن التّعصّب لجيل دون سواه. "
             "(يمكن للمترشّح أن يستنتج ملامح أخرى).")
st("s34", "q12", "q12-e1", "multi", "أيّ ممّا يلي من ملامح شخصيّة الكاتب الأدبيّة كما يعكسها النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["سمة المربّي الحكيم الدّاعي إلى الاهتمام بجيل الأدباء الشّباب", "الحسّ النّقديّ والفنّيّ",
                "الموضوعيّة في نظرته إلى الإبداع والأجيال الأدبيّة بعيدًا عن التّعصّب لجيل دون سواه", "التّعصّب للقدماء والانتقاص من جيل الشّباب",
                "التّشاؤم من مستقبل الأدب العربيّ", "السّخرية اللّاذعة من الأدباء الشّباب"]},
   {"correct": [0, 1, 2]}, PERS_EXPL, 0.75, "ar.literature.features")
st("s35", "q12", "q12-e1", "fill_blank", "أكمل أحد هذه الملامح:",
   {"text": "الحسّ النّقديّ والفنّيّ، ويظهر ذلك في تعامله مع الأدب و____، وما وظّفه من صور ____.", "bank": ["الإبداع", "بديعة", "التّقليد", "باهتة"]},
   {"blanks": [["الإبداع"], ["بديعة"]]}, PERS_EXPL, 0.75, "ar.literature.features", "b")
PRESS_EXPL = ("دور الصّحافة في الارتقاء بفنّ المقال: 1. من حيث المضمون: صارت مضامين المقالة أكثر ثراء وغنى، حتّى شبّهها بعضهم بمائدة فكريّة حافلة بصنوف "
              "المعرفة؛ بروز شخصيّة صاحب المقال من خلال مواقفه وآرائه وقوّة التّعليل لها والقدرة على الإقناع. 2. من حيث الشّكل: المنهجيّة في عرض الأفكار "
              "من مقدّمة وعرض وخاتمة؛ خلّصت الصّحافة المقالة من قيود السّجع والزّخرف اللّفظيّ الموروثة عن عصر الضّعف، فصارت تصاغ بأسلوب مترسّل مرن. "
              "(يمكن للمترشّح أن يشير إلى مظاهر أخرى).")
st("s36", "q13", "q13-e1", "multi", "كيف تجسّد فضل الصّحافة على المقالة في نصّ الكاتب من حيث المضمون؟ (اختر كلّ ما يصحّ)",
   {"options": ["صارت مضامين المقالة أكثر ثراء وغنى حتّى شُبّهت بمائدة فكريّة حافلة بصنوف المعرفة",
                "بروز شخصيّة صاحب المقال من خلال مواقفه وآرائه وقوّة التّعليل لها والقدرة على الإقناع",
                "اقتصار المقالة على موضوعات المدح والهجاء", "تغييب رأي الكاتب وشخصيّته"]},
   {"correct": [0, 1]}, PRESS_EXPL, 1, "ar.literature.context")
st("s37", "q13", "q13-e2", "multi", "وكيف تجسّد ذلك من حيث الشّكل؟ (اختر كلّ ما يصحّ)",
   {"options": ["المنهجيّة في عرض الأفكار من مقدّمة وعرض وخاتمة", "التّخلّص من قيود السّجع والزّخرف اللّفظيّ الموروثة عن عصر الضّعف",
                "الالتزام بالسّجع والمحسّنات البديعيّة المتكلّفة", "الإطالة والاستطراد دون خطّة"]},
   {"correct": [0, 1]}, PRESS_EXPL, 0.75, "ar.literature.prose")
st("s38", "q13", "q13-e2", "fill_blank", "أكمل:",
   {"text": "خلّصت الصّحافة المقالة من قيود ____ والزّخرف اللّفظيّ الموروثة عن عصر الضّعف، فصارت تصاغ بأسلوب ____ مرن.",
    "bank": ["السّجع", "مترسّل", "الوضوح", "مسجوع"]},
   {"blanks": [["السّجع"], ["مترسّل"]]}, PRESS_EXPL, 0.75, "ar.literature.prose", "b")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (توفيق الحكيم: فنّ الأدب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "عيب في docx صُحّح من الموضوع الرّسميّ: «وكلُّ ما (أردناه) هذا» ⇐ «هنا» (س3 من البناء اللّغويّ). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): التّلخيص س6 (0.5 + 1 + 0.5).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
        "kind": "BAC", "year": 2014, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T14:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
