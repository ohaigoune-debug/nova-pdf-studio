"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيمي، «البصائر» 1951: حقوق الجيل الآتي).
Exam (most faithful source): gdrive 1ErJfXP3Ao9gzr-cisPcxgcEI5M2GqaVP (بكالوريا العربية 2011 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 17GM8cH_OP8jbFz2aiZ4qlklRyptGTIKH (BAC 2011 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1Wl8B-9H5WKQ4qRebRyAMAMaLP_0Xjlje (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1pkS3g57wu2Bby93MxsXTpdWHiT6WHe_b (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2015_lit_p2.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script; the literals were
re-checked programmatically against the docx. Paragraphs that carry a label or a second item in the same docx paragraph are
split on their run of layout spaces: «النّص:» / the text, the text / its reference, «الأسئلة:» / «أوّلا- …», and the three
semantic fields of Part 2 Q1 (one per line, as on the ONEC paper). The docx was compared line by line with the official ONEC
paper (scanned page images): same three paragraphs, same bracketed sentences ((ورّثونا)، (- إن شاء الله-)), same questions.
The correction is a scanned PDF read from the page images (native 220 dpi). Every mark comes from the official scheme;
correct options and explanations condense its wording.

Docx defect fixed from the ONEC paper (asserted to occur once): reference «"البصائر'» (closing straight apostrophe) ⇒
«"البصائر"» (as build_ar_bac_2015_lit_p1.py did for «'باريس"»). Other differences are punctuation / diacritics / labels only
(docx kept): «حقوقٌ أولية مُؤكّدة. لا تبرأ» (ONEC «… مؤكّدة، لا تبرأ»), «الكاذبة. والغرور» (ONEC «الكاذبة، والغرور»),
«الشرح اللغوي:» (ONEC «المعجم اللّغوي:»)…

Conversion notes / points for the owner's review:
- Streams: لغات أجنبيّة only (ONEC paper and correction headers) ⇒ LANG.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «0.50 + 2×0.75» = the generation (the scheme: «الجيل الّذي يأتي بعده، وهو جيلنا») + the two rights listed ⇒ three elements.
- Q2 «4×0.25» and Q3 «3×0.5»: exactly the items listed ⇒ one element each; the Q3 distractors are phrases about the school's
  role (never other possible clues such as «حرام علينا…» or «نلقى راحة الضّمير»).
- Q4 «2×0.5» = genre (المقال الاجتماعيّ) / reason. Q5 «3×0.5» with «وغيرهما» ⇒ one element of 1.5.
- Q6 (تلخيص) «3×01» = الأفكار / أسلوب المترشّح / حجم النّصّ ⇒ three deferred essay_builder elements.
- Part 2: Q1 «8×0.25» one element per word (8 single-choice steps over the three fields of the question). Q2 «2×0.25 + 2×0.5»
  one element per item («صحّة» تمييز: no «حال» distractor; «الصّفقة» بدل: no «نعت»/«عطف بيان»/«مفعول به» distractor).
  Q3 «0.5 + 0.25 + 0.25» = العطف / الأدوات / الرّبط الدّلاليّ; the distractor particles (ثمّ، أو، أم، لعلّ، ليت، كأنّ، لولا،
  هلّا، كي، حتّى) were checked absent from the text. Q4 «3×0.25» per image, unlabelled ⇒ one element of 0.75 per image with
  three steps (type / meaning or explanation / effect); no «استعارة» distractor for «لا تزن جناح بعوضة», no «كناية» for
  «يذوق بعضهم بأس بعض».
- Part 3 (04) «كتابة فقرة»: 01 تأكيد الحكم إيجابا، 01 العرض المنهجيّ، 0.5 تناسق الأفكار، 0.5 اللّغة الرّاقية المنتقاة،
  01 التّأنّق في الأسلوب بلاغة (البيان والبديع) وشواهد من النّصّ ⇒ five deferred essay_builder elements (a written paragraph).
- Deferred in total: 3 (summary) + 4 (paragraph) = 7 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "1ErJfXP3Ao9gzr-cisPcxgcEI5M2GqaVP"
DOCX_TITLE = "بكالوريا العربية 2011 شعبة لغات اجنبية.docx"
PDF_ID = "17GM8cH_OP8jbFz2aiZ4qlklRyptGTIKH"
OFFICIAL_ID = "1Wl8B-9H5WKQ4qRebRyAMAMaLP_0Xjlje"
CORR_ID = "1pkS3g57wu2Bby93MxsXTpdWHiT6WHe_b"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    28: 'الموضوع الثاني',
    29: 'النّص:     «للجيل الآتي علينا حقوقٌ أولية مُؤكّدة. لا تبرأ ذممنا منها عند الله، ولا تسقط شهادة التاريخ علينا بها، إلاّ إذا أدّيناها لهم كاملة غير مَبْخُوسة، ومِلاك هذه الحقوق أن نُعِدَّهم للحياة على غير الطريقة التي أعدَّنا بها آباؤنا للحياة. الأخلاق والآداب والأفكار والإحساسات والاتجاهات العامة والمُشخصاتَ الخاصة هي "الأمتعة" التي يَرثُها جيل عن جيل، ومنها يتكوّن مزاجه صحة واعتلالا، فماذا ورثنا عن آبائنا؟ وماذا نُوَرّث أبناءنا منها؟ ليس من العقوق أن نقول: إن آباءنا لم يورثونا شيئا نافعا من هذه الأمتعة، وليس من العقوق أن نقول: إن أباك خَلَّفكَ فقيرا ... إذا كان عاش فقيرا، ومات فقيرا. بل من الإنصاف لهم أن نقول: إنَّهم (ورَّثونا) هذه الصفقة الخاسرة التي هي رأسُ مالنا اليوم من أخلاق لا تزن جناح بعوضة، وآداب لا تستقيم عليها حياة، وأفكار بدائية لا تجول في المدار الواسع من الحياة، وعقول تقدر فتخطئ، وَتدبر فتبطئ، وإحساسات مذبذبة واتّجاهات خاطئة مُدبرة، وغير ذلك مما تَرَكَنَا غرباء عن عصرنا وأهل عصرنا، وصيَّر الحياة منّا في غير دار إقامة ... فهل يَحسن بنا أن نورث بَنِينا هذا السقط من الأمتعة بعد شعورنا ويَقيننا بعدم كفايتها للحياة؟',
    30: 'حرام علينا أن نرضى للجيل الآتي بما لم نَرْض به لأنفسنا، وأن نُجَرعَهم هذا الحنظل الذي تجرّعنا، وأن نلَوث نفوسهم البريئة بهذه القاذورات، وأن نبتليهم بما ابتلانا به آباؤنا من أدواء التفرق المهلك، والأنانية الكاذبة. والغرور المُدَلَّى، والتنكر للقريب، والخضوع للغريب. حرام علينا أن نقلدهم هذه الأسلحة المسمومة فيتفانون كما تفانينا، ويذوق بعضهم بأس بعض، ويشقون جميعا ويسعد بشقائهم الغير. حرام علينا أن نُسلم إليهم شيئا من هذه التركة التي يجب أن تُنفق في جهاز الميت فتدفن معه ويأمن الأحياء شرَّها إذ لم ينالوا خيرها.',
    31: 'السبيل القويم الذي يؤدي إلى حفظ الجيل الجديد من هذه الشرور المتوارثة، وإلى توثيق عُرى الأخوّة بين أفراده، وإلى توحيد أفكاره ومشاربه واتجاهاته، وإلى تصحيح فهمه للحياة وتسديد نظرته إليها وتشديد عزيمته في طلبها هو المدرسة العربيَّة التي تصقُل الفكر والعقل واللّسان وتسيطر عليها...غاية التعليم هي تفقيه النشء في دينه ولغته، وتعريفه بنفسه بمعرفة تاريخه. فهذه هي الغاية السّامية التي في تحقيقها نجهد ونكدح، وللوصول إليها نعمل، وفي العمل لها نلقى الأذى، وفي الأذى فيها نلقى راحة الضمير واطمئنان النَّفس. وببلوغها (- إن شاء الله-) نكون قد أدَّينا الأمانة. وقضينا المناسك وكفّرنا عن جريمة التقصير...».                          البشير الإبراهيمي "البصائر\' العدد:145 السنة: 1951 (بتصرف)',
    32: 'الشرح اللغوي:   ذمم: عهود وأمان         السّقط: الرديء ما لا خير فيه       حنظل: نبات مر            المُدلَّى: المصطنع           عُرى: رباط وثيق.',
    33: 'الأسئلة:           أوّلا- البناء الفكري: (10 نقاط)',
    34: 'عن أي جيل يتحدّث الكاتب؟ وما هي الحقوق التي يؤكّد على تسليمها لهذا الجيل؟',
    35: 'ما الذي يرفض الكاتب تسليمه للجيل؟',
    36: 'لصراع الأجيال أثره في نفسية الكاتب، تلَّمس هذا الأثر بقرائن لغوية من النّص.',
    37: 'في أي نوع من أنواع النَّثر يمكنك تصنيف النّص؟ ولماذا؟',
    38: 'النمط الغالب على النّص هو النّمط التفسيري. بِمَ تعلل ذلك؟',
    39: 'لخّص مضمون النَّص في بضعة أسطر بأسلوبك الخاص.',
    40: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    41: 'وردت في النص الألفاظ التالية:',
    42: '"جيل- العقوق - الشّكر- التّعليم - راحة الضّمير- اطمئنان- نكدح- الأمانة"',
    43: 'صنفها حسب الحقول الدلالية التالية:',
    44: 'الحقل الاجتماعي.               الحقل النفســــــــــــــــــي.                   الحقل الأخلاقــــــــــي.',
    45: 'أعرب الكلمتين التاليتين: "صحة"، "الصفقة" الواردتين في الفقرة الأولى من النّص إعراب مفردات. والجملتين التاليتين: "ورَّثونا" الواردة في الفقرة الأولى، و"- إن شاء الله-" في الفقرة الأخيرة، إعراب جمل.',
    46: 'عين الروابط التي وظَّفها الكاتب في تنامي النّص وتناسقه من حيث ما يلي:',
    47: 'روابط العطف- الرَّبط بالأدوات- الرّبط الدلالي.',
    48: 'إليك العبارتين التاليتين:',
    49: '«هذه الصَّفقة الخاسرة التي هي رأس مالنا اليوم من أخلاق لا تزِن جناح بعوضة».',
    50: '«ويذوق بعضهُم بأس بعض».',
    51: 'استخرج من كل عبارة صورة بيانية، ثم اشرحها وبين نوعها وبلاغتها.',
    52: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    53: 'قيل: (يُعَدُّ الإبراهيمي من كُتَّاب المقالة البارعين، ومن الذين تأنَّقوا في أسلوبهم). المطلوب: وضّح في فقرة هذا القول، مُدَعّما إجابتك بشواهد من النّص.',
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


# ── الوثائق (تقسيم الفقرات المركّبة على مسافات التّخطيط؛ انظر التّوثيق أعلاه) ──
_lbl, T1 = re.split(r"\s{2,}", PARAS[29], maxsplit=1)
T3, _ref = re.split(r"\s{2,}", PARAS[31], maxsplit=1)
_ask, P1 = re.split(r"\s{2,}", PARAS[33], maxsplit=1)
FIELDS = re.split(r"\s{2,}", PARAS[44])
assert _lbl == "النّص:" and _ask == "الأسئلة:" and P1.startswith("أوّلا") and len(FIELDS) == 3 and T3.endswith("».")
REF = _fix(_ref, '"البصائر\'', '"البصائر"')
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join([T1, PARAS[30], T3])},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[32]},
]
P2, P3 = PARAS[40], PARAS[52]
assert P2.startswith("ثانيا") and P3.startswith("ثالثا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)

q("q1", "1", P1, J(34), 2, [el("q1-e1", "الجيل الّذي يتحدّث عنه الكاتب", 0.5), el("q1-e2", "الحقّ الأوّل", 0.75), el("q1-e3", "الحقّ الثّاني", 0.75)], DOCS)
q("q2", "2", P1, J(35), 1, [el("q2-e1", "أدواء التّفرّق المهلك", 0.25), el("q2-e2", "الأنانيّة الكاذبة", 0.25), el("q2-e3", "الغرور والتّنكّر للقريب", 0.25),
                           el("q2-e4", "الخضوع للغريب", 0.25)], DOCS)
q("q3", "3", P1, J(36), 1.5, [el("q3-e1", "القرينة الأولى", 0.5), el("q3-e2", "القرينة الثّانية", 0.5), el("q3-e3", "القرينة الثّالثة", 0.5)], DOCS)
q("q4", "4", P1, J(37), 1, [el("q4-e1", "نوع النّثر", 0.5), el("q4-e2", "التّعليل", 0.5)], DOCS)
q("q5", "5", P1, J(38), 1.5, [el("q5-e1", "تعليل غلبة النّمط التّفسيريّ (3×0.5)", 1.5)], DOCS)
q("q6", "6", P1, J(39), 3, [el("q6-e1", "التّلخيص: الأفكار", 1), el("q6-e2", "التّلخيص: أسلوب المترشّح", 1), el("q6-e3", "التّلخيص: حجم النّصّ", 1)], DOCS)
WORDS = [("q7-e1", "جيل"), ("q7-e2", "العقوق"), ("q7-e3", "الشّكر"), ("q7-e4", "التّعليم"), ("q7-e5", "راحة الضّمير"), ("q7-e6", "اطمئنان"),
         ("q7-e7", "نكدح"), ("q7-e8", "الأمانة")]
q("q7", "1", P2, J(41, 42, 43) + "\n" + "\n".join(FIELDS), 2, [el(eid, f"تصنيف «{w}»", 0.25) for eid, w in WORDS], DOCS)
q("q8", "2", P2, J(45), 1.5, [el("q8-e1", "إعراب «صحّة»", 0.25), el("q8-e2", "إعراب «الصّفقة»", 0.25), el("q8-e3", "محلّ جملة «ورّثونا»", 0.5),
                             el("q8-e4", "محلّ جملة «إن شاء الله»", 0.5)], DOCS)
q("q9", "3", P2, J(46, 47), 1, [el("q9-e1", "روابط العطف", 0.5), el("q9-e2", "الرّبط بالأدوات", 0.25), el("q9-e3", "الرّبط الدّلاليّ", 0.25)], DOCS)
q("q10", "4", P2, J(48, 49, 50, 51), 1.5, [el("q10-e1", "صورة العبارة الأولى (3×0.25)", 0.75), el("q10-e2", "صورة العبارة الثّانية (3×0.25)", 0.75)], DOCS)
q("q11", "التّعليمة", P3, J(53), 4,
  [el("q11-e1", "تأكيد الحكم إيجابًا", 1), el("q11-e2", "الاستدلال: العرض المنهجيّ", 1), el("q11-e3", "الاستدلال: تناسق الأفكار", 0.5),
   el("q11-e4", "الاستدلال: اللّغة الرّاقية المنتقاة", 0.5), el("q11-e5", "الاستدلال: التّأنّق في الأسلوب بلاغةً (البيان والبديع) وشواهد من النّصّ", 1)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("يتحدّث الكاتب عن الجيل الّذي يأتي بعده، وهو جيلنا. الحقوق الّتي يؤكّد على تسليمها لهذا الجيل هي: إعداد الجيل الحاليّ للحياة على غير الطّريقة "
           "الّتي أعدّهم بها آباؤهم؛ تسليم الأمتعة الأخلاقيّة له كـ(الأخلاق، الآداب، الإحساسات، الاتّجاهات العامّة، المشخّصات الخاصّة…).")
st("s01", "q1", "q1-e1", "mcq", "عن أيّ جيل يتحدّث الكاتب؟",
   {"options": ["عن الجيل الّذي يأتي بعده (الجيل الآتي)", "عن جيل الآباء والأجداد", "عن جيل الصّحابة والتّابعين", "عن جيل المستعمرين"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "ما الحقّ الأوّل الّذي يؤكّد الكاتب على تسليمه لهذا الجيل؟",
   {"options": ["إعداده للحياة على غير الطّريقة الّتي أعدّنا بها آباؤنا", "إعداده للحياة على الطّريقة نفسها الّتي أعدّنا بها آباؤنا",
                "تركه دون تربية ولا إعداد", "توريثه الأموال والعقارات"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.details")
st("s03", "q1", "q1-e3", "fill_blank", "أكمل الحقّ الثّاني كما في الإجابة النّموذجيّة:",
   {"text": "تسليم الأمتعة ____ له كـ(الأخلاق، الآداب، الإحساسات، الاتّجاهات العامّة، المشخّصات الخاصّة…).", "bank": ["الأخلاقيّة", "المادّيّة", "الماليّة"]},
   {"blanks": [["الأخلاقيّة"]]}, Q1_EXPL, 0.75, "ar.comprehension.details")
Q2_EXPL = "يرفض الكاتب تسليم الجيل ما يلي: أدواء التّفرّق المهلك؛ الأنانيّة الكاذبة؛ الغرور والتّنكّر للقريب؛ والخضوع للغريب."
st("s04", "q2", "q2-e1", "fill_blank", "أكمل ممّا يرفض الكاتب تسليمه للجيل:",
   {"text": "أدواء ____ المهلك", "bank": ["التّفرّق", "التّعاون", "التّعليم"]}, {"blanks": [["التّفرّق"]]}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s05", "q2", "q2-e2", "mcq", "وممّا يرفض الكاتب تسليمه للجيل أيضًا:",
   {"options": ["الأنانيّة الكاذبة", "الأخوّة الصّادقة", "التّعليم النّافع", "معرفة التّاريخ"]}, {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s06", "q2", "q2-e3", "fill_blank", "أكمل:",
   {"text": "الغرور والتّنكّر ____", "bank": ["للقريب", "للغريب", "للعدوّ"]}, {"blanks": [["للقريب"]]}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s07", "q2", "q2-e4", "mcq", "ويرفض الكاتب كذلك تسليم الجيل:",
   {"options": ["الخضوع للغريب", "التّعاون مع القريب", "الاعتزاز بالدّين واللّغة", "توحيد الأفكار والمشارب"]}, {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.details")
Q3_EXPL = "القرائن اللّغويّة الدّالّة على صراع الأجيال وأثره في نفسيّة الكاتب: (يتفانون، يذوق بعضهم بأس بعض، يشقون جميعًا)."
st("s08", "q3", "q3-e1", "mcq", "أيّ ممّا يلي قرينة لغويّة على صراع الأجيال وأثره في نفسيّة الكاتب؟",
   {"options": ["«فيتفانون كما تفانينا»", "«تصقل الفكر والعقل واللّسان»", "«توثيق عرى الأخوّة بين أفراده»", "«تفقيه النّشء في دينه ولغته»"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s09", "q3", "q3-e2", "fill_blank", "أكمل قرينة أخرى من الفقرة الثّانية:",
   {"text": "ويذوق بعضهم ____ بعض", "bank": ["بأس", "حبّ", "عون"]}, {"blanks": [["بأس"]]}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s10", "q3", "q3-e3", "mcq", "وما القرينة الثّالثة الدّالّة على صراع الأجيال وأثره في نفسيّة الكاتب؟",
   {"options": ["«ويشقون جميعًا»", "«نكون قد أدّينا الأمانة»", "«وتعريفه بنفسه بمعرفة تاريخه»", "«وتشديد عزيمته في طلبها»"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
Q4_EXPL = "يصنّف النّصّ النّثريّ ضمن فنّ المقال الاجتماعيّ لأنّه يتناول قضيّة اجتماعيّة موضوعها: «صراع الأجيال» حول التّركة الأخلاقيّة."
st("s11", "q4", "q4-e1", "mcq", "في أيّ نوع من أنواع النّثر يمكنك تصنيف النّصّ؟",
   {"options": ["المقال الاجتماعيّ", "القصّة القصيرة", "المسرحيّة", "السّيرة الذّاتيّة"]}, {"correct": 0}, Q4_EXPL, 0.5, "ar.literature.genre")
st("s12", "q4", "q4-e2", "fill_blank", "ولماذا؟ أكمل:",
   {"text": "لأنّه يتناول قضيّة ____ موضوعها: «صراع ____» حول التّركة الأخلاقيّة.", "bank": ["اجتماعيّة", "الأجيال", "سياسيّة", "الحضارات"]},
   {"blanks": [["اجتماعيّة"], ["الأجيال"]]}, Q4_EXPL, 0.5, "ar.literature.genre")
Q5_EXPL = ("النّمط الغالب على النّصّ تفسيريّ، وأعلّل بما يلي: لأنّه يحوي أدوات التّوكيد مثل: (أنّ، إنّ)، والرّوابط: (حروف الجرّ: اللّام، على، من…) "
           "و(حروف العطف: الواو، الفاء)، الشّرح والتّعليل، وغيرهما.")
st("s13", "q5", "q5-e1", "multi", "بمَ تعلّل غلبة النّمط التّفسيريّ على النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["احتواؤه أدوات التّوكيد مثل (أنّ، إنّ)", "احتواؤه الرّوابط: حروف الجرّ وحروف العطف", "الشّرح والتّعليل", "الحوار بين الشّخصيّات",
                "تتابع الأحداث على لسان راوٍ", "الوزن والقافية"]},
   {"correct": [0, 1, 2]}, Q5_EXPL, 0.75, "ar.text.type")
st("s14", "q5", "q5-e1", "matching", "طابق كلّ مؤشّر بأمثلته من النّصّ.",
   {"lefts": ["أدوات التّوكيد", "حروف الجرّ", "حروف العطف"], "rights": ["(أنّ، إنّ)", "(اللّام، على، من…)", "(الواو، الفاء)", "(لن، لم)"]},
   {"pairs": [0, 1, 2]}, Q5_EXPL, 0.75, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ في بضعة أسطر", "text": "محمّد البشير الإبراهيمي، البصائر 1951 (بكالوريا 2011، لغات أجنبيّة، الموضوع الثّاني)",
            "scheme": "تلخيص مضمون النّصّ، بحيث يراعى فيه ما يلي: 1- الأفكار، 2- أسلوب المترشّح، 3- حجم النّصّ (3×01)"}
SUM_EXPL = "يراعى في التّلخيص: الأفكار، أسلوب المترشّح، حجم النّصّ (نقطة لكلّ معيار). لا يقدّم الحلّ ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s15", "q6-e1", "الأفكار"), ("s16", "q6-e2", "أسلوب المترشّح"), ("s17", "q6-e3", "حجم النّصّ")]:
    essay(sid, "q6", eid, "تلخيص مقال الإبراهيمي", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FIELD_EXPL = "تصنيف الألفاظ: الحقل الاجتماعيّ: جيل، تعليم، نكدح. الحقل النّفسيّ: راحة الضّمير، اطمئنان. الحقل الأخلاقيّ: العقوق، شكر، الأمانة."
FIELD_OF = {"جيل": 0, "العقوق": 2, "الشّكر": 2, "التّعليم": 0, "راحة الضّمير": 1, "اطمئنان": 1, "نكدح": 0, "الأمانة": 2}
FIELD_NAMES = ["الحقل الاجتماعيّ", "الحقل النّفسيّ", "الحقل الأخلاقيّ"]
for n, (eid, w) in enumerate(WORDS):
    sid = f"s{18 + n}"
    k = FIELD_OF[w]
    if n % 2 == 0:
        opts = [FIELD_NAMES[k]] + [f for i, f in enumerate(FIELD_NAMES) if i != k]
        st(sid, "q7", eid, "mcq", f"إلى أيّ حقل دلاليّ تنتمي لفظة «{w}»؟", {"options": opts}, {"correct": 0}, FIELD_EXPL, 0.25, "ar.cohesion.effect")
    else:
        short = [f.replace("الحقل ", "") for f in FIELD_NAMES]
        st(sid, "q7", eid, "fill_blank", f"صنّف لفظة «{w}»:", {"text": f"«{w}» من الحقل ____.", "bank": short},
           {"blanks": [[short[k]]]}, FIELD_EXPL, 0.25, "ar.cohesion.effect")
st("s26", "q8", "q8-e1", "mcq", "ما إعراب «صحّة» في قوله: «ومنها يتكوّن مزاجه صحّة واعتلالا»؟",
   {"options": ["تمييز منصوب وعلامة نصبه الفتحة", "مفعول به منصوب وعلامة نصبه الفتحة", "مفعول لأجله منصوب وعلامة نصبه الفتحة", "خبر مرفوع وعلامة رفعه الضّمّة"]},
   {"correct": 0}, "«صحّة»: تمييز منصوب وعلامة نصبه الفتحة.", 0.25, "ar.grammar.irab")
st("s27", "q8", "q8-e2", "fill_blank", "أكمل إعراب «الصّفقة» في قوله: «إنّهم (ورّثونا) هذه الصّفقة الخاسرة»:",
   {"text": "الصّفقة: ____ منصوب وعلامة نصبه ____.", "bank": ["بدل", "الفتحة", "خبر", "الكسرة"]},
   {"blanks": [["بدل"], ["الفتحة"]]}, "«الصّفقة»: بدل منصوب وعلامة نصبه الفتحة.", 0.25, "ar.grammar.badal")
st("s28", "q8", "q8-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «ورّثونا» في قوله: «إنّهم (ورّثونا) هذه الصّفقة الخاسرة»؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر إنّ", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة لا محلّ لها من الإعراب استئنافيّة",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "«ورّثونا»: جملة فعليّة في محلّ رفع خبر إنّ.", 0.5, "ar.grammar.sentence_case")
st("s29", "q8", "q8-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «- إن شاء الله -» في قوله: «وببلوغها (- إن شاء الله-) نكون قد أدّينا الأمانة»؟",
   {"options": ["جملة اعتراضيّة لا محلّ لها من الإعراب", "جملة في محلّ نصب حال", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ نعت"]},
   {"correct": 0}, "«إن شاء الله»: جملة اعتراضيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
LINK_EXPL = ("الرّوابط الّتي وظّفها الكاتب في تنامي النّصّ وتناسقه: أ- روابط العطف: الواو، بل، لا. ب- الرّبط بالأدوات: كما، إلّا، إذا. "
             "ج- الرّبط الدّلاليّ (الرّبط بالألفاظ): تكرار كلمة «حرام»، «هو المدرسة»، «هذه الغاية»…")
st("s30", "q9", "q9-e1", "multi", "ما روابط العطف الّتي وظّفها الكاتب في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الواو", "بل", "لا", "ثمّ", "أو", "أم"]}, {"correct": [0, 1, 2]}, LINK_EXPL + " (ثمّ، أو، أم لا ترد في النّصّ.)", 0.5, "ar.cohesion.connectors")
st("s31", "q9", "q9-e2", "mcq", "ما أدوات الرّبط الّتي وظّفها الكاتب؟",
   {"options": ["كما، إلّا، إذا", "لعلّ، ليت، كأنّ", "لولا، هلّا، كي", "حتّى، لكنّ، أم"]}, {"correct": 0}, LINK_EXPL, 0.25, "ar.cohesion.connectors")
st("s32", "q9", "q9-e3", "mcq", "ومن الرّبط الدّلاليّ (الرّبط بالألفاظ) في النّصّ:",
   {"options": ["تكرار كلمة «حرام»، و«هو المدرسة»، و«هذه الغاية»", "توحيد حرف الرّويّ في نهاية الفقرات", "الانتقال المفاجئ بين المواضيع",
                "استعمال الألفاظ الأجنبيّة"]},
   {"correct": 0}, LINK_EXPL, 0.25, "ar.cohesion.effect")
IMG1 = "(لا تزن جناح بعوضة): كناية عن صفة الدّناءة، بلاغتها: تصوير المعنى تصويرًا مرئيًّا."
st("s33", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «أخلاق لا تزن جناح بعوضة»؟",
   {"options": ["كناية عن صفة", "كناية عن موصوف", "تشبيه بليغ", "مجاز مرسل علاقته الجزئيّة"]}, {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metonymy")
st("s34", "q10", "q10-e1", "mcq", "ما الصّفة الّتي كُني عنها بقوله: «لا تزن جناح بعوضة»؟",
   {"options": ["الدّناءة", "الكرم", "الشّجاعة", "الصّبر"]}, {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metonymy", "b")
st("s35", "q10", "q10-e1", "mcq", "ما بلاغة الصّورة في «لا تزن جناح بعوضة»؟",
   {"options": ["تصوير المعنى تصويرًا مرئيًّا", "إحداث جرس موسيقيّ في العبارة", "المبالغة بادّعاء أنّ المشبّه عين المشبّه به", "تشخيص الجماد وبثّ الحياة فيه"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "c")
IMG2 = ("(ويذوق بعضهم بأس بعض): استعارة مكنيّة، شبّه البأس وهو معنويّ بمشروب وهو حسّيّ، فحذف المشبّه به (الشّراب)، وأبقى على لازمة من لوازمه، وهو "
        "(يذوق) على سبيل الاستعارة المكنيّة. وبلاغتها في تجسيد المعنى وتقريبه.")
st("s36", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «ويذوق بعضهم بأس بعض»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]}, {"correct": 0}, IMG2, 0.25, "ar.rhetoric.metaphor")
st("s37", "q10", "q10-e2", "matching", "اشرح الصّورة في «ويذوق بعضهم بأس بعض»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه (معنويّ)", "المشبّه به المحذوف (حسّيّ)", "اللّازمة الّتي أُبقي عليها"], "rights": ["البأس", "المشروب (الشّراب)", "الفعل «يذوق»", "الجيل الآتي"]},
   {"pairs": [0, 1, 2]}, IMG2, 0.25, "ar.rhetoric.metaphor", "b")
st("s38", "q10", "q10-e2", "mcq", "ما بلاغة الصّورة في «ويذوق بعضهم بأس بعض»؟",
   {"options": ["تجسيد المعنى وتقريبه", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ في العبارة", "الإيجاز بحذف الأداة ووجه الشّبه"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect", "c")
# ── ثالثًا: التّقويم النّقديّ (كتابة فقرة: مؤجّل) ──
CRIT_SPEC = {"task": "كتابة فقرة توضّح القول: (يُعدّ الإبراهيمي من كتّاب المقالة البارعين، ومن الّذين تأنّقوا في أسلوبهم) مع شواهد من النّصّ",
             "question": PARAS[53],
             "scheme": "كتابة فقرة يوضّح فيها المترشّح هذا القول ويبيّن ما يلي: تأكيد الحكم إيجابا (01)؛ الاستدلال يشمل: العرض المنهجيّ (01)، تناسق الأفكار (0.5)، "
                       "اللّغة الرّاقية المنتقاة (0.5)، التّأنّق في الأسلوب بلاغة (البيان والبديع)، شواهد من النّصّ (01)"}
CRIT_EXPL = ("يكتب المترشّح فقرة يؤكّد فيها الحكم إيجابًا (01)، ويستدلّ بالعرض المنهجيّ (01)، وتناسق الأفكار (0.5)، واللّغة الرّاقية المنتقاة (0.5)، "
             "والتّأنّق في الأسلوب بلاغةً (البيان والبديع) مع شواهد من النّصّ (01).")
for sid, eid, crit, ind, pts in [("s39", "q11-e1", "تأكيد الحكم", "تأكيد الحكم إيجابا", 1), ("s40", "q11-e2", "العرض المنهجيّ", "العرض المنهجيّ", 1),
                                 ("s41", "q11-e3", "تناسق الأفكار", "تناسق الأفكار", 0.5), ("s42", "q11-e4", "اللّغة", "اللّغة الرّاقية المنتقاة", 0.5),
                                 ("s43", "q11-e5", "التّأنّق في الأسلوب والشّواهد", "التّأنّق في الأسلوب بلاغة (البيان والبديع)، شواهد من النّصّ", 1)]:
    essay(sid, "q11", eid, "فقرة: الإبراهيمي كاتب مقالة بارع متأنّق الأسلوب", crit, ind, pts, CRIT_SPEC, CRIT_EXPL, "ar.literature.prose")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيمي: حقوق الجيل الآتي)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: علامة التّنصيص المعكوسة في التّوثيق «\"البصائر'» ← «\"البصائر\"». قُسّمت الفقرات المركّبة في docx على مسافات التّخطيط "
         "(التّسمية/النّصّ، النّصّ/التّوثيق، الحقول الدّلاليّة الثّلاثة سطرًا سطرًا كما في الموضوع الرّسميّ). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): التّلخيص س6 (3×01) وفقرة التّقويم النّقديّ (01 + 01 + 0.5 + 0.5 + 01) = 7 نقاط.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T18:40:00Z")
