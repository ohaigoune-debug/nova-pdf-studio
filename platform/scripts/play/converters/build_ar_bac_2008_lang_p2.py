"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (ميخائيل نعيمة، «صوت الإنسانيّة»).
Exam (most faithful source): gdrive 1w07KJcwuwdHy57-7LM4YFjvJlKHTl-3L (اختبار دورة 2008 لغات.docx);
same paper as PDF (owner's copy): gdrive 1Ls03xKi3n6jNyiluEq1hePOk-RsEyZ2i (BAC 2008 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1cTjX_N42_rBummb48gwwCHSddqGOU3uF (01_الموضوع.pdf, pages 2–3, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 19y6tLEx8dK5wcqeKRAu6JB-EP2IGGgRy (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2008_sci_p1.py): PARAS below were generated from the .docx with python-docx and spliced into this
file by script (paragraph text read exactly; only outer whitespace and outer direction marks trimmed); every verbatim string
of the JSON is built from PARAS (fixes applied with _fix, each asserted to occur once) and was re-checked programmatically
against the docx. The docx was compared line by line with the ONEC paper (page images enlarged ×2). The correction PDF has no
text layer; the scheme was read from its page image (enlarged ×2). Every mark comes from the official scheme; correct
options and explanations condense its wording.

Docx defects fixed from the ONEC paper:
- the docx splits paragraph 2 of the text twice in the middle of a sentence («… كانت القبائل والشعوب تحسب» / «حدودها حدود
  الأرض…», «… والطمأنينة. وإذن» / «كانت القبائل…») ⇒ joined with spaces (three paragraphs, as on the ONEC paper);
- «في كل مکانٍ» typed with the Persian keheh U+06A9 ⇒ «مكانٍ» (Arabic kaf).
Other differences are diacritics / punctuation / labels only (docx kept): reference «(ميخائيل نعيمة، بتصرف)» (ONEC «(ميخائيل
نعيمه. بتصرف)»), part labels «أوّلا-/ثانيا-/ثالثا-». Underline (docx and ONEC): «في الكون أصوات»; bracketed sentences
«(لا تستوعبها أذن)», «(يشهده اليوم)».

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «لغات أجنبيّة» ⇒ LANG.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item; an unsplit mark ⇒ one element.
- Q1 «01», Q2 «02», Q3 «03»: one element each (Q3 «03» unsplit for the nature words, the link with the literary trend and its
  reason). Q4 (تلخيص) «2×02» = دلالة المضمون / سلامة اللّغة ⇒ two deferred elements.
- Part 2 Q1: «0,5» في + الكون / «0,75» شبه الجملة خبر مقدّم / «0,75» أصوات مبتدأ مؤخّر / «2×0,5» the two sentences ⇒ five
  elements. Q2 «8×0,25» for one rewritten sentence («أما اليوم فقد تصرّم البعد، وتداعى السّياج الّذي كان يفصل الأمم بعضها عن
  بعض»; the eight quarters are not labelled and seven words change) ⇒ one element of 2, two 1-point steps. Q3 «2×0,5» = the
  type (كناية عن زوال الحدود المادّيّة والمعنويّة بين البشر) / its rhetoric (جعل المعنويّ محسوسًا).
- Part 3 «2×02»: the scheme answers both demands with a fixed paragraph (no «يُقبل كلّ رأي») ⇒ two interactive elements:
  how far imagination is present (the three images it names) / its importance.
- Distractors avoid what the scheme or usage could accept: no «استعارة» (مكنيّة or تصريحيّة) and no «تقديم الحقيقة مصحوبة
  بالدّليل» for «تداعت السّياجات» (both arguable for this كناية), no «حال» for the نعت sentence, no nature word among the
  wrong words of Q3 («الأمواج، أجواء» are simply not offered).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "1w07KJcwuwdHy57-7LM4YFjvJlKHTl-3L"
DOCX_TITLE = "اختبار دورة 2008 لغات.docx"
PDF_ID = "1Ls03xKi3n6jNyiluEq1hePOk-RsEyZ2i"
OFFICIAL_ID = "1cTjX_N42_rBummb48gwwCHSddqGOU3uF"
CORR_ID = "19y6tLEx8dK5wcqeKRAu6JB-EP2IGGgRy"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    23: "الموضوع الثاني",
    24: "النّص:",
    25: "في الكون أصوات (لا تستوعبها أذن) ولا يحصيها خيال، فللكواكب في أفلاكها رنات، وللنسائم والرياح في أجوائها هيمنات، وللأمواج في بحارها زفير، وللأشجار حفيف، وللحشرات بأنواعها دبيب وطنين. ثم هنالك الحيوان بأصواته، وثم الإنسان بأصواته، وما أكثرها، يقول أشياء وأشياء، ويهدف إلى أشياء وأشياء، ولكنها في النهاية تندغم كلها في صوت واحد هو صوت الكون الشامل، فأين صوت الإنسانية من ذلك الصوت؟ وهل للإنسانية صوت، وهل لها هدف؟",
    26: "كنا حتى أمسنا القريب إذا تكلم أحد عن صوت الإنسانية حملنا كلامه على محمل المجاز، ذلك لأن الأرض كانت مترامية الأطراف، شاسعة الأبعاد، وكان أبناؤها يعيشون قبائل وشعوبا منطوية على ذاتها، لا تسمع غير أصواتها وغير القليل من أصوات جيرانها، ولا تعرف غير أخبارها وأخبارهم. ففي الماضي السحيق كانت القبائل والشعوب تحسب",
    27: "حدودها حدود الأرض. أما اليوم فقد تصرمت الأبعاد وتداعت السياجات التي كانت تفصل الأمم بعضها عن بعض، فإذا بالقصي يدنو، وبالمجهول يغدو معلوما، وإذا بالأمم صغيرها وكبيرها، وبعيدها وقريبها تتبادل التحيات والشتائم والبضائع والقنابل والسلام والدم، وإذا بالإنسانية تشكو أوجاعا مشتركة، وبصوت واحد تطلب العافية والسلام والطمأنينة. وإذن",
    28: "كانت القبائل والشعوب تتعارف وتتنافر، وتتصادق وتتعادى، ولكنها كانت تعمل يدا واحدة على حفظ ذلك الجسم الإنساني من الهلاك وعلى الوصول به إلى ما هو عليه اليوم.",
    29: "ما شهد العالم في كل ما شهد سيلا جارفا من الكلام كالذي (يشهده اليوم). فهو ينهل علينا بغير انقطاع من شفاه الأثير، ويتفجر من دواليب المطابع، ولا فرق من هذا القبيل بين غرب وشرق، أو بين بلد كبير أو بلد صغير، فالتيار واحد في كل مکانٍ، ما ذاك إلا لأن العالم صام زمانا عن الكلام، فراح يعوض عن صيامه بالثرثرة، فالعالم ما عرف الصمت يوما من أيام حياته، ولكنه ما عرف كذلك مرحلة كثرت فيها الوسائل لنقل الكلام كالمرحلة التي هو فيها اليوم، فالصحف اليومية والأسبوعية والشهرية أكثر من الهم على القلب، والكتب بجميع أصنافها تقفز من العدم إلى الوجود، ومحطات الإذاعة اللاسلكية لا تفتر تحشو الآذان بما قيل وما يقال، وأكثر الكلمات ترددا من غيرها : الحرب، السلم، وكأن البشرية إذا ما نالت السلم نالت المعرفة التي لا استقرار بدونها.",
    30: "(ميخائيل نعيمة، بتصرف)",
    31: "الأسئلة:",
    32: "أوّلا- البناء الفكري: (10 نقاط)",
    33: "فيم يتجلى صوت الإنسانية من وجهة نظر الكاتب؟",
    34: "أشار الكاتب في نصه إلى مفهوم العولمة وآثارها الإيجابية. أين يظهر ذلك؟ وضّح.",
    35: "في النص ألفاظ مستوحاة من الطبيعة. اذكر بعضها، وهل لها علاقة بالاتجاه الأدبي للكاتب؟ علل.",
    36: "لخص النص.",
    37: "ثانيا- البناء اللّغوي: (06 نقاط)",
    38: "أعرب ما تحته خط إعراب مفردات، وما بين قوسين إعراب جمل.",
    39: "\"أما اليوم، فقد تصرمت الأبعاد، وتداعت السياجات التي كانت تفصل الأمم بعضها عن بعض \". حول العبارة إلى المفرد.",
    40: "\"تداعت السياجات\". ما نوع الصورة البيانية؟ وما بلاغتها؟",
    41: "ثالثا- التّقويم النقدي: (04 نقاط)",
    42: "الخيال عنصر أساسي في أي إنتاج أدبي، إلى أي مدى توافر هذا العنصر في النص؟ وما أهميته؟",
}


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


# تصويبات من الموضوع الرّسميّ (انظر التّوثيق أعلاه)
assert PARAS[26].endswith("تحسب") and PARAS[27].endswith("وإذن")
TEXT_PARAS = [PARAS[25], PARAS[26] + " " + PARAS[27] + " " + PARAS[28], _fix(PARAS[29], "ک", "ك")]
P1, P2, P3 = PARAS[32], PARAS[37], PARAS[41]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and TEXT_PARAS[0].startswith("في الكون أصوات")
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[30]},
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


q("q1", "1", P1, PARAS[33], 1, [el("q1-e1", "تجلّي صوت الإنسانيّة عند الكاتب", 1)])
q("q2", "2", P1, PARAS[34], 2, [el("q2-e1", "إشارة الكاتب إلى العولمة وآثارها الإيجابيّة", 2)])
q("q3", "3", P1, PARAS[35], 3, [el("q3-e1", "ألفاظ الطّبيعة وعلاقتها بالاتّجاه الأدبيّ للكاتب", 3)])
q("q4", "4", P1, PARAS[36], 4, [el("q4-e1", "التّلخيص: دلالة المضمون", 2), el("q4-e2", "التّلخيص: سلامة اللّغة", 2)])
q("q5", "1", P2, PARAS[38], 3, [el("q5-e1", "إعراب «في» و«الكون»", 0.5), el("q5-e2", "محلّ شبه الجملة (في الكون)", 0.75), el("q5-e3", "إعراب «أصوات»", 0.75),
                               el("q5-e4", "محلّ جملة (لا تستوعبها أذن)", 0.5), el("q5-e5", "محلّ جملة (يشهده اليوم)", 0.5)])
q("q6", "2", P2, PARAS[39], 2, [el("q6-e1", "تحويل العبارة إلى المفرد (8×0,25)", 2)])
q("q7", "3", P2, PARAS[40], 1, [el("q7-e1", "نوع الصّورة", 0.5), el("q7-e2", "بلاغتها", 0.5)])
q("q8", "1", P3, PARAS[42], 4, [el("q8-e1", "مدى توافر عنصر الخيال في النّصّ", 2), el("q8-e2", "أهمّيّته", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "يتجلّى صوت الإنسانيّة في نظر الكاتب في كلّ نداء يحفظ كرامة الإنسان ويدعوه إلى السّلم والأمن."
st("s01", "q1", "q1-e1", "mcq", "فيمَ يتجلّى صوت الإنسانيّة من وجهة نظر الكاتب؟",
   {"options": ["في كلّ نداء يحفظ كرامة الإنسان ويدعوه إلى السّلم والأمن", "في أصوات الكواكب والرّياح والأمواج", "في ضجيج المطابع ومحطّات الإذاعة",
                "في أصوات الحرب والقنابل"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "يتجلّى صوت الإنسانيّة في كلّ نداء يحفظ ____ الإنسان ويدعوه إلى ____ والأمن.", "bank": ["كرامة", "السّلم", "ثروة", "الحرب"]},
   {"blanks": [["كرامة"], ["السّلم"]]}, Q1_EXPL, 0.5, "ar.comprehension.idea", "b")
Q2_EXPL = ("أشار الكاتب في نصّه إلى مفهوم العولمة وإيجابيّاتها، ويتجلّى ذلك في حديثه عن اتّحاد دول العالم في صوت واحد وهو المطالبة بالسّلم والطّمأنينة. "
           "ومن إيجابيّاتها أيضًا التّقارب بين الشّعوب بعدما كانت متفرّقة عبر أصقاع الأرض، ومن ثمّ الصّداقة والأخوّة بينها، والعيش بسلام وأمن.")
st("s03", "q2", "q2-e1", "mcq", "أين يظهر حديث الكاتب عن مفهوم العولمة؟",
   {"options": ["في حديثه عن اتّحاد دول العالم في صوت واحد هو المطالبة بالسّلم والطّمأنينة", "في حديثه عن أصوات الكواكب في أفلاكها",
                "في حديثه عن انطواء القبائل على ذاتها في الماضي السّحيق", "في حديثه عن صيام العالم عن الكلام"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.evidence")
st("s04", "q2", "q2-e1", "multi", "ما الآثار الإيجابيّة للعولمة كما يوضّحها النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["المطالبة بصوت واحد بالسّلم والطّمأنينة", "الصّداقة والأخوّة بين الشّعوب", "العيش بسلام وأمن", "انطواء الشّعوب على ذاتها",
                "الانقطاع عن أخبار الجيران"]},
   {"correct": [0, 1, 2]}, Q2_EXPL, 1, "ar.comprehension.details", "b")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "ومن إيجابيّاتها أيضًا ____ بين الشّعوب بعدما كانت ____ عبر أصقاع الأرض.", "bank": ["التّقارب", "متفرّقة", "التّباعد", "متّحدة"]},
   {"blanks": [["التّقارب"], ["متفرّقة"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain", "c")
Q3_EXPL = ("في النّصّ مجموعة من الألفاظ المستوحاة من الطّبيعة منها: الكواكب – الرّياح – النّسائم – الأشجار – الحيوان – أجواء…، وهذا الحقل الدّلاليّ له "
           "علاقة بالاتّجاه الأدبيّ للكاتب، ويتمثّل في الرّومنسيّة إذ من مبادئها الامتزاج بالطّبيعة واتّخاذها وسيلة للتّعبير عن الأفكار والعواطف والأحاسيس.")
st("s06", "q3", "q3-e1", "multi", "اذكر بعض الألفاظ المستوحاة من الطّبيعة في النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["الكواكب", "الرّياح", "النّسائم", "الأشجار", "الحيوان", "المطابع", "الصّحف", "القنابل"]},
   {"correct": [0, 1, 2, 3, 4]}, Q3_EXPL, 1, "ar.cohesion.effect")
st("s07", "q3", "q3-e1", "mcq", "هل لهذه الألفاظ علاقة بالاتّجاه الأدبيّ للكاتب؟",
   {"options": ["نعم، فهذا الحقل الدّلاليّ يتمثّل في الرّومنسيّة", "لا علاقة لها بالاتّجاه الأدبيّ للكاتب", "نعم، ويتمثّل في الاتّجاه الإحيائيّ (المحافظ)",
                "نعم، ويتمثّل في الاتّجاه الواقعيّ"]},
   {"correct": 0}, Q3_EXPL, 1, "ar.literature.trend", "b")
st("s08", "q3", "q3-e1", "fill_blank", "علّل:",
   {"text": "لأنّ من مبادئ الرّومنسيّة ____ بالطّبيعة واتّخاذها ____ للتّعبير عن الأفكار والعواطف والأحاسيس.", "bank": ["الامتزاج", "وسيلة", "النّفور", "عائقًا"]},
   {"blanks": [["الامتزاج"], ["وسيلة"]]}, Q3_EXPL, 1, "ar.literature.features", "c")
SUM_SPEC = {"task": "تلخيص النّصّ", "text": "ميخائيل نعيمة (بكالوريا 2008، لغات أجنبيّة، الموضوع الثّاني)",
            "scheme": "يراعى في التّلخيص دلالة المضمون وسلامة اللّغة (2×02)", "model_example": None}
SUM_EXPL = "يراعى في التّلخيص دلالة المضمون (02) وسلامة اللّغة (02). لا تقدّم الإجابة النّموذجيّة نموذجًا للتّلخيص."
essay("s09", "q4", "q4-e1", "تلخيص نصّ ميخائيل نعيمة", "المضمون", "دلالة المضمون", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s10", "q4", "q4-e2", "تلخيص نصّ ميخائيل نعيمة", "سلامة اللّغة", "سلامة اللّغة", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
IR_EXPL = ("في: حرف جرّ، الكون: اسم مجرور وعلامة جرّه الكسرة. وشبه الجملة (في الكون) في محلّ رفع خبر مقدّم. أصوات: مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة.")
st("s11", "q5", "q5-e1", "matching", "أعرب ما تحته خطّ في «في الكون أصوات»: طابق.",
   {"lefts": ["في", "الكون"], "rights": ["حرف جرّ", "اسم مجرور وعلامة جرّه الكسرة", "اسم مجرور وعلامة جرّه الياء", "ظرف مكان منصوب"]},
   {"pairs": [0, 1]}, IR_EXPL, 0.5, "ar.grammar.irab")
st("s12", "q5", "q5-e2", "mcq", "ما محلّ شبه الجملة (في الكون) من الإعراب في «في الكون أصوات»؟",
   {"options": ["في محلّ رفع خبر مقدّم", "في محلّ رفع نعت", "في محلّ نصب مفعول به", "في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, IR_EXPL, 0.75, "ar.grammar.irab")
st("s13", "q5", "q5-e3", "mcq", "ما إعراب «أصوات» في «في الكون أصوات»؟",
   {"options": ["مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة", "خبر مرفوع وعلامة رفعه الضّمّة", "فاعل مرفوع وعلامة رفعه الضّمّة",
                "نائب فاعل مرفوع وعلامة رفعه الضّمّة"]},
   {"correct": 0}, IR_EXPL, 0.75, "ar.grammar.irab")
st("s14", "q5", "q5-e4", "mcq", "ما محلّ جملة (لا تستوعبها أذن) من الإعراب في «في الكون أصوات (لا تستوعبها أذن)»؟",
   {"options": ["جملة فعليّة في محلّ رفع صفة", "جملة فعليّة في محلّ رفع خبر", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "«لا تستوعبها أذن»: جملة فعليّة في محلّ رفع صفة.", 0.5, "ar.grammar.sentence_case")
st("s15", "q5", "q5-e5", "mcq", "ما محلّ جملة (يشهده اليوم) من الإعراب في «سيلًا جارفًا من الكلام كالّذي (يشهده اليوم)»؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع صفة", "جملة فعليّة في محلّ نصب حال",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "«يشهده اليوم»: جملة فعليّة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
TR_EXPL = "التّحويل في الإجابة النّموذجيّة: «أمّا اليوم فقد تصرّم البعد، وتداعى السّياج الّذي كان يفصل الأمم بعضها عن بعض.»"
st("s16", "q6", "q6-e1", "fill_blank", "حوّل العبارة إلى المفرد (الجزء الأوّل):",
   {"text": "أمّا اليوم، فقد ____ ____، و____ ____ …", "bank": ["تصرّم", "البعد", "تداعى", "السّياج", "تصرّمت", "تداعت", "السّياجات"]},
   {"blanks": [["تصرّم"], ["البعد"], ["تداعى"], ["السّياج"]]}, TR_EXPL, 1, "ar.morphology")
st("s17", "q6", "q6-e1", "fill_blank", "حوّل العبارة إلى المفرد (الجزء الثّاني):",
   {"text": "… وتداعى السّياج ____ ____ ____ الأمم بعضها عن بعض.", "bank": ["الّذي", "كان", "يفصل", "الّتي", "كانت", "تفصل"]},
   {"blanks": [["الّذي"], ["كان"], ["يفصل"]]}, TR_EXPL, 1, "ar.morphology", "b")
IMG_EXPL = "«تداعت السّياجات» كناية عن زوال الحدود المادّيّة والمعنويّة بين البشر، وبلاغتها تتمثّل في جعل المعنويّ محسوسًا."
st("s18", "q7", "q7-e1", "mcq", "ما نوع الصّورة البيانيّة في «تداعت السّياجات»؟",
   {"options": ["كناية عن زوال الحدود المادّيّة والمعنويّة بين البشر", "تشبيه بليغ", "تشبيه تمثيليّ", "طباق"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s19", "q7", "q7-e2", "mcq", "ما بلاغة الصّورة في «تداعت السّياجات»؟",
   {"options": ["جعل المعنويّ محسوسًا", "إحداث جرس موسيقيّ في العبارة", "إظهار المعنى بذكر ضدّه", "الإيجاز بحذف أداة التّشبيه"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
IMA_EXPL = ("الخيال شرط أساسيّ في أيّ إنتاج أدبيّ؛ إذ إنّ الأديب يتوهّم صلات بين أشياء ليس لها وجود، ثمّ يقوم بتركيب صور تملك المشاعر كبعث الحياة "
            "في الجامد واستنطاقه، وهذا ما نلمسه في هذا النّصّ، إذ حاول الكاتب أن يحلّق بالقارئ في فضاءات رحبة كأن يجسّد الإنسانيّة في شخص له صوت "
            "يشكو ويطالب، والعالم بإنسان صائم، والكلام بسيل جارف.")
st("s20", "q8", "q8-e1", "mcq", "إلى أيّ مدى توافر عنصر الخيال في النّصّ؟",
   {"options": ["توافر بوضوح: حاول الكاتب أن يحلّق بالقارئ في فضاءات رحبة", "انعدم تمامًا لأنّ النّصّ تقرير علميّ جافّ",
                "اقتصر على وصف الطّبيعة دون غيرها"]},
   {"correct": 0}, IMA_EXPL, 1, "ar.literature.features")
st("s21", "q8", "q8-e1", "matching", "طابق كلّ معنى بالصّورة الّتي جسّده فيها الكاتب.",
   {"lefts": ["الإنسانيّة", "العالم", "الكلام"], "rights": ["شخص له صوت يشكو ويطالب", "إنسان صائم", "سيل جارف", "نجم متألّق"]},
   {"pairs": [0, 1, 2]}, IMA_EXPL, 1, "ar.literature.features", "b")
st("s22", "q8", "q8-e2", "fill_blank", "ما أهمّيّة الخيال؟ أكمل:",
   {"text": "الخيال شرط أساسيّ في أيّ إنتاج أدبيّ؛ إذ إنّ الأديب ____ صلات بين أشياء ليس لها وجود، ثمّ يقوم بتركيب صور تملك ____.",
    "bank": ["يتوهّم", "المشاعر", "ينفي", "العقول"]},
   {"blanks": [["يتوهّم"], ["المشاعر"]]}, IMA_EXPL, 1, "ar.literature.features")
st("s23", "q8", "q8-e2", "mcq", "ومن أمثلة هذه الصّور الّتي تملك المشاعر:",
   {"options": ["بعث الحياة في الجامد واستنطاقه", "نقل الوقائع كما هي دون تصرّف", "الاكتفاء بالأرقام والإحصاءات", "تعداد الأحداث التّاريخيّة بدقّة"]},
   {"correct": 0}, IMA_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (ميخائيل نعيمة: صوت الإنسانيّة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص2–3)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: وُصلت الفقرة الثّانية المقطوعة مرّتين في docx، و«مکانٍ» بالكاف الفارسيّة ← «مكانٍ». "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2، صورة ممسوحة قُرئت مكبَّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): التّلخيص س4 (2×02).")
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
