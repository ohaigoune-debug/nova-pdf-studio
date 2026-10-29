"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (نزار قبّاني، «هوامش على دفتر النّكسة»، مقاطع).
Exam (most faithful source): gdrive 1h8lHebIdx9wqNc_1oyzogoBptc4iKaVD (بكالوريا العربية 2013 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 1iQ-hNe-l7dV4C1vwihsYPmk_QjqTxhR5;
official ONEC paper: gdrive 1ipMfhXVnCu7L1M3Dk9ntId7sl9fFggCZ (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1LM6stJOEJ8D1AXk6W-B38JOPcld-WTgs (02_التصحيح.pdf, pages 1–2).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed; the free-verse poem sits in a two-cell table
read cell by cell, empty lines dropped, the last line «- الشاعر نزار قباني -» kept as the reference) and re-checked
programmatically against it. Multi-paragraph questions are joined with «\n»; the quotation of Part 3 (three printed lines
in the docx) is joined with spaces. The docx «الأسئلة:    أوّلا- البناء الفكري: (10 نقاط)» is one paragraph: the part
label is its text after «الأسئلة:». Question numbering follows the ONEC paper (Part 2 Q1 = إعراب المفردات + محلّ الجملتين).
The docx was compared line by line with the ONEC paper (150 dpi, doubtful words at 300 dpi). Both PDFs are scans, so the
mark scheme was read from the rendered pages (the scansion at 300–400 dpi).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «لغات أجنبيّة» ⇒ LANG.
- docx defects fixed from the ONEC paper: stanza 2 «لأّنا ندخلها» ⇒ «لأنّنا ندخلها»; stanza 5 «جِرَبوا» (wrong vowels)
  ⇒ «جرّبوا»; stanza 7 «يا أيَها» ⇒ «يا أيّها». Kept from the docx: «كلَّفنا إرتجالنا» (ONEC «ارتجالنا»), «فالناس
  يجهلونكم» (ONEC adds «…»), «(06 نقاط)», «ثالثا- التّقويم النقدي:» (ONEC «… للنّصّ»).
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required
  distinct items, or distinct demands ⇒ one element per item.
- Q1 01. Q2 «2×0.5» = where (تحسّر الشّاعر وتأسّفه…) / an example. Q3 «2×0.75» one element per truth (تاريخيّة /
  سياسيّة). Q4 01. Q5 «2×0.5» = who (أبناؤها سنابل الأمان) / the explanation. Q6 «2×0.5» = the type (الوصفيّ) / the
  reason, + «2×0.5» two indicators («بإمكان التّلميذ أن يقدّم مؤشّرين آخرين») ⇒ one element; «الإيعازيّ» (said to run
  through the text) and «السّرديّ» are not type distractors.
- Q7 (نثر المقطعين 6 و7) 0.5 مضمون النّصّ / 01 سلامة اللّغة / 01 الأسلوب ⇒ three deferred essay_builder elements.
- Part 2 Q1: 0.25 per word / sentence ⇒ four elements («الأطفال» بدل: no «نعت / عطف بيان» distractor; «تشكو»: the
  scheme accepts the answer with or without the فاعل). Q2 «2×0.5» = why / example. Q3 «2×0.5» two types among three
  (الضّمير «نحن»، حروف العطف، حروف الجرّ; «يكتفي المترشّح بنوعين») ⇒ one element.
- Q4: the marks «2×0.25» sit beside each image; the question asks for the type and the secret only ⇒ type / secret per
  image (the scheme's explanation of the metaphor goes into the explanations). The scheme notes another metaphor in
  «قشرة الحضارة» ⇒ no «تشبيه بليغ / استعارة تصريحيّة» distractor there; the kināya secret «تقديم الحقيقة مصحوبة
  بالدّليل» is not a distractor for «نحن في السّرداب».
- Q5 (تقطيع): «2×0.5» the two lines + «2×0.5» = the observation / the reason. Scheme: line 1 أَسْسِرْرُ فِيْ مَأْسَاتِنَا
  = /0/0//0 /0/0//0 = مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ; line 2 صُرَاْخُنَا أَضْخَمُ مِنْ أَصْوَاتِنَا = //0//0 /0///0 /0/0//0
  (symbols printed right-to-left in the scheme; written here left-to-right). The scheme names the feet of line 2
  «مُتَفْعِلُنْ، مُتَفَعِلُنْ(؟)، مستفعلن», but its second foot /0///0 is مُسْتَعِلُنْ (مطويّة) — the printed name is unclear ⇒
  no step asks for the name of that foot (only the symbols, the first observation and the last foot).
- Part 3: 01 the judgment («حقّق فعلًا صورة الأديب الملتزم») + 3×01 three statements among five («يمكن أن يضيف المترشّح
  عبارات أخرى صحيحة» ⇒ distractors contradict commitment) ⇒ elements 1 + 3.
- Deferred: Q7 (2.5). Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-lang-p1"
DOCX_ID = "1h8lHebIdx9wqNc_1oyzogoBptc4iKaVD"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة لغات اجنبية.docx"
PDF_ID = "1iQ-hNe-l7dV4C1vwihsYPmk_QjqTxhR5"
OFFICIAL_ID = "1ipMfhXVnCu7L1M3Dk9ntId7sl9fFggCZ"
CORR_ID = "1LM6stJOEJ8D1AXk6W-B38JOPcld-WTgs"
SOURCE_STREAMS = ["LANG"]

# ── الموضوع الأوّل (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P1_STANZAS = ["-1-\nيا وطني الحزين\nحوّلتني بلحظة من شاعر (يكتب)\nشعر الحبّ والحنين\nلشاعر يكتب بالسكين", "-2-\nلأنّ ما نحسّه أكبر من أوراقنا\nلا بد أن نخجل من أشعارنا\nإذا خسرنا الحرب، لا غرابة\nلأنّنا ندخلها بكل ما يملكه الشرقي\nمن مواهب الخطابة ...\nبالعنتريات التي ما قتلت ذبابة", "-3-\nالسرّ في مأساتنا\nصراخنا أضخم من أصواتنا\nوسيفنا أطول من قامتنا\nخلاصة القضيّة توجز في عبارة\nلقد لبسنا قشرة الحضارة ...\nوالروح الجاهلية ...", "-4-\nكلَّفنا إرتجالنا خمسين ألف خيمة جديدة ...\nلا تلعنوا السماء\nإذا تخلّت عنكم\nلا تلعنوا الظروف\nفالله يؤتي النصر من يشاء\nما دخل اليهود من حدودنا\nوإنما ... تسرّبوا كالنّمل من عيوننا ...", "-5-\nخمسة آلاف سنة ...\nونحن في السّرداب\nيا أصدقائي: جرّبوا أن تكسروا\nالأبواب\nفالناس يجهلونكم\nجلودنا ميّتة الإحساس\nأرواحنا «تشكو» الإفلاس\nهل نحن خير أمّة أخرجت للناس؟", "-6-\nلو أنّنا لم ندفن الوحدة في التراب\nلو بقيت في داخل العيون\nوالأهداب\nلما استباحت لحمنا الكلاب ...", "-7-\nيا أيّها «الأطفال»\nيا مطر الربيع...\nيا سنابل الأمان...\nأنتم الجيل الذي (سيهزم الهزيمة) ..."]
P1_REF = "- الشاعر نزار قباني -"
P1_QP = ["أوّلا- البناء الفكري: (10 نقاط)", "إلى من توجه الشاعر بالخطاب في بداية النّص؟", "نبرة العتاب ظاهرة في النّص. أين تلمسها؟ مثّل لها من النص.", "سجل الشاعر حقيقتين، إحداهما سياسية والأخرى تاريخية. وضّحهما.", "بم علّل الشاعر سبب مأساة الوطن العربي؟", "نظرة الشاعر إلى المستقبل نظرة تفاؤلية. من سيحقّق ذلك في نظره؟ وضّح.", "ما النمط الغالب في النص؟ علّل، ثم استخرج مؤشرين له من النّص.", "أنثر المقطعين السَّادس والسّابع بأسلوبك الخاص.", "ثانيا- البناء اللّغوي: (06 نقاط)", "أعرب ما يلي إعراب مفردات:\nكلمة: «تشكو» في المقطع الخامس و«الأطفال» في المقطع السابع.\nما محل الجملتين التاليتيّن من الإعراب:\n(يكتب) الواقعة في المقطع الأول و(سيهزم الهزيمة) الواقعة في المقطع السابع؟", "أسلوب الخطاب بارز في النص. لماذا؟ مثل له.", "وظف الشاعر مجموعة من الروابط. استخرج نوعين منها. وبيّن دورها في بناء النّص.", "إليك الجملتين الآتيتين:      (لبسنا قشرة الحضارة)،  (نحن في السّرداب)\nحدّد نوع الصورتين اللتين احتوتهما وبيّن سر بلاغتهما.", "قطع السطرين التاليين، محدّدا تفعيلات كل سطر: -السرّ في مأساتنا.\n-صراخنا أضخم من أصواتنا.\nماذا تلاحظ؟ علّل.", "ثالثا- التّقويم النقدي: (04 نقاط)", "ورد في نص \"الالتزام في الشعر العربي الحديث\" للكاتب مفيد محمد قميحة (الكتاب المدرسي ص107):", "(الأديب... يتأثر بكل اهتزازات الذبذبة الإنسانية سلبا وإيجابا، ويتأثّر بكلّ ألوان الطّيف الحياتي التي تنسكب في وعاء وجوده كإنسان يمثّل طبيعة الوجود، وهو كإنسان تاريخي يجب أن يرسم الطريق للأجيال الحاضرة والقادمة عبر أدبه الإنساني الثــرّ).", "المطلوب: انطلاقا من هذه المقولة، هل ترى أن الشاعر نزار قباني من خلال نصه حقّق صورة الأديب الملتزم بقضايا أمّته؟ وضح."]

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
assert len(P1_STANZAS) == 7 and QP[0].startswith("أوّلا") and QP[8].startswith("ثانيا") and QP[14].startswith("ثالثا") and len(QP) == 18
assert "«تشكو»" in P1_STANZAS[4] and "(سيهزم الهزيمة)" in P1_STANZAS[6] and "(يكتب)" in P1_STANZAS[0] and "لأنّنا ندخلها" in P1_STANZAS[1]
P1, P2, P3 = QP[0], QP[8], QP[14]
J = lambda *ix: "\n".join(QP[i] for i in ix)
CAPS = ["المقطع الأوّل", "المقطع الثّاني", "المقطع الثّالث", "المقطع الرّابع", "المقطع الخامس", "المقطع السّادس", "المقطع السّابع"]
DOCS = [{"id": f"d-st{k + 1}", "kind": "text", "caption": CAPS[k], "text": P1_STANZAS[k]} for k in range(7)] + [
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF}]

q("q1", "1", P1, QP[1], 1, [el("q1-e1", "المخاطَب في بداية النّصّ", 1)], DOCS)
q("q2", "2", P1, QP[2], 1, [el("q2-e1", "موضع نبرة العتاب", 0.5), el("q2-e2", "التّمثيل لها من النّصّ", 0.5)], DOCS)
q("q3", "3", P1, QP[3], 1.5, [el("q3-e1", "الحقيقة التّاريخيّة", 0.75), el("q3-e2", "الحقيقة السّياسيّة", 0.75)], DOCS)
q("q4", "4", P1, QP[4], 1, [el("q4-e1", "تعليل مأساة الوطن العربيّ", 1)], DOCS)
q("q5", "5", P1, QP[5], 1, [el("q5-e1", "مَن سيحقّق النّصر", 0.5), el("q5-e2", "التّوضيح", 0.5)], DOCS)
q("q6", "6", P1, QP[6], 2, [el("q6-e1", "النّمط الغالب", 0.5), el("q6-e2", "التّعليل", 0.5), el("q6-e3", "مؤشّران له (2×0.5)", 1)], DOCS)
q("q7", "7", P1, QP[7], 2.5, [el("q7-e1", "النّثر: مضمون النّصّ", 0.5), el("q7-e2", "النّثر: سلامة اللّغة", 1), el("q7-e3", "النّثر: الأسلوب", 1)], DOCS)
q("q8", "1", P2, QP[9], 1, [el("q8-e1", "إعراب «تشكو»", 0.25), el("q8-e2", "إعراب «الأطفال»", 0.25),
                             el("q8-e3", "محلّ جملة (يكتب)", 0.25), el("q8-e4", "محلّ جملة (سيهزم الهزيمة)", 0.25)], DOCS)
q("q9", "2", P2, QP[10], 1, [el("q9-e1", "سبب بروز أسلوب الخطاب", 0.5), el("q9-e2", "التّمثيل له", 0.5)], DOCS)
q("q10", "3", P2, QP[11], 1, [el("q10-e1", "نوعان من الرّوابط ودورهما (2×0.5)", 1)], DOCS)
q("q11", "4", P2, QP[12], 1, [el("q11-e1", "(لبسنا قشرة الحضارة): النّوع", 0.25), el("q11-e2", "(لبسنا قشرة الحضارة): سرّ البلاغة", 0.25),
                              el("q11-e3", "(نحن في السّرداب): النّوع", 0.25), el("q11-e4", "(نحن في السّرداب): سرّ البلاغة", 0.25)], DOCS)
q("q12", "5", P2, QP[13], 2, [el("q12-e1", "تقطيع السّطر الأوّل وتفعيلاته", 0.5), el("q12-e2", "تقطيع السّطر الثّاني وتفعيلاته", 0.5),
                              el("q12-e3", "الملاحظة", 0.5), el("q12-e4", "التّعليل", 0.5)], DOCS)
q("q13", "1", P3, J(15, 16, 17), 4, [el("q13-e1", "تحقيق الشّاعر صورة الأديب الملتزم", 1), el("q13-e2", "ثلاث عبارات موضّحة (3×01)", 3)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "إلى من توجّه الشّاعر بالخطاب في بداية النّصّ؟",
   {"options": ["إلى وطنه الحزين", "إلى الأطفال", "إلى أصدقائه", "إلى اليهود"]},
   {"correct": 0}, "يخاطب الشّاعر في بداية النّصّ وطنه الحزين الّذي يئنّ تحت وطأة الاستدمار.", 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "يخاطب الشّاعر في بداية النّصّ وطنه الحزين الّذي يئنّ تحت وطأة ____.", "bank": ["الاستدمار", "الفرح", "الرّخاء"]},
   {"blanks": [["الاستدمار"]]}, "«يخاطب الشّاعر في بداية النّصّ وطنه الحزين الّذي يئنّ تحت وطأة الاستدمار».", 0.5, "ar.comprehension.details", "b")
ITAB_EXPL = ("نلمس نبرة العتاب في تحسّر الشّاعر وتأسّفه لما آلت إليه الأمّة العربيّة من هوان وانكسار أمام أعدائها. من ذلك قوله: «لا بدّ أن نخجل من أشعارنا»، "
             "«صراخنا أضخم من أصواتنا»، «لبسنا قشرة الحضارة»، «كلّفنا ارتجالنا خمسين ألف خيمة»… إلخ.")
st("s03", "q2", "q2-e1", "mcq", "أين تلمس نبرة العتاب في النّصّ؟",
   {"options": ["في تحسّر الشّاعر وتأسّفه لما آلت إليه الأمّة العربيّة من هوان وانكسار أمام أعدائها", "في فرح الشّاعر بانتصارات الأمّة",
                "في وصف الشّاعر جمال الطّبيعة", "في مدح الشّاعر للحكّام العرب"]},
   {"correct": 0}, ITAB_EXPL, 0.5, "ar.comprehension.emotion")
st("s04", "q2", "q2-e2", "multi", "مثّل لنبرة العتاب من النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["«لا بدّ أن نخجل من أشعارنا»", "«صراخنا أضخم من أصواتنا»", "«لبسنا قشرة الحضارة»", "«كلّفنا ارتجالنا خمسين ألف خيمة»",
                "«يا مطر الرّبيع»", "«يا سنابل الأمان»"]},
   {"correct": [0, 1, 2, 3]}, ITAB_EXPL + " أمّا «يا مطر الرّبيع» و«يا سنابل الأمان» فمن مقطع التّفاؤل.", 0.5, "ar.comprehension.evidence")
TR_EXPL = ("الحقيقة التّاريخيّة: الصّراع التّاريخيّ المتواصل بين العرب واليهود. الحقيقة السّياسيّة: تتجلّى في أنّ وهن العرب سبب في تمكّن الاستدمار "
           "والاستيطان اليهوديّ من هذه الأمّة.")
st("s05", "q3", "q3-e1", "mcq", "ما الحقيقة التّاريخيّة الّتي سجّلها الشّاعر؟",
   {"options": ["الصّراع التّاريخيّ المتواصل بين العرب واليهود", "أنّ وهن العرب سبب في تمكّن الاستدمار والاستيطان اليهوديّ",
                "ازدهار الحضارة العربيّة في العصر الحديث", "انتصار العرب في حرب حزيران"]},
   {"correct": 0}, TR_EXPL + " (والخيار الثّاني هو الحقيقة السّياسيّة لا التّاريخيّة.)", 0.75, "ar.comprehension.explain")
st("s06", "q3", "q3-e2", "fill_blank", "أكمل الحقيقة السّياسيّة:",
   {"text": "تتجلّى في أنّ ____ العرب سبب في تمكّن الاستدمار و____ اليهوديّ من هذه الأمّة.", "bank": ["وهن", "الاستيطان", "قوّة", "الانسحاب"]},
   {"blanks": [["وهن"], ["الاستيطان"]]}, TR_EXPL, 0.75, "ar.comprehension.explain")
CAUSE_EXPL = "علّل الشّاعر سبب مأساة الوطن العربيّ بـ: وهن شعوبه، وتخاذلها وتراجعها…"
st("s07", "q4", "q4-e1", "mcq", "بمَ علّل الشّاعر سبب مأساة الوطن العربيّ؟",
   {"options": ["بوهن شعوبه وتخاذلها وتراجعها", "بقوّة جيوشه وكثرة عتاده", "بالقضاء والقدر وقسوة الظّروف", "بقلّة الشّعراء فيه"]},
   {"correct": 0}, CAUSE_EXPL + " والشّاعر نفسه يقول: «لا تلعنوا السّماء… لا تلعنوا الظّروف».", 0.5, "ar.comprehension.explain")
st("s08", "q4", "q4-e1", "fill_blank", "أكمل التّعليل:",
   {"text": "علّل الشّاعر المأساة بـ: ____ شعوبه، و____ وتراجعها.", "bank": ["وهن", "تخاذلها", "قوّة", "وحدتها"]},
   {"blanks": [["وهن"], ["تخاذلها"]]}, CAUSE_EXPL, 0.5, "ar.comprehension.explain", "b")
HOPE_EXPL = ("نظرة الشّاعر إلى المستقبل متفائلة؛ يرى الشّاعر أنّ من يخلّص وسيحقّق النّصر للأمّة العربيّة هم أبناؤها سنابل الأمان، بناة الغد الأفضل، "
             "القادرون على تغيير وضع وحال أمّتهم…")
st("s09", "q5", "q5-e1", "mcq", "مَن سيحقّق النّصر للأمّة العربيّة في نظر الشّاعر؟",
   {"options": ["أبناؤها: الأطفال، سنابل الأمان", "الحكّام العرب", "الشّعراء", "الأمم الأخرى"]},
   {"correct": 0}, HOPE_EXPL, 0.5, "ar.comprehension.details")
st("s10", "q5", "q5-e2", "fill_blank", "وضّح:",
   {"text": "هم بُناة الغد ____، القادرون على تغيير وضع وحال ____.", "bank": ["الأفضل", "أمّتهم", "المجهول", "أعدائهم"]},
   {"blanks": [["الأفضل"], ["أمّتهم"]]}, HOPE_EXPL, 0.5, "ar.comprehension.explain")
TYPE_EXPL = ("النّمط الغالب في النّصّ هو النّمط الوصفيّ لأنّ الشّاعر بصدد وصف حالة الأمّة العربيّة وما تتخبّط فيه من مآسٍ وهوان وذلّ أمام عدوّها. "
             "المؤشّران: الأوصاف والنّعوت (وطني الحزين) والإضافات (شعر الحبّ، أوراقنا…). ملاحظة: يتخلّل النّصّ النّمط الإيعازيّ الّذي يخدم النّمط الغالب، "
             "وبإمكان التّلميذ أن يقدّم مؤشّرين آخرين.")
st("s11", "q6", "q6-e1", "mcq", "ما النّمط الغالب في النّصّ؟",
   {"options": ["الوصفيّ", "التّفسيريّ", "الحواريّ"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s12", "q6", "q6-e2", "mcq", "علّل غلبة هذا النّمط على النّصّ.",
   {"options": ["لأنّ الشّاعر بصدد وصف حالة الأمّة العربيّة وما تتخبّط فيه من مآسٍ وهوان وذلّ أمام عدوّها", "لأنّ الشّاعر يسرد أحداث الحرب بتسلسلها الزّمنيّ",
                "لأنّ الشّاعر يحاور شخصيّات متعدّدة", "لأنّ الشّاعر يشرح ظاهرة علميّة"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s13", "q6", "q6-e3", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط الوصفيّ بمثاله من النّصّ.",
   {"lefts": ["الأوصاف والنّعوت", "الإضافات"], "rights": ["«وطني الحزين»", "«شعر الحبّ»، «أوراقنا»", "«لا تلعنوا السّماء»"]},
   {"pairs": [0, 1]}, TYPE_EXPL + " أمّا «لا تلعنوا» فمن النّمط الإيعازيّ.", 0.5, "ar.text.type")
st("s14", "q6", "q6-e3", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الأوصاف والنّعوت", "الإضافات", "تتابع الأحداث في الزّمن", "أدوات الشّرح والتّفسير"]},
   {"correct": [0, 1]}, TYPE_EXPL, 0.5, "ar.text.type", "b")
NATHR_SPEC = {"task": "نثر المقطعين السّادس والسّابع بأسلوب المترشّح الخاصّ", "scope": "المقطعان 6 («لو أنّنا لم ندفن الوحدة…») و7 («يا أيّها الأطفال…»)",
              "text": "قصيدة نزار قبّاني (بكالوريا 2013، لغات أجنبيّة، الموضوع الأوّل)",
              "scheme": "مضمون النّصّ (0.5)، سلامة اللّغة (01)، الأسلوب (01)"}
NATHR_EXPL = "على المترشّح أن يراعي في نثر المقطعين السّادس والسّابع: مضمون النّصّ (0.5)، سلامة اللّغة (01)، الأسلوب (01). لا يقدّم التّصحيح نموذجًا."
for sid, eid, crit, ind, pts in [("s15", "q7-e1", "المضمون", "الوفاء بمضمون المقطعين", 0.5), ("s16", "q7-e2", "سلامة اللّغة", "سلامة اللّغة", 1),
                                 ("s17", "q7-e3", "الأسلوب", "أسلوب المترشّح الخاصّ", 1)]:
    essay(sid, "q7", eid, "نثر المقطعين السّادس والسّابع من قصيدة نزار قبّاني", crit, ind, pts, NATHR_SPEC, NATHR_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s18", "q8", "q8-e1", "mcq", "ما إعراب «تشكو» في قوله: «أرواحنا «تشكو» الإفلاس»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها التّعذّر", "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة"]},
   {"correct": 0}, "«تشكو»: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل (ذِكر الفاعل وعدمه سواء في التّنقيط).", 0.25, "ar.grammar.irab")
st("s19", "q8", "q8-e2", "mcq", "ما إعراب «الأطفال» في قوله: «يا أيّها «الأطفال»»؟",
   {"options": ["بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة", "منادى مبنيّ على الضّمّ في محلّ نصب", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة"]},
   {"correct": 0}, "«الأطفال»: بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة (المنادى هو «أيّ»).", 0.25, "ar.grammar.badal")
st("s20", "q8", "q8-e3", "mcq", "ما محلّ جملة (يكتب) في قوله: «حوّلتني بلحظة من شاعر (يكتب)»؟",
   {"options": ["جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(يكتب): جملة فعليّة في محلّ جرّ نعت (لـ«شاعر»).", 0.25, "ar.grammar.sentence_case")
st("s21", "q8", "q8-e4", "mcq", "ما محلّ جملة (سيهزم الهزيمة) في قوله: «أنتم الجيل الّذي (سيهزم الهزيمة)»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, "(سيهزم الهزيمة): جملة صلة الموصول لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
KHT_EXPL = ("أسلوب الخطاب بارز في النّصّ، لأنّ الشّاعر ثائر رافض لواقع أمّته المنهزمة، يريد إيقاظها ليدفع بها إلى الحرّيّة. ومثاله: «يا وطني»، «لا تلعنوا»، "
            "«يا أيّها الأطفال»……")
st("s22", "q9", "q9-e1", "mcq", "لماذا برز أسلوب الخطاب في النّصّ؟",
   {"options": ["لأنّ الشّاعر ثائر رافض لواقع أمّته المنهزمة، يريد إيقاظها ليدفع بها إلى الحرّيّة", "لأنّ الشّاعر يريد التّغزّل بمحبوبته",
                "لأنّ الشّاعر راضٍ عن واقع أمّته", "لأنّ الشّاعر يحكي قصّة حياته الخاصّة"]},
   {"correct": 0}, KHT_EXPL, 0.5, "ar.rhetoric.style")
st("s23", "q9", "q9-e2", "multi", "مثّل لأسلوب الخطاب من النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["«يا وطني»", "«لا تلعنوا»", "«يا أيّها الأطفال»", "«السّرّ في مأساتنا»", "«خمسة آلاف سنة»"]},
   {"correct": [0, 1, 2]}, KHT_EXPL, 0.5, "ar.rhetoric.style")
LNK_EXPL = ("وظّف الشّاعر مجموعة من الرّوابط مثل: الضّمير: ضمير المتكلّمين (نحن) ربط بين معظم مقاطع النّصّ – حروف العطف: الواو والفاء، فالواو مثلًا ربطت بين "
            "عبارتي «شعر الحبّ» و«الحنين»… – حروف الجرّ: من وفي (يكتفي المترشّح بنوعين).")
st("s24", "q10", "q10-e1", "matching", "طابق كلّ رابط بدوره في بناء النّصّ.",
   {"lefts": ["ضمير المتكلّمين «نحن»", "حرف العطف «الواو»"],
    "rights": ["ربط بين معظم مقاطع النّصّ", "ربط بين عبارتي «شعر الحبّ» و«الحنين»", "فصل بين المقاطع وقطع صلتها"]},
   {"pairs": [0, 1]}, LNK_EXPL, 0.5, "ar.cohesion.connectors")
st("s25", "q10", "q10-e1", "multi", "ما أنواع الرّوابط الّتي وظّفها الشّاعر في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الضّمير (نحن)", "حروف العطف (الواو، الفاء)", "حروف الجرّ (من، في)", "أسماء الإشارة (هذا، هذه)"]},
   {"correct": [0, 1, 2]}, LNK_EXPL, 0.5, "ar.cohesion.connectors", "b")
IMG_EXPL = ("(لبسنا قشرة الحضارة): استعارة مكنيّة؛ شبّه الشّاعر الحضارة بلباس يُرتدى ويُلبس، وحذف اللّباس وذكر القرينة الدّالّة عليه وهي «لبسنا». "
            "سرّ بلاغتها: توضيح المعنى بتجسيد المعنويّ (الحضارة) في صورة محسوسة (اللّباس). (يمكن أن يشير المترشّح إلى استعارة مكنيّة أخرى في «قشرة الحضارة».) "
            "(نحن في السّرداب): كناية عن صفة العزلة والتّهميش… سرّ بلاغتها: وضع المعنى في صورة محسوسة ترتاح لها النّفس.")
st("s26", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في (لبسنا قشرة الحضارة)؟",
   {"options": ["استعارة مكنيّة", "كناية عن موصوف", "مجاز مرسل علاقته السّببيّة", "تشبيه تمثيليّ"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s27", "q11", "q11-e2", "mcq", "ما سرّ بلاغة الصّورة في (لبسنا قشرة الحضارة)؟",
   {"options": ["توضيح المعنى بتجسيد المعنويّ (الحضارة) في صورة محسوسة (اللّباس)", "تقديم الحقيقة مصحوبة بالدّليل", "إحداث جرس موسيقيّ بتوافق الحروف",
                "التّعبير عن الكلّ بالجزء"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
st("s28", "q11", "q11-e3", "mcq", "ما نوع الصّورة البيانيّة في (نحن في السّرداب)؟",
   {"options": ["كناية عن صفة (العزلة والتّهميش)", "كناية عن موصوف", "كناية عن نسبة", "تشبيه بليغ"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s29", "q11", "q11-e4", "mcq", "ما سرّ بلاغة الكناية في (نحن في السّرداب)؟",
   {"options": ["وضع المعنى في صورة محسوسة ترتاح لها النّفس", "المبالغة بادّعاء أنّ المشبّه عين المشبّه به", "إحداث جرس موسيقيّ تطرب له الأذن", "التّعبير عن الجزء بالكلّ"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
PRO_EXPL = ("التّقطيع (الإجابة النّموذجيّة): «أَسْسِرْرُ فِيْ مَأْسَاتِنَا» = /0/0//0 /0/0//0 = مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ؛ «صُرَاْخُنَا أَضْخَمُ مِنْ أَصْوَاتِنَا» = "
            "//0//0 /0///0 /0/0//0 (التّفعيلة الأولى مُتَفْعِلُنْ والأخيرة مُسْتَفْعِلُنْ). ألاحظ أنّ: الشّاعر بنى السّطرين على تفعيلة الرّجز – لم يوزّع التّفعيلات "
            "توزيعًا عادلًا على السّطرين – حدوث تغييرات في التّفعيلة: مُسْتَفْعِلُنْ ← مُتَفْعِلُنْ… التّعليل: غالبًا ما يُنظم الشّعر الحرّ في البحور الصّافية – "
            "في الشّعر الحرّ لا يلتزم الشّاعر بعدد معيّن من التّفعيلات في الأسطر.")
st("s30", "q12", "q12-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «السّرّ في مأساتنا»:",
   {"text": "____ فِيْ ____", "bank": ["أَسْسِرْرُ", "مَأْسَاتِنَا", "السّرّ", "مَأساةُ"]},
   {"blanks": [["أَسْسِرْرُ"], ["مَأْسَاتِنَا"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s31", "q12", "q12-e1", "mcq", "ما رموز السّطر «السّرّ في مأساتنا» وتفعيلاته؟",
   {"options": ["/0/0//0 /0/0//0 = مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ", "//0//0 //0//0 = مُتَفْعِلُنْ مُتَفْعِلُنْ", "/0//0 /0//0 = فَاعِلُنْ فَاعِلُنْ",
                "///0//0 ///0//0 = مُتَفَاعِلُنْ مُتَفَاعِلُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s32", "q12", "q12-e2", "mcq", "ما الرّموز العروضيّة للسّطر «صراخنا أضخم من أصواتنا»؟",
   {"options": ["//0//0 /0///0 /0/0//0", "/0/0//0 /0/0//0 /0/0//0", "//0//0 //0//0 //0//0", "///0//0 /0///0 /0/0//0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s33", "q12", "q12-e2", "mcq", "ما التّفعيلة الأخيرة في السّطر «…أضخم من أصواتنا» (أَصْوَاتِنَا)؟",
   {"options": ["مُسْتَفْعِلُنْ", "مُتَفْعِلُنْ", "فَاعِلُنْ", "مُتَفَاعِلُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s34", "q12", "q12-e3", "multi", "ماذا تلاحظ على السّطرين؟ (اختر كلّ ما يصحّ)",
   {"options": ["بنى الشّاعر السّطرين على تفعيلة الرّجز", "لم يوزّع التّفعيلات توزيعًا عادلًا على السّطرين", "حدوث تغييرات في التّفعيلة (مُسْتَفْعِلُنْ ← مُتَفْعِلُنْ)",
                "بنى السّطرين على تفعيلة الكامل", "التزم الشّاعر عددًا ثابتًا من التّفعيلات في كلّ سطر"]},
   {"correct": [0, 1, 2]}, PRO_EXPL, 0.5, "ar.prosody")
st("s35", "q12", "q12-e4", "mcq", "علّل ما لاحظته.",
   {"options": ["غالبًا ما يُنظم الشّعر الحرّ في البحور الصّافية، ولا يلتزم فيه الشّاعر بعدد معيّن من التّفعيلات في الأسطر",
                "لأنّ الشّعر الحرّ يلتزم نظام الشّطرين ووحدة القافية", "لأنّ الرّجز من البحور الممزوجة (المركّبة)", "لأنّ الشّاعر أخطأ في الوزن"]},
   {"correct": 0}, PRO_EXPL, 0.5, "ar.literature.renewal")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("انطلاقًا من مقولة الكاتب مفيد محمّد قميحة يتّضح لنا أنّ الشّاعر نزار قبّاني حقّق فعلًا صورة الأديب الملتزم لكلّ ما تعنيه حقيقة الالتزام وذلك لأنّه: "
             "صوّر هذه الأمّة أنّها أمّة تعيش على وقع الانكسار والتّخاذل أمام الأعداء – مزج بين المأساة السّياسيّة والبعد التّاريخيّ للأمّة العربيّة الّتي تنتظر من "
             "يبعثها من جديد – عبّر عن روح الانتماء العربيّ والدّينيّ – عبّر عن مسحة الحزن والأسى الّذي طبعت إحساسه – رفض الواقع السّياسيّ والحضاريّ الّذي "
             "تعيشه أمّته. (يمكن أن يضيف المترشّح عبارات أخرى صحيحة، ويكتفي بثلاث عبارات.)")
st("s36", "q13", "q13-e1", "mcq", "انطلاقًا من مقولة مفيد محمّد قميحة، هل حقّق نزار قبّاني في نصّه صورة الأديب الملتزم بقضايا أمّته؟",
   {"options": ["نعم، حقّق فعلًا صورة الأديب الملتزم لكلّ ما تعنيه حقيقة الالتزام", "لا، لأنّه انصرف إلى التّغنّي بذاته وأحزانه الخاصّة",
                "لا، لأنّه دعا إلى الاستسلام للواقع", "لا، لأنّه اكتفى بوصف الطّبيعة"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.trend")
st("s37", "q13", "q13-e2", "multi", "وضّح: ما الّذي يُثبت التزام الشّاعر في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["صوّر هذه الأمّة أنّها تعيش على وقع الانكسار والتّخاذل أمام الأعداء", "مزج بين المأساة السّياسيّة والبعد التّاريخيّ للأمّة العربيّة",
                "عبّر عن روح الانتماء العربيّ والدّينيّ", "عبّر عن مسحة الحزن والأسى الّذي طبعت إحساسه", "رفض الواقع السّياسيّ والحضاريّ الّذي تعيشه أمّته",
                "مجّد الحكّام وبرّر الهزيمة", "دعا إلى الفنّ للفنّ بعيدًا عن قضايا الأمّة"]},
   {"correct": [0, 1, 2, 3, 4]}, CRIT_EXPL, 1.5, "ar.literature.trend")
st("s38", "q13", "q13-e2", "fill_blank", "أكمل ما يوضّح التزام الشّاعر:",
   {"text": "لأنّه صوّر هذه الأمّة أنّها تعيش على وقع ____ والتّخاذل أمام الأعداء، وعبّر عن روح ____ العربيّ والدّينيّ، ورفض الواقع السّياسيّ و____ الّذي تعيشه أمّته.",
    "bank": ["الانكسار", "الانتماء", "الحضاريّ", "الانتصار", "الانفصال", "الرّياضيّ"]},
   {"blanks": [["الانكسار"], ["الانتماء"], ["الحضاريّ"]]}, CRIT_EXPL, 1.5, "ar.literature.trend", "b")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (نزار قبّاني: يا وطني الحزين)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
                  f"مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
                  "أُصلح من الموضوع الرّسميّ: «لأّنا» ← «لأنّنا»، «جِرَبوا» ← «جرّبوا»، «أيَها» ← «أيّها». ترقيم أسئلة البناء اللّغويّ وفق الموضوع الرّسميّ. "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 1–2، ملفّ ممسوح قُرئ مصوّرًا؛ التّقطيع بدقّة 300–400). "
                  "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. اسم التّفعيلة الثّانية من السّطر الثّاني غير واضح في التّصحيح (رموزها /0///0) فلم يُسأل عنه. "
                  "مؤجَّل (essay_builder): نثر المقطعين 6 و7 (0.5 + 01 + 01)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
