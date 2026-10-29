"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (الشّاعر القرويّ، «قصور تُشيَّد فوق القصور»).
Exam (most faithful source): gdrive 1Ccdpghe_jqkSyPMIK6ZLZ4xpD78idSX_ (بكالوريا العربية 2013 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1UtHHZFFPsEdudJ-YmOYQFbc1bBCw8_nL;
official ONEC paper: gdrive 181G52CM0sU6BiUC9oE5gWp7hMrS5ptZb (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1xqlS4iCp0ZAFVbOGVXyigh1h_IgyIhyo (02_التصحيح.pdf, pages 1–2).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly, tatweel kept; only outer whitespace / edge direction marks trimmed; the poem table stores each verse
as [عجز, empty, «n- صدر»] ⇒ rows written [n-, صدر, عجز]) and re-checked programmatically against it. Part 2 Q5 is split
over two docx paragraphs («…مبينا نوعها» / «وبلاغتها.») and joined with a space. The docx was compared line by line
with the ONEC paper (rendered at 150 dpi, doubtful words at 300 dpi). Both PDFs are scans, so the mark scheme was read
from the rendered pages. Every mark comes from the official scheme; correct options and explanations condense it.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «آداب وفلسفة» ⇒ LIT.
- docx defects fixed from the ONEC paper: verse 5 عجز «وَنبطن الفقير» ⇒ «وَبطن الفقير»; verse 15 صدر «تنــاهبت من»
  ⇒ «تنــاهب من» (ONEC «تناهبَ»; Q2 quotes «تـناهبَ»; «تناهبت» breaks the metre); reference «"شعراؤنا ل عبد اللطيف»
  ⇒ «"شعراؤنا" لـ عبد اللطيف». Kept from the docx (spelling / layout variants): «اعــزّ» (ONEC «أعزّ»), «أ بالجدّ»,
  «الشرح اللغوي:» (ONEC heading «المعجم اللغوي:»), «(10 نقاط)», verse numbers «1-».
- Underlines (docx and ONEC): «جوعا» (ب12), «إذا» (ب16); bracketed sentences (حصلت هذا) ب7, (ضحك الناس ملء الثغور) ب16.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required
  distinct items, or distinct demands ⇒ one element per item.
- Q1 0.5 + 0.5. Q2 «3×0.5» for one continuous explanation (the scheme does not label the three parts) ⇒ one element of
  1.5 with three steps. Q3 «2×0.5» one element per emotion. Q4 0.5 «نعم» + «3×0.5» = exactly the three reasons listed
  (each with its verse) ⇒ three elements. Q5 0.5 the type + «2×0.75» two indicators among four ⇒ one element.
  «الحجاجيّ» and «الحواريّ/الإيعازيّ» are not used as type distractors (the poem argues and addresses the rich).
- Q6 (تلخيص رسالة الشّاعر) 01 التّركيز على المضمون / 01 لغة وأسلوب المترشّح / 0.5 الحجم ⇒ three deferred essay_builder elements.
- Part 2 Q1 «4×0.25» four words among the listed («جياع، الرّزايا، كسير، الطّوى») ⇒ one element. Q2 «3×0.5» = the
  collective noun (النّاس) / its singular (رجل, as the scheme says — «إنسان» is not used as a distractor) / the
  conclusion ⇒ three elements. Q3 «4×0.25» one per word / sentence. «جوعًا»: the scheme says «حال»; «تمييز» and
  «مفعول لأجله» (defensible readings) are deliberately NOT distractors. Q4 «2×0.25» type / purpose. Q5 «2×0.5» = the
  explanation with the type (استعارة مكنيّة) / its rhetoric. Q6 «2×0.5» = the answer (لا يمكن) / the reason (الوحدة العضويّة).
- Part 3 «4×01»: two content features + two form features, each with an example («يمكن للمترشّح أن يذكر خصائص أخرى
  تجسّدت في النّصّ» ⇒ distractors are features of other schools) ⇒ two elements of 2 (content / form).
- Deferred: Q6 summary (2.5). Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-lit-p1"
DOCX_ID = "1Ccdpghe_jqkSyPMIK6ZLZ4xpD78idSX_"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة اداب وفلسفة.docx"
PDF_ID = "1UtHHZFFPsEdudJ-YmOYQFbc1bBCw8_nL"
OFFICIAL_ID = "181G52CM0sU6BiUC9oE5gWp7hMrS5ptZb"
CORR_ID = "1xqlS4iCp0ZAFVbOGVXyigh1h_IgyIhyo"
SOURCE_STREAMS = ["LIT"]

# ── الموضوع الأوّل (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P1_POEM = [["1-", "قصور تُشيّد فوق القصور", "كــأن الخَوَرْنَـــق يَعلـــــو السّديـــــر"], ["2-", "تكاد تُزحزح صدر السماء", "وتبرز من فوقِ سطح الأثيــــر"], ["3-", "كفاكم صعودًا رجال اليسار", "وَجُودوا علـــينا بمــــال يسيـــر"], ["4-", "علوتم عن الأرض جدًا فمــــا", "رأَيتم من الأرض مــــاذا يصيـــر"], ["5-", "بطـــون صــــناديقكم أتخمت", "وَبطن الفقير كجيب الفقيــــر"], ["6-", "جســـوم يراها الطوى فاغتدى", "يُفتش باللمس عنهـــا البصيــــر"], ["7-", "تقــول: بجـدّي (حصلـت هـذا)", "أَيَشمل جــــدك كــــل الأمــــور"], ["8-", "أ بالجدّ تدفع شــــر الزلازل", "أو خـــطرَ البـــحر إمّــا يثــــور"], ["9-", "أ ليســت حياتـــك وهــي اعــزّ", "من المـــال طــوع العزيز القدير"], ["10-", "هب الجود إحدى الرزايا وجد", "تنـــل أجرَ مُعطٍ وأجــر صبـــور"], ["11-", "تذكـــر جــياعا ببـــر الشّــــام", "وبـــر الشـــام أعـــــز البـــــرور"], ["12-", "يــذوبون جـــوعا إلـــى بُلـغةٍ", "وتُـــولم بيــن الغـــدا والفطـــــور"], ["13-", "علــى كـل بـاع من الدرب أمٌّ", "بوجـــه كســـيف وقلــبٍ كســــير"], ["14-", "تنـادي النـدى من وراء البحار", "ومــا من مجــيب ولا من مُجـــير"], ["15-", "تنــاهب من صدرها توأمــان", "رضــيعٌ وجــوعٌ ففــــاز الأخــير"], ["16-", "أحــاسب ثغــري علــى بسمةٍ", "إذا (ضحك الناس ملء الثغــور)"], ["17-", "إذا لــم يكــن في البحار سبيلٌ", "إليــهم ســـلكت سبـــيل الشعـــور"]]
P1_REF = "«الشاعر القروي»\nمن كتاب: \"شعراؤنا\" لـ عبد اللطيف شرارة، ص93"
P1_GLOSS = "الشرح اللغوي:   الخورنق والسدير: قصران كانا في الحيرة.      البلغَة: ما يكفي من العيش ولا يفضل."
P1_QP = ["أوّلا- البناء الفكري: (10 نقاط)", "مَنِ المخَاطَبُ في النّص؟ وعلام يَحُثّه الشَّاعر؟", "ما المقصود بقول الشاعر: «تـناهبَ من صدرها توأمان        رضيع وجوعٌ، ففاز الأخير»؟", "في النص عاطفتان متباينتان. وضّحهما.", "هل يمكن أن تُدرج النّص ضمن الأدب الملتزم؟ علّل واستشهد من النّص.", "حَدد النمط الغالب على النّص، مبرزا مؤشرين من مؤشراته.", "النّص رسالة من الشاعر. لخّص مضمونها.", "ثانيا- البناء اللّغوي: (06 نقاط)", "مثّل لحقل المعاناة بأربع كلمات من النّص.", "استخرج من النص اسم جمع، ثم هات المفرد منه. ماذا تستنتج؟", "أعرب ما تحته خط إعراب مفردات وما بين قوسين إعراب جمل.", "ما نوع الأسلوب الوارد في البيت الحادي عشر؟ بيّن غرضه البلاغي.", "ما الصورة البيانية الواردة في العبارة التالية: (أ بالجد تَدفع شرّ الزلازل) وضحها مبينا نوعها وبلاغتها.", "هل يمكنك أن تقدّم وتؤخّر في الأبيات من 1 إلى 5 من القصيدة؟ علل.", "ثالثا- التّقويم النقدي: (04 نقاط)", "يبدو الشاعر من خلال النّص متأثرا بالمدرسة الرومنسية. أكّد هذا الحكم باستنباط أربع خصائص من خصائصها، اثنتين منها تتعلق بالشكل واثنتين بالمضمون، مع التمثيل من النّص."]

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

QP = P1_QP
assert len(P1_POEM) == 17 and QP[0].startswith("أوّلا") and QP[7].startswith("ثانيا") and QP[14].startswith("ثالثا") and len(QP) == 16
assert P1_POEM[11][1].startswith("يــذوبون جـــوعا") and P1_POEM[15][2].startswith("إذا (ضحك") and P1_POEM[6][1].endswith("(حصلـت هـذا)")
P1, P2, P3 = QP[0], QP[7], QP[14]
DOCS = [{"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": P1_POEM},
        {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
        {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P1_GLOSS}]

q("q1", "1", P1, QP[1], 1, [el("q1-e1", "المخاطَب في النّصّ", 0.5), el("q1-e2", "ما يحثّه عليه الشّاعر", 0.5)], DOCS)
q("q2", "2", P1, QP[2], 1.5, [el("q2-e1", "المقصود بقول الشّاعر (3×0.5)", 1.5)], DOCS)
q("q3", "3", P1, QP[3], 1, [el("q3-e1", "العاطفة الأولى (نحو الغنيّ البخيل)", 0.5), el("q3-e2", "العاطفة الثّانية (نحو الفقير المعوز)", 0.5)], DOCS)
q("q4", "4", P1, QP[4], 2, [el("q4-e1", "إدراج النّصّ ضمن الأدب الملتزم", 0.5), el("q4-e2", "التّعليل: قضيّة اجتماعيّة واقعيّة (ب1)", 0.5),
                             el("q4-e3", "التّعليل: اقتراح الحلّ (ب3)", 0.5), el("q4-e4", "التّعليل: دوام الانفعال والتّأثّر (ب16–17)", 0.5)], DOCS)
q("q5", "5", P1, QP[5], 2, [el("q5-e1", "النّمط الغالب", 0.5), el("q5-e2", "مؤشّران من مؤشّراته (2×0.75)", 1.5)], DOCS)
q("q6", "6", P1, QP[6], 2.5, [el("q6-e1", "التّلخيص: المضمون", 1), el("q6-e2", "التّلخيص: لغة وأسلوب المترشّح", 1), el("q6-e3", "التّلخيص: الحجم", 0.5)], DOCS)
q("q7", "1", P2, QP[8], 1, [el("q7-e1", "أربع كلمات من حقل المعاناة (4×0.25)", 1)], DOCS)
q("q8", "2", P2, QP[9], 1.5, [el("q8-e1", "اسم الجمع", 0.5), el("q8-e2", "مفرده", 0.5), el("q8-e3", "الاستنتاج", 0.5)], DOCS)
q("q9", "3", P2, QP[10], 1, [el("q9-e1", "إعراب «إذا» (ب16)", 0.25), el("q9-e2", "إعراب «جوعا» (ب12)", 0.25),
                              el("q9-e3", "محلّ جملة (حصّلت هذا) (ب7)", 0.25), el("q9-e4", "محلّ جملة (ضحك النّاس ملء الثّغور) (ب16)", 0.25)], DOCS)
q("q10", "4", P2, QP[11], 0.5, [el("q10-e1", "نوع الأسلوب", 0.25), el("q10-e2", "غرضه البلاغيّ", 0.25)], DOCS)
q("q11", "5", P2, QP[12], 1, [el("q11-e1", "توضيح الصّورة ونوعها", 0.5), el("q11-e2", "بلاغتها", 0.5)], DOCS)
q("q12", "6", P2, QP[13], 1, [el("q12-e1", "إمكان التّقديم والتّأخير", 0.5), el("q12-e2", "التّعليل", 0.5)], DOCS)
q("q13", "1", P3, QP[15], 4, [el("q13-e1", "خاصّيّتان من حيث المضمون مع التّمثيل (2×01)", 2), el("q13-e2", "خاصّيّتان من حيث الشّكل مع التّمثيل (2×01)", 2)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "مَن المخاطَب في النّصّ؟",
   {"options": ["الغنيّ البخيل", "الفقير المعوز", "الأمّ المرضعة", "أهل الشّام"]},
   {"correct": 0}, "المخاطَب في النّصّ هو الغنيّ البخيل.", 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "علامَ يحثّه الشّاعر؟",
   {"options": ["على ضرورة الجود ومساعدة الفقير", "على الادّخار وتنمية الثّروة", "على الهجرة إلى ما وراء البحار", "على تشييد القصور الشّاهقة"]},
   {"correct": 0}, "يحثّه على ضرورة الجود ومساعدة الفقير.", 0.5, "ar.comprehension.idea")
Q2_EXPL = ("العبارة تجسّد مدى عمق معاناة الأمّ الّتي تجاذبها ألمان: ألمها لمعاناة رضيعها المتضرّر جوعًا، وألم الجوع الّذي يمزّق أحشاءها "
           "فشغلها عن رضيعها.")
st("s03", "q2", "q2-e1", "mcq", "ما المقصود بقول الشّاعر: «تناهبَ من صدرها توأمان، رضيعٌ وجوعٌ، ففاز الأخير»؟",
   {"options": ["تجسيد مدى عمق معاناة الأمّ الّتي تجاذبها ألمان", "تصوير فرح الأمّ بتوأميها", "وصف كرم الأمّ مع الجياع", "تنافس طفلين توأمين على حضن أمّهما"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e1", "multi", "ما الألمان اللّذان تجاذبا الأمّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["ألمها لمعاناة رضيعها المتضرّر جوعًا", "ألم الجوع الّذي يمزّق أحشاءها", "ألمها لفقد زوجها في الحرب", "ألمها من برد الشّتاء"]},
   {"correct": [0, 1]}, Q2_EXPL, 0.5, "ar.comprehension.explain", "b")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل: مَن «الأخير» الّذي فاز؟",
   {"text": "فاز ____ الّذي يمزّق أحشاءها ف____ عن رضيعها.", "bank": ["الجوع", "شغلها", "الرّضيع", "قرّبها"]},
   {"blanks": [["الجوع"], ["شغلها"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain", "c")
EMO_EXPL = "العاطفتان: عاطفة إنكار وسخط على الغنيّ البخيل – عطف ورحمة على الفقير المعوز."
st("s06", "q3", "q3-e1", "mcq", "ما العاطفة الّتي يُظهرها الشّاعر نحو الغنيّ البخيل؟",
   {"options": ["عاطفة إنكار وسخط", "عاطفة إعجاب وتقدير", "عاطفة حنين وشوق", "عاطفة خوف ورهبة"]},
   {"correct": 0}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
st("s07", "q3", "q3-e2", "mcq", "وما العاطفة الّتي يُظهرها نحو الفقير المعوز؟",
   {"options": ["عطف ورحمة", "إنكار وسخط", "احتقار وازدراء", "لامبالاة"]},
   {"correct": 0}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
COM_EXPL = ("نعم يمكن أن يُدرج هذا النّصّ ضمن الأدب الملتزم. التّعليل: لأنّه عبّر عن قضيّة اجتماعيّة واقعيّة (البيت الأوّل) – حاول الشّاعر اقتراح "
            "الحلّ بحثّ الأغنياء على مساعدة الفقراء (البيت الثّالث) – الشّاعر دائم الانفعال والتّأثّر بما يجري في واقعه كما هو واضح في البيتين الأخيرين (16–17).")
st("s08", "q4", "q4-e1", "mcq", "هل يمكن أن يُدرج النّصّ ضمن الأدب الملتزم؟",
   {"options": ["نعم، يمكن إدراجه ضمن الأدب الملتزم", "لا، لأنّه من أدب الهروب إلى الطّبيعة", "لا، لأنّه شعر غزليّ ذاتيّ"]},
   {"correct": 0}, COM_EXPL, 0.5, "ar.literature.trend")
st("s09", "q4", "q4-e2", "mcq", "ما الّذي يجعل البيت الأوّل («قصور تُشيّد فوق القصور…») شاهدًا على التزام الشّاعر؟",
   {"options": ["أنّه عبّر عن قضيّة اجتماعيّة واقعيّة", "أنّه وصف جمال العمارة في الحيرة وصفًا فنّيًّا", "أنّه افتخر بأمجاد الملوك القدامى", "أنّه رثى القصور المهدّمة"]},
   {"correct": 0}, COM_EXPL, 0.5, "ar.literature.trend")
st("s10", "q4", "q4-e3", "mcq", "كيف حاول الشّاعر اقتراح الحلّ في البيت الثّالث («كفاكم صعودًا رجال اليسار…»)؟",
   {"options": ["بحثّ الأغنياء على مساعدة الفقراء", "بدعوة الفقراء إلى الثّورة على الأغنياء", "بمطالبة الحكّام بمصادرة الأموال", "بدعوة الفقراء إلى الهجرة"]},
   {"correct": 0}, COM_EXPL, 0.5, "ar.literature.trend")
st("s11", "q4", "q4-e4", "fill_blank", "أكمل التّعليل الثّالث:",
   {"text": "الشّاعر دائم ____ و____ بما يجري في واقعه كما هو واضح في البيتين الأخيرين (16–17).", "bank": ["الانفعال", "التّأثّر", "اللاّمبالاة", "الحياد"]},
   {"blanks": [["الانفعال"], ["التّأثّر"]]}, COM_EXPL, 0.5, "ar.literature.trend")
TYPE_EXPL = ("النّمط الغالب على النّصّ هو النّمط الوصفيّ. مؤشّراته: توظيف النّعوت والأحوال والأوصاف (يسير، كسيف، مجيب..) – توظيف الاستعارات والتّشبيهات "
             "(قصور… كأنّ الخورنق..) – الاعتماد على الجمل الاسميّة (قصور تُشيّد، جسوم يراها الطّوى) – توظيف الأفعال المضارعة الدّالّة على استمرار الحال "
             "(يذوبون، تنادي، يفتّش). يكتفي المترشّح بمؤشّرين فقط.")
st("s12", "q5", "q5-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["الوصفيّ", "السّرديّ", "التّفسيريّ"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s13", "q5", "q5-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط الوصفيّ بأمثلته من النّصّ.",
   {"lefts": ["توظيف النّعوت والأحوال والأوصاف", "توظيف الاستعارات والتّشبيهات", "الاعتماد على الجمل الاسميّة", "توظيف الأفعال المضارعة الدّالّة على استمرار الحال"],
    "rights": ["يسير، كسيف، مجيب", "قصور… كأنّ الخورنق", "قصور تُشيّد، جسوم يراها الطّوى", "يذوبون، تنادي، يفتّش", "هب الجود، جُد"]},
   {"pairs": [0, 1, 2, 3]}, TYPE_EXPL + " أمّا «هب الجود، جد» فأفعال أمر.", 1, "ar.text.type")
st("s14", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["توظيف النّعوت والأحوال والأوصاف", "الاعتماد على الجمل الاسميّة", "توظيف الأفعال المضارعة الدّالّة على استمرار الحال",
                "تتابع الأحداث في تسلسل زمنيّ", "استعمال أدوات الشّرح والتّفسير"]},
   {"correct": [0, 1, 2]}, TYPE_EXPL, 0.5, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون رسالة الشّاعر", "text": "قصيدة الشّاعر القرويّ (بكالوريا 2013، آداب وفلسفة، الموضوع الأوّل)",
            "scheme": "التّركيز على حثّ الشّاعر الأغنياء على الجود ومدّ يد المساعدة للفقير المعوز (01)، لغة وأسلوب المترشّح (01)، الحجم (0.5)", "model_example": None}
SUM_EXPL = "يُراعى في تلخيص رسالة الشّاعر: التّركيز على حثّ الشّاعر الأغنياء على الجود ومدّ يد المساعدة للفقير المعوز (01)، لغة وأسلوب المترشّح (01)، الحجم (0.5)."
for sid, eid, crit, ind, pts in [("s15", "q6-e1", "المضمون", "التّركيز على حثّ الشّاعر الأغنياء على الجود ومدّ يد المساعدة للفقير المعوز", 1),
                                 ("s16", "q6-e2", "اللّغة والأسلوب", "لغة المترشّح وأسلوبه", 1), ("s17", "q6-e3", "الحجم", "مراعاة حجم التّلخيص", 0.5)]:
    essay(sid, "q6", eid, "تلخيص رسالة الشّاعر القرويّ", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FLD_EXPL = "أربع كلمات تنتمي إلى حقل المعاناة: جياع، الرّزايا، كسير، الطّوى."
st("s18", "q7", "q7-e1", "multi", "مثّل لحقل المعاناة: أيّ الكلمات الآتية من النّصّ تنتمي إليه؟ (اختر كلّ ما يصحّ)",
   {"options": ["جياع", "الرّزايا", "كسير", "الطّوى", "قصور", "الأثير", "مال"]},
   {"correct": [0, 1, 2, 3]}, FLD_EXPL + " أمّا «قصور، الأثير، مال» فلا تنتمي إليه.", 0.75, "ar.cohesion.effect")
st("s19", "q7", "q7-e1", "fill_blank", "أكمل من النّصّ كلمة من حقل المعاناة:",
   {"text": "«بوجهٍ كسيفٍ وقلبٍ ____»", "bank": ["كسير", "سعيد", "كبير"]},
   {"blanks": [["كسير"]]}, FLD_EXPL, 0.25, "ar.cohesion.effect", "b")
COL_EXPL = "اسم الجمع: النّاس – مفرده: رجل. أستنتج أنّ اسم الجمع لا مفرد له من جنس لفظه."
st("s20", "q8", "q8-e1", "mcq", "استخرج من النّصّ اسم جمع:",
   {"options": ["النّاس", "البحار", "الرّزايا", "جياعا"]},
   {"correct": 0}, COL_EXPL + " أمّا «البحار، الرّزايا، جياع» فجموع تكسير.", 0.5, "ar.morphology")
st("s21", "q8", "q8-e2", "mcq", "هات مفرد «النّاس» كما في الإجابة النّموذجيّة:",
   {"options": ["رجل", "رجال", "قوم", "أناسيّ"]},
   {"correct": 0}, COL_EXPL + " («رجال» و«أناسيّ» جمعان، و«قوم» اسم جمع.)", 0.5, "ar.morphology")
st("s22", "q8", "q8-e3", "fill_blank", "ماذا تستنتج؟",
   {"text": "أستنتج أنّ اسم الجمع لا ____ له من جنس ____.", "bank": ["مفرد", "لفظه", "جمع", "معناه"]},
   {"blanks": [["مفرد"], ["لفظه"]]}, COL_EXPL, 0.5, "ar.morphology")
st("s23", "q9", "q9-e1", "mcq", "ما إعراب «إذا» في قوله: «إذا ضحك النّاس ملء الثّغور» (ب16)؟",
   {"options": ["ظرف لما يستقبل من الزّمان متضمّن معنى الشّرط، خافض لشرطه متعلّق بجوابه، وهو مضاف", "حرف شرط جازم مبنيّ على السّكون لا محلّ له من الإعراب",
                "حرف مفاجأة مبنيّ على السّكون لا محلّ له من الإعراب", "ظرف لما مضى من الزّمان مبنيّ على السّكون في محلّ نصب"]},
   {"correct": 0}, "«إذا»: ظرف لما يستقبل من الزّمان متضمّن معنى الشّرط، خافض لشرطه متعلّق بجوابه، وهو مضاف.", 0.25, "ar.grammar.irab")
st("s24", "q9", "q9-e2", "mcq", "ما إعراب «جوعًا» في قوله: «يذوبون جوعًا إلى بُلغةٍ» (ب12)؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة", "مفعول به منصوب وعلامة نصبه الفتحة", "مفعول مطلق منصوب وعلامة نصبه الفتحة", "خبر منصوب وعلامة نصبه الفتحة"]},
   {"correct": 0}, "«جوعًا»: حال منصوبة وعلامة نصبها الفتحة (كما في الإجابة النّموذجيّة).", 0.25, "ar.grammar.irab")
st("s25", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (حصّلت هذا) في قوله: «تقول: بجدّي (حصّلت هذا)» (ب7)؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة جواب شرط لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(حصّلت هذا): جملة مقول القول في محلّ نصب مفعول به.", 0.25, "ar.grammar.sentence_case")
st("s26", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (ضحك النّاس ملء الثّغور) في البيت السّادس عشر؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب حال", "جملة جواب الشّرط لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(ضحك النّاس): جملة فعليّة في محلّ جرّ مضاف إليه (بعد «إذا»).", 0.25, "ar.grammar.sentence_case")
STY_EXPL = "أسلوب البيت الحادي عشر (تذكّر جياعًا..) إنشائيّ بصيغة الأمر، غرضه استعطاف الأغنياء وحثّهم على الإحسان إلى الفقراء."
st("s27", "q10", "q10-e1", "mcq", "ما نوع الأسلوب الوارد في البيت الحادي عشر («تذكّر جياعًا ببرّ الشّام…»)؟",
   {"options": ["إنشائيّ بصيغة الأمر", "إنشائيّ بصيغة النّهي", "إنشائيّ بصيغة الاستفهام", "خبريّ مؤكّد"]},
   {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s28", "q10", "q10-e2", "mcq", "ما الغرض البلاغيّ للأمر في البيت الحادي عشر؟",
   {"options": ["استعطاف الأغنياء وحثّهم على الإحسان إلى الفقراء", "التّعجيز", "التّهديد والوعيد", "التّمنّي"]},
   {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
IMG_EXPL = ("الصّورة البيانيّة في (تدفعُ شرَّ الزّلازل): شُبّهت الزّلازل بشيء يُدفع، فحُذف المشبّه به وأُشير إلى صفته وهي الدّفع، ونوعها استعارة مكنيّة. "
            "وبلاغتها: تحقّق الجمال الفنّيّ وتنشّط الخيال للبحث عن المعنى المقوّى من خلالها، وهو ضعف الإنسان أمام قوّة الزّلازل.")
st("s29", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في «أ بالجدّ تدفع شرّ الزّلازل»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s30", "q11", "q11-e1", "fill_blank", "أكمل توضيح الصّورة:",
   {"text": "شُبّهت ____ بشيء يُدفع، فحُذف المشبّه به وأُشير إلى صفته وهي ____.", "bank": ["الزّلازل", "الدّفع", "البحر", "الجدّ"]},
   {"blanks": [["الزّلازل"], ["الدّفع"]]}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor", "b")
st("s31", "q11", "q11-e2", "mcq", "ما بلاغة الصّورة في «أ بالجدّ تدفع شرّ الزّلازل»؟",
   {"options": ["تحقّق الجمال الفنّيّ وتنشّط الخيال للبحث عن المعنى المقوّى، وهو ضعف الإنسان أمام قوّة الزّلازل", "تقديم الحقيقة مصحوبة بالدّليل",
                "الإيجاز بحذف أداة التّشبيه ووجه الشّبه", "إحداث جرس موسيقيّ بتكرار الحروف"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
ORD_EXPL = "لا يمكن التّقديم والتّأخير بين أبيات القصيدة. التّعليل: لأنّ الشّاعر اعتمد الوحدة العضويّة."
st("s32", "q12", "q12-e1", "mcq", "هل يمكنك أن تقدّم وتؤخّر في الأبيات من 1 إلى 5 من القصيدة؟",
   {"options": ["لا يمكن التّقديم والتّأخير بين أبيات القصيدة", "نعم، يمكن ذلك دون أن يتأثّر المعنى", "نعم، لأنّ كلّ بيت مستقلّ بمعناه"]},
   {"correct": 0}, ORD_EXPL, 0.5, "ar.literature.renewal")
st("s33", "q12", "q12-e2", "mcq", "علّل عدم إمكان التّقديم والتّأخير بين هذه الأبيات.",
   {"options": ["لأنّ الشّاعر اعتمد الوحدة العضويّة", "لأنّ الشّاعر التزم وحدة البيت واستقلاله", "لأنّ الأبيات من بحور مختلفة", "لأنّ القصيدة بلا قافية موحّدة"]},
   {"correct": 0}, ORD_EXPL, 0.5, "ar.literature.renewal")
# ── ثالثًا: التّقويم النّقديّ ──
ROM_EXPL = ("من خصائص المدرسة الرّومنسيّة في النّصّ: أ- من حيث المضمون: الدّفاع عن الضّعفاء والتّوق إلى عالم أفضل تسوده مبادئ العدل والمساواة "
            "(الأبيات: 10، 11 و12) – الإغراق في الغنائيّة والتّعبير عن العواطف والانفعالات (البيتان 16 و17). ب- من حيث الشّكل: سهولة اللّغة وجمال التّعبير "
            "لما تحويه من جمال التّصوير (جسوم يراها الطّوى) – توظيف مظاهر الطّبيعة لتجسيد المعاني (السّماء، البحار، الأثير، الأرض…). "
            "(يمكن للمترشّح أن يذكر خصائص أخرى تجسّدت في النّصّ.)")
st("s34", "q13", "q13-e1", "multi", "أيّ ممّا يلي من خصائص المدرسة الرّومنسيّة المتعلّقة بالمضمون والمتجسّدة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الدّفاع عن الضّعفاء والتّوق إلى عالم أفضل تسوده مبادئ العدل والمساواة", "الإغراق في الغنائيّة والتّعبير عن العواطف والانفعالات",
                "مدح الحكّام والإشادة بأمجادهم", "الفخر بالقبيلة والأنساب"]},
   {"correct": [0, 1]}, ROM_EXPL, 1, "ar.literature.features")
st("s35", "q13", "q13-e1", "matching", "طابق كلّ خاصّيّة مضمونيّة بموضع التّمثيل لها من النّصّ.",
   {"lefts": ["الدّفاع عن الضّعفاء والتّوق إلى عالم أفضل", "الإغراق في الغنائيّة والتّعبير عن العواطف"],
    "rights": ["الأبيات 10، 11 و12", "البيتان 16 و17", "البيت الأوّل"]},
   {"pairs": [0, 1]}, ROM_EXPL, 1, "ar.literature.features", "b")
st("s36", "q13", "q13-e2", "multi", "أيّ ممّا يلي من خصائص المدرسة الرّومنسيّة المتعلّقة بالشّكل والمتجسّدة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["سهولة اللّغة وجمال التّعبير لما تحويه من جمال التّصوير", "توظيف مظاهر الطّبيعة لتجسيد المعاني",
                "الإغراق في الصّناعة اللّفظيّة والمحسّنات المتكلّفة", "توظيف الرّموز والأساطير الإغريقيّة"]},
   {"correct": [0, 1]}, ROM_EXPL, 1, "ar.literature.features")
st("s37", "q13", "q13-e2", "matching", "طابق كلّ خاصّيّة شكليّة بمثالها من النّصّ.",
   {"lefts": ["سهولة اللّغة وجمال التّصوير", "توظيف مظاهر الطّبيعة لتجسيد المعاني"],
    "rights": ["«جسوم يراها الطّوى»", "السّماء، البحار، الأثير، الأرض", "الخورنق والسّدير"]},
   {"pairs": [0, 1]}, ROM_EXPL, 1, "ar.literature.features", "b")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (الشّاعر القرويّ: قصور تُشيَّد فوق القصور)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
                  f"مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
                  "أُصلح من الموضوع الرّسميّ: «وَنبطن» ← «وَبطن» (ب5)، «تنــاهبت» ← «تنــاهب» (ب15)، «\"شعراؤنا ل» ← «\"شعراؤنا\" لـ». "
                  "العلامات من الإجابة النّموذجيّة الرّسميّة (الصّفحتان 1–2، ملفّ ممسوح قُرئ مصوّرًا). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
                  "مؤجَّل (essay_builder): التّلخيص س6 (01 + 01 + 0.5)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
