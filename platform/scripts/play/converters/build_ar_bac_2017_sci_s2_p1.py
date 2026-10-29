"""Conversion: BAC 2017 (الدّورة الثّانية = «الدّورة الاستثنائيّة» on the ONEC paper) – اللّغة العربيّة وآدابها – الشّعب العلميّة –
الموضوع الأوّل (محمّد بوزيدي، قصيدة في جيش التّحرير بعد معركة «عين الزّانة»).
2017 had two sessions; this set is the SECOND one (the ONEC header says «الدّورة الاستثنائيّة: 2017»); session 1 is ar-bac-2017-*-s1-*.
Exam (most faithful source): gdrive 1yvUlkemdMO36y9O88TROEP1rYclLljCK (يكالوريا العربية 2017 شعبة علوم الدورة الثانية.docx);
same paper as PDF (owner's copy): gdrive 1c5a5t7T4tVqEwjSxd9DPaZ6vfreq6v2e (BAC 2017 - الدورة 2 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1QfWwNhUkIBvVCfgtGwOdE1NMOFZWk7XE (01_الدورة_الاستثنائية_الموضوع.pdf, pages 1–2 — read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1bYtR3zX_sV7wU5ej3cT52OihvVblnexU (02_الدورة_الاستثنائية_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2019–2023 converters): the verbatim strings below (intro, poem, reference, glossary, question
texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer whitespace / edge
direction marks trimmed) and re-checked programmatically against it; the docx was compared line by line with the ONEC
paper. The correction PDF's text layer is reversed presentation-form Arabic, so the mark scheme was read from the
rendered pages (150 dpi, fully legible). Every mark comes from the official scheme; correct options and explanations
condense its wording.

Conversion notes / points for the owner's review:
- Streams: the ONEC paper and the correction header list «علوم تجريبيّة، رياضيات، تسيير واقتصاد، تقني رياضي» ⇒ SCI, MATH, TM, GE.
- docx defects fixed from the ONEC paper: the poem cell of verse 7 holds a second, clipped paragraph «قل للتنيلكةٍ إتنا عند
  الوغى» (a retyping leftover, not on the ONEC paper) ⇒ dropped. The docx table stores each verse as [عجز, empty, «n-صدر»]
  ⇒ rows written [n-, صدر, عجز]. The intro paragraph starts with the label «النّـــــص:» ⇒ label dropped (neutral caption).
  Headings: docx «الشرح اللغوي» / «(12 نقاط)» vs ONEC «شرح الكلمات» / «(12 نقطة)»; diacritics differ slightly ⇒ docx kept.
- Underlines: ONEC underlines «العرين» (ب3) and «باسمين» (ب8) (docx: only «باسمين»); the question names both words.
- Rule used for «n×m» lines: n×m over an unordered list of interchangeable items (the candidate may give any n of the
  listed items) ⇒ one element; n×m over distinct demanded parts (per word / per verse / per image) ⇒ one element per part.
- Q1 «3×01»: the addressee / what he asks of him / whom he is proud of ⇒ three elements.
- Q2 «3×0.50» three expressions (five listed, «كثيرة منها») ⇒ one element of 1.5; «1×1.50» what they added ⇒ one element.
- Q3 «1×01» definition + «4×0.50» four manifestations (five listed; «يكتفي المترشّح بذكر أربعة مظاهر») ⇒ one element of 2.
- Q4 (تلخيص) «3×01» = الدّلالة على المضمون / تقنية التّلخيص / سلامة اللّغة ⇒ three deferred essay_builder elements
  (the scheme gives no model summary).
- Part 2 Q1 «4×0.25»: four words of the field (six listed; «ثوارنا» of the scheme is not in the poem — «ثوراتنا» / «ثُوّرا»)
  ⇒ one element of 1; steps use only listed words that are in the poem.
- Part 2 Q2 «4×0.5» = «العرين»، «باسمين»، (طف به)، (أن يتأخّرا) ⇒ four elements. «خبر» / «عطف بيان» / «نعت» are not used
  as distractors for «العرين» (arguable analyses), nor «صلة الموصول الحرفيّ» for (أن يتأخّرا).
- Part 2 Q3 «1×01» the reason for mixing خبر/إنشاء + «2×0.25» the two types + «2×0.25» the two purposes ⇒ five elements.
- Part 2 Q4 «3×0.50» per image (explanation, type, effect) ⇒ six elements. The scheme heads the second image «الصّورة
  البيانيّة في البيت السّابع» although «واستنجد الإيمان» is in verse 6 (as the question says) ⇒ verse 6 used.
- Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1yvUlkemdMO36y9O88TROEP1rYclLljCK"
PDF_ID = "1c5a5t7T4tVqEwjSxd9DPaZ6vfreq6v2e"
OFFICIAL_ID = "1QfWwNhUkIBvVCfgtGwOdE1NMOFZWk7XE"
CORR_ID = "1bYtR3zX_sV7wU5ej3cT52OihvVblnexU"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الأوّل (مولَّد من docx) ──
P1_INTRO = 'ألقى الشّاعر الجزائريّ "محمد بوزيدي" هذه القصيدة على فيالق جيش التحرير الوطنيّ سنة 1959م بعد انتصارهم في معركة "عين الزّانة" على الحدود التونسيّة:'
P1_POEM = [['1-', 'قــــــــمْ للجـــزائر حَـــيِّ جــيشًـــا أغْـــــــــــــــبرا', 'والْــــــــــعَنْ هنـــــاك الطَّـــــــاغيَ المستــــــعــــمِرا'], ['2-', 'ردّد نشــيدك في الزّمـــان و(طـُفْ بــه)', 'فــــــوق الدُّنــــى، واجـــعل سمــــاءك مِــــــنبَــرا'], ['3-', 'ذاك العــريـــــــــــنُ وكــــمْ بــــــــه مـــن قسْــوَرٍ', 'شــــــــرس هــــــصورٍ لا يلـــــــــين غَضـــــــنفَرا'], ['4-', 'عــــــاف الحيــــــــــاة ومجّهـــــــــــا مذلـــــــــــــولة', 'فانـــــــصبّ مخـــــــــــلبـــــــــه علــــى أن يثــــــــــأرا'], ['5-', 'جـــــــــيشُ الجـــــزائر بالشــهـــــيد يمينُنــــــــــا', 'قسمًــــــــــــا بـــــــــــــــــه فدمــــــــــــــــــاؤه لــــن تُــــــــــهدرا'], ['6-', 'واســــــتنجد الإيــــــمان وهــــو ســـــــــلاحـــه', 'فأبــــى لـــــــه الإيمـــــــــــــان (أن يَتــــــــــــأخَّرا)'], ['7-', 'أوراس قـــــــــد نطـــــحَ السَّحــابَ ولم يزل', 'فــــــي المجــــــــد يفتــــرش السَّمَــــــا والنَّــيِّـــــــــرا'], ['8-', 'قــــل للدّنــــــيئةِ إنّــــــنا عنـــــــــدَ الـــــــــــوغى', 'نغشــــــــى الكــــريهة بَاسِمـــــــــــينَ تجبُّــــــــــــرا'], ['9-', 'نحــــن الذيــن مـــــن الأميــــــــــر ليــــومنا', 'حــــــــــربٌ علـــــــــيكم ناقـمــــــــــــــــــين وثُـــــــــــــــــوَّرا'], ['10-', 'أحــــرارُنــــــــا، ثــــــوْراتنـــــا، صرخاتنـــــــــــــا', 'دَوَّتْ فــــــــــأيقــــــظتِ الدُّنـــــــــى والأعصــــــــرا'], ['11-', 'صـحراؤنـــا، بـــــــترولنــــــا، خـــــــيراتُنــــا', 'نــــــــأبــى لهـــــــــا التَّقســـــــيم حتــــــى نُقبــــــــــــــــرا'], ['12-', 'إنَّــــا عــــزمْنــــــا لا نــــحُـــطُّ ســـــلاحنـــا', 'حتَّــــــى نـــــــــــرى تُــــــرْبَ الجــــــزائرِ حُــــــــــــــرّرا']]
P1_REF = 'المرجع: صوت الجزائر- شعر- محمد بوزيدي\nص67-68 المكتبة الوطنية الجزائرية. 1997'
P1_GLOSS = 'الشرح اللغوي:   أغبرا: علاه الغبار بفعل نشاطه.   العرين: بيت الأسد.   القسْور، الهَصور، الغضنفر: من أسماء الأسد. النيّر: المضيء، ويقصد به الكواكب والنّجوم.    الدّنيئة: الحقيرة ويقصد بها فرنسا.'
P1_QP = ['أوّلا- البناء الفكري: (12 نقاط)', 'من يخاطب الشّاعر في النصّ؟ ماذا يطلب منه؟ وبمن يفتخر؟', 'نبرة التحدّي جليّة في القصيدة، حدّد العبارات والرّموز الدّالّة عليها، وماذا أضافت هذه الرُّموز؟', 'يبدو الشّاعر من خلال النّص ملتزما، عرّف الظَّاهرة مستدلاًّ عليها بأربعة مظاهر من مضمون\nالنّص.', 'لخّص مضمون القصيدة بأسلوبك الخاصّ، مراعيًا تقنية التَّلخيص.', 'ثانيا- البناء اللّغوي: (08 نقاط)', 'في النّص حقلٌ دلاليّ يدل على بسالة جيش الثّورة. مثّل له بأربع كلمات.', 'الإعراب:\nأعرب الكلمتين الآتيتين إعرابَ إفرادٍ: "العرين" في الشّطر الأوّل من البيت الثالث.\n"باسِمين" في الشّطر الثاني من البيت الثّامن.\nأعرب إعراب جمل العبارتين الآتيتين: "طُفْ به" الواقعة في الشّطر الأول من البيت الثاني.\n"أن يتأخّرا" الواقعة في الشّطر الثّاني من البيت السّادس.', 'علل مُزاوجة الشاعر بين الأسلوبين: الخبري والإنشائي، مبيّنا نوعي أسلوبي البيتين الثاني والثالث\nمبرزا غرضيهما البلاغي.', 'في العبارتين الآتيتين صورتان بيانيتان، اشرحهما، مبيّنا نوعيهما، وسرّ بلاغتيهما:\n"قم للجزائر" في الشّطر الأول من البيت الأوّل.\n"واستنجَد الإيمان" في الشّطر الأول من البيت السّادس.']


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


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
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
        assert abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
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

TEXT_DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": P1_INTRO},
    {"id": "d-poem", "kind": "table", "caption": "النّصّ", "table": P1_POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P1_GLOSS},
]
QP = P1_QP
P1, P2 = QP[0], QP[5]

q("q1", "1", P1, QP[1], 3, [el("q1-e1", "المخاطَب في النّصّ", 1), el("q1-e2", "ما يطلبه الشّاعر منه", 1), el("q1-e3", "بمن يفتخر الشّاعر", 1)], TEXT_DOCS)
q("q2", "2", P1, QP[2], 3, [el("q2-e1", "العبارات والرّموز الدّالّة على التّحدّي (3×0.5)", 1.5), el("q2-e2", "ما أضافته هذه الرّموز", 1.5)], TEXT_DOCS)
q("q3", "3", P1, QP[3], 3, [el("q3-e1", "تعريف الالتزام", 1), el("q3-e2", "أربعة مظاهر للالتزام في النّصّ (4×0.5)", 2)], TEXT_DOCS)
q("q4", "4", P1, QP[4], 3, [el("q4-e1", "التّلخيص: الدّلالة على المضمون", 1), el("q4-e2", "التّلخيص: تقنية التّلخيص", 1),
                             el("q4-e3", "التّلخيص: سلامة اللّغة", 1)], TEXT_DOCS)
q("q5", "1", P2, QP[6], 1, [el("q5-e1", "أربع كلمات من حقل بسالة جيش الثّورة (4×0.25)", 1)], TEXT_DOCS)
q("q6", "2", P2, QP[7], 2, [el("q6-e1", "إعراب «العرين» (ب3)", 0.5), el("q6-e2", "إعراب «باسمين» (ب8)", 0.5),
                             el("q6-e3", "محلّ جملة (طف به) (ب2)", 0.5), el("q6-e4", "محلّ جملة (أن يتأخّرا) (ب6)", 0.5)], TEXT_DOCS)
q("q7", "3", P2, QP[8], 2, [el("q7-e1", "تعليل المزاوجة بين الخبر والإنشاء", 1), el("q7-e2", "نوع أسلوب البيت الثّاني", 0.25),
                             el("q7-e3", "نوع أسلوب البيت الثّالث", 0.25), el("q7-e4", "غرض أسلوب البيت الثّاني", 0.25),
                             el("q7-e5", "غرض أسلوب البيت الثّالث", 0.25)], TEXT_DOCS)
q("q8", "4", P2, QP[9], 3, [el("q8-e1", "«قم للجزائر»: الشّرح", 0.5), el("q8-e2", "«قم للجزائر»: النّوع", 0.5), el("q8-e3", "«قم للجزائر»: سرّ البلاغة", 0.5),
                             el("q8-e4", "«واستنجد الإيمان»: الشّرح", 0.5), el("q8-e5", "«واستنجد الإيمان»: النّوع", 0.5),
                             el("q8-e6", "«واستنجد الإيمان»: سرّ البلاغة", 0.5)], TEXT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "من يخاطب الشّاعر في النّصّ؟",
   {"options": ["الشّعب الجزائريّ", "الشّعوب العربيّة", "الأمير عبد القادر", "سكّان الحدود التّونسيّة"]},
   {"correct": 0}, "المخاطَب في النّصّ هو: الشّعب الجزائريّ.", 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "multi", "ماذا يطلب الشّاعر من الشّعب الجزائريّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["مؤازرة جيش التّحرير الوطنيّ", "تحدّي فرنسا والتّصدّي لمؤامراتها", "التّمسّك بالوحدة أرضًا وشعبًا",
                "مهادنة المستعمر والقبول بالتّقسيم", "الهجرة إلى ما وراء الحدود"]},
   {"correct": [0, 1, 2]}, "يطلب منه مؤازرة جيش التّحرير الوطنيّ، وتحدّي فرنسا، والتّصدّي لمؤامراتها، والتّمسّك بالوحدة أرضًا وشعبًا.", 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل ما يطلبه الشّاعر من الشّعب الجزائريّ:",
   {"text": "يطلب منه ____ جيش التّحرير الوطنيّ، وتحدّي ____ والتّصدّي لمؤامراتها، والتّمسّك بالوحدة ____ وشعبًا.",
    "bank": ["مؤازرة", "فرنسا", "أرضًا", "مهادنة", "تونس", "لغةً"]},
   {"blanks": [["مؤازرة"], ["فرنسا"], ["أرضًا"]]}, "«ويطلب منه مؤازرة جيش التّحرير الوطنيّ، وتحدّي فرنسا، والتّصدّي لمؤامراتها، والتّمسّك بالوحدة أرضًا وشعبًا».", 0.5, "ar.comprehension.details", "b")
st("s04", "q1", "q1-e3", "mcq", "بمن يفتخر الشّاعر في القصيدة؟",
   {"options": ["بجيش التّحرير الوطنيّ وانتصاراته", "بنسبه وقبيلته", "بجمال طبيعة الجزائر", "بقوّة فرنسا وعتادها"]},
   {"correct": 0}, "يفتخر الشّاعر باعتزازه بانتصارات جيش التّحرير الوطنيّ.", 1, "ar.comprehension.details")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل بعض العبارات الدّالّة على نبرة التّحدّي في القصيدة:",
   {"text": "«والعن هناك ____ المستعمرا» – «إنّا عزمنا لا نحطّ ____» – «صحراؤنا… نأبى لها ____»",
    "bank": ["الطّاغيَ", "سلاحنا", "التّقسيم", "الغازيَ", "رماحنا", "التّحرير"]},
   {"blanks": [["الطّاغيَ"], ["سلاحنا"], ["التّقسيم"]]}, "من العبارات والرّموز الدّالّة على التّحدّي (وهي كثيرة): (والعن هناك الطّاغي المستعمرا) – (إنّنا عند الوغى نغشى الكريهة) – (نحن… حربٌ عليكم ناقمين وثُوّرا) – (صحراؤنا… نأبى لها التّقسيم) – (إنّا عزمنا لا نحطّ سلاحنا…).", 0.75, "ar.comprehension.evidence")
st("s06", "q2", "q2-e1", "fill_blank", "أكمل عبارتين أخريين دالّتين على نبرة التّحدّي:",
   {"text": "«إنّنا عند الوغى نغشى ____» – «نحن… ____ عليكم ناقمين وثُوّرا»", "bank": ["الكريهة", "حربٌ", "المنيّة", "سِلمٌ"]},
   {"blanks": [["الكريهة"], ["حربٌ"]]}, "من العبارات الدّالّة على التّحدّي: (إنّنا عند الوغى نغشى الكريهة) – (نحن… حربٌ عليكم ناقمين وثُوّرا).", 0.75, "ar.comprehension.evidence", "b")
st("s07", "q2", "q2-e2", "mcq", "ماذا أضافت عبارات التّحدّي ورموزه إلى القصيدة؟",
   {"options": ["رسّخت معاني القوّة والبطولة والفروسيّة لدى جيش التّحرير الوطنيّ في تحدّيه للمستعمر الدّنيء",
                "أظهرت ضعف جيش التّحرير أمام عتاد المستعمر", "دعت إلى الصّلح مع المستعمر وطيّ صفحة الحرب", "صوّرت جمال الطّبيعة في جبال الأوراس"]},
   {"correct": 0}, "أضافت هذه العبارات والرّموز ترسيخ معاني القوّة والبطولة والفروسيّة لدى جيش التّحرير الوطنيّ في تحدّيه للمستعمر الدّنيء.", 0.75, "ar.comprehension.explain")
st("s08", "q2", "q2-e2", "multi", "اختر المعاني الّتي رسّختها عبارات التّحدّي ورموزه لدى جيش التّحرير. (اختر كلّ ما يصحّ)",
   {"options": ["القوّة", "البطولة", "الفروسيّة", "الاستسلام", "التّردّد"]},
   {"correct": [0, 1, 2]}, "«ترسيخ معاني القوّة، والبطولة، والفروسيّة لدى جيش التّحرير الوطنيّ في تحدّيه للمستعمر الدّنيء».", 0.75, "ar.comprehension.explain", "b")
st("s09", "q3", "q3-e1", "mcq", "ما مفهوم الالتزام في الأدب؟",
   {"options": ["أن يسخّر الأديب قلمه من أجل معالجة قضايا ومشكلات مجتمعه وأمّته وإنسانيّته الّتي تحول دون مسيرة التّقدّم والتّطوّر والازدهار، واقتراح الحلول الفاعلة والجذريّة لها",
                "أن يلتزم الأديب بقواعد العروض ووحدة الوزن والقافية", "أن يعبّر الأديب عن ذاته وعواطفه الفرديّة بعيدًا عن قضايا مجتمعه",
                "أن يحاكي الأديب القدماء في أغراضهم وأساليبهم"]},
   {"correct": 0}, "تعريف الالتزام: هو أن يسخّر الأديب قلمه من أجل معالجة قضايا ومشكلات مجتمعه وأمّته وإنسانيّته الّتي تحول دون مسيرة التّقدّم والتّطوّر والازدهار، واقتراح الحلول الفاعلة والجذريّة لها.", 0.5, "ar.literature.trend")
st("s10", "q3", "q3-e1", "fill_blank", "أكمل تعريف الالتزام:",
   {"text": "الالتزام هو أن يسخّر الأديب ____ من أجل معالجة قضايا ومشكلات مجتمعه وأمّته وإنسانيّته، و____ الحلول الفاعلة والجذريّة لها.",
    "bank": ["قلمه", "اقتراح", "ماله", "تجاهل"]},
   {"blanks": [["قلمه"], ["اقتراح"]]}, "«هو أن يسخّر الأديب قلمه من أجل معالجة قضايا ومشكلات مجتمعه وأمّته وإنسانيّته… واقتراح الحلول الفاعلة والجذريّة لها».", 0.5, "ar.literature.trend", "b")
st("s11", "q3", "q3-e2", "multi", "أيّ ممّا يلي من مظاهر الالتزام في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تبنّي الشّاعر لقضيّة وطنه", "نبرة التّحدّي", "التّعبير بضمير جماعة المتكلّمين (نحن)", "اقتراح الحلول (الدّعوة إلى الثّورة ضدّ المستعمر)",
                "تكريس شعره من أجل خدمة بلاده", "الانطواء على الذّات والتّغنّي بالهموم الفرديّة", "الهروب إلى الطّبيعة بعيدًا عن الواقع"]},
   {"correct": [0, 1, 2, 3, 4]}, "من مظاهر الالتزام في النّصّ: تبنّي الشّاعر لقضيّة وطنه، نبرة التّحدّي، التّعبير بضمير جماعة المتكلّمين (نحن)، اقتراح الحلول (الدّعوة إلى الثّورة ضدّ المستعمر)، تكريس شعره من أجل خدمة بلاده. يكتفي المترشّح بذكر أربعة مظاهر.", 1, "ar.literature.features")
st("s12", "q3", "q3-e2", "fill_blank", "أكمل مظاهر الالتزام في النّصّ:",
   {"text": "تبنّي الشّاعر لقضيّة ____، ونبرة ____، والتّعبير بضمير جماعة المتكلّمين (____)، و____ شعره من أجل خدمة بلاده.",
    "bank": ["وطنه", "التّحدّي", "نحن", "تكريس", "الحزن", "أنا", "هجر"]},
   {"blanks": [["وطنه"], ["التّحدّي"], ["نحن"], ["تكريس"]]}, "«من مظاهر الالتزام في النّصّ: تبنّي الشّاعر لقضيّة وطنه – نبرة التّحدّي – التّعبير بضمير جماعة المتكلّمين (نحن) – اقتراح الحلول (الدّعوة إلى الثّورة ضدّ المستعمر) – تكريس شعره من أجل خدمة بلاده».", 1, "ar.literature.features", "b")
SUM_SPEC = {"task": "تلخيص مضمون القصيدة بأسلوب المترشّح مع مراعاة تقنية التّلخيص",
            "text": "قصيدة محمّد بوزيدي في جيش التّحرير الوطنيّ (بكالوريا 2017، الدّورة الثّانية، الشّعب العلميّة، الموضوع الأوّل)",
            "model_example": None}
SUM_EXPL = "التّلخيص يراعى فيه: الدّلالة على المضمون، وتقنية التّلخيص، وسلامة اللّغة (3×01). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for i, (crit, ind) in enumerate([("الدّلالة على المضمون", "الدّلالة على مضمون القصيدة"), ("تقنية التّلخيص", "احترام تقنية التّلخيص"),
                                 ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{13 + i}", "q4", f"q4-e{i + 1}", "تلخيص مضمون قصيدة محمّد بوزيدي", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s16", "q5", "q5-e1", "multi", "أيّ الكلمات الآتية من الحقل الدّلاليّ الدّالّ على بسالة جيش الثّورة؟ (اختر كلّ ما يصحّ)",
   {"options": ["أغبرا", "العرين", "قَسْوَر", "شرس", "هصور", "مذلولة", "الدّنيئة", "الطّاغي"]},
   {"correct": [0, 1, 2, 3, 4]}, "من الألفاظ الدّالّة على بسالة جيش الثّورة: (أغبرا، عرين، قسور، شرس، هصور…)؛ أمّا «مذلولة» و«الدّنيئة» و«الطّاغي» فلا تدلّ على البسالة. يكتفي المترشّح بأربع كلمات.", 0.5, "ar.cohesion.effect")
st("s17", "q5", "q5-e1", "fill_blank", "أكمل البيت الثّالث بألفاظ من حقل بسالة جيش الثّورة:",
   {"text": "ذاك ____ وكم به من ____ شرسٍ ____ لا يلين غضنفرا", "bank": ["العرينُ", "قسوَرٍ", "هصورٍ", "الدّنيئةُ", "مذلولةٍ"]},
   {"blanks": [["العرينُ"], ["قسوَرٍ"], ["هصورٍ"]]}, "«ذاك العرين وكم به من قسورٍ شرسٍ هصورٍ لا يلين غضنفرا»: العرين، قسور، شرس، هصور من ألفاظ الحقل الدّالّ على بسالة جيش الثّورة.", 0.5, "ar.cohesion.effect", "b")
st("s18", "q6", "q6-e1", "mcq", "ما إعراب «العرين» في قوله: «ذاك العرينُ وكم به من قسورٍ» (ب3)؟",
   {"options": ["بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة المقدّرة على آخره"]},
   {"correct": 0}, "(العرين): بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s19", "q6", "q6-e2", "fill_blank", "أكمل إعراب «باسمين» في قوله: «نغشى الكريهة باسمين تجبّرا» (ب8):",
   {"text": "باسمين: ____ منصوبة وعلامة نصبها ____ لأنّها جمع مذكّر ____.", "bank": ["حال", "الياء", "سالم", "تمييز", "الفتحة", "مكسّر"]},
   {"blanks": [["حال"], ["الياء"], ["سالم"]]}, "(باسمين): حال منصوبة وعلامة نصبها الياء لأنّها جمع مذكّر سالم.", 0.5, "ar.grammar.irab")
st("s20", "q6", "q6-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «طُفْ به» في قوله: «ردّد نشيدك في الزّمان و(طُفْ به)» (ب2)؟",
   {"options": ["جملة فعليّة معطوفة على ما قبلها الابتدائيّة، لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال",
                "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(طف به): جملة فعليّة معطوفة على ما قبلها (ابتدائيّة) لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s21", "q6", "q6-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «أن يتأخّرا» في قوله: «فأبى له الإيمان (أن يتأخّرا)» (ب6)؟",
   {"options": ["جملة فعليّة مصدريّة في محلّ نصب مفعول به للفعل «أبى»", "جملة فعليّة في محلّ رفع فاعل للفعل «أبى»",
                "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(أن يتأخّر): جملة فعليّة مصدريّة في محلّ نصب مفعول به للفعل «أبى» (وفاعل «أبى» هو «الإيمان»).", 0.5, "ar.grammar.sentence_case")
st("s22", "q7", "q7-e1", "mcq", "علّل مزاوجة الشّاعر بين الأسلوبين الخبريّ والإنشائيّ.",
   {"options": ["لأنّه في معرض الفخر بجيش التّحرير وعدّ خصاله من جهة، وحثّ الشّعب على مؤازرته والالتفاف حوله من جهة أخرى",
                "لأنّه يروي أحداث معركة «عين الزّانة» بتسلسلها الزّمنيّ", "لأنّه يرثي شهداء المعركة ويتحسّر عليهم", "لأنّه يحاور المستعمر ويدعوه إلى الصّلح"]},
   {"correct": 0}, "زاوج الشّاعر بين الخبر والإنشاء لأنّه في معرض الفخر بجيش التّحرير وعدّ خصاله من جهة، وحثّ الشّعب على مؤازرته والالتفاف حوله من جهة أخرى.", 0.5, "ar.rhetoric.insha")
st("s23", "q7", "q7-e1", "matching", "طابق كلّ أسلوب بالغاية الّتي وظّفه الشّاعر من أجلها.",
   {"lefts": ["الأسلوب الخبريّ", "الأسلوب الإنشائيّ"],
    "rights": ["الفخر بجيش التّحرير وعدّ خصاله", "حثّ الشّعب على مؤازرة الجيش والالتفاف حوله", "رثاء الشّهداء والتّحسّر عليهم"]},
   {"pairs": [0, 1]}, "الخبر للفخر بجيش التّحرير وعدّ خصاله (البيت الثّالث خبريّ غرضه الفخر)، والإنشاء لحثّ الشّعب على مؤازرته والالتفاف حوله (البيت الثّاني إنشائيّ غرضه الحثّ والتّشجيع).", 0.5, "ar.rhetoric.insha", "b")
st("s24", "q7", "q7-e2", "mcq", "ما نوع أسلوب البيت الثّاني «ردّد نشيدك في الزّمان وطُف به…»؟",
   {"options": ["إنشائيّ طلبيّ بصيغة الأمر (المجازيّ)", "خبريّ", "إنشائيّ طلبيّ بصيغة النّهي", "إنشائيّ طلبيّ بصيغة النّداء"]},
   {"correct": 0}, "نوع أسلوب البيت الثّاني: إنشائيّ طلبيّ بصيغة الأمر المجازيّ.", 0.25, "ar.rhetoric.insha")
st("s25", "q7", "q7-e3", "mcq", "ما نوع أسلوب البيت الثّالث «ذاك العرين وكم به من قسور…»؟",
   {"options": ["خبريّ", "إنشائيّ طلبيّ بصيغة الاستفهام", "إنشائيّ طلبيّ بصيغة الأمر", "إنشائيّ غير طلبيّ بصيغة التّعجّب"]},
   {"correct": 0}, "أمّا نوع أسلوب البيت الثّالث فهو خبريّ («كم» فيه خبريّة لا استفهاميّة).", 0.25, "ar.rhetoric.insha")
st("s26", "q7", "q7-e4", "mcq", "ما الغرض البلاغيّ لأسلوب البيت الثّاني؟",
   {"options": ["الحثّ والتّشجيع", "الفخر", "التّحسّر", "التّعجّب"]},
   {"correct": 0}, "البيت الثّاني إنشائيّ طلبيّ بصيغة الأمر المجازيّ، وغرضه الحثّ والتّشجيع.", 0.25, "ar.rhetoric.insha")
st("s27", "q7", "q7-e5", "mcq", "ما غرض أسلوب البيت الثّالث؟",
   {"options": ["الفخر", "الحثّ والتّشجيع", "الرّثاء", "النّصح والإرشاد"]},
   {"correct": 0}, "البيت الثّالث خبريّ غرضه: الفخر.", 0.25, "ar.rhetoric.insha")
st("s28", "q8", "q8-e1", "fill_blank", "اشرح الصّورة في «قم للجزائر» (ب1):",
   {"text": "استعمل الشّاعر لفظ «الجزائر» في غير ____ مكان اللّفظ الحقيقيّ المراد وهو ____ الجزائر، لعلاقة غير ____.",
    "bank": ["محلّه", "أهل", "المشابهة", "أرض", "السّببيّة", "معناه"]},
   {"blanks": [["محلّه"], ["أهل"], ["المشابهة"]]}, "(قم للجزائر): حيث استعمل الشّاعر لفظًا في غير محلّه (الجزائر) مكان اللّفظ الحقيقيّ المراد وهو أهل الجزائر، لعلاقة غير المشابهة.", 0.5, "ar.rhetoric.metonymy")
st("s29", "q8", "q8-e2", "mcq", "ما نوع الصّورة البيانيّة في «قم للجزائر»؟",
   {"options": ["مجاز مرسل علاقته المكانيّة", "مجاز مرسل علاقته الجزئيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, "(قم للجزائر): مجاز مرسل علاقته المكانيّة.", 0.5, "ar.rhetoric.metonymy")
st("s30", "q8", "q8-e3", "mcq", "ما أثر الصّورة في «قم للجزائر»؟",
   {"options": ["الإيجاز والاختصار", "التّشخيص والتّجسيد", "إثبات الصّفة مصحوبة بالدّليل", "التّوضيح بذكر طرفي التّشبيه"]},
   {"correct": 0}, "أثرها: الإيجاز والاختصار.", 0.5, "ar.rhetoric.effect")
st("s31", "q8", "q8-e4", "matching", "اشرح الصّورة في «واستنجد الإيمانَ» (ب6): طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "اللاّزمة الدّالّة على المشبّه به"],
    "rights": ["الإيمان", "إنسان يُستنجد به", "الفعل «استنجد»", "السّلاح"]},
   {"pairs": [0, 1, 2]}, "شبّه الإيمان وهو شيء معنويّ بإنسان يُستنجد به، حيث حذف المشبّه به (الإنسان) وأبقى على لازمة من لوازمه تدلّ عليه هي الفعل (استنجد).", 0.5, "ar.rhetoric.metaphor")
st("s32", "q8", "q8-e5", "mcq", "ما نوع الصّورة في «واستنجد الإيمانَ»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]},
   {"correct": 0}, "(استنجد الإيمانَ): استعارة مكنيّة.", 0.5, "ar.rhetoric.metaphor")
st("s33", "q8", "q8-e6", "multi", "ما أثر الصّورة في «واستنجد الإيمانَ» في المعنى؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّقوية", "التّشخيص", "التّجسيد", "إثبات الصّفة مصحوبة بالدّليل", "التّوضيح بذكر طرفي التّشبيه"]},
   {"correct": [0, 1, 2]}, "أثرها في المعنى: هو التّقوية والتّشخيص والتّجسيد.", 0.5, "ar.rhetoric.effect")

_check()
assert len(P1_POEM) == 12 and all(len(r) == 3 for r in P1_POEM) and QP[0].startswith("أوّلا") and QP[5].startswith("ثانيا") and len(QP) == 10

doc = {
    "schema_version": 1,
    "set_id": "ar-bac-2017-sci-s2-p1",
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2017, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2017 (الدّورة الثّانية) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (محمّد بوزيدي: قم للجزائر)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} (يكالوريا العربية 2017 شعبة علوم الدورة الثانية.docx)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_الدورة_الاستثنائية_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("session: الدورة الثانية. نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2017، الدّورة الثّانية، "
                  "وفي رأس الموضوع الرّسميّ: «الدّورة الاستثنائيّة») في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
                  f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}؛ قوبل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الدورة_الاستثنائية_الموضوع.pdf، ص1–2). "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة). "
                  "الشّعب: علوم تجريبيّة، رياضيات، تسيير واقتصاد، تقني رياضي (رأس الموضوع والتّصحيح). "
                  "خلل في docx: في خليّة البيت السّابع فقرة ثانية مقصوصة «قل للتنيلكةٍ إتنا عند الوغى» لا وجود لها في الموضوع الرّسميّ فحُذفت. "
                  "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. العبارات «3×0.5» والمظاهر «4×0.5» والكلمات «4×0.25» عناصر متبادلة فبقي كلّ منها عنصرًا واحدًا. "
                  "التّلخيص (س4) مؤجّل (essay_builder) بمعاييره الثّلاثة (3×01). التّصحيح يسمّي «واستنجد الإيمان» صورة «البيت السّابع» وهي في البيت السّادس."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
