"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (محمّد البشير الإبراهيمي، «آثار الإبراهيمي»).
Exam (most faithful source): gdrive 13Q6AsygzJd1776IoqKu5vketLbJ0r_gl (بكالوريا اللغة العربية 2011 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1_yJSPmmroPBc4SUIvY4u-HwOIrvTYiPc (BAC 2011 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 19DGNOb7uxR_4Zr1nK-dg8RDaNP6pdfG4 (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1MXUAgE-PMm99eQSWyMod9r2kxJ9_b4hg (02_التصحيح.pdf, pages 2–4).

Method (as build_ar_bac_2015_lit_p2.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed; the inner RLM of the reference line is kept) and spliced
into this builder by script; the literals were re-checked programmatically against the docx. The docx was compared line by
line with the official ONEC paper (scanned; native 791×1088 px page images, crops enlarged ×2). The correction is a scanned
PDF read from the page images (crops enlarged ×1.9–2). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Docx defects fixed from the ONEC paper (applied after generation, each asserted to occur once):
- text, paragraph 3: «صلَى الله عليه و سم» ⇒ «و سلّم»;
- Part 2 Q3: «إدراكٌ بعد أجهل» ⇒ «بعد جهل»; the word to be parsed is printed «الكُتّابٌ» / «الكُتَابٌ» (tanwīn on a noun with
  the article, impossible) ⇒ «الكُتّابُ» as on the ONEC paper (in the quotation and in item ب);
- Part 2 Q4: «يدعونا بعضتهم» ⇒ «بعضهم».
Other differences are diacritics / spelling / punctuation / labels only (docx kept): «كلمات: الوعي. اليقظة النّهضة» (ONEC
«كلماتُ: الوعي، اليقظة، النّهضة»), «يصخ»، «بضربٌ» (ONEC «يصخُّ»، «بضربٍ»), «(12 نقاط)» (ONEC «(12 نقطة)»), «ب- أعرب … إعراب
مفردات» without the final period… The ONEC paper too reads «لا يصحو صاحبُه لا بصوتٍ يصخّ» (kept).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
  Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed than required, or «خصائص أخرى»)
  ⇒ one element; exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «01 + 01» = the concepts are not embodied / the evidence («يمكن للمترشّح الاستشهاد بعبارات أخرى من النّص» ⇒ the
  distractors are the text's own definitions and an unrelated sentence, never another sentence that could serve as evidence).
- Q2 «3×0.5» and Q3 «3×0.5»: exactly three proposals / three means listed ⇒ three elements each. Q4 «0.5 + 0.5».
- Q5 «4×0.5» four values listed with «يكتفي المترشّح بذكر وشرح قيمتين فقط» ⇒ one element of 2.
- Q6 «4×0.5» paragraph titles ⇒ one element (titles of a plan grouped, as in the earlier converters).
- Q7 «0.5 + 3×0.5» = genre (المقال) + three features with «هناك خصائص أخرى يمكن أن يذكرها المترشّح» ⇒ one element of 1.5
  whose distractors are features of other genres only.
- Part 2: Q1 «3×0.25 + 0.75» = one element per antonym pair + the function. Q2 «01». Q3 «2×0.5 + 01» = the predicate /
  its kind / the i'rab of «الكتّاب» (بدل; no «نعت»/«عطف بيان» distractor). Q4 «0.25 + 0.75» = position / reason.
  Q5 «01 + 01 + 0.5» = type / explanation / effect.
- No summary in this paper ⇒ every element is interactive.
- Distractors avoid arguable alternatives: no «في معناه» for the predicate; no «كناية» for «أن نحجب عليهم نقائصنا»;
  no «صلة الموصول» reason for «يدعونا بعضهم إلى النّجاة…» (the scheme: «تابعة لجملة لا محلّ لها من الإعراب»); no «الخطابة»
  for the genre; antonym distractors are never antonyms of the asked word.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "13Q6AsygzJd1776IoqKu5vketLbJ0r_gl"
DOCX_TITLE = "بكالوريا اللغة العربية 2011 شعبة علوم تجريبية.docx"
PDF_ID = "1_yJSPmmroPBc4SUIvY4u-HwOIrvTYiPc"
OFFICIAL_ID = "19DGNOb7uxR_4Zr1nK-dg8RDaNP6pdfG4"
CORR_ID = "1MXUAgE-PMm99eQSWyMod9r2kxJ9_b4hg"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    26: 'الموضوع الثاني',
    27: 'النّص:',
    28: 'تتردّد على أقلام الكُتَابِ العرب وعلى ألسنة خُطبائهم منذ عهدٍ قريبٍ كلمات: الوعي. اليقظة النّهضة... والوعي في معناه الاجتماعي الذي يعنيه هؤلاء الكُتَّاب والخطباء إدراك بعد جهل، واليقظة في قصدهم تنبه بعد غفلة والنَّهضة معناها حركةٌ بعد ركود...',
    29: 'نعترف أن نومنا كان ثقيلاً وبأن عمر أمراضنا كان طويلاً، نعرف أن النوم الثقيل لا يصحو صاحبه لا بصوت يصخ أو بضربٌ يَصك، وأن المرض الطويل لا يُشفى المبتلى به إلا بتدبير حكيم قد يفضي إلى البتر أو القطع، وقد أصابنا من القوارع ما لو أصاب أهل الكهف لأبطل المعجزة في قصتهم وممّا كانوا به مثلاً في الآخرين...',
    30: 'وما أضلنا إلاّ المجرمون الذين يدعونا بعضهم إلى الجمع بوسيلة التفريق ويدعونا بعضهم إلى النّجاة بطريقة التَّغريق، والأوّلون هم رجال الدّين الضالون الذين فرّقوه إلى مذاهب وطوائف، والآخرون رجال السياسة الغاشّون الذين بدّلوا المشرب الواحد فجعلوه مشارب... فهل هبة من روح الإسلام على أرواح المسلمين تذهب بهؤلاء وهؤلاء إلى حيث ألقت، وتجمع قلوبهم على عقيدة الحق الواحد، وألسنتهم على كلمة الحق الجامعة وأيديهم على بناء حصن الحق على الأسس التي وضعها محمَّد - صلَى الله عليه و سم - و لا مطمع لنا في الوصول إلى هذه الغاية إلا إذا أصبح المسلم يلتفت إلى جهاته الأربع فلا يرى إلّا أخا يشارك في الآلام و الآمال... فهو حقيق أن يشاركه في العمل.',
    31: 'إنَّ الوسائل إلى هذه الغاية كثيرةٌ وأقربها نفعًا وأجداها أثرا أن تُربى الأحداث من الصبا على غَير ما ربّانا آباؤنا وأن نحجب عليهم نقائصنا، فإن اطلعوا عليها سميناها باسمها وأنّها نقائص، وأّنها سبب هلاكنا، وحذَّرناهم من التقليد لنا فيها. فإذا شبّوا على هذه الهداية سلكنا بهم سبيل الحق الواحدة ووجهناهم بتلك القابلية إلى وجهة واحدة وحميناهم من هذه التيارات الفكريّة التي تتجاذبهم ومن الذئاب الغربية التي تتخطفهم.',
    32: 'محمد البشير الإبراهيمي. "آثار الإبراهيمي" – بتصرف-',
    33: 'ج4 ص 219 - دار الغرب الإسلاميّ ط 1-\u200f 1997م.',
    36: 'الأسئلة:',
    37: 'أوّلا- البناء الفكري: (12 نقاط)',
    38: 'تناول الكاتب مفاهيم: الوعي، اليقظة والنهضة. هل تجسّدت هذه المفاهيم في نظره؟ وضح إجابتك بشواهد من النّص.',
    39: 'يُقِرُّ الكاتب أنَّنَا ضُللنا وفُرّقنا. ما الذي اقترحه لنتوحّد؟',
    40: 'يقترح الكاتب وسائل ناجعة للإصلاح. ما هي؟',
    41: 'كيف تبدو لك شخصية الكاتب في هذا النّص؟ علل إجابتك.',
    42: 'يطرح النّص مجموعة من القيم. استخرج قيمتين منها ممثلا من النّص.',
    43: 'اجعل لكل فقرة من فقرات النّصّ عنواناً مناسبا.',
    44: 'إلى أيّ فنّ نثريّ ينتمي النّص؟ اذكر ثلاث خصائص له.',
    45: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    46: 'استعمل الكاتب في الفقرة الأولى كلمات متضادّة. استخرجها ثم بين وظيفتها الدلاليّة.',
    47: 'تكرّرت كلمة «الحقّ» في الفقرة الثالثة من النّص. ما دلالة تكرارها؟',
    48: 'قال الكاتب: «والوعي في معناه الاجتماعي الذي يعنيه هؤلاء الكُتّابٌ والخطباء إدراكٌ بعد أجهل».',
    49: 'أ- عيّن الخبر في هذه العبارة ثم بِيّن نوعه.',
    50: 'ب- أعرب كلمة «الكُتَابٌ» إعراب مفردات',
    51: 'ما محل جملة: «يدعونا بعضتهم إلى النّجاة بطريقة التغرِيق» من الإعراب؟ علّل.',
    52: 'ما نوع الصورة البيانيّة في عبارة: «أن نحجب عليهم نقائصنا»؟ اشرحها مبينا بلاغتها.',
}


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs):
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
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
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
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


def _write(set_id, paper, streams, title, notes, log_note, docx_id, docx_title, corr_id, at):
    _check()
    doc = {
        "schema_version": 1,
        "set_id": set_id,
        "status": "NEEDS_HUMAN_REVIEW",
        "source": {
            "source_id": f"gdrive-{docx_id}-p{paper}",
            "kind": "BAC", "year": 2011, "level": "3AS", "streams": streams, "subject": "AR", "term": None, "paper": paper,
            "title": title,
            "original_url": f"https://drive.google.com/file/d/{docx_id}/view",
            "original_file_ref": f"gdrive:{docx_id} ({docx_title})",
            "correction_url": f"https://drive.google.com/file/d/{corr_id}/view",
            "correction_file_ref": f"gdrive:{corr_id} (02_التصحيح.pdf)",
            "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
            "notes": notes,
        },
        "original_questions": Q,
        "steps": S,
        "score_total": 20,
        "modes": ["PRACTICE", "EXAM"],
        "review_log": [{"at": at, "by": "claude", "action": "generated", "note": log_note}],
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n_int = sum(1 for s in S if s["type"] != "essay_builder")
    print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
          f"({n_int} interactive / {len(S) - n_int} deferred)", sum(s["points"] for s in S), "points")


# ── الوثائق (مع تصويبات الموضوع الرّسميّ؛ انظر التّوثيق أعلاه) ──
TEXT = "\n".join([PARAS[28], PARAS[29], _fix(PARAS[30], "عليه و سم -", "عليه و سلّم -"), PARAS[31]])
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[32] + "\n" + PARAS[33]},
]
P1, P2 = PARAS[37], PARAS[45]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)
Q10_TEXT = "\n".join([_fix(_fix(PARAS[48], "الكُتّابٌ", "الكُتّابُ"), "بعد أجهل", "بعد جهل"), PARAS[49], _fix(PARAS[50], "«الكُتَابٌ»", "«الكُتّابُ»")])

q("q1", "1", P1, J(38), 2, [el("q1-e1", "مدى تجسّد المفاهيم في نظر الكاتب", 1), el("q1-e2", "الشّاهد من النّصّ", 1)], DOCS)
q("q2", "2", P1, J(39), 1.5, [el("q2-e1", "اقتراح: اتّباع منهج الدّين", 0.5), el("q2-e2", "اقتراح: التّجمّع على عقيدة الحقّ قولًا وعملًا", 0.5),
                             el("q2-e3", "اقتراح: مشاركة المسلم أخاه في الآمال والآلام", 0.5)], DOCS)
q("q3", "3", P1, J(40), 1.5, [el("q3-e1", "وسيلة: تربية الأجيال تربية واعية", 0.5), el("q3-e2", "وسيلة: حجب نقائص الآباء والاعتراف بها", 0.5),
                             el("q3-e3", "وسيلة: التّحذير من تقليد الآباء فيها", 0.5)], DOCS)
q("q4", "4", P1, J(41), 1, [el("q4-e1", "شخصيّة الكاتب", 0.5), el("q4-e2", "التّعليل", 0.5)], DOCS)
q("q5", "5", P1, J(42), 2, [el("q5-e1", "قيمتان مع شرحهما والتّمثيل (4×0.5)", 2)], DOCS)
q("q6", "6", P1, J(43), 2, [el("q6-e1", "عناوين الفقرات الأربع (4×0.5)", 2)], DOCS)
q("q7", "7", P1, J(44), 2, [el("q7-e1", "الفنّ النّثريّ", 0.5), el("q7-e2", "ثلاث خصائص (3×0.5)", 1.5)], DOCS)
q("q8", "1", P2, J(46), 1.5, [el("q8-e1", "الضّدّ الأوّل", 0.25), el("q8-e2", "الضّدّ الثّاني", 0.25), el("q8-e3", "الضّدّ الثّالث", 0.25),
                             el("q8-e4", "الوظيفة الدّلاليّة", 0.75)], DOCS)
q("q9", "2", P2, J(47), 1, [el("q9-e1", "دلالة تكرار «الحقّ»", 1)], DOCS)
q("q10", "3", P2, Q10_TEXT, 2, [el("q10-e1", "تعيين الخبر", 0.5), el("q10-e2", "نوع الخبر", 0.5), el("q10-e3", "إعراب «الكتّاب»", 1)], DOCS)
q("q11", "4", P2, _fix(PARAS[51], "بعضتهم", "بعضهم"), 1, [el("q11-e1", "المحلّ الإعرابيّ", 0.25), el("q11-e2", "التّعليل", 0.75)], DOCS)
q("q12", "5", P2, J(52), 2.5, [el("q12-e1", "نوع الصّورة", 1), el("q12-e2", "شرح الصّورة", 1), el("q12-e3", "بلاغة الصّورة", 0.5)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("مدى تجسّد المفاهيم في نظر الكاتب مع التّعليل: مفاهيم الوعي، اليقظة والنّهضة لم تتجسّد في نظره. والدّليل على ذلك قوله: «نعترف أنّ نومنا كان ثقيلًا "
           "وبأنّ عمر أمراضنا كان طويلًا…». يمكن للمترشّح الاستشهاد بعبارات أخرى من النّصّ.")
st("s01", "q1", "q1-e1", "mcq", "هل تجسّدت مفاهيم الوعي واليقظة والنّهضة في نظر الكاتب؟",
   {"options": ["لا، لم تتجسّد في نظره", "نعم، تجسّدت تجسّدًا كاملًا", "تجسّد الوعي وحده دون اليقظة والنّهضة", "تجسّدت عند رجال الدّين والسّياسة وحدهم"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "أيّ العبارات الآتية يستشهد بها على أنّ هذه المفاهيم لم تتجسّد؟",
   {"options": ["«نعترف أنّ نومنا كان ثقيلًا وبأنّ عمر أمراضنا كان طويلًا»", "«والنّهضة معناها حركة بعد ركود»",
                "«واليقظة في قصدهم تنبّه بعد غفلة»", "«فهو حقيق أن يشاركه في العمل»"]},
   {"correct": 0}, Q1_EXPL + " أمّا «والنّهضة معناها…» و«واليقظة في قصدهم…» فتعريفان للمفاهيم لا شاهدان على تجسّدها أو عدمه.", 0.5, "ar.comprehension.evidence")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل الشّاهد من النّصّ:",
   {"text": "نعترف أنّ ____ كان ثقيلًا وبأنّ عمر ____ كان طويلًا.", "bank": ["نومنا", "أمراضنا", "يقظتنا", "أفراحنا"]},
   {"blanks": [["نومنا"], ["أمراضنا"]]}, Q1_EXPL, 0.5, "ar.comprehension.evidence", "b")
UNITY_EXPL = "اقتراحات الكاتب للتّوحّد: أ- اتّباع منهج الدّين. ب- التّجمّع على عقيدة الحقّ قولًا وعملًا. ج- مشاركة المسلم أخاه المسلم في الآمال والآلام."
st("s04", "q2", "q2-e1", "mcq", "من اقتراحات الكاتب لنتوحّد:",
   {"options": ["اتّباع منهج الدّين", "التّفرّق إلى مذاهب وطوائف", "اتّباع رجال السّياسة الغاشّين", "تقليد الآباء في نقائصهم"]},
   {"correct": 0}, UNITY_EXPL, 0.5, "ar.comprehension.details")
st("s05", "q2", "q2-e2", "fill_blank", "أكمل اقتراحًا آخر من اقتراحات الكاتب:",
   {"text": "التّجمّع على عقيدة ____ قولًا و____.", "bank": ["الحقّ", "عملًا", "القوّة", "صمتًا"]},
   {"blanks": [["الحقّ"], ["عملًا"]]}, UNITY_EXPL, 0.5, "ar.comprehension.details")
st("s06", "q2", "q2-e3", "mcq", "ومن اقتراحاته أيضًا:",
   {"options": ["مشاركة المسلم أخاه المسلم في الآمال والآلام", "انعزال كلّ مسلم بنفسه عن جهاته الأربع", "تقديم المصلحة الشّخصيّة على مصلحة الجماعة",
                "الاستعانة بالغريب على القريب"]},
   {"correct": 0}, UNITY_EXPL, 0.5, "ar.comprehension.details")
MEANS_EXPL = ("الوسائل النّاجعة للإصلاح الّتي اقترحها الكاتب هي: تربية الأجيال تربية واعية متماشية مع العصر وفق المبادئ السّامية؛ حجب نقائص الآباء والاعتراف بها؛ "
              "التّحذير من تقليد الآباء فيها.")
st("s07", "q3", "q3-e1", "fill_blank", "أكمل الوسيلة الأولى للإصلاح:",
   {"text": "تربية ____ تربية واعية متماشية مع ____ وفق المبادئ السّامية.", "bank": ["الأجيال", "العصر", "الآباء", "الماضي"]},
   {"blanks": [["الأجيال"], ["العصر"]]}, MEANS_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "mcq", "ومن الوسائل النّاجعة للإصلاح عند الكاتب:",
   {"options": ["حجب نقائص الآباء والاعتراف بها", "نشر نقائص الآباء وتمجيدها", "إنكار وجود النّقائص أصلًا", "ترك النّشء دون توجيه"]},
   {"correct": 0}, MEANS_EXPL, 0.5, "ar.comprehension.details")
st("s09", "q3", "q3-e3", "mcq", "وثالث الوسائل النّاجعة للإصلاح:",
   {"options": ["التّحذير من تقليد الآباء فيها", "الحثّ على تقليد الآباء في كلّ شيء", "قطع صلة الأبناء بآبائهم", "ترك الأبناء للتّيّارات الفكريّة"]},
   {"correct": 0}, MEANS_EXPL, 0.5, "ar.comprehension.details")
PERS_EXPL = "يبدو الكاتب مصلحًا اجتماعيًّا، غيورًا على مجتمعه، بدليل الكشف عن عيوب المجتمع قصد معالجتها والمساهمة في بناء مجتمع سليم، صالح وقويّ…"
st("s10", "q4", "q4-e1", "mcq", "كيف تبدو لك شخصيّة الكاتب في هذا النّصّ؟",
   {"options": ["مصلح اجتماعيّ غيور على مجتمعه", "شخصيّة لا مبالية بقضايا مجتمعها", "شخصيّة معجبة بالتّيّارات الفكريّة الوافدة", "شخصيّة مستسلمة للأمر الواقع"]},
   {"correct": 0}, PERS_EXPL, 0.5, "ar.comprehension.explain")
st("s11", "q4", "q4-e2", "fill_blank", "علّل إجابتك:",
   {"text": "بدليل الكشف عن ____ المجتمع قصد ____ والمساهمة في بناء مجتمع سليم، صالح وقويّ.", "bank": ["عيوب", "معالجتها", "محاسن", "تمجيدها"]},
   {"blanks": [["عيوب"], ["معالجتها"]]}, PERS_EXPL, 0.5, "ar.comprehension.explain")
VAL_EXPL = ("القيم الّتي تضمّنها النّصّ: القيمة الاجتماعيّة: كشف عيوب المجتمع والدّعوة إلى إصلاحها مع ذكر وسائل الإصلاح؛ القيمة الدّينيّة: الدّعوة إلى التّمسّك بتعاليم "
            "الدّين المفضية إلى وحدة الأمّة ونهضتها؛ القيمة السّياسيّة: كشف نوايا السّياسيّين وبيان أثرها السّيّئ على نهضة الأمّة ووحدتها؛ القيمة الفنّيّة: تتجسّد في "
            "خصائص أسلوب الكاتب. ملحوظة: يكتفي المترشّح بذكر وشرح قيمتين فقط.")
st("s12", "q5", "q5-e1", "multi", "أيّ القيم الآتية يطرحها النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["القيمة الاجتماعيّة", "القيمة الدّينيّة", "القيمة السّياسيّة", "القيمة الفنّيّة", "القيمة الاقتصاديّة", "القيمة الرّياضيّة"]},
   {"correct": [0, 1, 2, 3]}, VAL_EXPL, 1, "ar.comprehension.values")
st("s13", "q5", "q5-e1", "matching", "طابق كلّ قيمة بما يمثّلها في النّصّ.",
   {"lefts": ["القيمة الاجتماعيّة", "القيمة الدّينيّة", "القيمة السّياسيّة", "القيمة الفنّيّة"],
    "rights": ["كشف عيوب المجتمع والدّعوة إلى إصلاحها مع ذكر وسائل الإصلاح", "الدّعوة إلى التّمسّك بتعاليم الدّين المفضية إلى وحدة الأمّة ونهضتها",
               "كشف نوايا السّياسيّين وبيان أثرها السّيّئ على نهضة الأمّة ووحدتها", "تتجسّد في خصائص أسلوب الكاتب", "الدّعوة إلى جمع المال والثّراء"]},
   {"pairs": [0, 1, 2, 3]}, VAL_EXPL, 1, "ar.comprehension.values", "b")
TITLES = ["تحديد مفاهيم الوعي، اليقظة والنّهضة", "الاعتراف بمدى غفلة الأمّة، وطول نومها", "الدّعوة إلى نبذ التّفرقة والاعتصام بالوحدة",
          "الوسائل النّاجعة للإصلاح في نظر الكاتب"]
TITLES_EXPL = "عناوين الفقرات: أ. " + "؛ ب. ".join(TITLES[:2]) + "؛ ج. " + TITLES[2] + "؛ د. " + TITLES[3] + "."
st("s14", "q6", "q6-e1", "matching", "طابق كلّ فقرة من فقرات النّصّ بعنوانها المناسب.",
   {"lefts": ["الفقرة الأولى", "الفقرة الثّانية", "الفقرة الثّالثة", "الفقرة الرّابعة"], "rights": TITLES + ["تمجيد الحضارة الغربيّة وتقليدها"]},
   {"pairs": [0, 1, 2, 3]}, TITLES_EXPL, 1, "ar.writing.title")
st("s15", "q6", "q6-e1", "ordering", "رتّب عناوين الفقرات بحسب ورودها في النّصّ.",
   {"items": TITLES}, {"order": [0, 1, 2, 3]}, TITLES_EXPL, 1, "ar.comprehension.idea", "b")
ART_EXPL = ("الفنّ النّثريّ الّذي ينتمي إليه النّصّ: فنّ المقال. من خصائصه: منهجيّة العرض (مقدّمة، عرض وخاتمة)، وحدة الموضوع، وسائل الإقناع. "
            "تنبيه: هناك خصائص أخرى يمكن أن يذكرها المترشّح.")
st("s16", "q7", "q7-e1", "mcq", "إلى أيّ فنّ نثريّ ينتمي النّصّ؟",
   {"options": ["المقال", "القصّة القصيرة", "المسرحيّة", "السّيرة الذّاتيّة"]},
   {"correct": 0}, ART_EXPL, 0.5, "ar.literature.genre")
st("s17", "q7", "q7-e2", "multi", "أيّ ممّا يلي من خصائص فنّ المقال الّتي تظهر في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["منهجيّة العرض (مقدّمة، عرض وخاتمة)", "وحدة الموضوع", "وسائل الإقناع", "الحوار بين الشّخصيّات", "الحبكة والعقدة", "الوزن والقافية"]},
   {"correct": [0, 1, 2]}, ART_EXPL, 0.75, "ar.literature.features")
st("s18", "q7", "q7-e2", "fill_blank", "أكمل خصائص المقال في النّصّ:",
   {"text": "من خصائصه: ____ العرض (مقدّمة، عرض وخاتمة)، ____ الموضوع، وسائل ____.", "bank": ["منهجيّة", "وحدة", "الإقناع", "تعدّد", "التّسلية"]},
   {"blanks": [["منهجيّة"], ["وحدة"], ["الإقناع"]]}, ART_EXPL, 0.75, "ar.literature.features", "b")
# ── ثانيًا: البناء اللّغويّ ──
ANT_EXPL = "الكلمات المتضادّة ووظيفتها الدّلاليّة: «إدراك ≠ جهل»، «تنبّه ≠ غفلة»، «حركة ≠ ركود»؛ وظيفتها: توضيح وبيان معاني إدراك، تنبّه، حركة بمقابلتها بأضدادها."
st("s19", "q8", "q8-e1", "mcq", "ما ضدّ «إدراك» في الفقرة الأولى؟",
   {"options": ["جهل", "يقظة", "حركة", "وعي"]}, {"correct": 0}, ANT_EXPL, 0.25, "ar.cohesion.effect")
st("s20", "q8", "q8-e2", "fill_blank", "أكمل الضّدّين من الفقرة الأولى:",
   {"text": "«تنبّه» ≠ «____»", "bank": ["غفلة", "نهضة", "إدراك"]}, {"blanks": [["غفلة"]]}, ANT_EXPL, 0.25, "ar.cohesion.effect")
st("s21", "q8", "q8-e3", "mcq", "ما ضدّ «حركة» في الفقرة الأولى؟",
   {"options": ["ركود", "نهضة", "يقظة", "إدراك"]}, {"correct": 0}, ANT_EXPL, 0.25, "ar.cohesion.effect")
st("s22", "q8", "q8-e4", "mcq", "ما الوظيفة الدّلاليّة لهذه الكلمات المتضادّة؟",
   {"options": ["توضيح وبيان معاني إدراك، تنبّه، حركة بمقابلتها بأضدادها", "إحداث جرس موسيقيّ في الفقرة", "إطالة الفقرة دون فائدة",
                "إثارة الشّكّ في هذه المفاهيم"]},
   {"correct": 0}, ANT_EXPL, 0.75, "ar.rhetoric.badi")
REP_EXPL = "تكرّرت كلمة «الحقّ» في الفقرة الثّالثة من النّصّ للدّلالة على مدى إصرار الكاتب وإلحاحه على ضرورة العودة إلى جادّة الصّواب لتحقيق غاية الإصلاح والوحدة."
st("s23", "q9", "q9-e1", "mcq", "ما دلالة تكرار كلمة «الحقّ» في الفقرة الثّالثة؟",
   {"options": ["الدّلالة على مدى إصرار الكاتب وإلحاحه على ضرورة العودة إلى جادّة الصّواب لتحقيق غاية الإصلاح والوحدة", "الدّلالة على تردّد الكاتب وحيرته",
                "ملء الفراغ وإطالة الفقرة", "السّخرية من رجال الدّين"]},
   {"correct": 0}, REP_EXPL, 0.5, "ar.cohesion.effect")
st("s24", "q9", "q9-e1", "fill_blank", "أكمل دلالة التّكرار:",
   {"text": "للدّلالة على مدى ____ الكاتب وإلحاحه على ضرورة العودة إلى جادّة ____ لتحقيق غاية الإصلاح والوحدة.", "bank": ["إصرار", "الصّواب", "تردّد", "الماضي"]},
   {"blanks": [["إصرار"], ["الصّواب"]]}, REP_EXPL, 0.5, "ar.cohesion.effect", "b")
KH_EXPL = "تعيين الخبر وبيان نوعه في العبارة: «إدراكٌ»: خبر، نوعه: خبر مفرد. إعراب كلمة «الكُتّاب» في العبارة: بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره."
st("s25", "q10", "q10-e1", "mcq", "عيّن الخبر في العبارة: «والوعي في معناه الاجتماعيّ الّذي يعنيه هؤلاء الكتّاب والخطباء إدراكٌ بعد جهل».",
   {"options": ["إدراكٌ", "الاجتماعيّ", "الكتّاب", "جهل"]}, {"correct": 0}, KH_EXPL, 0.5, "ar.grammar.rules")
st("s26", "q10", "q10-e2", "mcq", "ما نوع الخبر «إدراكٌ» في هذه العبارة؟",
   {"options": ["خبر مفرد", "جملة اسميّة", "جملة فعليّة", "شبه جملة"]}, {"correct": 0}, KH_EXPL, 0.5, "ar.grammar.rules")
st("s27", "q10", "q10-e3", "mcq", "ما إعراب «الكُتّابُ» في قوله: «الّذي يعنيه هؤلاء الكتّابُ والخطباء»؟",
   {"options": ["بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة على آخره"]},
   {"correct": 0}, KH_EXPL + " (الفاعل هو اسم الإشارة «هؤلاء»).", 0.5, "ar.grammar.badal")
st("s28", "q10", "q10-e3", "fill_blank", "أكمل إعراب «الكُتّابُ»:",
   {"text": "الكُتّابُ: ____ مرفوع وعلامة رفعه الضّمّة ____ على آخره.", "bank": ["بدل", "الظّاهرة", "فاعل", "المقدّرة"]},
   {"blanks": [["بدل"], ["الظّاهرة"]]}, KH_EXPL, 0.5, "ar.grammar.badal", "b")
SC_EXPL = "محلّ الجملة من الإعراب: «يدعونا بعضهم إلى النّجاة بطريقة التّغريق» جملة لا محلّ لها من الإعراب، لأنّها تابعة لجملة لا محلّ لها من الإعراب."
st("s29", "q11", "q11-e1", "mcq", "ما محلّ جملة «يدعونا بعضهم إلى النّجاة بطريقة التّغريق» من الإعراب؟",
   {"options": ["لا محلّ لها من الإعراب", "في محلّ رفع خبر", "في محلّ نصب حال", "في محلّ نصب مفعول به"]},
   {"correct": 0}, SC_EXPL, 0.25, "ar.grammar.sentence_case")
st("s30", "q11", "q11-e2", "mcq", "علّل: لماذا لا محلّ لهذه الجملة من الإعراب؟",
   {"options": ["لأنّها تابعة لجملة لا محلّ لها من الإعراب", "لأنّها جملة ابتدائيّة في أوّل الكلام", "لأنّها جواب شرط غير جازم", "لأنّها جملة اعتراضيّة"]},
   {"correct": 0}, SC_EXPL + " (فهي معطوفة بالواو على جملة «يدعونا بعضهم إلى الجمع…».)", 0.75, "ar.grammar.sentence_case")
IMG_EXPL = ("نوع الصّورة البيانيّة في عبارة «أن نحجب عليهم نقائصنا…»: استعارة مكنيّة. الشّرح: شبّه النّقائص بشيء مادّيّ يُحجب ثمّ حذف المشبّه به ورمز إليه بالفعل «نحجب». "
            "بلاغتها: توضيح المعنى وتقريبه من الذّهن عن طريق التّجسيد بنقله من المعنويّ المجرّد إلى المحسوس.")
st("s31", "q12", "q12-e1", "mcq", "ما نوع الصّورة البيانيّة في عبارة «أن نحجب عليهم نقائصنا»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]}, {"correct": 0}, IMG_EXPL, 1, "ar.rhetoric.metaphor")
st("s32", "q12", "q12-e2", "matching", "اشرح الصّورة في «أن نحجب عليهم نقائصنا»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "ما رُمز به إلى المشبّه به"], "rights": ["النّقائص", "شيء مادّيّ يُحجب", "الفعل «نحجب»", "الأحداث"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s33", "q12", "q12-e2", "fill_blank", "أكمل شرح الصّورة:",
   {"text": "شبّه ____ بشيء ____ يُحجب ثمّ حذف المشبّه به ورمز إليه بالفعل «نحجب».", "bank": ["النّقائص", "مادّيّ", "الأحداث", "معنويّ"]},
   {"blanks": [["النّقائص"], ["مادّيّ"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor", "b")
st("s34", "q12", "q12-e3", "mcq", "ما بلاغة الصّورة في «أن نحجب عليهم نقائصنا»؟",
   {"options": ["توضيح المعنى وتقريبه من الذّهن عن طريق التّجسيد بنقله من المعنويّ المجرّد إلى المحسوس", "تقديم الحقيقة مصحوبة بدليلها",
                "الإيجاز بذكر الجزء وإرادة الكلّ", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (محمّد البشير الإبراهيمي: آثار الإبراهيمي)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. صُوّبت من الموضوع الرّسميّ أخطاء نسخ في docx: «و سم» ← «و سلّم» (الفقرة 3)، «بعد أجهل» ← «بعد جهل» "
         "و«الكُتّابٌ/الكُتَابٌ» ← «الكُتّابُ» (البناء اللّغويّ س3)، «بعضتهم» ← «بعضهم» (س4). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2–4، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "لا سؤال مؤجّلًا في هذا الموضوع. القيم «4×0.5» يُكتفى فيها بقيمتين، وخصائص المقال «3×0.5» مع «خصائص أخرى» فبقي كلّ منهما عنصرًا واحدًا.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T17:20:00Z")
