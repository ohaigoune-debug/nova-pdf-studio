"""Conversion: BAC 2026 (الدورة العاديّة) – اللغة الفرنسية – الشعب العلمية (علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد، فنون)
– الموضوع الأوّل والثّاني.

Usage:  python3 scripts/play/converters/build_fr_bac_2026_sci.py <out.json> [1|2]
        (the paper number is taken from the file name «…-p1.json» / «…-p2.json» when not given)
then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive):
- Paper: gdrive 14yIT1KuV2m-3m0oa1hRNjTNeXguBGUZo («2026 - اللغة الفرنسية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة
  العادية - الموضوع.pdf», 4 pages: sujet 1 pp. 1–2 (S. GUILBEAULT, intelligence artificielle et travail), sujet 2 pp. 3–4
  (M. DJENNAS, l’arraisonnement de l’avion du 22 octobre 1956)). Header: «الدورة: 2026», «الشعبة: علوم تجريبية، رياضيات، تقني رياضي،
  تسيير واقتصاد، فنون», «المدة: 02 سا و30 د». Official ONEC digital PDF (pdffonts: embedded fonts, text layer).
- Official model answer + barème: gdrive 1ZP6LJtXasHdkhsL4GAf_kYxJfqYCsOAy («… - الحل.pdf», 3 pages: sujet 1 p. 1, sujet 2 p. 2,
  production écrite of both sujets p. 3), digital PDF. Every mark comes from its «مجزأة / مجموع» columns.

How the text was read: verbatim strings come from `pdftotext -raw` (exact characters; this paper mixes straight «'» — in both
reading passages and some quotations — and curly «’» — in most questions) and every line was checked against the 150-dpi page
images; a script checks that every verbatim string is a substring of the text layer (whitespace collapsed, superscripts mapped
back to digits).
Text layer vs image (image wins):
- Footnote calls «l'IA1», «répercussions2», «l'arraisonnement1», «affrété2», «guêpier3» are superscripts ⇒ «¹ ² ³»;
  «1er», «2ème»… superscripts ⇒ plain. Arabic header reversed in the layer (year «0302», duration «02 سا و 03 د»); corrigé p. 2
  footer «صفحة 0 من 3» in the layer, «صفحة 2 من 3» on the image.
- Visibly wider gaps on the image («sur votre page Facebook», «musulmane. La révolution») are one space in the layer ⇒ one space.

Conversion decisions (FR pilot fr-bac-2019-lit + guide Appendix A, unified «accepter» rule):
- Streams: the header lists علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد ⇒ ["SCI","MATH","TM","GE"] (slug `sci`); it also lists «فنون»,
  which has no PLAY stream code (src/server/play/constants.ts PLAY_STREAMS), so it is recorded in notes only.
- Totals printed on the paper: Compréhension 14 + Production écrite 06.
- «Accepter (aussi) : …» = another wording of the same answer or a closed list ⇒ interactive; the correct option is the key's
  main wording; accepted forms never appear as distractors (FORMS + _check()): S1 Q3 (la société a su s’adapter), S1 Q5 «en» /
  «cela» / «nous», S1 Q6 («ont remplacé»), S2 Q3 (le coup dur; un acte important certes, mais non décisif), S2 Q6 «leur» / «le» /
  «on» / «lui».
- S1 Q6 «N.B. : (conjugaison du verbe = 1 pt + suppression de « par » = 0.5 pt)» ⇒ two elements (1 + 0.5), one mcq each; their
  labels stay neutral («forme du verbe», «traitement du complément d’agent») so that the label never gives the answer.
- Open answers deferred: Q8 of both sujets (four criteria 0.5x4, «à titre indicatif»), production écrite (6 pts).
- Production écrite: the two grids differ line by line (sujet 1: présentation 0.5 + structure 0.25x2, lexique / temps /
  ponctuation / orthographe 0.25 each; sujet 2: présentation 0.25 + structure 0.75, lexique / ponctuation 0.5, temps /
  orthographe 0.25) ⇒ the finest grid common to both: présentation + structure merged (1), cohérence 4×0.25, choix énonciatif 1,
  choix des informations 1, syntaxe + lexique + ponctuation merged (1.5), temps et modes 0.25, orthographe 0.25; each step's spec
  quotes both grids' own lines.
- Two-option mcq (Vrai/Faux, Défenseurs/Opposants, partie algérienne/française) are stored REVERSED (the shuffle swaps them).
- Distractors: never an answer the key lists or accepts; never an expression of the text that could be argued to fit.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
_m = re.search(r"-p([12])\.json$", OUT)
PAPER = int(sys.argv[2]) if len(sys.argv) > 2 else int(_m.group(1)) if _m else 0
assert PAPER in (1, 2), "paper number: pass 1|2 or name the output …-p1.json / …-p2.json"
assert not _m or int(_m.group(1)) == PAPER, "output name and paper number disagree"

SLUG = "sci"
SET_ID = f"fr-bac-2026-{SLUG}-p{PAPER}"
STREAMS = ["SCI", "MATH", "TM", "GE"]
PAPER_ID = "14yIT1KuV2m-3m0oa1hRNjTNeXguBGUZo"
PAPER_TITLE = "2026 - اللغة الفرنسية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة العادية - الموضوع.pdf"
CORR_ID = "1ZP6LJtXasHdkhsL4GAf_kYxJfqYCsOAy"
CORR_TITLE = "2026 - اللغة الفرنسية - تسيير واقتصاد + تقني رياضي + رياضيات + علوم تجريبية - الدورة العادية - الحل.pdf"
COMP_TOTAL, PE_TOTAL = 14, 6

# Two-option questions: display order on the paper. Stored reversed (the shuffle always swaps two options).
VF = ("Vrai", "Faux")
DO = ("Défenseurs de l’IA", "Opposants de l’IA")
AF = ("La partie algérienne", "La partie française")
BINARY = [VF, DO, AF]

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
# The two grids split présentation/structure and syntaxe/lexique/ponctuation differently ⇒ merged into one element each.
PE_GRID_NAMES = ("Compte rendu objectif", "Production libre")
PE_EXPL = ("La production écrite est corrigée avec la grille officielle du sujet choisi (organisation de la production 2 pts, "
           "planification de la production 2 pts, utilisation de la langue de façon appropriée 2 pts).")
PE_GRID = [
    ("e1", "Organisation : présentation du texte et structure adéquate", 1, "Présentation du texte et structure adéquate",
     "0.5 — Présentation du texte (mise en page, lisibilité) + 0.25x2 — Structure adéquate [accroche (0.25) – condensation (0.25)]",
     "0.25 — Présentation du texte (mise en page, lisibilité). + 0.75 — Structure adéquate [Introduction (0.25) – développement (0.25) "
     "conclusion (0.25)]"),
    ("e2", "Organisation : cohérence — progression des informations", 0.25, "Progression des informations",
     "0.25 (0.25x4 Cohérence du texte) — Progression des informations", "0.25 (0.25x4 Cohérence du texte) — Progression des informations"),
    ("e3", "Organisation : cohérence — absence de répétitions", 0.25, "Absence de répétitions",
     "0.25 (0.25x4 Cohérence du texte) — Absence de répétitions", "0.25 (0.25x4 Cohérence du texte) — Absence de répétitions"),
    ("e4", "Organisation : cohérence — absence de contresens", 0.25, "Absence de contresens",
     "0.25 (0.25x4 Cohérence du texte) — Absence de contresens", "0.25 (0.25x4 Cohérence du texte) — Absence de contresens"),
    ("e5", "Organisation : cohérence — emploi de connecteurs", 0.25, "Emploi de connecteurs",
     "0.25 (0.25x4 Cohérence du texte) — Emploi de connecteurs", "0.25 (0.25x4 Cohérence du texte) — Emploi de connecteurs"),
    ("e6", "Planification : choix énonciatif en relation avec la consigne", 1, "Choix énonciatif",
     "1 — Choix énonciatif en relation avec la consigne", "1 — Choix énonciatif en relation avec la consigne"),
    ("e7", "Planification : choix et sélection des informations", 1, "Choix des informations",
     "1 — Sélection des informations essentielles (condensation et reformulation)", "1 — Choix des informations (originalité et pertinence des idées)"),
    ("e8", "Langue : syntaxe, lexique et ponctuation", 1.5, "Correction syntaxique, lexique et ponctuation",
     "1 — Correction des phrases au plan syntaxique + 0.25 — Emploi d’un lexique approprié à la thématique + 0.25 — Utilisation adéquate "
     "des signes de ponctuation",
     "0.5 — Correction des phrases au plan syntaxique + 0.5 — Emploi d’un lexique approprié à la thématique + 0.5 — Utilisation adéquate "
     "des signes de ponctuation"),
    ("e9", "Langue : emploi correct des temps et des modes", 0.25, "Temps et modes",
     "0.25 — Emploi correct des temps et des modes", "0.25 — Emploi correct des temps et des modes"),
    ("e10", "Langue : orthographe", 0.25, "Orthographe",
     "0.25 — Orthographe (pas plus de 10 erreurs)", "0.25 — Orthographe (pas plus de 10 erreurs)"),
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
    text = "\n".join([
        "« Les robots vont détruire nos emplois, et nous ne sommes pas prêts », titrait le très respecté journal britannique The Guardian "
        "en janvier 2017 à propos de l'arrivée massive des technologies de l'IA¹ et de la robotisation. Quelles seront les répercussions², "
        "sur nos sociétés ainsi que sur le monde du travail, du développement de l'IA et de la robotisation généralisée ?",
        "D'après certains, les progrès rapides de ces technologies pourraient entraîner des millions de pertes d'emplois et provoquer des "
        "tensions sociales comme nous n'en avons pas vu depuis très longtemps. Depuis des centaines, voire des milliers d'années, l'humain se "
        "définit et s'accomplit en partie, parfois même en grande partie, par le travail. À quoi notre société ressemblera-t-elle dans 20 ans "
        "si 10, 20 ou même 30 % de nos emplois, qui sont actuellement occupés par des personnes en chair et en os, ont été remplacés par une "
        "combinaison de robots et d'ordinateurs utilisant l'IA ?",
        "Pourtant, n'a-t-on pas connu de profondes transformations du marché de travail au cours des 150 dernières années ? À chacune de ces "
        "transformations, plus d'un prévoyait de grands bouleversements sociaux et économiques qui, avec du recul, ne se sont pas concrétisés "
        "ou, du moins, certainement pas comme on le laissait entendre. Dans tous ces cas, la société a su s'adapter et cela a mené à la "
        "création de nouveaux emplois et même, parfois, de nouveaux secteurs de l'économie.",
        "Que nous réserve l'avenir ? Allons-nous évoluer vers « la Société des loisirs » imaginée dans les années 1960, quand les "
        "futurologues prédisaient une société où le travail occuperait une place de moins en moins importante ? Si, depuis cette époque, "
        "c'est plutôt l'inverse qui s'est produit, certains affirment que les progrès technologiques actuels et à venir pourraient bien "
        "concrétiser cette promesse... avec quelques décennies de retard sur les prédictions des années 1960 !",
        "Le passé sera-t-il garant de l'avenir ?",
    ])
    source = "Steven GUILBEAULT, Ou comment l’intelligence artificielle transforme nos vies,\nÉditions Druide Inc. 2019, pp. 21-22."
    gloss = "1. IA : Intelligence Artificielle.\n2. Répercussions : retombées, conséquences, effets."
    docs = [
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Mots expliqués", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (14 points)"
    P2 = "II. Production écrite : (06 points)"
    QT = {
        1: "Dans ce texte, l’idée principale est :\n- les raisons pour lesquelles la technologie de l’IA transforme le marché du travail.\n"
           "- les conséquences de la technologie de l’IA sur le marché du travail.\n- les objectifs de la technologie de l’IA pour le "
           "marché du travail.\nRecopiez la bonne réponse.",
        2: "Trouvez, dans le 4ème paragraphe, la proposition qui caractérise « la Société des loisirs ».",
        3: "« L’auteur évoque des répercussions positives et négatives de l'utilisation massive de l'intelligence artificielle sur nos "
           "sociétés ainsi que sur le monde du travail. »\nRelevez, du texte, pour chaque aspect (positif et négatif), deux (02) expressions "
           "qui le montrent.",
        4: "Soit les expressions suivantes :\nperte de millions d’emplois / apparition de nouveaux secteurs d’économie / tensions sociales / "
           "remplacement de l’homme par des robots / capacité de la société à s’adapter à l’IA / création de nouveaux emplois.\n"
           "Classez-les selon qu’elles renvoient à :\n- Défenseurs de l’IA : " + "…" * 18 + "\n- Opposants de l’IA : " + "…" * 18 + ".",
        5: "Déterminez à qui ou à quoi renvoie chacun des termes : « en », « cela », « nous » et « cette époque » dans les énoncés "
           "ci-dessous :\n- « … nous n'en avons pas vu … » 2ème paragraphe\n- « … et cela a mené à la création … » 3ème paragraphe\n"
           "- « Que nous réserve l'avenir ? » 4ème paragraphe\n- « … depuis cette époque … » 4ème paragraphe",
        6: "« 30% de nos emplois occupés par des personnes en chair et en os ont été remplacés par une combinaison de robots et "
           "d’ordinateurs. »\nRéécrivez cette phrase en la commençant ainsi : « Une combinaison de robots et d’ordinateurs … »",
        7: "Parmi les propositions ci-dessous, distinguez puis recopiez celle qui correspond à la visée communicative de l’auteur :\n"
           "- montrer la menace réelle de l’IA et de la robotisation sur le travail et la société.\n- expliquer les prédictions futuristes "
           "de l’IA et de la robotisation sur le travail et la société.\n- inciter à une réflexion sur l’impact de l’IA et de la "
           "robotisation sur le travail et la société.",
        8: "« … l'humain se définit et s'accomplit en grande partie par le travail. »\nExpliquez, en deux à trois lignes, le rôle du "
           "travail dans l’accomplissement de l’homme.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "Vous participez à une discussion sur une page Facebook qui s’intéresse à l’IA. Vous voulez contribuer à enrichir le "
                     "débat. Rédigez le compte rendu objectif de ce texte (110 mots environ) que vous partagerez avec les abonnés à cette page."},
        {"id": "Sujet 2", "kind": "production libre (texte argumentatif)",
         "consigne": "La formation à distance constitue une opportunité pour des milliers de jeunes qui n’ont pas eu la chance de terminer "
                     "leurs études. Parmi ces jeunes, certains hésitent à suivre une formation à distance proposée par le Ministère de la "
                     "formation professionnelle. Rédigez un texte (150 mots environ) dans lequel vous essayerez de convaincre ces jeunes "
                     "hésitants de s’inscrire à cette formation. Vous partagerez ce texte sur votre page Facebook."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 1) ──
    q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "Idée principale du texte", 1.5)], docs)
    q("q2", "2", P1, QT[2], 2, [el("q2-e1", "Proposition qui caractérise « la Société des loisirs » (4ème paragraphe)", 2)], docs)
    q("q3", "3", P1, QT[3], 2, [el("q3-e1", "Aspect positif : deux expressions (0,5x2)", 1), el("q3-e2", "Aspect négatif : deux expressions (0,5x2)", 1)], docs)
    items4 = [("perte de millions d’emplois", DO[1]), ("apparition de nouveaux secteurs d’économie", DO[0]), ("tensions sociales", DO[1]),
              ("remplacement de l’homme par des robots", DO[1]), ("capacité de la société à s’adapter à l’IA", DO[0]),
              ("création de nouveaux emplois", DO[0])]
    q("q4", "4", P1, QT[4], 1.5, [el(f"q4-e{k}", f"Classement de « {it} » (0,25)", 0.25) for k, (it, _) in enumerate(items4, 1)], docs)
    q("q5", "5", P1, QT[5], 2, [el("q5-e1", "Référent de « en » (2ème paragraphe) (0,5)", 0.5),
                                el("q5-e2", "Référent de « cela » (3ème paragraphe) (0,5)", 0.5),
                                el("q5-e3", "Référent de « nous » (4ème paragraphe) (0,5)", 0.5),
                                el("q5-e4", "Référent de « cette époque » (4ème paragraphe) (0,5)", 0.5)], docs)
    q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "Réécriture : forme du verbe (1)", 1),
                                  el("q6-e2", "Réécriture : traitement du complément d’agent (0,5)", 0.5)], docs)
    q("q7", "7", P1, QT[7], 1.5, [el("q7-e1", "Visée communicative de l’auteur", 1.5)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, l’idée principale est : (choisissez la bonne réponse)",
        "les conséquences de la technologie de l’IA sur le marché du travail.",
        ["les raisons pour lesquelles la technologie de l’IA transforme le marché du travail.",
         "les objectifs de la technologie de l’IA pour le marché du travail."],
        "Corrigé : « les conséquences de la technologie de l’IA sur le marché de travail. »", 1.5, "fr.comprehension")
    mcq("s02", "q2", "q2-e1", "Dans le quatrième paragraphe, quelle proposition caractérise « la Société des loisirs » ?",
        "Une société où le travail occuperait une place de moins en moins importante.",
        ["c'est plutôt l'inverse qui s'est produit", "Que nous réserve l'avenir ?",
         "avec quelques décennies de retard sur les prédictions des années 1960"],
        "Corrigé : « Une société où le travail occuperait une place de moins en moins importante. » (la proposition soulignée dans le "
        "corrigé : « où le travail occuperait une place de moins en moins importante »)", 2, "fr.comprehension")
    REP = ("Corrigé — Répercussions de l’utilisation massive de l’IA : aspects positifs : la création de nouveaux emplois – la création de "
           "nouveaux secteurs de l’économie (accepter aussi : la société a su s’adapter) ; aspects négatifs : millions de pertes d’emplois – "
           "tensions sociales. (0,5 par expression)")
    multi("s03", "q3", "q3-e1", "Sélectionnez deux expressions du texte qui montrent les répercussions POSITIVES de l’utilisation massive "
          "de l’intelligence artificielle.", ["la création de nouveaux emplois", "la création de nouveaux secteurs de l’économie"],
          ["de grands bouleversements sociaux et économiques", "l’arrivée massive des technologies de l’IA", "des personnes en chair et en os"],
          REP, 1, "fr.comprehension", forms=["la société a su s’adapter"])
    multi("s04", "q3", "q3-e2", "Sélectionnez deux expressions du texte qui montrent les répercussions NÉGATIVES de l’utilisation massive "
          "de l’intelligence artificielle.", ["millions de pertes d’emplois", "tensions sociales"],
          ["l’arrivée massive des technologies de l’IA", "des personnes en chair et en os", "les prédictions des années 1960"],
          REP, 1, "fr.comprehension")
    CLS = ("Corrigé — Défenseurs de l’IA : apparition de nouveaux secteurs d’économie / capacité de la société à s’adapter à l’IA / création "
           "de nouveaux emplois ; Opposants de l’IA : perte de millions d’emplois / tensions sociales / remplacement de l’homme par des robots.")
    for k, (it, right) in enumerate(items4, 1):
        binary(f"s{4 + k:02d}", "q4", f"q4-e{k}", f"Classez « {it} » : cette expression renvoie aux…", DO, right, CLS, 0.25, "fr.comprehension")
    mcq("s11", "q5", "q5-e1", "« … nous n'en avons pas vu … » (§2) : à quoi renvoie « en » ?", "des tensions sociales",
        ["des robots", "des milliers d’années", "les futurologues"],
        "Corrigé : « en » : des tensions sociales. (Accepter aussi : des millions de pertes d’emplois)", 0.5, "fr.discours",
        forms=["des millions de pertes d’emplois"])
    mcq("s12", "q5", "q5-e2", "« … et cela a mené à la création … » (§3) : à quoi renvoie « cela » ?", "le fait de savoir s’adapter",
        ["la création de nouveaux emplois", "de grands bouleversements sociaux et économiques", "le recul"],
        "Corrigé : « cela » : le fait de savoir s’adapter. (la société a su s’adapter)", 0.5, "fr.discours",
        forms=["la société a su s’adapter"])
    mcq("s13", "q5", "q5-e3", "« Que nous réserve l'avenir ? » (§4) : à qui renvoie « nous » ?", "l’auteur + toutes les sociétés",
        ["les futurologues", "les robots et les ordinateurs", "les journalistes du Guardian"],
        "Corrigé : « nous » : l’auteur + (toutes les sociétés / tout le monde ou toute l’humanité). (Accepter aussi : l’auteur + les lecteurs)",
        0.5, "fr.discours", forms=["l’auteur + tout le monde", "l’auteur + toute l’humanité", "l’auteur + les lecteurs"])
    mcq("s14", "q5", "q5-e4", "« … depuis cette époque … » (§4) : à quoi renvoie « cette époque » ?", "les années 1960",
        ["janvier 2017", "les 150 dernières années", "dans 20 ans"], "Corrigé : « cette époque » : les années 1960.", 0.5, "fr.discours")
    PASS = ("Corrigé : « Une combinaison de robots et d’ordinateurs a remplacé 30% de nos emplois occupés par des personnes en chair et en "
            "os. » – accent mis sur une combinaison. Accepter aussi : « Une combinaison de robots et d’ordinateurs ont remplacé 30% de nos "
            "emplois occupés par des personnes en chair et en os. » – accent mis sur robots et ordinateurs associés. N.B. : (conjugaison du "
            "verbe = 1 pt + suppression de « par » = 0.5 pt)")
    LEAD = ("« 30% de nos emplois occupés par des personnes en chair et en os ont été remplacés par une combinaison de robots et "
            "d’ordinateurs. » est réécrite en commençant par « Une combinaison de robots et d’ordinateurs … ».")
    mcq("s15", "q6", "q6-e1", f"{LEAD} Quelle forme du verbe faut-il employer ?", "a remplacé",
        ["ont été remplacés", "a été remplacée", "avait remplacé"], PASS, 1, "fr.grammaire", forms=["ont remplacé"])
    mcq("s16", "q6", "q6-e2", f"{LEAD} Que devient le complément d’agent « par une combinaison de robots et d’ordinateurs » ?",
        "Il devient le sujet du verbe, sans la préposition « par ».",
        ["Il reste complément d’agent, introduit par « par ».", "Il devient complément d’objet direct, introduit par « par ».",
         "Il devient complément circonstanciel, introduit par « avec »."], PASS, 0.5, "fr.grammaire")
    mcq("s17", "q7", "q7-e1", "Parmi les propositions, laquelle correspond à la visée communicative de l’auteur ?",
        "inciter à une réflexion sur l’impact de l’IA et de la robotisation sur le travail et la société.",
        ["montrer la menace réelle de l’IA et de la robotisation sur le travail et la société.",
         "expliquer les prédictions futuristes de l’IA et de la robotisation sur le travail et la société."],
        "Corrigé : « inciter à une réflexion sur l’impact de l’IA et de la robotisation sur le travail et la société. »", 1.5, "fr.enonciation")
    model8 = ("Bien plus qu'une simple activité économique : le travail est essentiel à l'épanouissement personnel, permettant à l'homme de "
              "se construire une identité, de se sentir utile et de contribuer à la société…")
    criteria_question("q8", 18, "8", P1, QT[8],
                      [("Respect de la consigne", "Respect de la consigne. Explication et le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées. A titre indicatif, on cite l’exemple suivant : " + model8),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model8, "à titre indicatif", "fr.ecriture", docs)
    production("q9", 22, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – الشعب العلمية – الموضوع الأوّل (الذّكاء الاصطناعيّ وعالم الشّغل، Steven GUILBEAULT)",
            ["س1: الحلّ يكتب «marché de travail» والورقة «marché du travail» ⇒ الخيار الصّحيح بلفظ الورقة.",
             "س2 (2): الحلّ «Une société où le travail occuperait une place de moins en moins importante.» (المسطَّر: الجملة الموصولة)؛ المشتّتات "
             "قضايا أخرى من الفقرة 4 لا تصف «la Société des loisirs» (لم يُعرض «imaginée dans les années 1960» لأنّه قابل للدّفاع).",
             "س3 «0.5 x 2 + 0.5 x 2» ⇒ عنصران (إيجابيّ 1 / سلبيّ 1)، كلّ منهما multi باختيارين صحيحين؛ «la société a su s’adapter» المقبول لا يُعرض؛ "
             "الحلّ يكتب «l’écononomie» (خطأ مطبعيّ) فكُتب «l’économie». لم يُعرض «remplacés par une combinaison de robots» مشتّتًا للسّلبيّ لأنّه قابل للدّفاع.",
             "س4 «0.25 x 6» ⇒ ستّة عناصر ثنائيّة (Défenseurs / Opposants).",
             "س5: «en» الصّحيح «des tensions sociales» (المقبول «des millions de pertes d’emplois» ليس مشتّتًا)، «cela» «le fait de savoir s’adapter»، "
             "«nous» «l’auteur + toutes les sociétés» (المقبولات: tout le monde، toute l’humanité، les lecteurs ليست مشتّتات).",
             "س6 «1 + 0.5» حسب N.B. ⇒ عنصران: صيغة الفعل (1، الصّحيح «a remplacé» و«ont remplacé» المقبول ليس مشتّتًا) ومعاملة نائب الفاعل "
             "(0.5، «suppression de « par »»)؛ تسمية العنصرين محايدة حتى لا تكشف الجواب.",
             "س8: «0.5x4» معايير ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (6): الشّبكتان تختلفان سطرًا بسطر ⇒ أدقّ شبكة مشتركة: (تقديم + بنية) 1، الانسجام 4×0.25، الاختيار التّلفّظيّ 1، "
             "اختيار المعلومات 1، (تركيب + معجم + ترقيم) 1.5، الأزمنة 0.25، الإملاء 0.25؛ أسطر كلّ شبكة بعلاماتها في spec."])


# ════════════════════════════════════ SUJET 2 ════════════════════════════════════
def build_p2():
    text = "\n".join([
        "Le 22 octobre 1956 est un jour qui entra avec fracas dans l'Histoire. C'est le jour où le gouvernement français se rendit coupable "
        "d'un acte de pure piraterie aérienne : l'arraisonnement¹ de l'avion affrété² par le gouvernement marocain pour le transport de "
        "quatre chefs historiques de la révolution algérienne, Hocine Aït Ahmed, Ahmed Ben Bella, Mohammed Boudiaf et Mohammed Kheider, "
        "ainsi que leur conseiller, le professeur Mostefa Lacheraf. […]",
        "À Tunis, la délégation algérienne devait assister à une conférence pour la paix. Le thème en devait être l'évaluation des voies et "
        "moyens d'arrêter la guerre d'Algérie. Une fois de plus, la France venait de rater une bonne occasion de sortir honorablement du "
        "guêpier³ algérien. […] Le gouvernement français était persuadé que « les événements d'Algérie » allaient prendre fin avec "
        "l'arrestation des chefs rebelles. […]",
        "En Algérie, la nouvelle de l'arraisonnement de l'avion, si elle provoqua l'enthousiasme délirant des ultras européens, fut, par "
        "contre, accueillie avec consternation et inquiétude par la population musulmane. La révolution est-elle décapitée ? Tous les "
        "sacrifices consentis jusque-là auraient-ils été vains ?",
        "La réponse ne tarda pas à venir. Dans les semaines qui suivirent cet acte de brigandage, les combats allaient continuer de plus "
        "belle. Si la délégation extérieure du FLN a joué un rôle important dans le déclenchement du 1er novembre en approvisionnant les "
        "maquis en armes et en sensibilisant l'opinion mondiale à la cause algérienne, il devenait clair, cependant, que « le cerveau » du "
        "mouvement révolutionnaire et les forces vives qui le nourrissaient se trouvaient en Algérie même. […]",
        "L'arraisonnement de l'avion des quatre chefs historiques fut un acte, important certes, mais non décisif. […] Malgré le coup dur "
        "qu'on avait tenté de lui porter, la révolution continuait, comme un grand fleuve dont il est impossible de détourner le cours. Tel "
        "était notre état d'esprit en cette fin d'octobre 1956. La guerre allait donc continuer.",
    ])
    source = "Messaoud DJENNAS*, LA GUERRE DE LIBÉRATION NATIONALE, telle que je l'ai vécue,\nCasbah Éditions 2016, pp. 84-85."
    gloss = ("*Messaoud DJENNAS : médecin, moudjahid et auteur algérien.\n1. Arraisonnement : action d’arrêter un avion pour un contrôle.\n"
             "2. Affrété : mis à la disposition.\n3. Guêpier : piège, situation compliquée.")
    docs = [
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Notes", "text": gloss},
    ]
    P1 = "I. Compréhension de l’écrit : (14 points)"
    P2 = "II. Production écrite : (06 points)"
    QT = {
        1: "Dans ce texte, l’événement évoqué est :\n- le détournement d’un avion par des dirigeants du FLN.\n- le détournement d’un avion "
           "transportant des dirigeants du FLN.\n- le crash de l’avion transportant des dirigeants du FLN.\nRecopiez la bonne réponse.",
        2: "« …les combats allaient continuer de plus belle. » Cette phrase veut dire :\n- les combats allaient s’arrêter progressivement.\n"
           "- les combats allaient se terminer rapidement.\n- les combats allaient se poursuivre intensivement.\nRecopiez la bonne réponse.",
        3: "Relevez, du texte, deux (02) expressions qui renvoient à « l’arraisonnement de l’avion ».",
        4: "Répondez par « Vrai » ou « Faux ».\na. La délégation algérienne a été arrêtée à son retour de la conférence de Tunis.\nb. La "
           "population musulmane a réagi positivement à la nouvelle de l’arraisonnement.\nc. La population européenne a salué l’acte de "
           "l’arraisonnement.\nd. L’arrestation des dirigeants du FLN a mis fin à la guerre de libération.",
        5: "Soit les expressions suivantes :\ncrainte et préoccupation / certitude d’avoir mis fin à la révolution / sentiment de joie / "
           "intention de participer à la conférence pour la paix / poursuite du combat libérateur / sabotage de la conférence pour la paix.\n"
           "Classez-les selon qu’elles renvoient à :\n- La partie algérienne : " + "…" * 15 + ".." + "\n- La partie française : " + "…" * 15 + "....",
        6: "Déterminez à qui ou à quoi renvoie chacun des pronoms : « leur », « le », « on » et « lui » dans les énoncés ci-dessous :\n"
           "- « …, ainsi que leur conseiller,… » 1er paragraphe\n- « … les forces vives qui le nourrissaient … » 4ème paragraphe\n"
           "- « … le coup dur qu'on avait tenté de lui porter, ... » 5ème paragraphe",
        7: "Parmi les propositions ci-dessous, distinguez puis recopiez celle qui correspond à la visée communicative de l’auteur :\n"
           "- saluer l’arrestation des chefs de la révolution algérienne.\n- informer de l’acte de piratage et de son impact sur la "
           "révolution.\n- glorifier l’acte de piraterie aérienne du gouvernement français.",
        8: "«…, la révolution continuait, comme un grand fleuve dont il est impossible de détourner le cours. »\nExpliquez, en deux à trois "
           "lignes, pourquoi, selon vous, il était impossible d’arrêter la révolution algérienne.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "A l’occasion de la célébration du 08 mai, l’association « Histoire de mon pays », dont vous êtes membre, organise une "
                     "conférence sur le thème « Crimes et délits coloniaux ». Rédigez le compte rendu objectif de ce texte (120 mots environ) "
                     "que vous lirez devant les personnes présentes à cette conférence."},
        {"id": "Sujet 2", "kind": "production libre (appel)",
         "consigne": "A l’occasion de la journée mondiale du mot de passe, un magazine en ligne dont vous êtes abonné lance une campagne de "
                     "sensibilisation dont le thème est : « Le piratage et les vols en masse de données personnelles sur le Net ». Rédigez un "
                     "appel (150 mots environ) pour sensibiliser les internautes aux dangers du partage abusif des informations privées. "
                     "Votre texte sera publié sur le forum de ce magazine."},
    ]
    PE = "Traitez l’un des deux sujets suivants :\nSujet 1 :\n" + SUJETS[0]["consigne"] + "\nSujet 2 :\n" + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 2) ──
    q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "Événement évoqué dans le texte", 1.5)], docs)
    q("q2", "2", P1, QT[2], 1.5, [el("q2-e1", "Sens de la phrase « …les combats allaient continuer de plus belle. »", 1.5)], docs)
    q("q3", "3", P1, QT[3], 2, [el("q3-e1", "Deux expressions qui renvoient à « l’arraisonnement de l’avion » (1+1)", 2)], docs)
    stm4 = [("a", "La délégation algérienne a été arrêtée à son retour de la conférence de Tunis.", "Faux",
             "« À Tunis, la délégation algérienne devait assister à une conférence pour la paix. » (§2)."),
            ("b", "La population musulmane a réagi positivement à la nouvelle de l’arraisonnement.", "Faux",
             "La nouvelle fut « accueillie avec consternation et inquiétude par la population musulmane » (§3)."),
            ("c", "La population européenne a salué l’acte de l’arraisonnement.", "Vrai",
             "« elle provoqua l’enthousiasme délirant des ultras européens » (§3)."),
            ("d", "L’arrestation des dirigeants du FLN a mis fin à la guerre de libération.", "Faux",
             "« la révolution continuait […] La guerre allait donc continuer. » (§5)")]
    q("q4", "4", P1, QT[4], 2, [el(f"q4-e{k}", f"Affirmation {x[0]}. (0,5)", 0.5) for k, x in enumerate(stm4, 1)], docs)
    items5 = [("crainte et préoccupation", AF[0]), ("certitude d’avoir mis fin à la révolution", AF[1]), ("sentiment de joie", AF[1]),
              ("intention de participer à la conférence pour la paix", AF[0]), ("poursuite du combat libérateur", AF[0]),
              ("sabotage de la conférence pour la paix", AF[1])]
    q("q5", "5", P1, QT[5], 1.5, [el(f"q5-e{k}", f"Classement de « {it} » (0,25)", 0.25) for k, (it, _) in enumerate(items5, 1)], docs)
    q("q6", "6", P1, QT[6], 2, [el("q6-e1", "Référent de « leur » (1er paragraphe) (0,5)", 0.5),
                                el("q6-e2", "Référent de « le » (4ème paragraphe) (0,5)", 0.5),
                                el("q6-e3", "Référent de « on » (5ème paragraphe) (0,5)", 0.5),
                                el("q6-e4", "Référent de « lui » (5ème paragraphe) (0,5)", 0.5)], docs)
    q("q7", "7", P1, QT[7], 1.5, [el("q7-e1", "Visée communicative de l’auteur", 1.5)], docs)

    # ── Steps ──
    mcq("s01", "q1", "q1-e1", "Dans ce texte, l’événement évoqué est : (choisissez la bonne réponse)",
        "le détournement d’un avion transportant des dirigeants du FLN.",
        ["le détournement d’un avion par des dirigeants du FLN.", "le crash de l’avion transportant des dirigeants du FLN."],
        "Corrigé : « le détournement d’un avion transportant des dirigeants du FLN. »", 1.5, "fr.comprehension")
    mcq("s02", "q2", "q2-e1", "« …les combats allaient continuer de plus belle. » Cette phrase veut dire : (choisissez la bonne réponse)",
        "les combats allaient se poursuivre intensivement.",
        ["les combats allaient s’arrêter progressivement.", "les combats allaient se terminer rapidement."],
        "Corrigé : « les combats allaient se poursuivre intensivement. »", 1.5, "fr.vocabulaire")
    multi("s03", "q3", "q3-e1", "Sélectionnez deux expressions du texte qui renvoient à « l’arraisonnement de l’avion ».",
          ["acte de pure piraterie aérienne", "acte de brigandage"],
          ["une conférence pour la paix", "le guêpier algérien", "l’enthousiasme délirant"],
          "Corrigé : acte de pure piraterie aérienne / acte de brigandage / le coup dur. (Accepter : un acte important certes, mais non "
          "décisif.) (1 point par expression)", 2, "fr.vocabulaire",
          forms=["le coup dur", "un acte important certes, mais non décisif"])
    for k, (letter, stmt, right, why) in enumerate(stm4, 1):
        binary(f"s{3 + k:02d}", "q4", f"q4-e{k}", f"Vrai ou faux : « {stmt} »", VF, right,
               f"Corrigé : {right}. {why} (Ne pas pénaliser le candidat qui ne recopie pas les propositions.)", 0.5, "fr.comprehension")
    CLS = ("Corrigé — La partie française : certitude d’avoir mis fin à la révolution / sentiment de joie / sabotage de la conférence pour "
           "la paix ; La partie algérienne : crainte et préoccupation / intention de participer à la conférence pour la paix / poursuite du "
           "combat libérateur.")
    for k, (it, right) in enumerate(items5, 1):
        binary(f"s{7 + k:02d}", "q5", f"q5-e{k}", f"Classez « {it} » : cette expression renvoie à…", AF, right, CLS, 0.25, "fr.comprehension")
    mcq("s14", "q6", "q6-e1", "« …, ainsi que leur conseiller,… » (§1) : à qui renvoie « leur » ?",
        "quatre chefs historiques de la révolution algérienne",
        ["le gouvernement marocain", "le gouvernement français", "le professeur Mostefa Lacheraf"],
        "Corrigé : « leur » = quatre chefs historiques de la révolution algérienne / Hocine Aït Ahmed, Ahmed Ben Bella, Mohammed Boudiaf et "
        "Mohammed Kheider.", 0.5, "fr.discours",
        forms=["Hocine Aït Ahmed, Ahmed Ben Bella, Mohammed Boudiaf et Mohammed Kheider"])
    mcq("s15", "q6", "q6-e2", "« … les forces vives qui le nourrissaient … » (§4) : à quoi renvoie « le » ?",
        "le cerveau du mouvement révolutionnaire",
        ["le déclenchement du 1er novembre", "le gouvernement français", "le gouvernement marocain"],
        "Corrigé : « le » = le cerveau du mouvement révolutionnaire. (Accepter : mouvement révolutionnaire.)", 0.5, "fr.discours",
        forms=["mouvement révolutionnaire", "le mouvement révolutionnaire"])
    mcq("s16", "q6", "q6-e3", "« … le coup dur qu'on avait tenté de lui porter, ... » (§5) : à qui renvoie « on » ?",
        "le gouvernement français", ["la population musulmane", "la délégation algérienne", "le gouvernement marocain"],
        "Corrigé : « on » = le gouvernement français / la France. (Accepter : les militaires français ou la France coloniale.)", 0.5,
        "fr.discours", forms=["la France", "les militaires français", "la France coloniale"])
    mcq("s17", "q6", "q6-e4", "« … le coup dur qu'on avait tenté de lui porter, ... » (§5) : à quoi renvoie « lui » ?",
        "la révolution", ["le gouvernement français", "les ultras européens", "l’opinion mondiale"],
        "Corrigé : « lui » = la révolution ou révolution algérienne.", 0.5, "fr.discours",
        forms=["révolution algérienne", "la révolution algérienne"])
    mcq("s18", "q7", "q7-e1", "Parmi les propositions, laquelle correspond à la visée communicative de l’auteur ?",
        "informer de l’acte de piratage et de son impact sur la révolution.",
        ["saluer l’arrestation des chefs de la révolution algérienne.", "glorifier l’acte de piraterie aérienne du gouvernement français."],
        "Corrigé : « informer de l’acte de piratage aérien et son impact sur la révolution. »", 1.5, "fr.enonciation")
    model8 = ("Je pense qu’il était impossible d'arrêter la révolution algérienne car elle était alimentée par un désir profond d'indépendance "
              "et de justice sociale, profondément ancré dans la population. L’adhésion du Peuple la transforma rapidement en un mouvement "
              "puissant comme un fleuve dont le cours ne peut être modifié.")
    criteria_question("q8", 19, "8", P1, QT[8],
                      [("Respect de la consigne", "Respect de la consigne. Explication avec implication directe ou indirecte du candidat et "
                                                  "le nombre de lignes."),
                       ("Pertinence des idées", "Pertinence des idées. A titre indicatif, on cite l’exemple suivant : " + model8),
                       ("Cohérence", "Cohérence."), ("Correction de la langue", "Correction de la langue.")],
                      model8, "à titre indicatif", "fr.ecriture", docs)
    production("q9", 23, P2, PE, SUJETS, docs)
    return ("بكالوريا 2026 (الدورة العاديّة) – اللغة الفرنسية – الشعب العلمية – الموضوع الثّاني (اختطاف طائرة القادة الخمسة 22 أكتوبر 1956، Messaoud DJENNAS)",
            ["س3 «1 + 1» على قائمة مغلقة (acte de pure piraterie aérienne / acte de brigandage / le coup dur + Accepter : un acte important certes, "
             "mais non décisif) ⇒ عنصر واحد (2) بخطوة multi باختيارين صحيحين؛ الصّيغتان المقبولتان الأخريان ليستا مشتّتين؛ لم يُعرض «l’arrestation "
             "des chefs rebelles» ولا «cet acte» لأنّهما قابلان للدّفاع.",
             "س5: الحلّ يرتّب العمودين «La partie française | La partie algérienne» والورقة «algérienne» أوّلًا ⇒ عُرض الزّوج بترتيب الورقة.",
             "س6: الصّحيح صيغة الحلّ الأولى (quatre chefs historiques… / le cerveau du mouvement révolutionnaire / le gouvernement français / "
             "la révolution) والصّيغ المقبولة الأخرى ليست مشتّتات؛ لم يُعرض «la délégation extérieure du FLN» مشتّتًا لـ«lui» لأنّه قابل للدّفاع.",
             "س7: الحلّ «informer de l’acte de piratage aérien et son impact…» والخيار الصّحيح بلفظ الورقة «informer de l’acte de piratage et de son impact…».",
             "س8: «0.5x4» معايير ⇒ أربعة عناصر مؤجَّلة.",
             "الإنتاج الكتابيّ (6): نفس الشّبكة المشتركة للموضوع الأوّل (10 عناصر)."])


TITLE, PAPER_NOTES = build_p1() if PAPER == 1 else build_p2()

COMMON_NOTES = [
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word).",
    f"الموضوع: gdrive:{PAPER_ID} ({PAPER_TITLE}) ص{'1–2' if PAPER == 1 else '3–4'}؛ الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان: gdrive:{CORR_ID} "
    f"({CORR_TITLE}) ص{'1' if PAPER == 1 else '2'} وص3 (الإنتاج الكتابيّ للموضوعين). الملفّان PDF رقميّان من الدّيوان الوطنيّ للامتحانات (لا مسح ضوئيّ): "
    "أُخذ النّصّ من طبقة النّصّ (pdftotext -raw) وقوبل كلّ سطر بصورة الصّفحة (150 نقطة)، وتحقّق سكربت من أنّ كلّ نصّ حرفيّ موجود في طبقة النّصّ.",
    "الشّعبة من رأس الورقة «الشعبة: علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد، فنون» ⇒ SCI وMATH وTM وGE؛ شعبة «فنون» مذكورة في الرّأس "
    "لكن لا رمز لها في شعب PLAY فلم تُدرج. «الدورة العادية» من اسم الملفّ في Drive (الورقة تطبع «الدورة: 2026»). المجموع: فهم المكتوب 14 + إنتاج "
    "كتابيّ 06؛ كلّ العلامات من عمودَي «مجزأة/مجموع» في الحلّ الرّسميّ.",
    "خلافات طبقة النّصّ مع الصّورة (الصّورة هي المرجع): رأس عربيّ معكوس (السّنة «0302»، المدّة «02 سا و 03 د» والصّورة «02 سا و30 د»)، تذييل ص2 "
    "من الحلّ «صفحة 0 من 3» في الطّبقة؛ إحالات الهوامش مرفوعة ⇒ ¹ ² ³؛ «1er/2ème…» المرفوعة كُتبت عاديّة. حُفظ كما طُبع: الفاصلة العليا "
    "المستقيمة «'» في النّصّين وفي بعض الاقتباسات (l'utilisation، n'en، l'avenir، qu'on…) والمنحنية «’» في أغلب الأسئلة، «30% de» في س6 مقابل "
    "«30 % de» في النّصّ، «promesse...»، و««…,» بلا مسافة في س8 من الموضوع الثّاني.",
    "قرارات عامّة: «n×m» لبنود متمايزة ⇒ عنصر لكلّ بند، ولاختيارات متبادلة من النّصّ ⇒ عنصر واحد بخطوة multi. الخيارات الثّنائيّة (Vrai/Faux، "
    "Défenseurs/Opposants، الطّرف الجزائريّ/الفرنسيّ) تُخزَّن معكوسة لأنّ shuffle_exam_set.py يقلب دائمًا قائمة من خيارين. قاعدة «accepter» الموحَّدة: "
    "صيغة أخرى للجواب نفسه أو قائمة مغلقة ⇒ تفاعليّ (الصّحيح صيغة الحلّ الأولى، والصّيغ المقبولة في الشّرح ولا تكون مشتّتًا أبدًا)؛ الجواب المفتوح "
    "(«à titre indicatif») ⇒ essay_builder مؤجَّل. الإنتاج الكتابيّ = سؤال أصليّ واحد يضمّ الموضوعين، وتفاصيل شبكة كلّ موضوع في spec. المشتّتات "
    "من إعداد التّحويل وتحتاج مراجعة.",
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
