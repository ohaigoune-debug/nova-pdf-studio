"""Conversion: BAC 2026 (normal session) – English – scientific streams «علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد، فنون»
(SCI, MATH, TM, GE) – Subject 1 «Scientists have illuminated the effects…» (paper 1) and Subject 2 «Space developments…» (paper 2).
Follows the English pilot (build_en_bac_2019_lit.py, rules R1–R11), CONVERSION_GUIDE.md Appendix A and the decisions D1–D7 written in
build_en_bac_2026_lang.py (same 2026 batch).

Usage:  python3 scripts/play/converters/build_en_bac_2026_sci.py <out.json> [1|2]
        (the paper defaults to the -p1/-p2 suffix of <out.json>), then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- paper  gdrive 1MILoreEdmPjXdq6eR32TNYU3vEFFZ6ww «2026 - اللغة الإنجليزية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة
  العادية - الموضوع.pdf» (ONEC, 4 pages: subject 1 = pages 1–2, subject 2 = pages 3–4). Header: «الدورة: 2026»، «الشعبة: علوم تجريبية،
  رياضيات، تقني رياضي، تسيير واقتصاد، فنون»، «المدة: 02 سا و30 د». Reading 15 (A/ 08 + B/ 07) + Written Expression 05.
- key    gdrive 1MQeD_b-6oWSLlhcCXGHCJVSs3ilPI_E1 «… - الحل.pdf» (ONEC «الإجابة النموذجية», page 1 = subject 1 «Scientists have illuminated
  the effects …», page 2 = subject 2 «Space developments …»), with the official marks («مجموعة / مجزأة»). Both keys total 20.

Streams: the header lists the four scientific/GE streams AND «فنون» (arts); PLAY has no stream code for arts (constants.ts PLAY_STREAMS),
so `streams` = ["SCI","MATH","TM","GE"] and the arts stream is recorded in `notes` only.

How the text was read: both PDFs are DIGITAL (text layer). Verbatim strings from `pdftotext -raw` (U+202B/U+202C stripped), checked
line by line against the 150-dpi page images and by script (every verbatim string and every quotation in a prompt is a substring of the
text layer). The notes' bullets are a Symbol-font glyph that the text layer gives as U+F0B7 (private use) — written «•» (U+2022).
Underlines (They §2, It §3, the parts of B3 in subject 2) only show on the images.

Decisions beyond the pilot (see also D1–D7 in build_en_bac_2026_lang.py):
D2  «Yes/No + Justify» = binary element + justification element with the key's split (subject 1: 0.25 + 0.75; subject 2: 0.5 + 1). The
    key lists three justifications for subject 1 A3a (closed list): the right option is the first one (the text sentence the key's
    «…» abbreviates), the other two are in FORMS and never offered; distractors are statements contradicted by the text.
D4  Morphology: one mcq per word (0.5): «Divide …» = the key's row (prefix | root | suffix) vs impossible splits; «opposites» = the key's
    form vs non-words with other negative prefixes.
D5  Re-ordering «b - d - c - a» (opening 0.5 + three logical pairs 0.5) split as in pilot R4.
D8  Gap filling of subject 2 (B4): the paper's list has exactly the four answers («understanding - provide - processes - local») — the
    bank is the paper's list unchanged (no invented distractor), so `_check()` allows a bank without an extra word for this step only.
D9  Subject 2 A2a: the key accepts «§ 4 (Accept the last paragraph)» (same answer) → right option «§4»; A2b: «§2» (the satellites' data
    feeding the IPCC report) is left out of the options as defensible (R7).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper 1 or 2 (argument or -p1/-p2 suffix)"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SET_ID = f"en-bac-2026-sci-p{PAPER}"
STREAMS = ["SCI", "MATH", "TM", "GE"]
PAPER_ID = "1MILoreEdmPjXdq6eR32TNYU3vEFFZ6ww"
PAPER_TITLE = "2026 - اللغة الإنجليزية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة العادية - الموضوع.pdf"
KEY_ID = "1MQeD_b-6oWSLlhcCXGHCJVSs3ilPI_E1"
KEY_TITLE = "2026 - اللغة الإنجليزية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة العادية - الحل.pdf"
WE_POINTS = 5  # written expression on this paper (key grid «Common streams»)

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


PA = "Part One: Reading (15 points) – A/ Comprehension (08 points)"
PB = "Part One: Reading (15 points) – B/ Text Exploration (07 points)"
PW = "Part Two: Written Expression (05 points)"
INSTR = {"id": "d-instr", "kind": "text", "caption": "Instruction", "text": "Read the text carefully to do the activities."}
WE_TASK = "Choose only ONE of the following topics."


# ═══════════════════════════════ Subject 1 «Scientists have illuminated the effects…» (pages 1–2) ═══════════════════════════════
def paper1():
    text = ("Scientists have illuminated the effects our diet has on our mental health. Researchers say what we eat affects and alters our "
            "brain chemistry up to the age of 30. They say this explains why older adults are more emotionally stable and resilient than "
            "under-30s.\n"
            "Researchers said that while the link between our diet and diabetes, heart disease and obesity is well established, there is a "
            "lack of research on the influence our dietary intake has on mental health. They also suggested that mental well-being stimulated "
            "healthy eating, healthy practices, and exercising.\n"
            "A team of researchers led by Professor Lina Begdache found that adults under 30 who ate fast food more than three times a week "
            "scored higher levels of anxiety and depression. Begdache said that for adults over 30, the study found that eating less "
            "carbohydrate and more fruit reduced anxiety and depression. She also pointed to research showing how a Mediterranean diet was as "
            "good for our brain as for our body. She said, “It has all the components that are important for the healthy structure of the brain.”")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from https://breakingnewsenglish.com"}]
    topic1 = ("Your best friend suffers from mental distress. His psychiatrist told him that his situation was due to eating junk food regularly. "
              "Write an article of about 80 to 120 words for your local newspaper to sensitize young people on the dangers of junk food on their "
              "mental health.")
    notes1 = ["• More carbohydrates / brain / damage", "• unhealthy intake / bad mood", "• Poor nutrition / lead / stress"]
    topic2 = ("During the G20 summit (the 20 most influential economies in the world), you were given the opportunity to address the leaders of "
              "the world. Write a speech of about 80 to 120 words you will deliver at the summit to urge the participants to spend more money to "
              "solve the problems of pollution and poverty around the world instead of spending it on space exploration.")
    sent = {"a": "a. For others, they might prefer a more structured programme in a health club.", "b": "b. Whether people are young or old,",
            "c": "c. For some, they could use their cars less and walk more.", "d": "d. they can improve their health by being more active each day."}

    q("q1", "1", PA, "Say whether the following statements are true or false.\na. There is a close relationship between food consumption and mental health.\n"
      "b. No physical illness is linked to diet.\nc. Enough research has been carried out on the effects of diet on mental health.\n"
      "d. Anxiety and depression are highly connected to excessive junk food consumption.", 2,
      [el(f"q1-e{i}", f"Statement {x} (T/F)", 0.5) for i, x in enumerate("abcd", 1)], docs)
    q("q2", "2", PA, "Identify the paragraphs in which the following ideas are mentioned.\n"
      "a. Some types of food alleviate the feeling of unhappiness among the middle-aged.\nb. Mental health boosts healthy physical practices.", 2,
      [el("q2-e1", "a. Paragraph of idea a", 1), el("q2-e2", "b. Paragraph of idea b", 1)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text.\na. Is there any link between diet and mental health? Justify.\n"
      "b. Why do adults over 30 enjoy a good mental well-being?\nc. What makes the Mediterranean diet fit to the brain?", 3,
      [el("q3-e1", "a. Yes/No answer", 0.25), el("q3-e2", "a. Justification", 0.75), el("q3-e3", "b. Adults over 30", 1),
       el("q3-e4", "c. The Mediterranean diet", 1)], docs)
    q("q4", "4", PA, "Find what or who the underlined words in the text refer to.\na. They (§2): ………….. b. It (§3): ……………..", 1,
      [el("q4-e1", "a. They (§2)", 0.5), el("q4-e2", "b. It (§3)", 0.5)], docs)
    q("q5", "1", PB, "Find words in the text whose definitions follow:\na. The food and drink you take regularly (§1): ………………………….\n"
      "b. General health and happiness (§2): ……………………………..…….\nc. A feeling of great worry (§3): ………………….", 1.5,
      [el("q5-e1", "a. (§1)", 0.5), el("q5-e2", "b. (§2)", 0.5), el("q5-e3", "c. (§3)", 0.5)], docs)
    q("q6", "2", PB, "Divide the following words into root and affixes.\nresearcher - eating - intake", 1.5,
      [el("q6-e1", "researcher", 0.5), el("q6-e2", "eating", 0.5), el("q6-e3", "intake", 0.5)],
      [{"id": "d-table", "kind": "table", "caption": "Table", "table": [["Prefix", "Root", "Suffix"], ["", "", ""]]}])
    q("q7", "3", PB, "Combine each pair of sentences with the connectors given between brackets. Make changes where necessary.\n"
      "a. You enjoy a better mental health. You eat less junk food. (provided that)\n"
      "b. The Mediterranean diet is beneficial for mental health. Psychiatrists suggest the Mediterranean diet to their patients. (so … that…)", 2,
      [el("q7-e1", "a. (provided that)", 1), el("q7-e2", "b. (so … that…)", 1)], [])
    q("q8", "4", PB, "Reorder the following sentences to get a coherent passage.\n" + "\n".join(sent[k] for k in "abcd"), 2,
      [el("q8-e1", "Opening sentence", 0.5), el("q8-e2", "Logical pair 1", 0.5), el("q8-e3", "Logical pair 2", 0.5), el("q8-e4", "Logical pair 3", 0.5)], [])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1)]
    q("q9", "—", PW, WE_TASK + "\nTopic One:\n" + topic1 + "\nMake the best use of the following notes:\n" + "\n".join(notes1)
      + "\nTopic Two:\n" + topic2, WE_POINTS, [el(f"q9-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A. Comprehension ──
    tf("s01", "q1", "q1-e1", "There is a close relationship between food consumption and mental health.", True,
       "Key: a. T. “a Mediterranean diet was as good for our brain as for our body”.")
    tf("s02", "q1", "q1-e2", "No physical illness is linked to diet.", False,
       "Key: b. F. “the link between our diet and diabetes, heart disease and obesity is well established”.")
    tf("s03", "q1", "q1-e3", "Enough research has been carried out on the effects of diet on mental health.", False,
       "Key: c. F. “there is a lack of research on the influence our dietary intake has on mental health”.")
    tf("s04", "q1", "q1-e4", "Anxiety and depression are highly connected to excessive junk food consumption.", True,
       "Key: d. T. Adults under 30 “who ate fast food more than three times a week scored higher levels” of anxiety and depression.")
    mcq("s05", "q2", "q2-e1", "In which paragraph is this idea mentioned: “Some types of food alleviate the feeling of unhappiness among the middle-aged.”?",
        "§3", ["§1", "§2"], "Key: a. § 3 (Begdache’s findings about adults over 30).",
        1, "en.comprehension")
    mcq("s06", "q2", "q2-e2", "In which paragraph is this idea mentioned: “Mental health boosts healthy physical practices.”?", "§2", ["§1", "§3"],
        "Key: b. § 2 — “They also suggested that mental well-being stimulated healthy eating, healthy practices, and exercising.”", 1, "en.comprehension")
    FORMS["q3-e1"] = ["Yes, there is.", "Yes"]
    binary("s07", "q3", "q3-e1", "Is there any link between diet and mental health?", "Yes, there is.", "No, there is not.", True,
           "Key: a. “Yes, there is. /Yes.” (0,25 for Yes).", 0.25, "en.comprehension")
    FORMS["q3-e2"] = ["Scientists have illuminated the effects our diet has on our mental health.",
                      "Researchers say what we eat affects and alters our brain chemistry up to the age of 30.",
                      "A team of researchers led by Professor Lina Begdache found that adults under 30 who ate fast food more than three times a week "
                      "scored higher levels of anxiety and depression."]
    mcq("s08", "q3", "q3-e2", "Is there any link between diet and mental health? Choose the statement that justifies the answer according to the text.",
        "Scientists have illuminated the effects our diet has on our mental health.",
        ["Researchers say what we eat has no effect on our brain chemistry.", "Older adults are less emotionally stable than under-30s.",
         "Mental well-being has no influence on healthy eating."],
        "Key: Justification: “Scientists have illuminated… our mental health.” / “Researchers say that what we eat affects … up to the age of 30.”/ "
        "“…adults under 30 who ate…anxiety and depression.” (0,75 for justification)", 0.75, "en.comprehension")
    FORMS["q3-e3"] = ["Because they eat less carbohydrate and more fruit."]
    mcq("s09", "q3", "q3-e3", "Why do adults over 30 enjoy a good mental well-being?", "Because they eat less carbohydrate and more fruit.",
        ["Because they eat more carbohydrate and less fruit.", "Because they eat fast food more than three times a week.", "Because they stop exercising."],
        "Key: b. “…because they eat less carbohydrate and more fruit.” (§3)", 1, "en.comprehension")
    mcq("s10", "q3", "q3-e4", "What makes the Mediterranean diet fit to the brain?",
        "The Mediterranean diet contains all the components that are important for the healthy structure of the brain.",
        ["It contains more carbohydrate than other diets.", "It is made of fast food eaten three times a week.", "It is only good for adults under 30."],
        "Key: c. “The Mediterranean diet contains all the components that are important for the healthy structure of the brain.” (§3)", 1, "en.comprehension")
    mcq("s11", "q4", "q4-e1", "What does “They” refer to in “They also suggested that mental well-being stimulated healthy eating, healthy practices, and "
        "exercising.” (§2)?", "researchers", ["older adults", "adults under 30", "heart disease and obesity"], "Key: a. They (§2): researchers.", 0.5, "en.discourse")
    FORMS["q4-e2"] = ["Mediterranean diet", "a Mediterranean diet", "the Mediterranean diet"]
    mcq("s12", "q4", "q4-e2", "What does “It” refer to in “It has all the components that are important for the healthy structure of the brain.” (§3)?",
        "Mediterranean diet", ["fast food", "our body", "carbohydrate"], "Key: b. It(§3): Mediterranean diet.", 0.5, "en.discourse")
    # ── B. Text Exploration ──
    mcq("s13", "q5", "q5-e1", "Find in §1 the word that means: “The food and drink you take regularly”.", "diet", ["chemistry", "effects", "adults"],
        "Key: a. diet — “the effects our diet has on our mental health” (§1).", 0.5, "en.vocabulary")
    FORMS["q5-e2"] = ["well-being", "mental well-being"]
    mcq("s14", "q5", "q5-e2", "Find in §2 the word that means: “General health and happiness”.", "well-being", ["obesity", "intake", "research"],
        "Key: b. well-being / mental well-being — “mental well-being stimulated healthy eating” (§2).", 0.5, "en.vocabulary")
    mcq("s15", "q5", "q5-e3", "Find in §3 the word that means: “A feeling of great worry”.", "anxiety", ["carbohydrate", "components", "structure"],
        "Key: c. anxiety — “higher levels of anxiety and depression” (§3).", 0.5, "en.vocabulary")
    morph("s16", "q6", "q6-e1", "researcher", ("re", "search", "er"), [("res", "earch", "er"), ("r", "esearch", "er"), ("re", "sear", "cher")], "re | search | er")
    morph("s17", "q6", "q6-e2", "eating", (None, "eat", "ing"), [("e", "at", "ing"), (None, "ea", "ting"), ("eat", "in", "g")], "///////// | eat | ing")
    morph("s18", "q6", "q6-e3", "intake", ("in", "take", None), [(None, "intak", "e"), ("int", "ake", None), ("i", "ntake", None)], "in | take | (empty)")
    FORMS["q7-e1"] = ["You will enjoy a better mental health provided that you eat less junk food.",
                      "Provided that you eat less junk food, you will enjoy a better mental health."]
    mcq("s19", "q7", "q7-e1", "Combine with (provided that): “You enjoy a better mental health. You eat less junk food.”",
        "You will enjoy a better mental health provided that you eat less junk food.",
        ["You will enjoy a better mental health provided that you will eat less junk food.",
         "You would enjoy a better mental health provided that you eat less junk food.",
         "You will enjoy a better mental health provided that you ate less junk food."],
        "Key: a. “You will enjoy a better mental health provided that you eat less junk food.” OR: “Provided that you eat less junk food, you will "
        "enjoy a better mental health.”", 1, "en.grammar")
    mcq("s20", "q7", "q7-e2", "Combine with (so … that…): “The Mediterranean diet is beneficial for mental health. Psychiatrists suggest the Mediterranean "
        "diet to their patients.”", "The Mediterranean diet is so beneficial for mental health that psychiatrists suggest it to their patients.",
        ["The Mediterranean diet is such beneficial for mental health that psychiatrists suggest it to their patients.",
         "The Mediterranean diet is so beneficial for mental health than psychiatrists suggest it to their patients.",
         "The Mediterranean diet is so beneficial that for mental health psychiatrists suggest it to their patients."],
        "Key: b. “The Mediterranean diet is so beneficial for mental health that psychiatrists suggest it to their patients.”", 1, "en.grammar")
    reorder("s-r", "q8", sent, ["b", "d", "c", "a"])
    writing("q9", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}],
            "Criteria: Relevance | Semantic Coherence | Correct use of English | Excellence (vocabulary and creativity) | Final score — Common streams: 1 | 1 | 2 | 1 | 05pts")
    return "Scientists have illuminated the effects …", "الموضوع الأوّل"


# ═══════════════════════════════ Subject 2 «Space developments…» (pages 3–4) ═══════════════════════════════
def paper2():
    text = ("Space developments in the last two decades have greatly contributed to our understanding of our planet’s climate. Satellite imaging, "
            "space exploration, and new technologies give us an idea of the big picture and how we can adapt to address climate change. For "
            "example, satellites in space have played a critical role in our understanding of the causes of global warming by providing us with "
            "a large body of data to examine the variations in the Earth’s orbit.\n"
            "Data from these satellites were essential inputs into the Intergovernmental Panel on Climate Change’s (IPCC) recent report. The "
            "report focused on how the physical science of climate change informs us about possible impacts under different emissions scenarios.\n"
            "The report also found that climate change is happening quicker than we thought, making the need to reduce emissions imminent. To "
            "address this, space infrastructure such as positioning, navigation, and timing (PNT) can help identify efficient transportation "
            "routes and sources of emissions, ultimately aiding mitigation efforts.\n"
            "As climate change intensifies, space exploration and Earth observation will become increasingly important to gathering critical "
            "data. We must meet the moment by investing in these missions and recognizing the important role of space technologies.")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from www.nei.org By EMMA DERR September17, 2021"}]
    match_box = [["Words", "Definitions"], ["1. to address", "a. the regular pattern of weather conditions of a particular place."],
                 ["2. global", "b. to think about a problem and decide how to deal with it."], ["3. climate", "c. covering or affecting the whole world."]]
    cloze = ("NASA‘s Earth Observation, the next generation of Earth science satellites that will be launched in the next decade, reflect the "
             "importance of Earth imaging. These satellites are designed to…(1)… information about our planet, ranging from the location of "
             "forest fires to the sea level rise to our agricultural …(2)…. They will be able to collect data at the regional and …(3)… levels and "
             "connect critical interactions between the atmosphere, land, oceans and ice, significantly supporting our …(4)… of the Earth’s climate.")
    topic1 = ("During a TV debate on space exploration, a participant doubted the usefulness of spending huge amounts of money on exploring the "
              "outer space while there exist many challenges on Earth. As a member of an astronomy association, write an article of about 80 to "
              "120 words for your local newspaper to explain the reasons for investing in space exploration.")
    notes1 = ["• Expansion of knowledge / solar system and the universe.", "• Improvement / quality of life / Earth.", "• Detection /forest fires.",
              "• Identification / weather forecast/ communication."]
    topic2 = ("You have recently bought a product online. You realised that it was a counterfeit while the seller pretended it was a genuine one. "
              "Write an opinion article of about 80 to 120 words to denounce such an unethical practice.")

    q("q1", "1", PA, "Identify the type of the text.\nThe text is: a. a conversation b. a letter c. a web article.", 1,
      [el("q1-e1", "Type of the text", 1)], docs)
    q("q2", "2", PA, "Identify the paragraphs in which the following ideas are mentioned.\n"
      "a. The writer expresses the need for putting money in space exploration.\nb. The importance of satellites in studying the origins of climate change.", 2,
      [el("q2-e1", "a. Paragraph of idea a", 1), el("q2-e2", "b. Paragraph of idea b", 1)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text.\na. Have space technologies helped identify the causes of global warming? Justify.\n"
      "b. How can space research contribute in reducing emissions?\nc. Why do we need to invest in space technologies?", 4,
      [el("q3-e1", "a. Yes/No answer", 0.5), el("q3-e2", "a. Justification", 1), el("q3-e3", "b. Reducing emissions", 1.5),
       el("q3-e4", "c. Investing in space technologies", 1)], docs)
    q("q4", "4", PA, "Choose the most appropriate title to the text.\na. Understanding Climate Change via Space Technologies.\n"
      "b. The Impact of Space Technologies on Climate Change.\nc. Causes and Effects of Global Warming.", 1, [el("q4-e1", "The most appropriate title", 1)], docs)
    q("q5", "1", PB, "Match the following words with the corresponding definitions.", 1.5, [el("q5-e1", "Words and definitions (0.5×3)", 1.5)],
      [{"id": "d-match", "kind": "table", "caption": "Words and definitions", "table": match_box}])
    q("q6", "2", PB, "Give the opposites of the following words keeping the same roots.\nunderstanding - efficient - important", 1.5,
      [el("q6-e1", "understanding", 0.5), el("q6-e2", "efficient", 0.5), el("q6-e3", "important", 0.5)], [])
    q("q7", "3", PB, "Ask questions which the underlined words answer.\na. We use satellites to observe forests efficiently.\n"
      "b. The report found that climate change is happening quickly.", 2, [el("q7-e1", "a. Question", 1), el("q7-e2", "b. Question", 1)], [])
    q("q8", "4", PB, "Fill in the gaps with words from the list given.", 2, [el("q8-e1", "Gap filling (0.5×4)", 2)],
      [{"id": "d-bank", "kind": "text", "caption": "Word list", "text": "understanding - provide - processes - local"},
       {"id": "d-cloze", "kind": "text", "caption": "Passage", "text": cloze}])
    crits = [("Relevance", 1), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1)]
    q("q9", "—", PW, WE_TASK + "\nTopic One:\n" + topic1 + "\nMake the best use of the following notes:\n" + "\n".join(notes1)
      + "\nTopic Two:\n" + topic2, WE_POINTS, [el(f"q9-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A. Comprehension ──
    mcq("s01", "q1", "q1-e1", "Identify the type of the text. The text is:", "a web article", ["a conversation", "a letter"],
        "Key: c. a web article (source: www.nei.org).", 1, "en.discourse")
    FORMS["q2-e1"] = ["§4", "the last paragraph"]
    mcq("s02", "q2", "q2-e1", "In which paragraph is this idea mentioned: “The writer expresses the need for putting money in space exploration.”?",
        "§4", ["§1", "§2", "§3"], "Key: a. § 4 (Accept the last paragraph) — “We must meet the moment by investing in these missions…”.", 1, "en.comprehension")
    mcq("s03", "q2", "q2-e2", "In which paragraph is this idea mentioned: “The importance of satellites in studying the origins of climate change.”?",
        "§1", ["§3", "§4"], "Key: b § 1.",
        1, "en.comprehension")
    FORMS["q3-e1"] = ["Yes, they have.", "Yes"]
    binary("s04", "q3", "q3-e1", "Have space technologies helped identify the causes of global warming?", "Yes, they have.", "No, they have not.", True,
           "Key: a. “Yes, they have. / Yes.” (0,5 for Yes).", 0.5, "en.comprehension")
    mcq("s05", "q3", "q3-e2", "Have space technologies helped identify the causes of global warming? Choose the statement that justifies the answer according to the text.",
        "Satellites in space have played a critical role in our understanding of the causes of global warming by providing us with a large body "
        "of data to examine the variations in the Earth’s orbit.",
        ["Space technologies have no role in our understanding of global warming.", "Satellites only help identify efficient transportation routes.",
         "Climate change is happening slower than we thought."],
        "Key: Justification: “…satellites in space have played … Earth’s orbit.” (1 for justification) — §1.", 1, "en.comprehension")
    mcq("s06", "q3", "q3-e3", "How can space research contribute in reducing emissions?",
        "Space infrastructure such as positioning, navigation, and timing (PNT) which can help identify efficient transportation routes and "
        "sources of emissions, ultimately aiding mitigation efforts.",
        ["Space tourism which can take people away from the polluted Earth.", "Space exploration which can replace all transportation on Earth.",
         "Satellite imaging which can stop the variations in the Earth’s orbit."],
        "Key: b. “Space infrastructure such as positioning, navigation, and timing (PNT) which can help identify efficient transportation routes "
        "and sources of emissions, ultimately aiding mitigation efforts.” (§3)", 1.5, "en.comprehension")
    mcq("s07", "q3", "q3-e4", "Why do we need to invest in space technologies?",
        "Because as climate change intensifies, space exploration and Earth observation will become increasingly important to gathering critical data.",
        ["Because climate change has stopped.", "Because space missions cost less than solving problems on Earth.",
         "Because satellites are the main cause of global warming."],
        "Key: c. “because climate change intensifies… critical data.” (§4)", 1, "en.comprehension")
    mcq("s08", "q4", "q4-e1", "Choose the most appropriate title to the text.", "Understanding Climate Change via Space Technologies.",
        ["The Impact of Space Technologies on Climate Change.", "Causes and Effects of Global Warming."],
        "Key: a. Understanding Climate Change via Space Technologies", 1, "en.comprehension")
    # ── B. Text Exploration ──
    st("s09", "q5", "q5-e1", "matching", "Match the following words with the corresponding definitions.",
       {"lefts": ["to address", "global", "climate"],
        "rights": ["to think about a problem and decide how to deal with it.", "covering or affecting the whole world.",
                   "the regular pattern of weather conditions of a particular place."]},
       {"pairs": [0, 1, 2]}, "Key: 1) b 2) c 3) a (0.5 each).", 1.5, "en.vocabulary", verbatim=True)
    mcq("s10", "q6", "q6-e1", "Give the opposite of “understanding” keeping the same root.", "misunderstanding",
        ["ununderstanding", "disunderstanding", "inunderstanding"], "Key: misunderstanding (prefix mis-).", 0.5, "en.vocabulary")
    mcq("s11", "q6", "q6-e2", "Give the opposite of “efficient” keeping the same root.", "inefficient", ["disefficient", "imefficient", "irefficient"],
        "Key: inefficient (prefix in-).", 0.5, "en.vocabulary")
    mcq("s12", "q6", "q6-e3", "Give the opposite of “important” keeping the same root.", "unimportant", ["inimportant", "disimportant", "misimportant"],
        "Key: unimportant (prefix un-).", 0.5, "en.vocabulary")
    FORMS["q7-e1"] = ["What do we use satellites for?", "Why do we use satellites?"]
    mcq("s13", "q7", "q7-e1", "Ask the question which the underlined words answer: “We use satellites to observe forests efficiently.” "
        "(underlined: “to observe forests efficiently”)", "What do we use satellites for?",
        ["What we use satellites for?", "What did we use satellites for?", "Who do we use satellites for?"],
        "Key: 1) What do we use satellites for? OR: Why do we use satellites?", 1, "en.grammar")
    mcq("s14", "q7", "q7-e2", "Ask the question which the underlined words answer: “The report found that climate change is happening quickly.” "
        "(underlined: “that climate change is happening quickly”)", "What did the report find?",
        ["What the report found?", "What did the report found?", "What does the report find?"], "Key: 2) What did the report find?", 1, "en.grammar")
    PAPER_BANK.add("s15")
    st("s15", "q8", "q8-e1", "fill_blank", "Fill in the gaps with words from the list given.",
       {"text": ("NASA‘s Earth Observation, the next generation of Earth science satellites that will be launched in the next decade, reflect the "
                 "importance of Earth imaging. These satellites are designed to (1) ____ information about our planet, ranging from the location of "
                 "forest fires to the sea level rise to our agricultural (2) ____. They will be able to collect data at the regional and (3) ____ "
                 "levels and connect critical interactions between the atmosphere, land, oceans and ice, significantly supporting our (4) ____ of "
                 "the Earth’s climate."),
        "bank": ["understanding", "provide", "processes", "local"]},
       {"blanks": [["provide"], ["processes"], ["local"], ["understanding"]]}, "Key: 1) provide 2) processes 3) local 4) understanding (0.5 each).", 2,
       "en.vocabulary", verbatim=True)
    writing("q9", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}],
            "Criteria: Relevance | Semantic Coherence | Correct use of English | Excellence (vocabulary and creativity) | Final score — Common streams: 1 | 1 | 2 | 1 | 05pts")
    return "Space developments …", "الموضوع الثّاني"


TOPIC, PAPER_AR = (paper1 if PAPER == 1 else paper2)()

TITLE = f"بكالوريا 2026 (الدّورة العاديّة) – اللّغة الإنجليزيّة – الشّعب العلميّة وتسيير واقتصاد – {PAPER_AR} ({TOPIC})"
COMMON_NOTES = (
    "موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، الدّورة: 2026، الشّعبة: علوم تجريبيّة، رياضيّات، تقني رياضيّ، تسيير واقتصاد، "
    "فنون، المدّة: 02 سا و30 د) "
    f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، 4 صفحات: الموضوع الأوّل ص1–2، الثّاني ص3–4)؛ «الدّورة العاديّة» من اسم الملفّ. "
    f"الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{KEY_ID} (ص1 «Scientists have illuminated the effects …»، ص2 «Space developments …»)؛ "
    "مجموع كلّ موضوع 20 (القراءة 15 = الفهم 08 + استكشاف النّصّ 07، التّعبير الكتابيّ 05). "
    "الشّعب: الرّأس يذكر «فنون» أيضًا ولا رمز لها في PLAY، فالشّعب SCI وMATH وTM وGE (اسم ملفّ Drive لا يذكر الفنون). "
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّ PDF رقميّ له طبقة نصّ أصليّة، فأُخذت الحروف منها (pdftotext -raw: علامات الاقتباس "
    "المنحنية، «…»، «§»، «NASA‘s» بعلامة افتتاح كما طُبعت، نقاط الفراغات) وطوبقت سطرًا سطرًا مع صور الصّفحات (150 نقطة)، وتُحقِّق بسكربت من أنّ كلّ "
    "نصّ حرفيّ وكلّ اقتباس في الخطوات جزء من طبقة النّصّ. خلاف طبقة النّصّ والصّورة: السّنة والمدّة في الرّأس العربيّ معكوسة («0302»، «02 … 03») "
    "وصوابها في الصّورة «2026» و«02 سا و30 د»؛ نقاط الملاحظات في طبقة النّصّ رمز خاصّ U+F0B7 وفي الصّورة «•» فكُتبت «•»؛ التّسطير لا يظهر في طبقة "
    "النّصّ وحُدّد من الصّورة. "
    "قرارات التّحويل (R1–R11 في محوّل التّجربة build_en_bac_2019_lit.py، وD1–D9 في رأسَي build_en_bac_2026_lang.py وهذا المحوّل): عنصر لكلّ "
    "بند يُنقَّط منفردًا؛ صح/خطأ ونعم/لا اختيار من خيارين مخزَّنان معكوسين؛ «نعم + علّل» عنصران كما في السّلّم؛ صيغ الحلّ المتعدّدة للإجابة نفسها "
    "تبقى تفاعليّة ولا تُعرض صيغة مقبولة مشتّتًا؛ الاشتقاق والأضداد اختيار من متعدّد لكلّ كلمة؛ إعادة التّرتيب: الجملة الافتتاحيّة وكلّ زوج منطقيّ "
    "(0.5 لكلّ منها)؛ التّعبير الكتابيّ مؤجَّل بمعايير الشّبكة الرّسميّة «Common streams» (الملاءمة 1، الانسجام الدّلاليّ 1، سلامة اللّغة 2، الإتقان 1). ")
PAPER_NOTES = {
    1: ("الموضوع الأوّل: المسطَّر They (§2 «They also suggested»)، It (§3 «“It has all the components…”»). س3أ: «Yes» (0.25) والتّعليل (0.75) عنصران؛ "
        "الحلّ يقبل ثلاثة تعليلات مقتبسة مختصرة بـ«…» فعُرض أوّلها صحيحًا بلفظ النّصّ كاملًا ولم يُعرض الآخران، والمشتّتات عبارات يناقضها النّصّ "
        "(الحلّ يكتب «Researchers say that what we eat» والنّصّ بلا «that»). س3ب: الحلّ «…because they eat less carbohydrate and more fruit.» فالخيار "
        "«Because they eat less carbohydrate and more fruit.». س B2: خانة اللاحقة لـ«intake» فارغة في الحلّ (بلا «//////»). س B3أ: الحلّ يقبل "
        "الصّيغتين (provided that في الوسط أو في البداية) فلم تُعرض الثّانية، ولم تُعرض «You enjoy … provided that you eat …» مشتّتًا لأنّها قابلة "
        "للدّفاع. إعادة التّرتيب b - d - c - a: الافتتاحيّة + الأزواج b–d، d–c، c–a. المجموع 20 = 8 + 7 + 5 (تفاعليّ 15، مؤجَّل 5)."),
    2: ("الموضوع الثّاني: لا كلمات مسطّرة في النّصّ؛ المسطَّر في B3 «to observe forests efficiently.» و«that climate change is happening quickly.». "
        "س2أ: «§ 4 (Accept the last paragraph)»؛ س2ب: لم تُعرض «§2» مشتّتًا (بيانات الأقمار في تقرير IPCC: قابل للدّفاع). س3أ: «Yes» (0.5) "
        "والتّعليل (1) عنصران؛ س3ج: الحلّ «because climate change intensifies… critical data.» فالخيار جملة النّصّ كاملة. س B3أ: الحلّ يقبل «What do "
        "we use satellites for?» و«Why do we use satellites?» فعُرضت الأولى ولم تُعرض الثّانية. ملء الفراغات (0.5×4) خطوة واحدة، وقائمة الورقة "
        "أربع كلمات لأربعة فراغات فبقي البنك كما في الورقة دون مشتّت مُضاف (D8). المطابقة (0.5×3) خطوة مطابقة واحدة. المجموع 20 = 8 + 7 + 5 "
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
