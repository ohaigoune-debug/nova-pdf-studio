"""Conversion: BAC 2026 (normal session) – English – stream «آداب وفلسفة» (LIT) – Subject 1 «In schools all over the world…» (paper 1)
and Subject 2 «Poverty and conflicts pose…» (paper 2). Follows the English pilot (build_en_bac_2019_lit.py, rules R1–R11),
CONVERSION_GUIDE.md Appendix A and the decisions D1–D9 written in build_en_bac_2026_lang.py / build_en_bac_2026_sci.py (same batch).

Usage:  python3 scripts/play/converters/build_en_bac_2026_lit.py <out.json> [1|2]
        (the paper defaults to the -p1/-p2 suffix of <out.json>), then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- paper  gdrive 13EErSpgZpnjAUvKznTReohnogA1bgexg «2026 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf» (ONEC, 4 pages:
  subject 1 = pages 1–2, subject 2 = pages 3–4). Header: «الدورة: 2026»، «الشعبة: آداب وفلسفة»، «المدة: 02 سا و30 د».
  Reading 15 (A/ Comprehension 07 + B/ Text Exploration 08) + Written Expression 05.
- key    gdrive 13vKRHjDTGjKlQWYXBQXoSWDYpHYR-pkQ «… - الحل.pdf» (ONEC «الإجابة النموذجية», page 1 = subject 1 «In schools all over the
  world…», page 2 = subject 2 «Poverty and conflicts pose…»), with the official marks («مجموع / مجزأة»). Both keys total 20.

How the text was read: both PDFs are DIGITAL (text layer). Verbatim strings from `pdftotext -raw` (U+202B/U+202C stripped), checked
line by line against the 150-dpi page images and by script (every verbatim string and every quotation in a prompt is a substring of the
text layer). Formatting that cannot be stored: underlines/bold (it §1, their §2, it §3; They §1, here §2, them §3; the parts of B3 in
subject 1), the superscript «th» of «Oct 24th» (written «24th»).

Decisions beyond the pilot (see D1–D9 in the two other 2026 builders):
D10 Subject 1 A2a «What possibilities does AI offer…» — key: five possibilities «(Accept minimum 2 possibilities.)»: a closed list, so it
    stays interactive (pilot R6): `multi` with exactly two key items correct (the two printed in §1) + two items contradicted by the
    text; the three other key items are in FORMS and never offered.
D11 Subject 1 A3c: the underlined «it» is the second one of «…it can also make it less human…» (page image); the prompt says so.
D12 Subject 2 B4: the paper's list has exactly the four answers («malnutrition - child - exhausted - suffer») — the bank is the paper's
    list unchanged (as D8).
D13 Written-expression grid «LPH»: the key prints «Excellence Vocabulary and creativity)» (opening bracket missing); the element label
    is «Excellence (vocabulary and creativity)» and the step spec quotes the grid row as printed.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper 1 or 2 (argument or -p1/-p2 suffix)"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SET_ID = f"en-bac-2026-lit-p{PAPER}"
STREAMS = ["LIT"]
PAPER_ID = "13EErSpgZpnjAUvKznTReohnogA1bgexg"
PAPER_TITLE = "2026 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
KEY_ID = "13vKRHjDTGjKlQWYXBQXoSWDYpHYR-pkQ"
KEY_TITLE = "2026 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الحل.pdf"
WE_POINTS = 5  # written expression on this paper (key grid «LPH»)

Q, S = [], []
FORMS = {}         # element id -> every form the key accepts (none of them may be offered as a distractor)
BINARY = set()     # step ids of 2-option mcq (True/False, Yes/No) — stored reversed (R5)
OPEN = set()       # element ids deferred because the key accepts any logical answer (D1)
PAPER_BANK = set()  # fill_blank step ids whose bank is exactly the paper's list (no extra word on the paper)


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, verbatim=False):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": verbatim, "review_status": "needs_human_review"})


def mcq(sid, qid, eid, prompt, right, wrongs, expl, pts, skill, verbatim=False):
    st(sid, qid, eid, "mcq", prompt, {"options": [right, *wrongs]}, {"correct": 0}, expl, pts, skill, verbatim)


def binary(sid, qid, eid, prompt, pos, neg, truth, expl, pts, skill):
    """R5: stored [neg, pos]; the shuffle always swaps two options, so the student sees pos first."""
    BINARY.add(sid)
    st(sid, qid, eid, "mcq", prompt, {"options": [neg, pos]}, {"correct": 1 if truth else 0}, expl, pts, skill)


def tf(sid, qid, eid, statement, truth, expl):
    binary(sid, qid, eid, f"True or false? “{statement}”", "True", "False", truth, expl, 0.5, "en.comprehension")


def essay(sid, qid, eid, crit, pts, spec, expl):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"Written expression — criterion: {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": crit}},
              "answer": {"type": "essay_builder", "spec": {"rubric": f"{crit}: {pts} pt{'s' if pts > 1 else ''} (official grid)"}},
              "explanation": expl, "points": pts, "skill_id": "en.writing", "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


def open_answer(sid, qid, eid, prompt, crit, model, accepts, pts, skill, verbatim=False):
    """D1: the key accepts any logical answer → deferred essay_builder holding the key's model answer."""
    OPEN.add(eid)
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder", "prompt": prompt,
              "payload": {"type": "essay_builder", "spec": {"task": prompt, "criterion": crit, "indicator": crit}},
              "answer": {"type": "essay_builder", "spec": {"rubric": f"{crit}: {pts} pt (official key: {accepts})", "model_answer": model}},
              "explanation": f"Key (model answer): {model} — {accepts}", "points": pts, "skill_id": skill, "lesson_ref": None,
              "is_verbatim_original": verbatim, "review_status": "needs_engine_support"})


def writing(qid, task, crits, topics, grid):
    spec = {"task": task, "topics": topics, "words": [80, 120], "grid": grid}
    line = " – ".join(f"{c} {p}" for c, p in crits)
    for i, (crit, pts) in enumerate(crits, 1):
        essay(f"s-we{i}", qid, f"{qid}-e{i}", crit, pts, spec, f"Scored with the official grid: {line} = {WE_POINTS} pts.")


def morph(sid, qid, eid, word, parts, wrongs, key):
    fmt = lambda p, r, s: f"prefix: {p or 'none'} | root: {r} | suffix: {s or 'none'}"
    mcq(sid, qid, eid, f"Divide “{word}” into root and affixes (prefix | root | suffix).", fmt(*parts), [fmt(*w) for w in wrongs],
        f"Key: {word} → {key}.", 0.5, "en.vocabulary")


def phon(sid, qid, eid, word, ending, right, symbols, key):
    mcq(sid, qid, eid, f"Classify “{word}” according to the pronunciation of the final {ending}.", right, [x for x in symbols if x != right],
        f"Key: {word} → {key}.", 0.25, "en.phonology")


def reorder(prefix, qid, sent, order):
    """D5 / pilot R4: opening sentence + each logical pair (0.5 each)."""
    full = " – ".join(order)
    mcq(f"{prefix}1", qid, f"{qid}-e1", "Reorder the sentences: which sentence opens the passage?", sent[order[0]],
        [sent[k] for k in sent if k != order[0]], f"Key: the passage opens with “{sent[order[0]]}” (0.5 for the opening sentence).", 0.5, "en.discourse")
    for i in range(1, len(order) - 1):
        a, b = order[i - 1], order[i]
        mcq(f"{prefix}{i + 1}", qid, f"{qid}-e{i + 1}", f"Reorder the sentences: which sentence comes right after “{sent[a]}”?", sent[b],
            [sent[k] for k in sent if k not in (a, b)], f"Key: “{sent[a]}” is followed by “{sent[b]}” (0.5 for each logical pair).", 0.5, "en.discourse")
    a, b = order[-2], order[-1]
    mcq(f"{prefix}{len(order)}", qid, f"{qid}-e{len(order)}", f"Reorder the sentences: which sentence comes right before “{sent[b]}”?", sent[a],
        [sent[k] for k in sent if k not in (a, b)],
        f"Key: “{sent[a]}” is followed by “{sent[b]}” (0.5 for each logical pair). Full order: {full}.", 0.5, "en.discourse")


PA = "Part One: Reading (15 points) – A/ Comprehension (07 points)"
PB = "Part One: Reading (15 points) – B/ Text Exploration (08 points)"
PW = "Part Two: Written Expression (05 points)"
INSTR = {"id": "d-instr", "kind": "text", "caption": "Instruction", "text": "Read the text carefully to do the activities:"}
WE_TASK = "Choose only ONE of the following topics."
GRID = "Criteria: relevance | Semantic coherence | Correct use of English | Excellence Vocabulary and creativity) | Final score — LPH: 1 | 1 | 2 | 1 | 5 points"


# ═══════════════════════════════ Subject 1 «In schools all over the world…» (pages 1–2) ═══════════════════════════════
def paper1():
    text = ("In schools all over the world, Artificial Intelligence (AI) is rewriting how knowledge is delivered to students and how their "
            "progress is measured. The gradual rise of AI in education has opened doors to new possibilities (personalised learning, efficient "
            "grading, etc.). Yet, it has also exposed concerns about dependency on AI sources.\n"
            "AI changed education to be more adaptive and personalised for students than ever before. In traditional classrooms, a single "
            "teacher is responsible for the learning needs of many students, each with different strengths and struggles in the subject. AI tools "
            "now have the ability to support students’ individual needs. The result of this personalised teaching is the students showing "
            "greater engagement and higher retention for their subjects.\n"
            "However, while AI can make learning more efficient, it can also make it less human and less enjoyable. As schools are increasingly "
            "using machines to give feedback, there is the risk that education has become too mechanical which reduces students’ abilities.\n"
            "The careful balance between human and artificial intelligence will be a crucial factor in defining the next era of learning. "
            "Whether AI becomes a tool for positive change or dependency depends on how wisely we use it.")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from: Eshwara Masina, www.medium.com, Oct 24th, 2025."}]
    match_box = [["1. Education", "a- Of great importance"], ["2. Support", "b- Give assistance to / help somebody"],
                 ["3. Crucial", "c- The process of receiving or giving instruction especially at a school"]]
    topic1 = ("At your school, some students use AI to do all their homework. At first, their grades improved, but soon they found it difficult "
              "to solve problems on their own. Write an article of about 80 to 120 words for your school magazine to raise awareness among your "
              "schoolmates to rely less on AI tools.")
    notes1 = ["- Use AI for help, not to copy.", "- Work with friends/ not with AI.", "- Spend less time using AI.", "- Think critically / not artificially."]
    topic2 = ("You Town Hall is organizing a visit to the National Museum. However, some of your friends said they would not participate because "
              "it was not interesting. Write an article of about 80 to 120 words for the local newspaper to convince them to take part in this event.")
    sent = {"a": "a- However, they should not rely on it for all their work", "b": "b- if it is used correctly and responsibly.",
            "c": "c- because this can reduce their own thinking skills.", "d": "d- Artificial intelligence can help students understand difficult topics"}

    q("q1", "1", PA, "Identify the type of the text.\nThe text is: a- a letter b- a web article c- a magazine article.", 1,
      [el("q1-e1", "Type of the text", 1)], docs)
    q("q2", "2", PA, "Answer the following questions according to the text.\na- What possibilities does AI offer in education?\n"
      "b- Is AI likely to harm students’ abilities? Justify.\nc- How should we use AI?", 3.5,
      [el("q2-e1", "a- Possibilities offered by AI", 1), el("q2-e2", "b- Yes/No answer", 0.5), el("q2-e3", "b- Justification", 1),
       el("q2-e4", "c- How we should use AI", 1)], docs)
    q("q3", "3", PA, "Find what or who the underlined words in the text refer to.\na- it (§1) b- their (§2) c- it (§3)", 1.5,
      [el("q3-e1", "a- it (§1)", 0.5), el("q3-e2", "b- their (§2)", 0.5), el("q3-e3", "c- it (§3)", 0.5)], docs)
    q("q4", "4", PA, "Copy the title you think is the most appropriate.\na- AI in Education – A Blessing or a Curse?\n"
      "b- The Positive Side of Artificial Intelligence.\nc- The Importance of AI.", 1, [el("q4-e1", "The most appropriate title", 1)], docs)
    q("q5", "1", PB, "Match the following words with the corresponding definitions.", 1.5, [el("q5-e1", "Words and definitions (0.5×3)", 1.5)],
      [{"id": "d-match", "kind": "table", "caption": "Words and definitions", "table": match_box}])
    q("q6", "2", PB, "Give the opposites of the following words keeping the same root.\nbalance - responsible - use", 1.5,
      [el("q6-e1", "balance", 0.5), el("q6-e2", "responsible", 0.5), el("q6-e3", "use", 0.5)], [])
    q("q7", "3", PB, "Ask questions that the underlined words answer.\na- Teachers are responsible for the learning needs of their students.\n"
      "b- AI changed education positively.", 3, [el("q7-e1", "a- Question", 1.5), el("q7-e2", "b- Question", 1.5)], [])
    q("q8", "4", PB, "Reorder the following sentences to get a coherent paragraph.\n" + "\n".join(sent[k] for k in "abcd"), 2,
      [el("q8-e1", "Opening sentence", 0.5), el("q8-e2", "Logical pair 1", 0.5), el("q8-e3", "Logical pair 2", 0.5), el("q8-e4", "Logical pair 3", 0.5)], [])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1)]
    q("q9", "—", PW, WE_TASK + "\nTopic one:\n" + topic1 + "\nMake the best use of following notes:\n" + "\n".join(notes1)
      + "\nTopic two:\n" + topic2, WE_POINTS, [el(f"q9-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A/ Comprehension ──
    mcq("s01", "q1", "q1-e1", "Identify the type of the text. The text is:", "a web article", ["a letter", "a magazine article"],
        "Key: b- a web article (source: www.medium.com).", 1, "en.discourse")
    FORMS["q2-e1"] = ["personalised learning", "efficient grading", "adaptive education", "supporting students’ individual needs", "personalized teaching"]
    st("s02", "q2", "q2-e1", "multi", "What possibilities does AI offer in education? Choose the TWO possibilities mentioned in the text.",
       {"options": ["personalised learning", "efficient grading", "more human and more enjoyable learning",
                    "a single teacher for the learning needs of many students"]},
       {"correct": [0, 1]},
       "Key (accept minimum 2 possibilities): personalised learning, efficient grading, adaptive education, supporting students’ individual needs; "
       "personalized teaching. “The gradual rise of AI in education has opened doors to new possibilities (personalised learning, efficient grading, "
       "etc.)” (§1). AI makes learning “less human and less enjoyable” (§3); the single teacher belongs to “traditional classrooms” (§2).",
       1, "en.comprehension")
    FORMS["q2-e2"] = ["Yes, it is", "Yes"]
    binary("s03", "q2", "q2-e2", "Is AI likely to harm students’ abilities?", "Yes, it is.", "No, it is not.", True,
           "Key: b- “Yes, it is / Yes.” (0.5 for yes).", 0.5, "en.comprehension")
    mcq("s04", "q2", "q2-e3", "Is AI likely to harm students’ abilities? Choose the sentence from the text that justifies the answer.",
        "There is the risk that education has become too mechanical which reduces students’ abilities.",
        ["AI tools now have the ability to support students’ individual needs.",
         "The result of this personalised teaching is the students showing greater engagement and higher retention for their subjects.",
         "AI changed education to be more adaptive and personalised for students than ever before."],
        "Key: b- Justification: “…there is the risk that education has become too mechanical which reduces students’ abilities.” (1 for "
        "justification) — §3.", 1, "en.comprehension")
    FORMS["q2-e4"] = ["We should use it wisely with a careful balance between human and artificial intelligence.", "wisely", "with a careful balance"]
    mcq("s05", "q2", "q2-e4", "How should we use AI?", "We should use it wisely with a careful balance between human and artificial intelligence.",
        ["We should use it to do all our homework.", "We should use it instead of teachers to give all the feedback.", "We should stop using it in schools."],
        "Key: c- “We should use it wisely with a careful balance…/wisely/with a careful balance…” — “The careful balance between human and artificial "
        "intelligence will be a crucial factor… depends on how wisely we use it.” (§4)", 1, "en.comprehension")
    mcq("s06", "q3", "q3-e1", "What does “it” refer to in “Yet, it has also exposed concerns about dependency on AI sources.” (§1)?",
        "the gradual rise of AI in education", ["education", "knowledge", "personalised learning"],
        "Key: a- It (§1): The gradual rise of AI in education.", 0.5, "en.discourse")
    mcq("s07", "q3", "q3-e2", "What does “their” refer to in “The result of this personalised teaching is the students showing greater engagement and "
        "higher retention for their subjects.” (§2)?", "students", ["AI tools", "teachers", "traditional classrooms"],
        "Key: b- Their (§2): students.", 0.5, "en.discourse")
    mcq("s08", "q3", "q3-e3", "What does the second “it” (in “make it less human”) refer to in “However, while AI can make learning more efficient, it can "
        "also make it less human and less enjoyable.” (§3)?", "learning", ["AI", "feedback", "the risk"],
        "Key: c- It (§3): learning.", 0.5, "en.discourse")
    mcq("s09", "q4", "q4-e1", "Copy the title you think is the most appropriate.", "AI in Education – A Blessing or a Curse?",
        ["The Positive Side of Artificial Intelligence.", "The Importance of AI."], "Key: a- AI in Education – A Blessing or a Curse?", 1, "en.comprehension")
    # ── B/ Text Exploration ──
    st("s10", "q5", "q5-e1", "matching", "Match the following words with the corresponding definitions.",
       {"lefts": ["Education", "Support", "Crucial"],
        "rights": ["The process of receiving or giving instruction especially at a school", "Give assistance to / help somebody", "Of great importance"]},
       {"pairs": [0, 1, 2]}, "Key: 1) c 2) b 3) a (0.5 each).", 1.5, "en.vocabulary", verbatim=True)
    FORMS["q6-e1"] = ["unbalance", "imbalance"]
    mcq("s11", "q6", "q6-e1", "Give the opposite of “balance” keeping the same root.", "imbalance", ["inbalance", "irbalance", "ilbalance"],
        "Key: unbalance / imbalance (both accepted).", 0.5, "en.vocabulary")
    mcq("s12", "q6", "q6-e2", "Give the opposite of “responsible” keeping the same root.", "irresponsible", ["inresponsible", "disresponsible", "imresponsible"],
        "Key: irresponsible (prefix ir-).", 0.5, "en.vocabulary")
    FORMS["q6-e3"] = ["misuse", "unuse", "disuse"]
    mcq("s13", "q6", "q6-e3", "Give the opposite of “use” keeping the same root.", "misuse", ["inuse", "iruse", "iluse"],
        "Key: misuse / unuse / disuse (all accepted).", 0.5, "en.vocabulary")
    mcq("s14", "q7", "q7-e1", "Ask the question which the underlined words answer: “Teachers are responsible for the learning needs of their students.” "
        "(underlined: “the learning needs of their students”)", "What are teachers responsible for?",
        ["What teachers are responsible for?", "What are teachers responsible?", "What do teachers responsible for?"],
        "Key: a- What are teachers responsible for?", 1.5, "en.grammar")
    mcq("s15", "q7", "q7-e2", "Ask the question which the underlined words answer: “AI changed education positively.” (underlined: “positively”)",
        "How did AI change education?", ["How AI changed education?", "How did AI changed education?", "Why did AI change education?"],
        "Key: b- How did AI change education?", 1.5, "en.grammar")
    reorder("s-r", "q8", sent, ["d", "b", "a", "c"])
    writing("q9", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}], GRID)
    return "In schools all over the world…", "الموضوع الأوّل"


# ═══════════════════════════════ Subject 2 «Poverty and conflicts pose…» (pages 3–4) ═══════════════════════════════
def paper2():
    text = ("Poverty and conflicts pose multiple challenges to children. They can deprive them of their future in education. Young boys and "
            "girls engage in child labour when their families encounter financial challenges. They face the dilemma of working to support their "
            "families or attending school. In the Gambella region of Ethiopia, 13-year-old Ojulu works to support his family, but had to quit school.\n"
            "Every morning, Ojulu goes to the gold mine site and stays for long hours under a scorching sun. He soaks his pan into water and sees "
            "if some tiny glittering particles of gold remain at the bottom of the pan. “I started working here three years ago,” says Ojulu. He "
            "regrets that he left school at an early age. “My father always wanted me to be a good student,” he adds.\n"
            "In Gambella, the UNICEF is coordinating with social workers to help children engaged in child labour get back to school. They "
            "support vulnerable families with psychosocial assistance and connect them also to basic services.")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from: https://www.unicef.org/ethiopia/stories/child-labour-tale-two-children."}]
    cloze = ("There are many ways that child labour can affect children. They can vary depending on which industry the ….(1) …. is working in. "
             "Generally, child labourers can …. (2) …. from long-term health problems due to …. (3) …. , exposure to chemicals, abuse and injuries. "
             "It is also true that children who work are often …. (4) …. and unable to attend classes or do their homework.")
    topic1 = ("The UNICEF estimates that 1 in 10 children (around 160 million) are in child labour. This situation puts children’s health or "
              "safety at risk, or interferes with their education. As a member of an association that defends children’s rights, write an article "
              "of about 80 to 120 words for the local newspaper to support UNICEF’s efforts in fighting child labour.")
    notes1 = ["- raising awareness and pushing for policy changes.", "- access to quality education.", "- supporting vulnerable families.",
              "- working to strengthen laws and enforcement."]
    topic2 = ("Although corporal punishment is illegal, you often witness cases of physical violence against students in your school. As a class "
              "representative, write a speech of about 80 to 120 words to deliver before your school board to denounce this practice.")

    q("q1", "1", PA, "Say whether the following statements are true or false.\na- Conflicts are the only reason for child labour.\n"
      "b- Child labour prevents children from attending school.\nc- Ojulu wishes he had not left school.\n"
      "d- Nothing is done to help working children go back to school in Ethiopia.", 2,
      [el(f"q1-e{i}", f"Statement {x} (T/F)", 0.5) for i, x in enumerate("abcd", 1)], docs)
    q("q2", "2", PA, "Identify the paragraphs in which the following ideas are mentioned.\na- Ojulu is engaged in mining.\n"
      "b- Hard living conditions oblige children to work.", 0.5,
      [el("q2-e1", "a- Paragraph of idea a", 0.25), el("q2-e2", "b- Paragraph of idea b", 0.25)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text.\na- What dilemma do poor children face?\n"
      "b- Is Ojulu working under hard conditions? Justify.\nc- How does the UNICEF help working children go back to school in Ethiopia?", 3,
      [el("q3-e1", "a- The dilemma", 1), el("q3-e2", "b- Yes/No answer", 0.25), el("q3-e3", "b- Justification", 0.75),
       el("q3-e4", "c- How the UNICEF helps", 1)], docs)
    q("q4", "4", PA, "Find who or what the underlined words in the text refer to.\na- They (§1) b- here (§2) c- them (§3)", 1.5,
      [el("q4-e1", "a- They (§1)", 0.5), el("q4-e2", "b- here (§2)", 0.5), el("q4-e3", "c- them (§3)", 0.5)], docs)
    q("q5", "1", PB, "Find in the text words or phrases whose definitions follow:\na- Situations where people are in opposition or disagreement. (§1)\n"
      "b- Extremely hot. (§2)\nc- To provide help and assistance. (§3)", 1.5,
      [el("q5-e1", "a- (§1)", 0.5), el("q5-e2", "b- (§2)", 0.5), el("q5-e3", "c- (§3)", 0.5)], docs)
    q("q6", "2", PB, "Divide the following words into root and affixes.\ndisengage - financial – uneducated", 1.5,
      [el("q6-e1", "disengage", 0.5), el("q6-e2", "financial", 0.5), el("q6-e3", "uneducated", 0.5)],
      [{"id": "d-table", "kind": "table", "caption": "Table", "table": [["prefix", "root", "suffix"], ["", "", ""]]}])
    q("q7", "3", PB, "Complete sentence (b) so that it means the same as sentence (a).\n"
      "1) a- Social workers are deployed by the UNICEF to support vulnerable families.\nb- The UNICEF………………….……………………….\n"
      "2) a- The young boy regrets that he left school at an early age.\nb- The young boy wishes………………..…………….\n"
      "3) a- Ojulu said,“I started working three years ago.”\nb- Ojulu said………………………………………", 3,
      [el("q7-e1", "1) The UNICEF …", 1), el("q7-e2", "2) The young boy wishes …", 1), el("q7-e3", "3) Ojulu said …", 1)], [])
    q("q8", "4", PB, "Fill in each gap with the appropriate word from the list given.", 2, [el("q8-e1", "Gap filling (0.5×4)", 2)],
      [{"id": "d-bank", "kind": "text", "caption": "Word list", "text": "malnutrition - child - exhausted - suffer"},
       {"id": "d-cloze", "kind": "text", "caption": "Passage", "text": cloze}])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1)]
    q("q9", "—", PW, WE_TASK + "\nTopic one:\n" + topic1 + "\nMake the best use of the following notes:\n" + "\n".join(notes1)
      + "\nTopic two:\n" + topic2, WE_POINTS, [el(f"q9-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A/ Comprehension ──
    tf("s01", "q1", "q1-e1", "Conflicts are the only reason for child labour.", False,
       "Key: a- F. “Poverty and conflicts pose multiple challenges to children”; families’ “financial challenges” also push them to work.")
    tf("s02", "q1", "q1-e2", "Child labour prevents children from attending school.", True,
       "Key: b- T. Ojulu “works to support his family, but had to quit school”.")
    tf("s03", "q1", "q1-e3", "Ojulu wishes he had not left school.", True, "Key: c- T. “He regrets that he left school at an early age.”")
    tf("s04", "q1", "q1-e4", "Nothing is done to help working children go back to school in Ethiopia.", False,
       "Key: d- F. In Gambella, the UNICEF helps children engaged in child labour “get back to school”.")
    mcq("s05", "q2", "q2-e1", "In which paragraph is this idea mentioned: “Ojulu is engaged in mining.”?", "§2", ["§1", "§3"],
        "Key: a- § 2.", 0.25, "en.comprehension")
    mcq("s06", "q2", "q2-e2", "In which paragraph is this idea mentioned: “Hard living conditions oblige children to work.”?", "§1", ["§2", "§3"],
        "Key: b- § 1 — families’ “financial challenges” push children to work.", 0.25, "en.comprehension")
    mcq("s07", "q3", "q3-e1", "What dilemma do poor children face?", "Working to support their families or attending school",
        ["Working in a gold mine or in a factory", "Living with their parents or with social workers", "Studying in Ethiopia or studying abroad"],
        "Key: a- “Working to support their families or attending school” (§1).", 1, "en.comprehension")
    FORMS["q3-e2"] = ["Yes, he is", "Yes"]
    binary("s08", "q3", "q3-e2", "Is Ojulu working under hard conditions?", "Yes, he is.", "No, he is not.", True,
           "Key: b- “Yes, he is / Yes.” (0.25 for yes).", 0.25, "en.comprehension")
    mcq("s09", "q3", "q3-e3", "Is Ojulu working under hard conditions? Choose the sentence from the text that justifies the answer.",
        "He stays for long hours under a scorching sun.",
        ["His father always wanted him to be a good student.", "He sees if some tiny glittering particles of gold remain at the bottom of the pan.",
         "The UNICEF supports his family with psychosocial assistance."],
        "Key: b- Justification: “He stays for long hours under a scorching sun.” (0.75 for justification) — §2.", 0.75, "en.comprehension")
    mcq("s10", "q3", "q3-e4", "How does the UNICEF help working children go back to school in Ethiopia?",
        "Coordinating with social workers to help children engaged in child labour get back to school, supporting vulnerable families with "
        "psychosocial assistance, and connecting them to basic services.",
        ["Paying children to work in the gold mine site.", "Building new schools in every village of Gambella.", "Sending working children to study abroad."],
        "Key: c- “Coordinating with social workers to help children engaged in child labour get back to school, supporting vulnerable families with "
        "psychosocial assistance, and connecting them to basic services.” (§3)", 1, "en.comprehension")
    mcq("s11", "q4", "q4-e1", "What does “They” refer to in “They face the dilemma of working to support their families or attending school.” (§1)?",
        "young boys and girls", ["their families", "poverty and conflicts", "financial challenges"], "Key: a- They: young boys and girls.", 0.5, "en.discourse")
    FORMS["q4-e2"] = ["gold mine site", "gold mine", "the gold mine site"]
    mcq("s12", "q4", "q4-e2", "What does “here” refer to in Ojulu’s words “I started working here three years ago” (§2)?", "the gold mine site",
        ["school", "the bottom of the pan", "the water"], "Key: b- here: gold mine site / gold mine.", 0.5, "en.discourse")
    mcq("s13", "q4", "q4-e3", "What does “them” refer to in “They support vulnerable families with psychosocial assistance and connect them also to basic "
        "services.” (§3)?", "vulnerable families", ["social workers", "basic services", "the UNICEF"], "Key: c- them: vulnerable families.", 0.5, "en.discourse")
    # ── B/ Text Exploration ──
    mcq("s14", "q5", "q5-e1", "Find in §1 the word that means: “Situations where people are in opposition or disagreement.”", "conflicts",
        ["poverty", "dilemma", "labour"], "Key: a- conflicts — “Poverty and conflicts pose multiple challenges to children.” (§1)", 0.5, "en.vocabulary")
    mcq("s15", "q5", "q5-e2", "Find in §2 the word that means: “Extremely hot.”", "scorching", ["glittering", "tiny", "early"],
        "Key: b- scorching — “under a scorching sun” (§2).", 0.5, "en.vocabulary")
    FORMS["q5-e3"] = ["to support", "support"]
    mcq("s16", "q5", "q5-e3", "Find in §3 the word that means: “To provide help and assistance.”", "to support", ["to coordinate", "to connect", "to get back"],
        "Key: c- to support — “They support vulnerable families with psychosocial assistance” (§3).", 0.5, "en.vocabulary")
    morph("s17", "q6", "q6-e1", "disengage", ("dis", "engage", None), [("di", "sengage", None), (None, "disen", "gage"), ("dis", "eng", "age")],
          "dis | engage | //////////")
    morph("s18", "q6", "q6-e2", "financial", (None, "financ(e)", "ial"), [("fin", "anc(e)", "ial"), (None, "fin", "ancial"), ("fi", "nanc(e)", "ial")],
          "/////// | Financ(e) | ial")
    morph("s19", "q6", "q6-e3", "uneducated", ("un", "educat(e)", "ed"), [(None, "uneducat(e)", "ed"), ("u", "neducat(e)", "ed"), ("une", "ducat(e)", "ed")],
          "un | educat(e) | ed")
    mcq("s20", "q7", "q7-e1", "Complete sentence (b) so that it means the same as sentence (a): (a) “Social workers are deployed by the UNICEF to support "
        "vulnerable families.” → (b) “The UNICEF …”", "The UNICEF deploys social workers to support vulnerable families.",
        ["The UNICEF is deployed social workers to support vulnerable families.", "The UNICEF deployed social workers to support vulnerable families.",
         "The UNICEF has been deployed by social workers to support vulnerable families."],
        "Key: 1) b- “The UNICEF deploys social workers to support vulnerable families.”", 1, "en.grammar")
    FORMS["q7-e2"] = ["The young boy wishes he had not left school at an early age.", "The young boy wishes he hadn’t left school at an early age."]
    mcq("s21", "q7", "q7-e2", "Complete sentence (b) so that it means the same as sentence (a): (a) “The young boy regrets that he left school at an early "
        "age.” → (b) “The young boy wishes …”", "The young boy wishes he had not left school at an early age.",
        ["The young boy wishes he did not leave school at an early age.", "The young boy wishes he has not left school at an early age.",
         "The young boy wishes he would not left school at an early age."],
        "Key: 2) b- “The young boy wishes he had not left school at an early age.”", 1, "en.grammar")
    FORMS["q7-e3"] = ["Ojulu said that he had started working three years before.", "Ojulu said that he started working three years before.",
                      "Ojulu said he had started working three years before.", "Ojulu said he started working three years before."]
    mcq("s22", "q7", "q7-e3", "Complete sentence (b) so that it means the same as sentence (a): (a) Ojulu said,“I started working three years ago.” "
        "→ (b) “Ojulu said …”", "Ojulu said that he had started working three years before.",
        ["Ojulu said that I started working three years before.", "Ojulu said that he has started working three years before.",
         "Ojulu said that he starts working three years before."],
        "Key: 3) b- “Ojulu said that he had started/ started working three years before.”", 1, "en.grammar")
    PAPER_BANK.add("s23")
    st("s23", "q8", "q8-e1", "fill_blank", "Fill in each gap with the appropriate word from the list given.",
       {"text": ("There are many ways that child labour can affect children. They can vary depending on which industry the (1) ____ is working in. "
                 "Generally, child labourers can (2) ____ from long-term health problems due to (3) ____ , exposure to chemicals, abuse and injuries. "
                 "It is also true that children who work are often (4) ____ and unable to attend classes or do their homework."),
        "bank": ["malnutrition", "child", "exhausted", "suffer"]},
       {"blanks": [["child"], ["suffer"], ["malnutrition"], ["exhausted"]]}, "Key: 1) child 2) suffer 3) malnutrition 4) exhausted (0.5 each).", 2,
       "en.vocabulary", verbatim=True)
    writing("q9", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}], GRID)
    return "Poverty and conflicts pose…", "الموضوع الثّاني"


TOPIC, PAPER_AR = (paper1 if PAPER == 1 else paper2)()

TITLE = f"بكالوريا 2026 (الدّورة العاديّة) – اللّغة الإنجليزيّة – شعبة آداب وفلسفة – {PAPER_AR} ({TOPIC})"
COMMON_NOTES = (
    "موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، الدّورة: 2026، الشّعبة: آداب وفلسفة، المدّة: 02 سا و30 د) "
    f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، 4 صفحات: الموضوع الأوّل ص1–2، الثّاني ص3–4)؛ «الدّورة العاديّة» من اسم الملفّ. "
    f"الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{KEY_ID} (ص1 «In schools all over the world…»، ص2 «Poverty and conflicts pose…»)؛ "
    "مجموع كلّ موضوع 20 (القراءة 15 = الفهم 07 + استكشاف النّصّ 08، التّعبير الكتابيّ 05). "
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّ PDF رقميّ له طبقة نصّ أصليّة، فأُخذت الحروف منها (pdftotext -raw: علامات الاقتباس "
    "المنحنية، «…»، «§»، «–»، نقاط الفراغات) وطوبقت سطرًا سطرًا مع صور الصّفحات (150 نقطة)، وتُحقِّق بسكربت من أنّ كلّ نصّ حرفيّ وكلّ اقتباس في "
    "الخطوات جزء من طبقة النّصّ. خلاف طبقة النّصّ والصّورة: السّنة والمدّة في الرّأس العربيّ معكوسة («0302»، «02 … 03») وصوابها في الصّورة «2026» "
    "و«02 سا و30 د»؛ «24th» بأسّ مرفوع في الصّورة؛ التّسطير والخطّ الغامق لا يظهران في طبقة النّصّ وحُدّدا من الصّورة. أخطاء الورقة محفوظة كما "
    "طُبعت («You Town Hall»، «Make the best use of following notes»، «Ojulu said,“I…»، «financial – uneducated»). "
    "قرارات التّحويل (R1–R11 في محوّل التّجربة build_en_bac_2019_lit.py، وD1–D13 في رؤوس محوّلات 2026): عنصر لكلّ بند يُنقَّط منفردًا؛ صح/خطأ "
    "ونعم/لا اختيار من خيارين مخزَّنان معكوسين؛ «نعم + علّل» عنصران كما في السّلّم؛ صيغ الحلّ المتعدّدة للإجابة نفسها تبقى تفاعليّة ولا تُعرض صيغة "
    "مقبولة مشتّتًا؛ الاشتقاق والأضداد اختيار من متعدّد لكلّ كلمة؛ إعادة التّرتيب: الجملة الافتتاحيّة وكلّ زوج منطقيّ (0.5 لكلّ منها)؛ التّعبير الكتابيّ "
    "مؤجَّل بمعايير الشّبكة الرّسميّة «LPH» (الملاءمة 1، الانسجام الدّلاليّ 1، سلامة اللّغة 2، الإتقان 1؛ الحلّ يكتب «Excellence Vocabulary and "
    "creativity)» بلا قوس افتتاح فصُحّح القوس في اسم العنصر فقط). ")
PAPER_NOTES = {
    1: ("الموضوع الأوّل: المسطَّر it (§1 «Yet, it has also exposed»)، their (§2 «retention for their subjects»)، it (§3 «make it less human»: "
        "الثّانية في الجملة، من الصّورة)، وفي B3 «the learning needs of their students» و«positively». س2أ: الحلّ يعدّد خمس إمكانات «(Accept minimum 2 "
        "possibilities.)» فهي قائمة مغلقة: اختيار متعدّد بإمكانين صحيحين (المذكورين في §1) ومشتّتين يناقضهما النّصّ، ولم تُعرض الإمكانات الثّلاث الأخرى "
        "(D10). س2ب: «Yes» (0.5) والتّعليل (1) عنصران؛ الخيار الصّحيح بلفظ الحلّ «there is the risk…» بحرف كبير. س2ج: الحلّ «We should use it wisely "
        "with a careful balance…/wisely/with a careful balance…» فالخيار يكمل «…» من النّصّ (between human and artificial intelligence). B3 علامتها "
        "1.5×2. إعادة التّرتيب d - b - a - c: الافتتاحيّة + الأزواج d–b، b–a، a–c. المجموع 20 = 7 + 8 + 5 (تفاعليّ 15، مؤجَّل 5)."),
    2: ("الموضوع الثّاني: المسطَّر They (§1 «They face the dilemma»)، here (§2 «“I started working here…”»)، them (§3 «connect them also»). س2 علامتها "
        "0.25×2. س3ب: «Yes» (0.25) والتّعليل (0.75) عنصران. س4ب: الحلّ «gold mine site / gold mine». س B1ج: لم تُعرض «to help» مشتّتًا (في §3 وقابلة "
        "للدّفاع). س B3-3: الحلّ «he had started/ started … before» فالصّيغتان (ومعهما حذف that) لا تُعرضان مشتّتًا. ملء الفراغات (0.5×4) خطوة واحدة، "
        "وقائمة الورقة أربع كلمات لأربعة فراغات فبقي البنك كما في الورقة دون مشتّت مُضاف (D12). المجموع 20 = 7 + 8 + 5 (تفاعليّ 15، مؤجَّل 5)."),
}
NOTES = COMMON_NOTES + PAPER_NOTES[PAPER]
LOG_NOTE = ("تحويل من الموضوع الرّسميّ (طبقة نصّ PDF مطابَقة بصور الصّفحات) والإجابة النّموذجيّة الرّسميّة في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")


# ── local checks before writing (skills from src/server/play/exams/skills.ts; _norm mirrors normalizeArabic in src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(en\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) >= 6, "skills.ts not parsed"


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check(total=20):
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    assert set(FORMS) <= set(els) and OPEN <= set(els), "FORMS / OPEN for an unknown element"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    paper = _norm(" ".join([qq["verbatim_text"] for qq in Q] + [d.get("text", "") for qq in Q for d in qq["documents"]]
                           + [c for qq in Q for d in qq["documents"] for r in d.get("table", []) for c in r]))
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        qq = next(x for x in Q if x["id"] == s["source_question_id"])
        assert s["is_verbatim_original"] == (s["prompt"] == qq["verbatim_text"]), (s["id"], "R11")
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t == "mcq":
            binary_step = len(p["options"]) == 2
            assert binary_step or (3 <= len(p["options"]) <= 4 and a["correct"] == 0), (s["id"], "mcq: 3–4 options, right one first before shuffling")
            assert binary_step == (s["id"] in BINARY), (s["id"], "2 options only for T/F and Yes/No (R5)")
        if t in ("mcq", "multi"):
            assert len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
            right = {a["correct"]} if t == "mcq" else set(a["correct"])
            forms = {_norm(f) for f in FORMS.get(s["rubric_element_id"], [])}
            for i, o in enumerate(p["options"]):  # R6: an accepted form is never a distractor
                assert i in right or _norm(o) not in forms, (s["id"], "accepted form offered as a distractor", o)
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            assert all(any(_norm(x) in bank for x in alts) for alts in a["blanks"]), s["id"]
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(bank) > len(a["blanks"]) or s["id"] in PAPER_BANK, (s["id"], "no distractor in the bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2 and len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
            assert s["source_question_id"] == Q[-1]["id"] or s["rubric_element_id"] in OPEN, (s["id"], "deferred only for writing / open answers")
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            assert s["rubric_element_id"] not in OPEN, s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:  # rule 12: no answer in a caption unless printed on the paper
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps) and nk not in paper), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert abs(Q[-1]["rubric_total"] - WE_POINTS) < 1e-9 and Q[-1]["part"] == PW, "written expression is the last question"
    deferred = sum(s["points"] for s in S if s["type"] == "essay_builder")
    assert abs(deferred - WE_POINTS - sum(els[e]["max_points"] for e in OPEN)) < 1e-9, ("deferred = writing + open answers", deferred)
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
        "kind": "BAC", "year": 2026, "level": "3AS", "streams": STREAMS, "subject": "EN", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{PAPER_ID}/view",
        "original_file_ref": f"gdrive:{PAPER_ID} ({PAPER_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{KEY_ID}/view",
        "correction_file_ref": f"gdrive:{KEY_ID} ({KEY_TITLE})",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T10:30:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
      sum(s["points"] for s in S if s["type"] != "essay_builder"), "interactive +", sum(s["points"] for s in S if s["type"] == "essay_builder"), "deferred")
