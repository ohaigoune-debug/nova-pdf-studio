"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ، في الأمّيّة).
Exam (most faithful source): gdrive 1h8lHebIdx9wqNc_1oyzogoBptc4iKaVD (بكالوريا العربية 2013 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 1iQ-hNe-l7dV4C1vwihsYPmk_QjqTxhR5;
official ONEC paper: gdrive 1ipMfhXVnCu7L1M3Dk9ntId7sl9fFggCZ (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1LM6stJOEJ8D1AXk6W-B38JOPcld-WTgs (02_التصحيح.pdf, pages 3–4).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed; the inner RLM after «هيأ» is kept) and
re-checked programmatically against it. The three text paragraphs are docx paragraphs. Questions spread over several docx
paragraphs are joined: wrapped lines with a space («…خُلق مستعدا» / «للكمال.», «…ثلاثة منها» / «مع تحديد…», «…وأثرهما
في» / «المعنى.»), separate items with «\n». The docx «الأسئلة: أوّلا- البناء الفكري…» is one paragraph: the part label is
its text after «الأسئلة:». Numbering follows the ONEC paper (Part 2 Q1 = إعراب المفردات + محلّ الجملتين). The docx was
compared line by line with the ONEC paper (150 dpi): same text and questions (diacritics / hamza variants only, e.g.
docx «التفتوا», ONEC «إلتفتوا») ⇒ docx kept. Both PDFs are scans, so the scheme was read from the rendered pages
(Part 3 at 200 dpi).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «لغات أجنبيّة» ⇒ LANG.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required
  distinct items, or distinct demands ⇒ one element per item.
- Q1 «2×01» = the topic / its danger. Q2 «2×0.5» «هل ترى الموضوع جزءًا من اهتماماتك؟ لماذا؟» = the candidate's own
  opinion and reason (model «أرى بأنّه جزء من اهتماماتي، لأنّه بحقّ وباء…») ⇒ two deferred essay_builder elements
  (guide rule 11). Q3 «2×0.5» the two features listed + 0.5 an example from our reality (the model example is the
  correct option; distractors are not examples). Q4 «2×01» = how (التّربية الصّحيحة / تنويره بالعلم) / why («ذلك أنّ
  التّربية هي المقوّم…») — split read from the two demands «وضّح وعلّل». Q5 «2×0.5» = the aim (إصلاحيّ) / its explanation.
- Q6 (تلخيص) 01 مضمون النّصّ / 01 أسلوب المترشّح ولغته / 0.5 حجم النّصّ ⇒ three deferred essay_builder elements.
- Part 2 Q1 «2×0.5» words + «2×0.25» sentences. «مستعدا» حال (no «خبر» distractor). «(يوافق المزاج الخاصّ)»: the scheme
  says صلة موصول; «نعت» (if «ما» is read as an indefinite) is deliberately NOT a distractor.
- Q2 «3×0.5» = المقدّمة / العرض / الخاتمة ⇒ three elements. Q3 «3×0.25» = إنّ وأنّ (للتّوكيد) / حروف العطف (الواو) /
  حروف الجرّ (في، عن) ⇒ three elements. Q4 0.25 the type (التّفسيريّ; «الحجاجيّ» is not a distractor) + 0.25 + 0.25 the two
  indicators listed (التّركيز على الموضوعيّة / أدوات التّفسير). Q5 «2×0.25» per image (extraction + type: «تنغمس في النّقائص»
  استعارة مكنيّة, «يتبيّنون الطّريق» كناية عن صفة) + 0.5 their effect («قد يستخرج المترشّح صورًا أخرى» ⇒ the extraction
  distractors are literal phrases; «استعارة تصريحيّة» is not a distractor for «يتبيّنون الطّريق»).
- Part 3 (04): marks 01 / 01 / «2×0.5» / 01 printed against: the judgment («يعدّ… من كتّاب الصّنعة اللّفظيّة»), the
  choice of eloquent words, the many images, the embellishments (طباق، جناس) — alignment read from the layout, to
  confirm. The scheme's «الجناس في: تتقاعس وتتنافس» is a misprint of the text's «تتقاعس… وتتناعس» ⇒ the text's words are used.
- Deferred: Q2 (1) + Q6 (2.5) = 3.5. Distractors are the converter's own and need review.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-lang-p2"
DOCX_ID = "1h8lHebIdx9wqNc_1oyzogoBptc4iKaVD"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة لغات اجنبية.docx"
PDF_ID = "1iQ-hNe-l7dV4C1vwihsYPmk_QjqTxhR5"
OFFICIAL_ID = "1ipMfhXVnCu7L1M3Dk9ntId7sl9fFggCZ"
CORR_ID = "1LM6stJOEJ8D1AXk6W-B38JOPcld-WTgs"
SOURCE_STREAMS = ["LANG"]

# ── الموضوع الثّاني (مولَّد من docx) ──
P2_PARAS = ["إن الكمال والنقص وصفان يتعاقبان على الفرد كما يتعاقبان على المجموع، وهذا الإنسان العاقل خلق «مستعدا» للكمال، وقد هيأ‏ له خالقه الحكيم أسبابه ومكّن له وسائله، ونصب له في داخل نفسه وخارجها أمثالا يحتذيها لبلوغ الكمال. متى قعد الأفراد عن تعاطي أسباب الكمال فشت النقائص في المجموع. وإِنما تتفاوت حظوظ الأمم في الكمالات المكتسبة كالغنى والعلم والتضامن والتعاون والاتحاد والترقي في أسباب المعيشة. ويتّضح من هذا كله أن كل ما يسمّى من أحوال الأمم تطوّرا هو في الحقيقة عبارة عن مداورتها بين النقص والكمال صعودا وهبوطا. وإن سنّة الله في الأمم أنها تتقاعس عن الفضائل وتتناعس عن الكسب وتنغمس في النقائص فتتدهور إلى الحدّ الذي تقتضيه قوة تلك النقائص وأسبابها. ومن الأمثلة الصريحة التي لا تحتاج إلى ترتيب الأقيسة في الاستدلال عليها، نقيصة الأَميّة. فإنّها لا «تفشو» في أمّة وتشيع بين أفرادها إلا فتكت بها وألحقتها بأخس أنواع الحيوانات، ومكّنت فيها للجهل والسقوط والذلة والمهانة والاستعباد.", "والأمية (تتفاوت) شناعتها وقبحها في الأمم بتفاوت عهود البداوة والخضرمة والحضارة، فيَهُون أمرها نوعا في الأمم البدوية القريبة من مناحي الفطرة في مظاهر حياتها. إن الأمم الحيّة في وقتنا هذا ما حييت إلا بالعلم الاختباري التطبيقي، وأساس هذا العلم - وإن علا - القراءة والكتابة. ولمّا انتهى العلماء منهم إلى أبعد غاية في العلم وتسنّموا منه أعلى ذروة، التفتوا يتبيّنون الطريق التي وصلوا منها إلى هذه الغايات البعيدة. إِني أظن أن أوّل هيئة اجتماعية فكّرت في محاربة الأمية بصورة منظّمة في هذا الوطن هي جمعية العلماء المسلمين الجزائريين، وأن أوّل رجل أعرفه فكر في مقاومة الأميّة بصورة جدّية هو رئيسها المحترم.", "والأمّية بالنسبة إلينا صارت مرضا نفسانيا، والأمراض النفسانية لا تُداوى إلا بما (يوافق المزاج الخاص). وكلنا يعلم أن تعميم التعليم بقدر المستطاع قَطْعٌ لانتشار الأَميّة وتضييق لدائرتها."]
P2_REF = "- محمد البشير الإبراهيمي من كتابه: آثار الإبراهيمي ج1-"
P2_QP = ["أوّلا- البناء الفكري: (10 نقاط)", "ما الموضوع الذي تناوله الكاتب؟ وما خطورته على الأمّة كما يتضح لك من النّص؟", "هل ترى الموضوع جزءا من اهتماماتك؟ لماذا؟", "انطلاقا من النّص، حدد مواصفات الأمّة الحيّة، مع ذكر مثال من واقع أمتنا.", "كيف تتمّ عملية إصلاح المجتمع؟ وضّح وعلل.", "ما الهدف الذي يرمي إليه الكاتب من خلال النّص؟ وضح.", "لخّص النّص في بضعة أسطر.", "ثانيا- البناء اللّغوي: (06 نقاط)", "أعرب ما يلي إعراب مفردات:\nكلمة: «مستعدا» الواردة في الفقرة الأولى في قول الكاتب: وهذا الإنسان العاقل خُلق مستعدا للكمال.\nوكلمة: «تفشو» الواردة في الفقرة الأولى في قوله: فإنّها لا تفشو في أمّة.\nما محل الجملتين التاليتين من الإعراب:\n(تتفاوت) الواقعة في الفقرة الثانية، و(يوافق المزاج الخاص) الواقعة في الفقرة الأخيرة؟", "النّص ينتمي إلى فن المقال، الذي من خصائصه الوحدة الموضوعية. بين كيف تحققت هذه الخاصية فيه", "وظف الكاتب بعض الروابط التي أسهمت في اتّساق وانسجام فقرات النّص. استخرج ثلاثة منها مع تحديد نوع كلّ منها", "حدّد نمط النّص الغالب، ثم اذكر بعض مؤشراته.", "اعتمد الكاتب على البيان. استخرج صورتين مختلفتين منه، مبيّنا نوع كل منهما، وأثرهما في المعنى.", "ثالثا- التّقويم النقدي: (04 نقاط)", "\" يعد محمد البشير الإبراهيمي من كتّاب الصنعة اللَّفظية الذين يتأنقون في أسلوبهم معجما وبلاغة \".", "المطلوب: هل تحقق ذلك في النّص الذي بين يديك؟ وضّح مع التمثيل."]

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
assert len(P2_PARAS) == 3 and QP[0].startswith("أوّلا") and QP[7].startswith("ثانيا") and QP[13].startswith("ثالثا") and len(QP) == 16
assert "«مستعدا»" in P2_PARAS[0] and "«تفشو»" in P2_PARAS[0] and "(تتفاوت)" in P2_PARAS[1] and "(يوافق المزاج الخاص)" in P2_PARAS[2]
P1, P2, P3 = QP[0], QP[7], QP[13]
J = lambda *ix: "\n".join(QP[i] for i in ix)
DOCS = [{"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
        {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF}]

q("q1", "1", P1, QP[1], 2, [el("q1-e1", "الموضوع الّذي تناوله الكاتب", 1), el("q1-e2", "خطورته على الأمّة", 1)], DOCS)
q("q2", "2", P1, QP[2], 1, [el("q2-e1", "الرّأي", 0.5), el("q2-e2", "التّعليل", 0.5)], DOCS)
q("q3", "3", P1, QP[3], 1.5, [el("q3-e1", "مواصفة الأمّة الحيّة: العناية بالعلم وروّاده", 0.5), el("q3-e2", "مواصفة الأمّة الحيّة: محاربة الجهل والأمّيّة", 0.5),
                               el("q3-e3", "مثال من واقع أمّتنا", 0.5)], DOCS)
q("q4", "4", P1, QP[4], 2, [el("q4-e1", "كيفيّة إصلاح المجتمع (التّوضيح)", 1), el("q4-e2", "التّعليل", 1)], DOCS)
q("q5", "5", P1, QP[5], 1, [el("q5-e1", "الهدف", 0.5), el("q5-e2", "توضيحه", 0.5)], DOCS)
q("q6", "6", P1, QP[6], 2.5, [el("q6-e1", "التّلخيص: مضمون النّصّ", 1), el("q6-e2", "التّلخيص: أسلوب المترشّح ولغته", 1), el("q6-e3", "التّلخيص: حجم النّصّ", 0.5)], DOCS)
q("q7", "1", P2, QP[8], 1.5, [el("q7-e1", "إعراب «مستعدا»", 0.5), el("q7-e2", "إعراب «تفشو»", 0.5),
                               el("q7-e3", "محلّ جملة (تتفاوت)", 0.25), el("q7-e4", "محلّ جملة (يوافق المزاج الخاص)", 0.25)], DOCS)
q("q8", "2", P2, QP[9], 1.5, [el("q8-e1", "الوحدة الموضوعيّة: المقدّمة", 0.5), el("q8-e2", "الوحدة الموضوعيّة: العرض", 0.5), el("q8-e3", "الوحدة الموضوعيّة: الخاتمة", 0.5)], DOCS)
q("q9", "3", P2, QP[10], 0.75, [el("q9-e1", "رابط: إنّ وأنّ", 0.25), el("q9-e2", "رابط: حروف العطف", 0.25), el("q9-e3", "رابط: حروف الجرّ", 0.25)], DOCS)
q("q10", "4", P2, QP[11], 0.75, [el("q10-e1", "النّمط الغالب", 0.25), el("q10-e2", "مؤشّر: التّركيز على الموضوعيّة", 0.25), el("q10-e3", "مؤشّر: أدوات التّفسير", 0.25)], DOCS)
q("q11", "5", P2, QP[12], 1.5, [el("q11-e1", "الصّورة الأولى: الاستخراج", 0.25), el("q11-e2", "الصّورة الأولى: النّوع", 0.25),
                                 el("q11-e3", "الصّورة الثّانية: الاستخراج", 0.25), el("q11-e4", "الصّورة الثّانية: النّوع", 0.25), el("q11-e5", "أثرهما في المعنى", 0.5)], DOCS)
q("q12", "1", P3, J(14, 15), 4, [el("q12-e1", "الحكم: تحقّق ذلك في النّصّ", 1), el("q12-e2", "انتقاء اللّغة الفصيحة مع التّمثيل", 1),
                                  el("q12-e3", "الإكثار من الصّور البليغة مع التّمثيل (2×0.5)", 1), el("q12-e4", "المحسّنات البديعيّة مع التّمثيل", 1)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
TOP_EXPL = ("الموضوع الّذي تناوله الكاتب هو: الأمّيّة وآثارها السّلبيّة على الفرد والمجتمع. خطورته على الأمّة من خلال النّصّ: أنّها تُلحق الفرد والمجتمع "
            "بأخسّ أنواع الحيوانات، كما تجعله في مذلّة ومهانة واستعباد.")
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي تناوله الكاتب؟",
   {"options": ["الأمّيّة وآثارها السّلبيّة على الفرد والمجتمع", "الاستعمار الفرنسيّ وجرائمه", "الهجرة من الرّيف إلى المدن", "تاريخ جمعيّة العلماء المسلمين"]},
   {"correct": 0}, TOP_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "الموضوع: ____ وآثارها ____ على الفرد والمجتمع.", "bank": ["الأمّيّة", "السّلبيّة", "الهجرة", "الإيجابيّة"]},
   {"blanks": [["الأمّيّة"], ["السّلبيّة"]]}, TOP_EXPL, 0.5, "ar.comprehension.idea", "b")
st("s03", "q1", "q1-e2", "multi", "ما خطورة الأمّيّة على الأمّة كما يتّضح من النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تُلحق الفرد والمجتمع بأخسّ أنواع الحيوانات", "تجعل المجتمع في مذلّة ومهانة واستعباد", "تزيد الأمّة قوّة وتماسكًا", "ترفع الأمّة إلى أعلى ذروة في العلم"]},
   {"correct": [0, 1]}, TOP_EXPL, 0.5, "ar.comprehension.details")
st("s04", "q1", "q1-e2", "fill_blank", "أكمل خطورة الأمّيّة:",
   {"text": "أنّها تُلحق الفرد والمجتمع بأخسّ أنواع ____، كما تجعله في مذلّة ومهانة و____.", "bank": ["الحيوانات", "استعباد", "النّاس", "استقلال"]},
   {"blanks": [["الحيوانات"], ["استعباد"]]}, TOP_EXPL, 0.5, "ar.comprehension.details", "b")
OP_SPEC = {"task": "إبداء الرّأي: هل الموضوع (الأمّيّة) جزء من اهتمامات المترشّح؟ مع التّعليل", "question": QP[2],
           "model": "الإجابة النّموذجيّة: «أرى بأنّه جزء من اهتماماتي، لأنّه بحقّ وباء وطاعون يفتك بالمجتمع وينخره في عمقه» (2×0.5)."}
essay("s05", "q2", "q2-e1", "هل ترى موضوع الأمّيّة جزءًا من اهتماماتك؟", "الرّأي", "إبداء رأي واضح في الموضوع", 0.5, OP_SPEC,
      "مثال الإجابة النّموذجيّة: أرى بأنّه جزء من اهتماماتي.", "ar.comprehension.opinion")
essay("s06", "q2", "q2-e2", "هل ترى موضوع الأمّيّة جزءًا من اهتماماتك؟", "التّعليل", "تعليل الرّأي", 0.5, OP_SPEC,
      "مثال الإجابة النّموذجيّة: لأنّه بحقّ وباء وطاعون يفتك بالمجتمع وينخره في عمقه.", "ar.comprehension.opinion")
LIVE_EXPL = ("مواصفات الأمّة الحيّة انطلاقًا من النّصّ: أنّها أمّة تُعير العلم أهمّيّة قصوى، وتحترم روّاده الّذين يوجّهون المجتمع توجيهًا سليمًا – تحارب الجهل "
             "والأمّيّة. مثال من واقع أمّتنا: الوطن الجزائريّ العزيز الّذي ما فتئ يولي أهمّيّة كبرى للعلم والمعرفة ومحاربة الأمّيّة، وذلك بفتح وإنجاز المؤسّسات "
             "التّربويّة والجامعيّة ودور محو الأمّيّة.")
st("s07", "q3", "q3-e1", "mcq", "من مواصفات الأمّة الحيّة انطلاقًا من النّصّ:",
   {"options": ["أنّها تُعير العلم أهمّيّة قصوى وتحترم روّاده الّذين يوجّهون المجتمع توجيهًا سليمًا", "أنّها تتقاعس عن الفضائل وتتناعس عن الكسب",
                "أنّها تنغمس في النّقائص", "أنّها تعيش على البداوة بعيدًا عن العلم"]},
   {"correct": 0}, LIVE_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "fill_blank", "أكمل مواصفة أخرى للأمّة الحيّة:",
   {"text": "الأمّة الحيّة ____ الجهل و____.", "bank": ["تحارب", "الأمّيّة", "تنشر", "العلم"]},
   {"blanks": [["تحارب"], ["الأمّيّة"]]}, LIVE_EXPL, 0.5, "ar.comprehension.details")
st("s09", "q3", "q3-e3", "mcq", "أيّ ممّا يلي مثال من واقع أمّتنا على عناية الأمّة الحيّة بالعلم ومحاربة الأمّيّة؟",
   {"options": ["فتح وإنجاز المؤسّسات التّربويّة والجامعيّة ودور محو الأمّيّة في الجزائر", "غلق المدارس في المناطق النّائية", "إهمال روّاد العلم وتهميشهم",
                "الاكتفاء بالعلم النّظريّ دون تطبيق"]},
   {"correct": 0}, LIVE_EXPL, 0.5, "ar.comprehension.values")
REF_EXPL = ("تتمّ عمليّة إصلاح المجتمع بمسألتين أساسيّتين هما: التّربية الصّحيحة والتّوجيه السّليم – تنويره عن طريق العلم والمعرفة. ذلك أنّ التّربية هي المقوّم "
            "والمربّي الحقيقيّ للمجتمعات، والعلم هو الباني لها والقاطع لانتشار الأمّيّة.")
st("s10", "q4", "q4-e1", "multi", "كيف تتمّ عمليّة إصلاح المجتمع؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّربية الصّحيحة والتّوجيه السّليم", "تنويره عن طريق العلم والمعرفة", "عزله عن العالم الخارجيّ", "الاكتفاء برفع الشّعارات"]},
   {"correct": [0, 1]}, REF_EXPL, 1, "ar.comprehension.idea")
st("s11", "q4", "q4-e2", "mcq", "علّل قيام الإصلاح على هاتين المسألتين.",
   {"options": ["لأنّ التّربية هي المقوّم والمربّي الحقيقيّ للمجتمعات، والعلم هو الباني لها والقاطع لانتشار الأمّيّة", "لأنّ المال وحده يكفي لبناء المجتمعات",
                "لأنّ الأمّيّة لا تضرّ المجتمع", "لأنّ الإصلاح يأتي من الخارج"]},
   {"correct": 0}, REF_EXPL, 0.5, "ar.comprehension.explain")
st("s12", "q4", "q4-e2", "fill_blank", "أكمل التّعليل:",
   {"text": "ذلك أنّ ____ هي المقوّم والمربّي الحقيقيّ للمجتمعات، و____ هو الباني لها والقاطع لانتشار الأمّيّة.", "bank": ["التّربية", "العلم", "الثّروة", "الجهل"]},
   {"blanks": [["التّربية"], ["العلم"]]}, REF_EXPL, 0.5, "ar.comprehension.explain", "b")
AIM_EXPL = "الهدف الّذي يرمي إليه الكاتب: هدف إصلاحيّ، حيث حاول إبراز مدى خطورة الأمّيّة، وفي المقابل بيّن أهمّيّة العلم وتبجيل روّاده."
st("s13", "q5", "q5-e1", "mcq", "ما الهدف الّذي يرمي إليه الكاتب من خلال النّصّ؟",
   {"options": ["هدف إصلاحيّ", "هدف ترفيهيّ", "هدف تجاريّ", "هدف انتخابيّ"]},
   {"correct": 0}, AIM_EXPL, 0.5, "ar.comprehension.purpose")
st("s14", "q5", "q5-e2", "fill_blank", "وضّح:",
   {"text": "حاول إبراز مدى خطورة ____، وفي المقابل بيّن أهمّيّة ____ وتبجيل روّاده.", "bank": ["الأمّيّة", "العلم", "الثّروة", "البداوة"]},
   {"blanks": [["الأمّيّة"], ["العلم"]]}, AIM_EXPL, 0.5, "ar.comprehension.purpose")
SUM_SPEC = {"task": "تلخيص النّصّ في بضعة أسطر", "text": "مقال محمّد البشير الإبراهيميّ في الأمّيّة (بكالوريا 2013، لغات أجنبيّة، الموضوع الثّاني)",
            "scheme": "مضمون النّصّ (01)، أسلوب المترشّح ولغته (01)، حجم النّصّ (0.5)", "model_example": None}
SUM_EXPL = "يُراعى في التّلخيص: مضمون النّصّ (01)، أسلوب المترشّح ولغته (01)، حجم النّصّ (0.5). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for sid, eid, crit, ind, pts in [("s15", "q6-e1", "المضمون", "الوفاء بمضمون النّصّ", 1), ("s16", "q6-e2", "الأسلوب واللّغة", "أسلوب المترشّح ولغته", 1),
                                 ("s17", "q6-e3", "الحجم", "مراعاة حجم التّلخيص", 0.5)]:
    essay(sid, "q6", eid, "تلخيص مقال الإبراهيميّ في الأمّيّة", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s18", "q7", "q7-e1", "mcq", "ما إعراب «مستعدا» في قوله: «وهذا الإنسان العاقل خُلق مستعدا للكمال»؟",
   {"options": ["حال منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«مستعدًّا»: حال منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s19", "q7", "q7-e2", "mcq", "ما إعراب «تفشو» في قوله: «فإنّها لا تفشو في أمّة»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل", "فعل مضارع مجزوم بـ«لا» النّاهية وعلامة جزمه حذف حرف العلّة",
                "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فعل مضارع منصوب وعلامة نصبه الفتحة المقدّرة على الواو"]},
   {"correct": 0}, "«تفشو»: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل («لا» نافية؛ لا يُحاسب المترشّح عن عدم الإشارة إلى الفاعل).", 0.5, "ar.grammar.irab")
st("s20", "q7", "q7-e3", "mcq", "ما محلّ جملة (تتفاوت) في قوله: «والأمّيّة (تتفاوت) شناعتها وقبحها»؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "(تتفاوت): جملة فعليّة في محلّ رفع خبر (للمبتدأ «الأمّيّة»).", 0.25, "ar.grammar.sentence_case")
st("s21", "q7", "q7-e4", "mcq", "ما محلّ جملة (يوافق المزاج الخاصّ) في قوله: «لا تُداوى إلّا بما (يوافق المزاج الخاصّ)»؟",
   {"options": ["جملة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(يوافق المزاج الخاصّ): جملة صلة موصول لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
UNI_EXPL = ("نعم تحقّقت هذه الخاصّيّة في النّصّ لاعتماده المنهجيّة التّالية: المقدّمة: مهّد فيها بتبيان مواطن الكمال والنّقص في المجتمع. العرض: شرح وفصّل فيه "
            "موضوع الأمّيّة. الخاتمة: خلص في نهاية الموضوع إلى استنتاج وهو أنّ الأمّيّة مرض، والسّبيل الأمثل لبتر دائها هو العلم. وخلاصة ذلك أنّ الكاتب تناول "
            "موضوعًا واحدًا في نصّه.")
st("s22", "q8", "q8-e1", "mcq", "بمَ مهّد الكاتب في مقدّمة النّصّ؟",
   {"options": ["بتبيان مواطن الكمال والنّقص في المجتمع", "بالحديث عن جمعيّة العلماء المسلمين", "بالدّعوة إلى تعميم التّعليم", "بوصف حياة البداوة"]},
   {"correct": 0}, UNI_EXPL, 0.5, "ar.literature.prose")
st("s23", "q8", "q8-e2", "mcq", "ما الّذي شرحه الكاتب وفصّله في العرض؟",
   {"options": ["موضوع الأمّيّة", "تاريخ الجزائر القديم", "فوائد التّجارة", "سيرة رئيس الجمعيّة"]},
   {"correct": 0}, UNI_EXPL, 0.5, "ar.literature.prose")
st("s24", "q8", "q8-e3", "fill_blank", "أكمل الخاتمة:",
   {"text": "خلص في نهاية الموضوع إلى استنتاج وهو أنّ الأمّيّة ____، والسّبيل الأمثل لبتر دائها هو ____.", "bank": ["مرض", "العلم", "فضيلة", "المال"]},
   {"blanks": [["مرض"], ["العلم"]]}, UNI_EXPL, 0.5, "ar.literature.prose")
LNK_EXPL = "وظّف الكاتب بعض الرّوابط الّتي ساهمت في اتّساق النّصّ وانسجام فقراته، ومنها: إنّ وأنّ: للتّوكيد – حروف العطف: كالواو لمطلق الجمع بين المتعاطفين – حروف الجرّ: في وعن وغيرها."
st("s25", "q9", "q9-e1", "mcq", "ما نوع الرّابطين «إنّ» و«أنّ» في النّصّ؟",
   {"options": ["حرفان للتّوكيد", "حرفا عطف", "حرفا جرّ", "اسما إشارة"]},
   {"correct": 0}, LNK_EXPL, 0.25, "ar.cohesion.connectors")
st("s26", "q9", "q9-e2", "mcq", "ما نوع «الواو» الرّابطة في «كالغنى والعلم والتّضامن والتّعاون»؟",
   {"options": ["حرف عطف لمطلق الجمع بين المتعاطفين", "حرف جرّ", "حرف توكيد", "واو الحال"]},
   {"correct": 0}, LNK_EXPL, 0.25, "ar.cohesion.connectors")
st("s27", "q9", "q9-e3", "fill_blank", "أكمل نوع الرّابط:",
   {"text": "«في» و«عن»: حروف ____.", "bank": ["الجرّ", "العطف", "النّداء"]},
   {"blanks": [["الجرّ"]]}, LNK_EXPL, 0.25, "ar.cohesion.connectors")
TYP_EXPL = ("النّمط الغالب على النّصّ هو النّمط التّفسيريّ، لأنّ الكاتب يفسّر ويشرح الموضوع من كلّ جوانبه. ومن خصائصه: التّركيز على الموضوعيّة – استخدام "
            "أدوات التّفسير: أنّ، أفسّر، إلخ… (يذكر المترشّح مؤشّرين على الأقلّ).")
st("s28", "q10", "q10-e1", "mcq", "حدّد النّمط الغالب على النّصّ.",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, TYP_EXPL, 0.25, "ar.text.type")
st("s29", "q10", "q10-e2", "mcq", "من مؤشّرات هذا النّمط في النّصّ:",
   {"options": ["التّركيز على الموضوعيّة", "تتابع الأحداث في الزّمن", "تعدّد الشّخصيّات", "غلبة الحوار"]},
   {"correct": 0}, TYP_EXPL, 0.25, "ar.text.type")
st("s30", "q10", "q10-e3", "fill_blank", "أكمل مؤشّرًا آخر:",
   {"text": "استخدام أدوات ____ (أنّ…).", "bank": ["التّفسير", "التّمنّي", "النّداء"]},
   {"blanks": [["التّفسير"]]}, TYP_EXPL, 0.25, "ar.text.type")
IMG_EXPL = ("صورتان بيانيّتان مختلفتان من النّصّ: (تنغمس في النّقائص): استعارة مكنيّة، شبّه الكاتب النّقائص، وهي شيء معنويّ، بشيء ماديّ تنغمس فيه الأمّة. "
            "(يتبيّنون الطّريق): كناية عن صفة وهي الهداية والتّوجيه الصّحيح. أثرهما في المعنى: وضع المعنى في صورة محسوسة (قد يستخرج المترشّح صورًا أخرى).")
st("s31", "q11", "q11-e1", "mcq", "استخرج من النّصّ عبارة تتضمّن صورة بيانيّة:",
   {"options": ["تنغمس في النّقائص", "القراءة والكتابة", "في وقتنا هذا", "جمعيّة العلماء المسلمين الجزائريّين"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s32", "q11", "q11-e2", "mcq", "ما نوع الصّورة في «تنغمس في النّقائص»؟",
   {"options": ["استعارة مكنيّة", "تشبيه بليغ", "كناية عن موصوف", "مجاز مرسل علاقته الجزئيّة"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s33", "q11", "q11-e3", "mcq", "استخرج صورة بيانيّة أخرى مختلفة النّوع:",
   {"options": ["يتبيّنون الطّريق", "بصورة منظّمة", "في هذا الوطن", "رئيسها المحترم"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s34", "q11", "q11-e4", "mcq", "ما نوع الصّورة في «يتبيّنون الطّريق»؟",
   {"options": ["كناية عن صفة (الهداية والتّوجيه الصّحيح)", "كناية عن موصوف", "تشبيه بليغ", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metonymy")
st("s35", "q11", "q11-e5", "mcq", "ما أثر الصّورتين في المعنى؟",
   {"options": ["وضع المعنى في صورة محسوسة", "إحداث جرس موسيقيّ", "الإطناب بتكرار المعنى", "الغموض والإبهام"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("يُعدّ البشير الإبراهيميّ من كتّاب الصّنعة اللّفظيّة، والدّليل على ذلك: انتقاؤه اللّغة الفصيحة (الكمال والنّقص، تفشو، تسنّموا…) – الإكثار من "
             "الصّور البليغة كالاستعارات وغيرها في: «تنغمس في النّقائص»، «فتكت بها»، «قبحها»… والمحسّنات كالطّباق في: الكمال ≠ النّقص، صعودًا ≠ هبوطًا… "
             "والجناس في: تتقاعس وتتناعس… (يمكن للمترشّح أن يستشهد بأمثلة أخرى من النّصّ).")
st("s36", "q12", "q12-e1", "mcq", "«يُعدّ محمّد البشير الإبراهيميّ من كتّاب الصّنعة اللّفظيّة الّذين يتأنّقون في أسلوبهم معجمًا وبلاغة»: هل تحقّق ذلك في النّصّ؟",
   {"options": ["نعم، تحقّق ذلك في النّصّ", "لا، فأسلوبه علميّ جافّ خالٍ من الصّور", "لا، فقد كتب نصّه بالعامّيّة"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.rhetoric.style")
st("s37", "q12", "q12-e2", "mcq", "من مظاهر التّأنّق في معجم الكاتب:",
   {"options": ["انتقاؤه اللّغة الفصيحة", "استعماله الألفاظ الأجنبيّة", "اعتماده الألفاظ العامّيّة", "تكراره الكلمة نفسها في كلّ جملة"]},
   {"correct": 0}, CRIT_EXPL, 0.5, "ar.rhetoric.style")
st("s38", "q12", "q12-e2", "fill_blank", "مثّل من النّصّ لانتقائه اللّغة الفصيحة:",
   {"text": "«الكمال والنّقص»، «تفشو»، «____ منه أعلى ذروة»", "bank": ["وتسنّموا", "وصعدوا", "وطلعوا"]},
   {"blanks": [["وتسنّموا"]]}, CRIT_EXPL, 0.5, "ar.rhetoric.style", "b")
st("s39", "q12", "q12-e3", "multi", "اختر من النّصّ أمثلة على الصّور البليغة الّتي أكثر منها الكاتب: (اختر كلّ ما يصحّ)",
   {"options": ["«تنغمس في النّقائص»", "«فتكت بها»", "«قبحها»", "«القراءة والكتابة»", "«في وقتنا هذا»"]},
   {"correct": [0, 1, 2]}, CRIT_EXPL, 1, "ar.rhetoric.style")
st("s40", "q12", "q12-e4", "matching", "طابق كلّ ثنائيّة من النّصّ بالمحسّن البديعيّ الّذي تمثّله.",
   {"lefts": ["«الكمال» و«النّقص»", "«تتقاعس» و«تتناعس»"], "rights": ["طباق", "جناس", "تصريع"]},
   {"pairs": [0, 1]}, CRIT_EXPL, 0.5, "ar.rhetoric.badi")
st("s41", "q12", "q12-e4", "mcq", "أيّ الثّنائيّات الآتية من النّصّ تمثّل طباقًا؟",
   {"options": ["«صعودًا» و«هبوطًا»", "«القراءة» و«الكتابة»", "«التّضامن» و«التّعاون»", "«الجهل» و«السّقوط»"]},
   {"correct": 0}, CRIT_EXPL, 0.5, "ar.rhetoric.badi", "b")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p2",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 2,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ: الأمّيّة)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
                  f"مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4) فلم يظهر سطر ناقص، والنّسخة نفسها بصيغة PDF: "
                  f"gdrive:{PDF_ID}. ترقيم أسئلة البناء اللّغويّ وفق الموضوع الرّسميّ. العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 3–4، ملفّ ممسوح "
                  "قُرئ مصوّرًا). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. «تتنافس» في التّصحيح خطأ مطبعيّ لـ«تتناعس» في النّصّ. "
                  "مؤجَّل (essay_builder): الرّأي وتعليله س2 (2×0.5) والتّلخيص س6 (01 + 01 + 0.5)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
