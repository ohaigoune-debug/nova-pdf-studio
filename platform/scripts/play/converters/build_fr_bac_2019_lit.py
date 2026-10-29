"""Conversion (French pilot): BAC 2019 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الأوّل والثّاني.

Usage:  python3 scripts/play/converters/build_fr_bac_2019_lit.py <out.json> [1|2]
        (the paper number is taken from the file name «…-p1.json» / «…-p2.json» when not given)
then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive, folder 1WApaXW2H1JLbqrYWlNy95Kzmlje63umx):
- Paper: gdrive 1IWZ6Rbo7WoItvIqmkxNZJN9x7mKKkS2r («2019 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الموضوع.pdf»,
  4 pages: sujet 1 pp. 1–2, sujet 2 pp. 3–4). Official ONEC digital PDF (not a scan): it has an embedded text layer, which is
  also what Drive's read_file_content returns. That layer was used as a helper only; every verbatim string below was checked
  against the page images (pdftoppm 150 dpi, crops at 220–300 dpi).
- Official corrigé + barème: gdrive 1CIoSlmjKO-65DB407pzzOYqUbMxt6ifY («… - الحل.pdf», 4 pages: sujet 1 pp. 1–2, sujet 2 pp. 3–4),
  digital PDF, read from the page images. The paper prints only section totals (13 + 7); every element mark comes from the
  corrigé's «مجزأة / مجموع» columns.

Text layer / Drive export vs page image (image wins):
- Arabic header comes out reversed; duration «02 سا و03 د» in the layer, «02 سا و30 د» on the image; page 3 footer «صفحة 0 من 4»
  in the layer, «صفحة 3 من 4» on the image.
- Footnote calls «dénégations1», «ingurgiter2» are superscripts on the image ⇒ written «dénégations¹», «ingurgiter²».
  Superscript «er» / «ème» («1er», «3ème») ⇒ plain «1er», «3ème».
- Character-level extraction splits some words («interr ogato ires», «l  es "incu lpés"»); the image reads normally.
- The source contains typed double spaces («Celle-ci  / y / il.», «varier  ces», «personnes  enlevées», «ses  interrogatoires»,
  «renvoient  les mots  suivants», «cette dernière  /  lui.», «en  la commençant», «veut dire  par», «présentez  un/à»…). They are
  invisible on the printed page and the Drive export has single spaces ⇒ every run of spaces is written as ONE space.
- Kept exactly as printed: «brulée» (no circumflex, checked at 300 dpi), «la villa des "Roses,» (quote never closed),
  «"Evènements historiques"», «suivants:-», «Recopiez la bonne réponse» (no final period in Q7), «[…]Selon», «bienfaits. ."».
- Line breaks: list items and answer lines keep their «\n»; lines that only wrap (justified prose, the Q6 word list, the Q6 sentence,
  P2 Q8) are joined with a space. Dotted answer lines are copied with their exact «…» / «.» sequence from the text layer.

Conversion decisions (French pilot — see also source.notes):
- Streams: header «الشعبة: آداب وفلسفة» ⇒ ["LIT"]. Session «الدورة العاديّة» comes from the Drive file title (paper prints «دورة: 2019»).
- «n x m» lines: distinct statements / items ⇒ one element per item (V/F, classifications, pronouns, passive parts);
  interchangeable picks from a list ⇒ one element (P1 Q3 «quatre supplices», P2 Q1, P2 Q2 per category);
  a single gap-fill «0.25x6» ⇒ one element with one 6-hole fill_blank (share-of-holes grading = 0.25 per hole).
- Two-option mcq (Vrai/Faux, Tortionnaire/Prisonnier, sieste parfaite/bienfaits) are stored REVERSED (["Faux","Vrai"]…):
  shuffle_exam_set.py always swaps a 2-option list, so they display in the paper's fixed order and the position never gives the
  answer away. Every other mcq keeps the right option first before shuffling.
- Binding rule «accepter… / toute réponse…» ⇒ deferred essay_builder: P1 Q4 «celle-ci» (Accepter : unité de parachutistes),
  P1 Q8 and P2 Q8 (4 criteria × 0.5), P2 Q1 (Accepter : Le manque de sieste au travail), P2 Q6 (Accepter : « Elle augmenterait… »).
- Production écrite «Traitez un sujet au choix»: one original question holding both sujets (7 pts). The corrigé gives a different
  grid per sujet (compte rendu / production libre) whose lines do not split identically, so the 13 elements are the finest grid
  common to both (Organisation: présentation 0.5, progression / répétitions / contre-sens / connecteurs 4×0.25, structure 0.5;
  Planification 1 + 1; Langue 1 + 4×0.5); each deferred step's spec quotes each sujet's own barème lines and marks.
- Distractors: never an answer the corrigé lists or accepts; never an expression of the text that could be argued to fit.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]
if len(sys.argv) > 2:
    PAPER = int(sys.argv[2])
else:
    _m = re.search(r"-p([12])\.json$", OUT)
    assert _m, "paper number: pass 1|2 or name the output …-p1.json / …-p2.json"
    PAPER = int(_m.group(1))
assert PAPER in (1, 2)

SET_ID = f"fr-bac-2019-lit-p{PAPER}"
STREAMS = ["LIT"]
PAPER_ID = "1IWZ6Rbo7WoItvIqmkxNZJN9x7mKKkS2r"
PAPER_TITLE = "2019 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
CORR_ID = "1CIoSlmjKO-65DB407pzzOYqUbMxt6ifY"
CORR_TITLE = "2019 - اللغة الفرنسية - آداب وفلسفة - الدورة العادية - الحل.pdf"

# Two-option questions: display order on the paper. Stored reversed (the shuffle always swaps two options).
VF = ("Vrai", "Faux")
TP = ("Tortionnaire", "Prisonnier")
SP = ("D’une sieste parfaite", "Des bienfaits de la sieste")
BINARY = [VF, TP, SP]


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
S = []


def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def binary(sid, qid, eid, prompt, pair, right, expl, pts, skill):
    """mcq with two options shown in the paper's order `pair`; stored reversed so the mandatory shuffle restores that order."""
    assert right in pair
    stored = [pair[1], pair[0]]
    st(sid, qid, eid, "mcq", prompt, {"options": stored}, {"correct": stored.index(right)}, expl, pts, skill)


def essay(sid, qid, eid, prompt, spec, rubric, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder",
              "prompt": prompt, "payload": {"type": "essay_builder", "spec": spec},
              "answer": {"type": "essay_builder", "spec": {"rubric": rubric, **({"model_answer": spec["model_answer"]} if spec.get("model_answer") else {}),
                                                            **({"accepted": spec["accepted"]} if spec.get("accepted") else {})}},
              "explanation": expl, "points": pts, "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


def short_answer_criteria(qid, first_sid, task, model, acceptance, skill, prefix):
    """«Réponse à titre indicatif … (accepter toute …)» + Critères d’évaluation 0.5x4 ⇒ four deferred criteria."""
    crits = [("Pertinence des idées", "Pertinence des idées"), ("Cohérence", "Cohérence"),
             ("Correction de la langue", "Correction de la langue"), ("Nombre de lignes", "Nombre de lignes (deux à trois lignes)")]
    els = []
    for k, (crit, ind) in enumerate(crits, 1):
        eid = f"{qid}-e{k}"
        els.append(el(eid, f"Critère : {crit} (0,5)", 0.5))
        essay(f"s{first_sid + k - 1:02d}", qid, eid, f"{prefix} — réponse rédigée en deux à trois lignes, critère : {crit}",
              {"task": task, "lines": [2, 3], "criterion": crit, "indicator": ind, "model_answer": model, "acceptance": acceptance,
               "barème": "0.5x4 — Critères d’évaluation : Pertinence des idées / Cohérence / Correction de la langue / Nombre de lignes"},
              ind, f"Réponse ouverte corrigée avec les critères officiels (0,5 chacun). Réponse à titre indicatif du corrigé : {model} ({acceptance})",
              0.5, skill)
    return els


PE_GRID = [  # (suffix, label, points, criterion) — common to both sujets; per-sujet barème lines in PE_LINES[PAPER]
    ("e1", "Organisation : présentation du texte (mise en page)", 0.5, "Présentation du texte"),
    ("e2", "Organisation : progression des informations", 0.25, "Progression des informations"),
    ("e3", "Organisation : absence de répétitions", 0.25, "Absence de répétitions"),
    ("e4", "Organisation : absence de contre-sens", 0.25, "Absence de contre-sens"),
    ("e5", "Organisation : emploi des connecteurs", 0.25, "Emploi des connecteurs"),
    ("e6", "Organisation : structure adéquate", 0.5, "Structure adéquate"),
    ("e7", "Planification : choix énonciatif (en relation avec la consigne)", 1, "Choix énonciatif"),
    ("e8", "Planification : choix des informations", 1, "Choix des informations"),
    ("e9", "Langue : correction des phrases au plan syntaxique", 1, "Correction syntaxique"),
    ("e10", "Langue : adéquation du lexique à la thématique", 0.5, "Adéquation du lexique"),
    ("e11", "Langue : utilisation adéquate des signes de ponctuation", 0.5, "Ponctuation"),
    ("e12", "Langue : emploi correct des temps et des modes", 0.5, "Temps et modes"),
    ("e13", "Langue : orthographe", 0.5, "Orthographe"),
]

PE_LINES = {
    1: {  # corrigé p. 2 — «Compte-rendu» (sujet 1) / «Production libre» (sujet 2)
        "e1": ("0.5 — Présentation du texte (mise en page)",
               "0.25 — Présentation du texte (mise en page) + 0.25 — Présence de titre et de sous titres (rubrique « Présentation du texte (mise en page selon le type d’écrit demandé) »)"),
        "e2": ("0.25 (0.25x4 Cohérence du texte) — Progression des informations", "0.25 (0.25x4 Cohérence du texte) — Progression des informations"),
        "e3": ("0.25 (0.25x4 Cohérence du texte) — absence de répétitions", "0.25 (0.25x4 Cohérence du texte) — absence de répétitions"),
        "e4": ("0.25 (0.25x4 Cohérence du texte) — absence de contre-sens", "0.25 (0.25x4 Cohérence du texte) — absence de contre sens"),
        "e5": ("0.25 (0.25x4 Cohérence du texte) — emploi des connecteurs", "0.25 (0.25x4 Cohérence du texte) — emploi de connecteurs"),
        "e6": ("0.50 — Structure adéquate : Accroche / condensation",
               "0.25x2 — structure adéquate (accroche, condensation) / Structure adéquate (introduction- développement- conclusion)"),
        "e7": ("1 — choix énonciatif (en relation avec la consigne)", "1 — choix énonciatif (en relation avec la consigne)"),
        "e8": ("1 — choix des informations sélection des informations essentielles)", "1 — choix des informations (originalité et pertinence des idées)"),
        "e9": ("1 — correction des phrases au plan syntaxique", "1 — correction des phrases au plan syntaxique"),
        "e10": ("0.5 — adéquation du lexique à la thématique", "0.5 — adéquation du lexique à la thématique"),
        "e11": ("0.5 — utilisation adéquate de signes de ponctuation", "0.5 — utilisation adéquate de signes de ponctuation"),
        "e12": ("0.5 — emploi correct des temps et des modes", "0.5 — emploi correct des temps et des modes"),
        "e13": ("0.5 — orthographe (pas plus de 10 fautes pour un texte de 150 mots environ).",
                "0.5 — orthographe (pas plus de 10 fautes pour un texte de 150 mots environ)."),
    },
    2: {  # corrigé p. 4 — «Compte rendu objectif» (sujet 1) / «Production libre» (sujet 2)
        "e1": ("0.25 — Présentation du texte (mise en page). + 0.25 — Présence de titre et de sous titres.",
               "0.25 — Présentation du texte (mise en page selon le type d’écrit demandé). + 0.25 imprimé en regard de « Cohérence du texte. » (pas de ligne « titre et sous-titres » dans cette grille ; les quatre lignes * portent le 0.25x4)"),
        "e2": ("0.25 (0.25x4) — Progression des informations.", "0.25 (0.25x4) — *Progression des informations."),
        "e3": ("0.25 (0.25x4) — absence de répétitions.", "0.25 (0.25x4) — *absence de répétitions."),
        "e4": ("0.25 (0.25x4) — absence de contre sens.", "0.25 (0.25x4) — *absence de contre sens."),
        "e5": ("0.25 (0.25x4) — emploi de connecteurs.", "0.25 (0.25x4) — *emploi de connecteurs."),
        "e6": ("0.25x2 — structure adéquate (accroche, condensation).", "0.25x2 — structure adéquate (introduction, développement, conclusion)."),
        "e7": ("1 — Choix énonciatif en relation avec la consigne.", "1 — Choix énonciatif en relation avec la consigne."),
        "e8": ("1 — Choix des informations (originalité et pertinence des idées).", "1 — Choix des informations (originalité et pertinence des idées)."),
        "e9": ("1 — Correction des phrases au plan syntaxique.", "1 — Correction des phrases au plan syntaxique."),
        "e10": ("0.5 — Adéquation du lexique à la thématique.", "0.5 — Adéquation du lexique à la thématique."),
        "e11": ("0.5 — Utilisation adéquate des signes de ponctuation.", "0.5 — Utilisation adéquate des signes de ponctuation ."),
        "e12": ("0.5 — Emploi correct des temps et des modes.", "0.5 — Emploi correct des temps et des modes."),
        "e13": ("0.5 — Orthographe (pas plus de 10 fautes pour un texte de150motsenviron).",
                "0.5 — Orthographe (pas plus de10 fautes pour un texte de150 mots environ)."),
    },
}
PE_GRID_NAMES = {1: ("Compte-rendu", "Production libre"), 2: ("Compte rendu objectif", "Production libre")}


def production(qid, first_sid, part, verbatim, sujets, docs):
    lines = PE_LINES[PAPER]
    s1name, s2name = PE_GRID_NAMES[PAPER]
    els = [el(f"{qid}-{suf}", label, pts) for suf, label, pts, _ in PE_GRID]
    q(qid, "—", part, verbatim, 7, els, docs)
    for k, (suf, label, pts, crit) in enumerate(PE_GRID):
        l1, l2 = lines[suf]
        essay(f"s{first_sid + k:02d}", qid, f"{qid}-{suf}", f"Production écrite (un sujet au choix) — critère : {crit}",
              {"task": "Production écrite — traitez un sujet au choix", "sujets": sujets, "criterion": crit, "indicator": label,
               "per_sujet": {f"Sujet 1 — grille « {s1name} »": l1, f"Sujet 2 — grille « {s2name} »": l2}},
              label, "La production écrite est corrigée avec la grille officielle du sujet choisi (organisation 2 pts, planification 2 pts, "
              "utilisation de la langue 3 pts).", pts, "fr.ecriture")


# ════════════════════════════════════ SUJET 1 ════════════════════════════════════
def build_p1():
    title = "Le Pen, député à Paris … Tortionnaire à Alger."
    text = "\n".join([
        "Durant les mois de février, mars et début avril 1957, la villa des \"Roses\" à El-Biar abrita une unité de parachutistes étrangers "
        "commandée par le capitaine Martin. Celle-ci y avait installé ses bureaux d’interrogatoires : les locaux de torture.",
        "L’un des chefs qui dirigeaient la torture n’était autre que le lieutenant Le Pen qui procédait aux enlèvements (…). Les personnes "
        "enlevées étaient séquestrées dans la villa durant des semaines. Le suspect était d’abord accueilli par les paras, Le Pen en tête, à "
        "coup de pied et de poing jusqu’à l’abrutissement complet. On commençait ainsi par le mettre en disposition de reconnaître sa "
        "participation à un attentat, sabotage ou action quelconque : s’il protestait de son innocence, on lui administrait alors le supplice "
        "des électrodes.",
        "Le Pen en assumait la direction : il déshabillait la victime, lui liait pieds et poings, l’aspergeait d’eau et lui bandait les yeux. "
        "C’est alors qu’il lui administrait plusieurs décharges électriques. Si le \"patient\" arrivait à supporter le choc et persistait dans "
        "ses dénégations¹, on lui plaçait sur la tête, pendant des heures, un casque relié par fil à une prise de courant. La douleur, "
        "absolument intolérable, faisait hurler ceux qui subissaient cette coiffure. Pour varier ces \" réjouissances \", Le Pen plaçait sur "
        "les oreilles de \"l’inculpé\" des électrodes, et les y laissait jusqu’à ce que chair fût complètement brulée.",
        "Puis l’on administrait à ceux, très rares, qui proclamaient encore à ce stade leur innocence, le supplice de l’eau, qu’on leur "
        "faisait ingurgiter² de force avec un tuyau. Ces tortures duraient des semaines, à raison de deux ou trois séances par jour. Dans "
        "l’intervalle des interrogatoires, les \"inculpés\" étaient jetés, les mains liées, dans une tranchée profonde. […]",
        "Tels furent en Algérie, les hauts faits d’armes du député Le Pen, qui lui valurent une décoration des mains du Général Massu.",
    ])
    source = "Résistance Algérienne,\nN°32, du 1er au 10 Juin 1957."
    gloss = "1- Actions de nier/ Actions de refuser.\n2- Boire."
    docs = [
        {"id": "d-title", "kind": "text", "caption": "Titre du texte", "text": title},
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
        {"id": "d-gloss", "kind": "text", "caption": "Mots expliqués", "text": gloss},
    ]
    P1 = "I- Compréhension de l’écrit : (13pts)"
    P2 = "II- Production écrite : (07pts)"
    QT = {
        1: "Ce texte relate des faits relatifs aux :\n-tortures infligées par les algériens à Le Pen.\n-tortures infligées par Le Pen aux "
           "algériens.\n-tortures infligées par Le Pen à ses hommes.\nRecopiez la bonne réponse.",
        2: "Répondez par vrai ou faux :\n-celui qui dirigeait les opérations de torture est le capitaine Martin.\n-celui qui dirigeait les "
           "opérations de torture est le \"patient\".\n-celui qui dirigeait les opérations de torture est le lieutenant Le Pen.\n-celui qui "
           "dirigeait les opérations de torture est le Général Massu.",
        3: "Les tortionnaires pratiquaient différents supplices. Repérez-en quatre. (Dans le texte).",
        4: "A qui ou à quoi renvoient les pronoms suivants:- Celle-ci / y / il.\n- \"Celle-ci y avait installé ses bureaux …\" Paragraphe 1.\n"
           "-Celle-ci renvoie à …\n-Y renvoie à …\n- \"…S’il protestait de son innocence… \" Paragraphe 2.\n-Il renvoie à …",
        5: "Classez les mots et expressions ci-dessous selon qu’ils renvoient aux :\n- déshabiller la victime / varier ces \"réjouissances\" / "
           "le suspect / bureaux d’interrogatoires / douleur impitoyable / personnes enlevées.\n"
           "-Tortionnaire : ….………………………………………………………………………………..\n-Prisonnier : ……………………………………………………………………………………..",
        6: "Complétez l’énoncé ci-dessous par les mots ou expressions proposés dans la liste suivante :\n-la révolution algérienne / une "
           "action / des accusés / ses interrogatoires / opérations de torture / Le Pen.\nDans …………dans la villa des \"Roses, ………..dirigeait, "
           "durant ……………., des …………. à l’encontre ………… algériens pour les obliger à admettre avoir participé à ………………... quelconque.",
        7: "L’auteur de ce texte :\n-témoigne de ce qu’il a subi.\n-décrit les lieux de son incarcération.\n-dénonce les actes de torture.\n"
           "Recopiez la bonne réponse",
        8: "Malgré la torture, dites, en deux à trois lignes, quels sont les secrets ayant permis à la révolution algérienne de sortir "
           "victorieuse de cette guerre.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "A l’occasion de la célébration de la fête de l’indépendance, rédigez le compte rendu objectif de ce texte qui sera publié dans la page « Histoire » du journal de votre lycée."},
        {"id": "Sujet 2", "kind": "production libre",
         "consigne": "Votre établissement scolaire décide d’organiser un concours du \"meilleur écrit\" sur l’un des héros de la révolution. Ces travaux seront publiés dans la rubrique \"Evènements historiques\" du journal de votre lycée.\n-Rédigez un texte, d’une douzaine de lignes, dans lequel vous présentez un héros et ses exploits."},
    ]
    PE = "Traitez un sujet au choix :\nSujet 1 : " + SUJETS[0]["consigne"] + "\nSujet 2 : " + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 1) ──
    q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "Faits relatés par le texte", 1.5)], docs)
    stm2 = [("capitaine Martin", "le capitaine Martin."), ("« patient »", "le \"patient\"."), ("lieutenant Le Pen", "le lieutenant Le Pen."),
            ("Général Massu", "le Général Massu.")]
    q("q2", "2", P1, QT[2], 2, [el(f"q2-e{k}", f"Affirmation {k} : {lab} (0,5)", 0.5) for k, (lab, _) in enumerate(stm2, 1)], docs)
    q("q3", "3", P1, QT[3], 2, [el("q3-e1", "Quatre supplices repérés dans le texte (0,5x4)", 2)], docs)
    q("q4", "4", P1, QT[4], 1.5, [el("q4-e1", "Référent de « Celle-ci » (§1) (0,5)", 0.5), el("q4-e2", "Référent de « y » (§1) (0,5)", 0.5),
                                  el("q4-e3", "Référent de « il » (§2) (0,5)", 0.5)], docs)
    items5 = [("déshabiller la victime", "Tortionnaire"), ("varier ces \"réjouissances\"", "Tortionnaire"), ("le suspect", "Prisonnier"),
              ("bureaux d’interrogatoires", "Tortionnaire"), ("douleur impitoyable", "Prisonnier"), ("personnes enlevées", "Prisonnier")]
    q("q5", "5", P1, QT[5], 1.5, [el(f"q5-e{k}", f"Classement de « {it} » (0,25)", 0.25) for k, (it, _) in enumerate(items5, 1)], docs)
    q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "Énoncé à compléter : six mots ou expressions à placer (0,25x6)", 1.5)], docs)
    q("q7", "7", P1, QT[7], 1, [el("q7-e1", "Intention de l’auteur", 1)], docs)
    # q8 elements are created with its deferred steps below
    # ── Steps ──
    st("s01", "q1", "q1-e1", "mcq", "Ce texte relate des faits relatifs aux : (choisissez la bonne réponse)",
       {"options": ["tortures infligées par Le Pen aux algériens.", "tortures infligées par les algériens à Le Pen.",
                    "tortures infligées par Le Pen à ses hommes."]}, {"correct": 0},
       "Corrigé : « b-tortures infligées par Le Pen aux Algériens. »", 1.5, "fr.comprehension")
    LEPEN = "« L’un des chefs qui dirigeaient la torture n’était autre que le lieutenant Le Pen » (§2) ; « Le Pen en assumait la direction » (§3)."
    expl2 = {
        "capitaine Martin": f"Corrigé : Faux. Le capitaine Martin commandait l’unité de parachutistes ; celui qui dirigeait la torture est le lieutenant Le Pen : {LEPEN}",
        "« patient »": f"Corrigé : faux. Le \"patient\" est la victime torturée (§3) ; celui qui dirigeait la torture est le lieutenant Le Pen : {LEPEN}",
        "lieutenant Le Pen": f"Corrigé : vrai. {LEPEN}",
        "Général Massu": f"Corrigé : faux. Le Général Massu a décoré le député Le Pen (dernier paragraphe) ; celui qui dirigeait la torture est le lieutenant Le Pen : {LEPEN}",
    }
    right2 = {"capitaine Martin": "Faux", "« patient »": "Faux", "lieutenant Le Pen": "Vrai", "Général Massu": "Faux"}
    for k, (lab, tail) in enumerate(stm2, 1):
        binary(f"s{1 + k:02d}", "q2", f"q2-e{k}", f"Vrai ou faux : « celui qui dirigeait les opérations de torture est {tail} »",
               VF, right2[lab], expl2[lab], 0.5, "fr.comprehension")
    SUPPL = ("Corrigé (quatre au choix) : séquestration / coups de pied et de poing / déshabiller (déshabillait) la victime / lier (liait) pieds "
             "et poings / bander (bandait) les yeux / décharges électriques / chair brûlée / le supplice de l’eau / jetés dans une tranchée "
             "profonde / douleur intolérable.")
    st("s06", "q3", "q3-e1", "multi", "Les tortionnaires pratiquaient différents supplices : sélectionnez les quatre supplices relevés dans le texte.",
       {"options": ["séquestration", "décharges électriques", "le supplice de l’eau", "bander (bandait) les yeux",
                    "la privation de nourriture", "la pendaison"]}, {"correct": [0, 1, 2, 3]}, SUPPL, 1, "fr.comprehension")
    st("s07", "q3", "q3-e1", "multi", "Sélectionnez quatre autres supplices relevés dans le texte.",
       {"options": ["coups de pied et de poing", "lier (liait) pieds et poings", "déshabiller (déshabillait) la victime",
                    "jetés dans une tranchée profonde", "les coups de fouet", "l’exil forcé"]}, {"correct": [0, 1, 2, 3]}, SUPPL, 1,
       "fr.comprehension", "b")
    essay("s08", "q4", "q4-e1", "« Celle-ci y avait installé ses bureaux … » (paragraphe 1) : à quoi renvoie « Celle-ci » ? (réponse rédigée)",
          {"task": "-Celle-ci renvoie à …", "context": "- \"Celle-ci y avait installé ses bureaux …\" Paragraphe 1.", "criterion": "Référent de « Celle-ci »",
           "indicator": "celle-ci : unité de parachutistes étrangers (Accepter : unité de parachutistes) §1",
           "model_answer": "unité de parachutistes étrangers", "accepted": ["unité de parachutistes"],
           "deferred_because": "le corrigé accepte une autre formulation (« Accepter : … »)"},
          "celle-ci : unité de parachutistes étrangers (Accepter : unité de parachutistes) §1",
          "Corrigé : « celle-ci : unité de parachutistes étrangers (Accepter : unité de parachutistes) §1 ».", 0.5, "fr.discours")
    st("s09", "q4", "q4-e2", "mcq", "« Celle-ci y avait installé ses bureaux … » (paragraphe 1) : à quoi renvoie « y » ?",
       {"options": ["la villa des roses", "l’unité de parachutistes étrangers", "les locaux de torture", "le capitaine Martin"]}, {"correct": 0},
       "Corrigé : « y : la villa des roses. §1 »", 0.5, "fr.discours")
    st("s10", "q4", "q4-e3", "mcq", "« …S’il protestait de son innocence… » (paragraphe 2) : à qui renvoie « il » ?",
       {"options": ["le suspect", "Le Pen", "le capitaine Martin", "le Général Massu"]}, {"correct": 0},
       "Corrigé : « il : le suspect. § 2 »", 0.5, "fr.discours")
    CLS = ("Corrigé — Tortionnaire : déshabiller la victime / réjouissances / bureaux d’interrogatoires ; "
           "Prisonnier : douleur impitoyable / personnes enlevées / le suspect.")
    for k, (it, right) in enumerate(items5, 1):
        binary(f"s{10 + k:02d}", "q5", f"q5-e{k}", f"Classez « {it} » : ce mot ou cette expression renvoie au…", TP, right, CLS, 0.25,
               "fr.vocabulaire")
    st("s17", "q6", "q6-e1", "fill_blank", "Complétez l’énoncé avec les mots ou expressions proposés.",
       {"text": "Dans ____ dans la villa des \"Roses, ____ dirigeait, durant ____, des ____ à l’encontre ____ algériens pour les obliger à "
                "admettre avoir participé à ____ quelconque.",
        "bank": ["ses interrogatoires", "Le Pen", "la révolution algérienne", "opérations de torture", "des accusés", "une action",
                 "le capitaine Martin", "le Général Massu"]},
       {"blanks": [["ses interrogatoires"], ["Le Pen"], ["la révolution algérienne"], ["opérations de torture"], ["des accusés"], ["une action"]]},
       "Corrigé : « Dans ses interrogatoires dans la villa des \"Roses, Le Pen dirigeait, durant la révolution algérienne des opérations de "
       "torture à l’encontre des accusés algériens pour les obliger à admettre avoir participé à une action quelconque » (0,25 par mot ou expression).",
       1.5, "fr.comprehension")
    st("s18", "q7", "q7-e1", "mcq", "L’auteur de ce texte : (choisissez la bonne réponse)",
       {"options": ["dénonce les actes de torture.", "témoigne de ce qu’il a subi.", "décrit les lieux de son incarcération."]}, {"correct": 0},
       "Corrigé : « L’auteur de ce texte : -dénonce les actes de torture. »", 1, "fr.enonciation")
    model8 = ("« Tout ce qui est pris par la force ne peut être restitué que par la force. Le peuple algérien a cru en sa cause juste. Il s’est "
              "montré déterminé à payer le prix fort pour sa liberté : par des sacrifices, la solidarité entre toutes les couches de la société, en "
              "plus de l’union entre le politique et le militaire. De plus, il tolérait plus, les supplices de la torture, la maltraitance et "
              "l’injustice. »")
    els8 = short_answer_criteria("q8", 19, QT[8], model8, "Accepter toute réponse en relation avec l’idée", "fr.ecriture", "Question 8")
    q("q8", "8", P1, QT[8], 2, els8, docs)
    production("q9", 23, P2, PE, SUJETS, docs)
    return ("بكالوريا 2019 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الأوّل («Le Pen, député à Paris … Tortionnaire à Alger.»)",
            ["س4: «celle-ci» مؤجَّل (essay_builder) لأنّ الحلّ يقول «Accepter : unité de parachutistes»؛ y وil تفاعليّان.",
             "س3: «0.5x4» على قائمة من عشرة عذابات مقبولة ⇒ عنصر واحد (2) بخطوتَي multi (1+1)، كلّ منهما أربعة عذابات من قائمة الحلّ ومشتّتان غير موجودين في النّصّ. "
             "الحلّ يكتب «chaire brûlée» فكُتب الشّرح «chair brûlée».",
             "س6: «0.25x6» على فراغات نصّ واحد ⇒ عنصر واحد (1.5) بخطوة fill_blank بستّة فراغات (التّنقيط بحصّة الفراغات = 0.25 للفراغ)؛ "
             "البنك = عبارات الورقة السّتّ + مشتّتان (le capitaine Martin، le Général Massu) خاطئان حسب الحلّ (س2).",
             "س8: «Réponse à titre indicatif… (Accepter toute réponse en relation avec l’idée)» + 0.5x4 ⇒ أربعة معايير مؤجَّلة.",
             "الإنتاج الكتابيّ: الحلّ يعطي شبكة «Compte-rendu» (0.5 تقديم + 0.25x4 + 0.50 بنية) وشبكة «Production libre» (0.25 تقديم + 0.25 عنوان "
             "+ 0.25x4 + 0.25x2 بنية): دُمج 0.25+0.25 في عنصر «présentation» (0.5) و0.25x2 في عنصر «structure» (0.5)، وتفاصيل كلّ شبكة في spec الخطوة."])


# ════════════════════════════════════ SUJET 2 ════════════════════════════════════
def build_p2():
    text = "\n".join([
        "Vu le rythme actuel imposé dans la plupart des entreprises d’aujourd’hui, il n’y a pas de place pour la sieste. Pourtant, de récentes "
        "études scientifiques ont démontré que cette dernière présente plusieurs bienfaits. […]",
        "Elle augmenterait la vigilance, améliore les capacités mentales et l’humeur et offre un meilleur sommeil durant la nuit. Rien ne vaut la "
        "sieste pour stimuler notre productivité au travail, ainsi que notre santé. Dans certains pays comme le Japon et la Chine, la sieste au "
        "travail est un droit qui fait partie de leur Constitution. […]",
        "La sieste au travail est d’une importance certaine puisqu’elle permet au travailleur d’être plus productif et lui apporte également un "
        "bien-être certain. Une bonne sieste au travail est bénéfique tant pour le travailleur que pour l’entreprise. Ceci, puisqu’elle améliore "
        "la mémoire, elle accroît la créativité, alimente la concentration, réduit la fatigue et le stress et améliore le dynamisme du "
        "travailleur. Tous ces bienfaits de la sieste ne sont que bénéfiques pour l’entreprise. Le travailleur est en mesure de rester concentré, "
        "il pourrait donc contribuer à l’amélioration de la productivité de l’entreprise. Cependant, pour ne pas perturber votre cycle de "
        "sommeil et pour garder la forme, limitez votre sieste à quelques minutes.",
        "La sieste de 20 minutes est l’idéal pour se ressourcer. Elle autorise le cerveau à se régénérer, à recharger les batteries, à récupérer "
        "le manque de sommeil et à évacuer les tensions. Pour qu’une sieste soit parfaite, installez-vous confortablement, soyez à l’aise, "
        "délassez ou enlevez vos chaussures et assurez-vous que personne ne viendra perturber cet instant de repos. Si possible, décrochez le "
        "téléphone, tamisez la lumière ou mettez un masque de sommeil. […]Selon Éric Mullens, médecin somnologue, la somnolence après le "
        "déjeuner est tout à fait naturelle. C’est, en effet, un besoin biologique contre lequel on ne devrait pas lutter.",
    ])
    source = "L’équipe Dynamique Entrepreneuriale.\nwww.dynamique-mag.com/article/sieste-travail.6071\nDu 01 / 06 / 2017"
    docs = [
        {"id": "d-text", "kind": "text", "caption": "Texte", "text": text},
        {"id": "d-source", "kind": "text", "caption": "Source du texte", "text": source},
    ]
    P1 = "I) Compréhension de l’écrit : (13pts)"
    P2 = "II- Production écrite : (07pts)"
    QT = {
        1: "Parmi les propositions suivantes ; relevez les deux (02) qui renvoient au thème du texte :\n- Le manque de la sieste au travail.\n"
           "- Les bienfaits de la sieste au travail.\n- La lutte contre la sieste au travail.\n- L’importance de la sieste au travail.",
        2: "Identifiez dans le quatrième paragraphe deux (02) mots et deux (02) expressions qui renvoient à \"sieste\".",
        3: "Avoir un bien être certain / être à l’aise / limiter la sieste à 20 minutes / réduire la fatigue et le stress / ne pas être perturbé / "
           "être productif.\nClassez les expressions ci-dessus selon qu’elles précisent l’idée :\n- D’une sieste parfaite : …………, ………….. , ………….\n"
           "- Des bienfaits de la sieste : …………, ………….. , ………….",
        4: "Répondez par vrai ou faux :\n- La sieste aide à évacuer les tensions.\n- La sieste réduit la concentration du travailleur.\n"
           "- La sieste ne doit pas être prolongée.\n- La sieste n’est pas un besoin naturel.",
        5: "A qui ou à quoi renvoient les mots suivants : cette dernière / lui.\n-\"…cette dernière présente plusieurs bienfaits.\" 1er paragraphe\n"
           "- cette dernière renvoie à …………\n- \"… lui apporte également un bien-être certain \" 3ème paragraphe\n- lui renvoie à ………..",
        6: "\"La sieste au travail est d’une importance certaine puisqu’elle permet au travailleur d’être plus productif et lui apporte également un "
           "bien-être certain \". Trouvez dans le deuxième paragraphe la phrase qui reprend la même idée.",
        7: "\" Cette dernière présente plusieurs bienfaits. .\" Réécrivez cette phrase en la commençant ainsi :\n\"Plusieurs bienfaits ……………………………………..\"",
        8: "\" Selon Éric Mullens, médecin somnologue, la somnolence après le déjeuner est tout à fait naturelle. \" En deux à trois lignes "
           "expliquez ce que l’auteur veut dire par cette phrase.",
    }
    SUJETS = [
        {"id": "Sujet 1", "kind": "compte rendu objectif",
         "consigne": "Rédigez en une centaine de mots le compte rendu objectif de ce texte qui sera publié dans le journal de votre lycée."},
        {"id": "Sujet 2", "kind": "production libre (texte argumentatif)",
         "consigne": "La marche à pied est un sport complet qui contribue au bien-être de l’homme. Rédigez un texte argumentatif d’une douzaine de lignes, dans lequel vous présentez à vos camarades les bienfaits de ce sport."},
    ]
    PE = "Traitez un sujet au choix :\nSujet 1 : " + SUJETS[0]["consigne"] + "\nSujet 2 : " + SUJETS[1]["consigne"]

    # ── Questions and rubric elements (marks: corrigé p. 3) ──
    q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "Deux propositions renvoyant au thème du texte (0,75x2)", 1.5)], docs)
    q("q2", "2", P1, QT[2], 2, [el("q2-e1", "Deux mots renvoyant à « sieste » (0,5x2)", 1), el("q2-e2", "Deux expressions renvoyant à « sieste » (0,5x2)", 1)], docs)
    items3 = [("Avoir un bien être certain", SP[1]), ("être à l’aise", SP[0]), ("limiter la sieste à 20 minutes", SP[0]),
              ("réduire la fatigue et le stress", SP[1]), ("ne pas être perturbé", SP[0]), ("être productif", SP[1])]
    q("q3", "3", P1, QT[3], 1.5, [el(f"q3-e{k}", f"Classement de « {it} » (0,25)", 0.25) for k, (it, _) in enumerate(items3, 1)], docs)
    stm4 = [("La sieste aide à évacuer les tensions.", "Vrai", "« Elle autorise le cerveau […] à évacuer les tensions » (§4)."),
            ("La sieste réduit la concentration du travailleur.", "Faux", "Au contraire, elle « alimente la concentration » et le travailleur « est en mesure de rester concentré » (§3)."),
            ("La sieste ne doit pas être prolongée.", "Vrai", "« limitez votre sieste à quelques minutes » (§3) ; « La sieste de 20 minutes est l’idéal » (§4)."),
            ("La sieste n’est pas un besoin naturel.", "Faux", "« la somnolence après le déjeuner est tout à fait naturelle. C’est, en effet, un besoin biologique » (§4).")]
    q("q4", "4", P1, QT[4], 2, [el(f"q4-e{k}", f"Affirmation {k} (0,5)", 0.5) for k in range(1, 5)], docs)
    q("q5", "5", P1, QT[5], 1, [el("q5-e1", "Référent de « cette dernière » (1er paragraphe) (0,5)", 0.5),
                                el("q5-e2", "Référent de « lui » (3ème paragraphe) (0,5)", 0.5)], docs)
    q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "Phrase du deuxième paragraphe qui reprend la même idée", 1.5)], docs)
    q("q7", "7", P1, QT[7], 1.5, [el("q7-e1", "Transformation : auxiliaire (0,5)", 0.5), el("q7-e2", "Transformation : participe passé (0,5)", 0.5),
                                  el("q7-e3", "Transformation : complément d’agent (0,5)", 0.5)], docs)
    # ── Steps ──
    essay("s01", "q1", "q1-e1", "Parmi les quatre propositions, relevez les deux qui renvoient au thème du texte (réponse corrigée selon le barème)",
          {"task": QT[1], "criterion": "Deux propositions renvoyant au thème (0,75 chacune)",
           "indicator": "Les deux bonnes réponses sont : - Les bienfaits de la sieste au travail. - L’importance de la sieste au travail.",
           "model_answer": "Les bienfaits de la sieste au travail. / L’importance de la sieste au travail.",
           "accepted": ["Le manque de sieste au travail."], "barème": "1.5 = 0.75x2",
           "deferred_because": "le corrigé accepte une troisième proposition (« Accepter : - Le manque de sieste au travail. »), un QCM marquerait faux une réponse acceptée"},
          "Les deux bonnes réponses sont : - Les bienfaits de la sieste au travail. - L’importance de la sieste au travail. Accepter : - Le manque de sieste au travail.",
          "Corrigé : « Les bienfaits de la sieste au travail. » et « L’importance de la sieste au travail. » (0,75 chacune). Accepter : « Le manque de sieste au travail. »",
          1.5, "fr.comprehension")
    st("s02", "q2", "q2-e1", "multi", "Dans le quatrième paragraphe, sélectionnez deux mots qui renvoient à « sieste ».",
       {"options": ["sommeil", "somnolence", "téléphone", "chaussures", "lumière"]}, {"correct": [0, 1]},
       "Corrigé — mots qui renvoient à \"sieste\" : sommeil, somnologue, somnolence, repos, récupérer.", 1, "fr.vocabulaire")
    st("s03", "q2", "q2-e2", "multi", "Dans le quatrième paragraphe, sélectionnez deux expressions qui renvoient à « sieste ».",
       {"options": ["instant de repos", "recharger les batteries", "le rythme actuel", "la plupart des entreprises"]}, {"correct": [0, 1]},
       "Corrigé — expressions qui renvoient à \"sieste\" : instant de repos, besoin biologique, évacuer les tensions, recharger les batteries, "
       "régénérer le cerveau.", 1, "fr.vocabulaire")
    CLS = ("Corrigé — Une sieste parfaite : être à l’aise / limiter la sieste à 20 mns / ne pas être perturbé ; Bienfaits de la sieste : avoir un "
           "bien être certain / réduire la fatigue et le stress / être productif.")
    for k, (it, right) in enumerate(items3, 1):
        binary(f"s{3 + k:02d}", "q3", f"q3-e{k}", f"Classez « {it} » : cette expression précise l’idée…", SP, right, CLS, 0.25, "fr.comprehension")
    for k, (stmt, right, why) in enumerate(stm4, 1):
        binary(f"s{9 + k:02d}", "q4", f"q4-e{k}", f"Vrai ou faux : « {stmt} »", VF, right, f"Corrigé : {right}. {why}", 0.5, "fr.comprehension")
    st("s14", "q5", "q5-e1", "mcq", "« …cette dernière présente plusieurs bienfaits. » (1er paragraphe) : à quoi renvoie « cette dernière » ?",
       {"options": ["la sieste", "de récentes études scientifiques", "la plupart des entreprises", "la place"]}, {"correct": 0},
       "Corrigé : « cette dernière renvoie à : la sieste »", 0.5, "fr.discours")
    st("s15", "q5", "q5-e2", "mcq", "« … lui apporte également un bien-être certain » (3ème paragraphe) : à qui renvoie « lui » ?",
       {"options": ["le travailleur", "la sieste", "l’entreprise", "le bien-être"]}, {"correct": 0},
       "Corrigé : « lui renvoie à : le travailleur »", 0.5, "fr.discours")
    essay("s16", "q6", "q6-e1", "Recopiez la phrase du deuxième paragraphe qui reprend la même idée (réponse corrigée selon le barème)",
          {"task": QT[6], "criterion": "Phrase du deuxième paragraphe qui reprend la même idée",
           "indicator": "La phrase qui reprend la même idée est : \" Rien ne vaut la sieste pour stimuler notre productivité au travail, ainsi que notre santé.\"",
           "model_answer": "\" Rien ne vaut la sieste pour stimuler notre productivité au travail, ainsi que notre santé.\"",
           "accepted": ["« Elle augmenterait la vigilance, améliore les capacités mentales et l’humeur et offre un meilleur sommeil durant la nuit. »"],
           "barème": "1.5",
           "deferred_because": "le corrigé accepte une deuxième phrase du même paragraphe (« Accepter : … »), un QCM marquerait faux une réponse acceptée"},
          "\" Rien ne vaut la sieste pour stimuler notre productivité au travail, ainsi que notre santé.\" Accepter : « Elle augmenterait la vigilance, améliore les capacités mentales et l’humeur et offre un meilleur sommeil durant la nuit. »",
          "Corrigé : « Rien ne vaut la sieste pour stimuler notre productivité au travail, ainsi que notre santé. » Accepter : « Elle augmenterait "
          "la vigilance, améliore les capacités mentales et l’humeur et offre un meilleur sommeil durant la nuit. »", 1.5, "fr.comprehension")
    PASS = "Corrigé : « Plusieurs bienfaits sont présentés par cette dernière. » (0,5 pour « sont », 0,5 pour « présentés », 0,5 pour « par cette dernière »)."
    LEAD = "À la voix passive, « Cette dernière présente plusieurs bienfaits. » devient une phrase commençant par « Plusieurs bienfaits… »."
    st("s17", "q7", "q7-e1", "mcq", f"{LEAD} Quel auxiliaire faut-il employer ?",
       {"options": ["sont", "ont", "est", "seront"]}, {"correct": 0}, PASS, 0.5, "fr.grammaire")
    st("s18", "q7", "q7-e2", "mcq", f"{LEAD} Quelle est la forme correcte du participe passé de « présenter » ?",
       {"options": ["présentés", "présenté", "présentées", "présentée"]}, {"correct": 0}, PASS, 0.5, "fr.grammaire")
    st("s19", "q7", "q7-e3", "mcq", f"{LEAD} Comment le sujet « cette dernière » devient-il complément d’agent ?",
       {"options": ["par cette dernière", "pour cette dernière", "à cette dernière", "avec cette dernière"]}, {"correct": 0}, PASS, 0.5, "fr.grammaire")
    model8 = ("\"Selon l’auteur, la sieste répond à une exigence de l’organisme au moment de la digestion. C’est un moment de détente et de repos "
              "qui nous permet de récupérer, d’être productif .Donc chacun de nous doit se procurer ce moment.\"")
    els8 = short_answer_criteria("q8", 20, QT[8], model8, "accepter toute réflexion en relation avec l’idée", "fr.comprehension", "Question 8")
    q("q8", "8", P1, QT[8], 2, els8, docs)
    production("q9", 24, P2, PE, SUJETS, docs)
    return ("بكالوريا 2019 (الدورة العاديّة) – اللغة الفرنسية – شعبة آداب وفلسفة – الموضوع الثّاني (نصّ عن القيلولة في العمل، Dynamique Entrepreneuriale)",
            ["س1 مؤجَّل كاملًا (1.5): الحلّ يقبل «Le manque de sieste au travail» بديلًا، فكلّ QCM بخيارات الورقة الأربعة يخطّئ إجابة مقبولة.",
             "س2 «0.5x4» ⇒ عنصران (كلمتان 1 / عبارتان 1)، كلّ منهما multi باختيارين صحيحين من قائمة الحلّ؛ مشتّتات الكلمات من الفقرة 4 لا تدلّ على "
             "القيلولة (téléphone، chaussures، lumière)، ومشتّتات العبارات من الفقرة 1 (le rythme actuel، la plupart des entreprises).",
             "س6 مؤجَّل (1.5): الحلّ يقبل جملة ثانية من الفقرة الثّانية («Accepter : Elle augmenterait…»).",
             "س7 «0.5x3» (تحت sont / présentés / par cette dernière) ⇒ ثلاثة عناصر، QCM لكلّ جزء (صيغة الحلّ + ثلاث صيغ خاطئة).",
             "س8: «Réponse à titre indicatif… (accepter toute réflexion en relation avec l’idée)» + 0.5x4 ⇒ أربعة معايير مؤجَّلة.",
             "الإنتاج الكتابيّ: شبكة «Production libre» تضع 0.25 أمام «Présentation du texte…» و0.25 أمام «Cohérence du texte.» (بلا سطر «titre et sous "
             "titres»)، وشبكة «Compte rendu objectif» 0.25 تقديم + 0.25 عنوان؛ دُمجا في عنصر «présentation» (0.5) — قراءة تحتاج تأكيد صاحب المنصّة."])


TITLE, PAPER_NOTES = build_p1() if PAPER == 1 else build_p2()

COMMON_NOTES = [
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word).",
    f"الموضوع: gdrive:{PAPER_ID} ({PAPER_TITLE}) ص{'1–2' if PAPER == 1 else '3–4'}؛ الحلّ وسلّم التّنقيط الرّسميّان: gdrive:{CORR_ID} ({CORR_TITLE}) "
    f"ص{'1–2' if PAPER == 1 else '3–4'}. الملفّان PDF رقميّان من الدّيوان الوطنيّ للامتحانات (لا مسح ضوئيّ) بطبقة نصّ هي نفسها ما يُرجعه read_file_content؛ "
    "استُعملت مساعدًا فقط، وقوبل كلّ نصّ بصورة الصّفحة (150 نقطة، وتكبير 220–300 نقطة).",
    "الشّعبة من رأس الورقة «الشعبة: آداب وفلسفة» ⇒ LIT. «الدورة العادية» من اسم الملفّ في Drive (الورقة تطبع «دورة: 2019» فقط). "
    "الورقة لا تطبع علامة كلّ سؤال (13 + 7 فقط)؛ كلّ العلامات من عمودَي «مجزأة/مجموع» في الحلّ الرّسميّ.",
    "خلافات طبقة النّصّ/تصدير Drive مع الصّورة (الصّورة هي المرجع): رأس عربيّ معكوس، المدّة «03 د» في الطّبقة و«30 د» في الصّورة، "
    "تذييل الصّفحة 3 «صفحة 0 من 4» في الطّبقة؛ إحالتا الهامش «dénégations1/ingurgiter2» مرفوعتان في الصّورة فكُتبتا ¹ و²؛ «1er/3ème» مرفوعة كُتبت عاديّة؛ "
    "استخراج الحروف يقطع بعض الكلمات («interr ogato ires»، «incu lpés») والصّورة سليمة. المسافات المزدوجة المكتوبة في الأصل (غير مرئيّة "
    "في الطّباعة، وتصدير Drive بمسافة واحدة) كُتبت مسافة واحدة. حُفظ كما طُبع: «brulée»، «des \"Roses,» بلا علامة إغلاق، «Evènements»، "
    "«suivants:-»، «Recopiez la bonne réponse» بلا نقطة في س7، «[…]Selon»، «bienfaits. .».",
    "قرارات عامّة: «n×m» لعناصر متمايزة ⇒ عنصر لكلّ بند، ولاختيارات متبادلة من قائمة ⇒ عنصر واحد. خيارا «Vrai/Faux» والتّصنيف الثّنائيّ يُخزَّنان "
    "معكوسين لأنّ shuffle_exam_set.py يقلب دائمًا قائمة من خيارين، فيظهران بترتيب الورقة ولا يكشف الموضع الجواب. قاعدة «accepter… / toute réponse…» ⇒ "
    "essay_builder مؤجَّل. الإنتاج الكتابيّ «sujet au choix» = سؤال أصليّ واحد (7) بـ13 عنصرًا مشتركًا بين الشّبكتين، وتفاصيل شبكة كلّ موضوع في spec. "
    "المشتّتات من إعداد التّحويل وتحتاج مراجعة.",
]
NOTES = " ".join(COMMON_NOTES + PAPER_NOTES)
LOG_NOTE = ("تحويل تجريبيّ للفرنسيّة من ورقة البكالوريا الرّسميّة وحلّها (PDF رقميّان في Drive، قوبلا بصور الصّفحات)؛ العلامات من سلّم التّنقيط الرّسميّ؛ "
            "الإجابات الصّحيحة من الحلّ؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

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
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        label = _norm(els[s["rubric_element_id"]]["label"])
        if t == "mcq":
            if len(p["options"]) == 2:
                assert any(p["options"] == [pair[1], pair[0]] for pair in BINARY), (s["id"], "2-option mcq must be a stored-reversed BINARY pair")
            else:
                assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
            assert _norm(p["options"][a["correct"]]) not in label, (s["id"], "answer in rubric label")
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
            assert a["correct"] == list(range(len(a["correct"]))), (s["id"], "multi: right options first before shuffling")
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(bank) > len(a["blanks"]), (s["id"], "no distractor in bank")
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
    assert abs(sum(qq["rubric_total"] for qq in Q if qq["id"] != "q9") - 13) < 1e-9, "Compréhension de l’écrit must total 13"
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
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "FR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T10:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
_deferred = sum(s["points"] for s in S if s["type"] == "essay_builder")
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
      sum(s["points"] for s in S), "points (interactive", sum(s["points"] for s in S) - _deferred, "+ deferred", _deferred, ")")
