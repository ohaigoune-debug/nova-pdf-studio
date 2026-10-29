"""Conversion: BAC 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة لغات أجنبية – الموضوع الأوّل والثّاني.

Usage:  python3 scripts/play/converters/build_fr_bac_2026_lang.py <out.json> [1|2]
        (the paper number is taken from the file name «…-p1.json» / «…-p2.json» when not given)
then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- Paper: gdrive 1bKLTk8-0yBX0N-hrtIsAVDqQmkug9iX0 («2026 - اللغة الفرنسية - لغات أجنبية - الدورة العادية - الموضوع.pdf», 4 pages:
  sujet 1 pp. 1–2 «SOUFFLE VIVANT DE LA RÉVOLUTION», sujet 2 pp. 3–4 «Quand l’argent devient une névrose»). Header: «الدورة: 2026»,
  «الشعبة: لغات أجنبية», «المدة: 03 سا و30 د». Official ONEC digital PDF (pdffonts: embedded Traditional Arabic + Times New Roman).
- Official model answer + barème: gdrive 1QCiUu9WXfR6RdrGoIebyRgZf8Y0wr_4R («… - الحل.pdf», 3 pages: sujet 1 p. 1, sujet 2 p. 2,
  production écrite of both sujets p. 3), digital PDF. Every mark comes from its «مجزأة / مجموع» columns.

How the text was read: verbatim strings come from `pdftotext -raw` (exact typographic characters «’», «…», «« »», straight «'» where
the paper has them) and every line was checked against the 150-dpi page images; a small script checks that every verbatim string
is a substring of the text layer (whitespace collapsed, superscripts mapped back to digits, U+F02D mapped to «–»).
Text layer vs image (image wins):
- List dashes are the Symbol-font glyph U+F02D in the layer; the image shows «–» ⇒ written «–».
- Footnote calls «ode1», «l’exposition2», «déportés3», «névrose1», «orties2» are superscripts on the image ⇒ «¹ ² ³».
  Superscript «er» / «ème» ⇒ plain «1er», «3ème».
- Arabic header reversed in the layer (year «0302», duration «30 سا و 03 د»); the image reads «2026» and «03 سا و30 د».
- Kept as printed: straight apostrophes in «Ich'hadi», «l'argent» (options 2–3 of S2 Q1), «jusqu'à l'ennui» (S2 Q2), «quelqu'un».

Conversion decisions (FR pilot fr-bac-2019-lit + guide Appendix A, unified «accepter» rule):
- Streams: header «الشعبة: لغات أجنبية» ⇒ ["LANG"]. Session «الدورة العاديّة» from the Drive file title (paper prints «الدورة: 2026»).
- Totals printed on the paper: Compréhension 12 + Production écrite 08 (not 13 + 7).
- «n x m» lines: distinct statements / items ⇒ one element per item (V/F, pronouns, classification); interchangeable picks from
  the text ⇒ one element with one multi (S1 Q2, S1 Q3, S2 Q4); one matching task «0.25x4» (S1 Q6) ⇒ one element + one matching
  step (share-of-pairs grading = 0.25 per pair).
- «Accepter (aussi) : …» that only gives another wording of the same answer, or a closed list of alternatives, stays interactive:
  the correct option is the key's main wording, the explanation lists every accepted form, and no accepted form is ever a
  distractor (FORMS + assertion in _check()): S1 Q2 (un autre arsenal), S1 Q7 «ses», S2 Q3, S2 Q4, S2 Q7 «vous» / «je».
- Open answers are deferred (essay_builder, review_status needs_engine_support): Q8 «visée communicative» of both sujets
  («Accepter toute autre réponse allant dans le même sens»), Q9 of both sujets (four criteria 0.5x4, «à titre indicatif»),
  production écrite (8 pts).
- Production écrite: one original question holding both sujets; the two grids (compte rendu critique / production libre) have
  the same marks line by line, so 13 elements = the grid lines; «Structure adéquate 0.5x3» stays one element (1.5) because its
  three parts differ per sujet (accroche/condensation/critique vs introduction/développement/conclusion); each step's spec quotes
  both grids' own lines.
- Two-option mcq (Vrai/Faux, Au bonheur/A l’angoisse) are stored REVERSED (shuffle_exam_set.py always swaps two options).
- Distractors: never an answer the key lists or accepts; never an expression of the text that could be argued to fit.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper number: pass 1|2 or name the output …-p1.json / …-p2.json"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SLUG = "lang"
SET_ID = f"fr-bac-2026-{SLUG}-p{PAPER}"
STREAMS = ["LANG"]
PAPER_ID = "1bKLTk8-0yBX0N-hrtIsAVDqQmkug9iX0"
PAPER_TITLE = "2026 - اللغة الفرنسية - لغات أجنبية - الدورة العادية - الموضوع.pdf"
CORR_ID = "1QCiUu9WXfR6RdrGoIebyRgZf8Y0wr_4R"
CORR_TITLE = "2026 - اللغة الفرنسية - لغات أجنبية - الدورة العادية - الحل.pdf"
COMP_TOTAL, PE_TOTAL = 12, 8

# Two-option questions: display order on the paper. Stored reversed (the shuffle always swaps two options).
VF = ("Vrai", "Faux")
BA = ("Au bonheur", "A l’angoisse")
BINARY = [VF, BA]

Q, S = [], []
FORMS = {}  # element id -> every form the key accepts (none of them may be offered as a distractor)


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def mcq(sid, qid, eid, prompt, right, wrongs, expl, pts, skill, forms=None):
    """Right option first before shuffling; `forms` = every wording the key accepts (never offered as a distractor)."""
    if forms:
        FORMS[eid] = [right, *forms]
    st(sid, qid, eid, "mcq", prompt, {"options": [right, *wrongs]}, {"correct": 0}, expl, pts, skill)


def multi(sid, qid, eid, prompt, rights, wrongs, expl, pts, skill, forms=None):
    if forms:
        FORMS[eid] = [*rights, *forms]
    st(sid, qid, eid, "multi", prompt, {"options": [*rights, *wrongs]}, {"correct": list(range(len(rights)))}, expl, pts, skill)


def binary(sid, qid, eid, prompt, pair, right, expl, pts, skill):
    """mcq with two options shown in the paper's order `pair`; stored reversed so the mandatory shuffle restores that order."""
    assert right in pair
    stored = [pair[1], pair[0]]
    st(sid, qid, eid, "mcq", prompt, {"options": stored}, {"correct": stored.index(right)}, expl, pts, skill)


def essay(sid, qid, eid, prompt, spec, rubric, expl, pts, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": prompt, "payload": {"type": "essay_builder", "spec": spec},
              "answer": {"type": "essay_builder", "spec": {"rubric": rubric, **({"model_answer": spec["model_answer"]} if spec.get("model_answer") else {}),
                                                            **({"accepted": spec["accepted"]} if spec.get("accepted") else {})}},
              "explanation": expl, "points": pts, "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


def criteria_question(qid, first_sid, number, part, verbatim, crits, model, acceptance, skill, docs):
    """«Critères d’évaluation» 0.5x4 of an open answer (two to three lines) ⇒ four deferred criteria (one element each)."""
    els = []
    for k, (crit, indicator) in enumerate(crits, 1):
        eid = f"{qid}-e{k}"
        els.append(el(eid, f"Critère : {crit} (0,5)", 0.5))
        essay(f"s{first_sid + k - 1:02d}", qid, eid, f"Question {number} — réponse rédigée en deux à trois lignes, critère : {crit}",
              {"task": verbatim, "lines": [2, 3], "criterion": crit, "indicator": indicator, "model_answer": model, "acceptance": acceptance,
               "barème": "0.5x4 — Critères d’évaluation : " + " / ".join(c for c, _ in crits),
               "deferred_because": "réponse ouverte (le corrigé ne donne qu’un exemple à titre indicatif)"},
              indicator, f"Réponse ouverte corrigée avec les critères officiels (0,5 chacun). Exemple du corrigé ({acceptance}) : {model}",
              0.5, skill)
    q(qid, number, part, verbatim, 2, els, docs)


# Production écrite grid — (suffix, label, points, criterion, sujet-1 barème line, sujet-2 barème line), corrigé p. 3.
PE_GRID_NAMES = ("Compte rendu critique", "Production libre")
PE_EXPL = ("La production écrite est corrigée avec la grille officielle du sujet choisi (organisation de la production 3 pts, "
           "planification de la production 2 pts, utilisation de la langue de façon appropriée 3 pts).")
PE_GRID = [
    ("e1", "Organisation : présentation du texte (mise en page, lisibilité)", 0.5, "Présentation du texte",
     "0.5 — Présentation du texte (mise en page, lisibilité)", "0.5 — Présentation du texte (mise en page, lisibilité)."),
    ("e2", "Organisation : cohérence — progression des informations", 0.25, "Progression des informations",
     "0.25 (0.25x 4 Cohérence du texte) — progression des informations", "0.25 (0.25x 4 Cohérence du texte) — progression des informations"),
    ("e3", "Organisation : cohérence — absence de répétitions", 0.25, "Absence de répétitions",
     "0.25 (0.25x 4 Cohérence du texte) — absence de répétitions", "0.25 (0.25x 4 Cohérence du texte) — absence de répétitions"),
    ("e4", "Organisation : cohérence — absence de contresens", 0.25, "Absence de contresens",
     "0.25 (0.25x 4 Cohérence du texte) — absence de contresens", "0.25 (0.25x 4 Cohérence du texte) — absence de contresens"),
    ("e5", "Organisation : cohérence — emploi de connecteurs", 0.25, "Emploi de connecteurs",
     "0.25 (0.25x 4 Cohérence du texte) — emploi de connecteurs", "0.25 (0.25x 4 Cohérence du texte) — emploi de connecteurs"),
    ("e6", "Organisation : structure adéquate", 1.5, "Structure adéquate",
     "0.5x3 — Structure adéquate [accroche (0.5) - condensation (0.5) – critique (0.5)]",
     "0.5x3 — Structure adéquate [Introduction - développement - conclusion]"),
    ("e7", "Planification : choix énonciatif en relation avec la consigne", 1, "Choix énonciatif",
     "1 — Choix énonciatif en relation avec la consigne", "1 — Choix énonciatif en relation avec la consigne"),
    ("e8", "Planification : choix et sélection des informations", 1, "Choix des informations",
     "1 — Sélection des informations essentielles (condensation et reformulation)", "1 — Choix des informations (originalité et pertinence des idées)"),
    ("e9", "Langue : correction des phrases au plan syntaxique", 1, "Correction syntaxique",
     "1 — Correction des phrases au plan syntaxique", "1 — Correction des phrases au plan syntaxique"),
    ("e10", "Langue : lexique approprié à la thématique", 0.5, "Lexique approprié",
     "0.5 — Emploi d’un lexique approprié à la thématique", "0.5 — Emploi d’un lexique approprié à la thématique"),
    ("e11", "Langue : emploi correct des temps et des modes", 0.5, "Temps et modes",
     "0.5 — Emploi correct des temps et des modes", "0.5 — Emploi correct des temps et des modes"),
    ("e12", "Langue : utilisation adéquate des signes de ponctuation", 0.5, "Ponctuation",
     "0.5 — Utilisation adéquate des signes de ponctuation", "0.5 — Utilisation adéquate des signes de ponctuation"),
    ("e13", "Langue : orthographe", 0.5, "Orthographe",
     "0.5 — Orthographe (pas plus de 10 erreurs)", "0.5 — Orthographe (pas, plus de 10 erreurs)"),
]


def production(qid, first_sid, part, verbatim, sujets, docs):
    s1name, s2name = PE_GRID_NAMES
    q(qid, "—", part, verbatim, PE_TOTAL, [el(f"{qid}-{suf}", label, pts) for suf, label, pts, *_ in PE_GRID], docs)
    for k, (suf, label, pts, crit, l1, l2) in enumerate(PE_GRID):
        essay(f"s{first_sid + k:02d}", qid, f"{qid}-{suf}", f"Production écrite (un sujet au choix) — critère : {crit}",
              {"task": "Production écrite — traitez l’un des deux sujets suivants", "sujets": sujets, "criterion": crit, "indicator": label,
               "per_sujet": {f"Sujet 1 — grille « {s1name} »": l1, f"Sujet 2 — grille « {s2name} »": l2}},
              label, PE_EXPL, pts, "fr.ecriture")


# ════════════════════════════════════ SUJET 1 ════════════════════════════════════
def build_p1():
    title = "SOUFFLE VIVANT DE LA RÉVOLUTION"
    text = "\n".join([
        "Durant la guerre de Libération nationale (1954-1962), l’Algérie s’est battue avec des fusils certes, mais aussi avec des voix. "
        "Dans les maquis, les prisons, les villages encerclés et jusque dans les camps de réfugiés, un autre arsenal circulait de bouche à "
        "oreille : le chant patriotique. Ces mélodies furent le langage d’une révolte et la respiration d’un peuple.",
        "Le plus emblématique de ces chants reste Kassaman (Nous jurons), hymne national depuis 1963. En 1955, dans une cellule coloniale, "
        "le poète Moufdi Zakaria trace des vers sur les murs blanchis à la chaux : « Nous jurons par la foudre dévastatrice, par les flots "
        "ruisselants de sang pur. » Kassaman devint un serment collectif, un cri de ralliement dans les maquis, la promesse d’une "
        "indépendance à venir.",
        "Bien avant la guerre, des chants annonçaient déjà la naissance d’une conscience nationale. En 1931, Mohamed El Aïd Al Khalifa "
        "compose Min jibalina (De nos montagnes). Ses paroles, exaltant la dignité et la jeunesse, ont formé une génération prête à défendre "
        "la patrie. Au lycée de Ben Aknoun durant les années 1940, le jeune Mohand Idir Aït Amrane compose Ekker a mmis umazigh (Debout, "
        "fils d’Amazigh), ode¹ en kabyle à la liberté et à la fierté ancestrale. […]",
        "En 1931, Houari Hennani écrivait S’hab el baroud (Les compagnons de la poudre), dénonçant l’exposition² coloniale française comme "
        "une provocation et appelant à la révolte. Dans l’Ouest du pays, cette chanson se transmettait comme un poème clandestin, brûlant et "
        "indomptable. Dans les Aurès, le chant chaoui Tayara Safra (Avion jaune) faisait vibrer les montagnes insurgées. […] D’autres titres, "
        "souvent entonnés collectivement, accompagnaient les maquisards dans leurs combats. […] Dans Ich'hadi ya sama (Témoigne, ô ciel), "
        "la prière et la poésie se confondaient dans un même élan vers la liberté. La guerre, c’était aussi l’exil et la solitude. En 1959, "
        "derrière les barreaux, Akli Yahyaten compose Yal menfi (Le banni), inspiré d’un ancien chant kabyle de déportés³.",
        "[…] Aujourd’hui encore, dans les écoles, les stades ou les commémorations, ces mélodies résonnent. Elles rappellent que "
        "l’indépendance algérienne n’a pas été un hasard, mais une conquête arrachée par le courage et par le chant. Car en Algérie, avant "
        "même que la liberté ne s’écrive dans le sang, elle était déjà chantée.",
    ])
    source = "Sihem OUBRAHAM, El Moudjahid, du 01 novembre 2025."
    gloss = ("1. Ode : poème.\n2. Exposition : festivité pour célébrer le centenaire de la colonisation par les Français en 1930.\n"
             "3. Déportés : personnes déplacées de force loin de leur patrie.")
    docs = [
        {"id": "d-title", "kind": "text", "caption": "Titre du texte", "text": title},
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Mots expliqués", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (12 points)"
    P2 = "II. Production écrite : (08 points)"
    QT = {
        1: "Dans ce texte, le sujet principal est :\n– le chant patriotique comme moyen de résistance.\n– le chant patriotique comme moyen de "
           "divertissement.\n– le chant patriotique comme moyen de démonstration artistique.\nRecopiez la bonne réponse.",
        2: "Identifiez, dans le 1er paragraphe, les deux (02) expressions qui qualifient le chant patriotique.",
        3: "Relevez, du texte, les trois (03) valeurs symboliques de l’hymne national durant la révolution.",
        4: "Trouvez, dans le texte, la phrase qui montre que les chants patriotiques sont restés dans la mémoire collective même après "
           "l’indépendance.",
        5: "Répondez par « vrai » ou « faux » :\na) Les chants patriotiques n’étaient entonnés que dans les villes.\nb) Kassaman a été écrit "
           "dans une prison.\nc) La conscience nationale est née après 1954.\nd) La poésie servait le chant patriotique.",
        6: "Soit les propositions suivantes :\nglorifier les origines et les racines / exprimer la douleur du déracinement / stimuler la "
           "fierté des jeunes / inciter à la lutte.\nAssociez chacune d’elles à la chanson engagée qui lui correspond.\n"
           "– Min jibalina : " + "…" * 18 + ".." + "\n– S’hab el baroud : " + "…" * 17 + "\n– Ekker a mmis umazigh : " + "…" * 14
           + "\n– Yal menfi : " + "…" * 19 + ".",
        7: "Déterminez à qui ou à quoi renvoie chacun des pronoms : « ses », « elles » et « elle » dans les énoncés ci-dessous :\n"
           "– « Ses paroles, exaltant la dignité… » 3ème paragraphe\n– « Elles rappellent que l’indépendance… » 5ème paragraphe\n"
           "– « …, elle était déjà chantée. » 5ème paragraphe",
        8: "Formulez, en une phrase, la visée communicative de la journaliste.",
        9: "« …, avant même que la liberté ne s’écrive dans le sang, elle était déjà chantée. »\nOutre les armes et les chants, les Algériens "
           "avaient-ils utilisé d’autres moyens pour résister au colonialisme ? Justifiez, en deux à trois lignes, votre réponse.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu critique",
         "consigne": "A l’occasion de la journée nationale de l’artiste, le centre culturel de votre commune vous associe à faire découvrir "
                     "aux jeunes de la ville les artistes qui ont participé à la lutte armée. Rédigez le compte rendu critique de ce texte "
                     "(150 mots environ) que vous lirez aux invités présents."},
        {"id": "Sujet 2", "kind": "production libre (texte argumentatif)",
         "consigne": "La maison de culture de votre commune organise une journée sur le thème : « La place de l’artiste dans la société "
                     "d’aujourd’hui. » Vous êtes invité(e) à y participer. Rédigez un texte (150 mots environ) en vue de convaincre "
                     "l’opinion publique du rôle essentiel de l’artiste dans la représentation et la valorisation de notre patrimoine "
                     "culturel. Vous lirez votre écrit lors de cette rencontre."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 1) ──
    q("q1", "1", P1, QT[1], 1, [el("q1-e1", "Sujet principal du texte", 1)], docs)
    q("q2", "2", P1, QT[2], 1, [el("q2-e1", "Deux expressions qualifiant le chant patriotique (§1) (0,5x2)", 1)], docs)
    q("q3", "3", P1, QT[3], 1.5, [el("q3-e1", "Trois valeurs symboliques de l’hymne national (0,5x3)", 1.5)], docs)
    q("q4", "4", P1, QT[4], 1, [el("q4-e1", "Phrase sur la mémoire collective après l’indépendance", 1)], docs)
    stm5 = [("a", "Les chants patriotiques n’étaient entonnés que dans les villes.", "Faux",
             "« Dans les maquis, les prisons, les villages encerclés et jusque dans les camps de réfugiés, un autre arsenal circulait de bouche à oreille : le chant patriotique. » (§1)"),
            ("b", "Kassaman a été écrit dans une prison.", "Vrai",
             "« En 1955, dans une cellule coloniale, le poète Moufdi Zakaria trace des vers sur les murs blanchis à la chaux » (§2)."),
            ("c", "La conscience nationale est née après 1954.", "Faux",
             "« Bien avant la guerre, des chants annonçaient déjà la naissance d’une conscience nationale. En 1931… » (§3)."),
            ("d", "La poésie servait le chant patriotique.", "Vrai",
             "Le corrigé écrit : « La poésie servait de chant patriotique. Vrai ». Kassaman : « le poète Moufdi Zakaria trace des vers » (§2).")]
    q("q5", "5", P1, QT[5], 2, [el(f"q5-e{k}", f"Affirmation {x[0]}) (0,5)", 0.5) for k, x in enumerate(stm5, 1)], docs)
    q("q6", "6", P1, QT[6], 1, [el("q6-e1", "Association proposition ↔ chanson engagée (0,25x4)", 1)], docs)
    q("q7", "7", P1, QT[7], 1.5, [el("q7-e1", "Référent de « ses » (3ème paragraphe) (0,5)", 0.5),
                                  el("q7-e2", "Référent de « Elles » (5ème paragraphe) (0,5)", 0.5),
                                  el("q7-e3", "Référent de « elle » (5ème paragraphe) (0,5)", 0.5)], docs)
    q("q8", "8", P1, QT[8], 1, [el("q8-e1", "Visée communicative de la journaliste (réponse ouverte)", 1)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, le sujet principal est : (choisissez la bonne réponse)",
        "le chant patriotique comme moyen de résistance.",
        ["le chant patriotique comme moyen de divertissement.", "le chant patriotique comme moyen de démonstration artistique."],
        "Corrigé : « le chant patriotique comme moyen de résistance. »", 1, "fr.comprehension")
    multi("s02", "q2", "q2-e1", "Dans le premier paragraphe (§1), sélectionnez les deux expressions qui qualifient le chant patriotique.",
          ["le langage d’une révolte", "la respiration d’un peuple"], ["des fusils", "les villages encerclés", "les camps de réfugiés"],
          "Corrigé : « le langage d’une révolte » ; « la respiration d’un peuple » (0,5 chacune). Accepter : « un autre arsenal ».",
          1, "fr.vocabulaire", forms=["un autre arsenal"])
    multi("s03", "q3", "q3-e1", "Sélectionnez les trois valeurs symboliques de l’hymne national durant la révolution, relevées dans le texte.",
          ["un serment collectif", "un cri de ralliement", "la promesse d’une indépendance"],
          ["un chant de déportés", "une ode à la fierté ancestrale"],
          "Corrigé : « un serment collectif - un cri de ralliement - la promesse d’une indépendance » (0,5 chacune) : « Kassaman devint un "
          "serment collectif, un cri de ralliement dans les maquis, la promesse d’une indépendance à venir. » (§2)", 1.5, "fr.comprehension")
    mcq("s04", "q4", "q4-e1",
        "Quelle phrase du texte montre que les chants patriotiques sont restés dans la mémoire collective même après l’indépendance ?",
        "Aujourd’hui encore, dans les écoles, les stades ou les commémorations, ces mélodies résonnent.",
        ["Ces mélodies furent le langage d’une révolte et la respiration d’un peuple.",
         "Kassaman devint un serment collectif, un cri de ralliement dans les maquis, la promesse d’une indépendance à venir.",
         "D’autres titres, souvent entonnés collectivement, accompagnaient les maquisards dans leurs combats."],
        "Corrigé : « Aujourd’hui encore, dans les écoles, les stades ou les commémorations, ces mélodies résonnent. »", 1, "fr.comprehension")
    for k, (letter, stmt, right, why) in enumerate(stm5, 1):
        binary(f"s{4 + k:02d}", "q5", f"q5-e{k}", f"Vrai ou faux : « {stmt} »", VF, right,
               f"Corrigé : {right}. {why} (Ne pas pénaliser le candidat qui ne recopie pas les propositions.)", 0.5, "fr.comprehension")
    st("s09", "q6", "q6-e1", "matching", "Associez chaque chanson engagée à la proposition qui lui correspond.",
       {"lefts": ["Min jibalina", "S’hab el baroud", "Ekker a mmis umazigh", "Yal menfi"],
        "rights": ["glorifier les origines et les racines", "exprimer la douleur du déracinement", "stimuler la fierté des jeunes",
                   "inciter à la lutte"]},
       {"pairs": [2, 3, 0, 1]},
       "Corrigé : Min jibalina : stimuler la fierté des jeunes. S’hab el baroud : inciter à la lutte. Ekker a mmis umazigh : glorifier "
       "les origines et les racines. Yal menfi : exprimer la douleur du déracinement. (0,25 par association)", 1, "fr.comprehension")
    mcq("s10", "q7", "q7-e1", "« Ses paroles, exaltant la dignité… » (§3) : à qui ou à quoi renvoie « ses » ?",
        "les paroles de Mohamed El Aïd Al Khalifa",
        ["les paroles de Moufdi Zakaria", "les paroles de Mohand Idir Aït Amrane", "les paroles de Houari Hennani"],
        "Corrigé : « ses » = les paroles de Mohamed El Aïd Al Khalifa / les paroles de Min jibalina. (Accepter aussi : Mohamed El Aïd Al "
        "Khalifa / Min jibalina / De nos montagnes)", 0.5, "fr.discours",
        forms=["les paroles de Min jibalina", "Mohamed El Aïd Al Khalifa", "Min jibalina", "De nos montagnes"])
    mcq("s11", "q7", "q7-e2", "« Elles rappellent que l’indépendance… » (§5) : à quoi renvoie « Elles » ?",
        "ces mélodies", ["les stades", "les montagnes insurgées", "les camps de réfugiés"],
        "Corrigé : « Elles » = ces mélodies.", 0.5, "fr.discours")
    mcq("s12", "q7", "q7-e3", "« …, elle était déjà chantée. » (§5) : à quoi renvoie « elle » ?",
        "la liberté", ["la guerre", "la solitude", "la foudre"],
        "Corrigé : « elle » = la liberté. « avant même que la liberté ne s’écrive dans le sang, elle était déjà chantée. »", 0.5, "fr.discours")
    model8 = ["Informer de l’apport des chants patriotiques à la résistance contre le colonialisme.",
              "Rendre hommage aux poètes et aux chanteurs pour leur contribution durant la lutte de libération."]
    essay("s13", "q8", "q8-e1", "Formulez, en une phrase, la visée communicative de la journaliste (réponse rédigée)",
          {"task": QT[8], "criterion": "Visée communicative de la journaliste", "model_answer": " ou ".join(model8),
           "accepted": ["Accepter toute autre réponse allant dans le même sens."],
           "deferred_because": "réponse ouverte : le corrigé accepte « toute autre réponse allant dans le même sens »"},
          "- Informer de l’apport des chants patriotiques à la résistance contre le colonialisme. ou - Rendre hommage aux poètes et aux "
          "chanteurs pour leur contribution durant la lutte de libération. (Accepter toute autre réponse allant dans le même sens.)",
          "Corrigé : « Informer de l’apport des chants patriotiques à la résistance contre le colonialisme. » ou « Rendre hommage aux poètes et "
          "aux chanteurs pour leur contribution durant la lutte de libération. » (Accepter toute autre réponse allant dans le même sens.)",
          1, "fr.enonciation")
    model9 = ("Oui, les Algériens ont utilisé d’autres moyens pour résister au colonialisme : le boycott des produits français, les grèves "
              "générales, la préservation de leurs traditions et de leur culture, le théâtre, la littérature et le sport...")
    criteria_question("q9", 14, "9", P1, QT[9],
                      [("Respect de la consigne", "Respect de la consigne : prise de position avec justification et le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées : A titre indicatif, on cite l’exemple suivant : " + model9),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model9, "à titre indicatif", "fr.ecriture", docs)
    production("q10", 18, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة لغات أجنبية – الموضوع الأوّل («SOUFFLE VIVANT DE LA RÉVOLUTION»، El Moudjahid)",
            ["س2 «0.5 x 2» ⇒ عنصر واحد (1) بخطوة multi باختيارين صحيحين (عبارتا الحلّ)؛ «Accepter : un autre arsenal» لا يُعرض مشتّتًا؛ "
             "المشتّتات من الفقرة 1 لا تصف الأنشودة (des fusils، les villages encerclés، les camps de réfugiés) ولم يُعرض «des voix» لأنّه قابل للدّفاع.",
             "س3 «0.5x3» ⇒ عنصر واحد (1.5) بخطوة multi (ثلاثة صحيحة + مشتّتان منسوبان في النّصّ إلى أناشيد أخرى).",
             "س5د: الورقة «La poésie servait le chant patriotique.» والحلّ «…servait de chant patriotique. Vrai» ⇒ نُقلت صيغة الورقة في السّؤال.",
             "س6 «0.25x4» ⇒ عنصر واحد بخطوة matching (التّنقيط بحصّة الأزواج = 0.25 للزّوج)، بلا مشتّت إضافيّ.",
             "س7 «ses»: الخيار الصّحيح صيغة الحلّ الأولى «les paroles de Mohamed El Aïd Al Khalifa»، والصّيغ المقبولة الأخرى (Min jibalina، De nos "
             "montagnes…) ليست مشتّتات.",
             "س8 (1) مؤجَّل: «Accepter toute autre réponse allant dans le même sens». س9: «0.5x4» معايير ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (8): شبكتا «Compte rendu critique» و«Production libre» متطابقتان في العلامات سطرًا بسطر ⇒ 13 عنصرًا؛ «Structure adéquate "
             "0.5x3» عنصر واحد (1.5) لأنّ أجزاءه تختلف بين الموضوعين."])


# ════════════════════════════════════ SUJET 2 ════════════════════════════════════
def build_p2():
    title = "Quand l’argent devient une névrose¹"
    text = "\n".join([
        "La sagesse populaire répète jusqu’à la nausée que l’argent ne fait pas le bonheur. Et pourtant, quelle belle chose que l’argent ! "
        "N’est-il pas le signe et la trace de l’énergie formidable que nous déployons tous à nous adapter au monde ?",
        "Certes, il en est de cette énergie comme de toutes les autres ; il faut la manier avec d’infinies précautions car, de motrice, elle "
        "devient destructrice. L’argent fait indifféremment le bien ou le mal. Mais dans un cas comme dans l’autre, n’oublions pas qu’il n’y "
        "est pour rien et que seul l’utilisateur est en cause. Ne jetons donc pas tout de suite l’argent aux orties². […]",
        "L’argent n’est qu’un moyen et, comme tel, il ne mérite pas de devenir tabou. Vous voulez en gagner le plus possible ? Allez-y, ne vous "
        "gênez pas. La vie nous fait un cadeau : pourquoi ne pas en profiter ? L’argent est comme l’air qu’on respire, il y en a autant qu’on "
        "veut. Car, contrairement à une idée très répandue de nos jours, j’avance que la richesse du monde est inépuisable.",
        "Bien sûr, faire fortune n’est pas donné à tout le monde. Mais qui a dit que le monde était donné ? L’abondance est potentielle, à "
        "nous de fournir les efforts nécessaires pour la conquérir. Car je ne connais personne qui n’ait amassé de biens sans se donner les "
        "moyens d’y parvenir. […]",
        "Ce qui rend la vie passionnante, c’est précisément que nous soyons tous différents, intellectuellement, physiquement et même "
        "matériellement. C’est parce que nous ne sommes pas semblables qu’il peut s’établir entre nous un jeu, des relations, des conflits, "
        "de l’amour. Je crois que se reconnaître soi-même comme unique, c’est déjà supprimer une grande partie de notre attrait pour "
        "l’argent. […]",
        "Se reconnaître soi-même, c’est déjà reconnaître l’extraordinaire simplicité de nos besoins naturels : si tout fonctionne bien dans "
        "notre tête, nous pouvons être heureux avec un peu de nourriture, des vêtements et un toit. C’est parce que nous ne nous "
        "reconnaissons pas que nous courons après la voiture de luxe, le fauteuil du directeur ou le manteau de fourrure… Nous comptons sur "
        "les objets extérieurs pour dire qui nous sommes.",
    ])
    source = "Dr. Etienne JALENQUES*, La thérapie du bonheur,\nEd. Marabout / Hachette Livre 2002, pp. 134-137."
    gloss = ("*Dr. E. JALENQUES : médecin psychiatre.\n1. Névrose : obsession, anxiété excessive liée à l’argent.\n"
             "2. Jeter aux orties : abandonner quelqu'un, ou quelque chose.")
    docs = [
        {"id": "d-title", "kind": "text", "caption": "Titre du texte", "text": title},
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Notes", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (12 points)"
    P2 = "II. Production écrite : (08 points)"
    QT = {
        1: "Dans ce texte, le sujet principal est :\n– l’attrait pour l’argent comme unique source de bonheur personnel.\n– l’attrait pour "
           "l'argent comme seul moteur de réussite sociale.\n– l’attrait pour l'argent comme facteur possible de déstabilisation psychique.\n"
           "Recopiez la bonne réponse.",
        2: "« La sagesse populaire répète jusqu’à la nausée que l’argent ne fait pas le bonheur. »\nDans cette phrase, l’expression « répète "
           "jusqu’à la nausée » veut dire :\n– répète jusqu’à l’accord.\n– répète jusqu'à l'ennui.\n– répète jusqu’au refus.\n"
           "Recopiez la bonne réponse.",
        3: "« …la richesse du monde est inépuisable… »\nRelevez, du 3ème paragraphe, la phrase qui justifie cette affirmation.",
        4: "« Pour que la vie soit passionnante, on ne doit pas courir uniquement après l’argent. »\nTrouvez, dans le texte, deux (02) raisons "
           "qui rendent la vie plus intéressante.",
        5: "Répondez par « vrai » ou « faux » :\na) L’énergie ne doit pas être utilisée avec beaucoup d’attention.\nb) La richesse dans le "
           "monde est une ressource abondante et disponible.\nc) La fortune est possible pour celui qui ne sait pas mettre les moyens.\n"
           "d) Pour être heureux, l’homme doit se satisfaire de ce qu’il possède.",
        6: "Soit les expressions suivantes :\nénergie destructrice / acceptation de soi / fascination pour l’argent / énergie motrice / "
           "besoins superflus / simplicité des besoins.\nClassez-les selon qu’elles renvoient :\n– Au bonheur : "
           + "…" * 12 + "." + "…" + ".." + "…" * 7 + "\n– A l’angoisse : " + "…" * 5 + "." + "…" * 9 + "..." + "…" * 6,
        7: "Déterminez à qui ou à quoi renvoie chacun des pronoms : « il », « elle », « vous », et « je » dans les énoncés ci-dessous :\n"
           "– « N’est-il pas le signe… » 1er paragraphe\n– « …elle devient destructrice. » 2ème paragraphe\n"
           "– « …ne vous gênez pas. » 3ème paragraphe\n– « car je ne connais personne… » 4ème paragraphe",
        8: "Formulez, en une phrase, la visée communicative de l’auteur.",
        9: "« Je crois que se reconnaître soi-même comme unique, c’est déjà supprimer une grande partie de notre attrait pour l’argent. »\n"
           "Partagez-vous cet avis ? Justifiez, en deux à trois lignes, votre réponse.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu critique",
         "consigne": "Votre établissement organise un débat sur le thème « Argent et bonheur ». Vous êtes invité(e) à y participer. Ce texte "
                     "vous a plu. Rédigez son compte rendu critique (150 mots environ) que vous partagerez avec les invités à ce débat."},
        {"id": "Sujet 2", "kind": "production libre (appel)",
         "consigne": "En votre qualité de membre du club de lecture, vous êtes sollicité(e) par l’administration de votre lycée pour l’aider "
                     "à lutter contre le désintérêt de nombreux apprenants aux études : l’indiscipline, l’absentéisme, etc. Rédigez un appel "
                     "(150 mots environ) pour encourager vos camarades à se réinvestir pleinement dans leurs apprentissages afin de garantir "
                     "leur avenir. Votre texte sera publié sur le journal mural du lycée."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 2) ──
    q("q1", "1", P1, QT[1], 1, [el("q1-e1", "Sujet principal du texte", 1)], docs)
    q("q2", "2", P1, QT[2], 0.5, [el("q2-e1", "Sens de l’expression « répète jusqu’à la nausée »", 0.5)], docs)
    q("q3", "3", P1, QT[3], 1, [el("q3-e1", "Phrase du 3ème paragraphe qui justifie l’affirmation", 1)], docs)
    q("q4", "4", P1, QT[4], 1, [el("q4-e1", "Deux raisons qui rendent la vie plus intéressante (0,5x2)", 1)], docs)
    stm5 = [("a", "L’énergie ne doit pas être utilisée avec beaucoup d’attention.", "Faux",
             "« il faut la manier avec d’infinies précautions » (§2)."),
            ("b", "La richesse dans le monde est une ressource abondante et disponible.", "Vrai",
             "« il y en a autant qu’on veut. […] la richesse du monde est inépuisable » (§3)."),
            ("c", "La fortune est possible pour celui qui ne sait pas mettre les moyens.", "Faux",
             "« je ne connais personne qui n’ait amassé de biens sans se donner les moyens d’y parvenir » (§4)."),
            ("d", "Pour être heureux, l’homme doit se satisfaire de ce qu’il possède.", "Vrai",
             "« nous pouvons être heureux avec un peu de nourriture, des vêtements et un toit » (§6).")]
    q("q5", "5", P1, QT[5], 2, [el(f"q5-e{k}", f"Affirmation {x[0]}) (0,5)", 0.5) for k, x in enumerate(stm5, 1)], docs)
    items6 = [("énergie destructrice", BA[1]), ("acceptation de soi", BA[0]), ("fascination pour l’argent", BA[1]),
              ("énergie motrice", BA[0]), ("besoins superflus", BA[1]), ("simplicité des besoins", BA[0])]
    q("q6", "6", P1, QT[6], 1.5, [el(f"q6-e{k}", f"Classement de « {it} » (0,25)", 0.25) for k, (it, _) in enumerate(items6, 1)], docs)
    q("q7", "7", P1, QT[7], 2, [el("q7-e1", "Référent de « il » (1er paragraphe) (0,5)", 0.5),
                                el("q7-e2", "Référent de « elle » (2ème paragraphe) (0,5)", 0.5),
                                el("q7-e3", "Référent de « vous » (3ème paragraphe) (0,5)", 0.5),
                                el("q7-e4", "Référent de « je » (4ème paragraphe) (0,5)", 0.5)], docs)
    q("q8", "8", P1, QT[8], 1, [el("q8-e1", "Visée communicative de l’auteur (réponse ouverte)", 1)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, le sujet principal est : (choisissez la bonne réponse)",
        "l’attrait pour l'argent comme facteur possible de déstabilisation psychique.",
        ["l’attrait pour l’argent comme unique source de bonheur personnel.", "l’attrait pour l'argent comme seul moteur de réussite sociale."],
        "Corrigé : « l’attrait pour l'argent comme facteur possible de déstabilisation psychique. »", 1, "fr.comprehension")
    mcq("s02", "q2", "q2-e1", "« La sagesse populaire répète jusqu’à la nausée que l’argent ne fait pas le bonheur. » L’expression "
        "« répète jusqu’à la nausée » veut dire :", "répète jusqu'à l'ennui.", ["répète jusqu’à l’accord.", "répète jusqu’au refus."],
        "Corrigé : « répète jusqu’à l’ennui. »", 0.5, "fr.vocabulaire")
    mcq("s03", "q3", "q3-e1", "« …la richesse du monde est inépuisable… » Quelle phrase du 3ème paragraphe (§3) justifie cette affirmation ?",
        "L’argent est comme l’air qu’on respire, il y en a autant qu’on veut.",
        ["L’argent n’est qu’un moyen et, comme tel, il ne mérite pas de devenir tabou.", "Vous voulez en gagner le plus possible ?",
         "Allez-y, ne vous gênez pas."],
        "Corrigé : « L’argent est comme l’air qu’on respire, il y en a autant qu’on veut. » Accepter aussi : « il y en a autant qu’on veut. »",
        1, "fr.comprehension", forms=["il y en a autant qu’on veut."])
    multi("s04", "q4", "q4-e1", "« Pour que la vie soit passionnante, on ne doit pas courir uniquement après l’argent. » Sélectionnez les deux "
          "raisons qui, selon le texte, rendent la vie plus intéressante.",
          ["Etre tous différents intellectuellement et/ou physiquement et/ou matériellement.", "Se reconnaître soi-même comme unique."],
          ["Amasser des biens sans fournir d’efforts.", "Courir après la voiture de luxe et le fauteuil du directeur.",
           "Compter sur les objets extérieurs pour dire qui nous sommes."],
          "Corrigé : « Etre tous différents intellectuellement et/ou physiquement et/ou matériellement. » ; « Se reconnaître soi-même comme "
          "unique. » (0,5 chacune). Accepter aussi : « Nous ne sommes pas semblables qu’il peut s’établir entre nous un jeu et/ou des relations "
          "et/ou des conflits et/ou de l’amour. »", 1, "fr.comprehension",
          forms=["Nous ne sommes pas semblables qu’il peut s’établir entre nous un jeu et/ou des relations et/ou des conflits et/ou de l’amour."])
    for k, (letter, stmt, right, why) in enumerate(stm5, 1):
        binary(f"s{4 + k:02d}", "q5", f"q5-e{k}", f"Vrai ou faux : « {stmt} »", VF, right,
               f"Corrigé : {right}. {why} (Ne pas pénaliser le candidat qui ne recopie pas les propositions.)", 0.5, "fr.comprehension")
    CLS = ("Corrigé — Facteur de bonheur : acceptation de soi / énergie motrice / simplicité des besoins ; Facteur d’angoisse : énergie "
           "destructrice / fascination pour l’argent / besoins superflus.")
    for k, (it, right) in enumerate(items6, 1):
        binary(f"s{8 + k:02d}", "q6", f"q6-e{k}", f"Classez « {it} » : cette expression renvoie…", BA, right, CLS, 0.25, "fr.vocabulaire")
    mcq("s15", "q7", "q7-e1", "« N’est-il pas le signe… » (§1) : à quoi renvoie « il » ?", "l’argent", ["le bonheur", "le monde", "le signe"],
        "Corrigé : « il » = l’argent.", 0.5, "fr.discours")
    mcq("s16", "q7", "q7-e2", "« …elle devient destructrice. » (§2) : à quoi renvoie « elle » ?", "cette énergie",
        ["la sagesse populaire", "la nausée", "la vie"], "Corrigé : « elle » = cette énergie.", 0.5, "fr.discours")
    mcq("s17", "q7", "q7-e3", "« …ne vous gênez pas. » (§3) : à qui renvoie « vous » ?", "les lecteurs",
        ["l’auteur", "la sagesse populaire", "les objets extérieurs"],
        "Corrigé : « vous » = les lecteurs / destinataires / personnes attirées par l’argent.", 0.5, "fr.discours",
        forms=["destinataires", "les destinataires", "personnes attirées par l’argent", "les personnes attirées par l’argent"])
    mcq("s18", "q7", "q7-e4", "« car je ne connais personne… » (§4) : à qui renvoie « je » ?", "l’auteur",
        ["le lecteur", "l’utilisateur", "la sagesse populaire"],
        "Corrigé : « Je » = l’auteur. (Accepter aussi : le médecin / le psychiatre / l’écrivain / le thérapeute / Dr. Etienne JALENQUES.)",
        0.5, "fr.discours", forms=["le médecin", "le psychiatre", "l’écrivain", "le thérapeute", "Dr. Etienne JALENQUES"])
    model8 = ["L'auteur de ce texte conseille de ne pas se laisser obséder par l'argent.",
              "Il défend l’idée que le bonheur ne dépend pas de la richesse matérielle, mais de la reconnaissance de soi et de la satisfaction "
              "des besoins essentiels."]
    essay("s19", "q8", "q8-e1", "Formulez, en une phrase, la visée communicative de l’auteur (réponse rédigée)",
          {"task": QT[8], "criterion": "Visée communicative de l’auteur", "model_answer": " ou ".join(model8),
           "accepted": ["Accepter toute autre réponse allant dans le même le sens."],
           "deferred_because": "réponse ouverte : le corrigé accepte « toute autre réponse allant dans le même le sens »"},
          "- L'auteur de ce texte conseille de ne pas se laisser obséder par l'argent. ou - Il défend l’idée que le bonheur ne dépend pas de "
          "la richesse matérielle, mais de la reconnaissance de soi et de la satisfaction des besoins essentiels. (Accepter toute autre réponse "
          "allant dans le même le sens.)",
          "Corrigé : « L'auteur de ce texte conseille de ne pas se laisser obséder par l'argent. » ou « Il défend l’idée que le bonheur ne "
          "dépend pas de la richesse matérielle, mais de la reconnaissance de soi et de la satisfaction des besoins essentiels. » (Accepter "
          "toute autre réponse allant dans le même le sens.)", 1, "fr.enonciation")
    model9 = ("Reconnaître ses forces, faiblesses et aspirations permet de relativiser l’attrait pour l’argent. Ainsi, on cherchera moins le "
              "bonheur à travers l'accumulation des richesses, mais à travers la satisfaction intérieure.")
    criteria_question("q9", 20, "9", P1, QT[9],
                      [("Respect de la consigne", "Respect de la consigne : prise de position avec justification et le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées. Exemple. " + model9),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model9, "exemple", "fr.ecriture", docs)
    production("q10", 24, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة لغات أجنبية – الموضوع الثّاني («Quand l’argent devient une névrose»، Dr. Etienne JALENQUES)",
            ["س3: «Accepter aussi : il y en a autant qu’on veut.» صيغة أقصر للجواب نفسه ⇒ QCM تفاعليّ، الصّحيح الجملة كاملة، ولا تُعرض الصّيغة القصيرة مشتّتًا.",
             "س4 «0.5x2» ⇒ عنصر واحد (1) بخطوة multi (السّببان في الحلّ)؛ السّبب الثّالث المقبول «Nous ne sommes pas semblables…» لا يُعرض؛ "
             "المشتّتات يناقضها النّصّ (§4، §6).",
             "س6 «0.25x6» ⇒ ستّة عناصر ثنائيّة (Au bonheur / A l’angoisse كما في الورقة؛ الحلّ يكتب «Facteur de bonheur / Facteur d’angoisse»).",
             "س7: «vous» الصّحيح «les lecteurs» و«je» الصّحيح «l’auteur»؛ الصّيغ المقبولة الأخرى ليست مشتّتات.",
             "س8 (1) مؤجَّل: «Accepter toute autre réponse allant dans le même le sens» (كذا في الحلّ). س9: «0.5x4» ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (8): نفس شبكة الموضوع الأوّل (13 عنصرًا)."])


TITLE, PAPER_NOTES = build_p1() if PAPER == 1 else build_p2()

COMMON_NOTES = [
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word).",
    f"الموضوع: gdrive:{PAPER_ID} ({PAPER_TITLE}) ص{'1–2' if PAPER == 1 else '3–4'}؛ الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{CORR_ID} "
    f"({CORR_TITLE}) ص{'1' if PAPER == 1 else '2'} وص3 (الإنتاج الكتابيّ للموضوعين). الملفّان PDF رقميّان من الدّيوان الوطنيّ للامتحانات (لا مسح ضوئيّ): "
    "أُخذ النّصّ من طبقة النّصّ (pdftotext -raw) وقوبل كلّ سطر بصورة الصّفحة (150 نقطة)، وتحقّق سكربت من أنّ كلّ نصّ حرفيّ موجود في طبقة النّصّ.",
    "الشّعبة من رأس الورقة «الشعبة: لغات أجنبية» ⇒ LANG. «الدورة العادية» من اسم الملفّ في Drive (الورقة تطبع «الدورة: 2026»). المجموع: فهم المكتوب 12 "
    "+ إنتاج كتابيّ 08؛ كلّ العلامات من عمودَي «مجزأة/مجموع» في الحلّ الرّسميّ.",
    "خلافات طبقة النّصّ مع الصّورة (الصّورة هي المرجع): رأس عربيّ معكوس (السّنة «0302»، المدّة «30 سا و 03 د» والصّورة «03 سا و30 د»)؛ شرطات القوائم "
    "حرف خاصّ U+F02D في الطّبقة و«–» في الصّورة ⇒ «–»؛ إحالات الهوامش مرفوعة في الصّورة ⇒ ¹ ² ³؛ «1er/3ème» المرفوعة كُتبت عاديّة. حُفظ كما طُبع: "
    "الفاصلة العليا المستقيمة في «Ich'hadi» و«l'argent» (خيارا س1 الثّاني والثّالث في الموضوع الثّاني) و«jusqu'à l'ennui» و«quelqu'un».",
    "قرارات عامّة: «n×m» لبنود متمايزة ⇒ عنصر لكلّ بند، ولاختيارات متبادلة من النّصّ ⇒ عنصر واحد بخطوة multi. خيارا «Vrai/Faux» والتّصنيف الثّنائيّ "
    "يُخزَّنان معكوسين لأنّ shuffle_exam_set.py يقلب دائمًا قائمة من خيارين. قاعدة «accepter» الموحَّدة: صيغة أخرى للجواب نفسه أو قائمة مغلقة ⇒ تفاعليّ "
    "(الصّحيح صيغة الحلّ الأولى، والصّيغ المقبولة في الشّرح ولا تكون مشتّتًا أبدًا)؛ الجواب المفتوح («toute autre réponse…»، «à titre indicatif») ⇒ "
    "essay_builder مؤجَّل. الإنتاج الكتابيّ = سؤال أصليّ واحد يضمّ الموضوعين، وتفاصيل شبكة كلّ موضوع في spec. المشتّتات من إعداد التّحويل وتحتاج مراجعة.",
]
NOTES = " ".join(COMMON_NOTES + PAPER_NOTES)
LOG_NOTE = ("تحويل من ورقة البكالوريا الرّسميّة وإجابتها النّموذجيّة (PDF رقميّان في Drive، طبقة النّصّ مقابَلة بصور الصّفحات)؛ العلامات من سلّم التّنقيط "
            "الرّسميّ؛ الإجابات الصّحيحة من الحلّ؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

# ── Local checks before writing (skills from src/server/play/exams/skills.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(fr\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) >= 6, "skills.ts not parsed"


def _norm(s):  # same spirit as normalizeArabic (src/server/lib/arabic.ts): NFKC, no punctuation, lower case
    s = unicodedata.normalize("NFKC", s)
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check(total=20):
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    assert set(FORMS) <= set(els), "FORMS for an unknown element"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for txt in [qq["verbatim_text"], *(d.get("text", "") for d in qq["documents"])]:
            assert "  " not in txt and " \n" not in txt and "\n " not in txt, (qq["id"], "space runs must be collapsed")
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
        assert s["prompt"] != qq["verbatim_text"] and not s["is_verbatim_original"], (s["id"], "derived steps only")
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        label = _norm(els[s["rubric_element_id"]]["label"])
        if t == "mcq":
            if len(p["options"]) == 2:
                assert any(p["options"] == [pair[1], pair[0]] for pair in BINARY), (s["id"], "2-option mcq must be a stored-reversed BINARY pair")
            else:
                assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
            assert _norm(p["options"][a["correct"]]) not in label, (s["id"], "answer in rubric label")
        if t in ("mcq", "multi"):
            assert len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
            right = {a["correct"]} if t == "mcq" else set(a["correct"])
            forms = {_norm(f) for f in FORMS.get(s["rubric_element_id"], [])}
            for i, o in enumerate(p["options"]):  # unified «accepter» rule: an accepted form is never a distractor
                assert i in right or _norm(o) not in forms, (s["id"], "accepted form offered as a distractor", o)
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
            assert a["correct"] == list(range(len(a["correct"]))), (s["id"], "multi: right options first before shuffling")
            for i in a["correct"]:
                assert _norm(p["options"][i]) not in label, (s["id"], "answer in rubric label")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2 and len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            assert all(any(_norm(x) in bank for x in alts) for alts in a["blanks"]), s["id"]
            assert len(set(bank)) == len(bank) and len(bank) > len(a["blanks"]), (s["id"], "bank duplicates / no distractor")
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:  # rule 12: no answer in a document caption
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    pe = [qq for qq in Q if qq["part"].startswith("II.")]
    assert len(pe) == 1 and abs(pe[0]["rubric_total"] - PE_TOTAL) < 1e-9, "Production écrite total"
    assert abs(sum(qq["rubric_total"] for qq in Q if qq not in pe) - COMP_TOTAL) < 1e-9, "Compréhension de l’écrit total"
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
        "kind": "BAC", "year": 2026, "level": "3AS", "streams": STREAMS, "subject": "FR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T22:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
_deferred = sum(s["points"] for s in S if s["type"] == "essay_builder")
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
      sum(s["points"] for s in S), "points (interactive", sum(s["points"] for s in S) - _deferred, "+ deferred", _deferred, ")")
