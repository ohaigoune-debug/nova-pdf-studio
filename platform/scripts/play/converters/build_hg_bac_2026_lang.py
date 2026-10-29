"""Conversion: BAC 2026 (الدورة: 2026، العاديّة) – التاريخ والجغرافيا – شعبة لغات أجنبية.
One builder for both topics; the topic is taken from the output file name:
    python3 scripts/play/converters/build_hg_bac_2026_lang.py content/play-exams/sets/3AS/HIST/hg-bac-2026-lang-p1.json
    python3 scripts/play/converters/build_hg_bac_2026_lang.py content/play-exams/sets/3AS/HIST/hg-bac-2026-lang-p2.json
then run ONCE per file: python3 scripts/play/shuffle_exam_set.py <OUT>.
Pattern: the pilot build_hg_bac_2008_lit.py (same helpers, same decisions) + Appendix A of docs/play-exams/CONVERSION_GUIDE.md.

Sources (owner's Drive):
- Paper: gdrive 1efpwYQ6g6TIpMjRIpLIoN9pNtuyerYO0 («2026 - التاريخ والجغرافيا - لغات أجنبية - الدورة العادية - الموضوع.pdf», 5 pages,
  Word-made PDF WITH a text layer): p1 = topic 1 history, p2 = topic 1 geography, p3 = topic 2 history, p4 = topic 2 geography,
  p5 = world map annex. Header: «الشعبة: لغات أجنبية»، «الدورة: 2026»، «المدة: 03 سا و30 د».
- Official model answer + rubric («الإجابة النموذجية»): gdrive 1M-DxIQGWW9VHuKUmzVb5ZSzD67mLc2g8 («… - الحل.pdf», 6 pages):
  p1 = topic 1 history, p2 top = topic 1 geography, p2 bottom–p3 = topic 2 history, p4 = topic 2 geography, p5 = model BRICS map,
  p6 = model curve (internet users).
- Reading: the paper's text layer (pdfplumber, glyphs ordered right-to-left, floating harakat re-attached) was used as a helper and
  EVERY line was checked against the page images (150 dpi pages, 300-dpi crops). The text layer is wrong in three systematic ways,
  always corrected from the image: (1) all digits are mis-mapped by the font (e.g. «2026» → «2030», «1956/10/22» → «00/61/0951»),
  so every number was read from the image; (2) some harakat glyphs are mapped to spaces («ال لا عنف», «انطلا ق ا», «ت بيّن») and
  some hamzas are lost («وا ذا» = «وإذا»); (3) floating shaddas are re-attached by position (e.g. «التّسّلح» = «التّسلّح»,
  «توّلد» = «تولّد»). The correction's body font has a garbled text layer (unusable): every model-answer line and every mark was read
  from the correction images (150 dpi + 250-dpi crops).

Transcription rules (pilot rules + decisions for text-layer PDFs; owner to confirm):
- A visible kashida stretch is written «ـــ» (three tatweels, the pilot's fixed rule), whatever the tatweel count of the text layer
  («سياســـات»، «الاقتصـــاديّ»، «البرازيـــل»، «المتّـــحدة»، «لسياســـة»، «بأنّـــه»، «أصبـــح»); a shadda stays on its consonant.
- Tanween al-fath is written where the image puts it: over the preceding letter → before the alif («انطلاقًا»، «طبيعيًّا»); on a
  lam-alif ligature its position is not decidable from the image (the text layer drops it here) → before the alif («مقالًا»);
  shadda+tanween = U+064B U+0651 (canonical order).
- Number ranges printed with a hyphen are written in reading order («ص 04-05»); dates with slashes as they appear («1956/10/22»);
  percentages keep the paper's spacing («0.5 %»، «38.2%»). Whitespace collapsed; the task number goes in `number`.
- Underlining (the items to explain) cannot be represented in a text document: the underlined items are named in the element labels
  and in source.notes (read from the image).

Marks (official scheme read from the correction images; every question/topic sum checked by _check()):
Topic 1 — history part 1 (6): terms 3×01 (اللاّعنف، التّضامن الآفرو آسيوي، الاستقلال); table 3×01 (one per row).
  Part 2 (4): مقدمة 0.50 + 0.25×6 (6 listed lines) + 0.25×6 (6 listed lines) + خاتمة 0.50.
  Geography part 1 (6): terms 3×01 (الخصخصة، البنك العالمي، مؤشّرات); curve 03 = الإنجاز 02.00 + العنوان 0.50 + المقياس 0.50.
  Part 2 (4): 0.5 + 0.25×6 + 0.25×6 + 0.50.
Topic 2 — history part 1 (6): terms 3×01 (سياسة الاحتواء، الاستقطاب، الفيتو); persons 3×01. Part 2 (4): 0.50 + 0.25×6 + 0.25×6 + 0.5.
  Geography part 1 (6): terms 3×01 (القيود الجمركية، التّجارة البينية، التّكامل الاقتصادي); BRICS map 03 = الإنجاز 0.50 لكلّ دولة (5 دول
  in the model map) + العنوان 0.25 + المفتاح 0.25. Part 2 (4): 0.5 + 0.25×6 + 0.25×6 + 0.5.

Decisions beyond the pilot (to confirm):
- «اشرح ما تحته خطّ في النّصّ» = the 2026 form of the terms question: one element per underlined item (its mark), mcq «ما المقصود
  بـ«…»؟», right option = the correction's explanation without the item, distractors = explanations of other items of the same
  correction (both topics), chosen so that no distractor is also true of the item («سياسة الاحتواء» and «الاستقطاب» never offered for
  each other; «التّجارة البينية» and «التّكامل الاقتصادي» never offered for each other).
- «القيود الجمركية»: the correction's example «مثل: الرّسوم الجمركية» repeats the item's own word; it is left out of the option.
- Persons: the correction has only 3 persons, so the third distractor is the identification of a person from another official
  2026 HG correction (same session): ريغان (علوم تجريبية…)، نهرو (علوم تجريبية…)، نيكسون (تسيير واقتصاد), transcribed from those images.
- Table rows (01 each): mcq per row, options in the format of the correction's own cell for that row; distractors = the other missing
  date + dates/events printed in the correction (topic 2 model answer), never a cell already printed in the paper's table.
- «0.25×6» lines whose six indicators are listed = six elements, one per listed indicator (deferred essay_builder).
- Map «الإنجاز (0.50 ن لكل دولة)» = one element per country of the model map (5 × 0.50) + العنوان + المفتاح; prompts and labels do
  not name the countries (that is the answer); answer specs hold only text printed in the correction (labels, title); the model map
  has no separate key box (model_key = null).
- The curve to draw is deferred `function_plot` (3 rubric lines); the printed table is reproduced verbatim as a `table` document with
  its printed source line as a separate `text` document.
- «(تقبل كلّ الإجابات الصحيحة الأخرى)» printed at the foot of every correction page is read as accepting other formulations; the
  interactive mcqs never mark a correct alternative wrong (distractors are explanations of other items / other events).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>
_m = re.search(r"hg-bac-2026-lang-p([12])\.json$", OUT)
assert _m, "output must be …/hg-bac-2026-lang-p1.json or …-p2.json (the topic is read from the file name)"
PAPER = int(_m.group(1))
SET_ID = f"hg-bac-2026-lang-p{PAPER}"
STREAMS = ["LANG"]
PAPER_ID = "1efpwYQ6g6TIpMjRIpLIoN9pNtuyerYO0"
PAPER_TITLE = "2026 - التاريخ والجغرافيا - لغات أجنبية - الدورة العادية - الموضوع.pdf"
CORR_ID = "1M-DxIQGWW9VHuKUmzVb5ZSzD67mLc2g8"
CORR_TITLE = "2026 - التاريخ والجغرافيا - لغات أجنبية - الدورة العادية - الحل.pdf"

PH1 = "التاريخ — الجزء الأول"
PH2 = "التاريخ — الجزء الثاني"
PG1 = "الجغرافيا — الجزء الأول"
PG2 = "الجغرافيا — الجزء الثاني"


def fix(s):
    """shadda+fathatan in the text layer's order, single spaces."""
    s = s.replace("ًّ", "ًّ")
    return re.sub(r"[ \t]+", " ", s).strip()


# ───────────── الإجابة النموذجيّة — نصوص الشرح بلا اسم العنصر المسطّر ─────────────
HIST_TERMS = {  # topic 1: p1 ; topic 2: p2–p3
    "اللاّعنف": "أسلوب تحرّري سلمي انتهجته حركة التّحرر في الهند التي قادها المهاتما غاندي ضدّ الاستعمار الإنجليزي، ومن أهمّ وسائله المقاطعة الاقتصادية والعصيان المدني والمظاهرات والمسيرات",
    "التّضامن الآفرو آسيوي": "يقصد به السّياسة المنتهجة من قبل الدّول الإفريقية والآسيوية في مواجهة الاستعمار وأشكال التّمييز العنصري بتوحيد الرّؤى والمواقف، والتي تجسّدت في مؤتمر باندونغ 1955 واستمرّت في إطار حركة عدم الانحياز بعد تأسيسها عام 1961",
    "الاستقلال": "تحرّر الشّعوب من الاستعمار بمختلف أشكاله واستعادة السيادة الوطنية",
    "سياسة الاحتواء": "سياسة طبّقتها الو. م. أ خلال الحرب الباردة، تقوم على محاصرة المعسكر الشّرقي بمجموعة من الأحلاف والقواعد العسكرية، بهدف عزل الاتّحاد السّوفييتي ومنع المدّ الشّيوعي",
    "الاستقطاب": "سياسة اعتمدها المعسكران، تعني سعي كل منهما إلى جذب دول من العالم إلى صفّه من خلال العضوية في الأحلاف، والمعاهدات الدّفاعية المشتركة، والمشاريع الاقتصادية",
    "الفيتو": "تعني النّقض أو الاعتراض تتمتّع به خمس دول دائمة العضوية في مجلس الأمن (الو.م.أ، فرنسا، بريطانيا، روسيا، الصّين)، يمنع من خلاله مجلس الأمن من إصدار قرارات تتنافى وخدمة مصالحه",
}
GEO_TERMS = {  # topic 1: p2 ; topic 2: p4
    "الخصخصة": "سياسة اقتصادية تقوم على تحويل أملاك الدّولة إلى الملكية الخاصّة عن طريق التّنازل أو البيع",
    "البنك العالمي": "مؤسّسة مالية دولية أنشئت بموجب اتّفاقية بروتون وودز في جوان 1946، مقرّه بواشنطن. مهمته تقديم المساعدة للدّول الأعضاء في شكل قروض بغرض تمويل مشاريعها في إطار إعادة البناء والتّعمير",
    "مؤشّرات": "أرقام إحصائية تمثّل ظاهرة اجتماعية أو ديمغرافية أو اقتصادية خلال فترة زمنية معيّنة، وهي وسيلة لتقييم الواقع واستشراف المستقبل وإصدار الحكم بالإيجاب أو السلب",
    "القيود الجمركية": "القواعد واللّوائح التي تفرضها الحكومات على الواردات بهدف حماية الاقتصاد المحلّي",
    "التّجارة البينية": "التّبادل التّجاري الذي يتّم بين دول داخل نفس المنطقة الاقتصادية أو الكتلة التّجارية",
    "التّكامل الاقتصادي": "سياسة تسمح بتنسيق الجهود بين دولتين أو أكثر لاستغلال الإمكانيات المتاحة بهدف تعزيز التّعاون والتّبادل التّجاري والاقتصادي بينها، والوصول إلى تحقيق أهداف اقتصادية مشتركة",
}
HIST_PERSONS = {  # topic 2: p3
    "ليونيد بريجنيف": "رئيس سوفياتي، كان وراء العديد من التدخّلات العسكرية السّوفياتية في الخارج مثل تشيكوسلوفاكيا وأفغانستان. وقّع معاهدات للحدّ من الأسلحة الاستراتيجية مع الو.م.أ. منها سالت 1 و2",
    "محمد العربي بن مهيدي": "مناضل جزائري في حركة الانتصار للحرّيات الديمقراطية، من مؤسّسي اللّجنة الثّورية للوحدة والعمل، ضمن مجموعة 22 وعضو لجنة الست، أحد مفجري الثورة، قائد المنطقة الخامسة وعضو في لجنة التّنسيق والتّنفيذ",
    "أحمد سوكارنو": "رئيس إندونيسيا من 1949 إلى 1967، قاد المقاومة ضدّ الاستعمار الياباني والهولندي، ترأّس مؤتمر باندونغ 1955، من مؤسّسي حركة عدم الانحياز",
    # من إجابات نموذجية رسميّة أخرى لدورة 2026 (لاكتمال أربعة خيارات؛ مشتّتات فقط)
    "رونالد ريغان": "رئيس أمريكي، تميّز بتشدّده تجاه الاتّحاد السوفييتي، صاحب مبادرة الدّفاع الاستراتيجي أو ما عرف بحرب النّجوم سنة 1983",
    "جواهر لال نهرو": "زعيم سياسي هندي، اول رئيس وزراء الهند بعد الاستقلال (1947-1964) من أبرز المشاركين في مؤتمر باندونغ سنة 1955، وأحد الزّعماء المؤسّسين لحركة عدم الانحياز سنة 1961",
    "ريتشارد نيكسون": "رئيس الولايات المتّحدة الامريكية (1969-1974)، تميّزت فترة حكمه بالتّقارب مع الصّين وتوقيع اتّفاقية سالت الأولى 1972. استقال سنة 1974 على خلفية فضيحة واترغيت",
}
FALLBACK_PERSONS = {"رونالد ريغان": "2026 علوم تجريبية… (15vxPWQCdIeTZqS9urrDNNWhFuw5pYNV3)",
                    "جواهر لال نهرو": "2026 علوم تجريبية… (15vxPWQCdIeTZqS9urrDNNWhFuw5pYNV3)",
                    "ريتشارد نيكسون": "2026 تسيير واقتصاد (1lrAayoaGUIv6WyNpeGhUy20hSP-ioJFF)"}


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs=()):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": fix(text) if "\n" not in text else "\n".join(fix(x) for x in text.split("\n")),
              "documents": list(docs), "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def deferred(sid, qid, eid, typ, prompt, spec, answer_spec, expl, pts, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": typ, "prompt": prompt,
              "payload": {"type": typ, "spec": spec}, "answer": {"type": typ, "spec": answer_spec}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


def term_mcq(sid, qid, eid, term, pool, distractors, pts, skill):
    assert term not in distractors and len(distractors) == 3
    st(sid, qid, eid, "mcq", f"ما المقصود بـ«{term}»؟", {"options": [pool[term]] + [pool[d] for d in distractors]}, {"correct": 0},
       f"«{term}» في الإجابة النموذجيّة: {pool[term]}.", pts, skill)


def person_mcq(sid, qid, eid, name, distractors, pts):
    assert name not in distractors and len(distractors) == 3 and name not in FALLBACK_PERSONS
    st(sid, qid, eid, "mcq", f"من هو {name}؟", {"options": [HIST_PERSONS[name]] + [HIST_PERSONS[d] for d in distractors]}, {"correct": 0},
       f"{name} في الإجابة النموذجيّة: {HIST_PERSONS[name]}.", pts, "hist.figures")


_n = [0]
def sid():
    _n[0] += 1
    return f"s{_n[0]:02d}"


def essay(qid, part, verbatim, para, title, task, sections, intro, concl, skill):
    """sections: [(heading, marks, indicators)] where marks = list of points (one element each);
    when len(indicators) == len(marks) each element carries its own indicator, otherwise each element = «one correct element»
    and carries the whole list (the rubric counts k elements among the listed ones)."""
    els, lines = [], []
    k = 0
    def add(section, crit, ind, pts, extra=None):
        nonlocal k
        k += 1
        eid = f"{qid}-e{k}"
        els.append(el(eid, f"{section}: {crit}" if section.startswith("العرض") else section, pts))
        lines.append((eid, section, crit, ind, pts, extra or {}))
    add("المقدمة", "الإشكاليّة", intro, 0.5, {"accept": "تقبل كلّ مقدّمة وظيفيّة"})
    for i, (head, marks, inds) in enumerate(sections, 1):
        sec = f"العرض {i}- {head}"
        if len(inds) == len(marks):
            for ind, pts in zip(inds, marks):
                add(sec, ind, ind, pts)
        else:
            for j, pts in enumerate(marks, 1):
                add(sec, f"عنصر صحيح ({j} من {len(marks)})", "؛ ".join(inds), pts,
                    {"note": f"يُحتسب {len(marks)} عناصر صحيحة من المؤشّرات {len(inds)} في الإجابة النموذجيّة (أو غيرها ممّا تقبله)"})
    add("الخاتمة", "الاستنتاج", concl, 0.5, {"accept": "تقبل كلّ خاتمة وظيفيّة"})
    q(qid, "—", part, verbatim, 4, els, [{"id": f"d-{qid}-para", "kind": "text", "caption": "العبارة", "text": fix(para)}])
    for eid, section, crit, ind, pts, extra in lines:
        deferred(sid(), qid, eid, "essay_builder", f"{title} — {section}: {crit}",
                 {"task": task, "paragraph_doc": f"d-{qid}-para", "section": section, "criterion": crit, "indicator": ind, **extra},
                 {"rubric": ind, "points": pts, "model_ref": CORR_TITLE},
                 f"سلّم التنقيط ({section}): {ind} — {pts} ن.", pts, skill)


def map_lines(qid, task, base_map, items, lines, skill, model_ref):
    """lines: (eid, criterion, answer_spec_extra, points)"""
    for eid, crit, extra, pts in lines:
        deferred(sid(), qid, eid, "map_locate", f"{task} — {crit}",
                 {"task": task, "base_map": base_map, "items": items, "criterion": crit},
                 {"rubric": crit, "points": pts, "model_ref": model_ref, **extra},
                 f"يُصحَّح على الخريطة وفق سلّم التنقيط: {crit} — {pts} ن.", pts, skill)


def text_doc(did, text, ref):
    return {"id": did, "kind": "text", "caption": "النّصّ", "text": fix(text) + "\n" + fix(ref)}


EXPLAIN = "المطلوب: اشرح ما تحته خطّ في النّصّ."


# ════════════════════════════════════════════ الموضوع الأوّل ════════════════════════════════════════════
def topic1():
    # ── التاريخ — الجزء الأوّل (ص1) ──
    txt = ('"...إنّ تباين الدّول الاستعمارية من حيث وزنها وأساليب وطرق تسييرها للمستعمرات، جعل حركة التّحرّر تتكيف مع طبيعة '
           'المستعمر، فأخذت بعضها مميّزات خاصّة، فمنها ما اتّسم بالعنف والشّراسة (الفيتنام) والتّضحيات الكبيرة والزّمن الطّويل '
           '(الجزائر) ومنها ما اتّسم بالسّلمية أو اللاّعنف الإيجابي (الهند). وإذا كان هذا الاختلاف يبدو طبيعيًّا فإنّه لم يمنع من '
           'وجود خصائص وقواسم مشتركة بينها، وأهمّها: الانتشار الواسع والشّمولية في جميع البلدان المستعمرة والتّضامن بسبب الرّفض '
           'المشترك للاستعمار، كالتّضامن الآفرو آسيوي والإصرار على استعادة حقوق شعوبها في الحياة والحرّية والاستقلال...".')
    ref = "المرجع: تاريخ العالم المعاصر. السنة الثالثة ثانوي، ط 2001/2000، الديوان الوطني للمطبوعات المدرسية. ص 204/203."
    q("q1", "1", PH1, EXPLAIN, 3,
      [el("q1-e1", "شرح «اللاّعنف»", 1), el("q1-e2", "شرح «التّضامن الآفرو آسيوي»", 1), el("q1-e3", "شرح «الاستقلال»", 1)],
      [text_doc("d-h1-text", txt, ref)])
    term_mcq(sid(), "q1", "q1-e1", "اللاّعنف", HIST_TERMS, ["التّضامن الآفرو آسيوي", "سياسة الاحتواء", "الفيتو"], 1, "hist.terms")
    term_mcq(sid(), "q1", "q1-e2", "التّضامن الآفرو آسيوي", HIST_TERMS, ["اللاّعنف", "الاستقطاب", "الفيتو"], 1, "hist.terms")
    term_mcq(sid(), "q1", "q1-e3", "الاستقلال", HIST_TERMS, ["التّضامن الآفرو آسيوي", "سياسة الاحتواء", "الفيتو"], 1, "hist.terms")

    table = [["الحدث", "تاريخه"],
             ["تأسيس حلف بغداد", ""],
             ["", "1956/10/22"],
             ["انضمام الجزائر إلى هيئة الأمم المتّحدة", ""]]
    q("q2", "2", PH1, "أكمل الجدول التّالي:", 3,
      [el("q2-e1", "تاريخ «تأسيس حلف بغداد»", 1), el("q2-e2", "حدث «1956/10/22»", 1),
       el("q2-e3", "تاريخ «انضمام الجزائر إلى هيئة الأمم المتّحدة»", 1)],
      [{"id": "d-h1-table", "kind": "table", "caption": "الجدول", "table": table}])
    st(sid(), "q2", "q2-e1", "mcq", "ما تاريخ «تأسيس حلف بغداد»؟",
       {"options": ["24 فيفري 1955", "08 أكتوبر 1962", "11 ديسمبر 1960", "17 أكتوبر 1961"]}, {"correct": 0},
       "في الإجابة النموذجيّة: تأسيس حلف بغداد — 24 فيفري 1955.", 1, "hist.dates")
    st(sid(), "q2", "q2-e2", "mcq", "ما الحدث الذي وقع في «1956/10/22»؟",
       {"options": ["اختطاف طائرة الزّعماء الخمس", "مؤتمر باندونغ", "تأسيس حركة عدم الانحياز", "إضراب ثمانية أيّام"]}, {"correct": 0},
       "في الإجابة النموذجيّة: 1956/10/22 — اختطاف طائرة الزّعماء الخمس.", 1, "hist.dates")
    st(sid(), "q2", "q2-e3", "mcq", "ما تاريخ «انضمام الجزائر إلى هيئة الأمم المتّحدة»؟",
       {"options": ["1962/10/08", "1955/02/24", "1960/12/11", "1961/10/17"]}, {"correct": 0},
       "في الإجابة النموذجيّة: انضمام الجزائر إلى الأمم المتحدة — 1962/10/08.", 1, "hist.dates")

    # ── التاريخ — الجزء الثاني (ص1) ──
    para = ("كان للمعايير العلمية والتّكنولوجية التي عرفها العالم بعد الحرب العالمية الثّانية، أثرها البالغ في تطوّر الصّراع "
            "الإيديولوجي بين المعسكرين وتزايد وتيرة السّباق نحو التّسلّح. وكان لحركة عدم الانحياز موقف واضح من ذلك.")
    verb = ("المطلوب: انطلاقًا من العبارة واعتمادًا على ما درست، اكتب مقالًا تاريخيًّا تُبيّن فيه:\n"
            "1) المعايير العلمية والتّكنولوجية المؤثّرة في تنامي السّباق نحو التّسلّح بعد الحرب العالمية الثّانية.\n"
            "2) موقف حركة عدم الانحياز من ذلك.")
    essay("q3", PH2, verb, para, "المقال التاريخي", "مقال تاريخي: المعايير العلمية والتكنولوجية المؤثرة في السباق نحو التسلح وموقف حركة عدم الانحياز",
          [("المعايير العلمية والتّكنولوجية المؤثّرة في تنامي السّباق نحو التّسلّح", [0.25] * 6,
            ["تطوّر العلوم والتّكنولوجيا والبحث العلمي (الاتّصال، التّجسّس)", "تطوّر التّرسانة العسكرية",
             "امتلاك الو.م.أ. للقنبلة الذّرّية (1945) والهيدروجينية (1952) وامتلاك الاتّحاد السّوفييتي للقنبلة الذّرّية (1949) والهيدروجينية (1953)",
             "اختراع الصّواريخ الباليستية والعابرة للقارّات", "تطوير الأسلحة البيولوجية والغازات السّامة", "غزو الفضاء الخارجي"]),
           ("موقف حركة عدم الانحياز من ذلك (الصراع الإيديولوجي، السباق نحو التسلح)", [0.25] * 6,
            ["نبذ الصّراع وسياسة التّكتّلات المنتهجة من طرف المعسكرين في إطار الحرب الباردة", "رفض سياسة السّباق نحو التّسلّح",
             "رفض إقامة القواعد العسكرية للقوى الكبرى على أراضيها", "رفض سياسة ملء الفراغ", "اتّباع سياسة الحياد الإيجابي",
             "دعم سياسة التّعايش السّلمي بين المعسكرين"])],
          "السّباق نحو التّسلّح بين التّطوّر العلمي والتّكنولوجي وموقف العالم الثّالث منه",
          "دور حركة عدم الانحياز في التّخفيف من تنامي السّباق نحو التّسلح وحدّة الصّراع", "hist.essay")

    # ── الجغرافيا — الجزء الأوّل (ص2) ──
    txt = ('"... حيث تبنّت سياســـات الانفتاح الاقتصـــاديّ وسياسات السّوق، وعمّت البرازيـــل حمّى الخصخصة والتّحرّر الاقتصاديّ، '
           'كما كان الحال في العديد من دول العالم الثّالث، التي اتّبعت توجيهات صندوق النّقد الدّولي والبنك العالمي، وهو ما أدّى إلى '
           'تقدّمٍ في مؤشّرات الاقتصاد الكلّي ..."')
    ref = "المرجع: آمال عبد الحميد ومنى عبد القادر، تجربة النمو الاقتصادي في البرازيل، ص 04-05."
    q("q4", "1", PG1, EXPLAIN, 3,
      [el("q4-e1", "شرح «الخصخصة»", 1), el("q4-e2", "شرح «البنك العالمي»", 1), el("q4-e3", "شرح «مؤشّرات»", 1)],
      [text_doc("d-g1-text", txt, ref)])
    term_mcq(sid(), "q4", "q4-e1", "الخصخصة", GEO_TERMS, ["البنك العالمي", "القيود الجمركية", "التّجارة البينية"], 1, "geo.terms")
    term_mcq(sid(), "q4", "q4-e2", "البنك العالمي", GEO_TERMS, ["الخصخصة", "مؤشّرات", "التّكامل الاقتصادي"], 1, "geo.terms")
    term_mcq(sid(), "q4", "q4-e3", "مؤشّرات", GEO_TERMS, ["الخصخصة", "البنك العالمي", "القيود الجمركية"], 1, "geo.terms")

    years = ["2000", "2005", "2010", "2015", "2020", "2021", "2022"]
    vals = ["0.5 %", "5.8 %", "12.5 %", "38.2%", "60.7 %", "66.2 %", "71.2 %"]
    q("q5", "2", PG1, ("إليك جدولًا يمثّل نسبة مستخدمي الأنترنت في الجزائر من سنة 2000 إلى 2022:\n"
                       "المطلوب: مثّل معطيات الجدول بواسطة منحنى بياني بمقياس رسم: 1 سم ← 10%\n1 سم ← سنتان"), 3,
      [el("q5-e1", "المنحنى البياني: الإنجاز", 2), el("q5-e2", "المنحنى البياني: العنوان", 0.5), el("q5-e3", "المنحنى البياني: المقياس", 0.5)],
      [{"id": "d-g1-table", "kind": "table", "caption": "الجدول", "table": [["السنوات", *years], ["نسبة المستخدمين", *vals]]},
       {"id": "d-g1-src", "kind": "text", "caption": "مصدر الجدول", "text": "Examen statistique du commerce mondial 2023, OMC, P 469"}])
    for eid, crit, extra, pts in [("q5-e1", "الإنجاز", {}, 2), ("q5-e2", "العنوان", {"model_title": "منحنى بياني لمستخدمي الأنترنت في الجزائر 2000 إلى 2022"}, 0.5),
                                  ("q5-e3", "المقياس", {"model_scale": "1 سم ← 10%؛ 1 سم ← سنتان (في المنحنى النموذجيّ: 10% و2سنة)"}, 0.5)]:
        deferred(sid(), "q5", eid, "function_plot", f"تمثيل نسبة مستخدمي الأنترنت في الجزائر (2000–2022) بمنحنى بياني — {crit}",
                 {"task": "تمثيل معطيات الجدول بمنحنى بيانيّ", "data_doc": "d-g1-table", "x": [int(y) for y in years],
                  "y": [float(v.replace("%", "").strip()) for v in vals], "x_label": "السنوات", "y_label": "نسبة المستخدمين (%)",
                  "scale_given": "1 سم ← 10%؛ 1 سم ← سنتان", "criterion": crit},
                 {"rubric": crit, "points": pts, "model_ref": f"{CORR_TITLE}، ص2 و6", **extra},
                 f"يُصحَّح الرسم وفق سلّم التنقيط: {crit} — {pts} ن.", pts, "geo.data")

    # ── الجغرافيا — الجزء الثاني (ص2) ──
    para = ("يمثّل إقليم الرّاين القلب النّابض لاقتصاد الاتّحاد الأوربّي لامتلاكه مؤهّلات ضرورية، سمحت له بالمساهمة بقوّة في تطوّر "
            "اقتصاد هذا التّكتّل في جميع المجالات.")
    verb = ("المطلوب: انطلاقًا من العبارة واعتمادًا على ما درست، اكتب مقالًا جغرافيًّا تُبيّن فيه:\n"
            "1) مؤهّلات إقليم الرّاين.\n2) دور الإقليم في تنشيط الاقتصاد الأوربّي.")
    essay("q6", PG2, verb, para, "المقال الجغرافي", "مقال جغرافي: مؤهلات إقليم الراين ودوره في تنشيط الاقتصاد الأوربي",
          [("مؤهّلات إقليم الرّاين", [0.25] * 6,
            ["فضاء اندماج ونقطة تقاطع بين العديد من الدّول الأوربّية (ألمانيا، فرنسا، سويسرا، هولندا)", "أكبر منطقة تمركز سكّاني في أوربّا",
             "تتركّز به جلّ الأنشطة الاقتصادية، وقوّة البنى التّحتية", "به مجرى ملاحي داخلي كبير يتمتّع بحيوية سياحية وتجارية",
             "وفرة الموارد الطّبيعية والمائية وانبساط سهوله وخصوبة التّربة", "اتّصاله بالواجهة البحرية الشمالية"]),
           ("دور الإقليم في تنشيط الاقتصاد الأوربّي", [0.25] * 6,
            ["انتاج نصف الدّخل الوطني الخام للدّول الأعضاء", "المساهمة في جعل الاتّحاد الأوربّي قوّة صناعية وزراعية على المستوى العالمي",
             "سوق استهلاكية واسعة", "تنشيط مختلف الأنشطة الاقتصادية لاحتوائه على أكبر عدد من المؤسّسات المالية",
             "تسهيل المواصلات بين الموانئ الشّمالية والمناطق الدّاخلية", "تمكين الاتحاد الأوروبي من جعله قطب اقتصادي عالمي منافس للأقطاب الأخرى"])],
          "إقليم الرّاين بين المؤهلات ودوره في تنشيط الاقتصاد الأوربّي",
          "أصبح إقليم الرّاين أهم فضاء اقتصادي في أوربّا بفضل مؤهّلاته", "geo.essay")


# ════════════════════════════════════════════ الموضوع الثاني ════════════════════════════════════════════
def topic2():
    # ── التاريخ — الجزء الأوّل (ص3) ──
    txt = ('"... وكان معنى هذا أنّه يتعيّن على مجلس الأمن، أن يعمل، إذا قُدّر له أن يعمل في ظلّ هذا المناخ الدّولي المتّسم بالاستقطاب '
           'والحرب الباردة... ولأنّ الاتّحاد السّوفييتي تولّد لديه الإحساس، وخاصّة بعد تبنّي الولايات المتّـــحدة لسياســـة الإحتواء، '
           'بأنّـــه أصبـــح معزولا وأنّه لا يستطيع في ظلّ منطق الحرب الباردة أن يدافع عن مصالحه... سواء داخل مجلس الأمن أو داخل '
           'الجمعية العامّة. فقد أصبح الفيتو هو سلاحه الوحيد. "')
    ref = "المصدر: د. حسن نافعة، الأمم المتحدة في نصف قرن، ص122."
    q("q1", "1", PH1, EXPLAIN, 3,
      [el("q1-e1", "شرح «الاستقطاب»", 1), el("q1-e2", "شرح «سياسة الإحتواء»", 1), el("q1-e3", "شرح «الفيتو»", 1)],
      [text_doc("d-h1-text", txt, ref)])
    term_mcq(sid(), "q1", "q1-e1", "الاستقطاب", HIST_TERMS, ["اللاّعنف", "الاستقلال", "الفيتو"], 1, "hist.terms")
    term_mcq(sid(), "q1", "q1-e2", "سياسة الاحتواء", HIST_TERMS, ["التّضامن الآفرو آسيوي", "الاستقلال", "الفيتو"], 1, "hist.terms")
    term_mcq(sid(), "q1", "q1-e3", "الفيتو", HIST_TERMS, ["التّضامن الآفرو آسيوي", "الاستقلال", "سياسة الاحتواء"], 1, "hist.terms")

    q("q2", "2", PH1, "عرّف بالشّخصيّات التّاليّة:\n- ليونيد بريجنيف - محمد العربي بن مهيدي - أحمد سوكارنو", 3,
      [el("q2-e1", "التعريف بليونيد بريجنيف", 1), el("q2-e2", "التعريف بمحمد العربي بن مهيدي", 1), el("q2-e3", "التعريف بأحمد سوكارنو", 1)])
    person_mcq(sid(), "q2", "q2-e1", "ليونيد بريجنيف", ["محمد العربي بن مهيدي", "أحمد سوكارنو", "رونالد ريغان"], 1)
    person_mcq(sid(), "q2", "q2-e2", "محمد العربي بن مهيدي", ["ليونيد بريجنيف", "أحمد سوكارنو", "جواهر لال نهرو"], 1)
    person_mcq(sid(), "q2", "q2-e3", "أحمد سوكارنو", ["ليونيد بريجنيف", "محمد العربي بن مهيدي", "ريتشارد نيكسون"], 1)

    # ── التاريخ — الجزء الثاني (ص3) ──
    para = ("بعد أن تأكّد للإدارة الاستعماريّة الفرنسيّة أنّ دعم ومساندة الشّعب الجزائريّ للثّورة هو أحد الأسباب الرّئيسيّة لصمودها "
            "وتوسّع نطاقها، سارعت إلى مضاعفة جهودها لإفراغ الثّورة من محتواها الشّعبي.")
    verb = ("المطلوب: انطلاقًا من العبارة واعتمادًا على ما درست، اكتب مقالًا تاريخيًّا تُبيّن فيه:\n"
            "1) مظاهر الدّعم الشّعبي للثّورة.\n2) ردّ فعل فرنسا على ذلك.")
    essay("q3", PH2, verb, para, "المقال التاريخي", "مقال تاريخي: مظاهر الدعم الشعبي للثورة ورد فعل فرنسا على ذلك",
          [("مظاهر الدّعم الشّعبي للثّورة", [0.25] * 6,
            ["التحاق مختلف شرائح المجتمع بالثّورة الجزائرية", "الدّعم المادّي واللّوجستي للثّوار",
             "التّأييد الشّعبي الواسع والتّمسك بمساندة الثّورة رغم المعاناة", "الإضرابات والاحتجاجات (إضراب ثمانية أيّام، إضراب الطّلبة)",
             "المظاهرات الشّعبية (1960/12/11 و 1961/10/17) الدّاعمة للثّورة",
             "إفشال جميع المشاريع الفرنسية رغم سياسة الإغراء الهادفة إلى إبعاده عن ثورته..."]),
           ("ردّ فعل فرنسا على ذلك (الدعم الشعبي)", [0.25] * 6,
            ["استخدام القوّة العسكرية، سياسة التّرهيب والتّجويع", "قمع المظاهرات والقتل الجماعي (مظاهرات17 أكتوبر 1961)",
             "عزل الشّعب عن طريق (المحتشدات، المناطق المحرّمة، الاعتقالات الجماعية والتّعذيب)", "إنشاء القوّة الثّالثة من العملاء",
             "تهجير الجزائريين بهدف الاستيطان", "المشاريع الإغرائية (الاقتصادية والاجتماعية) والمراوغات السّياسية"])],
          "الثّورة التحريرية بين الدّعم الشّعبي وردود فعل الفرنسية",
          "التفاف الشّعب الجزائري حول الثّورة من أهمّ أسباب نجاحها رغم محاولات فرنسا لعزله عنها", "hist.essay")

    # ── الجغرافيا — الجزء الأوّل (ص4) ──
    txt = ('"... إنّ رابطة الآسيان تهدف إلى إقامة منطقةِ تجارةٍ حرّةٍ بين أعضائها يتمّ خلالها إلغاء كافّة القيود الجمركية وغير الجمركية '
           'على تجارتها البينية، كما تهدف إلى توثيق العلاقات مع دول أخرى كاليابان وكوريا الجنوبيّة وغيرها ...وهذا ما ينطبق على المفهوم '
           'الحديث للتّكامل الاقتصادي...".')
    ref = ("المرجع: خالفي على ورميدي عبد الوهاب، رابطة دول جنوب شرق آسيا (الآسيان): نموذج الدول النامية للإقليمية المنفتحة، "
           "مجلة اقتصاديات شمال افريقيا، العدد 06، ص84.")
    q("q4", "1", PG1, EXPLAIN, 3,
      [el("q4-e1", "شرح «القيود الجمركية»", 1), el("q4-e2", "شرح «تجارتها البينية»", 1), el("q4-e3", "شرح «التّكامل الاقتصادي»", 1)],
      [text_doc("d-g1-text", txt, ref)])
    term_mcq(sid(), "q4", "q4-e1", "القيود الجمركية", GEO_TERMS, ["الخصخصة", "مؤشّرات", "التّجارة البينية"], 1, "geo.terms")
    term_mcq(sid(), "q4", "q4-e2", "التّجارة البينية", GEO_TERMS, ["الخصخصة", "البنك العالمي", "القيود الجمركية"], 1, "geo.terms")
    term_mcq(sid(), "q4", "q4-e3", "التّكامل الاقتصادي", GEO_TERMS, ["الخصخصة", "مؤشّرات", "القيود الجمركية"], 1, "geo.terms")

    countries = ["البرازيل", "روسيا", "الهند", "الصين", "جنوب افريقيا"]
    q("q5", "2", PG1, "وقّع على خريطة العالم المرفقة (صفحة 5 من 5) الدّول المؤسّسة لمجموعة البريكس (BRICS).", 3,
      [el(f"q5-e{i+1}", f"الخريطة: الإنجاز (الدولة {i+1} من 5)", 0.5) for i in range(5)]
      + [el("q5-e6", "الخريطة: العنوان", 0.25), el("q5-e7", "الخريطة: المفتاح", 0.25)])
    map_lines("q5", "توقيع الدّول المؤسّسة لمجموعة البريكس على خريطة العالم", "خريطة العالم المرفقة بالموضوع (ص5 من 5)",
              ["الدّول المؤسّسة لمجموعة البريكس (BRICS)"],
              [(f"q5-e{i+1}", f"الإنجاز (0.50 ن لكل دولة): الدولة {i+1} من 5", {"model_label": c}, 0.5) for i, c in enumerate(countries)]
              + [("q5-e6", "العنوان", {"model_title": "خريطة تمثّل مجموعة البريكس"}, 0.25),
                 ("q5-e7", "المفتاح", {"model_key": None, "note": "لا يظهر مفتاح مستقلّ في خريطة الإجابة النموذجيّة (الأسماء مكتوبة على الدّول)؛ يُقيَّم وفق سلّم التنقيط"}, 0.25)],
              "geo.map", f"{CORR_TITLE}، ص5")

    # ── الجغرافيا — الجزء الثاني (ص4) ──
    para = ("ساهم تطور التّكنولوجيا ووسائل الإعلام بشكل كبير في تغيير واقع المبادلات في العالم وكرّس مصالح دول الشّمال على حساب دول الجنوب.")
    verb = ("المطلوب: انطلاقًا من العبارة واعتمادًا على ما درست، اكتب مقالًا جغرافيًّا تُبيّن فيه:\n"
            "1) دور التّكنولوجيا والإعلام في المبادلات العالميّة.\n"
            "2) تأثير تحكّم دول الشّمال في التّكنولوجيا والإعلام على المبادلات في دول عالم الجنوب.")
    essay("q6", PG2, verb, para, "المقال الجغرافي", "مقال جغرافي: دور التكنولوجيا والإعلام في المبادلات العالمية وتأثير تحكم دول الشمال فيهما على الجنوب",
          [("دور التّكنولوجيا والإعلام في المبادلات العالمية", [0.25] * 6,
            ["التّرويج والإشهار للمنتجات والخدمات عبر وسائل الإعلام مما يزيد من الطّلب عليها",
             "تسريع وحماية حركة النّقود وظهور العملات المشفّرة مثل: \"بتكوين\"",
             "توسيع التّجارة الإلكترونية عبر الإنترنت والهواتف الذّكية، مما زاد من حجمها",
             "تسهيل عقد صفقات بين المتعاملين من بلدان وقارّات مختلفة عبر شبكة الأنترنت (تسهيل عملية الاستثمارات)",
             "تطوّر الاقتصاد الرقمي", "تطوّر وسائل النّقل ممّا زاد من حجم المبادلات ..."]),
           ("تأثير تحكّم دول الشّمال في التّكنولوجيا والإعلام على المبادلات في عالم الجنوب", [0.25] * 6,
            ["مساهمة وسائل الإعلام الغربية في نشر النمط الاستهلاك الغربي", "جعل دول الجنوب أسواقا استهلاكية لمنتجات دول الشّمال",
             "تهميش دور دول الجنوب في التّجارة العالمية",
             "التّبعية المطلقة لدول الشّمال من حيث المعلومات حول الأسواق العالمية وتأمين معطيات الشّركات المحلّية...",
             "تعميق الهوّة بين العالمين في حجم المبادلات التجارية", "زيادة حدّة الرّكود الاقتصادي في دول الجنوب بتوجيه من الإعلام الغربي"])],
          "التّكنولوجيا والإعلام بين أدورها في المبادلات العالمية وتأثير تحكم دول الشمال فيها على المبادلات في دول الجنوب",
          "الهيمنة التّكنولوجية والإعلامية لدول الشّمال ساهمت في زيادة الفجوة بين الشّمال والجنوب في المبادلات العالمية", "geo.essay")


topic1() if PAPER == 1 else topic2()

ORDINAL = {1: "الأوّل", 2: "الثاني"}
TITLE = f"بكالوريا 2026 (الدورة العاديّة) – التاريخ والجغرافيا – شعبة لغات أجنبية – الموضوع {ORDINAL[PAPER]}"
COMMON_NOTES = (
    "موضوع البكالوريا الرسميّ (الديوان الوطنيّ للامتحانات والمسابقات، الدورة: 2026 — العاديّة حسب اسم الملفّ في Drive، اختبار التاريخ والجغرافيا، "
    f"الشعبة: لغات أجنبية، المدة 03 سا و30 د): gdrive:{PAPER_ID} ({PAPER_TITLE}، 5 صفحات بطبقة نصّ، يضمّ الموضوعين وخريطة العالم). "
    f"الإجابة النموذجيّة وسلّم التنقيط الرسميّان: gdrive:{CORR_ID} ({CORR_TITLE}، 6 صفحات؛ طبقة نصّها مشوّهة فقُرئت من الصور). "
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): طبقة نصّ PDF استُعملت مساعدةً فقط وطوبق كلّ سطر بصورة الصفحة (150 و300 نقطة)؛ "
    "كلّ الأرقام قُرئت من الصورة لأنّ خطّ الورقة يشوّه الأرقام في طبقة النصّ، وكذلك الشدّات والتنوين والهمزات التي تسقطها طبقة النصّ. "
    "قواعد النسخ: كلّ تطويل ظاهر كُتب «ـــ» (قاعدة الدليل الثابتة) والشدّة على حرفها، وتنوين الفتح قبل الألف («انطلاقًا»، «مقالًا»)، "
    "والنطاقات بالشرطة بترتيب قراءتها («ص 04-05»)، والمسافات وُحّدت، ورقم السؤال في number. التسطير لا يُمثَّل في وثيقة نصّيّة: العناصر المسطّرة "
    "مسمّاة في عناوين العناصر. الخيارات الصحيحة بنصّ الإجابة النموذجيّة (بلا العنصر المشروح أو اسم الشخصيّة)، والمشتّتات شروح عناصر أخرى من الإجابة "
    "النموذجيّة نفسها (الموضوعان) اختيرت يدويًّا لتجنّب المتقاربات. «تقبل كلّ الإجابات الصحيحة الأخرى» في ذيل الصفحات فُهمت قبولًا لصيغ أخرى؛ "
    "لا يُعدّ أيّ خيار صحيح خاطئًا. الخرائط والمنحنى والجزء الثاني مؤجّلة (needs_engine_support) خطوةً لكلّ سطر من سلّم التنقيط، ومواصفاتها لا تحمل "
    "إلّا نصوص الإجابة النموذجيّة. ")
P_NOTES = {
    1: ("الموضوع الأوّل = تاريخ (جزء أوّل 6: شرح ما تحته خطّ 3×01 — المسطَّر في النصّ: «اللاّعنف»، «التّضامن الآفرو آسيوي»، «الاستقلال»؛ إكمال الجدول "
        "3×01؛ جزء ثانٍ 4: مقدّمة 0.50 + 0.25×6 + 0.25×6 + خاتمة 0.50) + جغرافيا (جزء أوّل 6: شرح ما تحته خطّ 3×01 — المسطَّر: «الخصخصة»، "
        "«والبنك العالمي»، «مؤشّرات»؛ المنحنى 03 = الإنجاز 02.00 + العنوان 0.50 + المقياس 0.50؛ جزء ثانٍ 4: 0.5 + 0.25×6 + 0.25×6 + 0.50). "
        "قرارات: جدول الأحداث — خيارات كلّ صفّ بصيغة خانة الإجابة النموذجيّة لذلك الصفّ («24 فيفري1955» → «24 فيفري 1955»، «1962/10/08»)، والمشتّتات "
        "التاريخ الناقص الآخر وتواريخ/أحداث من الإجابة النموذجيّة للموضوع الثاني (مظاهرات 1960/12/11 و1961/10/17، مؤتمر باندونغ، تأسيس حركة عدم "
        "الانحياز، إضراب ثمانية أيّام)، ولا يُعرض ما طُبع في الجدول؛ جدول نسب مستخدمي الأنترنت منقول حرفيًّا وثيقةَ جدول ومصدره المطبوع وثيقةً نصّيّة؛ "
        "المنحنى مؤجَّل function_plot. الفروق بين طبقة النصّ والصورة: الأرقام كلّها (مثلًا «2001/2000» ← «6660/1660»)، «ال لا عنف» = «اللاّعنف»، "
        "«وا ذا» = «وإذا»، «الشّمو لية» = «الشّمولية»، «كالت ضامن» = «كالتّضامن»، «المت حدة» = «المتّحدة»، «التّسّلح» = «التّسلّح»، «مؤش رات» = «مؤشّرات»، "
        "«الكّلي» = «الكلّي»، «انط لا ق ا … مقا لا تاريخ ي ًّا ت بيّن» = «انطلاقًا … مقالًا تاريخيًّا تُبيّن»، «واعتمادا» (ص2) = «واعتمادًا»."),
    2: ("الموضوع الثاني = تاريخ (جزء أوّل 6: شرح ما تحته خطّ 3×01 — المسطَّر في النصّ: «بالاستقطاب»، «لسياســـة الإحتواء»، «الفيتو»؛ "
        "التعريف بالشخصيّات 3×01؛ جزء ثانٍ 4: 0.50 + 0.25×6 + 0.25×6 + 0.5) + جغرافيا (جزء أوّل 6: شرح ما تحته خطّ 3×01 — المسطَّر: «القيود "
        "الجمركية»، «تجارتها البينية»، «للتّكامل الاقتصادي»؛ خريطة البريكس 03 = الإنجاز 0.50 لكلّ دولة (البرازيل، روسيا، الهند، الصين، جنوب "
        "افريقيا في الخريطة النموذجيّة) + العنوان 0.25 + المفتاح 0.25؛ جزء ثانٍ 4: 0.5 + 0.25×6 + 0.25×6 + 0.5). "
        "قرارات: الإجابة النموذجيّة لا تعرّف إلّا ثلاث شخصيّات، فالمشتّت الثالث لكلّ شخصيّة تعريف شخصيّة من إجابة نموذجيّة رسميّة أخرى لدورة 2026 "
        "(ريغان ونهرو: شعب علوم تجريبية/رياضيات/تقني رياضي/فنون؛ نيكسون: تسيير واقتصاد) اختير بعيدًا عن صاحب السؤال؛ مثال «مثل: الرّسوم "
        "الجمركية» في شرح «القيود الجمركية» حُذف من الخيار لأنّه يكرّر كلمة العنصر؛ «سياسة الاحتواء» و«الاستقطاب» لا يُعرض أحدهما مشتّتًا للآخر، "
        "وكذا «التّجارة البينية» و«التّكامل الاقتصادي»؛ «سياسة الإحتواء» كُتبت في النصّ كما طُبعت (بهمزة تحت الألف). "
        "الفروق بين طبقة النصّ والصورة: «توّلد» = «تولّد»، «إذا ق دّر» = «إذا قُدّر»، «المفهو م» = «المفهوم»، «للت كامل» = «للتّكامل»، «خط ّ في ال نّصّ» = "
        "«خطّ في النّصّ»، «وقع … الدول المؤسسة» = «وقّع … الدّول المؤسّسة»، «ص001» = «ص122»، «العدد 06، ص24» = «العدد 06، ص84»."),
}
NOTES = COMMON_NOTES + P_NOTES[PAPER]
LOG_NOTE = ("تحويل من صور الموضوع الرسميّ والإجابة النموذجيّة الرسميّة في Drive على نمط التجربة hg-bac-2008-lit؛ العلامات من سلّم التنقيط؛ "
            "الإجابات الصحيحة من الإجابة النموذجيّة؛ المشتّتات من شروح أخرى في الإجابة نفسها (أو من إجابة رسميّة أخرى لدورة 2026 للشخصيّات) وتحتاج مراجعة.")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التطبيع نسخة من normalizeArabic) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'((?:ar|hist|geo|isl|en|fr|math|phys|svt|tech)\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert {"hist.terms", "hist.figures", "hist.dates", "hist.map", "hist.essay", "geo.terms", "geo.data", "geo.map", "geo.essay"} <= SKILLS
DEFERRED = {"table_fill", "bar_chart", "variation_table", "function_plot", "map_locate", "essay_builder"}


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
        tot = sum(e["max_points"] for e in qq["rubric_elements"])
        assert abs(tot - qq["rubric_total"]) < 1e-9, (qq["id"], tot)
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    parts = {}
    for qq in Q:
        parts[qq["part"]] = parts.get(qq["part"], 0) + qq["rubric_total"]
    assert parts == {PH1: 6, PH2: 4, PG1: 6, PG2: 4}, parts
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in DEFERRED:
            assert s["review_status"] == "needs_engine_support" and set(p) == {"type", "spec"} and set(a) == {"type", "spec"}, s["id"]
            continue
        assert s["review_status"] == "needs_human_review", s["id"]
        assert t == "mcq", s["id"]
        assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        assert len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
        nk = _norm(p["options"][0])  # القاعدة 12: الإجابة لا تظهر في عنوان وثيقة
        assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption")
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{PAPER_ID}-p{PAPER}",
        "kind": "BAC", "year": 2026, "level": "3AS", "streams": STREAMS, "subject": "HIST", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{PAPER_ID}/view",
        "original_file_ref": f"gdrive:{PAPER_ID} ({PAPER_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} ({CORR_TITLE})",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
inter = [s for s in S if s["type"] not in DEFERRED]
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
      f"({len(inter)} interactive = {sum(s['points'] for s in inter)} pts, {len(S) - len(inter)} deferred = {sum(s['points'] for s in S if s['type'] in DEFERRED)} pts)")
