"""Conversion: BAC 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الأوّل والثّاني.

Usage:  python3 scripts/play/converters/build_fr_bac_2026_lit.py <out.json> [1|2]
        (the paper number is taken from the file name «…-p1.json» / «…-p2.json» when not given)
then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- Paper: gdrive 1woINl5-mPvQbC6R70gGpandDe6YJ1WVm («2026 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الموضوع.pdf», 4 pages:
  sujet 1 pp. 1–2 (Ali HAROUN, LE SECOND FRONT — document du 8 mai 1959), sujet 2 pp. 3–4 (réseaux sociaux et santé mentale des
  jeunes, The Conversation)). Header: «الدورة: 2026», «الشعبة: آداب وفلسفة», «المدة: 02 سا و30 د». Official ONEC digital PDF.
- Official model answer + barème: gdrive 1_h33axzYB2CPrQmfFUzxnF4-oKH4BStt («… - الحل.pdf», 3 pages: sujet 1 p. 1, sujet 2 p. 2,
  production écrite of both sujets p. 3), digital PDF. Every mark comes from its «مجزأة / مجموع» columns.

How the text was read: verbatim strings come from `pdftotext -raw` and every line was checked against the 150-dpi page images;
a script checks that every verbatim string is a substring of the text layer (whitespace collapsed, superscripts mapped back to
digits, the line-end hyphens of «auto-surveillance» and «15-24» joined).
Text layer vs image (image wins):
- Footnote calls «FLN1», «GPRA2», «diffus1», «sous-tendent2», «l’ambivalence3», «dépathologiser4» are superscripts ⇒ «¹ ² ³ ⁴»;
  «Conversation*» keeps its asterisk; «1er», «4ème»… superscripts ⇒ plain. Arabic header reversed in the layer (year «0302»,
  duration «02 سا و 03 د»); corrigé p. 2 footer «صفحة 0 من 3» in the layer, «صفحة 2 من 3» on the image.
- Kept as printed: «45.000 Algériens» and «45 000 victimes», «Ecrits», «Casbah Editions», «reconnaitre» (no circumflex) in S2 Q6
  while the text has «reconnaître», straight apostrophes in «l'indépendance» (S1 Q8), «l'utilisation», «l'ensemble» (S2 sujet 1).

Conversion decisions (FR pilot fr-bac-2019-lit + guide Appendix A, unified «accepter» rule):
- Streams: header «الشعبة: آداب وفلسفة» ⇒ ["LIT"]. Totals printed on the paper: Compréhension 13 + Production écrite 07.
- «Accepter (aussi) : …» = another wording of the same answer ⇒ interactive; the correct option is the key's main wording;
  accepted forms never appear as distractors (FORMS + _check()): S1 Q2 (shorter sentence), S1 Q3 («la discipline», «unité du
  peuple algérien»), S1 Q6 «lui» (un corps expéditionnaire français), S2 Q6 «eux» (la peur, le doute, l’imperfection).
- Interchangeable picks (S1 Q3 «0.5x3», S2 Q2 «0.5x4», S2 Q3 «0.5x3») ⇒ one element with one multi (share grading = the key's
  per-item mark); distinct items (V/F, classification, pronouns) ⇒ one element each.
- Open answers deferred: Q8 of both sujets (four criteria 0.5x4, «Exemples»), production écrite (7 pts).
- Production écrite: présentation (0.5 / 0.25) and structure (0.25x2 / 0.25x3) are split differently by the two grids ⇒ merged
  into one element (1); every other line has the same mark in both grids (cohérence 4×0.25, choix énonciatif 1, choix des
  informations 1, syntaxe 1, lexique 0.5, temps et modes 0.5, ponctuation 0.5, orthographe 0.5); each step's spec quotes both
  grids' own lines.
- Two-option mcq (Vrai/Faux, 8 mai 1945/8 mai 1959, Santé mentale/Trouble mental) are stored REVERSED (the shuffle swaps them).
- Distractors: never an answer the key lists or accepts; never an expression of the text that could be argued to fit.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper number: pass 1|2 or name the output …-p1.json / …-p2.json"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SLUG = "lit"
SET_ID = f"fr-bac-2026-{SLUG}-p{PAPER}"
STREAMS = ["LIT"]
PAPER_ID = "1woINl5-mPvQbC6R70gGpandDe6YJ1WVm"
PAPER_TITLE = "2026 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
CORR_ID = "1_h33axzYB2CPrQmfFUzxnF4-oKH4BStt"
CORR_TITLE = "2026 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الحل.pdf"
COMP_TOTAL, PE_TOTAL = 13, 7

# Two-option questions: display order on the paper. Stored reversed (the shuffle always swaps two options).
VF = ("Vrai", "Faux")
MAI = ("8 mai 1945", "8 mai 1959")
SM = ("Santé mentale", "Trouble mental")
BINARY = [VF, MAI, SM]

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
# Présentation and structure are split differently by the two grids ⇒ merged into one element.
PE_GRID_NAMES = ("Compte rendu objectif", "Production libre")
PE_EXPL = ("La production écrite est corrigée avec la grille officielle du sujet choisi (organisation de la production 2 pts, "
           "planification de la production 2 pts, utilisation de la langue de façon appropriée 3 pts).")
PE_GRID = [
    ("e1", "Organisation : présentation du texte et structure adéquate", 1, "Présentation du texte et structure adéquate",
     "0.5 — Présentation du texte (mise en page, lisibilité) + 0.25x2 — Structure adéquate [accroche (0.25) condensation (0.25)]",
     "0.25 — Présentation du texte (mise en page, lisibilité). + 0.25x3 — Structure adéquate [Introduction (0.25) développement (0.25) "
     "conclusion (0.25)]"),
    ("e2", "Organisation : cohérence — progression des informations", 0.25, "Progression des informations",
     "0.25 (0.25x 4 Cohérence du texte) — progression des informations", "0.25 (0.25x 4 Cohérence du texte) — progression des informations"),
    ("e3", "Organisation : cohérence — absence de répétitions", 0.25, "Absence de répétitions",
     "0.25 (0.25x 4 Cohérence du texte) — absence de répétitions", "0.25 (0.25x 4 Cohérence du texte) — absence de répétitions"),
    ("e4", "Organisation : cohérence — absence de contresens", 0.25, "Absence de contresens",
     "0.25 (0.25x 4 Cohérence du texte) — absence de contresens", "0.25 (0.25x 4 Cohérence du texte) — absence de contresens"),
    ("e5", "Organisation : cohérence — emploi de connecteurs", 0.25, "Emploi de connecteurs",
     "0.25 (0.25x 4 Cohérence du texte) — emploi de connecteurs", "0.25 (0.25x 4 Cohérence du texte) — emploi de connecteurs"),
    ("e6", "Planification : choix énonciatif en relation avec la consigne", 1, "Choix énonciatif",
     "1 — Choix énonciatif en relation avec la consigne", "1 — Choix énonciatif en relation avec la consigne"),
    ("e7", "Planification : choix et sélection des informations", 1, "Choix des informations",
     "1 — Sélection des informations essentielles (condensation et reformulation)", "1 — Choix des informations (originalité et pertinence des idées)"),
    ("e8", "Langue : correction des phrases au plan syntaxique", 1, "Correction syntaxique",
     "1 — Correction des phrases au plan syntaxique", "1 — Correction des phrases au plan syntaxique"),
    ("e9", "Langue : lexique approprié à la thématique", 0.5, "Lexique approprié",
     "0.5 — Emploi d’un lexique approprié à la thématique", "0.5 — Emploi d’un lexique approprié à la thématique"),
    ("e10", "Langue : emploi correct des temps et des modes", 0.5, "Temps et modes",
     "0.5 — Emploi correct des temps et des modes", "0.5 — Emploi correct des temps et des modes"),
    ("e11", "Langue : utilisation adéquate des signes de ponctuation", 0.5, "Ponctuation",
     "0.5 — Utilisation adéquate des signes de ponctuation", "0.5 — Utilisation adéquate des signes de ponctuation"),
    ("e12", "Langue : orthographe", 0.5, "Orthographe",
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
    intro = ("L’auteur republie, dans son ouvrage, le document n°121 de la Fédération de France du FLN produit le 08 mai 1959 à "
             "l’occasion de la commémoration du 08 mai 1945.")
    text = "\n".join([
        "Il y a exactement quatorze ans, le 8 mai 1945, une répression sauvage s’abattait sur les Algériens désarmés et sans appui. Le "
        "gouvernement colonialiste français dont De Gaulle était, comme aujourd’hui, le chef suprême, donnait mission à ses troupes et à sa "
        "marine d’écraser avec la dernière énergie, le mouvement de libération algérien qui avait osé, à l’occasion du défilé du 1er mai, "
        "manifester pacifiquement sa présence au même titre que les divers groupements européens existant à l’époque en Algérie.",
        "L’armée française entra donc en action sur de nombreuses parties du territoire algérien. La flotte et l’aviation bombardèrent des "
        "villages entiers. En moins d’une semaine, les forces françaises avaient assassiné 45.000 Algériens. Isolée du reste du monde, notre "
        "cause demeura sans écho. L’opinion internationale resta muette. […]",
        "Les hommes qui se chargèrent du redoutable honneur de préparer la libération, comprirent après ces massacres, que le colonialisme "
        "français ne lâcherait jamais sa proie s’il n’y était contraint par la force. Les années suivantes, les campagnes du Vietnam "
        "confirmèrent cette analyse. Le mouvement de Libération Nationale sut donc tirer la leçon de la tragédie du 8 mai 1945 et agit de "
        "telle sorte que les 45 000 victimes ne soient pas sacrifiées inutilement.",
        "Aujourd’hui, l’unité du peuple algérien est complète et sans fissure. Toutes les énergies saines de notre Peuple se sont retrouvées "
        "au sein du FLN¹ et œuvrent dans l’union, la fraternité et la discipline révolutionnaire à la liquidation du système colonial.",
        "Aujourd’hui, l’Armée de Libération Algérienne, soutenue et aidée par tout le peuple, tient en échec un corps expéditionnaire français "
        "de 750 000 hommes, lui infligeant des pertes sévères, le harcelant sans répit et gardant partout l’avantage et l’initiative.",
        "Aujourd’hui, la cause de notre Peuple est connue dans le monde entier et bénéficie des sympathies et du soutien de la majeure partie "
        "de l’humanité. Le GPRA² est reconnu par un ensemble de pays dont la population se chiffre à près d’un milliard d’hommes.",
    ])
    source = ("Ali HAROUN, LE SECOND FRONT,\nEcrits et Documents de la Fédération de France du FLN 1954-1962,\n"
              "Casbah Editions, Alger 2021, pp. 255-256.")
    gloss = "1. FLN : Front de Libération Nationale.\n2. GPRA : Gouvernement Provisoire de la République Algérienne."
    docs = [
        {"id": "d-intro", "kind": "text", "caption": "Présentation du document", "text": intro},
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Mots expliqués", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (13 points)"
    P2 = "II. Production écrite : (07 points)"
    QT = {
        1: "Dans ce texte, le sujet principal est :\n- les relations économiques entre la France et l’Algérie pendant la période coloniale.\n"
           "- la formation et l’évolution du mouvement de libération nationale algérien.\n- les massacres du colonialisme en Algérie et la "
           "lutte des Algériens pour l’indépendance.\nRecopiez la bonne réponse.",
        2: "Relevez, du texte, la phrase qui reprend la même idée que : « Les militants du mouvement national ont compris que seule la lutte "
           "armée pouvait libérer le pays du joug colonial. »",
        3: "Trouvez, dans le 4ème paragraphe, les trois (03) piliers qui ont permis au peuple algérien de se libérer du système colonial.",
        4: "Précisez la date qui correspond au mot « aujourd’hui » dans le texte.",
        5: "Soit les propositions suivantes :\nle monde entier ignore la situation en Algérie / la cause algérienne gagne en visibilité dans "
           "le monde / les souffrances en Algérie n’ont pas suscité de réactions internationales / l’Algérie bénéficie d’un large soutien "
           "international.\nClassez-les selon qu’elles renvoient à la période du :\n- 8 mai 1945 : " + "…" * 19 + "."
           + "\n- 8 mai 1959 : " + "…" * 19 + "..",
        6: "Déterminez à qui ou à quoi renvoie chacun des mots : « sa », « il » et « lui » dans les énoncés ci-dessous :\n"
           "- « … manifester pacifiquement sa présence… » 1er paragraphe\n- « … s’il n’y était contraint… » 3ème paragraphe\n"
           "- « …, lui infligeant des pertes sévères, … » 5ème paragraphe",
        7: "Parmi les propositions ci-dessous, distinguez puis recopiez celle qui correspond à la visée communicative de l’auteur :\n"
           "- décrire les aspects économiques de la colonisation française en Algérie avant 1954.\n- raconter l’histoire de la guerre "
           "d’Algérie et les batailles menées de 1954 à 1962.\n- informer de la répression coloniale et de la résistance des Algériens pour "
           "leur indépendance.",
        8: "Le Peuple algérien s’est pleinement mobilisé dans le combat de la libération nationale.\nExpliquez, en deux à trois lignes, "
           "pourquoi, selon vous, la mobilisation du peuple algérien était importante pour faire face à la répression coloniale et parvenir "
           "à l'indépendance.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "A l’occasion de la commémoration du 08 mai 1945, votre lycée organise un concours du meilleur écrit à propos de la "
                     "résistance héroïque du peuple algérien au colonialisme. Vous décidez d’y participer. Rédigez le compte rendu objectif "
                     "de ce texte (100 mots environ) que vous présenterez aux membres du jury lors de ce concours."},
        {"id": "Sujet 2", "kind": "production libre (appel)",
         "consigne": "Les jeunes algériens de l’époque coloniale avaient relevé le défi de libérer le pays. Les jeunes d’aujourd’hui font face "
                     "à un nouveau défi, celui du développement national. En tant que jeune de cette nouvelle génération, rédigez un appel "
                     "(150 mots environ) dans lequel vous inviterez vos camarades à participer activement à la construction de l’Algérie. "
                     "Votre texte sera publié dans le journal mural de votre établissement."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 1) ──
    q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "Sujet principal du texte", 1.5)], docs)
    q("q2", "2", P1, QT[2], 1.5, [el("q2-e1", "Phrase du texte qui reprend la même idée", 1.5)], docs)
    q("q3", "3", P1, QT[3], 1.5, [el("q3-e1", "Trois piliers relevés dans le 4ème paragraphe (0,5x3)", 1.5)], docs)
    q("q4", "4", P1, QT[4], 1.5, [el("q4-e1", "Date qui correspond au mot « aujourd’hui »", 1.5)], docs)
    items5 = [("le monde entier ignore la situation en Algérie", MAI[0]), ("la cause algérienne gagne en visibilité dans le monde", MAI[1]),
              ("les souffrances en Algérie n’ont pas suscité de réactions internationales", MAI[0]),
              ("l’Algérie bénéficie d’un large soutien international", MAI[1])]
    q("q5", "5", P1, QT[5], 2, [el(f"q5-e{k}", f"Classement de « {it} » (0,5)", 0.5) for k, (it, _) in enumerate(items5, 1)], docs)
    q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "Référent de « sa » (1er paragraphe) (0,5)", 0.5),
                                  el("q6-e2", "Référent de « il » (3ème paragraphe) (0,5)", 0.5),
                                  el("q6-e3", "Référent de « lui » (5ème paragraphe) (0,5)", 0.5)], docs)
    q("q7", "7", P1, QT[7], 1.5, [el("q7-e1", "Visée communicative de l’auteur", 1.5)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, le sujet principal est : (choisissez la bonne réponse)",
        "les massacres du colonialisme en Algérie et la lutte des Algériens pour l’indépendance.",
        ["les relations économiques entre la France et l’Algérie pendant la période coloniale.",
         "la formation et l’évolution du mouvement de libération nationale algérien."],
        "Corrigé : « les massacres du colonialisme en Algérie et la lutte des Algériens pour l’indépendance. »", 1.5, "fr.comprehension")
    mcq("s02", "q2", "q2-e1", "Quelle phrase du texte reprend la même idée que : « Les militants du mouvement national ont compris que seule "
        "la lutte armée pouvait libérer le pays du joug colonial. » ?",
        "Les hommes qui se chargèrent du redoutable honneur de préparer la libération, comprirent après ces massacres que le colonialisme "
        "français ne lâcherait jamais sa proie s’il n’y était contraint par la force.",
        ["Isolée du reste du monde, notre cause demeura sans écho.", "L’opinion internationale resta muette.",
         "L’armée française entra donc en action sur de nombreuses parties du territoire algérien."],
        "Corrigé : « Les hommes qui se chargèrent du redoutable honneur de préparer la libération, comprirent après ces massacres que le "
        "colonialisme français ne lâcherait jamais sa proie s’il n’y était contraint par la force. » Accepter aussi : « le colonialisme "
        "français ne lâcherait jamais sa proie s’il n’y était contraint par la force. »", 1.5, "fr.comprehension",
        forms=["le colonialisme français ne lâcherait jamais sa proie s’il n’y était contraint par la force.",
               "Les hommes qui se chargèrent du redoutable honneur de préparer la libération, comprirent après ces massacres, que le "
               "colonialisme français ne lâcherait jamais sa proie s’il n’y était contraint par la force."])
    multi("s03", "q3", "q3-e1", "Dans le quatrième paragraphe, sélectionnez les trois piliers qui ont permis au peuple algérien de se libérer "
          "du système colonial.", ["l’union", "la fraternité", "la discipline révolutionnaire"],
          ["la liquidation du système colonial", "l’opinion internationale"],
          "Corrigé : « l’union / la fraternité / la discipline révolutionnaire » (0,5 chacun). Accepter aussi : « la discipline » et, à la "
          "place de « l’union », « unité du peuple algérien ».", 1.5, "fr.comprehension",
          forms=["la discipline", "unité du peuple algérien", "l’unité du peuple algérien"])
    mcq("s04", "q4", "q4-e1", "À quelle date correspond le mot « aujourd’hui » dans le texte ?", "08 mai 1959",
        ["8 mai 1945", "1er mai 1945", "1er novembre 1954"],
        "Corrigé : « La date : 08 mai 1959 » (le document a été « produit le 08 mai 1959 » ; « Il y a exactement quatorze ans, le 8 mai 1945 »).",
        1.5, "fr.comprehension")
    CLS = ("Corrigé — 8 mai 1945 : le monde entier ignore la situation en Algérie / les souffrances en Algérie n’ont pas suscité de "
           "réactions internationales ; 8 mai 1959 : la cause algérienne gagne en visibilité dans le monde / l’Algérie bénéficie d’un large "
           "soutien international.")
    for k, (it, right) in enumerate(items5, 1):
        binary(f"s{4 + k:02d}", "q5", f"q5-e{k}", f"Classez « {it} » : cette proposition renvoie à la période du…", MAI, right, CLS, 0.5,
               "fr.comprehension")
    mcq("s09", "q6", "q6-e1", "« … manifester pacifiquement sa présence… » (§1) : à qui renvoie « sa » ?", "le mouvement de libération algérien",
        ["le gouvernement colonialiste français", "De Gaulle", "les divers groupements européens"],
        "Corrigé : « sa » = le mouvement de libération algérien.", 0.5, "fr.discours")
    mcq("s10", "q6", "q6-e2", "« … s’il n’y était contraint… » (§3) : à quoi renvoie « il » ?", "le colonialisme français",
        ["le mouvement de Libération Nationale", "le peuple algérien", "le Vietnam"],
        "Corrigé : « il » = le colonialisme français.", 0.5, "fr.discours")
    mcq("s11", "q6", "q6-e3", "« …, lui infligeant des pertes sévères, … » (§5) : à qui renvoie « lui » ?",
        "un corps expéditionnaire français de 750 000 hommes", ["l’Armée de Libération Algérienne", "le peuple algérien", "le GPRA"],
        "Corrigé : « lui » = un corps expéditionnaire français de 750 000 hommes. Accepter aussi : un corps expéditionnaire français.", 0.5,
        "fr.discours", forms=["un corps expéditionnaire français"])
    mcq("s12", "q7", "q7-e1", "Parmi les propositions, laquelle correspond à la visée communicative de l’auteur ?",
        "informer de la répression coloniale et de la résistance des Algériens pour leur indépendance.",
        ["décrire les aspects économiques de la colonisation française en Algérie avant 1954.",
         "raconter l’histoire de la guerre d’Algérie et les batailles menées de 1954 à 1962."],
        "Corrigé : « informer de la répression coloniale et de la résistance des Algériens pour leur indépendance. »", 1.5, "fr.enonciation")
    model8 = ("Cette mobilisation a transformé une résistance clandestine en un mouvement populaire massif. / Cette mobilisation a affaibli le "
              "pouvoir colonial et créé les conditions nécessaires pour arracher l'indépendance par la lutte armée.")
    criteria_question("q8", 13, "8", P1, QT[8],
                      [("Respect de la consigne", "Respect de la consigne. Explication avec implication directe ou indirecte du candidat et "
                                                  "le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées. Exemples : " + model8),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model8, "exemples", "fr.ecriture", docs)
    production("q9", 17, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الأوّل (Ali HAROUN، LE SECOND FRONT: وثيقة 8 ماي 1959)",
            ["الفقرة التّمهيديّة المائلة «L’auteur republie…» وثيقة مستقلّة «Présentation du document»، وفقرات النّصّ ستّ.",
             "س2: الخيار الصّحيح بلفظ الحلّ (بلا الفاصلة بعد «massacres» الموجودة في النّصّ)؛ الصّيغة القصيرة المقبولة وصيغة النّصّ ليستا مشتّتين؛ "
             "لم يُعرض «Le mouvement de Libération Nationale sut donc tirer la leçon…» ولا «les campagnes du Vietnam confirmèrent cette analyse» "
             "لأنّهما قابلتان للدّفاع.",
             "س3 «0.5x3» ⇒ عنصر واحد (1.5) بخطوة multi؛ «la discipline» و«unité du peuple algérien» المقبولتان ليستا مشتّتين.",
             "س5 «0.5×4» ⇒ أربعة عناصر ثنائيّة (8 mai 1945 / 8 mai 1959).",
             "س6 «lui»: الصّحيح «un corps expéditionnaire français de 750 000 hommes» والصّيغة القصيرة المقبولة ليست مشتّتًا.",
             "س8: «0.5x4» معايير ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (7): (تقديم + بنية) عنصر واحد (1) لاختلاف تقسيمه بين الشّبكتين (0.5+0.25x2 / 0.25+0.25x3)، وباقي الأسطر بالعلامة نفسها ⇒ 12 عنصرًا."])


# ════════════════════════════════════ SUJET 2 ════════════════════════════════════
def build_p2():
    text = "\n".join([
        "Sur les réseaux sociaux, chaque sujet intime devient un thème de débat public. Si ces discours permettent de sensibiliser à des "
        "enjeux de santé et de société, ils peuvent aussi inciter à une auto-surveillance, source de mal-être.",
        "Selon l’Organisation Mondiale de la Santé (OMS), près d’un jeune sur cinq souffre, aujourd’hui, d’un trouble mental : anxiété, "
        "troubles alimentaires, sentiment d’isolement, épuisement émotionnel. Les demandes d’aide explosent. En parallèle, le temps passé sur "
        "les réseaux sociaux ne cesse de croître : les 15-24 ans y consacrent plus de trois heures et demie par jour en moyenne.",
        "Cette génération n’est pas seulement la plus connectée : elle est aussi la plus exposée à des discours permanents sur la santé "
        "mentale, le corps, l’identité et la performance. Cette exposition continue redéfinit la manière dont les jeunes perçoivent leurs "
        "émotions, interprètent leurs comportements et évaluent leur « normalité ». […] Les jeunes apprennent, jour après jour, à se scruter, "
        "à se diagnostiquer, mais surtout, à se comparer. Chaque émotion devient suspecte, chaque écart par rapport aux normes visibles sur "
        "les réseaux sociaux devient motif d’inquiétude. […]",
        "Le mal-être est donc devenu social et symbolique. Par le biais des réseaux sociaux, il devient diffus¹, constant et se renforce au gré "
        "de la visibilité des contenus numériques et de la comparaison sociale qu’ils sous-tendent². Ainsi, les jeunes ne fuient plus une "
        "menace extérieure, mais un jugement collectif permanent, celui des pairs et des algorithmes qui régulent leur image de soi. […]",
        "Les réseaux sociaux se transforment en outil d’auto-surveillance : les jeunes y apprennent à reconnaître des symptômes, mais aussi à "
        "s’y identifier. […] L’environnement numérique fonctionne alors comme un amplificateur de vigilance intérieure, qui transforme la "
        "régulation émotionnelle en source d’angoisse.",
        "Plutôt que d’éliminer le mal-être, il faut réhabiliter l’ambivalence³ : la peur, le doute, l’imperfection. La santé mentale ne "
        "consiste pas à supprimer ces états, mais à apprendre à vivre avec eux. […] C’est sans doute là, le véritable enjeu : "
        "dépathologiser⁴ l’expérience ordinaire, pour permettre aux jeunes de vivre avec eux-mêmes et non contre eux-mêmes.",
    ])
    source = ("C. ROUEN-MALLET, P. EZAN (universitaires) et S. MALLET (chercheur en IA),\n"
              "Article publié in Conversation*, le 22 octobre 2025")
    gloss = ("*Conversation : média académique en ligne.\n1. Diffus : qui est diffusé, répandu dans toutes les directions.\n"
             "2. Sous-tendent : constituent le fondement de quelque chose ; servent de base à un raisonnement.\n"
             "3. Ambivalence : état de ce qui offre deux aspects différents ou contraires ; ambiguïté.\n"
             "4. Dépathologiser : arrêter de considérer certains comportements comme maladie à traiter.")
    docs = [
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Notes", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (13 points)"
    P2 = "II. Production écrite : (07 points)"
    QT = {
        1: "Dans ce texte, le problème posé est :\n- l’impact des réseaux sociaux sur la santé mentale des jeunes.\n- l’impact des réseaux "
           "sociaux sur les résultats scolaires des jeunes.\n- l’impact des réseaux sociaux sur les données personnelles des jeunes.\n"
           "Recopiez la bonne réponse.",
        2: "Relevez, du texte, les quatre (04) troubles psychiques cités par l’OMS chez les jeunes.",
        3: "Trouvez, dans le 3ème paragraphe, les trois (03) actions qui illustrent l’auto-surveillance chez les jeunes.",
        4: "Répondez par « vrai » ou « faux » :\na) Les contenus des réseaux constituent une référence pour les jeunes.\nb) Les jeunes "
           "contrôlent leurs émotions grâce au temps passé devant les écrans.\nc) Chaque écart par rapport au modèle devient source "
           "d’angoisse chez les jeunes.\nd) Le mal-être causé par les contenus numériques est un phénomène de société.",
        5: "Soit les expressions suivantes :\nacceptation de soi / sentiment de malaise / manque de confiance en soi / savoir vivre avec ses "
           "contradictions.\nClassez-les selon qu’elles renvoient à :\n- Santé mentale : " + "…" * 18 + "."
           + "\n- Trouble mental : " + "…" * 17 + "..",
        6: "Déterminez à quoi renvoie chacun des mots : « il », « y » et « eux » dans les énoncés ci-dessous :\n"
           "- « …il devient diffus, … » 4ème paragraphe\n- « les jeunes y apprennent à reconnaitre… » 5ème paragraphe\n"
           "- « …mais à apprendre à vivre avec eux. » 6ème paragraphe",
        7: "Parmi les propositions ci-dessous, distinguez puis recopiez celle qui correspond à la visée communicative des auteurs :\n"
           "- dénoncer le temps de connexion accordé par les jeunes aux réseaux sociaux.\n- sensibiliser aux dérives des contenus des "
           "réseaux sur l’image que le jeune se fait de soi.\n- encourager les jeunes à consulter fréquemment les contenus des réseaux sociaux.",
        8: "« Sur les réseaux sociaux, chaque sujet intime devient un thème de débat public. »\nPensez-vous que c’est sage de discuter de "
           "sujets d’ordre personnel sur les réseaux sociaux ? Justifiez votre point de vue, en deux à trois lignes.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "Votre établissement organise une journée de sensibilisation contre les dangers de l'utilisation excessive des réseaux "
                     "sociaux. Le contenu de ce texte vous a convaincu. Rédigez son compte rendu objectif (120 mots environ) que vous "
                     "partagerez avec l'ensemble de vos camarades du lycée lors de cette journée."},
        {"id": "Sujet 2", "kind": "production libre (appel)",
         "consigne": "Vous êtes invité à participer à la journée de sensibilisation sur les dangers des réseaux sociaux organisée par la "
                     "maison de culture de votre commune. Rédigez un appel (150 mots environ) pour inciter les jeunes à faire preuve de "
                     "vigilance et de retenue pour protéger leurs données personnelles. Vous afficherez votre texte dans la salle "
                     "d’exposition de la maison de culture."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 2) ──
    q("q1", "1", P1, QT[1], 1, [el("q1-e1", "Problème posé par le texte", 1)], docs)
    q("q2", "2", P1, QT[2], 2, [el("q2-e1", "Quatre troubles psychiques cités par l’OMS (0,5x4)", 2)], docs)
    q("q3", "3", P1, QT[3], 1.5, [el("q3-e1", "Trois actions d’auto-surveillance (3ème paragraphe) (0,5x3)", 1.5)], docs)
    stm4 = [("a", "Les contenus des réseaux constituent une référence pour les jeunes.", "Vrai",
             "Les jeunes « évaluent leur « normalité » » et « chaque écart par rapport aux normes visibles sur les réseaux sociaux devient "
             "motif d’inquiétude » (§3)."),
            ("b", "Les jeunes contrôlent leurs émotions grâce au temps passé devant les écrans.", "Faux",
             "« L’environnement numérique […] transforme la régulation émotionnelle en source d’angoisse » (§5)."),
            ("c", "Chaque écart par rapport au modèle devient source d’angoisse chez les jeunes.", "Vrai",
             "« chaque écart par rapport aux normes visibles sur les réseaux sociaux devient motif d’inquiétude » (§3)."),
            ("d", "Le mal-être causé par les contenus numériques est un phénomène de société.", "Vrai",
             "« Le mal-être est donc devenu social et symbolique. » (§4)")]
    q("q4", "4", P1, QT[4], 2, [el(f"q4-e{k}", f"Affirmation {x[0]}) (0,5)", 0.5) for k, x in enumerate(stm4, 1)], docs)
    items5 = [("acceptation de soi", SM[0]), ("sentiment de malaise", SM[1]), ("manque de confiance en soi", SM[1]),
              ("savoir vivre avec ses contradictions", SM[0])]
    q("q5", "5", P1, QT[5], 2, [el(f"q5-e{k}", f"Classement de « {it} » (0,5)", 0.5) for k, (it, _) in enumerate(items5, 1)], docs)
    q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "Référent de « il » (4ème paragraphe) (0,5)", 0.5),
                                  el("q6-e2", "Référent de « y » (5ème paragraphe) (0,5)", 0.5),
                                  el("q6-e3", "Référent de « eux » (6ème paragraphe) (0,5)", 0.5)], docs)
    q("q7", "7", P1, QT[7], 1, [el("q7-e1", "Visée communicative des auteurs", 1)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, le problème posé est : (choisissez la bonne réponse)",
        "l’impact des réseaux sociaux sur la santé mentale des jeunes.",
        ["l’impact des réseaux sociaux sur les résultats scolaires des jeunes.",
         "l’impact des réseaux sociaux sur les données personnelles des jeunes."],
        "Corrigé : « l’impact des réseaux sociaux sur la santé mentale des jeunes. »", 1, "fr.comprehension")
    multi("s02", "q2", "q2-e1", "Sélectionnez les quatre troubles psychiques cités par l’OMS chez les jeunes.",
          ["anxiété", "troubles alimentaires", "sentiment d’isolement", "épuisement émotionnel"],
          ["troubles du sommeil", "dépendance aux écrans"],
          "Corrigé : « anxiété – troubles alimentaires – sentiment d’isolement – épuisement émotionnel » (0,5 chacun) (§2).", 2,
          "fr.comprehension")
    multi("s03", "q3", "q3-e1", "Dans le troisième paragraphe, sélectionnez les trois actions qui illustrent l’auto-surveillance chez les jeunes.",
          ["se scruter", "se diagnostiquer", "se comparer"], ["se divertir", "se déconnecter"],
          "Corrigé : « se scruter / se diagnostiquer / se comparer » (0,5 chacune) : « Les jeunes apprennent, jour après jour, à se scruter, "
          "à se diagnostiquer, mais surtout, à se comparer. »", 1.5, "fr.comprehension")
    for k, (letter, stmt, right, why) in enumerate(stm4, 1):
        binary(f"s{3 + k:02d}", "q4", f"q4-e{k}", f"Vrai ou faux : « {stmt} »", VF, right,
               f"Corrigé : {right}. {why} (Ne pas pénaliser le candidat qui ne recopie pas les propositions.)", 0.5, "fr.comprehension")
    CLS = ("Corrigé — Santé mentale : acceptation de soi / savoir vivre avec ses contradictions ; Trouble mental : sentiment de malaise / "
           "manque de confiance en soi.")
    for k, (it, right) in enumerate(items5, 1):
        binary(f"s{7 + k:02d}", "q5", f"q5-e{k}", f"Classez « {it} » : cette expression renvoie à la…", SM, right, CLS, 0.5, "fr.vocabulaire")
    mcq("s12", "q6", "q6-e1", "« …il devient diffus, … » (§4) : à quoi renvoie « il » ?", "mal-être",
        ["jugement collectif", "environnement numérique", "débat public"], "Corrigé : « il » : mal-être.", 0.5, "fr.discours")
    mcq("s13", "q6", "q6-e2", "« les jeunes y apprennent à reconnaitre… » (§5) : à quoi renvoie « y » ?", "réseaux sociaux",
        ["symptômes", "émotions", "demandes d’aide"], "Corrigé : « y » : réseaux sociaux.", 0.5, "fr.discours")
    mcq("s14", "q6", "q6-e3", "« …mais à apprendre à vivre avec eux. » (§6) : à quoi renvoie « eux » ?", "ces états",
        ["les jeunes", "les algorithmes", "les contenus numériques"],
        "Corrigé : « eux » : ces états. (Accepter aussi deux (02) ou trois (03) de ces états : la peur, le doute et l’imperfection)", 0.5,
        "fr.discours", forms=["la peur, le doute et l’imperfection", "la peur, le doute, l’imperfection", "la peur", "le doute", "l’imperfection"])
    mcq("s15", "q7", "q7-e1", "Parmi les propositions, laquelle correspond à la visée communicative des auteurs ?",
        "sensibiliser aux dérives des contenus des réseaux sur l’image que le jeune se fait de soi.",
        ["dénoncer le temps de connexion accordé par les jeunes aux réseaux sociaux.",
         "encourager les jeunes à consulter fréquemment les contenus des réseaux sociaux."],
        "Corrigé : « sensibiliser aux dérives des contenus des réseaux sur l’image que le jeune se fait de soi. »", 1, "fr.enonciation")
    model8 = ("Partager des détails intimes peut rendre une personne plus vulnérable aux attaques et au harcèlement en ligne. / Partager des "
              "informations sensibles peut exposer une personne à des risques de vol d'identité ou de fraude.")
    criteria_question("q8", 16, "8", P1, QT[8],
                      [("Respect de la consigne", "Respect de la consigne. prise de position avec justification et le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées. Exemples : " + model8),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model8, "exemples", "fr.ecriture", docs)
    production("q9", 20, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الثّاني (الشّبكات الاجتماعيّة والصّحّة النّفسيّة للشّباب، The Conversation)",
            ["س2 «0.5x4» وس3 «0.5x3» ⇒ عنصر واحد لكلّ منهما بخطوة multi؛ المشتّتات غير مذكورة في النّصّ (لم يُعرض «angoisse» لأنّه مرادف لـ«anxiété»، "
             "ولا «reconnaître des symptômes» و«évaluer leur normalité» لأنّهما قابلان للدّفاع كمراقبة ذاتيّة).",
             "س5 «0.5x4» ⇒ أربعة عناصر ثنائيّة (Santé mentale / Trouble mental).",
             "س6 «eux»: الصّحيح «ces états»، و«la peur, le doute, l’imperfection» المقبولة ليست مشتّتات. الورقة تكتب «reconnaitre» في س6 والنّصّ «reconnaître».",
             "س8: «0.5x4» معايير ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (7): نفس شبكة الموضوع الأوّل (12 عنصرًا)."])


TITLE, PAPER_NOTES = build_p1() if PAPER == 1 else build_p2()

COMMON_NOTES = [
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word).",
    f"الموضوع: gdrive:{PAPER_ID} ({PAPER_TITLE}) ص{'1–2' if PAPER == 1 else '3–4'}؛ الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{CORR_ID} "
    f"({CORR_TITLE}) ص{'1' if PAPER == 1 else '2'} وص3 (الإنتاج الكتابيّ للموضوعين). الملفّان PDF رقميّان من الدّيوان الوطنيّ للامتحانات (لا مسح ضوئيّ): "
    "أُخذ النّصّ من طبقة النّصّ (pdftotext -raw) وقوبل كلّ سطر بصورة الصّفحة (150 نقطة)، وتحقّق سكربت من أنّ كلّ نصّ حرفيّ موجود في طبقة النّصّ.",
    "الشّعبة من رأس الورقة «الشعبة: آداب وفلسفة» ⇒ LIT. «الدورة العادية» من اسم الملفّ في Drive (الورقة تطبع «الدورة: 2026»). المجموع: فهم المكتوب 13 "
    "+ إنتاج كتابيّ 07؛ كلّ العلامات من عمودَي «مجزأة/مجموع» في الحلّ الرّسميّ.",
    "خلافات طبقة النّصّ مع الصّورة (الصّورة هي المرجع): رأس عربيّ معكوس (السّنة «0302»، المدّة «02 سا و 03 د» والصّورة «02 سا و30 د»)، تذييل ص2 "
    "من الحلّ «صفحة 0 من 3» في الطّبقة؛ إحالات الهوامش مرفوعة ⇒ ¹ ² ³ ⁴ و«Conversation*»؛ «1er/3ème…» المرفوعة كُتبت عاديّة؛ «auto-/surveillance» "
    "و«15-/24» المقسومتان آخر السّطر وُصلتا. حُفظ كما طُبع: «45.000 Algériens» و«45 000 victimes»، «Ecrits»، «Casbah Editions»، «reconnaitre» في س6 "
    "من الموضوع الثّاني (والنّصّ «reconnaître»)، والفاصلة العليا المستقيمة في «l'indépendance» (س8 من الموضوع الأوّل) و«l'utilisation» و«l'ensemble».",
    "قرارات عامّة: «n×m» لبنود متمايزة ⇒ عنصر لكلّ بند، ولاختيارات متبادلة من النّصّ ⇒ عنصر واحد بخطوة multi. الخيارات الثّنائيّة تُخزَّن معكوسة "
    "لأنّ shuffle_exam_set.py يقلب دائمًا قائمة من خيارين. قاعدة «accepter» الموحَّدة: صيغة أخرى للجواب نفسه ⇒ تفاعليّ (الصّحيح صيغة الحلّ الأولى، "
    "والصّيغ المقبولة في الشّرح ولا تكون مشتّتًا أبدًا)؛ الجواب المفتوح («Exemples») ⇒ essay_builder مؤجَّل. الإنتاج الكتابيّ = سؤال أصليّ واحد يضمّ "
    "الموضوعين، وتفاصيل شبكة كلّ موضوع في spec. المشتّتات من إعداد التّحويل وتحتاج مراجعة.",
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
