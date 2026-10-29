"""Conversion: BAC 2019 (normal session) – English – stream «آداب وفلسفة» (LIT) – Subject 1 «Inca Civilization» (paper 1)
and Subject 2 «Education» (paper 2). PILOT for English (CONVERSION_GUIDE.md, Appendix A): the rules below are meant to be
reused as-is by the batch converters of the other English BAC papers.

Usage:  python3 scripts/play/converters/build_en_bac_2019_lit.py <out.json> [1|2]
        (the paper defaults to the -p1/-p2 suffix of <out.json>), then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive, folder 1dBwHMfm7APpsrGPDGfPQJ5CFzQ9uhR2n):
- paper  gdrive 1cu4MAj44Jw_q0hRg51NNagHbMP1BGbaA «2019 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf» (ONEC,
  4 pages: subject 1 = pages 1–2, subject 2 = pages 3–4). Header: «دورة: 2019»، «الشعبة: آداب وفلسفة»، «المدة: 02 سا و 30 د».
- key    gdrive 1cLYVJyFmuz_QhrHA9iPlp8MdYxFu_T_X «… - الحل.pdf» (ONEC «الإجابة النموذجية», page 1 = subject 1 «Inca Civilization»,
  page 2 = subject 2 «Education»), with the official marks («مجموع / مجزأة»).

How the text was read: both PDFs are DIGITAL (pdffonts lists embedded fonts, there is a text layer). Verbatim strings were taken
from the text layer (`pdftotext -raw`: exact typographic characters «…», «’», «“ ”», «§», dot leaders «……………….») and checked
line by line against the 150-dpi page images (key crops at 300 dpi). The Drive OCR (read_file_content) was used only to log
disagreements (see NOTES). Formatting cannot be stored: underlines (the reference words), bold verbs in brackets, superscript «st».

Rules decided for English (pilot):
R1  verbatim_text = the printed instruction + its sub-items (letters kept, the question number moved to `number`); a printed line
    break between items = "\n"; items printed on one line keep one space; wrapped lines are joined with a space.
    Reading passage = one `text` document (paragraphs "\n"); the instruction «Read the text carefully…» and the source line are
    separate `text` documents («Instruction», «Source»). Charts and boxed matching lists printed on the paper = `table` documents
    copied cell by cell (dot leaders included). Gap-fill passages and verb-in-brackets passages = `text` documents.
R2  Underlined words cannot be shown: each reference-word step quotes the sentence that holds the underlined word (identified on
    the page image), so the student knows which «They»/«they» is meant.
R3  Elements: one element per item the key marks separately (T/F statement, sub-question, reference word, definition, chart cell,
    verb, combined sentence, N.B. line). Exception: when the original task is itself ONE ordering / gap-fill / matching and the
    engine's partial grading (share of positions / holes / pairs) gives exactly the key's per-item mark («0.25x4» order of
    ideas, «0.5x4» cloze, «0.5x3» matching), keep ONE element labelled with the key's m×n and ONE step of that type.
R4  Re-ordering whose key N.B. scores «0.5 for the opening sentence & 0.5 for each logical pair» (paper 2, B4): a position-graded
    `ordering` would mis-score partial answers, so one element per N.B. line: the opening sentence (mcq among the 4 sentences)
    and each consecutive pair (mcq «which sentence comes right after / right before …»).
R5  Binary items (T/F, Yes/No) = 2-option mcq. They are stored [False, True] / [No, Yes] (right option not first) on purpose:
    shuffle_exam_set.py always swaps two options, so every binary step is displayed True/False, Yes/No in the natural order
    and the position carries no information.
R6  Variants in the key: slashes / «or:» giving several forms of the SAME answer («The emperor / Sapa Inca», «extension /
    extent», «won’t / will not», the two word orders with «while») stay interactive: right option = one key form, the
    explanation lists every form, and no other accepted form may be a distractor (FORMS + assertion in _check()). A closed list
    of alternative answers (paper 2: A3b three justifications, A3c «mention two» of three items) also stays interactive: mcq
    with one listed alternative as the right option / multi with exactly two key items correct; the other key alternatives are
    left out of the options. essay_builder (deferred) only for written expression and «accept any…» answers (none in this key).
R7  Distractors are clearly wrong by the text or ungrammatical; anything a reasoned answer could defend is left out: paper 2 A2
    «§4» (teachers using technology for their own development), paper 1 B3 the simple past «conquered» after «After», paper 1
    A4b «the building engineers» (part of the nobles).
R8  Word-formation chart: one mcq per blank cell (0.25 each) = the key's form + 3 incorrect forms (non-words or other word
    classes); a cell never offers another cell's answer (no cross-step leak).
R9  Written expression: one original question for both topics (the candidate chooses one), one essay_builder step per criterion
    of the official grid (Relevance 1, Semantic coherence 1, Correct use of English 2, Excellence 1 = 5); spec holds both topics
    verbatim and the 80–120 word range; criterion labels = the key's wording («creativity» paper 1, «creating» paper 2).
R10 Explanations start with «Key: …» (the key's wording) plus, when useful, the sentence of the text that proves it; the
    explanation of a step never gives the answer of a later step of the same question.
R11 is_verbatim_original = true only where the prompt equals the question's verbatim_text (3 steps).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper 1 or 2 (argument or -p1/-p2 suffix)"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SET_ID = f"en-bac-2019-lit-p{PAPER}"
STREAMS = ["LIT"]
PAPER_ID = "1cu4MAj44Jw_q0hRg51NNagHbMP1BGbaA"
PAPER_TITLE = "2019 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
KEY_ID = "1cLYVJyFmuz_QhrHA9iPlp8MdYxFu_T_X"
KEY_TITLE = "2019 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الحل.pdf"

Q, S = [], []
FORMS = {}  # element id -> every form the key accepts (none of them may be offered as a distractor)


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
    st(sid, qid, eid, "mcq", prompt, {"options": [neg, pos]}, {"correct": 1 if truth else 0}, expl, pts, skill)


def essay(sid, qid, eid, crit, pts, spec, expl):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"Written expression — criterion: {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": crit}},
              "answer": {"type": "essay_builder", "spec": {"rubric": f"{crit}: {pts} pt{'s' if pts > 1 else ''} (official grid)"}},
              "explanation": expl, "points": pts, "skill_id": "en.writing", "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


def tf(sid, qid, eid, statement, truth, expl):
    binary(sid, qid, eid, f"True or false? “{statement}”", "True", "False", truth, expl, 0.5, "en.comprehension")


def writing(qid, crits, topics):
    spec = {"task": "Choose ONE of the following topics.", "topics": topics, "words": [80, 120]}
    grid = " – ".join(f"{c} {p}" for c, p in crits)
    for i, (crit, pts) in enumerate(crits, 1):
        essay(f"s-we{i}", qid, f"{qid}-e{i}", crit, pts, spec, f"Scored with the official grid: {grid} = 5 pts.")


PA = "Part one: Reading (15 points) – A/ Comprehension (07 points)"


# ═══════════════════════════════ Subject 1 «Inca Civilization» (pages 1–2) ═══════════════════════════════
def paper1():
    text = ("The Empire of the Incas flourished for only about 100 years, but it was one of the largest and richest ancient civilizations "
            "in the Americas. In the late 1430s, the Incas began to conquer neighbouring tribes and put them under their control. At the "
            "peak of the empire's power, its lands extended nearly 2.500 miles along the western coast of South America.\n"
            "Life in the Inca Empire was organized by social rank. The emperor, called the Sapa Inca, ruled over everyone and was obeyed "
            "without question. He was believed to be a living god. Next in importance were the nobles. They were the government officials, "
            "building engineers, and military leaders. The Sapa Inca and the nobles had many privileges. They lived in stone palaces, had "
            "more than one wife, wore beautiful jewelry, and dressed in coloured, silky clothes. Most of the common people were farmers "
            "who cultivated the land and raised livestock.\n"
            "Although travel was by foot, the Incas constructed roads and made rope bridges that crossed over rivers, linking the empire "
            "together. The Incas also excelled in the crafts of weaving, pottery, and metalworking. Many objects were made from gold, "
            "which they called \"sweat of the sun\".\n"
            "In the 1530s, the Spanish came to the empire in search of this gold. They conquered the Incas, destroyed their temples, and "
            "took their gold and silver wealth. The great empire vanished forever.")
    docs = [{"id": "d-instr", "kind": "text", "caption": "Instruction", "text": "Read the text carefully then do the following activities:"},
            {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Jan Meyer. (2006). 25 Non-Fiction Passages. U.S.A: Scholastic. P. 46"}]
    PB = "Part one: Reading (15 points) – B/ Text Exploration (08 points)"
    PW = "Part two: Written Expression (05 points)"
    dots = "………………."
    chart = [["", "Verb", "Noun", "Adjective"], ["Example:", "to civilize", "civilization", "civilized"],
             ["", dots, dots, "extended"], ["", "to conquer", dots, dots], ["", dots, "government", dots]]
    grammar = ("After the Spanish (conquer) the Inca Empire, they captured the Sapa Inca. It (be) the first step in a long campaign that "
               "(take) decades of fighting but ended in Spanish victory in 1572. The conquest of the Inca Empire (lead) to campaigns into "
               "present-day Chile and Colombia.")
    cloze = ("One of the major contributions of ancient Egypt to modern civilization is the art of writing. The …..(1)…… of writing are "
             "believed to have been …..(2)…….. by the ancient Egyptians in 3000 BC. The Egyptians were able to use pictures to…..(3)…….. "
             "what they were thinking or wanted to say. Eventually, they developed 24 alphabets which formed the …..(4)……. of their writing.")
    bank = "basis - started - ancient - life - express - origins"
    topic1 = ("Many students mistakenly believe that ancient civilizations made no contributions to modern societies. Use the following "
              "ideas to write an article of about 80 to 120 words, in which you explain and shed light on those contributions to your "
              "fellow students.")
    notes1 = ["-Developing systems of writing", "-Improving agriculture and irrigation", "-Inventing tools and making discoveries", "-Organizing social life"]
    topic2 = ("Counterfeiting has become a common practice among a large number of people despite its negative impacts on both the society "
              "and the national economy. Write a composition of about 80 to 120 words in which you state your opinion. Give examples.")

    q("q1", "1", PA, "Are the following statements true or false? Write T or F next to the letter corresponding to the statement.\n"
      "a. The Inca civilization lasted for almost a century.\nb. The Inca Empire had diverse social classes.\n"
      "c. The common people in the Inca Empire had many privileges.\nd. The Inca Empire lasted for centuries after the Spanish conquest.", 2,
      [el(f"q1-e{i}", f"Statement {x} (T/F)", 0.5) for i, x in enumerate("abcd", 1)], docs)
    q("q2", "2", PA, "Put the following ideas in the order they appear in the text:\na. The different classes of the Inca society.\n"
      "b. The fall of the Inca Empire.\nc. Inca's golden age.\nd. The remarkable skills of the Inca people.", 1,
      [el("q2-e1", "Order of ideas (0.25×4)", 1)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text:\n"
      "a. Did the Inca Empire succeed in controlling surrounding territories?\nb. Who was considered as a living god for the Inca people?\n"
      "c. How did the Spanish conquest cause the Inca Empire to fall?", 2.5,
      [el("q3-e1", "a. Controlling surrounding territories", 0.5), el("q3-e2", "b. The living god", 1), el("q3-e3", "c. How the empire fell", 1)], docs)
    q("q4", "4", PA, "WHO or WHAT do the underlined words refer to in the text?\na. its (§1) b. they (§2) c. their (§4)", 1.5,
      [el("q4-e1", "a. its (§1)", 0.5), el("q4-e2", "b. they (§2)", 0.5), el("q4-e3", "c. their (§4)", 0.5)], docs)
    q("q5", "1", PB, "Find words in the text whose definitions follow:\na. To take control of a country and its people by force. (§ 1)\n"
      "b. Special rights or advantages that one person or group has. (§ 2)\nc. Disappeared suddenly and completely. (§ 4)", 1.5,
      [el("q5-e1", "a. (§ 1)", 0.5), el("q5-e2", "b. (§ 2)", 0.5), el("q5-e3", "c. (§ 4)", 0.5)], docs)
    q("q6", "2", PB, "Complete the chart as shown in the example.", 1.5,
      [el("q6-e1", "Row «extended»: verb", 0.25), el("q6-e2", "Row «extended»: noun", 0.25), el("q6-e3", "Row «to conquer»: noun", 0.25),
       el("q6-e4", "Row «to conquer»: adjective", 0.25), el("q6-e5", "Row «government»: verb", 0.25), el("q6-e6", "Row «government»: adjective", 0.25)],
      [{"id": "d-chart", "kind": "table", "caption": "The chart", "table": chart}])
    q("q7", "3", PB, "Give the correct form of the verbs in brackets.", 3,
      [el(f"q7-e{i}", f"{i}. ({v})", 0.75) for i, v in enumerate(["conquer", "be", "take", "lead"], 1)],
      [{"id": "d-grammar", "kind": "text", "caption": "Passage", "text": grammar}])
    q("q8", "4", PB, "Fill in the blanks with only FOUR (4) words from the list given.", 2, [el("q8-e1", "Cloze passage (0.5×4)", 2)],
      [{"id": "d-bank", "kind": "text", "caption": "Word list", "text": bank}, {"id": "d-cloze", "kind": "text", "caption": "Passage", "text": cloze}])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1)]
    q("q9", "—", PW, "Choose ONE of the following topics:\nTopic one:\n" + topic1 + "\nThe following notes may help you:\n" + "\n".join(notes1)
      + "\nTopic two:\n" + topic2, 5, [el(f"q9-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A/ Comprehension ──
    tf("s01", "q1", "q1-e1", "The Inca civilization lasted for almost a century.", True,
       "Key: a – T. The Empire of the Incas “flourished for only about 100 years” (§1).")
    tf("s02", "q1", "q1-e2", "The Inca Empire had diverse social classes.", True,
       "Key: b – T. “Life in the Inca Empire was organized by social rank”: the emperor, the nobles and the common people (§2).")
    tf("s03", "q1", "q1-e3", "The common people in the Inca Empire had many privileges.", False,
       "Key: c – F. “The Sapa Inca and the nobles had many privileges”; most of the common people were farmers (§2).")
    tf("s04", "q1", "q1-e4", "The Inca Empire lasted for centuries after the Spanish conquest.", False,
       "Key: d – F. After the Spanish conquest “the great empire vanished forever” (§4).")
    st("s05", "q2", "q2-e1", "ordering", "Put the ideas in the order they appear in the text.",
       {"items": ["c. Inca's golden age.", "a. The different classes of the Inca society.", "d. The remarkable skills of the Inca people.", "b. The fall of the Inca Empire."]},
       {"order": [0, 1, 2, 3]}, "Key: 1 – c, 2 – a, 3 – d, 4 – b (0.25 for each idea in its place).", 1, "en.comprehension")
    FORMS["q3-e1"] = ["Yes, it did.", "yes"]
    binary("s06", "q3", "q3-e1", "Did the Inca Empire succeed in controlling surrounding territories?", "Yes, it did.", "No, it didn't.", True,
           "Key: “Yes, it did / yes.” In the late 1430s the Incas “began to conquer neighbouring tribes and put them under their control” (§1).", 0.5, "en.comprehension")
    FORMS["q3-e2"] = ["The emperor (the Sapa Inca)", "The emperor", "Sapa Inca", "the Sapa Inca"]
    mcq("s07", "q3", "q3-e2", "Who was considered as a living god for the Inca people?", "The emperor (the Sapa Inca)",
        ["The nobles", "The military leaders", "The Spanish"],
        "Key: “The emperor / Sapa Inca / the Sapa Inca”. “The emperor, called the Sapa Inca … was believed to be a living god” (§2).", 1, "en.comprehension")
    FORMS["q3-e3"] = ["By destroying their temples and taking their gold and silver wealth.", "The Spanish destroyed their temples and took their gold and silver wealth."]
    mcq("s08", "q3", "q3-e3", "How did the Spanish conquest cause the Inca Empire to fall?", "By destroying their temples and taking their gold and silver wealth.",
        ["By building roads and rope bridges across the empire.", "By teaching the Incas weaving, pottery and metalworking.",
         "By making the common people farmers who raised livestock."],
        "Key: “by destroying their temples and taking their gold and silver wealth” (or: “The Spanish destroyed their temples and took …”) — §4.", 1, "en.comprehension")
    mcq("s09", "q4", "q4-e1", "What does “its” refer to in “At the peak of the empire's power, its lands extended nearly 2.500 miles…” (§1)?",
        "the empire", ["the Americas", "the neighbouring tribes", "South America"], "Key: its (§1): the empire.", 0.5, "en.discourse")
    mcq("s10", "q4", "q4-e2", "What does “They” refer to in “They lived in stone palaces, had more than one wife…” (§2)?",
        "the Sapa Inca and the nobles", ["the common people", "the neighbouring tribes", "the Spanish"],
        "Key: they (§2): the Sapa Inca and the nobles — “The Sapa Inca and the nobles had many privileges. They lived in stone palaces…”.", 0.5, "en.discourse")
    mcq("s11", "q4", "q4-e3", "What does “their” refer to in “They conquered the Incas, destroyed their temples…” (§4)?",
        "the Incas", ["the Spanish", "the neighbouring tribes"], "Key: their (§4): the Incas.", 0.5, "en.discourse")
    # ── B/ Text Exploration ──
    mcq("s12", "q5", "q5-e1", "Find in §1 the word that means: “To take control of a country and its people by force.”", "conquer",
        ["flourished", "extended", "civilizations"], "Key: a. conquer — “the Incas began to conquer neighbouring tribes” (§1).", 0.5, "en.vocabulary")
    mcq("s13", "q5", "q5-e2", "Find in §2 the word that means: “Special rights or advantages that one person or group has.”", "privileges",
        ["rank", "officials", "livestock"], "Key: b. privileges — “The Sapa Inca and the nobles had many privileges” (§2).", 0.5, "en.vocabulary")
    mcq("s14", "q5", "q5-e3", "Find in §4 the word that means: “Disappeared suddenly and completely.”", "vanished",
        ["conquered", "destroyed", "came"], "Key: c. vanished — “The great empire vanished forever” (§4).", 0.5, "en.vocabulary")
    ex = "(Example: to civilize – civilization – civilized)"
    FORMS["q6-e2"] = ["extension", "extent"]
    FORMS["q6-e3"] = ["conquest", "conqueror"]
    FORMS["q6-e4"] = ["conquered", "conquerable"]
    FORMS["q6-e6"] = ["governmental", "governing", "governed", "governable"]
    mcq("s15", "q6", "q6-e1", f"Complete the chart {ex}: which verb goes with the adjective “extended”?", "to extend",
        ["to extension", "to extense", "to extensive"], "Key: verb → to extend.", 0.25, "en.vocabulary")
    mcq("s16", "q6", "q6-e2", f"Complete the chart {ex}: which noun goes with the adjective “extended”?", "extension",
        ["extensive", "extendment", "extendation"], "Key: noun → extension / extent (both accepted).", 0.25, "en.vocabulary")
    mcq("s17", "q6", "q6-e3", f"Complete the chart {ex}: which noun goes with the verb “to conquer”?", "conquest",
        ["conquerment", "conquerance", "conquerous"], "Key: noun → conquest / conqueror (both accepted).", 0.25, "en.vocabulary")
    mcq("s18", "q6", "q6-e4", f"Complete the chart {ex}: which adjective goes with the verb “to conquer”?", "conquered",
        ["conquerful", "conquerish", "conquestive"], "Key: adjective → conquered / conquerable (both accepted).", 0.25, "en.vocabulary")
    mcq("s19", "q6", "q6-e5", f"Complete the chart {ex}: which verb goes with the noun “government”?", "to govern",
        ["to government", "to governate", "to governance"], "Key: verb → to govern.", 0.25, "en.vocabulary")
    mcq("s20", "q6", "q6-e6", f"Complete the chart {ex}: which adjective goes with the noun “government”?", "governmental",
        ["governor", "governance", "governmently"], "Key: adjective → governmental (also accepted: governing / governed / governable).", 0.25, "en.vocabulary")
    for sid, eid, ctx, right, wrongs, full in [
        ("s21", "q7-e1", "After the Spanish (conquer) the Inca Empire, they captured the Sapa Inca.", "had conquered",
         ["have conquered", "conquers", "will conquer"], "After the Spanish had conquered the Inca Empire, they captured the Sapa Inca."),
        ("s22", "q7-e2", "It (be) the first step in a long campaign…", "was", ["were", "been", "is being"], "It was the first step in a long campaign…"),
        ("s23", "q7-e3", "…a long campaign that (take) decades of fighting but ended in Spanish victory in 1572.", "took",
         ["takes", "taken", "will take"], "…a long campaign that took decades of fighting but ended in Spanish victory in 1572."),
        ("s24", "q7-e4", "The conquest of the Inca Empire (lead) to campaigns into present-day Chile and Colombia.", "led",
         ["leaded", "lead", "leading"], "The conquest of the Inca Empire led to campaigns into present-day Chile and Colombia.")]:
        mcq(sid, "q7", eid, f"Give the correct form of the verb in brackets: “{ctx}”", right, wrongs, f"Key: {right} — “{full}”", 0.75, "en.grammar")
    st("s25", "q8", "q8-e1", "fill_blank", "Fill in the blanks with only FOUR (4) words from the list given.",
       {"text": ("One of the major contributions of ancient Egypt to modern civilization is the art of writing. The (1) ____ of writing are "
                 "believed to have been (2) ____ by the ancient Egyptians in 3000 BC. The Egyptians were able to use pictures to (3) ____ "
                 "what they were thinking or wanted to say. Eventually, they developed 24 alphabets which formed the (4) ____ of their writing."),
        "bank": ["basis", "started", "ancient", "life", "express", "origins"]},
       {"blanks": [["origins"], ["started"], ["express"], ["basis"]]}, "Key: 1. origins – 2. started – 3. express – 4. basis (0.5 each).", 2,
       "en.vocabulary", verbatim=True)
    writing("q9", crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}])
    return "Inca Civilization", "الموضوع الأوّل"


# ═══════════════════════════════ Subject 2 «Education» (pages 3–4) ═══════════════════════════════
def paper2():
    text = ("Improving education is a huge issue. Test scores, our perceived performance against other countries, and other factors have "
            "pushed education to the forefront of national politics, right behind healthcare reform. Technology can be used to improve "
            "teaching and learning and help our students be successful. It can be a “force multiplier” for the teacher. Instead of the "
            "teacher being the only source of help in a classroom, students can access online tutorials, and more to assist them.\n"
            "Education doesn’t stop at the end of the school day because students have access to teachers and resources, at any time. "
            "Students can also get help and tutoring at any time, whether from the teachers via email or online collaboration. They can "
            "connect with students at other schools and do collaborative work with them.\n"
            "Parental involvement is another factor that can increase students’ achievement. Thanks to technology, parents can go to a "
            "class website and see what their child is working on, they can contact teachers via email and web sites, and they can even "
            "check their child’s attendance and grades through online systems.\n"
            "Teachers can use technology to find resources and attend virtual professional development seminars and conferences. They can "
            "also create personal learning networks and other resources to find and share ideas and resources, and get support from their "
            "colleagues.")
    docs = [{"id": "d-instr", "kind": "text", "caption": "Instruction", "text": "Read the text carefully then do the following activities:"},
            {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from: “How Technology Can Help Improve Education”\nby : Ragan Whiteside. October 21st ,2011."}]
    PB = "Part one: Reading (15 points) – B/ TEXT EXPLORATION (08 points)"
    PW = "Part Two: Written Expression (05 points)"
    dots = "………………"
    chart = [["", "Verb", "Noun", "Adjective"], ["Example", "to educate", "education", "educative"],
             ["", dots, "achievement", dots], ["", "to access", dots, dots], ["", dots, dots, "successful"]]
    match_box = [["1. Grades", "a) The act of working with someone to create or produce something."],
                 ["2. Tutorials", "b) Marks given in an exam or for a piece of school work."],
                 ["3. Collaboration", "c) Formal teaching that consists of lectures or practicals."]]
    topic1 = ("Traditional learning doesn’t offer many opportunities for the learners to develop their skills whereas technology can be of "
              "great help. Use the following notes to write a composition of about 80 to 120 words to be published in your school magazine "
              "about the benefits of using technology in learning.")
    notes1 = ["-Improve engagement and raise motivation", "-Encourage individual learning", "-Foster collaboration", "-Facilitate knowledge retention"]
    topic2 = ("In your city, statistics show that violence against children is on the rise. As a member of an association that defends the "
              "rights of children, write a newspaper article of about 80 to 120 words for your fellow citizens in which you suggest some "
              "actions to reduce this phenomenon.")
    sent = {"a": "a- It gives teachers and students extra resources", "b": "b- and work together to get additional knowledge.",
            "c": "c- to access to new opportunities for learning approaches", "d": "d- Technology is a powerful tool for education."}

    q("q1", "1", PA, "Write the letter that corresponds to the right answer.\nA- Technology is a means which …..\n"
      "a- helps learning only b- improves healthcare c- serves teachers and learners\nB- Involving parents in their children’s education…..\n"
      "a- increases their school performance b- improves their behaviour c- hinders their success", 1,
      [el("q1-e1", "A", 0.5), el("q1-e2", "B", 0.5)], docs)
    q("q2", "2", PA, "In which paragraph is it mentioned that technology enhances teaching?", 1, [el("q2-e1", "The paragraph", 1)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text:\na. Why is education a priority?\n"
      "b. Is the teacher the only source of help? Why or why not?\nc. How can technology help parents control their kids? Mention two items.", 3,
      [el("q3-e1", "a. Why education is a priority", 1), el("q3-e2", "b. The only source of help?", 1), el("q3-e3", "c. Two items", 1)], docs)
    q("q4", "4", PA, "WHO or WHAT do the underlined words refer to in the text?\na) It (§1) b) They (§2) c) they (§3)", 1.5,
      [el("q4-e1", "a) It (§1)", 0.5), el("q4-e2", "b) They (§2)", 0.5), el("q4-e3", "c) they (§3)", 0.5)], docs)
    q("q5", "5", PA, "The text is ……\na) descriptive b) narrative c) argumentative", 0.5, [el("q5-e1", "Type of text", 0.5)], docs)
    q("q6", "1", PB, "Match the following words with their corresponding definitions:", 1.5, [el("q6-e1", "Words and definitions (0.5×3)", 1.5)],
      [{"id": "d-match", "kind": "table", "caption": "Words and definitions", "table": match_box}])
    q("q7", "2", PB, "Complete the chart as shown in the example.", 1.5,
      [el("q7-e1", "Row «achievement»: verb", 0.25), el("q7-e2", "Row «achievement»: adjective", 0.25), el("q7-e3", "Row «to access»: noun", 0.25),
       el("q7-e4", "Row «to access»: adjective", 0.25), el("q7-e5", "Row «successful»: verb", 0.25), el("q7-e6", "Row «successful»: noun", 0.25)],
      [{"id": "d-chart", "kind": "table", "caption": "The chart", "table": chart}])
    q("q8", "3", PB, "Combine each pair of sentences with the connectors given between brackets. Make changes where necessary.\n"
      "a- Some parents have busy schedules. They can’t help their child with homework. (such …that)\n"
      "b- Students have access to technology. Their test scores improve. (unless)\n"
      "c- The teacher provides help in the classroom. Technology assists learning at any time. (while)", 3,
      [el("q8-e1", "a- (such …that)", 1), el("q8-e2", "b- (unless)", 1), el("q8-e3", "c- (while)", 1)], [])
    q("q9", "4", PB, "Reorder the following sentences to get a coherent passage.\n" + "\n".join(sent[k] for k in "abcd"), 2,
      [el("q9-e1", "Opening sentence", 0.5), el("q9-e2", "Logical pair 1", 0.5), el("q9-e3", "Logical pair 2", 0.5), el("q9-e4", "Logical pair 3", 0.5)], [])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creating)", 1)]
    q("q10", "—", PW, "Choose ONE of the following topics:\nTopic One:\n" + topic1 + "\nThe following notes may help you:\n" + "\n".join(notes1)
      + "\nTopic Two:\n" + topic2, 5, [el(f"q10-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A) Comprehension ──
    mcq("s01", "q1", "q1-e1", "Choose the right answer: “Technology is a means which …..”", "serves teachers and learners",
        ["helps learning only", "improves healthcare"],
        "Key: A → c. “Technology can be used to improve teaching and learning” (§1).", 0.5, "en.comprehension")
    mcq("s02", "q1", "q1-e2", "Choose the right answer: “Involving parents in their children’s education…..”", "increases their school performance",
        ["improves their behaviour", "hinders their success"],
        "Key: B → a. “Parental involvement is another factor that can increase students’ achievement” (§3).", 0.5, "en.comprehension")
    mcq("s03", "q2", "q2-e1", "In which paragraph is it mentioned that technology enhances teaching?", "§1", ["§2", "§3"],
        "Key: §1 — “Technology can be used to improve teaching and learning…”.", 1, "en.comprehension", verbatim=True)
    mcq("s04", "q3", "q3-e1", "Why is education a priority?", "Because of test scores, our perceived performances against other countries and other factors.",
        ["Because healthcare reform is no longer a national issue.", "Because teachers are the only source of help in a classroom.",
         "Because students cannot work with students at other schools."],
        "Key: “Because of test scores, our perceived performances against other countries and other factors.” (§1)", 1, "en.comprehension")
    FORMS["q3-e2"] = ["No, he is not. Students can access online tutorials, and more to assist them.",
                      "No, he is not. Students can also get help and tutoring at any time, whether from the teachers via email or online collaboration.",
                      "No, he is not. They can connect with students at other schools and do collaborative work with them."]
    mcq("s05", "q3", "q3-e2", "Is the teacher the only source of help? Why or why not?",
        "No, he is not. Students can access online tutorials, and more to assist them.",
        ["Yes, he is. Students can only get help from the teacher during the school day.",
         "Yes, he is. Technology cannot assist students outside the classroom.",
         "No, he is not. Parents now give all the lessons at home."],
        "Key: “No / No, he is not / She is not.” + one reason: “Students can access online tutorials, and more to assist them.” Or: “Students can "
        "also get help and tutoring at any time, whether from the teachers via email or online collaboration.” Or: “They can connect with students "
        "at other schools and do collaborative work with them.”", 1, "en.comprehension")
    FORMS["q3-e3"] = ["Parents can go to a class website and see what their child is working on.", "They can contact teachers via email and web sites.",
                      "They can check their child’s attendance and grades through online systems."]
    st("s06", "q3", "q3-e3", "multi", "How can technology help parents control their kids? Choose the TWO items mentioned in the text.",
       {"options": ["They can contact teachers via email and web sites.", "They can check their child’s attendance and grades through online systems.",
                    "They can attend virtual professional development seminars and conferences.",
                    "They can create personal learning networks to share ideas with their colleagues."]},
       {"correct": [0, 1]},
       "Key (any two): “Parents can go to a class website and see what their child is working on.” – “They can contact teachers via email and web "
       "sites.” – “They can check their child’s attendance and grades through online systems.” (§3). Seminars and learning networks are for teachers (§4).",
       1, "en.comprehension")
    mcq("s07", "q4", "q4-e1", "What does “It” refer to in “It can be a “force multiplier” for the teacher.” (§1)?", "technology",
        ["education", "healthcare reform", "the teacher"], "Key: a) It (§1): technology.", 0.5, "en.discourse")
    mcq("s08", "q4", "q4-e2", "What does “They” refer to in “They can connect with students at other schools and do collaborative work with them.” (§2)?",
        "students", ["teachers", "resources", "other schools"], "Key: b) They (§2): students.", 0.5, "en.discourse")
    mcq("s09", "q4", "q4-e3", "What does “they” refer to in “…and they can even check their child’s attendance and grades through online systems.” (§3)?",
        "parents", ["teachers", "students", "online systems"], "Key: c) they (§3): parents.", 0.5, "en.discourse")
    mcq("s10", "q5", "q5-e1", "The text is ……", "argumentative", ["descriptive", "narrative"], "Key: c) argumentative.", 0.5, "en.discourse")
    # ── B) Text Exploration ──
    st("s11", "q6", "q6-e1", "matching", "Match the following words with their corresponding definitions:",
       {"lefts": ["Grades", "Tutorials", "Collaboration"],
        "rights": ["Marks given in an exam or for a piece of school work.", "Formal teaching that consists of lectures or practicals.",
                   "The act of working with someone to create or produce something."]},
       {"pairs": [0, 1, 2]},
       "Key: 1 → b, 2 → c, 3 → a. Grades: marks given in an exam or for a piece of school work. Tutorials: formal teaching that consists of "
       "lectures or practicals. Collaboration: the act of working with someone to create or produce something.", 1.5, "en.vocabulary", verbatim=True)
    ex = "(Example: to educate – education – educative)"
    FORMS["q7-e2"] = ["achievable", "achieved"]
    FORMS["q7-e3"] = ["access", "accessibility", "accessor"]
    FORMS["q7-e6"] = ["success", "successfulness"]
    mcq("s12", "q7", "q7-e1", f"Complete the chart {ex}: which verb goes with the noun “achievement”?", "to achieve",
        ["to achievement", "to achievable", "to achieving"], "Key: verb → to achieve.", 0.25, "en.vocabulary")
    mcq("s13", "q7", "q7-e2", f"Complete the chart {ex}: which adjective goes with the noun “achievement”?", "achievable",
        ["achievous", "achieveful", "achievely"], "Key: adjective → achievable / achieved (both accepted).", 0.25, "en.vocabulary")
    mcq("s14", "q7", "q7-e3", f"Complete the chart {ex}: which noun goes with the verb “to access”?", "accessibility",
        ["accessment", "accessive", "accessful"], "Key: noun → access / accessibility / accessor (all accepted).", 0.25, "en.vocabulary")
    mcq("s15", "q7", "q7-e4", f"Complete the chart {ex}: which adjective goes with the verb “to access”?", "accessible",
        ["accessibly", "accessant", "accessous"], "Key: adjective → accessible.", 0.25, "en.vocabulary")
    mcq("s16", "q7", "q7-e5", f"Complete the chart {ex}: which verb goes with the adjective “successful”?", "to succeed",
        ["to success", "to successful", "to succede"], "Key: verb → to succeed.", 0.25, "en.vocabulary")
    mcq("s17", "q7", "q7-e6", f"Complete the chart {ex}: which noun goes with the adjective “successful”?", "success",
        ["successive", "succeedment", "successly"], "Key: noun → success / successfulness (both accepted).", 0.25, "en.vocabulary")
    FORMS["q8-e2"] = ["Unless students have access to technology, their test scores won’t improve.",
                      "Unless students have access to technology, their test scores will not improve."]
    FORMS["q8-e3"] = ["The teacher provides help in the classroom while technology assists learning at any time.",
                      "While the teacher provides help in the classroom, technology assists learning at any time."]
    mcq("s18", "q8", "q8-e1", "Combine with (such …that): “Some parents have busy schedules. They can’t help their child with homework.”",
        "Some parents have such busy schedules that they can’t help their child with homework.",
        ["Some parents have so busy schedules that they can’t help their child with homework.",
         "Some parents have such busy schedules than they can’t help their child with homework.",
         "Some parents have such a busy schedules that they can’t help their child with homework."],
        "Key: “Some parents have such busy schedules that they can’t help their child with homework.”", 1, "en.grammar")
    mcq("s19", "q8", "q8-e2", "Combine with (unless): “Students have access to technology. Their test scores improve.”",
        "Unless students have access to technology, their test scores won’t improve.",
        ["Unless students have access to technology, their test scores will improve.",
         "Unless students don’t have access to technology, their test scores won’t improve.",
         "Unless students had access to technology, their test scores won’t improve."],
        "Key: “Unless students have access to technology, their test scores won’t / will not improve.”", 1, "en.grammar")
    mcq("s20", "q8", "q8-e3", "Combine with (while): “The teacher provides help in the classroom. Technology assists learning at any time.”",
        "The teacher provides help in the classroom while technology assists learning at any time.",
        ["The teacher provides help in the classroom while technology assist learning at any time.",
         "While the teacher provides help in the classroom, while technology assists learning at any time.",
         "The teacher while provides help in the classroom technology assists learning at any time."],
        "Key: “The teacher provides help in the classroom while technology assists learning at any time.” or: “While the teacher provides help "
        "in the classroom, technology assists learning at any time.”", 1, "en.grammar")
    mcq("s21", "q9", "q9-e1", "Reorder the sentences: which sentence opens the passage?", sent["d"], [sent["a"], sent["b"], sent["c"]],
        f"Key: the passage opens with “{sent['d']}” (0.5 for the opening sentence).", 0.5, "en.discourse")
    mcq("s22", "q9", "q9-e2", f"Reorder the sentences: which sentence comes right after “{sent['d']}”?", sent["a"], [sent["b"], sent["c"]],
        f"Key: “{sent['d']}” is followed by “{sent['a']}” (0.5 for each logical pair).", 0.5, "en.discourse")
    mcq("s23", "q9", "q9-e3", f"Reorder the sentences: which sentence comes right after “{sent['a']}”?", sent["c"], [sent["b"], sent["d"]],
        f"Key: “{sent['a']}” is followed by “{sent['c']}” (0.5 for each logical pair).", 0.5, "en.discourse")
    mcq("s24", "q9", "q9-e4", f"Reorder the sentences: which sentence comes right before “{sent['b']}”?", sent["c"], [sent["a"], sent["d"]],
        f"Key: “{sent['c']}” is followed by “{sent['b']}” (0.5 for each logical pair). Full order: d – a – c – b.", 0.5, "en.discourse")
    writing("q10", crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}])
    return "Education", "الموضوع الثّاني"


TOPIC, PAPER_AR = (paper1 if PAPER == 1 else paper2)()

TITLE = f"بكالوريا 2019 (الدّورة العاديّة) – اللّغة الإنجليزيّة – شعبة آداب وفلسفة – {PAPER_AR} ({TOPIC})"
COMMON_NOTES = (
    "موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، الشّعبة: آداب وفلسفة، المدّة: 02 سا و30 د) "
    f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، 4 صفحات: الموضوع الأوّل ص1–2، الثّاني ص3–4)؛ «الدّورة العاديّة» من اسم الملفّ "
    "(الورقة تكتب «دورة: 2019» فقط). الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: "
    f"gdrive:{KEY_ID} (ص1 «Inca Civilization»، ص2 «Education»). "
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّ PDF رقميّ له طبقة نصّ أصليّة، فأُخذت الحروف منها (علامات الاقتباس المنحنية، "
    "«…»، «§»، نقاط الجدول) وطوبقت سطرًا سطرًا مع صور الصّفحات (150 نقطة، ومقاطع من الحلّ بـ300 نقطة). "
    "خلاف OCR (read_file_content) والصّورة: المدّة «20» في OCR و«30 د» في الصّورة؛ ترقيم الصّفحتين 2 و3 «0 من 4» في OCR؛ خلايا الجداول "
    "(جدول الاشتقاق وجدول المطابقة) مختلطة الأسطر في OCR وصُحّحت من الصّورة؛ التّسطير والخطّ الغامق والأسّ «st» لا يظهر في OCR؛ في الحلّ OCR "
    "«its t(§1) : mpireehe» و«:ro» وصوابهما في الصّورة «its (§1) : the empire» و«or:»، وأعمدة الجداول وعلامات «مجزأة» منفصلة عن أسطرها. "
    "التّسطير لا يُحفظ في النّصّ: الكلمات المسطّرة حُدّدت من الصّورة وتذكر كلّ خطوة الجملة الّتي فيها الكلمة. "
    "قرارات التّحويل (R1–R11 في رأس المحوّل): عنصر لكلّ بند يُنقَّط منفردًا؛ الأسئلة الثّنائيّة (صح/خطأ، نعم/لا) اختيار من خيارين؛ صيغ الحلّ "
    "المتعدّدة للإجابة نفسها تبقى تفاعليّة ولا تُعرض صيغة مقبولة مشتّتًا؛ التّعبير الكتابيّ مؤجَّل (essay_builder) بمعايير الشّبكة الرّسميّة "
    "(الملاءمة 1، الانسجام الدّلاليّ 1، سلامة اللّغة 2، الإتقان 1). ")
PAPER_NOTES = {
    1: ("الموضوع الأوّل: المسطَّر في النّصّ its (§1 «its lands extended»)، They (§2 «They lived in stone palaces»)، their (§4 «destroyed their "
        "temples»)؛ السّؤال يكتب «they (§2)» بحرف صغير والنّصّ «They». ترتيب الأفكار (0.25×4) وملء الفراغات (0.5×4) خطوة واحدة لكلّ منهما لأنّ "
        "التّنقيط الجزئيّ للمحرّك (لكلّ موضع/فراغ) يطابق السّلّم. جدول الاشتقاق: اختيار من متعدّد لكلّ خانة (0.25)، والصّيغ المقبولة كلّها في الشّرح "
        "(extension / extent، conquest / conqueror، conquered / conquerable، governmental / governing / governed / governable). القواعد: لم يُعرض "
        "«conquered» مشتّتًا بعد «After» لأنّه قابل للدّفاع. المجموع 20 = 7 + 8 + 5 (تفاعليّ 15، مؤجَّل 5)."),
    2: ("الموضوع الثّاني: المسطَّر It (§1 «It can be a “force multiplier”»)، They (§2 «They can connect with students»)، they (§3 «and they can even "
        "check»). س2: لم تُعرض «§4» مشتّتًا (المعلّمون يستعملون التّكنولوجيا لتطوير أنفسهم: قابل للدّفاع)، فالخيارات §1 §2 §3. س3أ: الخيار الصّحيح "
        "بلفظ الحلّ «performances» (النّصّ «performance»). س3ب: الحلّ يقبل ثلاثة تعليلات؛ عُرض أوّلها صحيحًا ولم يُعرض الآخران. س3ج: الحلّ يقبل "
        "عنصرين من ثلاثة؛ عُرض اثنان صحيحان مع مشتّتين من الفقرة 4 (للمعلّمين). المطابقة (0.5×3) خطوة مطابقة واحدة. إعادة التّرتيب: N.B. «0.5 للجملة "
        "الافتتاحيّة و0.5 لكلّ زوج منطقيّ» فقُسّمت إلى أربعة عناصر (الافتتاحيّة + الأزواج d–a، a–c، c–b) لأنّ تنقيط ordering بالمواضع يخالف السّلّم. "
        "الشّبكة في الحلّ تكتب «Excellence (vocabulary and creating)» (الموضوع الأوّل: creativity) فنُقلت كما هي. المجموع 20 = 7 + 8 + 5 "
        "(تفاعليّ 15، مؤجَّل 5)."),
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
    assert set(FORMS) <= set(els), "FORMS for an unknown element"
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
            assert not binary_step or s["source_question_id"] in ("q1", "q3") and PAPER == 1, (s["id"], "2 options only for T/F and Yes/No (R5)")
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
            assert len(set(bank)) == len(bank) and len(bank) > len(a["blanks"]), (s["id"], "bank duplicates / no distractor")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2 and len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:  # rule 12: no answer in a caption unless printed on the paper
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps) and nk not in paper), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert abs(sum(s["points"] for s in S if s["type"] == "essay_builder") - 5) < 1e-9, "written expression = 5"
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
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "EN", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T20:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
      sum(s["points"] for s in S if s["type"] != "essay_builder"), "interactive +", sum(s["points"] for s in S if s["type"] == "essay_builder"), "deferred")
