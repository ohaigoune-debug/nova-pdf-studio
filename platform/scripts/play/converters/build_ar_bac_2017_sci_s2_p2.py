"""Conversion: BAC 2017 (الدّورة الثّانية = «الدّورة الاستثنائيّة» on the ONEC paper) – اللّغة العربيّة وآدابها – الشّعب العلميّة –
الموضوع الثّاني (محمّد البشير الإبراهيميّ، «فلسطين» من عيون البصائر).
2017 had two sessions; this set is the SECOND one (the ONEC header says «الدّورة الاستثنائيّة: 2017»); session 1 is ar-bac-2017-*-s1-*.
Exam (most faithful source): gdrive 1yvUlkemdMO36y9O88TROEP1rYclLljCK (يكالوريا العربية 2017 شعبة علوم الدورة الثانية.docx);
same paper as PDF (owner's copy): gdrive 1c5a5t7T4tVqEwjSxd9DPaZ6vfreq6v2e (BAC 2017 - الدورة 2 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1QfWwNhUkIBvVCfgtGwOdE1NMOFZWk7XE (01_الدورة_الاستثنائية_الموضوع.pdf, pages 3–4 — read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1bYtR3zX_sV7wU5ej3cT52OihvVblnexU (02_الدورة_الاستثنائية_التصحيح.pdf, pages 3–4).

Method (same as the BAC 2019–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed) and re-checked programmatically against it; the
docx was compared line by line with the ONEC paper. The correction PDF's text layer is reversed presentation-form Arabic,
so the mark scheme was read from the rendered pages (150 dpi, fully legible). Every mark comes from the official scheme;
correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction header «علوم تجريبيّة، رياضيات، تسيير واقتصاد، تقني رياضي» ⇒ SCI, MATH, TM, GE.
- docx: the first paragraph of the text is split in two docx paragraphs after «تاجَ مُلكهم» (one paragraph on the ONEC
  paper) ⇒ joined with one space, so the paper's «الفقرة الأولى / الثّانية / الأخيرة» match the three paragraphs.
  Headings: docx «الشرح اللغوي» vs ONEC «شرح المفردات» ⇒ docx kept (heading used as the caption); diacritics differ slightly.
- Underlines: «نعمة» (الفقرة 2) and «صيحات» (الفقرة 3) underlined in docx and ONEC; the question names both.
- Q1 three «01» lines: the two states (الماضي والحاضر) / the arguments of the past / the arguments of the present.
- Q2 three «01» lines: the explanation / two expressions of pride / two expressions of regret («يكتفي المترشّح بذكر عبارتين»).
- Q3 three «01» lines: the Arabs' stance / the writer's stance / «رأي المترشّح: يراعى فيه سلامة التّعبير، وقوّة الحجّة،
  وحسن التّعليل مع التّمثيل» ⇒ the opinion is deferred (essay_builder, rule 11).
- Q4 (تلخيص) «01/01/01» = سلامة الفهم / جودة التّعبير وجمال الأسلوب مع سلامة اللّغة / مهارة توظيف تقنية التّلخيص
  ⇒ three deferred essay_builder elements (no model summary in the scheme).
- Part 2 Q1 «01/01» = حقل الدّين (حرميهم، النّبيّين، شكر الله) / حقل السّياسة (الاستعمار، الباطل، الغازي) ⇒ two elements
  (classification + naming in each).
- Part 2 Q2 «4×0.5» with «يكتفي المترشّح بثلاثة أمثلة فقط» + «وأمّا الوظيفة فهي تحقيق الرّبط والاتّساق» ⇒ three
  pronoun/referent examples (one element of 1.5, six listed and interchangeable) + the function (0.5). This 3+1 reading of
  «4×0.5» is the converter's.
- Part 2 Q3 four 0.5 lines (نعمة، صيحات، اتّخذوك…، أين أنتم؟) ⇒ four elements. «صيحات» is «مفعول به ثانٍ» in the scheme;
  «حال» (arguable) is not used as a distractor; «استئنافيّة» is not used for (أين أنتم؟).
- Part 2 Q4: 0.5 type (تشبيه بليغ) + 01 explanation (المشبّه أنتِ/فلسطين، المشبّه به عتبتهم) + 0.5 effect ⇒ three elements.
- Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1yvUlkemdMO36y9O88TROEP1rYclLljCK"
PDF_ID = "1c5a5t7T4tVqEwjSxd9DPaZ6vfreq6v2e"
OFFICIAL_ID = "1QfWwNhUkIBvVCfgtGwOdE1NMOFZWk7XE"
CORR_ID = "1bYtR3zX_sV7wU5ej3cT52OihvVblnexU"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الثّاني (مولَّد من docx) ──
P2_PARAS = ['إيه يا فلسطينُ!! لقد كنت مباركةً على العَرب في حَاليْكِ! في مَاضِيكِ وفي حَاضِركِ! كنت في مَاضِيكِ مُباركة على العرب يوم فتحوك فكمّلوا بكِ أجزاء جزيرتهم الطبيعيّة، وجمَّلوا بكِ تاجَ مُلكهم الطَّريف، وأكملوا بحَرَمِك المقدّس حَرَمَيْهم، ويوم (اتَّخذوك ركابًا لفتوحاتهم)، وبابًا لانتشار دينهم ومكارمهم ومَرابط لحُمَاة الثّغور منهم... أنتِ عَـتَـبتُهم إلى مصر، ومَعبرهم إلى أفريقيا، ومنظرتُهم إلى بحر العرب، لم تطَأكِ بعد أقدام النّبيينَ أطهرُ من أقدامهم، ولم يَحمِك بعد موسى أشجعُ من أبطالهم... وكنت مباركة عليهم في حاضرك المشهود فما اجتمعت كلمتُهم في يومٍ مثل ما اجتمعت في يوم تقسيمك؛ ولقد فرّقهم الاستعمار الخبيثُ في عهدهم الأخير، فما تنادَوْا إلى الاتّحاد مثل ما تنادوا إلى الاتحاد في سبيلك، ولقد تخوّف أوطانهم من أطرافها، فما تداعوا إلى الذّودِ عن قطعة من أرضهم مثل ما تداعوا إلى الذّود عنك.', 'أَمَا والله يا فلسطينُ، لكأنَّ أعداءَ العرب أَحْسَنوا إليهم بتقسيمك من حيث أرادوا الإساءة، ولكأنَّ المصيبة فيكِ نعمة، ولكأنَّهم امتحنوا بتقسيمك رجولتنا وإباءَنا ومبلغ التّضحية بالعزيز الغالي فينا، ولكأنَّهم جسُّوا بتقسيمك مواقعَ الكرامة والشرف منَّا، وكأنّ كلّ صوتٍ من أصواتهم على التَّقسيم صوتٌ جَهِيرٌ ينادي العربَ: (أين أنتم؟) فلا زلت مُباركةً على العرب يا فلسطين!', 'أيُّها العربُ! قُسّمتْ فلسطينُ فقامتْ قيامتكم... هَدَرتْ شقائقُ الخطباء، وسالت أقلامُ الكُتّاب، وأرسلها الشعراء صيحاتٍ مثيرة تُحرّك رواكد النُّفوس، وانعقدت المؤتمرات، وأقيمت المظاهرات، فهل كنتم ترجُون من الدول المُتّحدة على الباطل غير ذلك؟ وهل كنتم تعتقدون أنه مجلس أمم كما يزعم؟ كأنَّ تلك الأمم وحَّدَ بينها الانتصار على الألمان النَّازيّ، واليابان الغازي. فجعلت من شُكر الله على تلك النّعمة أن تنظم أمم العالم في عِقدٍ من السلام والحرّية تستوي فيه الكبيرةُ والصغيرةُ، ودوله في مجلس تستوي فيه القويَّةُ والضّعيفة، ليُقيمَ العدل، ويُنصفَ المظلوم، وكأنَّكم ما علمتم أنَّ ذلك المجتمع يمشي على أربع، ثلاث موبوءة، والرابعة موثوءة.']
P2_REF = 'آثار الإمام محمد البشير الإبراهيميّ الجزء الثالث عيون البصائر\nص: 440 و441. دار الغرب الإسلاميّ.'
P2_GLOSS = 'منظرتهم: المنظرة: المكان المرتفع الذي ينظر منه.   تخوّف: أخاف؛ أفزع.     هدرت: تكلّمت وخطبت.\nموبوءة: مريضة. معلولة. موثوءة: موهونة. ضعيفة.'
P2_QP = ['أوّلا- البناء الفكري: (12 نقاط)', 'فلسطينُ - في نظر الكاتب - مباركةٌ في حالتين. ما هما؟ وما الحجج التي ساقها لكل حالة\nمنهما؟', 'جمع الكاتب في النّص بين الاعتزاز والحسرة. وضّح ذلك، ثم دعّم إجابتك بعبارتين لكل منهما.', 'بَيّن موقف العرب ممّا آلت إليه فلسطين، وموقف الكاتب منهم، مبديا رأيك في الموقفين مع التعليل.', 'لخص مضمون النّص معتمداً تقنيّة التلخيص.', 'ثانيا- البناء اللّغوي: (08 نقاط)', 'صنف الكلمات الآتية ضمن حقلين دلاليّين مختلفين ثم سمّهما: «حرميهم، النّبيّين، الاستعمار، الباطل، الغازي، شُكر الله».', 'تنوعت الضّمائر في الفقرة الثانيّة. مثّل بثلاثة منها مختلفة، ثمَّ بين عائدها ووظيفتها في بناء تركيب تلك الفقرة.', '- أعرب لفظة «نعمة» الواردة في الفقرة الثانيّة. ولفظة «صيحات» الواردة في الفقرة الأخيرة.\nثم بيّن المحلّ الإعرابيّ لجملة «اتّخذوك ركابا لفتوحاتهم» الواردة في الفقرة الأولى، وجملة\n«أين أنتم؟» الواردة في الفقرة الثانيّة.', 'في عبارة «أنتِ عتبتُهم إلى مصر» الواردة في الفقرة الأولى صورة بيانيّة. اذكُر نوعها، ثم اشرحها\nمبيّنا سر بلاغتها.']


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
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P2_GLOSS},
]
QP = P2_QP
P1, P2 = QP[0], QP[5]

q("q1", "1", P1, QP[1], 3, [el("q1-e1", "الحالتان اللّتان كانت فيهما فلسطين مباركة", 1), el("q1-e2", "حجج الماضي", 1), el("q1-e3", "حجج الحاضر", 1)], TEXT_DOCS)
q("q2", "2", P1, QP[2], 3, [el("q2-e1", "توضيح الجمع بين الاعتزاز والحسرة", 1), el("q2-e2", "عبارتان دالّتان على الاعتزاز", 1),
                             el("q2-e3", "عبارتان دالّتان على الحسرة", 1)], TEXT_DOCS)
q("q3", "3", P1, QP[3], 3, [el("q3-e1", "موقف العرب ممّا آلت إليه فلسطين", 1), el("q3-e2", "موقف الكاتب منهم", 1), el("q3-e3", "رأي المترشّح مع التّعليل", 1)], TEXT_DOCS)
q("q4", "4", P1, QP[4], 3, [el("q4-e1", "التّلخيص: سلامة الفهم", 1), el("q4-e2", "التّلخيص: جودة التّعبير وجمال الأسلوب مع سلامة اللّغة", 1),
                             el("q4-e3", "التّلخيص: مهارة توظيف تقنية التّلخيص", 1)], TEXT_DOCS)
q("q5", "1", P2, QP[6], 2, [el("q5-e1", "حقل الدّين: التّصنيف والتّسمية", 1), el("q5-e2", "حقل السّياسة: التّصنيف والتّسمية", 1)], TEXT_DOCS)
q("q6", "2", P2, QP[7], 2, [el("q6-e1", "ثلاثة ضمائر مختلفة مع عائدها (3×0.5)", 1.5), el("q6-e2", "وظيفتها في بناء الفقرة", 0.5)], TEXT_DOCS)
q("q7", "3", P2, QP[8], 2, [el("q7-e1", "إعراب «نعمة»", 0.5), el("q7-e2", "إعراب «صيحات»", 0.5),
                             el("q7-e3", "محلّ جملة «اتّخذوك ركابا لفتوحاتهم»", 0.5), el("q7-e4", "محلّ جملة «أين أنتم؟»", 0.5)], TEXT_DOCS)
q("q8", "4", P2, QP[9], 2, [el("q8-e1", "«أنتِ عتبتهم إلى مصر»: النّوع", 0.5), el("q8-e2", "«أنتِ عتبتهم إلى مصر»: الشّرح", 1),
                             el("q8-e3", "«أنتِ عتبتهم إلى مصر»: سرّ البلاغة", 0.5)], TEXT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "في أيّ حالتين كانت فلسطين مباركة على العرب في نظر الكاتب؟",
   {"options": ["في ماضيها وحاضرها", "في حربها وسلمها", "في فقرها وغناها", "في ضعفها وقوّتها"]},
   {"correct": 0}, "فلسطين مباركة في حالتين هما: الماضي والحاضر («في حاليكِ! في ماضيكِ وفي حاضركِ!»).", 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "multi", "ما الحجج الّتي ساقها الكاتب على أنّ فلسطين كانت مباركة على العرب في ماضيها؟ (اختر كلّ ما يصحّ)",
   {"options": ["يوم الفتح كمّلت أجزاء جزيرتهم", "أكملت الحرمين بحرمها المقدّس", "اتُّخذت ركابًا لنشر الدّين والفتوحات", "جمّلت تاج الملك",
                "اجتمعت كلمتهم يوم تقسيمها", "تنادوا إلى الاتّحاد في سبيلها"]},
   {"correct": [0, 1, 2, 3]}, "حجج الماضي: يوم الفتح – كمّلت أجزاء الجزيرة – أكملت الحرمين – اتّخذت ركابًا لنشر الدّين والفتوحات – جمّلت تاج الملك. أمّا اجتماع الكلمة والتّنادي إلى الاتّحاد فمن حجج الحاضر.", 1, "ar.comprehension.evidence")
st("s03", "q1", "q1-e3", "fill_blank", "أكمل حجج الكاتب على أنّ فلسطين مباركة على العرب في حاضرهم:",
   {"text": "في الحاضر: ____ الأمّة، و____ كلمتها يوم التّقسيم.", "bank": ["تجميع", "توحيد", "تفريق", "تشتيت"]},
   {"blanks": [["تجميع"], ["توحيد"]]}, "حجج الحاضر: تجميع الأمّة – توحيد كلمتها يوم التّقسيم («فما اجتمعت كلمتهم في يوم مثل ما اجتمعت في يوم تقسيمك»).", 1, "ar.comprehension.evidence")
st("s04", "q2", "q2-e1", "mcq", "كيف جمع الكاتب في النّصّ بين الاعتزاز والحسرة؟",
   {"options": ["اعتزّ بفلسطين ماضيًا وحاضرًا، وأظهر الحسرة على ما آلت إليه من ظلم واعتداء", "اعتزّ بمواقف الدّول المتّحدة، وتحسّر على تقصير العرب",
                "اعتزّ بخطب العرب ومؤتمراتهم، وتحسّر على ماضي فلسطين", "اعتزّ بانتصار الأمم على الألمان، وتحسّر على حاضر العرب"]},
   {"correct": 0}, "جمع الكاتب بين الاعتزاز بفلسطين ماضيًا وحاضرًا، والشّعور بالحسرة على ما آلت إليه من ظلم واعتداء.", 1, "ar.comprehension.emotion")
st("s05", "q2", "q2-e2", "multi", "أيّ العبارات الآتية تدلّ على الاعتزاز؟ (اختر كلّ ما يصحّ)",
   {"options": ["«جمّلوا بكِ تاجَ مُلكهم»", "«اتّخذوك ركابًا لفتوحاتهم»", "«ومَرابط لحُماة الثّغور منهم»", "«إيه يا فلسطين»",
                "«فرّقهم الاستعمار الخبيث»", "«امتحنوا بتقسيمك رجولتنا»"]},
   {"correct": [0, 1, 2]}, "العبارات الدّالّة على الاعتزاز: جمّلوا بكِ تاج مُلكهم – اتّخذوك ركابًا لفتوحاتهم – ومَرابط لحُماة الثّغور منهم؛ والعبارات الأخرى دالّة على الحسرة. يكتفي المترشّح بذكر عبارتين.", 1, "ar.comprehension.evidence")
st("s06", "q2", "q2-e3", "fill_blank", "أكمل العبارات الدّالّة على الحسرة:",
   {"text": "«____ يا فلسطين» – «فرّقهم ____ الخبيث» – «امتحنوا بتقسيمك ____»", "bank": ["إيه", "الاستعمار", "رجولتنا", "أهلًا", "الإسلام", "ثرواتنا"]},
   {"blanks": [["إيه"], ["الاستعمار"], ["رجولتنا"]]}, "العبارات الدّالّة على الحسرة: إيه يا فلسطين – فرّقهم الاستعمار الخبيث – امتحنوا بتقسيمك رجولتنا. يكتفي المترشّح بذكر عبارتين.", 1, "ar.comprehension.evidence")
st("s07", "q3", "q3-e1", "multi", "ما موقف العرب ممّا آلت إليه فلسطين كما يصوّره الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["كثرة الكلام", "إلقاء الخطب والشّعر", "عقد المؤتمرات", "تنظيم المظاهرات", "حمل السّلاح وتحرير الأرض", "قطع العلاقات مع الدّول المتّحدة"]},
   {"correct": [0, 1, 2, 3]}, "موقف العرب ممّا آلت إليه فلسطين هو كثرة الكلام، وإلقاء الخطب والشّعر، وعقد المؤتمرات، وتنظيم المظاهرات.", 1, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "mcq", "ما موقف الكاتب من موقف العرب؟",
   {"options": ["الرّفض والإنكار، لأنّها مواقف غير مجدية ما دامت قد عُرضت على الدّول المتّحدة على الباطل",
                "التّأييد والإعجاب، لأنّها أوصلت صوت فلسطين إلى العالم", "الحياد، لأنّ أمر فلسطين لا يعنيه",
                "الرّضا، لأنّ مجلس الأمم سيقيم العدل وينصف المظلوم"]},
   {"correct": 0}, "موقف الكاتب منهم هو الرّفض والإنكار لأنّها غير مجدية ما دامت قد عُرضت على الدّول المتّحدة على الباطل.", 1, "ar.comprehension.opinion")
OP_SPEC = {"task": "إبداء الرّأي في موقف العرب وموقف الكاتب منهم مع التّعليل", "question": QP[3],
           "model": "رأي المترشّح: يُراعى فيه سلامة التّعبير، وقوّة الحجّة، وحسن التّعليل مع التّمثيل (لا يقدّم التّصحيح رأيًا نموذجيًّا)."}
essay("s09", "q3", "q3-e3", "رأيك في موقف العرب وموقف الكاتب منهم", "الرّأي والتّعليل", "سلامة التّعبير، وقوّة الحجّة، وحسن التّعليل مع التّمثيل", 1, OP_SPEC,
      "رأي المترشّح: يُراعى فيه سلامة التّعبير، وقوّة الحجّة، وحسن التّعليل مع التّمثيل.", "ar.comprehension.opinion")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ معتمدًا تقنية التّلخيص",
            "text": "نصّ محمّد البشير الإبراهيميّ عن فلسطين (بكالوريا 2017، الدّورة الثّانية، الشّعب العلميّة، الموضوع الثّاني)", "model_example": None}
SUM_EXPL = "تلخيص النّصّ يراعى فيه: سلامة الفهم، جودة التّعبير وجمال الأسلوب مع سلامة اللّغة، مهارة توظيف تقنية التّلخيص (01 لكلّ معيار). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for i, (crit, ind) in enumerate([("سلامة الفهم", "سلامة فهم مضمون النّصّ"), ("جودة التّعبير", "جودة التّعبير وجمال الأسلوب مع سلامة اللّغة"),
                                 ("تقنية التّلخيص", "مهارة توظيف تقنية التّلخيص")]):
    essay(f"s{10 + i}", "q4", f"q4-e{i + 1}", "تلخيص نصّ الإبراهيميّ عن فلسطين", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s13", "q5", "q5-e1", "multi", "أيّ الكلمات الآتية تنتمي إلى حقل الدّين؟ (اختر كلّ ما يصحّ)",
   {"options": ["حرميهم", "النّبيّين", "شكر الله", "الاستعمار", "الباطل", "الغازي"]},
   {"correct": [0, 1, 2]}, "حقل الدّين: حرميهم، النّبيّين، شكر الله؛ وحقل السّياسة: الاستعمار، الباطل، الغازي.", 0.5, "ar.cohesion.effect")
st("s14", "q5", "q5-e1", "mcq", "ما اسم الحقل الدّلاليّ الّذي تنتمي إليه «حرميهم، النّبيّين، شكر الله»؟",
   {"options": ["حقل الدّين", "حقل السّياسة", "حقل الطّبيعة", "حقل العلم"]},
   {"correct": 0}, "حقل الدّين: حرميهم، النّبيّين، شكر الله.", 0.5, "ar.cohesion.effect", "b")
st("s15", "q5", "q5-e2", "multi", "أيّ الكلمات الآتية تنتمي إلى حقل السّياسة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الاستعمار", "الباطل", "الغازي", "حرميهم", "النّبيّين", "شكر الله"]},
   {"correct": [0, 1, 2]}, "حقل السّياسة: الاستعمار، الباطل، الغازي؛ وحقل الدّين: حرميهم، النّبيّين، شكر الله.", 0.5, "ar.cohesion.effect")
st("s16", "q5", "q5-e2", "mcq", "ما اسم الحقل الدّلاليّ الّذي تنتمي إليه «الاستعمار، الباطل، الغازي»؟",
   {"options": ["حقل السّياسة", "حقل الدّين", "حقل الطّبيعة", "حقل العلم"]},
   {"correct": 0}, "حقل السّياسة: الاستعمار، الباطل، الغازي.", 0.5, "ar.cohesion.effect", "b")
st("s17", "q6", "q6-e1", "matching", "طابق كلّ ضمير من ضمائر الفقرة الثّانية بعائده.",
   {"lefts": ["واو الجماعة (أحسنوا، أرادوا، امتحنوا)", "الكاف (فيكِ، بتقسيمكِ)", "ضمير المتكلّمين «نا» (رجولتنا، فينا)"],
    "rights": ["أعداء العرب", "فلسطين", "العرب", "الدّول المتّحدة"]},
   {"pairs": [0, 1, 2]}, "الضّمائر وعائدها: واو الجماعة يعود على أعداء العرب؛ هم يعود على العرب وأعدائهم؛ الكاف يعود على فلسطين؛ ضمير المتكلّمين (نا) يعود على العرب؛ أنتم يعود على العرب؛ التّاء تعود على فلسطين. يكتفي المترشّح بثلاثة أمثلة.", 0.75, "ar.cohesion.reference")
st("s18", "q6", "q6-e1", "multi", "أيّ الضّمائر الآتية يعود على فلسطين في الفقرة الثّانية؟ (اختر كلّ ما يصحّ)",
   {"options": ["الكاف (فيكِ، بتقسيمكِ)", "التّاء (فلا زلتِ مباركةً)", "واو الجماعة (أحسنوا)", "ضمير المتكلّمين «نا» (رجولتنا)", "أنتم (أين أنتم؟)"]},
   {"correct": [0, 1]}, "الكاف يعود على فلسطين، والتّاء تعود على فلسطين؛ أمّا واو الجماعة فيعود على أعداء العرب، و«نا» و«أنتم» يعودان على العرب.", 0.75, "ar.cohesion.reference", "b")
st("s19", "q6", "q6-e2", "mcq", "ما وظيفة هذه الضّمائر في بناء تركيب الفقرة الثّانية؟",
   {"options": ["تحقيق الرّبط والاتّساق", "التّوكيد والتّقرير", "الوصف والتّصوير", "التّعليل والاستنتاج"]},
   {"correct": 0}, "وأمّا الوظيفة فهي تحقيق الرّبط والاتّساق.", 0.5, "ar.cohesion.effect")
st("s20", "q7", "q7-e1", "mcq", "ما إعراب «نعمة» في قوله: «ولكأنّ المصيبة فيكِ نعمةٌ» (الفقرة الثّانية)؟",
   {"options": ["خبر «كأنّ» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "اسم «كأنّ» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "خبر «كأنّ» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "نعمة: خبر «كأنّ» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s21", "q7", "q7-e2", "fill_blank", "أكمل إعراب «صيحات» في قوله: «وأرسلها الشّعراء صيحاتٍ مثيرة» (الفقرة الأخيرة):",
   {"text": "صيحات: مفعول به ____ لفعل «أرسل» منصوب وعلامة نصبه ____ نيابة عن الفتحة.", "bank": ["ثانٍ", "الكسرة", "أوّل", "الفتحة", "الياء"]},
   {"blanks": [["ثانٍ"], ["الكسرة"]]}, "صيحات: مفعول به ثانٍ لفعل «أرسل» منصوب وعلامة نصبه الكسرة نيابة عن الفتحة.", 0.5, "ar.grammar.irab")
st("s22", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «اتّخذوك ركابا لفتوحاتهم» في قوله: «ويوم (اتّخذوك ركابًا لفتوحاتهم)»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(اتّخذوك ركابا لفتوحاتهم): جملة فعليّة في محلّ جرّ مضاف إليه (بعد الظّرف «يوم»).", 0.5, "ar.grammar.sentence_case")
st("s23", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «أين أنتم؟» في قوله: «ينادي العربَ: (أين أنتم؟)»؟",
   {"options": ["جملة اسميّة مقول القول في محلّ نصب مفعول به", "جملة اسميّة في محلّ رفع نعت", "جملة اسميّة في محلّ جرّ مضاف إليه", "جملة اسميّة في محلّ نصب حال"]},
   {"correct": 0}, "(أين أنتم؟): جملة اسميّة مقول القول في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s24", "q8", "q8-e1", "mcq", "ما نوع الصّورة البيانيّة في «أنتِ عتبتُهم إلى مصر»؟",
   {"options": ["تشبيه بليغ", "استعارة تصريحيّة", "كناية عن موصوف", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, "الصّورة البيانيّة هي تشبيه بليغ.", 0.5, "ar.rhetoric.simile")
st("s25", "q8", "q8-e2", "matching", "اشرح الصّورة في «أنتِ عتبتُهم إلى مصر»: حدّد طرفي التّشبيه.",
   {"lefts": ["المشبّه", "المشبّه به"], "rights": ["أنتِ (فلسطين)", "عتبتُهم", "مصر", "العرب"]},
   {"pairs": [0, 1]}, "الشّرح: المشبّه: أنتِ (فلسطين). المشبّه به: عتبتهم.", 0.5, "ar.rhetoric.simile")
st("s26", "q8", "q8-e2", "mcq", "ما الّذي ذُكر من أركان التّشبيه في «أنتِ عتبتُهم إلى مصر»؟",
   {"options": ["المشبّه والمشبّه به فقط", "المشبّه والمشبّه به والأداة", "المشبّه به ووجه الشّبه فقط", "الأركان الأربعة"]},
   {"correct": 0}, "تشبيه بليغ: ذُكر فيه المشبّه (أنتِ: فلسطين) والمشبّه به (عتبتهم) فقط.", 0.5, "ar.rhetoric.simile", "b")
st("s27", "q8", "q8-e3", "mcq", "ما سرّ بلاغة الصّورة في «أنتِ عتبتُهم إلى مصر»؟",
   {"options": ["تقوية المعنى وتوضيحه وتقريبه إلى الذّهن", "التّشخيص وبثّ الحياة في الجماد", "إثبات الصّفة مصحوبة بالدّليل", "الإيجاز بذكر المحلّ وإرادة الحالّ"]},
   {"correct": 0}, "سرّ بلاغتها: تقوية المعنى وتوضيحه، وتقريبه إلى الذّهن.", 0.5, "ar.rhetoric.effect")

_check()
assert len(P2_PARAS) == 3 and QP[0].startswith("أوّلا") and QP[5].startswith("ثانيا") and len(QP) == 10

doc = {
    "schema_version": 1,
    "set_id": "ar-bac-2017-sci-s2-p2",
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p2",
        "kind": "BAC", "year": 2017, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 2,
        "title": "بكالوريا 2017 (الدّورة الثّانية) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ: فلسطين)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} (يكالوريا العربية 2017 شعبة علوم الدورة الثانية.docx)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_الدورة_الاستثنائية_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("session: الدورة الثانية. نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2017، الدّورة الثّانية، "
                  "وفي رأس الموضوع الرّسميّ: «الدّورة الاستثنائيّة») في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
                  f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}؛ قوبل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الدورة_الاستثنائية_الموضوع.pdf، ص3–4). "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 3–4، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة). "
                  "الشّعب: علوم تجريبيّة، رياضيات، تسيير واقتصاد، تقني رياضي. الفقرة الأولى مقسومة في docx على فقرتين بعد «تاجَ مُلكهم» فوُصلتا بمسافة كما في الموضوع الرّسميّ. "
                  "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): رأي المترشّح في س3 (01) والتّلخيص س4 (3×01). "
                  "الضّمائر «4×0.5» قُرئت ثلاثة أمثلة مع عائدها (عنصر واحد 1.5) + الوظيفة (0.5) لأنّ التّصحيح يكتفي بثلاثة أمثلة."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
