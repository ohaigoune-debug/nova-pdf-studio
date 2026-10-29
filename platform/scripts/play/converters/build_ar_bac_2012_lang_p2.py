"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ، الإنسانيّة).
Exam (most faithful source): gdrive 1U1rgNlqW81UmuvHTcR5W2osVt7_8oeES (بكالوريا العربية 2012 شعبة لغات اجنبية.. .docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1q5eG57R5k_pnoZGShUX1QzQYXGEGMC2V (BAC 2012 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1LQF1OubnVtgWsEY5UjCtAamsEhxFZ7OA (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلالم التّنقيط»): gdrive 163UOwr81JdMgDGCMu_c-P4BTDxTSVK2V (02_التصحيح.pdf, pages 2–4).

Method (as build_ar_bac_2016_lit_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (text, author, glossary,
question texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer whitespace and
outer direction marks trimmed). Where the docx stores the printed lines of one paragraph as separate paragraphs, they are
joined with a space into the paragraphs of the ONEC paper (the quoted verse «فلو كان رمحًا واحدا لاتّقيته … ولكنه رمحٌ
وثان وثالث» stays its own line with the docx spacing); the questions split over two docx paragraphs (part 2 Q1, Q3) are
joined the same way. Every verbatim string of the JSON was re-checked programmatically against the docx. The docx was
compared with the official ONEC paper (rendered at 130 dpi): same text and questions; underlined «تُحابي» and «متعاضدين»
in both; parenthesised (تستغيث) and (يجرّها). The correction is a scanned PDF, read from the rendered pages (150 dpi, fully
legible). Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «الشعبة: لغات أجنبية» ⇒ LANG (the docx header carries a template line «دورة جوان
  2008 / جميع الشعب»; year and stream come from the ONEC paper and the correction).
- docx defects fixed from the ONEC paper: «وتستنجد فهك من منجد؟» ⇒ «فهل» (typo); part 3 «ومن الذي يتأنقون» ⇒ «ومن الذين
  يتأنقون» (ONEC «ومنَ الذين يتأنّقون»). Kept as in the docx: diacritics, «تظافرت» (so on the ONEC paper too), the glossary
  heading «الشرح اللغوي:» (ONEC «شرح المفردات:»), the part-3 statement and instruction in one paragraph (two on the ONEC paper).
- Rule for «n×m» lines: interchangeable items (more listed than required) ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1: 01 the issue + 01 the purpose (three listed). Q2 «2×0.5» = what humanity is likened to + how it is described.
  Q3 «3×0.5» = exactly the three problems listed (الحروب والأمراض / الكوارث الطّبيعيّة / الاستبداد والفقر) ⇒ three elements.
  Q4 01. Q5 «2×0.5» beside one sentence («طلب النّجدة وطلب العون لمواجهة مصيبتين كبيرتين») ⇒ one element of 1. Q6 «3×0.5»
  three traits («مصلحة – إنسانيّة – محبّة للخير»; «قد يضيف التّلميذ عبارات أخرى صحيحة. نكتفي بثلاث فقط») ⇒ one element of
  1.5, interactive with clearly wrong traits only (no plausible trait is marked wrong). Q7 «4×0.5» two patterns among three
  (سرديّ / وصفيّ / إخباريّ), each with its example ⇒ one element of 2.
- Part 2: Q1 «2×0.25» + «2×0.25» = example + type, form + purpose ⇒ four elements (the example asked is any inshāʾ sentence:
  only خبريّ sentences of the text are offered as wrong examples). Q2: 0.5 «تحابي», 0.5 «متعاضدين», 0.25 per sentence.
  Q3 «2×0.5» = explanation + type (the line holds both), 0.25 effect. Q4 0.5 the figures (الطّباق والجناس) + 0.5 the
  reason. Q5 «3×0.25» three religious words («قد يذكر التّلميذ ألفاظًا أخرى صحيحة») ⇒ one element of 0.75 (only
  non-religious words as distractors) + 0.5 the reason.
- Part 3 (04): «4×0.5» (أ) the two features of the essay listed (الوحدة الموضوعيّة / العرض المنهجيّ), each with its example
  ⇒ two elements of 1; «4×0.5» (ب) two features of the writer's style among four, with examples ⇒ one element of 2.
- Distractors avoid what the scheme or usage could accept: no «الحجاجيّ / الإيعازيّ / التّفسيريّ» among the patterns of Q7
  («ألا فليرحم…» could be read as إيعاز); no «التّمنّي / النّفي / التّعجّب» for the purpose of «فهل من منجد؟»; no «السّجع /
  المقابلة» for the most used figures; no «الإنسانيّة» as the explained term of «تستغيث من داهيتين» (the scheme makes
  «الدّاهيتين» the مشبّه); no «فاجر / الدّين» among the non-religious words.
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

# ── الموضوع الثّاني (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P2_PARAS = ['الإنسانية تلك الأم الرؤوم التي لا تُحابِي واحدا من أبنائها دون آخر، ولا تميّز بين بارّ منهم وفاجر، ولا تفرق بين مؤمن منهم وكافر، تلك الأم المعذَّبة بالويلات والمحن، من ويلات الحروب التي أتلفت الملايين إلى ويلات الأمراض والطواعين إلى ويلات الزلازل والبراكين، الإنسانية التي لو تمثلت بشرًا لتمثلت بقول الشاعر العربي:', 'فلو كان رمحًا واحدا لاتّقيته         ولكنه رمحٌ وثان وثالث', 'عجبت لهذه الإنسانية ما كفاها من مصائب الدّهر تقاطع أبنائها وتدابرهم، ونصب الحبائل وبث المكائد لبعضهم بعضا.', 'ما كفاها من مصائب الدهر أن يكون في أبنائها قويّ يستعبد ضعيفا، وشريف يستخدم مشروفا،', 'ما كفاها أن تنقلب الحقائق على أبنائها المارقين العاقّين فيركبون مطايا الخير للشر، ويستعملون سلاح النفع للضر، ويتوسلون بالدّين لجمع الدنيا، ما كفتها هذه المصائب المجتاحة حتى ظاهرتها الطبيعة الجبّارة على هذه الإنسانية المسكينة. يا الله. أما كفتها مصائب الأرض حتى ظاهرتها مصائب السماء.', 'ألا فليرحم الإنسانية من في قلبه رحمة، ألا وإنّ الإنسانية (تستغيث) فهل من مغيث، وتستنجد فهل من منجد؟', 'واستغاثت من طواغيت الاستبداد وقياصرة الاستعباد، فأغاثها دعاة الديمقراطية وأنصار المساواة والإنصاف. وهي الآن تستغيث من داهيتين وتستجير من غائلتين. ولا ندري متى تغاث، ولا في أي وقت تجاب. هي تستغيث من داهية الحرب وتحكيم السيف في مواقع الخلاف، فمتى يقف عقلاء الأمم بين الصفين موقف دعاة التحكيم يوم صفّين؟', 'لا ندري ولا ندري لماذا لا ندري.', 'وهي تستغيث من غائلة الفقر وشروره وجيوشه التي (يجرّها) من خراب العالم لتخريب معموره. فمتى يفقه أغنياء الأمم هذا السرّ فيعملون على اتقاء الشر؟ لا ندري ولا ندري لماذا لا ندري.', 'إنما الذي ندريه ونقوله ولا نخفيه هو أنه لو تساند أغنياء الأمم ومدّوا أيديهم متعاضدين، وعرفوا كيف يحاربون الفقر باستجلاب الفقير والأخذ بيده لأحسنوا لأنفسهم وللعالم، ولو فعلوا ذلك لدفعوا عن العالم غارة شعواء تلتهم الأخضر واليابس.']
P2_REF = '- الشيخ محمد البشير الإبراهيمي-'
P2_GLOSS = 'الشرح اللغوي:\nالرؤوم: الأم التي تعطف على ولدها وتلازمه.   -  تُحَابِي: حابى غيره: مال إليه وعامله معاملة خاصة-\nالغائلة: الفساد والشر - شعواء: المنتشرة المتفرقة   - صفين: المعركة الشهيرة بين جيوش عليّ ومعاوية.'
P2_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'ما القضية التي يعالجها الإبراهيمي في هذا النّص؟ وما الهدف من إثارتها؟', 'بماذا شبّه الكاتب "الإنسانية"؟ وبماذا وصف المشبّه به؟', 'عَدّد الكاتب مجموعة مشكلات تواجه الإنسانية. اذكر ثلاثا منها.', 'تؤدي مشكلات الإنسانية على اختلافها إلى مشكلة واحدة. استنتجها من خلال النّص.', 'ما المقصود بقول الكاتب: (تستغيث من داهيتين وتستجير من غائلتين)؟', 'كيف تبدو لك شخصية الإبراهيمي من خلال النّص؟', 'تظافرت في النّص مجموعة من الأنماط التعبيرية. اذكر اثنين منها. مع التمثيل.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'وظّف الكاتب الأسلوب الإنشائي في مواضع كثيرة. مثّل له بمثال من النّص مبينا نوعه وصيغته وأثره.', 'أعرب ما تحته خط إعراب كلمات وما بين قوسين إعراب جمل.', 'اشرح الصورة البيانية الموجودة في العبارة (وهي تستغيث من داهيتين)، مبينا نوعها ووجه بلاغتها.', 'أيّ المحسنات البديعية كانت أكثر استعمالا في النّص؟ بم تعلّل ذلك؟', 'تَضمن النّص مجموعة من الألفاظ الدينية. اذكر ثلاثا منها، مبرّرا سبب استخدامها.', 'ثالثا- التّقويم النقدي: (04 نقاط)', 'الإبراهيمي من كُتاب المقالة المرموقين، ومن الذين يتأنقون في أسلوبهم. أثبت هذا الحكم، باستنباط خاصيّتين من خصائص فن المقال، وخاصيّتين من خصائص أسلوب الكاتب من النص، مع التمثيل.']


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


QP = P2_QP
J = lambda *ix: "\n".join(QP[i] for i in ix)
P1, P2, P3 = QP[0], QP[8], QP[14]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and len(QP) == 16 and len(P2_PARAS) == 10
D = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P2_GLOSS},
]

q("q1", "1", P1, J(1), 2, [el("q1-e1", "القضيّة الّتي يعالجها الإبراهيميّ", 1), el("q1-e2", "الهدف من إثارتها", 1)], D)
q("q2", "2", P1, J(2), 1, [el("q2-e1", "ما شبّه به الكاتب الإنسانيّة", 0.5), el("q2-e2", "وصف المشبّه به", 0.5)], D)
q("q3", "3", P1, J(3), 1.5, [el("q3-e1", "مشكلة: الحروب والأمراض", 0.5), el("q3-e2", "مشكلة: الكوارث الطّبيعيّة", 0.5), el("q3-e3", "مشكلة: الاستبداد والفقر", 0.5)], D)
q("q4", "4", P1, J(4), 1, [el("q4-e1", "المشكلة الّتي تؤدّي إليها المشكلات", 1)], D)
q("q5", "5", P1, J(5), 1, [el("q5-e1", "المقصود بـ(تستغيث من داهيتين وتستجير من غائلتين) (2×0.5)", 1)], D)
q("q6", "6", P1, J(6), 1.5, [el("q6-e1", "ثلاث صفات لشخصيّة الإبراهيميّ (3×0.5)", 1.5)], D)
q("q7", "7", P1, J(7), 2, [el("q7-e1", "نمطان مع التّمثيل (4×0.5)", 2)], D)
q("q8", "1", P2, J(9), 1, [el("q8-e1", "المثال من النّصّ", 0.25), el("q8-e2", "نوعه", 0.25), el("q8-e3", "صيغته", 0.25), el("q8-e4", "غرضه (أثره)", 0.25)], D)
q("q9", "2", P2, J(10), 1.5, [el("q9-e1", "إعراب «تحابي»", 0.5), el("q9-e2", "إعراب «متعاضدين»", 0.5), el("q9-e3", "محلّ جملة (تستغيث)", 0.25), el("q9-e4", "محلّ جملة (يجرّها)", 0.25)], D)
q("q10", "3", P2, J(11), 1.25, [el("q10-e1", "(وهي تستغيث من داهيتين): الشّرح", 0.5), el("q10-e2", "(وهي تستغيث من داهيتين): النّوع", 0.5),
                                el("q10-e3", "(وهي تستغيث من داهيتين): الأثر", 0.25)], D)
q("q11", "4", P2, J(12), 1, [el("q11-e1", "المحسّنات البديعيّة الأكثر استعمالًا", 0.5), el("q11-e2", "تعليل ذلك", 0.5)], D)
q("q12", "5", P2, J(13), 1.25, [el("q12-e1", "ثلاثة ألفاظ دينيّة (3×0.25)", 0.75), el("q12-e2", "سبب استخدامها", 0.5)], D)
q("q13", "1", P3, J(15), 4, [el("q13-e1", "خاصّيّة المقال: الوحدة الموضوعيّة مع التّمثيل (2×0.5)", 1), el("q13-e2", "خاصّيّة المقال: العرض المنهجيّ مع التّمثيل (2×0.5)", 1),
                             el("q13-e3", "خاصّيّتان من خصائص أسلوب الكاتب مع التّمثيل (4×0.5)", 2)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي يعالجها الإبراهيميّ في هذا النّصّ؟",
   {"options": ["قضيّة الإنسانيّة وما تواجهه من مشاكل وآلام", "قضيّة الصّراع بين القديم والجديد", "قضيّة الاستعمار الفرنسيّ للجزائر", "قضيّة التّعليم ومحاربة الأمّيّة"]},
   {"correct": 0}, "يعالج الإبراهيميّ في هذا النّصّ قضيّة الإنسانيّة وما تواجهه من مشاكل وآلام.", 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "multi", "ما الهدف من إثارة هذه القضيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["لفت الانتباه إلى مشاكل البشريّة", "تسليط الضّوء على واجب الإنسانيّة في معالجة قضاياها", "استعطاف أغنياء العالم لمساعدة إخوانهم من بني البشر",
                "تمجيد الحروب وأبطالها", "الدّعوة إلى اعتزال النّاس"]},
   {"correct": [0, 1, 2]}, "الهدف من إثارة هذا الموضوع: لفت الانتباه إلى مشاكل البشريّة؛ تسليط الضّوء على واجب الإنسانيّة في معالجة قضاياها؛ استعطاف أغنياء العالم لمساعدة إخوانهم من بني البشر.", 1, "ar.comprehension.purpose")
st("s03", "q2", "q2-e1", "mcq", "بماذا شبّه الكاتب «الإنسانيّة»؟",
   {"options": ["بالأمّ الرّؤوم", "بالطّبيعة الجبّارة", "بالرّمح الواحد", "بالقاضي العادل"]},
   {"correct": 0}, "شبّه الكاتب الإنسانيّة بالأمّ الرّؤوم («الإنسانيّة تلك الأمّ الرّؤوم…»).", 0.5, "ar.comprehension.image")
st("s04", "q2", "q2-e2", "fill_blank", "بماذا وصف المشبّه به؟ أكمل:",
   {"text": "وصفها بـ____ في معاملتها مع أبنائها، لا تفضّل أحدهم على الآخرين ولا تميّز بين بارّ و____ وبين مؤمن وكافر.", "bank": ["العدل", "فاجر", "القسوة", "صالح"]},
   {"blanks": [["العدل"], ["فاجر"]]}, "وصفها بالعدل في معاملتها مع أبنائها، لا تفضّل أحدهم على الآخرين ولا تميّز بين بارّ وفاجر وبين مؤمن وكافر.", 0.5, "ar.comprehension.details")
st("s05", "q3", "q3-e1", "fill_blank", "من المشكلات الّتي تواجه الإنسانيّة: أكمل من النّصّ:",
   {"text": "«من ويلات ____ الّتي أتلفت الملايين إلى ويلات ____ والطّواعين»", "bank": ["الحروب", "الأمراض", "الأفراح", "الأعياد"]},
   {"blanks": [["الحروب"], ["الأمراض"]]}, "مجموعة المشكلات الّتي تواجه الإنسانيّة: الحروب والأمراض – الكوارث الطّبيعيّة – الاستبداد والفقر.", 0.5, "ar.comprehension.details")
st("s06", "q3", "q3-e2", "mcq", "ما المشكلة الّتي تدلّ عليها عبارتا «ويلات الزّلازل والبراكين» و«ظاهرتها الطّبيعة الجبّارة»؟",
   {"options": ["الكوارث الطّبيعيّة", "الاستبداد", "الفقر", "الحروب"]},
   {"correct": 0}, "من المشكلات الّتي تواجه الإنسانيّة: الكوارث الطّبيعيّة (ويلات الزّلازل والبراكين، الطّبيعة الجبّارة).", 0.5, "ar.comprehension.details")
st("s07", "q3", "q3-e3", "mcq", "من أيّ مشكلتين تستغيث الإنسانيّة في قوله: «واستغاثت من طواغيت الاستبداد…» و«وهي تستغيث من غائلة الفقر…»؟",
   {"options": ["الاستبداد والفقر", "الجهل والمرض", "الهجرة والغربة", "التّلوّث والجفاف"]},
   {"correct": 0}, "ومن المشكلات الّتي تواجه الإنسانيّة: الاستبداد والفقر.", 0.5, "ar.comprehension.details")
st("s08", "q4", "q4-e1", "mcq", "إلى أيّ مشكلة واحدة تؤدّي مشكلات الإنسانيّة على اختلافها؟",
   {"options": ["مشكلة الفقر", "مشكلة الجهل", "مشكلة التّلوّث", "مشكلة الهجرة"]},
   {"correct": 0}, "تؤدّي مشكلات الإنسانيّة على اختلافها إلى مشكلة الفقر («وجيوشه الّتي يجرّها من خراب العالم لتخريب معموره»).", 1, "ar.comprehension.link")
st("s09", "q5", "q5-e1", "mcq", "ما المقصود بقول الكاتب: (تستغيث من داهيتين وتستجير من غائلتين)؟",
   {"options": ["طلب النّجدة وطلب العون لمواجهة مصيبتين كبيرتين", "الشّكوى من كثرة الحروب دون طلب المساعدة", "الاستسلام لمصيبتين لا علاج لهما", "الدّعوة إلى الثّأر من الأغنياء"]},
   {"correct": 0}, "المقصود بقول الكاتب (تستغيث من داهيتين وتستجير من غائلتين): طلب النّجدة وطلب العون لمواجهة مصيبتين كبيرتين.", 0.5, "ar.comprehension.explain")
st("s10", "q5", "q5-e1", "fill_blank", "أكمل المقصود بقوله: (تستغيث من داهيتين وتستجير من غائلتين):",
   {"text": "طلب ____ وطلب العون لمواجهة ____ كبيرتين.", "bank": ["النّجدة", "مصيبتين", "الثّأر", "فرصتين"]},
   {"blanks": [["النّجدة"], ["مصيبتين"]]}, "«طلب النّجدة وطلب العون لمواجهة مصيبتين كبيرتين» (هما داهية الحرب وغائلة الفقر).", 0.5, "ar.comprehension.explain", "b")
st("s11", "q6", "q6-e1", "multi", "كيف تبدو لك شخصيّة الإبراهيميّ من خلال النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["مصلحة", "إنسانيّة", "محبّة للخير", "أنانيّة", "متعصّبة", "لا مبالية بآلام النّاس"]},
   {"correct": [0, 1, 2]}, "تبدو شخصيّة الإبراهيميّ من خلال النّصّ: مصلحة – إنسانيّة – محبّة للخير (قد يضيف التّلميذ عبارات أخرى صحيحة؛ يُكتفى بثلاث). أمّا الأنانيّة والتّعصّب واللّامبالاة فتناقض دعوته إلى رحمة الإنسانيّة ونصرة الفقير.", 1.5, "ar.comprehension.opinion")
PAT_EXPL = ("النّمط سرديّ يتقاطع معه النّمطان الإخباريّ والوصفيّ: النّمط السّرديّ: «واستغاثت من طواغيت الاستبداد»؛ النّمط الوصفيّ: «تلك الأمّ الرّؤوم الّتي لا تحابي "
            "أحدًا من أبنائها…»؛ النّمط الإخباريّ: «وهي الآن تستغيث من داهيتين». يكتفي المترشّح بنمطين فقط.")
st("s12", "q7", "q7-e1", "multi", "أيّ الأنماط التّعبيريّة تضافرت في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["السّرديّ", "الوصفيّ", "الإخباريّ", "الحواريّ"]},
   {"correct": [0, 1, 2]}, PAT_EXPL + " ولا حوار في النّصّ.", 1, "ar.text.type")
st("s13", "q7", "q7-e1", "matching", "طابق كلّ نمط بمثاله من النّصّ.",
   {"lefts": ["النّمط السّرديّ", "النّمط الوصفيّ", "النّمط الإخباريّ"],
    "rights": ["«واستغاثت من طواغيت الاستبداد»", "«تلك الأمّ الرّؤوم الّتي لا تحابي أحدًا من أبنائها…»", "«وهي الآن تستغيث من داهيتين»", "«فلو كان رمحًا واحدًا لاتّقيته»"]},
   {"pairs": [0, 1, 2]}, PAT_EXPL, 1, "ar.text.type", "b")
# ── ثانيًا: البناء اللّغويّ ──
INSHA_EXPL = "(فهل من منجد؟): نوعه طلبيّ، صيغته استفهام، غرضه الاستغاثة والاستعطاف (طلب العون)."
st("s14", "q8", "q8-e1", "mcq", "مثّل للأسلوب الإنشائيّ بمثال من النّصّ.",
   {"options": ["«فهل من منجد؟»", "«وهي الآن تستغيث من داهيتين»", "«الإنسانيّة تلك الأمّ الرّؤوم»", "«فأغاثها دعاة الدّيمقراطيّة»"]},
   {"correct": 0}, INSHA_EXPL + " أمّا الأمثلة الأخرى فجمل خبريّة.", 0.25, "ar.rhetoric.insha")
st("s15", "q8", "q8-e2", "mcq", "ما نوع الأسلوب في «فهل من منجد؟»؟",
   {"options": ["إنشائيّ طلبيّ", "إنشائيّ غير طلبيّ", "خبريّ"]}, {"correct": 0}, INSHA_EXPL, 0.25, "ar.rhetoric.insha")
st("s16", "q8", "q8-e3", "mcq", "ما صيغة الأسلوب في «فهل من منجد؟»؟",
   {"options": ["الاستفهام", "النّداء", "الأمر", "التّمنّي"]}, {"correct": 0}, INSHA_EXPL, 0.25, "ar.rhetoric.insha")
st("s17", "q8", "q8-e4", "mcq", "ما غرض (أثر) الاستفهام في «فهل من منجد؟»؟",
   {"options": ["الاستغاثة والاستعطاف (طلب العون)", "التّحقير", "التّسوية", "التّهديد"]}, {"correct": 0}, INSHA_EXPL, 0.25, "ar.rhetoric.insha")
st("s18", "q9", "q9-e1", "fill_blank", "أكمل إعراب «تحابي» في قوله: «تلك الأمّ الرّؤوم الّتي لا تحابي واحدًا من أبنائها» (ممّا تحته خطّ):",
   {"text": "تحابي: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها ____، والفاعل ضمير مستتر جوازًا تقديره «____».",
    "bank": ["الثّقل", "هي", "التّعذّر", "هو"]},
   {"blanks": [["الثّقل"], ["هي"]]}, "تحابي: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل، والفاعل ضمير مستتر جوازًا تقديره «هي».", 0.5, "ar.grammar.irab")
st("s19", "q9", "q9-e2", "mcq", "ما إعراب «متعاضدين» في قوله: «ومدّوا أيديهم متعاضدين» (ممّا تحته خطّ)؟",
   {"options": ["حال منصوبة وعلامة نصبها الياء لأنّها جمع مذكّر سالم", "نعت منصوب وعلامة نصبه الياء لأنّه جمع مذكّر سالم",
                "مفعول به منصوب وعلامة نصبه الياء لأنّه جمع مذكّر سالم", "خبر منصوب وعلامة نصبه الياء لأنّه جمع مذكّر سالم"]},
   {"correct": 0}, "متعاضدين: حال منصوبة وعلامة نصبها الياء (جمع مذكّر سالم).", 0.5, "ar.grammar.irab")
st("s20", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (تستغيث) في قوله: «ألا وإنّ الإنسانيّة (تستغيث)»؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر «إنّ»", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع نعت", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "تستغيث: جملة فعليّة في محلّ رفع خبر «إنّ».", 0.25, "ar.grammar.sentence_case")
st("s21", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يجرّها) في قوله: «وجيوشه الّتي (يجرّها) من خراب العالم»؟",
   {"options": ["جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "يجرّها: جملة فعليّة صلة موصول (الّتي) لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
IMG_EXPL = ("الصّورة البيانيّة في العبارة (وهي تستغيث من داهيتين): شبّه الدّاهيتين (المصيبتين) وهو أمر معنويّ بشيء ماديّ يُستغاث منه، فذكر المشبّه وحذف المشبّه "
            "به وترك ما يدلّ عليه الفعل (تستغيث) على سبيل الاستعارة المكنيّة. أثرها في المعنى: جسّدت المعنويّ في صورة محسوسة.")
st("s22", "q10", "q10-e1", "fill_blank", "اشرح الصّورة البيانيّة في (وهي تستغيث من داهيتين):",
   {"text": "شبّه ____ (المصيبتين) وهو أمر معنويّ بشيء ماديّ يُستغاث منه، فذكر المشبّه وحذف المشبّه به وترك ما يدلّ عليه الفعل (____).",
    "bank": ["الدّاهيتين", "تستغيث", "الحرب", "تستجير"]},
   {"blanks": [["الدّاهيتين"], ["تستغيث"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s23", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في (وهي تستغيث من داهيتين)؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s24", "q10", "q10-e3", "mcq", "ما أثر الاستعارة في (وهي تستغيث من داهيتين) في المعنى؟",
   {"options": ["جسّدت المعنويّ في صورة محسوسة", "قدّمت الحقيقة مصحوبة بدليلها", "أحدثت جرسًا موسيقيًّا", "أوهمت بالتّطابق بين طرفين مذكورين مع الأداة"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
st("s25", "q11", "q11-e1", "mcq", "أيّ المحسّنات البديعيّة كانت أكثر استعمالًا في نصّ الإبراهيميّ؟",
   {"options": ["الطّباق والجناس", "التّورية", "حسن التّعليل", "التّصريع"]},
   {"correct": 0}, "المحسّنات البديعيّة الّتي كانت أكثر استعمالًا في النّصّ هي: الطّباق والجناس.", 0.5, "ar.rhetoric.badi")
st("s26", "q11", "q11-e2", "mcq", "بمَ تعلّل كثرة الطّباق والجناس في النّصّ؟",
   {"options": ["بانتماء الكاتب إلى مدرسة الصّنعة اللّفظيّة", "بانتماء الكاتب إلى المدرسة الرّومانسيّة", "بتأثّر الكاتب بالأدب الفرنسيّ", "برغبة الكاتب في إخفاء أفكاره"]},
   {"correct": 0}, "ويرجع ذلك لانتماء الكاتب إلى مدرسة الصّنعة اللّفظيّة.", 0.5, "ar.rhetoric.badi")
st("s27", "q12", "q12-e1", "multi", "اختر ثلاثة من الألفاظ الدّينيّة الّتي تضمّنها النّصّ. (اختر كلّ ما يصحّ)",
   {"options": ["البارّ", "المؤمن", "الكافر", "الحروب", "الزّلازل", "الأغنياء"]},
   {"correct": [0, 1, 2]}, "تضمّن النّصّ مجموعة من الألفاظ الدّينيّة منها: البارّ – المؤمن – الكافر (قد يذكر التّلميذ ألفاظًا أخرى صحيحة).", 0.75, "ar.cohesion.effect")
st("s28", "q12", "q12-e2", "mcq", "ما سبب استخدام الكاتب للألفاظ الدّينيّة؟",
   {"options": ["تشبّع الكاتب بالثّقافة الإسلاميّة", "رغبة الكاتب في إظهار ثقافته الأجنبيّة", "تأثّر الكاتب بالمذهب الرّمزيّ", "حاجة الكاتب إلى الوزن والقافية"]},
   {"correct": 0}, "سبب استخدامها: تشبّع الكاتب بالثّقافة الإسلاميّة.", 0.5, "ar.literature.context")
# ── ثالثًا: التّقويم النّقديّ ──
ART_EXPL = ("من خصائص فنّ المقال من النّصّ مع التّمثيل: الوحدة الموضوعيّة (الإنسانيّة ومشاكلها)؛ العرض المنهجيّ: مقدّمة: تصوير الإنسانيّة، عرض: المشاكل الّتي "
            "تعاني منها، خاتمة: اقتراح حلّ لهذه المشاكل.")
st("s29", "q13", "q13-e1", "mcq", "من خصائص فنّ المقال في نصّ الإبراهيميّ:",
   {"options": ["الوحدة الموضوعيّة", "تعدّد الموضوعات وتشعّبها", "الحبكة والعقدة والحلّ", "الالتزام بالوزن والقافية"]},
   {"correct": 0}, ART_EXPL, 0.5, "ar.literature.prose")
st("s30", "q13", "q13-e1", "mcq", "مثّل للوحدة الموضوعيّة في النّصّ.",
   {"options": ["(الإنسانيّة ومشاكلها)", "(معركة صفّين)", "(دعاة الدّيمقراطيّة وأنصار المساواة)", "(الرّمح الواحد)"]},
   {"correct": 0}, ART_EXPL, 0.5, "ar.literature.prose", "b")
st("s31", "q13", "q13-e2", "mcq", "ومن خصائص فنّ المقال في النّصّ أيضًا:",
   {"options": ["العرض المنهجيّ (مقدّمة، عرض، خاتمة)", "الاستطراد والخروج عن الموضوع", "الاعتماد على الشّخصيّات والحوار", "الإطالة والتّفصيل غير المحدود"]},
   {"correct": 0}, ART_EXPL, 0.5, "ar.literature.prose")
st("s32", "q13", "q13-e2", "matching", "طابق كلّ مرحلة من العرض المنهجيّ بمضمونها في النّصّ.",
   {"lefts": ["المقدّمة", "العرض", "الخاتمة"], "rights": ["تصوير الإنسانيّة", "المشاكل الّتي تعاني منها", "اقتراح حلّ لهذه المشاكل", "سرد وقائع معركة صفّين"]},
   {"pairs": [0, 1, 2]}, ART_EXPL, 0.5, "ar.literature.prose", "b")
STYLE_EXPL = ("من خصائص أسلوب الكاتب من النّصّ مع التّمثيل: اللّغة الواضحة (تميّز، تفرّق، استغاثت)؛ الاقتباس من النّصوص الدّينيّة (بارّ، فاجر، مؤمن، كافر)؛ "
              "استخدام الصّور البليغة: الاستعارة (الإنسانيّة تستغيث)؛ المحسّنات البديعيّة: الطّباق (مؤمن ≠ كافر)، السّجع (المارقين، العاقّين). يكتفي المترشّح "
              "بخاصّيّتين فقط.")
st("s33", "q13", "q13-e3", "multi", "أيّ ممّا يلي من خصائص أسلوب الإبراهيميّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["اللّغة الواضحة", "الاقتباس من النّصوص الدّينيّة", "استخدام الصّور البليغة", "المحسّنات البديعيّة (الطّباق، السّجع)",
                "الغموض والإغراق في الرّمز", "استعمال الألفاظ العامّيّة"]},
   {"correct": [0, 1, 2, 3]}, STYLE_EXPL, 1, "ar.literature.features")
st("s34", "q13", "q13-e3", "matching", "طابق كلّ خاصّيّة من خصائص أسلوب الإبراهيميّ بمثالها من النّصّ.",
   {"lefts": ["اللّغة الواضحة", "الاقتباس من النّصوص الدّينيّة", "الصّور البليغة: الاستعارة", "المحسّنات البديعيّة: السّجع"],
    "rights": ["(تميّز، تفرّق، استغاثت)", "(بارّ، فاجر، مؤمن، كافر)", "(الإنسانيّة تستغيث)", "(المارقين، العاقّين)", "(الرّمح الواحد)"]},
   {"pairs": [0, 1, 2, 3]}, STYLE_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ: الإنسانيّة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من "
         f"ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4). أُصلح من الموضوع الرّسميّ "
         "خطآن في docx: «فهك من منجد» ← «فهل من منجد»، و«ومن الذي يتأنقون» ← «ومن الذين يتأنقون»؛ وأُبقيت «تظافرت» كما في الورقتين. أسطر الفقرة الواحدة المقسومة في "
         "docx وُصلت بمسافة. ما تحته خطّ «تحابي» و«متعاضدين»، وما بين قوسين (تستغيث) و(يجرّها). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ممسوح، "
         "ص2–4). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. س6 (شخصيّة الكاتب) وس5 لغويّ (الألفاظ الدّينيّة) يقبلان إجابات أخرى صحيحة: بقيا تفاعليّين "
         "بمشتّتات خاطئة قطعًا فقط. لا شيء مؤجَّل.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-lang-p2", 2, TITLE, NOTES, LOG_NOTE)
