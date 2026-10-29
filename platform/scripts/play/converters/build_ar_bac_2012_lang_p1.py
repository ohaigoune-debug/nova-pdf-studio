"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (محمود درويش، قصيدة السّجن).
Exam (most faithful source): gdrive 1U1rgNlqW81UmuvHTcR5W2osVt7_8oeES (بكالوريا العربية 2012 شعبة لغات اجنبية.. .docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1q5eG57R5k_pnoZGShUX1QzQYXGEGMC2V (BAC 2012 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1LQF1OubnVtgWsEY5UjCtAamsEhxFZ7OA (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلالم التّنقيط»): gdrive 163UOwr81JdMgDGCMu_c-P4BTDxTSVK2V (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2016_lang_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (verses, reference,
glossary, question texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer
whitespace and outer direction marks trimmed; the poem table stores each verse as [عجز, empty, «n- صدر»] ⇒ rows written
[n-, صدر, عجز]) and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was
compared verse by verse with the official ONEC paper (rendered at 130–220 dpi): same verses, pairing and questions;
underlined «ميلاد» (v2) and «إذا» (v10) in both; parenthesised (لم يفتحوا إلّا وعود زلازلي) v8 and (أصبحتُ قدّيسا) v10.
The correction is a scanned PDF, read from the rendered pages (150 dpi, fully legible). Every mark comes from the official
scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «الشعبة: لغات أجنبية» ⇒ LANG (the docx header carries a template line «دورة جوان
  2008 / جميع الشعب»; year and stream come from the ONEC paper and the correction).
- docx defects fixed from the ONEC paper: the cell of verse 3 carries a stray second paragraph «\\لي النـــور في زنزانــة»
  (a mistyped copy of the same hemistich, absent from the ONEC paper) ⇒ dropped; verse 9 عجز «لن يسمعوا إل صرير سلاسلي»
  ⇒ «إلا» (ONEC «إلاّ»). Kept as in the docx: diacritics, tatweel, the glossary heading «الشرح اللغوي:» (ONEC «شرح المفردات:»).
- The marks column of page 1 is printed slightly above its lines; read in order: 01, 01, 01, 01.5, 01 + 01 (Q5: optimistic
  + the phrases), 01 + 0.5 (Q6: the symbol + its meaning), 01 + «0.5×2» (Q7) = 10.
- Rule for «n×m» lines: interchangeable items (more listed than required) ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q4 «01.5» for «التّفاؤل، التّحدّي والتّضحية» (no split) ⇒ one element. Q7: 01 the type (السّرد يتقاطع معه الوصف) +
  «0.5×2» two indicators among three ⇒ one element of 1.
- Part 2: Q1 «0.5×2» = referent + role. Q2 «0.25×3» per verse = النّوع / الصّيغة / الغرض ⇒ six elements. Q3: 0.5 «ميلاد»
  (the scheme writes «اسم إن مؤخر»; the particle in the verse is «أنّ», the option says «اسم أنّ مؤخّر»), «0.25×2» «إذا»
  (one element, two blanks), 0.5 per sentence. Q4 and Q5 «0.25×3» = explanation / type / effect, and figure / kind / effect.
- Part 3: «04» unsplit beside one model paragraph ⇒ one element of 4, made interactive with four 1-point steps that follow
  the four ideas of the model answer (yes, in line with modern Arabic poetry and its time / committed to the Palestinian
  cause, voicing its people's pains and hopes / national tendency: the homeland, hope for a better tomorrow / poetry as a
  means of struggle). This step split is not a rubric line — owner to confirm (or to defer the paragraph as essay_builder).
- Distractors avoid what the scheme or usage could accept: no «السّجن» field distractor in Q1; no «حال» for (لم يفتحوا إلّا
  وعود زلازلي) (a possible parse if «على سطوح منازلي» is taken as the خبر); no «التّعجّب» for the form of «وطني!» and no
  «الفخر» for the purpose of v2; no «تقوية المعنى» for the effect of the طباق.
- Nothing deferred.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1U1rgNlqW81UmuvHTcR5W2osVt7_8oeES"
DOCX_TITLE = "بكالوريا العربية 2012 شعبة لغات اجنبية.. .docx"
PDF_ID = "1q5eG57R5k_pnoZGShUX1QzQYXGEGMC2V"
OFFICIAL_ID = "1LQF1OubnVtgWsEY5UjCtAamsEhxFZ7OA"
CORR_ID = "163UOwr81JdMgDGCMu_c-P4BTDxTSVK2V"
SOURCE_STREAMS = ["LANG"]

# ── الموضوع الأوّل (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P1_POEM = [['1-', 'وطني! يعلّمني حديد سلاســــــلـــي', 'عنـــــف النســـــــور، ورقّــــــة المتفائــــــل'], ['2-', 'ما كــــنت أعرف أن تحت جلودنــا', 'ميلاد عاصفة... وعرس جــــــداول'], ['3-', 'سدُّوا عــــليّ النــــــــــــور في زنـــزانة', 'فتوهّجت في القلب...شمس مشــــاعل'], ['4-', 'كتبـــوا علـــى الجـــدران رقم بطاقتــي', 'فنـــما علـــى الجــــدران... مَرجُ سنابــــل'], ['5-', 'رسمــــوا علـــى الجـــدران صـــورة قاتــــل', 'فمـــحت ملامـــحهـا ظــــلال جدائـــــل'], ['6-', 'وحــــفرت بالأسنــــان رسمــــك داميــــا', 'وكتـــبت أغنــــية الظـــــلام الراحــــــل'], ['7-', 'أغمـــدت في لحــــم الظــــلام هزيمتــــي', 'وغرزت في شعر الضياء أناملــــــي'], ['8-', 'والفاتحــــــــون علـــى سطـــــوح منازلــــي', '(لم يفتحـــــــــــــوا إلا وعود زلازلـــــــي)'], ['9-', 'لـــــن يبصـــــــــــــروا إلا تــــوهُّج جبهتـــــي', 'لن يسمعـــــــــــوا إلا صرير سلاسلـــــــــــــي'], ['10-', 'فـــإذا احترقت على صـليب عبادتــي', '(أصـــبحتُ قدّيسا) ... بزيّ مقاتـــــــــــل']]
P1_REF = '- محمود درويش-'
P1_GLOSS = 'الشرح اللغوي:\nالزنزانة: غرفة السجن الضيقة.        جدائل: الجديلة: الضفيرة.'
P1_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'ما الحقل الدلالي الذي تمثله هذه الألفاظ: حديد - سلاسل - زنزانة؟', 'إلى من يوجه الشاعر خطابه؟', 'ماذا تعلّم الشاعر من تجربة السجن؟', 'كيف واجه الشاعر معاملة العدو له في السجن؟', 'كيف ترى الشاعر من خلال النّص، متفائلا أم متشائما؟ علل.', 'تجلّى الرمز في آخر القصيدة. دل عليه ثم وضّح دلالته.', 'ما النّمط السائد في القصيدة؟ اذكر مؤشرين له مع التمثيل من النّص.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'على من يعود ضمير" الكاف" في لفظ (رسمك) في البيت السادس؟ وما دوره في بناء النّص؟', 'ما نوع الأسلوب في بداية كل من البيتين الأول والثاني؟ بيّن الصيغة والغرض في كل منهما.', 'أعرب ما تحته خط إعراب مفردات، وما بين قوسين إعراب جمل.', 'في العبارة "أغمدت هزيمتي" صورة بيانية. اشرحها مبيّنا نوعها ووجه بلاغتها.', 'استخرج من البيت الأول محسنا بديعيا، ثم بين نوعه وأثره.', 'ثالثا- التّقويم النقدي: (04 نقاط)', 'النّزعة الوطنية والالتزام ظاهرتان لازمتا الشعر العربي الحديث. وضّح ذلك من خلال النّص.']


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
    paper = _norm(" ".join([qq["verbatim_text"] for qq in Q] + [d.get("text") or " ".join(sum(d.get("table") or [], [])) for qq in Q for d in qq["documents"]]))
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
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps) and nk not in paper), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


def _write(set_id, paper, title, notes, log_note):
    _check()
    doc = {
        "schema_version": 1,
        "set_id": set_id,
        "status": "NEEDS_HUMAN_REVIEW",
        "source": {
            "source_id": f"gdrive-{DOCX_ID}-p{paper}",
            "kind": "BAC", "year": 2012, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": paper,
            "title": title,
            "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
            "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
            "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
            "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
            "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
            "notes": notes,
        },
        "original_questions": Q,
        "steps": S,
        "score_total": 20,
        "modes": ["PRACTICE", "EXAM"],
        "review_log": [{"at": "2026-10-29T18:00:00Z", "by": "claude", "action": "generated", "note": log_note}],
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")


QP = P1_QP
J = lambda *ix: "\n".join(QP[i] for i in ix)
P1, P2, P3 = QP[0], QP[8], QP[14]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and len(QP) == 16 and len(P1_POEM) == 10
D = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": P1_POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P1_GLOSS},
]

q("q1", "1", P1, J(1), 1, [el("q1-e1", "الحقل الدّلاليّ", 1)], D)
q("q2", "2", P1, J(2), 1, [el("q2-e1", "المخاطَب", 1)], D)
q("q3", "3", P1, J(3), 1, [el("q3-e1", "ما تعلّمه الشّاعر من تجربة السّجن", 1)], D)
q("q4", "4", P1, J(4), 1.5, [el("q4-e1", "كيف واجه الشّاعر معاملة العدوّ", 1.5)], D)
q("q5", "5", P1, J(5), 2, [el("q5-e1", "الشّاعر متفائل", 1), el("q5-e2", "العبارات الدّالّة على ذلك", 1)], D)
q("q6", "6", P1, J(6), 1.5, [el("q6-e1", "الدّلالة على الرّمز", 1), el("q6-e2", "دلالته", 0.5)], D)
q("q7", "7", P1, J(7), 2, [el("q7-e1", "النّمط السّائد", 1), el("q7-e2", "مؤشّران مع التّمثيل (0.5×2)", 1)], D)
q("q8", "1", P2, J(9), 1, [el("q8-e1", "عائد ضمير «الكاف» في (رسمك)", 0.5), el("q8-e2", "دوره في بناء النّصّ", 0.5)], D)
q("q9", "2", P2, J(10), 1.5,
  [el("q9-e1", "البيت الأوّل: نوع الأسلوب", 0.25), el("q9-e2", "البيت الأوّل: الصّيغة", 0.25), el("q9-e3", "البيت الأوّل: الغرض", 0.25),
   el("q9-e4", "البيت الثّاني: نوع الأسلوب", 0.25), el("q9-e5", "البيت الثّاني: الصّيغة", 0.25), el("q9-e6", "البيت الثّاني: الغرض", 0.25)], D)
q("q10", "3", P2, J(11), 2, [el("q10-e1", "إعراب «ميلاد»", 0.5), el("q10-e2", "إعراب «إذا» (0.25×2)", 0.5),
                             el("q10-e3", "محلّ جملة (لم يفتحوا إلّا وعود زلازلي)", 0.5), el("q10-e4", "محلّ جملة (أصبحت قدّيسا)", 0.5)], D)
q("q11", "4", P2, J(12), 0.75, [el("q11-e1", "«أغمدت هزيمتي»: الشّرح", 0.25), el("q11-e2", "«أغمدت هزيمتي»: النّوع", 0.25), el("q11-e3", "«أغمدت هزيمتي»: البلاغة", 0.25)], D)
q("q12", "5", P2, J(13), 0.75, [el("q12-e1", "المحسّن البديعيّ في البيت الأوّل", 0.25), el("q12-e2", "نوعه", 0.25), el("q12-e3", "أثره", 0.25)], D)
q("q13", "1", P3, J(15), 4, [el("q13-e1", "توضيح النّزعة الوطنيّة والالتزام من خلال النّصّ (04)", 4)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما الحقل الدّلاليّ الّذي تمثّله الألفاظ: حديد – سلاسل – زنزانة؟",
   {"options": ["التّعذيب أو الاضطهاد", "الطّبيعة", "الحرّيّة والانطلاق", "الحبّ والحنين"]},
   {"correct": 0}, "الحقل الدّلاليّ للألفاظ (حديد – سلاسل – زنزانة): التّعذيب أو الاضطهاد.", 1, "ar.cohesion.effect")
st("s02", "q2", "q2-e1", "mcq", "إلى من يوجّه محمود درويش خطابه في القصيدة؟",
   {"options": ["إلى وطنه، ومن خلاله إلى بني وطنه", "إلى سجّانيه", "إلى أمّه", "إلى الشّعراء العرب"]},
   {"correct": 0}, "يوجّه الشّاعر خطابه إلى وطنه («وطني! يعلّمني حديد سلاسلي…»، «رسمك») ومن خلاله إلى بني وطنه.", 0.5, "ar.comprehension.details")
st("s03", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "يوجّه الشّاعر خطابه إلى ____، ومن خلاله إلى ____ وطنه.", "bank": ["وطنه", "بني", "سجّانه", "أعداء"]},
   {"blanks": [["وطنه"], ["بني"]]}, "«يوجّه الشّاعر خطابه إلى وطنه ومن خلاله إلى بني وطنه».", 0.5, "ar.comprehension.details", "b")
st("s04", "q3", "q3-e1", "mcq", "ماذا تعلّم الشّاعر من تجربة السّجن؟",
   {"options": ["المواجهة، واكتشاف الذّات والمقاومة", "الاستسلام واليأس", "الخوف من السّجّان", "الهروب من الواقع"]},
   {"correct": 0}, "تعلّم الشّاعر من تجربة السّجن المواجهة، واكتشاف الذّات والمقاومة.", 0.5, "ar.comprehension.details")
st("s05", "q3", "q3-e1", "multi", "اختر ممّا يلي ما تعلّمه الشّاعر من تجربة السّجن. (اختر كلّ ما يصحّ)",
   {"options": ["المواجهة", "اكتشاف الذّات", "المقاومة", "المهادنة", "النّسيان"]},
   {"correct": [0, 1, 2]}, "تعلّم الشّاعر من تجربة السّجن: المواجهة، واكتشاف الذّات، والمقاومة؛ لا المهادنة ولا النّسيان.", 0.5, "ar.comprehension.details", "b")
st("s06", "q4", "q4-e1", "mcq", "كيف واجه الشّاعر معاملة العدوّ له في السّجن؟",
   {"options": ["بالتّفاؤل والتّحدّي والتّضحية", "بالاستسلام والخضوع", "بالشّكوى والبكاء", "بالهروب والتّخفّي"]},
   {"correct": 0}, "واجه الشّاعر معاملة العدوّ بـ: التّفاؤل، التّحدّي والتّضحية.", 0.75, "ar.comprehension.details")
st("s07", "q4", "q4-e1", "multi", "بمَ واجه الشّاعر معاملة العدوّ له في السّجن؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّفاؤل", "التّحدّي", "التّضحية", "اليأس", "التّوسّل إلى العدوّ", "الخوف"]},
   {"correct": [0, 1, 2]}, "واجه الشّاعر معاملة العدوّ بـ: التّفاؤل، التّحدّي والتّضحية.", 0.75, "ar.comprehension.details", "b")
st("s08", "q5", "q5-e1", "mcq", "كيف ترى الشّاعر من خلال النّصّ: متفائلًا أم متشائمًا؟",
   {"options": ["متفائلًا", "متشائمًا", "متردّدًا بين التّفاؤل والتّشاؤم", "يائسًا مستسلمًا"]},
   {"correct": 0}, "الشّاعر متفائل.", 1, "ar.comprehension.emotion")
st("s09", "q5", "q5-e2", "multi", "علّل: اختر من القصيدة العبارات الدّالّة على تفاؤل الشّاعر. (اختر كلّ ما يصحّ)",
   {"options": ["«رقّة المتفائل»", "«ظلال جدائل»", "«شمس مشاعل»", "«مرج سنابل»", "«حديد سلاسلي»", "«صورة قاتل»", "«رقم بطاقتي»"]},
   {"correct": [0, 1, 2, 3]}, "من العبارات الدّالّة على تفاؤله: رقّة المتفائل – ظلال جدائل – شمس مشاعل – مرج سنابل…؛ أمّا «حديد سلاسلي» و«صورة قاتل» و«رقم بطاقتي» فمن صور القهر في السّجن.", 1, "ar.comprehension.evidence")
st("s10", "q6", "q6-e1", "mcq", "دلّ على الرّمز الّذي تجلّى في آخر القصيدة.",
   {"options": ["«احترقت على صليب عبادتي..»", "«وغرزت في شعر الضّياء أناملي»", "«كتبوا على الجدران رقم بطاقتي»", "«وطني! يعلّمني حديد سلاسلي»"]},
   {"correct": 0}, "تجلّى الرّمز في آخر القصيدة في قول الشّاعر: «احترقت على صليب عبادتي..».", 1, "ar.literature.renewal")
st("s11", "q6", "q6-e2", "fill_blank", "وضّح دلالة الرّمز:",
   {"text": "وظّفه الشّاعر ليستدلّ على معاناته كـ____ – عليه السّلام – الّذي صُلب وعُذّب، وقد توهّم صالبوه أنّه ____، والحقيقة غير ذلك.",
    "bank": ["المسيح", "قُتل", "موسى", "نجا"]},
   {"blanks": [["المسيح"], ["قُتل"]]}, "وقد وظّفه الشّاعر ليستدلّ على معاناته كالمسيح – عليه السّلام – الّذي صُلب وعُذّب، وقد توهّم صالبوه أنّه قُتل، والحقيقة غير ذلك.", 0.5, "ar.literature.renewal")
st("s12", "q7", "q7-e1", "mcq", "ما النّمط السّائد في القصيدة؟",
   {"options": ["السّرديّ يتقاطع معه الوصف", "الحجاجيّ", "التّفسيريّ", "الحواريّ"]},
   {"correct": 0}, "النّمط السّائد في القصيدة هو السّرد الّذي يتقاطع معه الوصف.", 1, "ar.text.type")
NARR_EXPL = ("من مؤشّرات السّرد: تنوّع الأفعال الماضية (رسموا، كتبوا، سدّوا، حفرت، أغمدت…)؛ كثرة الرّوابط (حروف الجرّ: على، في…، حرف العطف: الواو، "
             "حروف النّفي: ما، لن…)؛ تحديد الأمكنة (الزّنزانة، الجدران، سطوح منازلي). يكتفي المترشّح بمؤشّرين.")
st("s13", "q7", "q7-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط السّرديّ بمثاله من القصيدة.",
   {"lefts": ["تنوّع الأفعال الماضية", "كثرة الرّوابط", "تحديد الأمكنة"],
    "rights": ["(رسموا، كتبوا، سدّوا، حفرت، أغمدت…)", "(على، في، الواو، ما، لن…)", "(الزّنزانة، الجدران، سطوح منازلي)", "(وطني!)"]},
   {"pairs": [0, 1, 2]}, NARR_EXPL, 0.5, "ar.text.type")
st("s14", "q7", "q7-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط السّرديّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["تنوّع الأفعال الماضية", "كثرة الرّوابط (حروف الجرّ والعطف والنّفي)", "تحديد الأمكنة", "الإحصاءات والأرقام", "عرض الحجج والبراهين المنطقيّة"]},
   {"correct": [0, 1, 2]}, NARR_EXPL, 0.5, "ar.text.type", "b")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q8", "q8-e1", "mcq", "على من يعود ضمير «الكاف» في لفظ (رسمك) في البيت السّادس؟",
   {"options": ["على الوطن", "على العدوّ", "على القاتل", "على الظّلام"]},
   {"correct": 0}, "يعود ضمير (الكاف) في لفظة (رسمك) على الوطن.", 0.5, "ar.cohesion.reference")
st("s16", "q8", "q8-e2", "mcq", "ما دور ضمير «الكاف» في (رسمك) في بناء النّصّ؟",
   {"options": ["ربط البيت السّادس بالبيت الأوّل", "ربط البيت السّادس بالبيت العاشر", "إحداث جرس موسيقيّ في البيت", "الفصل بين مقطعي القصيدة"]},
   {"correct": 0}, "أمّا دوره في بناء النّصّ: ربط البيت السّادس بالبيت الأوّل (حيث النّداء «وطني!»).", 0.5, "ar.cohesion.reference")
STY_EXPL = "أسلوب البيت الأوّل إنشائيّ طلبيّ، بصيغة النّداء، غرضه لفت الانتباه؛ وأسلوب البيت الثّاني خبريّ، بصيغة النّفي، غرضه التّعبير عن الدّهشة والمفاجأة."
st("s17", "q9", "q9-e1", "mcq", "ما نوع الأسلوب في بداية البيت الأوّل «وطني! يعلّمني حديد سلاسلي»؟",
   {"options": ["إنشائيّ طلبيّ", "إنشائيّ غير طلبيّ", "خبريّ"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s18", "q9", "q9-e2", "mcq", "ما صيغة الأسلوب في «وطني!» في بداية البيت الأوّل؟",
   {"options": ["النّداء", "الأمر", "الاستفهام", "النّهي"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s19", "q9", "q9-e3", "mcq", "ما غرض النّداء في «وطني!»؟",
   {"options": ["لفت الانتباه", "التّحقير", "التّوبيخ", "الدّعاء"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s20", "q9", "q9-e4", "mcq", "ما نوع الأسلوب في بداية البيت الثّاني «ما كنت أعرف أنّ تحت جلودنا…»؟",
   {"options": ["خبريّ", "إنشائيّ طلبيّ", "إنشائيّ غير طلبيّ"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.style")
st("s21", "q9", "q9-e5", "fill_blank", "أكمل صيغة الأسلوب في بداية البيت الثّاني:",
   {"text": "«ما كنت أعرف…»: أسلوب خبريّ بصيغة ____.", "bank": ["النّفي", "الاستفهام", "النّهي"]},
   {"blanks": [["النّفي"]]}, STY_EXPL, 0.25, "ar.rhetoric.style")
st("s22", "q9", "q9-e6", "mcq", "ما غرض الأسلوب الخبريّ في «ما كنت أعرف أنّ تحت جلودنا ميلاد عاصفة»؟",
   {"options": ["التّعبير عن الدّهشة والمفاجأة", "التّهديد والوعيد", "الرّثاء", "الاستعطاف"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.style")
st("s23", "q10", "q10-e1", "mcq", "ما إعراب «ميلاد» في قوله: «ما كنت أعرف أنّ تحت جلودنا ميلاد عاصفة» (ممّا تحته خطّ)؟",
   {"options": ["اسم «أنّ» مؤخّر منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "خبر «أنّ» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "ميلاد: اسم «أنّ» مؤخّر منصوب وعلامة نصبه الفتحة الظّاهرة على آخره (في التّصحيح: «اسم إن مؤخر»؛ وخبرها المقدّم شبه الجملة «تحت جلودنا»).", 0.5, "ar.grammar.nawasikh")
st("s24", "q10", "q10-e2", "fill_blank", "أكمل إعراب «إذا» في قوله: «فإذا احترقت على صليب عبادتي» (ممّا تحته خطّ):",
   {"text": "إذا: ظرف لما ____ من الزّمن متضمّن معنى ____ مبنيّ على السّكون في محلّ نصب، وهو مضاف.", "bank": ["يُستقبل", "الشّرط", "مضى", "التّعليل"]},
   {"blanks": [["يُستقبل"], ["الشّرط"]]}, "إذا: ظرف لما يُستقبل من الزّمن متضمّن معنى الشّرط مبنيّ على السّكون في محلّ نصب، وهو مضاف.", 0.5, "ar.grammar.conditional")
st("s25", "q10", "q10-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (لم يفتحوا إلّا وعود زلازلي) في البيت الثّامن؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر المبتدأ (الفاتحون)", "جملة فعليّة في محلّ نصب مفعول به", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "«لم يفتحوا إلّا وعود زلازلي»: جملة فعليّة في محلّ رفع خبر المبتدأ (الفاتحون).", 0.5, "ar.grammar.sentence_case")
st("s26", "q10", "q10-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (أصبحت قدّيسا) في البيت العاشر؟",
   {"options": ["جملة جواب شرط غير جازم لا محلّ لها من الإعراب", "جملة جواب شرط جازم مقترنة بالفاء في محلّ جزم", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "أصبحتُ قدّيسًا: جملة جواب شرط غير جازم (إذا) لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
IMG_EXPL = ("في العبارة (أغمدت هزيمتي): شبّه الشّاعر الهزيمة (أمر معنويّ) بالسّيف (أمر ماديّ)، فذكر المشبّه وحذف المشبّه به وأبقى على ما يدلّ عليه "
            "(أغمدت) على سبيل الاستعارة المكنيّة. بلاغتها: تقريب المعنى وتثبيته في الذّهن عن طريق التّجسيد والتّصوير.")
st("s27", "q11", "q11-e1", "fill_blank", "اشرح الصّورة البيانيّة في «أغمدت هزيمتي»:",
   {"text": "شبّه الشّاعر ____ (أمر معنويّ) بـ____ (أمر ماديّ)، فذكر المشبّه وحذف المشبّه به وأبقى على ما يدلّ عليه (أغمدت).", "bank": ["الهزيمة", "السّيف", "الظّلام", "الصّليب"]},
   {"blanks": [["الهزيمة"], ["السّيف"]]}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s28", "q11", "q11-e2", "mcq", "ما نوع الصّورة البيانيّة في «أغمدت هزيمتي»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s29", "q11", "q11-e3", "mcq", "ما بلاغة الاستعارة في «أغمدت هزيمتي»؟",
   {"options": ["تقريب المعنى وتثبيته في الذّهن عن طريق التّجسيد والتّصوير", "تقديم الحقيقة مصحوبة بالدّليل",
                "توضيح المعنى بإيهام التّطابق بين المشبّه والمشبّه به المذكورين", "تحسين الكلام بالجرس الموسيقيّ"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
BADI_EXPL = "المحسّن البديعيّ في البيت الأوّل: العنف ≠ الرّقّة، نوعه طباق إيجاب، غرضه توضيح المعنى (بالأضداد تُفهم المعاني)."
st("s30", "q12", "q12-e1", "mcq", "استخرج من البيت الأوّل محسّنًا بديعيًّا.",
   {"options": ["«عنف» و«رقّة»", "«حديد» و«سلاسلي»", "«وطني» و«يعلّمني»", "«النّسور» و«المتفائل»"]}, {"correct": 0}, BADI_EXPL, 0.25, "ar.rhetoric.badi")
st("s31", "q12", "q12-e2", "mcq", "ما نوع المحسّن البديعيّ بين «العنف» و«الرّقّة»؟",
   {"options": ["طباق إيجاب", "طباق سلب", "مقابلة", "جناس ناقص"]}, {"correct": 0}, BADI_EXPL, 0.25, "ar.rhetoric.badi")
st("s32", "q12", "q12-e3", "mcq", "ما أثر الطّباق بين «العنف» و«الرّقّة» في المعنى؟",
   {"options": ["توضيح المعنى (بالأضداد تُفهم المعاني)", "إحداث جرس موسيقيّ بتكرار الحروف", "إيهام التّطابق بين المشبّه والمشبّه به", "تقديم الحقيقة مصحوبة بالدّليل"]},
   {"correct": 0}, BADI_EXPL, 0.25, "ar.rhetoric.badi")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("الإجابة النّموذجيّة (04): نعم، ظهرت النّزعة الوطنيّة والالتزام في النّصّ، تماشيًا مع طبيعة الشّعر العربيّ الحديث وظروف العصر، إذ يبدو الشّاعر في "
             "القصيدة شاعرًا ملتزمًا بالقضيّة الفلسطينيّة الّتي شغلت كلّ الأدباء، حينما عبّر عن آلام وآمال الشّعب الفلسطينيّ، كما يبدو وطنيّ النّزعة، ويظهر ذلك في "
             "تناوله قضيّة الوطن وكلّه أمل في غد أفضل، وباعتبار الشّعر وسيلة من وسائل الكفاح والنّضال. (العلامة 04 دون تفصيل؛ قُسّمت هنا نقطةً لكلّ فكرة للتّدريب.)")
st("s33", "q13", "q13-e1", "mcq", "هل ظهرت النّزعة الوطنيّة والالتزام في قصيدة محمود درويش؟ ولماذا؟",
   {"options": ["نعم، تماشيًا مع طبيعة الشّعر العربيّ الحديث وظروف العصر", "لا، فالقصيدة ذاتيّة لا صلة لها بقضايا الوطن",
                "لا، لأنّ الشّاعر اكتفى بوصف الطّبيعة", "نعم، لأنّ الشّاعر يمدح الحكّام"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.trend")
st("s34", "q13", "q13-e1", "mcq", "كيف يبدو الشّاعر ملتزمًا في القصيدة؟",
   {"options": ["ملتزمًا بالقضيّة الفلسطينيّة الّتي شغلت كلّ الأدباء، حينما عبّر عن آلام وآمال الشّعب الفلسطينيّ", "ملتزمًا بالدّفاع عن مصالحه الشّخصيّة",
                "ملتزمًا بالحياد إزاء ما يجري في وطنه", "ملتزمًا بالتّغنّي بجمال الطّبيعة بعيدًا عن هموم شعبه"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.trend", "b")
st("s35", "q13", "q13-e1", "fill_blank", "أكمل مظهر النّزعة الوطنيّة في القصيدة:",
   {"text": "يبدو الشّاعر وطنيّ النّزعة، ويظهر ذلك في تناوله قضيّة ____ وكلّه ____ في غد أفضل.", "bank": ["الوطن", "أمل", "الغربة", "يأس"]},
   {"blanks": [["الوطن"], ["أمل"]]}, CRIT_EXPL, 1, "ar.literature.trend", "c")
st("s36", "q13", "q13-e1", "mcq", "ما الّذي يجعل الشّعر في هذه القصيدة التزامًا ونضالًا؟",
   {"options": ["اعتبار الشّعر وسيلة من وسائل الكفاح والنّضال", "اعتبار الشّعر وسيلة للتّسلية والتّرفيه", "اعتبار الشّعر صناعة لفظيّة غايتها الزّخرفة", "اعتبار الشّعر وسيلة للتّكسّب"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.trend", "d")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (محمود درويش: قصيدة من السّجن)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من "
         f"ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا بيتًا بيتًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2). أُصلح من "
         "الموضوع الرّسميّ خطآن في docx: سطر زائد في خليّة البيت 3 («\\لي النـــور في زنزانــة») حُذف، و«إل صرير» في عجز البيت 9 ← «إلا صرير». ما تحته خطّ «ميلاد» "
         "و«إذا»، وما بين قوسين (لم يفتحوا إلّا وعود زلازلي) و(أصبحتُ قدّيسا). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ممسوح، ص1–2؛ عمود العلامات في ص1 "
         "مطبوع أعلى من سطوره فقُرئ بالتّرتيب). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. التّقويم النّقديّ «04» دون تفصيل بجانب فقرة نموذجيّة "
         "واحدة: عنصر واحد (4) بخطوات تفاعليّة نقطةً لكلّ فكرة من أفكار الفقرة (تقسيم تدريبيّ لا من السّلّم، للمراجعة). لا شيء مؤجَّل.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-lang-p1", 1, TITLE, NOTES, LOG_NOTE)
