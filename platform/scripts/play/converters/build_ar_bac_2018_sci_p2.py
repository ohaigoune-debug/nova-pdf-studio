"""Conversion: BAC 2018 (session عاديّة، جوان 2018) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (عبد الحميد بن باديس، الوطن الخاصّ).
Exam (most faithful source): gdrive 1d9Damc4tpzOBpPQVuZfMatfr57PI4Kho (بكالوريا العربية 2018 شعبة علوم تجريبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1tK1t-ScZo8iyMI95BZGpJySyNyWgXPJI;
official ONEC paper: gdrive 1uY6cbmoUYHtLoItExDcCk7wlp00zgMx7 (01_الموضوع.pdf, pages 3–4 — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1HDY7-nfQJOy3zxB_ha0EIybsksOEln9H (02_التصحيح.pdf, pages 3–4).

Method: PARAS below are generated from the .docx with python-docx (paragraph text read exactly; only outer whitespace and
directional marks U+200E/U+200F trimmed) and every verbatim string of the JSON was re-checked programmatically against the
docx. The docx was compared line by line with the official ONEC paper (rendered pages). The correction PDF's text layer is
reversed presentation-form Arabic, so the mark scheme was read from the rendered pages (150 dpi, fully legible).
Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: as in paper 1 (ONEC headers: علوم تجريبية، رياضيات، تسيير واقتصاد، تقني رياضي) ⇒ SCI, MATH, TM, GE.
- Text layout: the ONEC paper has three paragraphs; in the docx the 2nd and 3rd paragraphs are cut into line-wrapped pieces
  («…ونحن فيما» / «(نعمل لوطننا الخاص) …خدمتنا» / «لوطننا الخاص. …» and «…معاذا بالله -» / «ولكن لننفعها…») ⇒ the pieces
  are joined with a single space so that «الفقرة الثّانية / الأخيرة» of the questions match the paper; characters unchanged.
- Q1 «4×0.5 + 1»: the scheme lists exactly four bases of the relation ⇒ four elements of 0.5; «الرّأي: يترك للمترشّح بشرط
  حسن التّعليل والتّمثيل من الواقع» ⇒ deferred essay_builder (1).
- Q2 «4×0.5 + 1»: exactly four homelands listed ⇒ four elements of 0.5; the bond (1).
- Q3 «1 + 01 + 01»: the comparison (1, closed); «موقف المترشّح…» and «التّعليل…» are open ⇒ two deferred elements.
- Q4 (تلخيص) «01/01/01» ⇒ three deferred essay_builder elements.
- Part 2 Q1 «4×0.5» = type, referent, two examples, function (the four demands). Q2 «4×0.50» one element per item.
- Part 2 Q3: per image 0.5 type + 0.5 explanation + 0.25 effect ⇒ six elements. Q4 «3×0.5» = extraction, type, effect.
  The scheme accepts either pair of the مقابلة («قيام…/إهمال…» or «تترقّى…/تشقى…») ⇒ the extraction step asks for both.
- The scheme writes «(لسنا نخدمها على حساب غيرنا)» for the paper's «غيرها» (typo of the scheme).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1d9Damc4tpzOBpPQVuZfMatfr57PI4Kho"
PDF_ID = "1tK1t-ScZo8iyMI95BZGpJySyNyWgXPJI"
OFFICIAL_ID = "1uY6cbmoUYHtLoItExDcCk7wlp00zgMx7"
CORR_ID = "1HDY7-nfQJOy3zxB_ha0EIybsksOEln9H"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ الموضوع الثّاني) ──
PARAS = [
    'النّص:',  # 0
    '"أمَّا الجزائر فهي وطني الخاص الذي تربطني بأهله روابط من الماضي والحاضر والمستقبل بوجه خاص، وتفرض عليّ تلك الروابط لأجله- كجزء منه- فروضًا خاصة، وأنا أشعر بأنَّ كلّ مقوّماتي الشّخصيّة مستمدّة منه مباشرة، فأرى من الواجب أن تكون خدماتي أوّل ما تتّصل بشيء تتصل به مباشرة. وكما أنّني كلما أردت أن أعمل عملا وجدتني في حاجة إليه: إلى رجاله وإلى ماله وإلى حاله وإلى آلامه وإلى آماله، كذلك أجدُني إذا عملت قد خدمت بعملي ناحية أو أكثر ممّا كنت في حاجة إليه. هكذا هذا الاتّصال المباشر أجده بيني وبين وطني الخاص في كلّ حال وفي جميع الأعمال. وأحسب أنّ كلّ ابن وطنٍ يعمل لوطنه لا بدّ أن يجد نفسه مع وطنه الخاص في مثل هذه المباشرة وهذا الاتصال.',  # 1
    'نعم إن لنا وراء هذا الوطن الخاص أوطانا أخرى عزيزة علينا هي دائما منّا على بال، ونحن فيما',  # 2
    '(نعمل لوطننا الخاص) نعتقد أنّه لا بدّ أن تكون قد خدمناها، وأوصلنا إليها النّفع والخير من طريق خدمتنا',  # 3
    'لوطننا الخاص. وأقرب هذه الأوطان إلينا هو المغرب الأدنى والمغرب الأقصى اللّذان ما هما والمغرب الأوسط إلاّ وطن واحد لغةً وعقيدةً وآداباً وأخلاقاً وتاريخًا ومصلحةً ثمّ الوطن العربيّ والإسلاميّ ثم وطن الإنسانيّة العام. ولن نستطيع أن نؤدّي خدمة مثمرة لشيء من هذه كلها إلا إذا خدمنا الجزائر. وما مَثلُنَا في وطننا الخاص - وكلّ ذي وطن خاص - إلاّ كمثل جماعة ذوي بيوت من قرية واحدة، فبخدمة كلّ واحد لبيته تتكوّن من مجموع البيوت قرية سعيدة راقية، ومن ضَيّع بيته فهو لِمَا سواها أضيع، وبقدر قيام كلّ واحد بأمر بيته تترقى القرية وتسعد، وبقدر إهمال كل واحد لبيته تشقى القرية وتنحط.',  # 4
    'فنحن إذا كنّا نخدم الجزائر (فلسنا نخدمها على حساب غيرها) ولا للإضرار بسواها - معاذا بالله -',  # 5
    'ولكن لننفعها وننفع ما اتّصل بها من أوطان الأقرب فالأقرب. "',  # 6
    'آثار عبد الحميد بن باديس. الجزء الأوّل من المجلد الثاني. إعداد وتصنيف الدكتور عمار الطالبي،',  # 7
    'الطبعة الثالثة 1417هـ 1997م الشركة الجزائرية. ص: 237،236.',  # 8
    'الأسئلة:',  # 9
    'أوّلا- البناء الفكري: (12 نقاط)',  # 10
    'ذكر الكاتب أسس العلاقة بينه وبين وطنه الخاص، وضّحها ثم بيّن رأيك فيها.',  # 11
    'أشار الكاتب إلى تعدّد الأوطان وحث على خدمتها. حدّد تلك الأوطان وبيّن الرابط بينها.',  # 12
    'بِمَ مثّل الكاتب خدمة الأوطان؟ هل توافقه؟ علّل موقفك.',  # 13
    'لخّص مضمون النّص وفق تقنية التّلخيص.',  # 14
    'ثانيا- البناء اللّغوي: (08 نقاط)',  # 15
    'في الفقرة الثّانية ضمير بارز، حدّد نوعه وعائده، ومثّل له بمثالين من الفقرة وبيّن وظيفته في بناء تراكيبها.',  # 16
    'أ.  أعرب الكلمتين الآتيتين إعراب إفراد:',  # 17
    '"الروابط" في عبارة: "وتفرض عليّ تلك الروابط لأجله -كجزء منه- فروضًا خاصة"',  # 18
    '"وطن" في عبارة: "ما هما والمغرب الأوسط إلاّ وطن واحد"',  # 19
    'بين محل إعراب الجملتين الآتيتين:',  # 20
    '(نعمل لوطننا الخاص) الواردة في الفقرة الثانية.',  # 21
    '(فلسنا نخدمها على حساب غيرها) الواردة في الفقرة الأخيرة.',  # 22
    'في العبارتين التاليتين صورتان بيانيّتان. اذكرهما واشرحهما، ثمّ بيّن سرّ بلاغة كل منهما:',  # 23
    '«لن نستطيع أن نؤدي خدمةً مثمرةً» الواردة في الفقرة الثانية.',  # 24
    '«فنحن إذا كنّا نخدُم الجزائر» الواردة في الفقرة الأخيرة.',  # 25
    'استخرج المحسّن البديعيّ الوارد في العبارة التالية من الفقرة الثّانية وحدّد نوعه ووجه بلاغته:',  # 26
    '«وبقدر قيام كلّ واحد بأمر بيته تترقى القرية وتسعد، وبقدر إهمال كلّ واحد لبيته تشقى القرية وتنحطّ».',  # 27
]
POEM = None
assert POEM is None

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
SP = lambda *ix: " ".join(PARAS[i] for i in ix)  # أسطر ملفوفة من الفقرة نفسها في الموضوع الرّسميّ
TEXT = "\n".join([PARAS[1], SP(2, 3, 4), SP(5, 6)])
TEXT_DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": J(7, 8)},
]
P1, P2 = PARAS[10], PARAS[15]


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


Q = []
def q(qid, number, part, text, total, elements, docs=TEXT_DOCS):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


q("q1", "1", P1, J(11), 3,
  [el("q1-e1", "أساس: يستمدّ مقوّمات شخصيّته من وطنه مباشرة", 0.5), el("q1-e2", "أساس: خدماته تتّصل به مباشرة", 0.5),
   el("q1-e3", "أساس: حاجته إلى رجاله وماله وحاله وآلامه وآماله", 0.5), el("q1-e4", "أساس: خدمته للوطن أكثر من حاجته إليه", 0.5),
   el("q1-e5", "الرّأي فيها مع حسن التّعليل والتّمثيل من الواقع", 1)])
q("q2", "2", P1, J(12), 3,
  [el("q2-e1", "الوطن الخاصّ (الجزائر)", 0.5), el("q2-e2", "المغرب العربيّ", 0.5), el("q2-e3", "الوطن العربيّ والإسلاميّ", 0.5),
   el("q2-e4", "وطن الإنسانيّة العامّ", 0.5), el("q2-e5", "الرّابط بين هذه الأوطان", 1)])
q("q3", "3", P1, J(13), 3,
  [el("q3-e1", "بمَ مثّل الكاتب خدمة الأوطان", 1), el("q3-e2", "موقف المترشّح", 1), el("q3-e3", "تعليل الموقف", 1)])
q("q4", "4", P1, J(14), 3,
  [el("q4-e1", "التّلخيص: صحّة فهم المضمون", 1), el("q4-e2", "التّلخيص: احترام تقنيّة التّلخيص", 1), el("q4-e3", "التّلخيص: أسلوب المترشّح", 1)])
q("q5", "1", P2, J(16), 2,
  [el("q5-e1", "نوع الضّمير البارز", 0.5), el("q5-e2", "عائده", 0.5), el("q5-e3", "مثالان من الفقرة", 0.5), el("q5-e4", "وظيفته في بناء التّراكيب", 0.5)])
q("q6", "2", P2, J(17, 18, 19, 20, 21, 22), 2,
  [el("q6-e1", "إعراب «الرّوابط»", 0.5), el("q6-e2", "إعراب «وطن»", 0.5),
   el("q6-e3", "محلّ جملة (نعمل لوطننا الخاصّ)", 0.5), el("q6-e4", "محلّ جملة (فلسنا نخدمها على حساب غيرها)", 0.5)])
q("q7", "3", P2, J(23, 24, 25), 2.5,
  [el("q7-e1", "«خدمة مثمرة»: نوعها", 0.5), el("q7-e2", "«خدمة مثمرة»: شرحها", 0.5), el("q7-e3", "«خدمة مثمرة»: سرّ بلاغتها", 0.25),
   el("q7-e4", "«إذا كنّا نخدم الجزائر»: نوعها", 0.5), el("q7-e5", "«إذا كنّا نخدم الجزائر»: شرحها", 0.5),
   el("q7-e6", "«إذا كنّا نخدم الجزائر»: سرّ بلاغتها", 0.25)])
q("q8", "4", P2, J(26, 27), 1.5,
  [el("q8-e1", "استخراج المحسّن البديعيّ", 0.5), el("q8-e2", "نوعه", 0.5), el("q8-e3", "وجه بلاغته", 0.5)])

S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill=None, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


BASES = "أسس العلاقة بين الكاتب ووطنه الخاصّ: أنّه يستمدّ مقوّمات شخصيّته منه مباشرة، وأنّ خدماته تتّصل به مباشرة، وأنّه بحاجة إلى رجاله وماله وحاله وآلامه وآماله، وأنّ خدمته للوطن أكثر من حاجته إليه."
# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "fill_blank", "أكمل من النّصّ ما يدلّ على أوّل أسس العلاقة بين الكاتب ووطنه الخاصّ:",
   {"text": "وأنا أشعر بأنَّ كلّ ____ الشّخصيّة مستمدّة منه ____.", "bank": ["مقوّماتي", "مباشرة", "آمالي", "بالواسطة"]},
   {"blanks": [["مقوّماتي"], ["مباشرة"]]}, BASES, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "ما الأساس الّذي يدلّ عليه قول الكاتب: «فأرى من الواجب أن تكون خدماتي أوّل ما تتّصل بشيء تتصل به مباشرة»؟",
   {"options": ["أنّ خدماته تتّصل بوطنه الخاصّ مباشرة", "أنّ خدماته موجّهة إلى وطن الإنسانيّة العامّ أوّلًا",
                "أنّه يقدّم خدمة الأوطان البعيدة على خدمة وطنه", "أنّه لا يخدم وطنه إلّا إذا احتاج إليه"]},
   {"correct": 0}, BASES, 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e3", "multi", "كلّما أراد الكاتب أن يعمل عملًا وجد نفسه في حاجة إلى وطنه. إلامَ يحتاج منه؟ (اختر كلّ ما يصحّ)",
   {"options": ["إلى رجاله", "إلى ماله", "إلى حاله", "إلى آلامه وآماله", "إلى مناصبه وألقابه", "إلى أوطان أخرى غيره"]},
   {"correct": [0, 1, 2, 3]}, BASES, 0.5, "ar.comprehension.details")
st("s04", "q1", "q1-e4", "mcq", "ما الأساس الّذي يدلّ عليه قوله: «كذلك أجدُني إذا عملت قد خدمت بعملي ناحية أو أكثر ممّا كنت في حاجة إليه»؟",
   {"options": ["أنّ خدمته للوطن أكثر من حاجته إليه", "أنّ حاجته إلى الوطن أكبر من خدمته له",
                "أنّه لا يخدم وطنه إلّا بقدر ما يأخذ منه", "أنّ خدمته للوطن تقتصر على المال"]},
   {"correct": 0}, BASES, 0.5, "ar.comprehension.details")
essay("s05", "q1", "q1-e5", "رأيك في أسس العلاقة بين الكاتب ووطنه الخاصّ", "الرّأي", "إبداء رأي مع حسن التّعليل والتّمثيل من الواقع", 1,
      {"task": "إبداء الرّأي مع التّعليل", "question": J(11), "model": "الرّأي: يترك للمترشّح بشرط حسن التّعليل والتّمثيل من الواقع."},
      "الرّأي يُترك للمترشّح بشرط حسن التّعليل والتّمثيل من الواقع.", "ar.comprehension.opinion")
HOMES = "الأوطان: الوطن الخاصّ (الجزائر) والمغرب العربيّ، والوطن العربيّ والإسلاميّ، ثمّ وطن الإنسانيّة العامّ وما تربطه به من مصلحة."
st("s06", "q2", "q2-e1", "mcq", "ما الوطن الخاصّ للكاتب؟",
   {"options": ["الجزائر", "المغرب الأقصى", "الوطن العربيّ", "وطن الإنسانيّة العامّ"]},
   {"correct": 0}, HOMES, 0.5, "ar.comprehension.details")
st("s07", "q2", "q2-e2", "mcq", "ما أقرب الأوطان إلى الكاتب بعد وطنه الخاصّ؟",
   {"options": ["المغرب العربيّ: المغرب الأدنى والمغرب الأقصى (وهما والمغرب الأوسط وطن واحد)", "الوطن العربيّ والإسلاميّ",
                "وطن الإنسانيّة العامّ", "المشرق العربيّ"]},
   {"correct": 0}, "«وأقرب هذه الأوطان إلينا هو المغرب الأدنى والمغرب الأقصى اللّذان ما هما والمغرب الأوسط إلاّ وطن واحد…». " + HOMES, 0.5, "ar.comprehension.details")
st("s08", "q2", "q2-e3", "fill_blank", "أكمل من النّصّ:",
   {"text": "…إلاّ وطن واحد لغةً وعقيدةً وآداباً وأخلاقاً وتاريخًا ومصلحةً ثمّ الوطن ____ و____ ثم وطن الإنسانيّة العام.",
    "bank": ["العربيّ", "الإسلاميّ", "الأوروبّيّ", "الإفريقيّ"]},
   {"blanks": [["العربيّ"], ["الإسلاميّ"]]}, HOMES, 0.5, "ar.comprehension.details")
st("s09", "q2", "q2-e4", "mcq", "ما آخر الأوطان الّتي ذكرها الكاتب وأوسعها؟",
   {"options": ["وطن الإنسانيّة العامّ", "الوطن العربيّ والإسلاميّ", "المغرب الأقصى", "الجزائر"]},
   {"correct": 0}, HOMES, 0.5, "ar.comprehension.details")
st("s10", "q2", "q2-e5", "multi", "ما الرّوابط بين هذه الأوطان؟ (اختر كلّ ما يصحّ)",
   {"options": ["اللّغة", "العقيدة", "الأدب والأخلاق", "التّاريخ", "المصلحة", "العِرق", "الحدود السّياسيّة"]},
   {"correct": [0, 1, 2, 3, 4]}, "الرّابط بين هذه الأوطان كلّها هو رابطة اللّغة والعقيدة والأدب والأخلاق والتّاريخ، ثمّ رابطة المصلحة بالوطن الإسلاميّ ووطن الإنسانيّة العامّ.", 0.5, "ar.comprehension.link")
st("s11", "q2", "q2-e5", "fill_blank", "أكمل بيان الرّابط:",
   {"text": "الرّابط بين هذه الأوطان كلّها رابطة اللّغة و____ والأدب والأخلاق و____، ثمّ رابطة ____ بالوطن الإسلاميّ ووطن الإنسانيّة العامّ.",
    "bank": ["العقيدة", "التّاريخ", "المصلحة", "العِرق", "الحدود", "الثّروة"]},
   {"blanks": [["العقيدة"], ["التّاريخ"], ["المصلحة"]]}, "«والرّابط بين هذه الأوطان كلّها هو رابطة اللّغة والعقيدة والأدب والأخلاق والتّاريخ، ثمّ رابطة المصلحة بالوطن الإسلاميّ ووطن الإنسانيّة العامّ».", 0.5, "ar.comprehension.link", "b")
st("s12", "q3", "q3-e1", "mcq", "بمَ مثّل الكاتب خدمة الأوطان؟",
   {"options": ["بخدمة جماعة من قرية واحدة لبيوتهم", "بخدمة التّاجر لزبائنه", "بخدمة الرّاعي لقطيعه", "ببناء صرح من حجارة متفرّقة"]},
   {"correct": 0}, "شبّه الكاتب خدمة الأوطان بخدمة جماعة من قرية واحدة لبيوتهم، فبقدر قيام كلّ واحد ببيته تترقّى القرية وتسعد، وبقدر إهمال كلّ واحد لبيته تشقى القرية وتنحطّ.", 0.5, "ar.comprehension.image")
st("s13", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "فبقدر قيام كلّ واحد ببيته ____ القرية وتسعد، وبقدر إهمال كلّ واحد لبيته ____ القرية وتنحطّ.",
    "bank": ["تترقّى", "تشقى", "تنام", "تفرح"]},
   {"blanks": [["تترقّى"], ["تشقى"]]}, "«فبقدر قيام كلّ واحد ببيته تترقّى القرية وتسعد وبقدر إهمال كلّ واحد لبيته تشقى القرية وتنحطّ».", 0.5, "ar.comprehension.image", "b")
OPINION_SPEC = {"task": "إبداء الرّأي مع التّعليل", "question": J(13),
                "model": "شبّه الكاتب خدمة الأوطان بخدمة جماعة من قرية واحدة لبيوتهم… — موقف المترشّح…، التّعليل… (يُترك للمترشّح)"}
OPINION_EXPL = "موقف المترشّح من تمثيل الكاتب وتعليله يُتركان للمترشّح (01 للموقف و01 للتّعليل)."
essay("s14", "q3", "q3-e2", "موافقتك الكاتب في تمثيله خدمة الأوطان", "الموقف", "إبداء موقف واضح من تمثيل الكاتب", 1, OPINION_SPEC, OPINION_EXPL, "ar.comprehension.opinion")
essay("s15", "q3", "q3-e3", "موافقتك الكاتب في تمثيله خدمة الأوطان", "التّعليل", "تعليل الموقف", 1, OPINION_SPEC, OPINION_EXPL, "ar.comprehension.opinion")
SUM_SPEC = {"task": "تلخيص", "text": "نصّ عبد الحميد بن باديس في الوطن الخاصّ (بكالوريا 2018، الشّعب العلميّة، الموضوع الثّاني)"}
SUM_EXPL = "يُراعى في التّلخيص: صحّة فهم المضمون، واحترام تقنيّة التّلخيص، وأسلوب المترشّح (نقطة لكلّ معيار)."
for sid, eid, crit, ind in [("s16", "q4-e1", "صحّة فهم المضمون", "صحّة فهم المضمون"), ("s17", "q4-e2", "احترام التّقنيّة", "احترام تقنيّة التّلخيص"),
                            ("s18", "q4-e3", "أسلوب المترشّح", "أسلوب المترشّح")]:
    essay(sid, "q4", eid, "تلخيص نصّ ابن باديس", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s19", "q5", "q5-e1", "mcq", "ما نوع الضّمير البارز في الفقرة الثّانية؟",
   {"options": ["ضمير جماعة المتكلّمين «نحن»", "ضمير المتكلّم المفرد «أنا»", "ضمير الغائب المفرد «هو»", "ضمير المخاطب «أنت»"]},
   {"correct": 0}, "في الفقرة الثّانية ضمير بارز هو ضمير جماعة المتكلّمين «نحن».", 0.5, "ar.cohesion.reference")
st("s20", "q5", "q5-e2", "mcq", "على مَن يعود هذا الضّمير؟",
   {"options": ["على الكاتب النّاطق بلسان أمّته", "على أهل المغرب الأقصى", "على العلماء وحدهم", "على سكّان القرية"]},
   {"correct": 0}, "يعود على الكاتب النّاطق بلسان أمّته.", 0.5, "ar.cohesion.reference")
st("s21", "q5", "q5-e3", "multi", "أيّ ممّا يلي أمثلة لهذا الضّمير من الفقرة الثّانية؟ (اختر كلّ ما يصحّ)",
   {"options": ["لنا", "نعمل", "خدمناها", "مثلُنا", "بيته", "هما", "سواها"]},
   {"correct": [0, 1, 2, 3]}, "التّمثيل: (لنا، علينا، منّا، نحن، نعمل، خدمناها، أوصلنا، إلينا، مثلُنا)؛ ويكفي مثالان.", 0.5, "ar.cohesion.reference")
st("s22", "q5", "q5-e4", "mcq", "ما وظيفة هذا الضّمير في بناء تراكيب الفقرة؟",
   {"options": ["تحقيق اتّساق النّصّ وانسجامه، ووحدة موضوعه", "إدخال الحوار في النّصّ", "الانتقال من السّرد إلى الوصف", "إبراز التّضادّ بين المعاني"]},
   {"correct": 0}, "الوظيفة: تحقيق اتّساق النّصّ وانسجامه، ووحدة موضوعه.", 0.5, "ar.cohesion.effect")
st("s23", "q6", "q6-e1", "mcq", "ما إعراب «الرّوابط» في «وتفرض عليّ تلك الرّوابط لأجله فروضًا خاصّة»؟",
   {"options": ["بدل من اسم الإشارة «تلك» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«الرّوابط»: بدل من اسم الإشارة «تلك» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره (والفاعل اسم الإشارة «تلك»).", 0.5, "ar.grammar.badal")
st("s24", "q6", "q6-e2", "fill_blank", "أكمل إعراب «وطن» في «ما هما والمغرب الأوسط إلاّ وطن واحد»:",
   {"text": "وطنٌ: ____ مرفوع وعلامة رفعه ____ الظّاهرة على آخره.", "bank": ["خبر", "الضّمّة", "فاعل", "الفتحة"]},
   {"blanks": [["خبر"], ["الضّمّة"]]}, "«وطن»: خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s25", "q6", "q6-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (نعمل لوطننا الخاصّ) في الفقرة الثّانية؟",
   {"options": ["جملة فعليّة، صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر المبتدأ «نحن»",
                "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "(نعمل لوطننا الخاصّ): جملة فعليّة، صلة موصول (ما في «فيما») لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s26", "q6", "q6-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (فلسنا نخدمها على حساب غيرها) في الفقرة الأخيرة؟",
   {"options": ["جملة جواب شرط غير جازم لا محلّ لها من الإعراب", "جملة جواب شرط جازم مقترنة بالفاء في محلّ جزم",
                "جملة في محلّ نصب حال", "جملة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(فلسنا نخدمها على حساب غيرها): جملة جواب شرط غير جازم (إذا) لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s27", "q7", "q7-e1", "mcq", "ما نوع الصّورة البيانيّة في «لن نستطيع أن نؤدّي خدمةً مثمرةً»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, "الصّورة الأولى «خدمة مثمرة» – نوعها: استعارة مكنيّة.", 0.5, "ar.rhetoric.metaphor")
st("s28", "q7", "q7-e2", "matching", "اشرح الصّورة في «خدمةً مثمرةً»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (موجود)", "المشبّه به (محذوف)", "القرينة"], "rights": ["الخدمة", "الشّجرة", "مثمرة", "الجزائر"]},
   {"pairs": [0, 1, 2]}, "شرحها: المشبّه: الخدمة (موجود)، المشبّه به: الشّجرة (محذوف)، القرينة: (مثمرة).", 0.5, "ar.rhetoric.metaphor")
st("s29", "q7", "q7-e3", "mcq", "ما سرّ بلاغة الصّورة في «خدمةً مثمرةً»؟",
   {"options": ["تجسيد المعنويّ بالمادّيّ، وتحويل التّشبيه من صورة بليغة إلى صورة أبلغ منه، لتوضيح المعنى وتبيينه وتأكيده",
                "الإيجاز بذكر المكان وإرادة أهله", "تقديم الحقيقة مصحوبة بالدّليل", "إحداث جرس موسيقيّ بتوافق الفواصل"]},
   {"correct": 0}, "سرّ بلاغتها: تجسيد المعنويّ بالمادّيّ، تحويل التّشبيه من صورة بليغة إلى صورة أبلغ منه، ولتوضيح المعنى وتبيينه وتأكيده.", 0.25, "ar.rhetoric.effect")
st("s30", "q7", "q7-e4", "mcq", "ما نوع الصّورة البيانيّة في «فنحن إذا كنّا نخدم الجزائر»؟",
   {"options": ["مجاز مرسل", "استعارة مكنيّة", "كناية عن صفة", "تشبيه بليغ"]},
   {"correct": 0}, "الصّورة الثّانية «إذا كنّا نخدم الجزائر» – نوعها: مجاز مرسل.", 0.5, "ar.rhetoric.metonymy")
st("s31", "q7", "q7-e5", "fill_blank", "أكمل شرح الصّورة في «إذا كنّا نخدم الجزائر»:",
   {"text": "المقصود: نخدم ____ الجزائر، وعلاقته ____.", "bank": ["أهل", "المكانيّة", "أرض", "الزّمانيّة", "السّببيّة"]},
   {"blanks": [["أهل"], ["المكانيّة"]]}, "شرحها: المقصود (نخدم أهل الجزائر)، علاقته: المكانيّة.", 0.5, "ar.rhetoric.metonymy")
st("s32", "q7", "q7-e6", "mcq", "ما سرّ بلاغة الصّورة في «إذا كنّا نخدم الجزائر»؟",
   {"options": ["الإيجاز", "تجسيد المعنويّ بالمادّيّ", "تقديم الحقيقة مصحوبة بالدّليل", "المبالغة بادّعاء التّطابق بين المشبّه والمشبّه به"]},
   {"correct": 0}, "سرّ بلاغتها: الإيجاز.", 0.25, "ar.rhetoric.effect")
st("s33", "q8", "q8-e1", "fill_blank", "استخرج المحسّن البديعيّ: أكمل طرفيه في العبارة.",
   {"text": "«قيام كلّ واحد بأمر بيته» يقابله «____ كلّ واحد لبيته»، و«تترقّى القرية وتسعد» يقابله «____ القرية وتنحطّ».",
    "bank": ["إهمال", "تشقى", "اهتمام", "تزدهر"]},
   {"blanks": [["إهمال"], ["تشقى"]]}, "المحسّن: مقابلة بين «قيام كلّ واحد بأمر بيته وإهمال كلّ واحد لبيته» أو «تترقّى القرية وتسعد، وتشقى القرية وتنحطّ» (تكفي إحداهما).", 0.5, "ar.rhetoric.badi")
st("s34", "q8", "q8-e2", "mcq", "ما نوع هذا المحسّن البديعيّ؟",
   {"options": ["مقابلة", "طباق سلب", "جناس ناقص", "سجع"]},
   {"correct": 0}, "نوعه: مقابلة.", 0.5, "ar.rhetoric.badi")
st("s35", "q8", "q8-e3", "mcq", "ما وجه بلاغة المقابلة في العبارة؟",
   {"options": ["التّأكيد والتّبيين، وإضفاء جمال على التّعبير", "إحداث جرس موسيقيّ بتوافق الفواصل", "تقديم الحقيقة مصحوبة بالدّليل", "تشخيص المعنويّ في صورة محسوسة"]},
   {"correct": 0}, "سرّ بلاغته: التّأكيد والتّبيين، وإضفاء جمال على التّعبير.", 0.5, "ar.rhetoric.effect")


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
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        for d in qq["documents"]:
            assert (d.get("text") or d.get("table")), (qq["id"], d["id"])
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9 and s["points"] > 0, (s["id"], "points not a multiple of 0.25")
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
            assert a["order"] == list(range(len(p["items"]))) and len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S)
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q)
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


_check()

doc = {
    "schema_version": 1,
    "set_id": "ar-bac-2018-sci-p2",
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p2",
        "kind": "BAC", "year": 2018, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 2,
        "title": "بكالوريا 2018 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (ابن باديس: الوطن الخاصّ)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} (بكالوريا العربية 2018 شعبة علوم تجريبية.docx)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2018) في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx "
                  f"ومطابَق بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. العلامات من الإجابة "
                  "النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 3–4، قُرئتا مصوّرتين). الشّعب: علوم تجريبيّة، رياضيات، تسيير واقتصاد، تقني رياضي. "
                  "الفقرتان الثّانية والثّالثة مقطّعتان في docx إلى أسطر ملفوفة فوُصلت قطعهما بمسافة لتطابق فقرات الموضوع الرّسميّ (الأسئلة تحيل على «الفقرة الثّانية/الأخيرة»). "
                  "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): الرّأي في س1 (1)، والموقف والتّعليل في س3 (2×1)، والتّلخيص (3×1). "
                  "أسس العلاقة «4×0.5» والأوطان «4×0.5» أربعة بأعيانها في التّصحيح فلكلّ منها عنصر."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T10:30:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", len(S), "steps", sum(s["points"] for s in S), "points")
