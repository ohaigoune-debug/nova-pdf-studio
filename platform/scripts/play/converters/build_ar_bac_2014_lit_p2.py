"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (النّويريّ، نهاية الأرب: منهجه في كتابة التّاريخ).
Exam (most faithful source): gdrive 1kjzG1pt9R9hQilqMuk9qHjT2z0op_kxq (بكالوريا العربية 2014 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1SFiC3l1VsOUtnAjOaJ0ADkYu_dzJNpvN;
official ONEC paper: gdrive 1jQuB7SUI8U3Abtjv9aZAUGCHKHB1i1e4 (01_الموضوع.pdf, pages 3–4, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1LoBxYe1c6ScPuPSfQKvwX8-s78BeNhgh (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2014_sci_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and every verbatim string of the JSON was re-checked
programmatically against the docx. The docx was compared paragraph by paragraph with the official ONEC paper (rendered at
130 dpi). The mark scheme was read from the rendered pages (150 dpi, fully legible). Every mark comes from the official
scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper (PATCHES below):
- paragraph 1: «والغّنيٌ» (stray shadda on the غ, tanwīn on the ي) ⇒ «والغنيُّ» (ONEC «والغَنِيُّ»);
- paragraph 1: «والعقيم والمُسافرُ» ⇒ «والمقيم والمُسافرُ» (ONEC «والمُقيمُ والمُسافِرُ»; the scheme also reads «والمقيم والمسافر»);
- part 2 Q5: «من تقدّمة» ⇒ «من تقدّمه» (ONEC «مَن تقدّمهُ», and the text itself reads «من تقدّمه»).
Other differences are labels («الشرح اللغوي» vs «شرح المفردات») — docx kept.

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only ⇒ LIT.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; distinct demands ⇒ one
  element per demand.
- Q1 «2×0.5» = the importance / its justification. Q2 «1 + 2×0.5» = what he blamed (1) + «يبدي التّلميذ رأيه بالموافقة أو
  الاعتراض مع التّعليل» ⇒ opinion and justification deferred (essay_builder, rule 11: either stance accepted).
- Q3 «1». Q4 «2×0.5» = the method (التّفصيل بعد الإجمال) / its explanation. Q5 «2×0.5» = the kind (النّثر العلميّ المتأدّب) /
  the justification. Q6 «1 + 4×0.25» = the type (التّفسيريّ) + two indicators with examples among many ⇒ 1 + one element of 1.
  The scheme lists the indicators but no examples («مع التّمثيل بعبارات من النّصّ») ⇒ the example matching uses text
  quotations chosen by the converter (to be checked by the owner).
- Q7 (تلخيص) «0.5 / 1 / 0.5» = المضمون / تقنية التّلخيص / سلامة اللّغة ⇒ three deferred elements.
- Part 2: Q1 «0.5». Q2 «2×0.5» = type / why. Q3 «3×0.5» = explanation / type (استعارة مكنيّة) / effect. Q4 «2×0.5».
  Q5 «2×0.5 + 2×0.5» = يقتدي / إذا / مضى / استحلاها ⇒ four elements.
- Part 3 «2.50 + 1.50» = three features among many + three figures among many («يكتفي المترشّح بذكر ثلاث خصائص وثلاثة
  أعلام») ⇒ two interactive elements; the figure distractors are poets of other eras (المتنبّي، أحمد شوقي، امرؤ القيس).
- Distractors avoid what usage could accept: no «في محلّ جرّ نعت» for «مضى» (ما نكرة موصوفة), no «حال» for «استحلاها»
  (after a described indefinite), no «الحجاجيّ» distractor for the type, no «من العامّ إلى الخاصّ» for التّفصيل بعد الإجمال.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
DOCX_ID = "1kjzG1pt9R9hQilqMuk9qHjT2z0op_kxq"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة اداب وفلسفة.docx"
PDF_ID = "1SFiC3l1VsOUtnAjOaJ0ADkYu_dzJNpvN"
OFFICIAL_ID = "1jQuB7SUI8U3Abtjv9aZAUGCHKHB1i1e4"
CORR_ID = "1LoBxYe1c6ScPuPSfQKvwX8-s78BeNhgh"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    32: "«...والتاريخ مما يحتاج إليه المَلِكُ والوزيرُ، والقائد والأميرُ، والكاتب والمُشير والغّنيٌ والفقيرُ، والبادي والحاضرُ، والعقيم والمُسافرُ.",
    33: "فالملك يَعتبر بما (مَضى) من الدول ومن سلف من الأمم، والوزير يَقتَدِي بأفعال من تقدّمه ممّن حاز فضيلتيْ السيف والقلم، وقائد الجيش يطّلع منه على مكايد الحرب، ومواقف الطعن والضرب، والمُشير يتدبّر الرأي فلا يُصدره إلاّ عن رَوِيّة، والكاتب يستشهد به في رسائله وكتبه، ويتوسع به إذا ضاق عليه المجال في سرَبه، والغني يحمد الله تعالى على ما أولاه من نعمه ورزقه من نواله، ويُنفق مما آتاه الله إذا علم أنه لا بد من زواله وانتقاله، والفقير يَرغب في الزّهد لعلمه أن الدنيا لا تدوم، ومن عدا هؤلاء يَسمعه على سبيل المسامرة، ووجه المُحاضرة والمُذاكرة، والرغبة في الاطلاع على أخبار الأمم، ومعرفة أيَّام العرب وحروب العجم.",
    34: "ولما رأيت غالب من أرّخ في المِلّة الإسلاميّة وضع التاريخ على حكم السنين ومساقها، لا الدول واتّساقها، علمت أن ذلك ربما قطع على المطالع لذّةً واقعةً (استحلاها)، وقضيّةً استجلاها، فانقضت أخبار السنة ولا استوعب تَكملة فصولها ولا انتهى إلى جملتها وتفصيلها، وانتقل المؤرّخ بدخول السنة التي تليها من تلك الوقائع وأخبارها، والممالك وآثارها، والدولة وسيرها، والحالة وخبرها، فلا يرجع المُطالع إلى ما كان قد أهمه إلا بعد مَشقة، وقد يعْدِل عنه إذا طالت المَسافة وبعُدت عليه الشقة.",
    35: "فاخترت أن أقيم التاريخ دُوَلا، ولا أبغي عن دولة إذا شرعت فيها حِولا، حتى أسردها من أوائلها إلى أواخرها، وأذكر جُمَلاً من وقائعها ومآثرها، وسياقة أخبار مُلوكها، ونَظمِ عُقود سلوكها، ومقر ممالكها، وتشعُّب مَسالكها، فإذا انقضت مدتها، وانقرضت عدتها، وانتقلت من العين إلى الأثر، ومن العيان إلى الخبر، رجعتُ إلى غيرها فقفوت أثرها، وشرحت خبرها، وذكرت أسبابها، وسردت أنسابها، وبدأت بأصلها، وتفوهت بأخبار من نبغ من أهلها، واستقصيتها دولة بعد دولة، ورغبتُ مع ذلك في الاختصار دون الاقتصار، وأوردت ما يُحتاج إلى إيراده من غير تكرارٍ أو إكثارٍ».",
    36: "- نهايةُ الأرب في فُنون الأدب للنُّوَيْرِيّ / بتصرّف –",
    37: "الشرح اللغوي:    سَــرْبِهِ: طريقه",
    39: "أوّلا- البناء الفكري: (10 نقاط)",
    40: "ما أهمية فنّ التاريخ في نظر الكاتب؟ ما تعليله لذلك؟",
    41: "ما الذي عابه على المؤرّخين الذين سبقوه؟ هل توافقه في ذلك؟ علل.",
    42: "اقترح صاحب النص منهجيّة لكتابة التاريخ. وضّحها بإيجاز.",
    43: "اعتمد الكاتب في الفقرتين الأولى والثانية منهجية في العرض. بيّنها مع الشرح.",
    44: "إلى أيّ نوع من أنواع النثر تصنّف هذا النص؟ علّل حكمك.",
    45: "ما النمط الغالب على النّص؟ اذكر مؤشرين له مع التمثيل.",
    46: "لخّص مضمون النّص.",
    47: "ثانيا- البناء اللّغوي: (06 نقاط)",
    48: "ما الحقل الدلالي للألفاظ التالية: «أخبار -‏ الوقائع - سيَرها - سردتُ»؟",
    49: "ما نوع الأسلوب البلاغي المعتمد في النّص؟ ولماذا؟",
    50: "في العبارة الآتية: «قطع على المُطالع لذّةً واقعةً استحلاها» صورة بيانية. اشرحها مبيّنا نوعها وبلاغتها.",
    51: "عين المُسند والمُسنَد إليه في قول الكاتب: «وانتقل المؤرّخ بدخول السنة...».",
    52: "أعرب ما يلي إعراب مفردات: «يقتدي» في قول الكاتب: «والوزير يَقتدِي بأفعال من تقدّمة»،",
    53: "و«إذا» الواردة في قوله: «إذا شرعت فيها حِولا».",
    54: "وأعرب ما يلي إعراب جُمل: «مَضى» الواردة في قول الكاتب: «فالمَلِك يَعْتَبر بما مَضى»",
    55: "و«استحلاها» الواردة في قوله: «ربما قطَع على المطالِع لذّةً واقعةً استحلاها».",
    56: "ثالثا- التّقويم النقدي: (04 نقاط)",
    57: "- تميز الأدب العربي في عُهود الانحطاط بجملةٍ من الخصائص التي لم ترق به إلى أدب العصور الزّاهية.",
    58: "- اذكر ثلاثاً من خصائص أدب هذه المرحلة، وثلاثةً من أبرز أعلامها.",
}
# عيوب docx مصحَّحة من الموضوع الرّسميّ (انظر التّوثيق أعلاه)
PATCHES = [(32, "والغّنيٌ", "والغنيُّ"), (32, "والعقيم", "والمقيم"), (52, "تقدّمة»", "تقدّمه»")]
for _k, _old, _new in PATCHES:
    assert PARAS[_k].count(_old) == 1, (_k, _old)
    PARAS[_k] = PARAS[_k].replace(_old, _new)

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2, P3 = PARAS[39], PARAS[47], PARAS[56]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
assert "(مَضى)" in PARAS[33] and "(استحلاها)" in PARAS[34]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": J(32, 33, 34, 35)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[36]},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[37]},
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



q("q1", "1", P1, J(40), 1, [el("q1-e1", "أهمّيّة فنّ التّاريخ في نظر الكاتب", 0.5), el("q1-e2", "تعليله لذلك", 0.5)])
q("q2", "2", P1, J(41), 2, [el("q2-e1", "ما عابه على المؤرّخين الّذين سبقوه", 1), el("q2-e2", "الرّأي (الموافقة أو الاعتراض)", 0.5), el("q2-e3", "التّعليل", 0.5)])
q("q3", "3", P1, J(42), 1, [el("q3-e1", "المنهجيّة المقترحة لكتابة التّاريخ", 1)])
q("q4", "4", P1, J(43), 1, [el("q4-e1", "منهجيّة العرض في الفقرتين الأولى والثّانية", 0.5), el("q4-e2", "شرحها", 0.5)])
q("q5", "5", P1, J(44), 1, [el("q5-e1", "نوع النّثر", 0.5), el("q5-e2", "تعليل الحكم", 0.5)])
q("q6", "6", P1, J(45), 2, [el("q6-e1", "النّمط الغالب", 1), el("q6-e2", "مؤشّران مع التّمثيل (4×0.25)", 1)])
q("q7", "7", P1, J(46), 2, [el("q7-e1", "التّلخيص: المضمون", 0.5), el("q7-e2", "التّلخيص: تقنية التّلخيص", 1), el("q7-e3", "التّلخيص: سلامة اللّغة", 0.5)])
q("q8", "1", P2, J(48), 0.5, [el("q8-e1", "الحقل الدّلاليّ", 0.5)])
q("q9", "2", P2, J(49), 1, [el("q9-e1", "نوع الأسلوب", 0.5), el("q9-e2", "تعليل ذلك", 0.5)])
q("q10", "3", P2, J(50), 1.5, [el("q10-e1", "شرح الصّورة", 0.5), el("q10-e2", "نوعها", 0.5), el("q10-e3", "بلاغتها", 0.5)])
q("q11", "4", P2, J(51), 1, [el("q11-e1", "المسند", 0.5), el("q11-e2", "المسند إليه", 0.5)])
q("q12", "5", P2, J(52, 53, 54, 55), 2, [el("q12-e1", "إعراب «يقتدي»", 0.5), el("q12-e2", "إعراب «إذا»", 0.5),
                                         el("q12-e3", "محلّ جملة «مضى»", 0.5), el("q12-e4", "محلّ جملة «استحلاها»", 0.5)])
q("q13", "التّعليمة", P3, J(57, 58), 4, [el("q13-e1", "ثلاث من خصائص أدب عصر الانحطاط", 2.5), el("q13-e2", "ثلاثة من أبرز أعلامه", 1.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("أهمّيّة فنّ التّاريخ في نظر الكاتب تكمن في أنّه لا يستغني عنه النّاس على اختلاف مواقعهم، ذلك أنّه يحتاج إليه الملك والوزير والقائد والأمير "
           "والكاتب والمشير والغنيّ والفقير والبادي والحاضر والمقيم والمسافر.")
st("s01", "q1", "q1-e1", "mcq", "ما أهمّيّة فنّ التّاريخ في نظر الكاتب؟",
   {"options": ["لا يستغني عنه النّاس على اختلاف مواقعهم", "يهمّ الملوك والوزراء وحدهم دون غيرهم", "لا فائدة منه إلّا التّسلية والمسامرة",
                "يحتاج إليه المؤرّخون وحدهم"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل تعليل الكاتب لذلك:",
   {"text": "ذلك أنّه يحتاج إليه ____ والوزير، والقائد والأمير، والكاتب والمشير، والغنيّ و____، والبادي والحاضر، والمقيم و____.",
    "bank": ["الملك", "الفقير", "المسافر", "الطّبيب", "التّاجر", "الفلّاح"]},
   {"blanks": [["الملك"], ["الفقير"], ["المسافر"]]}, Q1_EXPL, 0.5, "ar.comprehension.details")
Q2_EXPL = "عاب الكاتب على المؤرّخين الّذين سبقوه كونهم يسجّلون وقائع التّاريخ بحسب السّنوات لا تواريخ الدّول متتابعة."
st("s03", "q2", "q2-e1", "mcq", "ما الّذي عابه الكاتب على المؤرّخين الّذين سبقوه؟",
   {"options": ["أنّهم يسجّلون وقائع التّاريخ بحسب السّنوات لا تواريخ الدّول متتابعة", "أنّهم يطيلون في ذكر أنساب الملوك",
                "أنّهم يعتمدون على الخرافات والأساطير", "أنّهم يكتبون بأسلوب مسجوع متكلّف"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.details")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "يسجّلون وقائع التّاريخ بحسب ____ لا تواريخ ____ متتابعة.", "bank": ["السّنوات", "الدّول", "الملوك", "الأمكنة"]},
   {"blanks": [["السّنوات"], ["الدّول"]]}, Q2_EXPL, 0.5, "ar.comprehension.details", "b")
OP_SPEC = {"task": "إبداء الرّأي فيما عابه الكاتب على المؤرّخين الّذين سبقوه", "question": PARAS[41],
           "model": "الإجابة النّموذجيّة: «يبدي التّلميذ رأيه بالموافقة أو الاعتراض مع التّعليل» (2×0.5)."}
essay("s05", "q2", "q2-e2", "رأيك فيما عابه الكاتب على المؤرّخين", "الرّأي", "إبداء رأي واضح بالموافقة أو الاعتراض", 0.5, OP_SPEC,
      "يبدي التّلميذ رأيه بالموافقة أو الاعتراض.", "ar.comprehension.opinion")
essay("s06", "q2", "q2-e3", "رأيك فيما عابه الكاتب على المؤرّخين", "التّعليل", "تعليل الرّأي", 0.5, OP_SPEC,
      "يبدي التّلميذ رأيه بالموافقة أو الاعتراض مع التّعليل.", "ar.comprehension.opinion")
Q3_EXPL = ("اقترح الكاتب منهجيّة مثلى – في نظره – لكتابة التّاريخ تتلخّص فيما يلي: يسجّل وقائع كلّ دولة على حدة دون الوقوف عند أحداث السّنوات ولا ينتقل "
           "من دولة إلى أخرى حتّى يستوفي جميع ما يتّصل بتاريخها من أوائلها إلى أواخرها وذكر مقرّ ممالكها وسرد أنسابها والإشارة إلى من نبغ من رجالها "
           "في أسلوب يقوم على الاختصار في غير إخلال مع استيفاء كلّ ما هو ضروريّ من تاريخ الدّول دون إعادة أو إطناب.")
st("s07", "q3", "q3-e1", "mcq", "ما المنهجيّة الّتي اقترحها الكاتب لكتابة التّاريخ؟",
   {"options": ["يسجّل وقائع كلّ دولة على حدة دون الوقوف عند أحداث السّنوات، ولا ينتقل إلى أخرى حتّى يستوفي تاريخها من أوائلها إلى أواخرها",
                "يسجّل أحداث كلّ سنة على حدة مهما تعدّدت الدّول", "يقتصر على أخبار الحروب والمعارك دون غيرها",
                "يرتّب الأخبار بحسب الأقاليم والبلدان لا بحسب الدّول"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.idea")
st("s08", "q3", "q3-e1", "multi", "أيّ ممّا يلي من سمات المنهجيّة الّتي اقترحها الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["ذكر مقرّ ممالك الدّولة وسرد أنسابها", "الإشارة إلى من نبغ من رجالها", "الاختصار في غير إخلال مع استيفاء كلّ ما هو ضروريّ",
                "الإطناب والتّكرار في سرد الأخبار", "الانتقال بين الدّول بحسب تعاقب السّنوات"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.comprehension.details", "b")
Q4_EXPL = ("اعتمد الكاتب في الفقرتين الأولى والثّانية منهجيّة في العرض وهي: التّفصيل بعد الإجمال، حيث ذكر حاجة مجموعة من النّاس لعلم التّاريخ على سبيل "
           "الإجمال في الفقرة الأولى، ثمّ عاد ليفصّل حاجة كلّ فرد من هذه المجموعة لعلم التّاريخ في الفقرة الثّانية.")
st("s09", "q4", "q4-e1", "mcq", "ما المنهجيّة الّتي اعتمدها الكاتب في العرض في الفقرتين الأولى والثّانية؟",
   {"options": ["التّفصيل بعد الإجمال", "الإجمال بعد التّفصيل", "المقارنة والموازنة", "السّرد القصصيّ المتسلسل"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.link")
st("s10", "q4", "q4-e2", "fill_blank", "أكمل شرح هذه المنهجيّة:",
   {"text": "ذكر حاجة مجموعة من النّاس لعلم التّاريخ على سبيل ____ في الفقرة الأولى، ثمّ عاد ليفصّل حاجة ____ فرد من هذه المجموعة في الفقرة الثّانية.",
    "bank": ["الإجمال", "كلّ", "التّفصيل", "بعض"]},
   {"blanks": [["الإجمال"], ["كلّ"]]}, Q4_EXPL, 0.5, "ar.comprehension.link")
Q5_EXPL = "نوع النّصّ من النّثر العلميّ المتأدّب لأنّ صاحبه ناقش فيه مسألة علميّة تتعلّق بمنهجيّة كتابة التّاريخ بأسلوب أدبيّ."
st("s11", "q5", "q5-e1", "mcq", "إلى أيّ نوع من أنواع النّثر تصنّف هذا النّصّ؟",
   {"options": ["النّثر العلميّ المتأدّب", "المقامة", "الرّسالة الإخوانيّة", "الخطبة"]}, {"correct": 0}, Q5_EXPL, 0.5, "ar.literature.prose")
st("s12", "q5", "q5-e2", "mcq", "علّل حكمك.",
   {"options": ["لأنّ صاحبه ناقش فيه مسألة علميّة تتعلّق بمنهجيّة كتابة التّاريخ بأسلوب أدبيّ", "لأنّه يقوم على شخصيّات وأحداث وحبكة",
                "لأنّه موجّه إلى جمهور حاضر لإقناعه واستمالته", "لأنّه رسالة بين صديقين يتبادلان فيها المشاعر"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.literature.prose")
TYPE_EXPL = ("النّمط الغالب على النّصّ هو التّفسيريّ. من مؤشّراته: (التّعليل والتّفسير وبيان الغاية تبريرًا للموقف المتّخذ – كثرة التّعريفات والشّروح – "
             "بروز أفعال المعاينة والملاحظة والاستنتاج والوصف – الكلمات التّقنيّة الخاصّة بالموضوع – هيمنة ضمير الغائب والأسلوب الخبريّ – استعمال "
             "صيغ المصدر لما فيها من فعل مستمرّ غير مقترن بزمان أو مكان…) مع التّمثيل بعبارات من النّصّ.")
st("s13", "q6", "q6-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]}, {"correct": 0}, TYPE_EXPL, 1, "ar.text.type")
st("s14", "q6", "q6-e2", "multi", "أيّ ممّا يلي من مؤشّرات هذا النّمط؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّعليل والتّفسير وبيان الغاية", "كثرة التّعريفات والشّروح", "هيمنة ضمير الغائب والأسلوب الخبريّ",
                "تتابع الأحداث وتطوّر الشّخصيّات", "كثرة الأساليب الإنشائيّة الانفعاليّة"]},
   {"correct": [0, 1, 2]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s15", "q6", "q6-e2", "matching", "مثّل: طابق كلّ مؤشّر بعبارة من النّصّ تمثّل له.",
   {"lefts": ["التّعليل", "أفعال المعاينة والاستنتاج", "استعمال صيغ المصدر"],
    "rights": ["«والفقير يرغب في الزّهد لعلمه أنّ الدّنيا لا تدوم»", "«ولمّا رأيت… علمت أنّ ذلك ربّما قطع على المطالع لذّةً»",
               "«وسياقة أخبار ملوكها، ونظم عقود سلوكها»", "«ومعرفة أيّام العرب وحروب العجم»"]},
   {"pairs": [0, 1, 2]}, TYPE_EXPL + " (الأمثلة من اختيار التّحويل: لا يذكر التّصحيح أمثلة بعينها.)", 0.5, "ar.text.type")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "نصّ النّويريّ من «نهاية الأرب في فنون الأدب» (بكالوريا 2014، آداب وفلسفة، الموضوع الثّاني)", "model_example": None}
SUM_EXPL = "التّلخيص: ويراعى فيه المضمون (0.5)، تقنية التّلخيص (1)، سلامة اللّغة (0.5). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for sid, eid, crit, ind, pts in [("s16", "q7-e1", "المضمون", "الوفاء بمضمون النّصّ", 0.5), ("s17", "q7-e2", "التّقنية", "احترام تقنية التّلخيص", 1),
                                 ("s18", "q7-e3", "سلامة اللّغة", "سلامة اللّغة", 0.5)]:
    essay(sid, "q7", eid, "تلخيص مضمون نصّ النّويريّ", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s19", "q8", "q8-e1", "mcq", "ما الحقل الدّلاليّ للألفاظ: «أخبار – الوقائع – سيرها – سردتُ»؟",
   {"options": ["علم التّاريخ", "الحرب", "الأدب والشّعر", "الاقتصاد"]}, {"correct": 0},
   "الحقل الدّلاليّ للألفاظ: «أخبار – الوقائع – سيرها – سردت» هو علم التّاريخ.", 0.5, "ar.cohesion.effect")
STY_EXPL = "نوع الأسلوب البلاغيّ المعتمد في النّصّ هو الخبريّ لحاجة الموضوع إلى هذا النّوع من الأساليب كون الكاتب في معرض الشّرح والتّفسير والمناقشة."
st("s20", "q9", "q9-e1", "mcq", "ما نوع الأسلوب البلاغيّ المعتمد في النّصّ؟",
   {"options": ["الخبريّ", "الإنشائيّ الطّلبيّ", "الإنشائيّ غير الطّلبيّ"]}, {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.style")
st("s21", "q9", "q9-e2", "fill_blank", "أكمل: ولماذا؟",
   {"text": "لحاجة الموضوع إلى هذا النّوع من الأساليب، كون الكاتب في معرض الشّرح و____ و____.", "bank": ["التّفسير", "المناقشة", "التّعجّب", "الدّعاء"]},
   {"blanks": [["التّفسير"], ["المناقشة"]]}, STY_EXPL, 0.5, "ar.rhetoric.style")
IMG_EXPL = ("في العبارة «قطع على المطالع لذّةً واقعةً استحلاها» شبّه الكاتب المطالعة بطعام حلو المذاق فذكر المشبّه «المطالعة» وحذف المشبّه به «الطّعام» "
            "وأبقى على ما يدلّ عليه «لذّة استحلاها»، فهي استعارة مكنيّة. بلاغتها: تجسيد المعنويّ (المطالعة) في صورة محسوسة (الطّعام) ممّا ساهم في تقوية "
            "المعنى وإيضاحه وتقريبه من الذّهن.")
st("s22", "q10", "q10-e1", "matching", "اشرح الصّورة في «قطع على المطالع لذّةً واقعةً استحلاها»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "ما يدلّ على المشبّه به"], "rights": ["المطالعة", "الطّعام حلو المذاق", "«لذّة استحلاها»", "التّاريخ"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s23", "q10", "q10-e2", "mcq", "ما نوع هذه الصّورة؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s24", "q10", "q10-e3", "mcq", "ما بلاغة هذه الصّورة؟",
   {"options": ["تجسيد المعنويّ (المطالعة) في صورة محسوسة (الطّعام) ممّا ساهم في تقوية المعنى وإيضاحه وتقريبه من الذّهن",
                "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين معنيين متقابلين"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
MS_EXPL = "المسند في العبارة هو الفعل (انتقل)، والمسند إليه هو الفاعل (المؤرّخ)."
st("s25", "q11", "q11-e1", "mcq", "ما المسند في قول الكاتب: «وانتقل المؤرّخ بدخول السّنة…»؟",
   {"options": ["الفعل (انتقل)", "الفاعل (المؤرّخ)", "شبه الجملة (بدخول)", "السّنة"]}, {"correct": 0}, MS_EXPL, 0.5, "ar.grammar.rules")
st("s26", "q11", "q11-e2", "mcq", "ما المسند إليه في قول الكاتب: «وانتقل المؤرّخ بدخول السّنة…»؟",
   {"options": ["الفاعل (المؤرّخ)", "الفعل (انتقل)", "شبه الجملة (بدخول)", "السّنة"]}, {"correct": 0}, MS_EXPL, 0.5, "ar.grammar.rules")
st("s27", "q12", "q12-e1", "mcq", "ما إعراب «يقتدي» في قول الكاتب: «والوزير يقتدي بأفعال من تقدّمه»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها التّعذّر", "فعل مضارع منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "يقتدي: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل.", 0.5, "ar.grammar.irab")
st("s28", "q12", "q12-e2", "fill_blank", "أكمل إعراب «إذا» في قوله: «إذا شرعتُ فيها حِولا»:",
   {"text": "إذا: ظرف لما ____ من الزّمن، متضمّن معنى ____، مبنيّ على السّكون في محلّ نصب وهو مضاف.", "bank": ["يُستقبل", "الشّرط", "مضى", "التّعليل"]},
   {"blanks": [["يُستقبل", "يستقبل"], ["الشّرط"]]}, "إذا: ظرف لما يُستقبل من الزّمن، متضمّن معنى الشّرط، مبنيّ على السّكون في محلّ نصب وهو مضاف.", 0.5, "ar.grammar.irab")
st("s29", "q12", "q12-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «مضى» في قول الكاتب: «فالملك يعتبر بما مضى»؟",
   {"options": ["جملة فعليّة، صلة الموصول، لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "مضى: جملة فعليّة، صلة الموصول، لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s30", "q12", "q12-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «استحلاها» في قوله: «ربّما قطع على المطالع لذّةً واقعةً استحلاها»؟",
   {"options": ["جملة فعليّة في محلّ نصب نعت", "جملة فعليّة في محلّ رفع خبر", "جملة صلة الموصول لا محلّ لها من الإعراب",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "استحلاها: جملة فعليّة في محلّ نصب نعت.", 0.5, "ar.grammar.sentence_case")
# ── ثالثًا: التّقويم النّقديّ ──
FEAT_EXPL = ("بعض خصائص أدب الانحطاط: التّنميق اللّفظيّ – الإغراق في البديع – نظم الألغاز والأحاجي – الميل إلى المقطوعات القصيرة – وصف الأشياء المألوفة – "
             "استعمال الكلام الصّريح والألفاظ العامّيّة والكلام غير المعرَّب – شيوع المدائح النّبويّة وشعر الزّهد – طغيان النّثر العلميّ – تقليد فحول شعراء "
             "الأقدمين – كثرة الموسوعات العلميّة… (يكتفي المترشّح بذكر ثلاث خصائص).")
st("s31", "q13", "q13-e1", "multi", "أيّ ممّا يلي من خصائص أدب عصر الانحطاط؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّنميق اللّفظيّ", "الإغراق في البديع", "نظم الألغاز والأحاجي", "شيوع المدائح النّبويّة وشعر الزّهد", "طغيان النّثر العلميّ",
                "التّحرّر من الوزن والقافية واعتماد السّطر الشّعريّ", "توظيف الرّمز والأسطورة", "الحرص على الوحدة العضويّة للقصيدة"]},
   {"correct": [0, 1, 2, 3, 4]}, FEAT_EXPL, 1.25, "ar.literature.features")
st("s32", "q13", "q13-e1", "fill_blank", "أكمل من خصائص أدب هذه المرحلة:",
   {"text": "الميل إلى ____ القصيرة – وصف الأشياء ____ – استعمال الكلام الصّريح والألفاظ ____ – تقليد فحول شعراء ____.",
    "bank": ["المقطوعات", "المألوفة", "العامّيّة", "الأقدمين", "الملاحم", "الغريبة", "الفصيحة", "المحدثين"]},
   {"blanks": [["المقطوعات"], ["المألوفة"], ["العامّيّة"], ["الأقدمين"]]}, FEAT_EXPL, 1.25, "ar.literature.features", "b")
st("s33", "q13", "q13-e2", "multi", "أيّ ممّا يلي من أبرز أعلام هذه المرحلة؟ (اختر كلّ ما يصحّ)",
   {"options": ["البوصيري", "ابن نباتة", "ابن خلدون", "ابن منظور", "ابن بطوطة", "المتنبّي", "أحمد شوقي", "امرؤ القيس"]},
   {"correct": [0, 1, 2, 3, 4]},
   "الأعلام: البوصيري – ابن نباتة – ابن خلدون – القزويني – ابن منظور – النّويري – ابن خلّكان – ابن بطوطة… (يكتفي المترشّح بذكر ثلاثة أعلام). "
   "أمّا المتنبّي فمن العصر العبّاسيّ، وأحمد شوقي من العصر الحديث، وامرؤ القيس من العصر الجاهليّ.", 1.5, "ar.literature.context")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (النّويريّ: نهاية الأرب في فنون الأدب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "عيوب في docx صُحّحت من الموضوع الرّسميّ: «والغّنيٌ» ⇐ «والغنيُّ»، «والعقيم» ⇐ «والمقيم» (الفقرة الأولى)، «من تقدّمة» ⇐ «من تقدّمه» (س5 من البناء اللّغويّ). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): الرّأي وتعليله في س2 (0.5 + 0.5؛ تُقبل الموافقة أو الاعتراض) والتّلخيص س7 (0.5 + 1 + 0.5). "
         "أمثلة مؤشّرات النّمط في س6 من اختيار التّحويل (لا يذكرها التّصحيح).")
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
