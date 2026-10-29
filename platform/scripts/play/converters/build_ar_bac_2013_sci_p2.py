"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (ميخائيل نعيمة، في ذكرى استقلال الجزائر).
Exam (most faithful source): gdrive 1X0MOAy5MKGN4HlyM4AwsI1TTvYaV99EP (بكالوريا العربية 2013 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1TA5Pej8yTNDz4WjR8qfkEz6PqMTGZXM9;
official ONEC paper: gdrive 1XtYf5zdZpWRB0r39HQxbM6bnf5U8ut6y (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 11ot5GjpL76tQyBuRkaVVMpBaMCngiZn3 (02_التصحيح.pdf, pages 3–4).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed) and re-checked programmatically against it.
The docx stores the prose text one printed line per paragraph; the lines were joined with single spaces into the four
paragraphs of the ONEC paper (indented paragraph starts; the questions cite «الفقرة الأولى / الثّانية / الثّالثة»).
Q1 of Part 1 is likewise split over two docx paragraphs («…ساقه» / «على ذلك؟») and joined. The docx was compared line by
line with the ONEC paper (rendered at 150 dpi, doubtful spots at 300 dpi). Both PDFs are scans, so the mark scheme was
read from the rendered pages. Every mark comes from the official scheme; correct options and explanations condense it.

Conversion notes / points for the owner's review:
- Streams: ONEC header «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
- docx defects fixed from the ONEC paper: «من الخارج أومن الداخل» (missing space) ⇒ «أو من»; the reference line
  «مجلّة '"لبلاغ" اللبنانية» (stray apostrophe, missing alif) ⇒ «مجلّة "البلاغ" اللبنانية». Other differences are
  diacritics / punctuation («ليأخذ ولا» vs ONEC «ليأخذَ، ولا», «؛» vs «،» after the author's name) ⇒ docx kept.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required
  distinct items, or distinct demands ⇒ one element per item.
- Q1 «2×0.5» (نعمة / نقمة) + 0.5 the evidence ⇒ three elements. Q2 01. Q3 «3×0.5» three values among four ⇒ one element.
- Q4: 0.5 the opinion (model «أوافق الكاتب في الشّرط…») ⇒ deferred essay_builder (guide rule 11, as the opinion steps
  of the 2017 converters), the expected stance kept in the spec; «2×0.5» examples from outside (التّبعيّة، الاستغلال…) /
  from inside (عدم تكافؤ الفرص، الحرمان، الطّبقيّة…) ⇒ one element each (split read from the scheme's layout — to confirm).
- Q5 0.5 the genre (المقال السّياسيّ) + «3×0.5» three features among four ⇒ one element. The examples of the
  persuasion devices in the matching step are the converter's (the scheme lists only the devices).
- Q6 01 the type (التّفسيريّ) + «2×0.5» the two indicators listed (one element each) + «2×0.25» one example each
  («يمكن للمترشّح أن يذكر أمثلة أخرى» ⇒ distractors are sentences that are not analysis). «الحجاجيّ» is not a distractor.
- Q7 (تلخيص) 01 مضمون النّصّ / 0.5 لغة وأسلوب المترشّح / 0.5 حجم النّصّ ⇒ three deferred essay_builder elements.
- Part 2 Q1 «2×0.75» one per field. Q2 «2×0.5» words + «2×0.75» sentences. «نقمة» after «تغدو»: the scheme says «حال»;
  «خبر تغدو» (also defensible) is deliberately NOT a distractor.
- Q3 «3×0.5» = the three connector types listed (حرف العطف الواو / حروف الجرّ الباء، على، من / الضّمير «هي») ⇒ three
  elements; 0.75 how they serve cohesion (others accepted ⇒ distractors only anti-cohesive notions).
- Q4: 0.75 «الخدمة… هي نعمة» تشبيه بليغ (type + explanation); 0.5 «فكانت انتفاضة الجزائر» مجاز مرسل علاقته المكانيّة
  (no «علاقته المحلّيّة» distractor — same relation); 0.25 + 0.25 the two secrets.
- Deferred: Q4 opinion (0.5) + Q7 summary (2) = 2.5. Distractors are the converter's own and need review.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-sci-p2"
DOCX_ID = "1X0MOAy5MKGN4HlyM4AwsI1TTvYaV99EP"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة علوم تجريبية.docx"
PDF_ID = "1TA5Pej8yTNDz4WjR8qfkEz6PqMTGZXM9"
OFFICIAL_ID = "1XtYf5zdZpWRB0r39HQxbM6bnf5U8ut6y"
CORR_ID = "11ot5GjpL76tQyBuRkaVVMpBaMCngiZn3"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الثّاني (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P2_PARAS = ["\"...الخدمة التي تفرضها طبيعة الإنسان على الإنسان هي نعمة من نعم الله عليه، إنّها في لب التعاون الذي به تقوم الأسرة البشريّة، ولكنها تغدو نقمة وأيّ نقمة عندما يفرضها إنسان على إنسان برغم أنفه، أو أمّة على أمّة بقوة السّلاح أو بقوّة المال والدهاء، ذلك بالتّمام ما فعله الإقطاع والاستعمار في خلال قرون وقرون، فلا الإقطاع ولا الاستعمار جاء ليخدم بل ليُخدم، ولا ليعطي بل ليأخذ ولا ليُريح بل ليستريح.", "ثمّ كان القرن العشرون الذي يمكن أن ندعوه بحق قرن تصفية الاستعمار وإِذ هبّت الشّعوب المغلوبة على أمرها تطالب بحقها في أن تكون سيّدة أرضها وسيّدة مصيرها، فكانت انتفاضة الجزائر من أروع ما شهده هذا القرن من انتفاضات ضدّ الاستعمار.", "وها هي الجزائر تحتفل بذكرى استقلالها، وهي دائبة بإخلاص وعزم وإيمان على تصفية استقلالها من رواسب الاستعمار التي قد تكون عالقة حتّى اليوم بنفوس أبنائها. فلا طبقات فوق طبقات، ولا محظوظون ومحرومون، ولا أسياد وعبيد بل هناك فرص متكافئة للخدمة المتبادلة، وللنهوض بالبلاد أعلى فأعلى وأبعد فأبْعد، ولكبح جِماح الاستغلال الذي هو ألدّ أعداء الاستقلال.", "ألا بورك الاستقلال لا تشُوبُه شائبة من الاستغلال سواء جاءته تلك الشائبة من الخارج أو من الداخل. وبُوركت هذه الذكرى تُحييها الجزائر البطلة عاماً بعد عام.\""]
P2_REF = "ميخائيل نعيمة؛ مجلّة \"البلاغ\" اللبنانية\nبتاريخ: 1 يوليو 1974 (بتصرف)"
P2_QP = ["أوّلا- البناء الفكري: (12 نقاط)", "متى تكون الخدمة نعمة على الإنسان ومتى تكون نقمة في نظر الكاتب؟ وما الدليل الّذي ساقه على ذلك؟", "أكد الكاتب أنّ القرن العشرين يمكن أن ندعوه بحق قرن تصفية الاستعمار. لماذا؟", "ما هي القيّم التي تبنتها الانتفاضة الجزائريّة وكانت محل اعتزاز الكتّاب العرب؟", "بارك الكاتب استقلال الجزائر. أبد رأيك في الشرط الّذِي وضعه، معتمدًا على أمثلة من الواقع.", "في أي نوع من أنواع النثر تصنف النّص؟ اذكر ثلاث خصائص له تجلّت في هذا النص.", "ما النّمط الغالب على النص؟ حدد مؤشرين من مؤشراته مع التمثيل من النّص.", "لخّص مضمون النّص بأسلوبك الخاص.", "ثانيا- البناء اللّغوي: (08 نقاط)", "وردت في النّص الألفاظ التالية:\nالخدمة - الاستغلال - الاستعمار - الأسرة البشريّة - التّعاون - الاستقلال.\nصنفها حسب الحقلين الدلالين التّالين:\nالحقل السّياسي.\nالحقل الاجتماعي.", "أعرب ما يلي إعراب مفردات:\n\" نقمة \" الواقعة في العبارة: \" ولكنها تغدو نقمة\" من الفقرة الأولى.\n\" إذْ\" الواقعة في العبارة: \" وإذ هبّت الشعوب المغلوبة على أمرها\" من الفقرة الثانية.\nوأعرب ما يلي إعراب جمل:\n\" هي نعمة \" الواقعة في الفقرة الأولى.\n\" هو ألدّ أعداء الاستقلال \" الواقعة في الفقرة الثالثة.", "إليك العبارة التالية:\n\" وها هي الجزائر تحتفل بذكرى استقلالها، وهي دائبة بإخلاص وعزم وإيمان على تصفية استقلالها من رواسب الاستعمار التي قد تكون عالقة حتّى اليوم بنفوس أبنائها\".\nاستخرج الروابط الموجودة فيها، ثمّ بين كيف ساهمت في اتساقها.", "ما نوع الصورتين البيانيتين الآتيتين، وما سر بلاغتهما:\n\" الخدمة ... هي نعمة...\" الواقعة في الفقرة الأولى.\n\" فكانت انتفاضة الجزائر...\" الواقعة في الفقرة الثانية."]

def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill=None, variant="a"):
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
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert (d.get("text") or d.get("table")), (qq["id"], d["id"])
        for v in SOURCE_STREAMS:
            sub = sum(e["max_points"] for e in qq["rubric_elements"] if v in e.get("streams", SOURCE_STREAMS))
            assert abs(sub - qq["rubric_total"]) < 1e-9, (qq["id"], v, sub)
    for v in SOURCE_STREAMS:
        tot = sum(s["points"] for s in S if v in els[s["rubric_element_id"]].get("streams", SOURCE_STREAMS))
        assert abs(tot - total) < 1e-9, (v, tot)
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"].startswith(s["source_question_id"] + "-") and s["rubric_element_id"] in els, s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
            assert (3 <= len(p["options"]) <= 4 and a["correct"] == 0) if t == "mcq" else len(p["options"]) >= 3, (s["id"], "option count")
            if t == "multi":
                assert 0 < len(a["correct"]) < len(p["options"]) and len(set(a["correct"])) == len(a["correct"]), s["id"]
                assert all(0 <= i < len(p["options"]) for i in a["correct"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(p["bank"]) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
            assert all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            # الإجابة الصّحيحة لا تظهر في عنوان وثيقة (القاعدة 12)
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"

QP = P2_QP
assert len(P2_PARAS) == 4 and QP[0].startswith("أوّلا") and QP[8].startswith("ثانيا") and len(QP) == 13
assert "هي نعمة" in P2_PARAS[0] and "وإِذ هبّت" in P2_PARAS[1] and P2_PARAS[2].endswith("ألدّ أعداء الاستقلال.") and "أو من الداخل" in P2_PARAS[3]
P1, P2 = QP[0], QP[8]
DOCS = [{"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
        {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF}]

q("q1", "1", P1, QP[1], 1.5, [el("q1-e1", "متى تكون الخدمة نعمة", 0.5), el("q1-e2", "متى تكون الخدمة نقمة", 0.5),
                               el("q1-e3", "الدّليل الّذي ساقه الكاتب", 0.5)], DOCS)
q("q2", "2", P1, QP[2], 1, [el("q2-e1", "تعليل تسمية القرن العشرين قرن تصفية الاستعمار", 1)], DOCS)
q("q3", "3", P1, QP[3], 1.5, [el("q3-e1", "ثلاث قيم تبنّتها الانتفاضة الجزائريّة (3×0.5)", 1.5)], DOCS)
q("q4", "4", P1, QP[4], 1.5, [el("q4-e1", "الرّأي في الشّرط الّذي وضعه الكاتب", 0.5), el("q4-e2", "أمثلة من الواقع: من الخارج", 0.5),
                               el("q4-e3", "أمثلة من الواقع: من الدّاخل", 0.5)], DOCS)
q("q5", "5", P1, QP[5], 2, [el("q5-e1", "نوع النّثر", 0.5), el("q5-e2", "ثلاث خصائص تجلّت في النّصّ (3×0.5)", 1.5)], DOCS)
q("q6", "6", P1, QP[6], 2.5, [el("q6-e1", "النّمط الغالب", 1), el("q6-e2", "المؤشّر الأوّل: تحليل فكرة أو ظاهرة", 0.5),
                               el("q6-e3", "المؤشّر الثّاني: ضمائر الغائب", 0.5), el("q6-e4", "التّمثيل للمؤشّر الأوّل", 0.25),
                               el("q6-e5", "التّمثيل للمؤشّر الثّاني", 0.25)], DOCS)
q("q7", "7", P1, QP[7], 2, [el("q7-e1", "التّلخيص: مضمون النّصّ", 1), el("q7-e2", "التّلخيص: لغة المترشّح وأسلوبه", 0.5),
                             el("q7-e3", "التّلخيص: حجم النّصّ", 0.5)], DOCS)
q("q8", "1", P2, QP[9], 1.5, [el("q8-e1", "ألفاظ الحقل السّياسيّ", 0.75), el("q8-e2", "ألفاظ الحقل الاجتماعيّ", 0.75)], DOCS)
q("q9", "2", P2, QP[10], 2.5, [el("q9-e1", "إعراب «نقمة»", 0.5), el("q9-e2", "إعراب «إذْ»", 0.5),
                                el("q9-e3", "محلّ جملة «هي نعمة»", 0.75), el("q9-e4", "محلّ جملة «هو ألدّ أعداء الاستقلال»", 0.75)], DOCS)
q("q10", "3", P2, QP[11], 2.25, [el("q10-e1", "رابط: حرف العطف", 0.5), el("q10-e2", "رابط: حروف الجرّ", 0.5),
                                  el("q10-e3", "رابط: الضّمير المنفصل وعائده", 0.5), el("q10-e4", "كيفيّة مساهمة الرّوابط في الاتّساق", 0.75)], DOCS)
q("q11", "4", P2, QP[12], 1.75, [el("q11-e1", "«الخدمة… هي نعمة»: النّوع والشّرح", 0.75), el("q11-e2", "«فكانت انتفاضة الجزائر»: النّوع", 0.5),
                                  el("q11-e3", "سرّ بلاغة التّشبيه", 0.25), el("q11-e4", "سرّ بلاغة المجاز المرسل", 0.25)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("تكون الخدمة نعمة على الإنسان إذا كانت في لبّ التّعاون الّذي به تقوم الأسرة البشريّة، وتكون نقمة عندما يفرضها إنسان على إنسان "
           "برغم أنفه، أو أمّة على أمّة بقوّة السّلاح أو بقوّة المال والدّهاء.")
st("s01", "q1", "q1-e1", "mcq", "متى تكون الخدمة نعمة على الإنسان في نظر الكاتب؟",
   {"options": ["إذا كانت في لبّ التّعاون الّذي به تقوم الأسرة البشريّة", "إذا فرضها إنسان على إنسان برغم أنفه", "إذا فرضتها أمّة على أمّة بقوّة السّلاح",
                "إذا أُدّيت مقابل المال والجاه"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل: متى تكون الخدمة نقمة؟",
   {"text": "تكون نقمة عندما يفرضها إنسان على إنسان برغم ____، أو أمّة على أمّة بقوّة ____ أو بقوّة المال و____.",
    "bank": ["أنفه", "السّلاح", "الدّهاء", "رضاه", "العلم", "الكرم"]},
   {"blanks": [["أنفه"], ["السّلاح"], ["الدّهاء"]]}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e3", "mcq", "ما الدّليل الّذي ساقه الكاتب على ذلك؟",
   {"options": ["الإقطاع والاستعمار الّذي بسط هيمنته وجبروته على الشّعوب المغلوبة على أمرها طوال قرون عديدة",
                "تعاون أفراد الأسرة البشريّة في بناء المجتمع", "احتفال الجزائر بذكرى استقلالها", "تكافؤ الفرص بين أبناء الشّعب الواحد"]},
   {"correct": 0}, "الدّليل الّذي ساقه الكاتب على ذلك هو الإقطاع والاستعمار الّذي بسط هيمنته وجبروته على الشّعوب المغلوبة على أمرها طوال قرون عديدة.", 0.5, "ar.comprehension.evidence")
Q2_EXPL = ("أكّد الكاتب أنّ القرن العشرين يمكن أن ندعوه بحقّ قرن تصفية الاستعمار لأنّ الشّعوب المغلوبة على أمرها علمت أنّ الاستعمار جاء ليُخدَم، "
           "ليأخذ، وليستريح، فراحت تطالب بحقّها عن طريق الانتفاضات.")
st("s04", "q2", "q2-e1", "mcq", "لماذا أكّد الكاتب أنّ القرن العشرين يمكن أن ندعوه بحقّ قرن تصفية الاستعمار؟",
   {"options": ["لأنّ الشّعوب المغلوبة على أمرها علمت أنّ الاستعمار جاء ليُخدَم ويأخذ ويستريح، فراحت تطالب بحقّها عن طريق الانتفاضات",
                "لأنّ الدّول الاستعماريّة تخلّت عن مستعمراتها طوعًا", "لأنّ الإقطاع ازدهر فيه أكثر من أيّ قرن مضى",
                "لأنّ الشّعوب رضيت بالخدمة الّتي فرضها عليها المستعمر"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل التّعليل:",
   {"text": "لأنّ الشّعوب المغلوبة على أمرها علمت أنّ الاستعمار جاء ____، ليأخذ، وليستريح، فراحت تطالب بحقّها عن طريق ____.",
    "bank": ["ليُخدَم", "الانتفاضات", "ليُعطي", "المفاوضات"]},
   {"blanks": [["ليُخدَم"], ["الانتفاضات"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain", "b")
VAL_EXPL = ("القيم الّتي تبنّتها الانتفاضة الجزائريّة وكانت محلّ اعتزاز الكتّاب العرب: يقظة الشّعب الجزائريّ لتقرير حقّه في الاستقلال – "
            "الإيمان بأنّه سيّد أرضه وسيّد مصيره – تصفية استقلالها من رواسب الاستعمار – العدالة الاجتماعيّة.")
st("s06", "q3", "q3-e1", "multi", "ما القيم الّتي تبنّتها الانتفاضة الجزائريّة وكانت محلّ اعتزاز الكتّاب العرب؟ (اختر كلّ ما يصحّ)",
   {"options": ["يقظة الشّعب الجزائريّ لتقرير حقّه في الاستقلال", "الإيمان بأنّه سيّد أرضه وسيّد مصيره", "تصفية استقلالها من رواسب الاستعمار",
                "العدالة الاجتماعيّة", "الرّضا بالتّبعيّة للأجنبيّ", "تكريس الطّبقيّة بين أبناء الشّعب"]},
   {"correct": [0, 1, 2, 3]}, VAL_EXPL, 1, "ar.comprehension.values")
st("s07", "q3", "q3-e1", "fill_blank", "أكمل من القيم الّتي تبنّتها الانتفاضة الجزائريّة:",
   {"text": "____ الشّعب الجزائريّ لتقرير حقّه في الاستقلال، والإيمان بأنّه سيّد أرضه وسيّد ____، و____ الاجتماعيّة.",
    "bank": ["يقظة", "مصيره", "العدالة", "غفلة", "ماضيه", "الطّبقيّة"]},
   {"blanks": [["يقظة"], ["مصيره"], ["العدالة"]]}, VAL_EXPL, 0.5, "ar.comprehension.values", "b")
OP_SPEC = {"task": "إبداء الرّأي في الشّرط الّذي وضعه الكاتب لمباركة الاستقلال", "question": QP[4],
           "condition": "ألّا تشوب الاستقلالَ شائبةٌ من الاستغلال، سواء جاءته من الخارج أو من الدّاخل",
           "model": "الإجابة النّموذجيّة: «أوافق الكاتب في الشّرط الّذي وضعه وهو أنّ الاستقلال يجب ألّا تشوبه شائبة من الاستغلال» (0.5)، ثمّ الأمثلة من الواقع (2×0.5)."}
essay("s08", "q4", "q4-e1", "رأيك في شرط الكاتب لمباركة الاستقلال", "الرّأي", "إبداء رأي واضح في الشّرط (المنتظَر: موافقة الكاتب)", 0.5, OP_SPEC,
      "أوافق الكاتب في الشّرط الّذي وضعه وهو أنّ الاستقلال يجب ألّا تشوبه شائبة من الاستغلال.", "ar.comprehension.opinion")
EX_EXPL = ("أمثلة من الخارج: التّبعيّة – الاستغلال…؛ أمثلة من الدّاخل: عدم تكافؤ الفرص – الحرمان – الطّبقيّة… "
           "(يمكن للمترشّح أن يذكر أمثلة أخرى تؤخذ بعين الاعتبار).")
st("s09", "q4", "q4-e2", "mcq", "من أمثلة الشّائبة الّتي قد تأتي الاستقلالَ من الخارج:",
   {"options": ["التّبعيّة", "الطّبقيّة", "عدم تكافؤ الفرص", "الحرمان"]},
   {"correct": 0}, EX_EXPL, 0.5, "ar.comprehension.explain")
st("s10", "q4", "q4-e3", "multi", "ومن أمثلة الشّائبة الّتي قد تأتيه من الدّاخل: (اختر كلّ ما يصحّ)",
   {"options": ["عدم تكافؤ الفرص", "الحرمان", "الطّبقيّة", "التّبعيّة للأجنبيّ"]},
   {"correct": [0, 1, 2]}, EX_EXPL, 0.5, "ar.comprehension.explain")
st("s11", "q5", "q5-e1", "mcq", "في أيّ نوع من أنواع النّثر يُصنَّف النّصّ؟",
   {"options": ["المقال السّياسيّ", "الخطابة", "الرّسالة الأدبيّة", "القصّة القصيرة"]},
   {"correct": 0}, "ينتمي النّصّ إلى فنّ المقال السّياسيّ.", 0.5, "ar.literature.prose")
ART_EXPL = ("من خصائص المقال الّتي تجلّت في النّصّ: وحدة الموضوع – التّدرّج في الطّرح (منهجيّة: المقدّمة، العرض والخاتمة) – تناسق الأفكار وتسلسلها – "
            "عنصر الإقناع عن طريق التّوكيد بـ: إنّ، الجمل الاسميّة، لا النّافية، اسم التّفضيل…")
st("s12", "q5", "q5-e2", "multi", "أيّ ممّا يلي من خصائص المقال الّتي تجلّت في هذا النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["وحدة الموضوع", "التّدرّج في الطّرح (منهجيّة: المقدّمة، العرض والخاتمة)", "تناسق الأفكار وتسلسلها", "عنصر الإقناع عن طريق التّوكيد",
                "الحبكة وتعدّد الشّخصيّات", "الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2, 3]}, ART_EXPL + " أمّا الحبكة والشّخصيّات والحوار فمن خصائص القصّة.", 1, "ar.literature.prose")
st("s13", "q5", "q5-e2", "matching", "عنصر الإقناع بالتّوكيد: طابق كلّ أداة بمثالها من النّصّ.",
   {"lefts": ["إنّ", "اسم التّفضيل", "لا النّافية"],
    "rights": ["«إنّها في لبّ التّعاون»", "«ألدّ أعداء الاستقلال»", "«فلا طبقات فوق طبقات»", "«بقوّة السّلاح»"]},
   {"pairs": [0, 1, 2]}, ART_EXPL + " (الأمثلة من النّصّ: «إنّها في لبّ التّعاون»، «ألدّ أعداء الاستقلال»، «فلا طبقات فوق طبقات»).", 0.5, "ar.literature.prose", "b")
st("s14", "q6", "q6-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["التّفسيريّ", "الوصفيّ", "السّرديّ", "الحواريّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ هو التّفسيريّ.", 1, "ar.text.type")
TYPE_EXPL = ("من مؤشّراته: تحليل فكرة أو ظاهرة بهدف تيسير فهمها وسهولة استيعابها… – استخدام ضمائر الغائب. التّمثيل: «فلا الإقطاع ولا الاستعمار جاء "
             "ليَخدِم بل ليُخدَم، ولا ليُعطي بل ليأخذ، ولا ليُريح بل ليستريح»؛ استخدام ضمير الغائب «هي» العائد على الخدمة في الفقرة الأولى، وعلى الجزائر في الفقرة الثّالثة.")
st("s15", "q6", "q6-e2", "mcq", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في النّصّ؟",
   {"options": ["تحليل فكرة أو ظاهرة بهدف تيسير فهمها وسهولة استيعابها", "تتابع الأحداث في تسلسل زمنيّ", "تبادل الحوار بين الشّخصيّات",
                "رسم المشاهد بالصّور والألوان"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s16", "q6", "q6-e3", "fill_blank", "أكمل مؤشّرًا آخر للنّمط التّفسيريّ:",
   {"text": "استخدام ضمائر ____.", "bank": ["الغائب", "المتكلّم", "المخاطب"]},
   {"blanks": [["الغائب"]]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s17", "q6", "q6-e4", "mcq", "أيّ العبارات الآتية تمثّل لتحليل الكاتب ظاهرةَ الاستعمار بهدف تيسير فهمها؟",
   {"options": ["«فلا الإقطاع ولا الاستعمار جاء ليخدم بل ليُخدم، ولا ليعطي بل ليأخذ»", "«ألا بورك الاستقلال»", "«وبُوركت هذه الذّكرى»"]},
   {"correct": 0}, TYPE_EXPL + " أمّا «ألا بورك…» و«وبوركت…» فدعاء لا تحليل.", 0.25, "ar.text.type")
st("s18", "q6", "q6-e5", "mcq", "مثّل لاستخدام ضمير الغائب: إلامَ يعود الضّمير «هي» في «الخدمة الّتي تفرضها طبيعة الإنسان على الإنسان هي نعمة»؟",
   {"options": ["على «الخدمة»", "على «طبيعة الإنسان»", "على «نعمة»", "على «الجزائر»"]},
   {"correct": 0}, TYPE_EXPL, 0.25, "ar.cohesion.reference")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ بأسلوب المترشّح الخاصّ", "text": "مقال ميخائيل نعيمة في ذكرى استقلال الجزائر (بكالوريا 2013، الشّعب العلميّة، الموضوع الثّاني)",
            "scheme": "مضمون النّصّ (01)، لغة وأسلوب المترشّح (0.5)، حجم النّصّ (0.5)", "model_example": None}
SUM_EXPL = "يُراعى في تلخيص مضمون النّصّ: مضمون النّصّ (01)، لغة وأسلوب المترشّح (0.5)، حجم النّصّ (0.5). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for sid, eid, crit, ind, pts in [("s19", "q7-e1", "المضمون", "الوفاء بمضمون النّصّ", 1), ("s20", "q7-e2", "اللّغة والأسلوب", "لغة المترشّح وأسلوبه الخاصّ", 0.5),
                                 ("s21", "q7-e3", "الحجم", "مراعاة حجم التّلخيص", 0.5)]:
    essay(sid, "q7", eid, "تلخيص مقال ميخائيل نعيمة", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FLD_EXPL = "الحقل السّياسيّ: الاستغلال – الاستعمار – الاستقلال؛ الحقل الاجتماعيّ: الخدمة – الأسرة البشريّة – التّعاون."
st("s22", "q8", "q8-e1", "multi", "أيّ الألفاظ الآتية تنتمي إلى الحقل السّياسيّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الاستغلال", "الاستعمار", "الاستقلال", "الخدمة", "الأسرة البشريّة", "التّعاون"]},
   {"correct": [0, 1, 2]}, FLD_EXPL, 0.75, "ar.cohesion.effect")
st("s23", "q8", "q8-e2", "mcq", "أيّ مجموعة تضمّ ألفاظ الحقل الاجتماعيّ؟",
   {"options": ["الخدمة – الأسرة البشريّة – التّعاون", "الاستغلال – الاستعمار – الاستقلال", "الخدمة – الاستعمار – التّعاون", "الأسرة البشريّة – الاستقلال – الاستغلال"]},
   {"correct": 0}, FLD_EXPL, 0.75, "ar.cohesion.effect")
st("s24", "q9", "q9-e1", "mcq", "ما إعراب «نقمة» في قوله: «ولكنّها تغدو نقمة»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "نعت منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«نقمةً»: حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها (كما في الإجابة النّموذجيّة).", 0.5, "ar.grammar.irab")
st("s25", "q9", "q9-e2", "mcq", "ما إعراب «إذْ» في قوله: «وإذ هبّت الشّعوب المغلوبة على أمرها»؟",
   {"options": ["ظرف زمان مبنيّ على السّكون في محلّ نصب على الظّرفيّة الزّمانيّة، وهو مضاف", "ظرف مكان مبنيّ على السّكون في محلّ نصب على الظّرفيّة المكانيّة",
                "حرف عطف مبنيّ على السّكون لا محلّ له من الإعراب", "اسم شرط جازم مبنيّ على السّكون في محلّ نصب"]},
   {"correct": 0}, "«إذْ»: ظرف زمان مبنيّ على السّكون في محلّ نصب على الظّرفيّة الزّمانيّة وهو مضاف.", 0.5, "ar.grammar.irab")
st("s26", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «هي نعمة» في الفقرة الأولى؟",
   {"options": ["جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ نصب حال", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة اسميّة في محلّ رفع نعت"]},
   {"correct": 0}, "(هي نعمة): جملة اسميّة في محلّ رفع خبر (للمبتدأ «الخدمة»).", 0.75, "ar.grammar.sentence_case")
st("s27", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «هو ألدّ أعداء الاستقلال» في الفقرة الثّالثة؟",
   {"options": ["جملة لا محلّ لها من الإعراب لأنّها صلة موصول", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ جرّ نعت", "جملة اسميّة في محلّ نصب حال"]},
   {"correct": 0}, "(هو ألدّ أعداء الاستقلال): جملة لا محلّ لها من الإعراب لأنّها صلة موصول (الّذي).", 0.75, "ar.grammar.sentence_case")
LNK_EXPL = ("الرّوابط الموجودة في العبارة: حرف العطف: الواو – حروف الجرّ: الباء، على، من – الضّمير المنفصل «هي» العائد على «الجزائر». "
            "وقد ساهمت في اتّساقها بـ: الرّبط ووصل الجمل فيما بينها – الجمع بين المترادفات – ترتيب المفردات والجمل حسب معانيها "
            "(يمكن للمترشّح أن يذكر أسبابًا أخرى للاتّساق والانسجام).")
st("s28", "q10", "q10-e1", "mcq", "ما حرف العطف الرّابط في العبارة «وها هي الجزائر تحتفل بذكرى استقلالها، وهي دائبة بإخلاص وعزم وإيمان…»؟",
   {"options": ["الواو", "الباء", "على", "هي"]},
   {"correct": 0}, LNK_EXPL, 0.5, "ar.cohesion.connectors")
st("s29", "q10", "q10-e2", "multi", "ما حروف الجرّ الرّابطة في العبارة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الباء", "على", "من", "الواو", "ها (التّنبيه)"]},
   {"correct": [0, 1, 2]}, LNK_EXPL, 0.5, "ar.cohesion.connectors")
st("s30", "q10", "q10-e3", "mcq", "على من يعود الضّمير المنفصل «هي» في قوله: «وهي دائبة بإخلاص وعزم وإيمان»؟",
   {"options": ["على «الجزائر»", "على «الذّكرى»", "على «رواسب الاستعمار»", "على «النّفوس»"]},
   {"correct": 0}, LNK_EXPL, 0.5, "ar.cohesion.reference")
st("s31", "q10", "q10-e4", "multi", "كيف ساهمت هذه الرّوابط في اتّساق العبارة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الرّبط ووصل الجمل فيما بينها", "الجمع بين المترادفات", "ترتيب المفردات والجمل حسب معانيها", "قطع الصّلة بين الجمل", "إدخال معانٍ متناقضة"]},
   {"correct": [0, 1, 2]}, LNK_EXPL, 0.75, "ar.cohesion.effect")
st("s32", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في «الخدمة… هي نعمة»؟",
   {"options": ["تشبيه بليغ", "تشبيه مرسل", "تشبيه تمثيليّ", "استعارة تصريحيّة"]},
   {"correct": 0}, "«الخدمة… هي نعمة»: تشبيه بليغ حيث ذكر المشبّه الخدمة والمشبّه به نعمة وحذف وجه الشّبه والأداة.", 0.25, "ar.rhetoric.simile")
st("s33", "q11", "q11-e1", "fill_blank", "أكمل شرح الصّورة في «الخدمة… هي نعمة»:",
   {"text": "تشبيه بليغ حيث ذكر المشبّه «____» والمشبّه به «____» وحذف وجه الشّبه و____.", "bank": ["الخدمة", "نعمة", "الأداة", "نقمة", "الإنسان"]},
   {"blanks": [["الخدمة"], ["نعمة"], ["الأداة"]]}, "تشبيه بليغ حيث ذكر المشبّه الخدمة والمشبّه به نعمة وحذف وجه الشّبه والأداة.", 0.5, "ar.rhetoric.simile", "b")
st("s34", "q11", "q11-e2", "mcq", "ما نوع الصّورة البيانيّة في «فكانت انتفاضة الجزائر…»؟",
   {"options": ["مجاز مرسل علاقته المكانيّة", "مجاز مرسل علاقته الجزئيّة", "مجاز مرسل علاقته السّببيّة", "تشبيه بليغ"]},
   {"correct": 0}, "«فكانت انتفاضة الجزائر…»: مجاز مرسل علاقته المكانيّة.", 0.5, "ar.rhetoric.style")
st("s35", "q11", "q11-e3", "mcq", "ما سرّ بلاغة التّشبيه في «الخدمة… هي نعمة»؟",
   {"options": ["لا فرق بين المشبّه والمشبّه به، مع إيضاح المعنى وبيان المراد والتّأثير في النّفس", "تقديم الحقيقة مصحوبة بالدّليل", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "سرّ بلاغة التّشبيه: لا فرق بين المشبّه والمشبّه به – إيضاح المعنى وبيان المراد – التّأثير في النّفس وتحريكها.", 0.25, "ar.rhetoric.effect")
st("s36", "q11", "q11-e4", "mcq", "ما سرّ بلاغة المجاز المرسل في «فكانت انتفاضة الجزائر…»؟",
   {"options": ["إيجاز الكلام والوصول إلى المعنى من أقرب طريق، والمساهمة في تقوية المعنى", "ادّعاء أنّ المشبّه هو عين المشبّه به",
                "إحداث جرس موسيقيّ بتوافق الفواصل", "تقديم الحقيقة مصحوبة بالدّليل"]},
   {"correct": 0}, "سرّ بلاغة المجاز المرسل: إيجاز الكلام والوصول إلى المعنى من أقرب طريق – المساهمة في تقوية المعنى…", 0.25, "ar.rhetoric.effect")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p2",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 2,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (ميخائيل نعيمة: في ذكرى استقلال الجزائر)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، الشّعب العلميّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
                  f"مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
                  "أسطر النّصّ في docx فقرات منفصلة فضُمّت بمسافة إلى فقرات الموضوع الرّسميّ الأربع. أُصلح من الموضوع الرّسميّ: «أومن» ← «أو من»، "
                  "و«مجلّة '\"لبلاغ\"» ← «مجلّة \"البلاغ\"». العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 3–4، ملفّ ممسوح قُرئ مصوّرًا). "
                  "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. «نقمة» حال في التّصحيح فلم يُجعل «خبر تغدو» مشتّتًا. "
                  "مؤجَّل (essay_builder): الرّأي في شرط الكاتب س4 (0.5؛ المنتظر الموافقة) والتّلخيص س7 (01 + 0.5 + 0.5)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
