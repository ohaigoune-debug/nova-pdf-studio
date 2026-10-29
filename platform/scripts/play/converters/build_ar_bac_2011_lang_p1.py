"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (رشيد سليم الخوري «الشّاعر القرويّ»، قصيدة في بلفور وفلسطين).
Exam (most faithful source): gdrive 1ErJfXP3Ao9gzr-cisPcxgcEI5M2GqaVP (بكالوريا العربية 2011 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 17GM8cH_OP8jbFz2aiZ4qlklRyptGTIKH (BAC 2011 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1Wl8B-9H5WKQ4qRebRyAMAMaLP_0Xjlje (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1pkS3g57wu2Bby93MxsXTpdWHiT6WHe_b (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2016_lang_p1.py / build_ar_bac_2015_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx
with python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the poem
table is read as rows [عجز, (empty), «n-صدر»] from the RTL 3-column layout and the verse number is split off the صدر cell)
and spliced into this builder by script; the literals were re-checked programmatically against the docx. The docx was
compared verse by verse and line by line with the official ONEC paper (scanned page images): same 14 verses (12–14 change
rhyme on the ONEC paper too), same bracketed sentences ((علّمتهم) ب9، (ينكرون معادنا) ب12), same questions. The
correction is a scanned PDF (with a few handwritten ticks of a previous reader, ignored) read from the page images (native
220 dpi). Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx vs ONEC paper: no word-level defect found. Differences are diacritics / labels only (docx kept): «يا مستَعِمر» (ONEC
«مُسْتَعْمِرُ»), the question's «عَلَّمتُهم» (ONEC «عَلَّمْتَهُمْ»; the i'rab of the sentence is the same), «الشَّرح اللغوي:»
(ONEC «المعجم اللّغوي:»), «ثالثا- التّقويم النقدي:» (ONEC «… للنّصّ»)… Line-wrapped questions (Part 1 Q4, Part 2 Q1 and Q2,
Part 3) joined with a space.

Conversion notes / points for the owner's review:
- Streams: لغات أجنبيّة only (ONEC paper and correction headers) ⇒ LANG.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «01 + 4×0.25» = addressee (بلفور) + four qualities among six («يكتفي المترشّح بذكر أربع صفات») ⇒ two elements.
- Q2 «3×0.25 + 3×0.25» = three verses among 5–9 + three structures among five («يكتفي المترشّح بذكر ثلاثة أبيات وثلاثة
  تراكيب») ⇒ two elements; distractor verses are 1–3 only (addressed to Balfour).
- Q3 «2×01» = one element per statement. Q4 «4×0.25»: exactly four expressions listed for «أربع عبارات» ⇒ four elements.
- Q5 «0.5 + 2×0.25 + 2×0.25» = explanation / the two indicators / the two examples ⇒ three elements.
- Q6 (نثر الأبيات الثّلاثة الأخيرة) «01 تسلسل الأفكار + 0.5 أسلوب المترشّح + 0.5 حجم النّصّ» ⇒ three deferred essay_builder elements.
- Part 2: Q1 «0.5 + 0.5 + 2×0.5» one element per item («مغلوبًا» حال: no «خبر لفعل ناقص» distractor, since «تؤوب» can be read
  as a verb of becoming). Q2 «6×0.25» = for each of the two pronouns of the scheme (الكاف في «منك»، فاعل «فعُدْ») the pronoun,
  its kind and its referent ⇒ one element of 0.75 per pronoun («منه:» — other pronouns are possible, so the steps only ask
  about these two). Q3 «0.75 + 0.75» one element per particle (no «حصر» distractor for «إنّ»: the verse reads «فإنّما»).
  Q4 «0.25 + 2×0.25 + 0.25» = locate / explain / type / effect ⇒ four elements.
- Part 3 «01.5 + 01.5 + 01» = the verse / the name of the phenomenon (التّناصّ; no «الاقتباس»/«التّضمين» distractor) / its
  purpose ⇒ three interactive elements.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "1ErJfXP3Ao9gzr-cisPcxgcEI5M2GqaVP"
DOCX_TITLE = "بكالوريا العربية 2011 شعبة لغات اجنبية.docx"
PDF_ID = "17GM8cH_OP8jbFz2aiZ4qlklRyptGTIKH"
OFFICIAL_ID = "1Wl8B-9H5WKQ4qRebRyAMAMaLP_0Xjlje"
CORR_ID = "1pkS3g57wu2Bby93MxsXTpdWHiT6WHe_b"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    0: 'على المترشح أن يختار أحد الموضوعين الآتيين:',
    1: 'الموضوع الأول',
    2: 'النّـــــص:',
    3: 'رشيد سليم الخوري - الشاعر القروي -',
    4: 'الشَّرح اللغوي: مَبْكَاكُمْ: المقصود به حائط البراق ويسميه اليهود "حائط المبكى".',
    5: 'الأسئلة:',
    6: 'أوّلا- البناء الفكري: (10 نقاط)',
    7: 'من المخاطب في مطلع القصيدة؟ استخرج أربع صفات له.',
    8: 'في أيّ الأبيات يستنهض الشَّاعر هِمم العرب؟ استخرج منها التراكيب الدَّالة على ذلك.',
    9: 'ما علاقة "صلاح الدين" بفلسطين في النص؟',
    10: 'جسّد الشّاعر في نصّه صوت أمَّته ووقف موقفا مدافعا عن قضاياها المصيرية. استخرج',
    11: 'منه أربع عبارات تدل على ذلك.',
    12: 'غلب على الأبيات النمط الوصفي. بِم تُفَسر ذلك؟ اذكر مُؤشرين له واستشهد بمثالين لهما.',
    13: 'انثر الأبيات الثلاثة الأخيرة بأسلوبك.',
    14: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    15: 'بم تفسّر نَصْبَ كلمة "مَغْلُوبًا" في البيت الخامس؟ ثم أعرب الكلمة التالية إعراب مفردات:',
    16: '"العلى" في عجز البيت السابع.',
    17: 'وجملة "عَلَّمتُهم" في صدر البيت التاسع. وجملة "يُنكرون مَعَادنا" في صدر البيت الثاني عشر',
    18: 'إعراب جمل.',
    19: 'غلب على النّص ضمير المخاطب المفرد. استخرج نوعين مختلفين مبيّنا على من يعود',
    20: 'كل منهما.',
    21: 'ما المعنى الذي دلَّت عليه كلّ من (لو) في صدر البيت الثالث و(إنَّ) في صدر البيت الرابع؟',
    22: 'في عجز البيت الثامن صورة بيانية. استخرجها ثمّ اشرحها وبيّن نوعها وبلاغتها.',
    23: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    24: 'قال الله تعالى: «كَمْ مِن فِئةٍ قليلةٍ غَلبَتْ فئةً كثيرةً بإذن اللهِ، واللهُ مع الصَّابرين» (البقرة: 249)',
    25: 'المطلوب: ما البيت الذي يتضمَّن معنى هذه الآية في القصيدة؟ كيف تُسمَّى هذه الظاهرة في النَّقد',
    26: 'المعاصر؟ وما غرضها البلاغي؟',
}
POEM_RAW = [
    ['فاحسب حساب الحق يا متجــــــبّر', '', '1-الحق مِنــــك ومن وعُودك أكبر'],
    ['مُهَجُ العباد خَسِئـــــت يا مستَعِمر', '', '2-تعــــد الوعـــود وتقتضي إنجازهــــا'],
    ['من جَيْبِ غيرك مُحسنًـــــا يا «بَلْفرُ»', '', '3-لو كنت من أهل المكارِمِ لم تكــــن'],
    ['دعواه خاســــــرة ووَعدك أخســــرُ', '', '4-عِــــدْ مَن تشاءُ بما تشاء فإنَّمــــا'],
    ['وتؤوب مَـــــغلُوبًا وأنـــت الأقدر', '', '5-فـــلقد نفوز ونحـــن أضعف أمـــة'],
    ['كَـــذبٌ تعالى الحــــق عمَّـــا تَنْشُـــرُ', '', '6-يا مصدر الكــــذب الذي ما بعده'],
    ['اليـــوم تفتخــــر العـــلــــى أن تثأروا', '', '7-يا عُرْبُ والثــارات قد خُلِقَتْ لكــم'],
    ['تأبــــى المروءة أن تنام ويســــهروا', '', '8-يدعوك شعبُك يا صلاح الدّين قم'],
    ['قبـــــل الرحــــيـل فَعُد إليهم يذكـــــروا', '', '9-نســـي الصلـــــيبيون ما (علَّمتهم)'],
    ['دمــــعٌ يسيـــل ولا دمــــاءٌ تُهــــــدر؟', '', '10-الأجـــــل مَبْكاكـــــم تسيـــــل دمـــاؤنا'],
    ['مـــن هُــــــوة فيـــــها الأبــــالسُ تُحشَر', '', '11-أقلـــقتـــــم الدنيـــــا بموطنكم، أمـــــا'],
    ['وغــــاراتنا في القــــــدس عنـــــا تخبر', '', '12-فقـــــل لأنــــاس (يُنكرون مَعادنا)'],
    ['وهل بعد وجه الشمس للفـجر مُنكِرُ؟', '', '13-أيفعل غير الــــــعرب ما تشهدونه'],
    ['وكـــلّ غــــلام في فلسطـــين «عَنْتر»', '', '14-فكـــلّ فتاة فـــي فلسطين «خولة»'],
]


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


# ── الوثائق ──
POEM = []
for _ajz, _empty, _sadr in POEM_RAW:
    _m = re.match(r"^(\d+)-(.*)$", _sadr)
    assert _m and _empty == "", _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 15)]
DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[3]},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[4]},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "السّند", "text": PARAS[24]}]
P1, P2, P3 = PARAS[6], PARAS[14], PARAS[23]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)

q("q1", "1", P1, J(7), 2, [el("q1-e1", "المخاطب في مطلع القصيدة", 1), el("q1-e2", "أربع صفات له (4×0.25)", 1)], DOCS)
q("q2", "2", P1, J(8), 1.5, [el("q2-e1", "الأبيات الّتي يستنهض فيها الشّاعر همم العرب (3×0.25)", 0.75),
                            el("q2-e2", "التّراكيب الدّالّة على ذلك (3×0.25)", 0.75)], DOCS)
q("q3", "3", P1, J(9), 2, [el("q3-e1", "تحرير صلاح الدّين لفلسطين من الصّليبيّين", 1), el("q3-e2", "الدّور اليوم على أحفاده", 1)], DOCS)
q("q4", "4", P1, PARAS[10] + " " + PARAS[11], 1,
  [el("q4-e1", "العبارة الأولى", 0.25), el("q4-e2", "العبارة الثّانية", 0.25), el("q4-e3", "العبارة الثّالثة", 0.25), el("q4-e4", "العبارة الرّابعة", 0.25)], DOCS)
q("q5", "5", P1, J(12), 1.5, [el("q5-e1", "تفسير غلبة النّمط الوصفيّ", 0.5), el("q5-e2", "المؤشّران (2×0.25)", 0.5), el("q5-e3", "المثالان (2×0.25)", 0.5)], DOCS)
q("q6", "6", P1, J(13), 2, [el("q6-e1", "النّثر: تسلسل الأفكار", 1), el("q6-e2", "النّثر: أسلوب المترشّح", 0.5), el("q6-e3", "النّثر: حجم النّصّ", 0.5)], DOCS)
q("q7", "1", P2, PARAS[15] + "\n" + PARAS[16] + "\n" + PARAS[17] + " " + PARAS[18], 2,
  [el("q7-e1", "تفسير نصب «مغلوبًا» (ب5)", 0.5), el("q7-e2", "إعراب «العلى» (ب7)", 0.5), el("q7-e3", "محلّ جملة «علّمتهم» (ب9)", 0.5),
   el("q7-e4", "محلّ جملة «ينكرون معادنا» (ب12)", 0.5)], DOCS)
q("q8", "2", P2, PARAS[19] + " " + PARAS[20], 1.5,
  [el("q8-e1", "الضّمير الأوّل: الكاف في «منك» — تحديده ونوعه وعائده (3×0.25)", 0.75),
   el("q8-e2", "الضّمير الثّاني: فاعل «فعُدْ» — تحديده ونوعه وعائده (3×0.25)", 0.75)], DOCS)
q("q9", "3", P2, J(21), 1.5, [el("q9-e1", "معنى «لو» (ب3)", 0.75), el("q9-e2", "معنى «إنّ» (ب4)", 0.75)], DOCS)
q("q10", "4", P2, J(22), 1, [el("q10-e1", "استخراج الصّورة", 0.25), el("q10-e2", "شرح الصّورة", 0.25), el("q10-e3", "نوع الصّورة", 0.25),
                             el("q10-e4", "بلاغة الصّورة", 0.25)], DOCS)
q("q11", "التّعليمة", P3, PARAS[25] + " " + PARAS[26], 4,
  [el("q11-e1", "البيت الّذي يتضمّن معنى الآية", 1.5), el("q11-e2", "اسم الظّاهرة في النّقد المعاصر", 1.5), el("q11-e3", "غرضها البلاغيّ", 1)], CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("المخاطب في مطلع القصيدة هو بلفور. وصفاته: التّجبّر – إخلاف الوعد – الخساءة – اللّؤم – الخسران – الكذب. "
           "ملاحظة: يكتفي المترشّح بذكر أربع صفات منها فقط.")
st("s01", "q1", "q1-e1", "mcq", "مَن المخاطَب في مطلع القصيدة؟",
   {"options": ["بلفور", "صلاح الدّين", "العرب", "الصّليبيّون"]}, {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "mcq", "أيّ عبارة تسمّي هذا المخاطَب صراحة؟",
   {"options": ["«من جيب غيرك محسنًا يا بلفر» (ب3)", "«يدعوك شعبك يا صلاح الدّين قم» (ب8)", "«يا عرب والثّارات قد خلقت لكم» (ب7)",
                "«فقل لأناس ينكرون معادنا» (ب12)"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.evidence", "b")
st("s03", "q1", "q1-e2", "multi", "أيّ ممّا يلي من صفات المخاطَب في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّجبّر", "إخلاف الوعد", "الخساءة", "اللّؤم", "الخسران", "الكذب", "الكرم", "الوفاء بالوعد", "الشّجاعة"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s04", "q1", "q1-e2", "fill_blank", "أكمل صفات المخاطَب:",
   {"text": "وصفاته: التّجبّر – إخلاف ____ – الخساءة – اللّؤم – ____ – الكذب.", "bank": ["الوعد", "الخسران", "الكرم", "الوفاء"]},
   {"blanks": [["الوعد"], ["الخسران"]]}, Q1_EXPL, 0.5, "ar.comprehension.details", "b")
Q2_EXPL = ("يستنهض الشّاعر همم العرب في الأبيات التّالية: 5-6-7-8-9. التّراكيب الدّالّة على ذلك: فلقد نفوز – تعالى الحقّ – يا عرب والثّارات قد خلقت لكم – "
           "يا صلاح الدّين قم – عد إليهم… ملاحظة: يكتفي المترشّح بذكر ثلاثة أبيات وثلاثة تراكيب.")
st("s05", "q2", "q2-e1", "multi", "في أيّ الأبيات يستنهض الشّاعر همم العرب؟ (اختر كلّ ما يصحّ)",
   {"options": ["البيت 5", "البيت 6", "البيت 7", "البيت 8", "البيت 9", "البيت 1", "البيت 2", "البيت 3"]},
   {"correct": [0, 1, 2, 3, 4]}, Q2_EXPL, 0.75, "ar.comprehension.evidence")
st("s06", "q2", "q2-e2", "multi", "ما التّراكيب الدّالّة على استنهاض همم العرب؟ (اختر كلّ ما يصحّ)",
   {"options": ["فلقد نفوز", "تعالى الحقّ", "يا عرب والثّارات قد خلقت لكم", "يا صلاح الدّين قم", "عد إليهم", "تعد الوعود وتقتضي إنجازها",
                "من جيب غيرك محسنًا يا بلفر"]},
   {"correct": [0, 1, 2, 3, 4]}, Q2_EXPL, 0.75, "ar.comprehension.evidence")
Q3_EXPL = ("علاقة صلاح الدّين بفلسطين في النّصّ: أنّه حرّرها من أيدي الصّليبيّين الّذين استولوا عليها من قبل، والدّور اليوم على أحفاده لتحريرها من قبضة "
           "اليهود الصّهاينة المغتصبين.")
st("s07", "q3", "q3-e1", "mcq", "ما علاقة «صلاح الدّين» بفلسطين في النّصّ؟",
   {"options": ["أنّه حرّرها من أيدي الصّليبيّين الّذين استولوا عليها من قبل", "أنّه وُلد فيها ونشأ بها", "أنّه سلّمها للصّليبيّين بعد صلح",
                "أنّه كان أوّل من بنى حائط البراق"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "أنّه ____ فلسطين من أيدي ____ الّذين استولوا عليها من قبل.", "bank": ["حرّر", "الصّليبيّين", "سلّم", "المغول"]},
   {"blanks": [["حرّر"], ["الصّليبيّين"]]}, Q3_EXPL, 0.5, "ar.comprehension.details", "b")
st("s09", "q3", "q3-e2", "mcq", "وما الّذي يطلبه الشّاعر من أحفاد صلاح الدّين اليوم؟",
   {"options": ["أن يحرّروا فلسطين من قبضة اليهود الصّهاينة المغتصبين كما حرّرها جدّهم", "أن يتركوا فلسطين لمصيرها", "أن يفاوضوا بلفور على وعده",
                "أن يهاجروا من فلسطين"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.link")
st("s10", "q3", "q3-e2", "fill_blank", "أكمل:",
   {"text": "والدّور اليوم على ____ لتحريرها من قبضة اليهود ____ المغتصبين.", "bank": ["أحفاده", "الصّهاينة", "الغرباء", "الصّليبيّين"]},
   {"blanks": [["أحفاده"], ["الصّهاينة"]]}, Q3_EXPL, 0.5, "ar.comprehension.link", "b")
Q4_EXPL = ("العبارات الدّالّة على تجسيد الشّاعر صوت أمّته ودفاعه عن قضاياها المصيريّة في النّصّ: فلقد نفوز ونحن أضعف أمّة – تسيل دماؤنا – ينكرون معادنا – "
           "وغاراتنا في القدس عنّا تخبر.")
st("s11", "q4", "q4-e1", "fill_blank", "أكمل العبارة الأولى (ب5):",
   {"text": "فلقد نفوز ونحن ____ أمّة", "bank": ["أضعف", "أقوى", "أغنى"]}, {"blanks": [["أضعف"]]}, Q4_EXPL, 0.25, "ar.comprehension.evidence")
st("s12", "q4", "q4-e2", "mcq", "أكمل العبارة الثّانية (ب10): «تسيل …»",
   {"options": ["دماؤنا", "أنهارنا", "أموالنا", "أشعارنا"]}, {"correct": 0}, Q4_EXPL, 0.25, "ar.comprehension.evidence")
st("s13", "q4", "q4-e3", "fill_blank", "أكمل العبارة الثّالثة (ب12):",
   {"text": "____ معادنا", "bank": ["ينكرون", "يعرفون", "يحمون"]}, {"blanks": [["ينكرون"]]}, Q4_EXPL, 0.25, "ar.comprehension.evidence")
st("s14", "q4", "q4-e4", "mcq", "أكمل العبارة الرّابعة (ب12): «وغاراتنا في … عنّا تخبر»",
   {"options": ["القدس", "بغداد", "دمشق", "القاهرة"]}, {"correct": 0}, Q4_EXPL, 0.25, "ar.comprehension.evidence")
Q5_EXPL = ("أفسّر غلبة النّمط الوصفيّ على الأبيات بكون الشّاعر وقف موقف الواصف لجرائم الصّهاينة في حقّ الأبرياء من أبناء الشّعب الفلسطينيّ. "
           "ومؤشّراه: كثرة الأفعال المضارعة الدّالّة على الاستمرار والتّجدّد (المثال: تعد، تقتضي، تسيل…)؛ كثرة المجاز من استعارات وتشبيهات "
           "(المثال: احسب حساب الحقّ، تأبى المروءة، كلّ فتاة خولة، وكلّ غلام عنتر).")
st("s15", "q5", "q5-e1", "mcq", "بمَ تفسّر غلبة النّمط الوصفيّ على الأبيات؟",
   {"options": ["بكون الشّاعر وقف موقف الواصف لجرائم الصّهاينة في حقّ الأبرياء من أبناء الشّعب الفلسطينيّ", "بكون الشّاعر يروي قصّة متسلسلة الأحداث",
                "بكون الشّاعر يحاور شخصيّات متعدّدة", "بكون الشّاعر يشرح حقائق علميّة"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.text.type")
IND = ["كثرة الأفعال المضارعة الدّالّة على الاستمرار والتّجدّد", "كثرة المجاز من استعارات وتشبيهات"]
st("s16", "q5", "q5-e2", "multi", "ما مؤشّرا النّمط الوصفيّ في الأبيات؟ (اختر كلّ ما يصحّ)",
   {"options": IND + ["كثرة الحوار بين الشّخصيّات", "الاعتماد على الأرقام والإحصاءات"]}, {"correct": [0, 1]}, Q5_EXPL, 0.5, "ar.text.type")
st("s17", "q5", "q5-e3", "matching", "طابق كلّ مؤشّر بمثاله من الأبيات.",
   {"lefts": IND, "rights": ["(تعد، تقتضي، تسيل…)", "(احسب حساب الحقّ، تأبى المروءة، كلّ فتاة خولة، وكلّ غلام عنتر)", "(قال، أجاب، سأل…)"]},
   {"pairs": [0, 1]}, Q5_EXPL, 0.5, "ar.text.type")
NATHR_SPEC = {"task": "نثر الأبيات الثّلاثة الأخيرة بأسلوب المترشّح", "scope": "الأبيات 12–14",
              "text": "قصيدة الشّاعر القرويّ (بكالوريا 2011، لغات أجنبيّة، الموضوع الأوّل)",
              "scheme": "نثر الأبيات: يراعى فيه: تسلسل الأفكار (01) – أسلوب المترشّح (0.5) – حجم النّصّ (0.5)"}
NATHR_EXPL = "يراعى في نثر الأبيات: تسلسل الأفكار (01)، أسلوب المترشّح (0.5)، حجم النّصّ (0.5). لا يقدّم الحلّ نثرًا نموذجيًّا."
essay("s18", "q6", "q6-e1", "نثر الأبيات الثّلاثة الأخيرة", "تسلسل الأفكار", "تسلسل الأفكار", 1, NATHR_SPEC, NATHR_EXPL, "ar.writing.summary")
essay("s19", "q6", "q6-e2", "نثر الأبيات الثّلاثة الأخيرة", "أسلوب المترشّح", "أسلوب المترشّح", 0.5, NATHR_SPEC, NATHR_EXPL, "ar.writing.summary")
essay("s20", "q6", "q6-e3", "نثر الأبيات الثّلاثة الأخيرة", "حجم النّصّ", "حجم النّصّ", 0.5, NATHR_SPEC, NATHR_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s21", "q7", "q7-e1", "mcq", "بمَ تفسّر نصب كلمة «مغلوبًا» في قوله: «وتؤوب مغلوبًا وأنت الأقدر»؟",
   {"options": ["لأنّها وردت حالًا", "لأنّها مفعول به", "لأنّها تمييز", "لأنّها مفعول لأجله"]},
   {"correct": 0}, "أفسّر نصب كلمة «مغلوبًا» لأنّها وردت حالًا.", 0.5, "ar.grammar.irab")
st("s22", "q7", "q7-e2", "mcq", "ما إعراب «العلى» في قوله: «اليوم تفتخر العلى أن تثأروا»؟",
   {"options": ["فاعل مرفوع وعلامة رفعه الضّمّة المقدّرة على آخره منع من ظهورها التّعذّر", "مفعول به منصوب وعلامة نصبه الفتحة المقدّرة للتّعذّر",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة المقدّرة للتّعذّر", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "«العلى»: فاعل مرفوع وعلامة رفعه الضّمّة المقدّرة على آخره منع من ظهورها التّعذّر.", 0.5, "ar.grammar.maqsur")
st("s23", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «علّمتهم» في قوله: «نسي الصّليبيّون ما (علّمتهم)»؟",
   {"options": ["صلة موصول لا محلّ لها من الإعراب", "في محلّ نصب مفعول به", "في محلّ نصب حال", "في محلّ رفع خبر"]},
   {"correct": 0}, "«علّمتهم»: صلة موصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s24", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «ينكرون معادنا» في قوله: «فقل لأناس (ينكرون معادنا)»؟",
   {"options": ["جملة فعليّة في محلّ جرّ صفة", "جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به",
                "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "«ينكرون معادنا»: جملة فعليّة في محلّ جرّ صفة (لـ«أناس»).", 0.5, "ar.grammar.sentence_case")
PRON_EXPL = "غلب على النّصّ الضّمير المخاطب المفرد، منه: الكاف في (منك): ضمير متّصل، العائد عليه: بلفور؛ فاعل الفعل (فعُدْ): ضمير مستتر (أنت)، العائد عليه: صلاح الدّين."
st("s25", "q8", "q8-e1", "mcq", "أيّ ممّا يلي ضمير مخاطب مفرد متّصل؟",
   {"options": ["الكاف في «منك» (ب1)", "«نحن» في «ونحن أضعف أمّة» (ب5)", "الواو في «يسهروا» (ب8)", "«نا» في «دماؤنا» (ب10)"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s26", "q8", "q8-e1", "mcq", "ما نوع الضّمير الكاف في «منك»؟",
   {"options": ["ضمير متّصل", "ضمير منفصل", "ضمير مستتر"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference", "b")
st("s27", "q8", "q8-e1", "mcq", "على من يعود الكاف في «الحقّ منك ومن وعودك أكبر»؟",
   {"options": ["على بلفور", "على صلاح الدّين", "على العرب", "على الصّليبيّين"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference", "c")
st("s28", "q8", "q8-e2", "mcq", "أيّ ممّا يلي ضمير مخاطب مفرد مستتر؟",
   {"options": ["فاعل الفعل «فعُدْ» (ب9)", "الواو في «يذكروا» (ب9)", "«هم» في «علّمتهم» (ب9)", "«نا» في «معادنا» (ب12)"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s29", "q8", "q8-e2", "mcq", "ما نوع الضّمير الفاعل في «فعُدْ إليهم»؟",
   {"options": ["ضمير مستتر تقديره أنت", "ضمير متّصل", "ضمير منفصل"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference", "b")
st("s30", "q8", "q8-e2", "mcq", "على من يعود فاعل الفعل «فعُدْ» في البيت التّاسع؟",
   {"options": ["على صلاح الدّين", "على بلفور", "على الصّليبيّين", "على الشّعب"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference", "c")
LAW_EXPL = "المعنى الّذي دلّت عليه: لو: أفاد الشّرط وهو حرف امتناع لامتناع؛ إنّ: حرف مشبّه بالفعل أفاد التّوكيد ورفع الشّكّ والرّدّ على المنكر."
st("s31", "q9", "q9-e1", "mcq", "ما المعنى الّذي دلّت عليه «لو» في قوله: «لو كنت من أهل المكارم لم تكن…»؟",
   {"options": ["أفادت الشّرط، وهي حرف امتناع لامتناع", "أفادت التّمنّي", "حرف مصدريّ", "حرف شرط جازم"]}, {"correct": 0}, LAW_EXPL, 0.5, "ar.grammar.conditional")
st("s32", "q9", "q9-e1", "fill_blank", "أكمل:",
   {"text": "«لو» حرف امتناع لـ____.", "bank": ["امتناع", "وجود", "استقبال"]}, {"blanks": [["امتناع"]]}, LAW_EXPL, 0.25, "ar.grammar.conditional", "b")
st("s33", "q9", "q9-e2", "mcq", "ما المعنى الّذي دلّت عليه «إنّ» في صدر البيت الرّابع؟",
   {"options": ["حرف مشبّه بالفعل أفاد التّوكيد ورفع الشّكّ والرّدّ على المنكر", "حرف نفي", "حرف شرط", "حرف تمنٍّ"]},
   {"correct": 0}, LAW_EXPL, 0.5, "ar.grammar.nawasikh")
st("s34", "q9", "q9-e2", "fill_blank", "أكمل:",
   {"text": "«إنّ» أفادت التّوكيد ورفع ____ والرّدّ على المنكر.", "bank": ["الشّكّ", "اليقين", "الحرج"]}, {"blanks": [["الشّكّ"]]}, LAW_EXPL, 0.25, "ar.grammar.nawasikh", "b")
IMG_EXPL = ("الصّورة البيانيّة الواردة في عجز البيت الثّامن هي: (تأبى المروءة). شرحها: شبّه الشّاعر المروءة وهي شيء معنويّ بإنسان يأبى، فحذف المشبّه به "
            "(الإنسان) ورمز إليه بشيء من لوازمه وهو الفعل (تأبى) وذلك على سبيل الاستعارة المكنيّة. بلاغتها: تشخيص المعنى وتقويته وتوضيحه في بيان النّفور والاشمئزاز.")
st("s35", "q10", "q10-e1", "mcq", "استخرج الصّورة البيانيّة الواردة في عجز البيت الثّامن.",
   {"options": ["«تأبى المروءة»", "«يدعوك شعبك»", "«قبل الرّحيل»", "«ما بعده كذب»"]},
   {"correct": 0}, IMG_EXPL + " (العبارات الأخرى ليست من عجز البيت الثّامن.)", 0.25, "ar.rhetoric.metaphor")
st("s36", "q10", "q10-e2", "matching", "اشرح الصّورة في «تأبى المروءة»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "اللّازمة الدّالّة عليه"], "rights": ["المروءة", "إنسان يأبى", "الفعل «تأبى»", "صلاح الدّين"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s37", "q10", "q10-e3", "mcq", "ما نوع الصّورة البيانيّة في «تأبى المروءة»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته الكلّيّة"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s38", "q10", "q10-e4", "mcq", "ما بلاغة الصّورة في «تأبى المروءة»؟",
   {"options": ["تشخيص المعنى وتقويته وتوضيحه في بيان النّفور والاشمئزاز", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ في البيت",
                "الإيجاز بحذف الأداة ووجه الشّبه"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("البيت الّذي يتضمّن معنى الآية الكريمة هو البيت الخامس: «فلقد نفوز ونحن أضعف أمّة … وتؤوب مغلوبًا وأنت الأقدر». تُسمّى هذه الظّاهرة في النّقد "
             "المعاصر بـ: التّناصّ. الغرض البلاغيّ منها: إثراء المعنى وتقويته وإكسابه مصداقيّة بإحالته على مرجعيّة سابقة، ليكون أكثر تأثيرًا في نفس المتلقّي.")
st("s39", "q11", "q11-e1", "mcq", "ما البيت الّذي يتضمّن معنى الآية الكريمة في القصيدة؟",
   {"options": ["البيت الخامس: «فلقد نفوز ونحن أضعف أمّة … وتؤوب مغلوبًا وأنت الأقدر»", "البيت الأوّل: «الحقّ منك ومن وعودك أكبر…»",
                "البيت السّابع: «يا عرب والثّارات قد خلقت لكم…»", "البيت الرّابع عشر: «فكلّ فتاة في فلسطين خولة…»"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.intertext")
st("s40", "q11", "q11-e1", "fill_blank", "أكمل:",
   {"text": "البيت الّذي يتضمّن معنى الآية هو البيت ____.", "bank": ["الخامس", "الأوّل", "السّابع"]}, {"blanks": [["الخامس"]]}, CRIT_EXPL, 0.5,
   "ar.literature.intertext", "b")
st("s41", "q11", "q11-e2", "mcq", "كيف تُسمّى هذه الظّاهرة في النّقد المعاصر؟",
   {"options": ["التّناصّ", "السّرقة الأدبيّة", "المعارضة الشّعريّة", "التّضمين العروضيّ"]}, {"correct": 0}, CRIT_EXPL, 1, "ar.literature.intertext")
st("s42", "q11", "q11-e2", "fill_blank", "أكمل:",
   {"text": "تُسمّى هذه الظّاهرة في النّقد المعاصر بـ: ____.", "bank": ["التّناصّ", "الطّباق", "الجناس"]}, {"blanks": [["التّناصّ"]]}, CRIT_EXPL, 0.5,
   "ar.literature.intertext", "b")
st("s43", "q11", "q11-e3", "mcq", "ما الغرض البلاغيّ من هذه الظّاهرة؟",
   {"options": ["إثراء المعنى وتقويته وإكسابه مصداقيّة بإحالته على مرجعيّة سابقة، ليكون أكثر تأثيرًا في نفس المتلقّي", "إحداث جرس موسيقيّ بتكرار الحروف",
                "إخفاء مصدر الفكرة عن القارئ", "إطالة القصيدة وزيادة أبياتها"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.intertext")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (الشّاعر القرويّ رشيد سليم الخوري)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "لا خطأ نسخ لفظيّ في docx (فروق شكل وعناوين فقط، أُبقيت)، ووُصلت الأسئلة المقطوعة أسطرها. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): نثر الأبيات الثّلاثة الأخيرة س6 (01 تسلسل الأفكار + 0.5 الأسلوب + 0.5 الحجم).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T18:20:00Z")
