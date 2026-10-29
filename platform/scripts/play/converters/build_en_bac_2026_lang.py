"""Conversion: BAC 2026 (normal session) – English – stream «لغات أجنبية» (LANG) – Subject 1 «During the Roman period…» (paper 1)
and Subject 2 «Child labour refers to…» (paper 2). Follows the English pilot (build_en_bac_2019_lit.py, rules R1–R11) and
CONVERSION_GUIDE.md Appendix A.

Usage:  python3 scripts/play/converters/build_en_bac_2026_lang.py <out.json> [1|2]
        (the paper defaults to the -p1/-p2 suffix of <out.json>), then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- paper  gdrive 13ghQCb5hdsdF100hYTqK61CtPdigENSl «2026 - اللغة الإنجليزية - لغات أجنبية - الدورة العادية - الموضوع.pdf» (ONEC, 4 pages:
  subject 1 = pages 1–2, subject 2 = pages 3–4). Header: «الدورة: 2026»، «الشعبة: لغات أجنبية»، «المدة: 03 سا و30 د».
  New 2026 layout for this stream: Reading 14 (A/ Comprehension 07 + B/ Text Exploration 07) + Written Expression 06.
- key    gdrive 1KBVSOXSkEMLIXA6flC_96n4x8EAMGhra «… - الحل.pdf» (ONEC «الإجابة النموذجية», page 1 = subject 1 «During the Roman
  period…», page 2 = subject 2 «Child labour refers to…»), with the official marks («مجموع / مجزأة»). Both keys total 20.

How the text was read: both PDFs are DIGITAL (pdffonts lists embedded fonts, there is a text layer). Verbatim strings were taken from
`pdftotext -raw` (U+202B/U+202C stripped; exact «…», «’», «‘ed’», «“ ”», «§», «–» and dot leaders) and checked line by line against
the 150-dpi page images (phonetic headers re-rendered at 400 dpi); every verbatim string and every quotation used in a prompt was
checked to be a substring of the text layer with a script. Formatting that cannot be stored: underlines (reference words, the parts
of B3 in subject 1), bold, the small-capital «ɪ» of «/ɪd/» and «/ɪz/» (the text layer encodes it as a reduced-size capital «I»,
U+0049, so documents and options keep «/Id/» and «/Iz/» as in the text layer).

Rules: pilot R1–R11 apply unchanged (verbatim layout, quoted sentences for underlined words, one element per key mark line, binary
items stored reversed, key variants in FORMS never offered as distractors, no defensible distractor, essay_builder for written
expression, «Key: …» explanations, is_verbatim_original only when prompt == verbatim_text). Additional decisions for 2026:
D1  Open answers: «5- Give a suitable title» (subject 1, key: «Accept any logical title.») and «5- Give the general idea» (subject 2,
    key: «Accept any logical answer.») are deferred essay_builder steps (1 pt each) whose spec holds the key's model answer.
D2  «Yes/No + Justify» items whose key splits the mark («0.25 for No and 0.75 for justification») = two elements: a binary mcq
    (Yes/No, stored reversed) and a justification mcq whose right option is the text sentence the key quotes (the key's «…» filled
    from the text); distractors are text sentences that do not justify the answer or statements contradicted by the text.
D3  Pronunciation tables (final «ed» / «s», 0.25 per word): one element and one 3-option mcq (/t/ /d/ /Id/ or /s/ /z/ /Iz/) per word —
    a `matching` cannot be used because two words share a column (its pairs must be distinct).
D4  Morphology («Divide … into root and affixes», «Give the opposites … keeping the same root», 0.5 per word): one mcq per word; for
    «divide» the right option is the key's row (prefix | root | suffix, «none» for the key's «//////»), distractors are impossible
    splits (no other analysis that could be defended, e.g. «represent + ed» is not offered).
D5  Re-ordering keys printed «d - b - a - c» with «0.5 (0.5) (0.5) (0.5)» under the arrows (opening sentence + three logical pairs):
    split as in pilot R4 (opening sentence mcq + «right after» pairs + the last pair asked as «right before» the final sentence).
D6  Written expression = 6 pts on this paper: Relevance 1.5, Semantic coherence 1, Correct use of English 2, Excellence 1.5 (grid
    row «LE»); one essay_builder step per criterion (labels sentence-cased; the grid row is quoted verbatim in the spec).
D7  Subject 1, B4: the key's /d/ column reads «studied / replied», but the paper's list is «represented - established - studied -
    applied»; «replied» is not on the paper and «applied» is the only word left once the other three cells are filled, so the step for
    «applied» uses /d/ and the slip is logged in `notes` for the owner (not treated as unreadable).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper 1 or 2 (argument or -p1/-p2 suffix)"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SET_ID = f"en-bac-2026-lang-p{PAPER}"
STREAMS = ["LANG"]
PAPER_ID = "13ghQCb5hdsdF100hYTqK61CtPdigENSl"
PAPER_TITLE = "2026 - اللغة الإنجليزية - لغات أجنبية - الدورة العادية - الموضوع.pdf"
KEY_ID = "1KBVSOXSkEMLIXA6flC_96n4x8EAMGhra"
KEY_TITLE = "2026 - اللغة الإنجليزية - لغات أجنبية - الدورة العادية - الحل.pdf"
WE_POINTS = 6  # written expression on this paper (key grid «LE»)

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


PA = "Part One: Reading (14 points) – A/ Comprehension (07 points)"
PB = "Part One: Reading (14 points) – B/ Text Exploration (07 points)"
PW = "Part Two: Written Expression (06 points)"
INSTR = {"id": "d-instr", "kind": "text", "caption": "Instruction", "text": "Read the text carefully to do the activities."}
WE_TASK = "Choose only ONE of the following topics."


# ═══════════════════════════════ Subject 1 «During the Roman period…» (pages 1–2) ═══════════════════════════════
def paper1():
    text = ("During the Roman period, specifically in the fourth century A.D, the schools of Thagaste and Madauros were two of the most "
            "prominent ones in Algeria. They became well-known due to the nature of their educational programme applied in the learning "
            "process. These institutions represented a fundamental cornerstone in shaping and refining the intellectual character of a number "
            "of African literary elites who trained and studied there. Thanks to the strength of their instructions, these schools enabled "
            "writers to leave a clear imprint and a significant legacy on Latin literature.\n"
            "The spread of these schools in Africa coincided with Roman policy whose objective was to establish such institutions throughout "
            "the settlements. This expansion aimed to meet the needs of Roman citizens and Italian settlers, while also serving as an "
            "instrument for the diffusion of Romanization among Africans. Through these schools, Rome sought to disseminate the ideals of the "
            "Roman cities and implement its settlement and pacification policy.\n"
            "Access to education, however, was not open to all. It remained largely restricted to a specific social class – members of the "
            "local elite or the sons of landowners – who could afford the considerable expenses of schooling. Their primary motivation was to "
            "secure prestigious administrative positions for their children within the Roman system or to ensure their upward mobility "
            "within the Roman social hierarchy.")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source",
             "text": "Adapted from: “Science, Education and Innovation in the Context of Modern Problems”\nIssue 10, Vol. 8.2025 - by Hassina Hallak."}]
    cloze = ("The nature of education in the school of Madauros can be reconstructed through the educational stages of Augustine as recounted "
             "in his Confessions. These stages largely ……(1)……the standard school system across the provinces of the Roman world. After the "
             "primary stage, ……(2)…… would continue their education up to the age of sixteen at most, ……(3)…… in their hometown if secondary "
             "education was ……(4)…… or in a neighbouring town.")
    bank = "teachers - available - reflect - either - students - neither"
    topic1 = ("There is a great deal of discussion about the role of Roman schools in shaping the African culture. Some claim that the Roman "
              "civilization did not have any influence on the African culture. As a member of the cultural club of your school, write an "
              "opinion article of about 80 to 120 words for your club magazine in which you highlight the role of the Roman schools in Africa, "
              "namely Algeria.")
    notes1 = ["- Teaching Roman culture (Latin language / law / philosophy)", "- Integrating the Africans into the Roman empire",
              "- Mixing the Roman traditions with the African ones.", "- Helping preserve classical knowledge in Africa ( philosophy, arts and civic values)"]
    topic2 = ("You have recently taken an exam and noticed that some of your classmates have used the Artificial Intelligence (AI) to cheat. "
              "You felt disappointed and decided to react. Write an article of about 80 to 120 words for your school journal to denounce such "
              "an unethical practice.")

    q("q1", "1", PA, "Identify the type of the text.\nThe text is: a- an academic journal article b- a web article c- a letter.", 0.5,
      [el("q1-e1", "Type of the text", 0.5)], docs)
    q("q2", "2", PA, "Identify the paragraphs in which the following ideas are mentioned.\na- Rome used schools to spread its culture in Africa.\n"
      "b- The schools of Thagaste and Madauros contributed to the excellence of African intellectuals.", 1,
      [el("q2-e1", "a- Paragraph of idea a", 0.5), el("q2-e2", "b- Paragraph of idea b", 0.5)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text.\na- What made the schools of Thagaste and Madauros famous?\n"
      "b- What did the schools allow the writers to do?\nc- Was education accessible to all during the Roman period in Africa? Justify.", 3,
      [el("q3-e1", "a- What made the schools famous", 1), el("q3-e2", "b- What the schools allowed the writers to do", 1),
       el("q3-e3", "c- Yes/No answer", 0.25), el("q3-e4", "c- Justification", 0.75)], docs)
    q("q4", "4", PA, "Find what or who the underlined words in the text refer to.\na- They (§1) …………… b- whose (§2) …………………. c- It (§3)……………..", 1.5,
      [el("q4-e1", "a- They (§1)", 0.5), el("q4-e2", "b- whose (§2)", 0.5), el("q4-e3", "c- It (§3)", 0.5)], docs)
    q("q5", "5", PA, "Give a suitable title to the text.", 1, [el("q5-e1", "A suitable title", 1)], docs)
    q("q6", "1", PB, "Find in the text words or phrases whose definitions follow:\na- A period of one hundred years. (§1)\n"
      "b- To spread information, knowledge, etc, so that it reaches many people. (§2)\nc- Connected with society. (§3)", 1.5,
      [el("q6-e1", "a- (§1)", 0.5), el("q6-e2", "b- (§2)", 0.5), el("q6-e3", "c- (§3)", 0.5)], docs)
    q("q7", "2", PB, "Divide the following words into root and affixes.\nenable - settlement - represented", 1.5,
      [el("q7-e1", "enable", 0.5), el("q7-e2", "settlement", 0.5), el("q7-e3", "represented", 0.5)],
      [{"id": "d-table", "kind": "table", "caption": "Table", "table": [["prefix", "root", "suffix"], ["", "", ""]]}])
    q("q8", "3", PB, "Ask questions which the underlined words answer.\na- Rome wanted to disseminate the ideals of the Roman cities.\n"
      "b- The schools of Thagaste and Madauros were established in Souk Ahras.", 1,
      [el("q8-e1", "a- Question", 0.5), el("q8-e2", "b- Question", 0.5)], [])
    q("q9", "4", PB, "Classify the following words according the pronunciation of the final ‘ed’.\nrepresented - established - studied - applied", 1,
      [el(f"q9-e{i}", w, 0.25) for i, w in enumerate(["represented", "established", "studied", "applied"], 1)],
      [{"id": "d-table", "kind": "table", "caption": "Table", "table": [["/t/", "/d/", "/Id/"], ["", "", ""]]}])
    q("q10", "5", PB, "Fill in the gaps with only 4 words from the list given.", 2, [el("q10-e1", "Gap filling (0.5×4)", 2)],
      [{"id": "d-bank", "kind": "text", "caption": "Word list", "text": bank}, {"id": "d-cloze", "kind": "text", "caption": "Passage", "text": cloze}])
    crits = [("Relevance", 1.5), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary & creativity)", 1.5)]
    q("q11", "—", PW, WE_TASK + "\nTopic One:\n" + topic1 + "\nMake the best use of the following notes:\n" + "\n".join(notes1)
      + "\nTopic Two:\n" + topic2, WE_POINTS, [el(f"q11-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A/ Comprehension ──
    mcq("s01", "q1", "q1-e1", "Identify the type of the text. The text is:", "an academic journal article", ["a web article", "a letter"],
        "Key: a- an academic journal article (source: “Science, Education and Innovation in the Context of Modern Problems”, Issue 10, Vol. 8).",
        0.5, "en.discourse")
    mcq("s02", "q2", "q2-e1", "In which paragraph is this idea mentioned: “Rome used schools to spread its culture in Africa.”?", "§2", ["§1", "§3"],
        "Key: a- §2 — “Through these schools, Rome sought to disseminate the ideals of the Roman cities…”.", 0.5, "en.comprehension")
    mcq("s03", "q2", "q2-e2", "In which paragraph is this idea mentioned: “The schools of Thagaste and Madauros contributed to the excellence of African intellectuals.”?",
        "§1", ["§2", "§3"],
        "Key: b- §1 — “These institutions represented a fundamental cornerstone in shaping and refining the intellectual character of a number of "
        "African literary elites…”.", 0.5, "en.comprehension")
    mcq("s04", "q3", "q3-e1", "What made the schools of Thagaste and Madauros famous?", "The nature of their educational programme applied in the learning process.",
        ["Their location in Rome, the capital of the empire.", "Their free access for all the children of Africa.", "The low cost of their schooling."],
        "Key: a- “The nature of their educational programme applied in the learning process.” (§1)", 1, "en.comprehension")
    mcq("s05", "q3", "q3-e2", "What did the schools allow the writers to do?", "They enabled them to leave a clear imprint and a significant legacy on Latin literature.",
        ["They allowed them to write in their own African languages instead of Latin.", "They allowed them to stop the Romanization of Africans.",
         "They allowed them to avoid the expenses of schooling."],
        "Key: b- “They enabled them to leave a clear imprint and a significant legacy on Latin literature.” (§1)", 1, "en.comprehension")
    FORMS["q3-e3"] = ["No, it was not.", "No"]
    binary("s06", "q3", "q3-e3", "Was education accessible to all during the Roman period in Africa?", "Yes, it was.", "No, it was not.", False,
           "Key: c- “No, it was not. / No.” (0.25 for No).", 0.25, "en.comprehension")
    mcq("s07", "q3", "q3-e4", "Was education accessible to all during the Roman period in Africa? Choose the sentences from the text that justify the answer.",
        "Access to education, however, was not open to all. It remained largely restricted to a specific social class.",
        ["They became well-known due to the nature of their educational programme applied in the learning process.",
         "The spread of these schools in Africa coincided with Roman policy whose objective was to establish such institutions throughout the settlements.",
         "Through these schools, Rome sought to disseminate the ideals of the Roman cities and implement its settlement and pacification policy."],
        "Key: c- Justification: “Access to education was not open to all. It remained largely restricted to a specific social class.” (0.75 for "
        "justification) — §3.", 0.75, "en.comprehension")
    mcq("s08", "q4", "q4-e1", "What does “They” refer to in “They became well-known due to the nature of their educational programme applied in the learning process.” (§1)?",
        "the schools of Thagaste and Madauros", ["the African literary elites", "the Italian settlers", "the sons of landowners"],
        "Key: a- They (§1): the schools of Thagaste and Madauros.", 0.5, "en.discourse")
    mcq("s09", "q4", "q4-e2", "What does “whose” refer to in “The spread of these schools in Africa coincided with Roman policy whose objective was to establish "
        "such institutions throughout the settlements.” (§2)?", "Roman policy", ["Africa", "the settlements", "Roman citizens"],
        "Key: b- whose (§2): Roman policy.", 0.5, "en.discourse")
    FORMS["q4-e3"] = ["access to education", "education"]
    mcq("s10", "q4", "q4-e3", "What does “It” refer to in “It remained largely restricted to a specific social class…” (§3)?", "access to education",
        ["a specific social class", "the Roman system", "the local elite"], "Key: c- It (§3): access to education / education.", 0.5, "en.discourse")
    open_answer("s11", "q5", "q5-e1", "Give a suitable title to the text.", "A logical title for the text",
                "“The Role of Thagaste and Madauros Schools in the Roman Period”", "Accept any logical title.", 1, "en.comprehension", verbatim=True)
    # ── B/ Text Exploration ──
    mcq("s12", "q6", "q6-e1", "Find in §1 the word that means: “A period of one hundred years.”", "century", ["programme", "legacy", "cornerstone"],
        "Key: a- century — “specifically in the fourth century A.D” (§1).", 0.5, "en.vocabulary")
    mcq("s13", "q6", "q6-e2", "Find in §2 the word that means: “To spread information, knowledge, etc, so that it reaches many people.”", "disseminate",
        ["establish", "implement", "coincided"], "Key: b- disseminate — “Rome sought to disseminate the ideals of the Roman cities” (§2).", 0.5, "en.vocabulary")
    mcq("s14", "q6", "q6-e3", "Find in §3 the word that means: “Connected with society.”", "social", ["local", "primary", "prestigious"],
        "Key: c- social — “a specific social class” (§3).", 0.5, "en.vocabulary")
    morph("s15", "q7", "q7-e1", "enable", ("en", "able", None), [("e", "nable", None), ("en", "abl", "e"), (None, "enab", "le")], "en | able | //////")
    morph("s16", "q7", "q7-e2", "settlement", (None, "settle", "ment"), [("set", "tle", "ment"), (None, "settlem", "ent"), ("se", "ttle", "ment")],
          "////// | settle | ment")
    morph("s17", "q7", "q7-e3", "represented", ("re", "present", "ed"), [("rep", "resent", "ed"), ("re", "presen", "ted"), (None, "represen", "ted")],
          "re | present | ed")
    mcq("s18", "q8", "q8-e1", "Ask the question which the underlined words answer: “Rome wanted to disseminate the ideals of the Roman cities.” "
        "(underlined: “to disseminate the ideals of the Roman cities”)", "What did Rome want?",
        ["What did Rome wanted?", "What Rome did want?", "Where did Rome want?"], "Key: a- What did Rome want?", 0.5, "en.grammar")
    mcq("s19", "q8", "q8-e2", "Ask the question which the underlined words answer: “The schools of Thagaste and Madauros were established in Souk Ahras.” "
        "(underlined: “in Souk Ahras”)", "Where were the schools of Thagaste and Madauros established?",
        ["Where the schools of Thagaste and Madauros were established?", "Where did the schools of Thagaste and Madauros establish?",
         "When were the schools of Thagaste and Madauros established?"],
        "Key: b- Where were the schools of Thagaste and Madauros established?", 0.5, "en.grammar")
    ed = ["/t/", "/d/", "/Id/"]
    phon("s20", "q9", "q9-e1", "represented", "‘ed’", "/Id/", ed, "/Id/")
    phon("s21", "q9", "q9-e2", "established", "‘ed’", "/t/", ed, "/t/")
    phon("s22", "q9", "q9-e3", "studied", "‘ed’", "/d/", ed, "/d/ (key: “studied / replied”)")
    phon("s23", "q9", "q9-e4", "applied", "‘ed’", "/d/", ed, "/d/ (the key's /d/ column reads “studied / replied”: “replied” stands for the paper's “applied”)")
    st("s24", "q10", "q10-e1", "fill_blank", "Fill in the gaps with only 4 words from the list given.",
       {"text": ("The nature of education in the school of Madauros can be reconstructed through the educational stages of Augustine as recounted "
                 "in his Confessions. These stages largely (1) ____ the standard school system across the provinces of the Roman world. After the "
                 "primary stage, (2) ____ would continue their education up to the age of sixteen at most, (3) ____ in their hometown if secondary "
                 "education was (4) ____ or in a neighbouring town."),
        "bank": ["teachers", "available", "reflect", "either", "students", "neither"]},
       {"blanks": [["reflect"], ["students"], ["either"], ["available"]]}, "Key: 1) reflect 2) students 3) either 4) available (0.5 each).", 2,
       "en.vocabulary", verbatim=True)
    writing("q11", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}],
            "Criteria: relevance | semantic coherence | correct use of English | Excellence (vocabulary & creativity) | Final score — LE: 1.5 | 1 | 2 | 1.5 | 6 points")
    return "During the Roman period…", "الموضوع الأوّل"


# ═══════════════════════════════ Subject 2 «Child labour refers to…» (pages 3–4) ═══════════════════════════════
def paper2():
    text = ("Child labour refers to work that children perform under the legal minimum working age or in conditions that harm their health, "
            "safety, or morals. It includes tasks that deprive them of their potential, dignity and education. Yet, not all work is considered "
            "child labour, age-appropriate chores or part-time jobs that do not interfere with schooling can be beneficial.\n"
            "Deep social and economic issues force children to work, with poverty as the main cause. Families in hardship may depend on a "
            "child’s income to survive, especially when adults cannot find decent work. Other factors include weak laws, cultural acceptance of "
            "child work, and crises like conflicts or disasters.\n"
            "Child labour causes lasting harm to children’s health, development, and future. Many work in dangerous places like mines, farms, "
            "or factories, where they are exposed to toxic chemicals, unsafe tools, and harsh conditions. This often leads to injuries, illness, "
            "or even death, with some children suffering permanent disabilities.\n"
            "The damage is not just physical. Child labour also causes emotional trauma. Children may face abuse and stress leading to "
            "long-term mental health issues.\n"
            "Despite years of campaigns, child labour remains a major global issue. However, by tackling the root causes of child labour, "
            "reporting exploitation, and demanding accountability, we can ensure all children have the chance to learn, grow, and enjoy "
            "childhood free of exploitation.")
    docs = [INSTR, {"id": "d-text", "kind": "text", "caption": "The text", "text": text},
            {"id": "d-src", "kind": "text", "caption": "Source", "text": "Adapted from: https: //thefreedomhub.org/child-labour-the-reality."}]
    topic1 = ("You watched a TV documentary on children under 15 who were exploited in sweatshops under harsh conditions. You were deeply moved "
              "by such a situation. You decided to react. Write an opinion article of about 80 to 120 words for the local newspaper to suggest "
              "possible actions to combat child labour.")
    notes1 = ["- Laws / punish / child exploitation", "- Families / financial aid / social programmes", "- Report exploitation / raise public awareness"]
    topic2 = ("You recently read an article in a blog. Its author denied any contribution of the ancient civilizations for humanity. As a member "
              "of an archaeological association, you felt disappointed and decided to react. Write an article of about 80 to 120 words as a "
              "response to the author in which you highlight the major contributions of ancient civilizations to the development of mankind.")
    sent = {"a": "a- Besides, for parents who are struggling to keep their families afloat,",
            "b": "b- Long strenuous workdays leave them exhausted and unable to attend classes.",
            "c": "c- sending kids to school is a luxury they cannot afford.",
            "d": "d- It is true that children who work do not often get a proper education."}

    q("q1", "1", PA, "Choose the answer to complete each statement.\nA- Social and economic difficulties …….. children to work.\na- help b- oblige c- hinder\n"
      "B- Poor families survive thanks to the …….. salary.\na- adults’ b- people’s c- child’s\nC- Children often work in ………. settings.\n"
      "a- harmful b- safe c- enjoyable", 1.5, [el("q1-e1", "A", 0.5), el("q1-e2", "B", 0.5), el("q1-e3", "C", 0.5)], docs)
    q("q2", "2", PA, "Identify the paragraphs in which the following ideas are mentioned.\na- Factors that drive children to child labour.\n"
      "b- Actions which can be taken to put an end to child labour.", 0.5,
      [el("q2-e1", "a- Paragraph of idea a", 0.25), el("q2-e2", "b- Paragraph of idea b", 0.25)], docs)
    q("q3", "3", PA, "Answer the following questions according to the text.\na- Are all jobs harmful for children? Justify\n"
      "b- What mental impact does child labour have on children?\nc- How can we fight child labour?", 3,
      [el("q3-e1", "a- Yes/No answer", 0.25), el("q3-e2", "a- Justification", 0.75), el("q3-e3", "b- Mental impact", 1),
       el("q3-e4", "c- How to fight child labour", 1)], docs)
    q("q4", "4", PA, "Find what or who the underlined words in the text refer to.\na- It (§1)…….. b- where (§3)……..", 1,
      [el("q4-e1", "a- It (§1)", 0.5), el("q4-e2", "b- where (§3)", 0.5)], docs)
    q("q5", "5", PA, "Give the general idea of the text.", 1, [el("q5-e1", "The general idea", 1)], docs)
    q("q6", "1", PB, "Find in the text words or phrases that are closest in meaning to.\na- difficulty (§2) = ……….. b- guarantee (§5) =…………", 0.5,
      [el("q6-e1", "a- difficulty (§2)", 0.25), el("q6-e2", "b- guarantee (§5)", 0.25)], docs)
    q("q7", "2", PB, "Give the opposites of the following words keeping the same root.\nlegal - moral - lead", 1.5,
      [el("q7-e1", "legal", 0.5), el("q7-e2", "moral", 0.5), el("q7-e3", "lead", 0.5)], [])
    q("q8", "3", PB, "Complete sentence (b) so that it means the same as (a).\n1- a- Child labour can cause emotional trauma.\n"
      "b- Emotional trauma …………………………………………..……\n2- a- Many families regret they forced their children to work.\n"
      "b- Many families wish ………………………………………………", 2, [el("q8-e1", "1- Emotional trauma …", 1), el("q8-e2", "2- Many families wish …", 1)], [])
    q("q9", "4", PB, "Classify the following words according to the pronunciation of the final ‘s’.\nconditions - causes - conflicts - families", 1,
      [el(f"q9-e{i}", w, 0.25) for i, w in enumerate(["conditions", "causes", "conflicts", "families"], 1)],
      [{"id": "d-table", "kind": "table", "caption": "Table", "table": [["/s/", "/z/", "/Iz/"], ["", "", ""]]}])
    q("q10", "5", PB, "Reorder the following sentences to get a coherent passage.\n" + "\n".join(sent[k] for k in "abcd"), 2,
      [el("q10-e1", "Opening sentence", 0.5), el("q10-e2", "Logical pair 1", 0.5), el("q10-e3", "Logical pair 2", 0.5), el("q10-e4", "Logical pair 3", 0.5)], [])
    crits = [("Relevance", 1.5), ("Semantic coherence", 1), ("Correct use of English", 2), ("Excellence (vocabulary and creativity)", 1.5)]
    q("q11", "—", PW, WE_TASK + "\nTopic One:\n" + topic1 + "\nMake the best use of the following notes:\n" + "\n".join(notes1)
      + "\nTopic Two:\n" + topic2, WE_POINTS, [el(f"q11-e{i}", c, p) for i, (c, p) in enumerate(crits, 1)], [])

    # ── A/ Comprehension ──
    mcq("s01", "q1", "q1-e1", "Choose the answer to complete the statement: “Social and economic difficulties …….. children to work.”", "oblige",
        ["help", "hinder"], "Key: A- b (oblige). “Deep social and economic issues force children to work” (§2).", 0.5, "en.comprehension")
    mcq("s02", "q1", "q1-e2", "Choose the answer to complete the statement: “Poor families survive thanks to the …….. salary.”", "child’s",
        ["adults’", "people’s"], "Key: B- c (child’s). “Families in hardship may depend on a child’s income to survive” (§2).", 0.5, "en.comprehension")
    mcq("s03", "q1", "q1-e3", "Choose the answer to complete the statement: “Children often work in ………. settings.”", "harmful",
        ["safe", "enjoyable"], "Key: C- a (harmful). “Many work in dangerous places like mines, farms, or factories” (§3).", 0.5, "en.comprehension")
    mcq("s04", "q2", "q2-e1", "In which paragraph is this idea mentioned: “Factors that drive children to child labour.”?", "§2", ["§1", "§3", "§4"],
        "Key: a- § 2 — “Deep social and economic issues force children to work, with poverty as the main cause.”", 0.25, "en.comprehension")
    mcq("s05", "q2", "q2-e2", "In which paragraph is this idea mentioned: “Actions which can be taken to put an end to child labour.”?", "§5", ["§2", "§3", "§4"],
        "Key: b- § 5 — “by tackling the root causes of child labour, reporting exploitation, and demanding accountability…”.", 0.25, "en.comprehension")
    FORMS["q3-e1"] = ["No, not all jobs are.", "No"]
    binary("s06", "q3", "q3-e1", "Are all jobs harmful for children?", "Yes, they are.", "No, not all jobs are.", False,
           "Key: a- “No, not all jobs are. / No.” (0.25 for No).", 0.25, "en.comprehension")
    mcq("s07", "q3", "q3-e2", "Are all jobs harmful for children? Choose the sentence from the text that justifies the answer.",
        "Yet, not all work is considered child labour, age-appropriate chores or part-time jobs that do not interfere with schooling can be beneficial.",
        ["Many work in dangerous places like mines, farms, or factories, where they are exposed to toxic chemicals, unsafe tools, and harsh conditions.",
         "Child labour also causes emotional trauma.", "Despite years of campaigns, child labour remains a major global issue."],
        "Key: a- Justification: “…not all work is …can be beneficial.” (0.75 for justification) — §1.", 0.75, "en.comprehension")
    mcq("s08", "q3", "q3-e3", "What mental impact does child labour have on children?",
        "Child labour causes emotional trauma; children may face abuse and stress leading to long term mental health issues.",
        ["It leads to injuries, illness or permanent disabilities.", "It gives children the chance to learn, grow and enjoy childhood.",
         "It helps children find decent work when they become adults."],
        "Key: b. “Child labour causes emotional trauma; children may face abuse and stress leading to long term mental health issues.” (§4)", 1, "en.comprehension")
    mcq("s09", "q3", "q3-e4", "How can we fight child labour?", "By tackling the root causes of child labour, reporting exploitation, and demanding accountability.",
        ["By sending children to work in mines, farms or factories.", "By accepting child work as part of the culture.",
         "By letting families depend on a child’s income."],
        "Key: c. “by tackling the root causes …and demanding accountability.” (§5)", 1, "en.comprehension")
    mcq("s10", "q4", "q4-e1", "What does “It” refer to in “It includes tasks that deprive them of their potential, dignity and education.” (§1)?",
        "child labour", ["the legal minimum working age", "schooling", "safety"], "Key: a- It (§1): child labour.", 0.5, "en.discourse")
    FORMS["q4-e2"] = ["dangerous places", "mines, farms or factories", "dangerous places like mines, farms or factories"]
    mcq("s11", "q4", "q4-e2", "What does “where” refer to in “Many work in dangerous places like mines, farms, or factories, where they are exposed to toxic "
        "chemicals, unsafe tools, and harsh conditions.” (§3)?", "dangerous places like mines, farms or factories",
        ["toxic chemicals", "harsh conditions", "permanent disabilities"],
        "Key: b- where (§3): dangerous places / mines, farms or factories / dangerous places like mines, farms or factories.", 0.5, "en.discourse")
    open_answer("s12", "q5", "q5-e1", "Give the general idea of the text.", "The general idea of the text",
                "Child labour has a serious impact on children’s lives and future.", "Accept any logical answer.", 1, "en.comprehension", verbatim=True)
    # ── B/ Text Exploration ──
    mcq("s13", "q6", "q6-e1", "Find in §2 the word that is closest in meaning to “difficulty”.", "hardship", ["income", "acceptance", "laws"],
        "Key: a- hardship — “Families in hardship may depend on a child’s income to survive” (§2).", 0.25, "en.vocabulary")
    mcq("s14", "q6", "q6-e2", "Find in §5 the word that is closest in meaning to “guarantee”.", "ensure", ["tackling", "demanding", "remains"],
        "Key: b- ensure — “we can ensure all children have the chance to learn…” (§5).", 0.25, "en.vocabulary")
    mcq("s15", "q7", "q7-e1", "Give the opposite of “legal” keeping the same root.", "illegal", ["inlegal", "dislegal", "imlegal"],
        "Key: illegal (prefix il-).", 0.5, "en.vocabulary")
    mcq("s16", "q7", "q7-e2", "Give the opposite of “moral” keeping the same root.", "immoral", ["inmoral", "dismoral", "irmoral"],
        "Key: immoral (prefix im-).", 0.5, "en.vocabulary")
    mcq("s17", "q7", "q7-e3", "Give the opposite of “lead” keeping the same root.", "mislead", ["dislead", "inlead", "imlead"],
        "Key: mislead (prefix mis-).", 0.5, "en.vocabulary")
    mcq("s18", "q8", "q8-e1", "Complete sentence (b) so that it means the same as (a): (a) “Child labour can cause emotional trauma.” → (b) “Emotional trauma …”",
        "Emotional trauma can be caused by child labour.",
        ["Emotional trauma can caused by child labour.", "Emotional trauma can be cause by child labour.", "Emotional trauma can be causing by child labour."],
        "Key: 1) b. “Emotional trauma can be caused by child labour.”", 1, "en.grammar")
    FORMS["q8-e2"] = ["Many families wish they had not forced their children to work.", "Many families wish they hadn’t forced their children to work."]
    mcq("s19", "q8", "q8-e2", "Complete sentence (b) so that it means the same as (a): (a) “Many families regret they forced their children to work.” → (b) “Many families wish …”",
        "Many families wish they had not forced their children to work.",
        ["Many families wish they did not force their children to work.", "Many families wish they have not forced their children to work.",
         "Many families wish they would not forced their children to work."],
        "Key: 2) b. “Many families wish they had not forced their children to work.”", 1, "en.grammar")
    s_ = ["/s/", "/z/", "/Iz/"]
    phon("s20", "q9", "q9-e1", "conditions", "‘s’", "/z/", s_, "/z/ (key: “Conditions /families”)")
    phon("s21", "q9", "q9-e2", "causes", "‘s’", "/Iz/", s_, "/Iz/")
    phon("s22", "q9", "q9-e3", "conflicts", "‘s’", "/s/", s_, "/s/")
    phon("s23", "q9", "q9-e4", "families", "‘s’", "/z/", s_, "/z/ (key: “Conditions /families”)")
    reorder("s-r", "q10", sent, ["d", "b", "a", "c"])
    writing("q11", WE_TASK, crits, [{"id": "topic-1", "text": topic1, "notes": notes1}, {"id": "topic-2", "text": topic2, "notes": []}],
            "Criteria: Relevance | Semantic coherence | Correct use of English | Excellence (vocabulary and creativity) | Final score — LE: 1.5 | 01 | 02 | 1.5 | 06")
    return "Child labour refers to…", "الموضوع الثّاني"


TOPIC, PAPER_AR = (paper1 if PAPER == 1 else paper2)()

TITLE = f"بكالوريا 2026 (الدّورة العاديّة) – اللّغة الإنجليزيّة – شعبة لغات أجنبيّة – {PAPER_AR} ({TOPIC})"
COMMON_NOTES = (
    "موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، الدّورة: 2026، الشّعبة: لغات أجنبيّة، المدّة: 03 سا و30 د) "
    f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، 4 صفحات: الموضوع الأوّل ص1–2، الثّاني ص3–4)؛ «الدّورة العاديّة» من اسم الملفّ. "
    f"الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{KEY_ID} (ص1 «During the Roman period…»، ص2 «Child labour refers to…»)؛ مجموع كلّ موضوع 20 "
    "(القراءة 14 = الفهم 07 + استكشاف النّصّ 07، التّعبير الكتابيّ 06). "
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّ PDF رقميّ له طبقة نصّ أصليّة، فأُخذت الحروف منها (pdftotext -raw: علامات الاقتباس "
    "المنحنية، «…»، «§»، «–»، نقاط الفراغات) وطوبقت سطرًا سطرًا مع صور الصّفحات (150 نقطة، ورؤوس جداول النّطق بـ400 نقطة)، وتُحقِّق بسكربت "
    "من أنّ كلّ نصّ حرفيّ وكلّ اقتباس في الخطوات جزء من طبقة النّصّ. خلاف طبقة النّصّ والصّورة: السّنة والمدّة في الرّأس العربيّ معكوسة "
    "(«0302»، «30 … 03») وصوابها في الصّورة «2026» و«03 سا و30 د»؛ رمز «/ɪd/» و«/ɪz/» مطبوع بحرف I كبير مصغَّر وطبقة النّصّ تكتبه «I» فحُفظ "
    "«/Id/» و«/Iz/» كما في الطّبقة؛ التّسطير والخطّ الغامق لا يظهران في طبقة النّصّ وحُدّدا من الصّورة. "
    "قرارات التّحويل (R1–R11 في محوّل التّجربة build_en_bac_2019_lit.py و D1–D7 في رأس هذا المحوّل): عنصر لكلّ بند يُنقَّط منفردًا؛ نعم/لا "
    "اختيار من خيارين مخزَّنان معكوسين؛ «نعم/لا + علّل» عنصران (0.25 + 0.75) كما في السّلّم؛ صيغ الحلّ المتعدّدة للإجابة نفسها تبقى تفاعليّة ولا "
    "تُعرض صيغة مقبولة مشتّتًا؛ جداول النّطق اختيار من متعدّد لكلّ كلمة (0.25) لأنّ كلمتين تقعان في العمود نفسه؛ إعادة التّرتيب: الجملة الافتتاحيّة "
    "وكلّ زوج منطقيّ (0.5 لكلّ منها)؛ ما يقبل فيه الحلّ «أيّ إجابة منطقيّة» (العنوان، الفكرة العامّة) مؤجَّل essay_builder؛ التّعبير الكتابيّ مؤجَّل "
    "بمعايير الشّبكة الرّسميّة «LE» (الملاءمة 1.5، الانسجام الدّلاليّ 1، سلامة اللّغة 2، الإتقان 1.5). ")
PAPER_NOTES = {
    1: ("الموضوع الأوّل: المسطَّر في النّصّ They (§1 «They became well-known»)، whose (§2 «Roman policy whose objective»)، It (§3 «It remained largely "
        "restricted»)، وفي B3 «to disseminate the ideals of the Roman cities.» و«in Souk Ahras.»؛ تذكر كلّ خطوة الجملة والجزء المسطَّر. "
        "تنبيه للمالك (D7): عمود /d/ في الحلّ «studied / replied» والورقة «represented - established - studied - applied»؛ «replied» ليست في "
        "الورقة و«applied» هي الكلمة الوحيدة الباقية بعد ملء الخانات الثّلاث الأخرى، فجُعلت /d/ — يُرجى التّأكّد. س3ج: «No» (0.25) والتّعليل (0.75) "
        "عنصران؛ التّعليل بلفظ النّصّ الّذي يقتبسه الحلّ («Access to education, however, was not open to all. It remained largely restricted to a "
        "specific social class.»؛ الحلّ يحذف «however»). س5 العنوان: «Accept any logical title» فمؤجَّل مع عنوان الحلّ نموذجًا. ملء الفراغات (0.5×4) "
        "خطوة واحدة لأنّ التّنقيط الجزئيّ للمحرّك يطابق السّلّم؛ البنك هو قائمة الورقة (6 كلمات لأربعة فراغات). المجموع 20 = 7 + 7 + 6 "
        "(تفاعليّ 13، مؤجَّل 7: العنوان 1 + التّعبير 6)."),
    2: ("الموضوع الثّاني: المسطَّر It (§1 «It includes tasks»)، where (§3 «factories, where they are exposed»). س3أ: «No» (0.25) والتّعليل (0.75) "
        "عنصران؛ التّعليل جملة النّصّ الّتي يختصرها الحلّ «…not all work is …can be beneficial.». س4ب: الحلّ يقبل «dangerous places / mines, "
        "farms or factories / dangerous places like mines, farms or factories» فعُرضت الصّيغة الثّالثة صحيحة ولم تُعرض الأخريان. س5 الفكرة العامّة: "
        "«Accept any logical answer» فمؤجَّلة مع جملة الحلّ نموذجًا. س B1 علامتها 0.25×2 وس A2 علامتها 0.25×2 كما في السّلّم. إعادة التّرتيب "
        "d - b - a - c: الافتتاحيّة + الأزواج d–b، b–a، a–c. المجموع 20 = 7 + 7 + 6 (تفاعليّ 13، مؤجَّل 7: الفكرة العامّة 1 + التّعبير 6)."),
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
