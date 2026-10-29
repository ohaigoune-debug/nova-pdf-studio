"""PILOT physics conversion: BAC 2019 (الدورة العادية) – العلوم الفيزيائية – شعبة علوم تجريبية – الموضوعان الأول والثاني.

Usage (one topic per run, rebuild + shuffle from scratch each time):
  python3 scripts/play/converters/build_phys_bac_2019_sci.py content/play-exams/sets/3AS/PHYS/phys-bac-2019-sci-p1.json [1]
  python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/PHYS/phys-bac-2019-sci-p1.json
The paper number is the optional 2nd argument, else read from "-p1"/"-p2" in the output file name.

Sources (owner's Drive, ONEC PDFs; same folder):
  paper      gdrive 1E_e2y8mJZ47xddeV1Ao1cyYxDtUTD2il «2019 - العلوم الفيزيائية - علوم تجريبية - الدورة العادية - الموضوع.pdf» (8 pages:
             topic 1 = pages 1–4, topic 2 = pages 5–8). It has a text layer, but that layer is NOT usable: digits are wrong
             («40» for 04, «72» for 27, «0» for 4), words are split and diacritics dropped; Drive OCR scrambles formulas.
  correction gdrive 1uD7k9EUqMWaVnTO4R65CJFywOzKtQaZj «… - الحل.pdf» (9 pages: «الإجابة النموذجية» with the official barème,
             columns «مجزأة / مجموع», red mark annotations; topic 1 = pages 1–4, topic 2 = pages 5–9).
Both PDFs were rendered with `pdftoppm -r 200` and every verbatim string, formula, value and mark below was transcribed from the
page images (line crops enlarged ×1.3–3) and checked twice against them.

Conventions decided for this pilot (see also NOTES):
- Formulas in LaTeX between $…$, letters/indices/signs as printed; decimal comma written `{,}` inside math so KaTeX does not add a
  space (prints «0,4»). Units stay in math italics as on the paper (`mol\\cdot L^{-1}`, `jours`). The «◄» list bullets of the
  «المعطيات» blocks are Wingdings arrows on the paper; written «◄». Answer boxes «☐» and dotted leaders are kept in Q5 (topic 2).
- verbatim_text = the sub-question's own text (no printed number; the number is in `number`). Exercise introductions, «المعطيات»
  and numbered stems (e.g. «2. نربط مكثفة…», «4.1. باستغلال البيان…») are verbatim text documents attached to the questions they
  govern, followed by the cropped figures they use. Decorative photos (lightning, sand skier, Galileo portrait) are not reproduced.
- One rubric element per mark line of the barème; «n×0.25» on one line = one element when its items are interchangeable
  (list of forces, factors), otherwise one element per item. Steps of an element share its mark.
- Numeric answers: unit in `unit` (plain text, shown beside the input). Tolerances: computed values = one unit of the last digit
  printed in the correction, capped at 5 % of the value, and always ≥ |exact − printed| (asserted below via `exact`); direct graph
  readings = one minor grid division of the printed figure; values from a slope/tangent or from figure distances = the effect of
  about one minor division (stated per step in TOLERANCES).
- «بيّن أنّ / أثبت»: one step per mark line on the intermediate expression the correction writes; a final line that only restates
  the given result is trained as «which operation/what conclusion leads to it», never by asking the given result back.
- Drawings with no wording in the correction (circuit schematic 1.1, curve v=f(t) 3.1) are deferred (`bar_chart` for the schematic,
  `function_plot` for the curve); force/vector drawings whose content the correction states in words (forces P, R, f; origin and
  support of v_E) are trained as MCQ on that content. Tables of progress (جدول التقدّم) are deferred `table_fill`. Open lists
  («ذكر قاعدتين على الأقل … -…») are deferred `essay_builder`.
- True/false items (topic 2, Ex.2 Q5): two options built as [خاطئة, صحيحة] so that the deterministic shuffle (which always swaps two
  options) shows «صحيحة» first in every item.
"""
import hashlib, json, math, pathlib, re, sys, unicodedata

ARGS = [a for a in sys.argv[1:]]
OUT = next(a for a in ARGS if a.endswith(".json"))
_p = next((a for a in ARGS if a in ("1", "2")), None)
PAPER = int(_p) if _p else int(re.search(r"-p([12])\.json$", OUT).group(1))
SET_ID = f"phys-bac-2019-sci-p{PAPER}"
ROOT = pathlib.Path(__file__).resolve().parents[3]

PAPER_ID = "1E_e2y8mJZ47xddeV1Ao1cyYxDtUTD2il"
PAPER_TITLE = "2019 - العلوم الفيزيائية - علوم تجريبية - الدورة العادية - الموضوع.pdf"
CORR_ID = "1uD7k9EUqMWaVnTO4R65CJFywOzKtQaZj"
CORR_TITLE = "2019 - العلوم الفيزيائية - علوم تجريبية - الدورة العادية - الحل.pdf"
PAPER_URL = f"https://drive.google.com/file/d/{PAPER_ID}/view"
STREAMS = ["SCI"]  # header: «الشعبة: علوم تجريبية»
VERIFIED_AT = "2026-10-29T10:15:00Z"  # UTC; crops read back and checked against the page images

# ───────────────────────────── helpers ─────────────────────────────
Q, S = [], []
_variant = {}


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs,
              "rubric_total": total, "rubric_elements": elements})


def _sid():
    return f"s{len(S) + 1:02d}"


def _var(eid):
    n = _variant.get(eid, 0)
    _variant[eid] = n + 1
    return "abcdefgh"[n]


def _step(eid, typ, prompt, payload, answer, expl, pts, skill, review="needs_human_review", meta=None):
    qid = eid.rsplit("-", 1)[0]
    s = {"id": _sid(), "source_question_id": qid, "rubric_element_id": eid, "variant": _var(eid), "type": typ, "prompt": prompt,
         "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
         "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": review}
    S.append(s)
    if meta:
        _META[s["id"]] = meta
    return s


_META = {}


def mcq(eid, prompt, options, expl, pts, skill):
    """options[0] is the correct answer (from the correction); the shuffle script reorders."""
    _step(eid, "mcq", prompt, {"options": options}, {"correct": 0}, expl, pts, skill)


def tf(eid, statement, true, expl, pts, skill):
    """True/false item: options built [خاطئة, صحيحة] (see docstring)."""
    _step(eid, "mcq", f"ضع (✓) أو (×): «{statement}»", {"options": ["خاطئة (×)", "صحيحة (✓)"]}, {"correct": 1 if true else 0},
          expl, pts, skill, meta={"tf": True})


def multi(eid, prompt, options, n_correct, expl, pts, skill):
    """the first n_correct options are the correct ones."""
    _step(eid, "multi", prompt, {"options": options}, {"correct": list(range(n_correct))}, expl, pts, skill)


def num(eid, prompt, value, tol, unit, expl, pts, skill, exact=None):
    _step(eid, "numeric", prompt, {"unit": unit}, {"value": value, "tolerance": tol, "unit": unit}, expl, pts, skill,
          meta={"exact": exact})


def deferred(eid, typ, prompt, spec, answer_spec, expl, pts, skill):
    _step(eid, typ, prompt, {"spec": spec}, {"spec": answer_spec}, expl, pts, skill, review="needs_engine_support")


def text_doc(i, caption, text):
    return {"id": i, "kind": "text", "caption": caption, "text": text}


def fig(i, kind, caption, name, depicts, alt):
    path = ROOT / "public" / "play-exams" / "figures" / SET_ID / f"{name}.png"
    assert path.exists(), f"missing crop {path} — run scripts/play/crop_figure.py (see FIGURE_CROPS)"
    data = path.read_bytes()
    w = int.from_bytes(data[16:20], "big")
    h = int.from_bytes(data[20:24], "big")
    return {"id": i, "kind": kind, "caption": caption,
            "media": {"local_path": f"/play-exams/figures/{SET_ID}/{name}.png", "source_url": PAPER_URL,
                      "attribution": "الديوان الوطني للامتحانات والمسابقات — ورقة الموضوع الرسمية",
                      "license": "وثيقة امتحان رسمية منشورة — نسخة مطابقة للاستعمال التعليمي",
                      "image_verified_at": VERIFIED_AT, "sha256": hashlib.sha256(data).hexdigest(),
                      "width": w, "height": h, "depicts": depicts, "alt": alt}}


# Crop boxes (fractions of the 200-dpi page render) used with scripts/play/crop_figure.py — documents the provenance of each PNG.
FIGURE_CROPS = {
    1: {"fig1": ("p-1", 0.065, 0.515, 0.505, 0.668), "fig2": ("p-1", 0.055, 0.675, 0.43, 0.928), "fig3": ("p-2", 0.065, 0.238, 0.335, 0.48),
        "fig4": ("p-2", 0.085, 0.570, 0.535, 0.623), "fig5": ("p-2", 0.065, 0.692, 0.37, 0.908), "fig6": ("p-3", 0.055, 0.31, 0.39, 0.575),
        "fig7": ("p-3", 0.085, 0.829, 0.46, 0.958), "fig8": ("p-4", 0.245, 0.228, 0.79, 0.322)},
    2: {"fig1": ("p-5", 0.065, 0.512, 0.48, 0.80), "fig2": ("p-6", 0.065, 0.362, 0.424, 0.597), "fig3": ("p-7", 0.065, 0.672, 0.435, 0.937),
        "fig4": ("p-8", 0.06, 0.298, 0.462, 0.572)},
}

MCH, ELEC, CHEM, KIN, NUC, WAV = "phys.mechanics", "phys.electricity", "phys.chemistry", "phys.kinetics", "phys.nuclear", "phys.waves"
DATA = "المعطيات:"


# ═════════════════════════════ TOPIC 1 ═════════════════════════════
def topic1():
    P_EX1 = "التمرين الأول: (06 نقاط)"
    P_EX2 = "التمرين الثاني: (07 نقاط)"
    P_X1 = "التمرين التجريبي: (07 نقاط) — 1. المرحلة الأولى (المسار AB)"
    P_X2 = "التمرين التجريبي: (07 نقاط) — 2. المرحلة الثانية (المسار BC)"

    # ── التمرين الأول ──
    D1 = text_doc("d-ex1-intro", "تقديم التمرين الأول",
                  "هل تعلم؟ في 27 أكتوبر 1998، قتلت الصاعقة فريق كرة قدم بأكمله في جمهورية الكونغو الديمقراطية.\n"
                  "أثناء العاصفة الرعدية، تُسبب التيارات العنيفة في السحاب تصادمات بين جزيئات الماء، ظهور شحنات موجبة وشحنات سالبة. "
                  "الشحنتان متعاكستان ومنفصلتان: قاعدة السحابة مشحونة سلبًا والجزء العلوي إيجاباً. في نفس الوقت تكون التربة مشحونة "
                  "إيجاباً كما بالشكل 1 المنمذج للصورة المقابلة.\n"
                  "وبالتالي، فإنها تشكل مكثفة مشحونة، أحد لبوسيها هو الأرض (اللبوس $A$ الموجب) والآخر قاعدة السحابة (اللبوس $B$ السالب)، "
                  "سعتها $C$، التوتر الكهربائي بين طرفي المكثفة هو $U_{AB}=E=10^8\\,V$.\n"
                  "يهدف هذا التمرين إلى حساب المقاومة الكهربائية للهواء وذاتية وشيعة.")
    F1 = fig("f-ex1-1", "image", "الشكل 1", "fig1", "الشكل 1 من ورقة الموضوع: رسم تخطيطي للسحابة (لبوس B) والأرض (لبوس A) وعليهما الشحنات",
             "الشكل 1: رسم تخطيطي للسحابة والأرض")
    D1S1 = text_doc("d-ex1-s1", "نصّ السؤال 1",
                    "البرق ظاهرة كهربائية طبيعية تحدث نتيجة تفريغ كهربائي في الهواء الرطب ما بين الأرض وسحابة. "
                    "نعتبر الهواء الرطب ناقلا أوميا مقاومته $R$.\nتتطور شدة التيار الكهربائي أثناء التفريغ وفق المنحنى البياني الشكل 2.")
    F2 = fig("f-ex1-2", "graph", "الشكل 2", "fig2", "الشكل 2 من ورقة الموضوع: منحنى شدة التيار i (بوحدة 10³ A) بدلالة الزمن t (بوحدة 10⁻⁵ s)",
             "الشكل 2: منحنى i بدلالة t")
    D1S41 = text_doc("d-ex1-s41", "نصّ السؤال 4.1", "باستغلال البيان (الشكل 2):")
    D1S2 = text_doc("d-ex1-s2", "نصّ السؤال 2",
                    "نربط مكثفة مشحونة سعتها $C=10^{-2}\\,\\mu F$ مع وشيعة ذاتيتها $L$ ومقاومتها $r$. بواسطة التجريب المدعم بالحاسوب "
                    "$(ExAO)$ تم الحصول على منحنى تطور التوتر الكهربائي بين طرفي المكثفة $u_C(t)$ الشكل 3.")
    F3 = fig("f-ex1-3", "graph", "الشكل 3", "fig3", "الشكل 3 من ورقة الموضوع: منحنى التوتر u_C (V) بدلالة الزمن t (ms)", "الشكل 3: منحنى u_C بدلالة t")
    E1A = [D1, F1, D1S1, F2]
    q("q1", "1.1", P_EX1, "ارسم شكلا تخطيطيا لدارة التفريغ الكهربائية المنمذجة للظاهرة الموصوفة بالشكل 1.", 0.75,
      [el("q1-e1", "تمثيل سهم توتر المكثفة", 0.25), el("q1-e2", "تمثيل سهم توتر الناقل الأومي", 0.25), el("q1-e3", "جهة التيار مع الإشارة i<0", 0.25)], E1A)
    q("q2", "2.1", P_EX1, "بتطبيق قانون جمع التوترات الكهربائية، أسس المعادلة التفاضلية لتطور شدة التيار $i(t)$.", 1,
      [el("q2-e1", "قانون جمع التوترات", 0.25), el("q2-e2", "التعويض بعبارتي التوترين", 0.25), el("q2-e3", "الاشتقاق بالنسبة للزمن", 0.25),
       el("q2-e4", "المعادلة التفاضلية", 0.25)], E1A)
    q("q3", "3.1", P_EX1, "بيّن أن: $i(t)=-I_0\\cdot e^{-\\frac{t}{RC}}$ حلا للمعادلة التفاضلية السابقة.", 1,
      [el("q3-e1", "مشتقة i(t) بالنسبة للزمن", 0.25), el("q3-e2", "التعويض في المعادلة التفاضلية (2×0.25)", 0.5), el("q3-e3", "الاستنتاج", 0.25)], E1A)
    q("q4", "1.4.1", P_EX1, "استخرج قيمة كل من شدة التيار الكهربائي العظمى $I_0$ وثابت الزمن $\\tau$ لثنائي القطب $R,C$.", 0.75,
      [el("q4-e1", "قيمة I0", 0.25), el("q4-e2", "قيمة i عند t=τ", 0.25), el("q4-e3", "قيمة ثابت الزمن τ", 0.25)], E1A + [D1S41])
    q("q5", "2.4.1", P_EX1, "احسب قيمة $R$ واستنتج قيمة سعة المكثفة $C$.", 1,
      [el("q5-e1", "عبارة R", 0.25), el("q5-e2", "قيمة R", 0.25), el("q5-e3", "عبارة C", 0.25), el("q5-e4", "قيمة C", 0.25)], E1A + [D1S41])
    q("q6", "5.1", P_EX1, "المثلان القائلان «عندما يهدر الرعد، اذهب إلى الداخل» و«إذا كان هناك برق بالقرب من موقعك، فأنت لست آمنا بالخارج». "
      "على ضوء هذا أعط بعض قواعد الحماية من الصاعقة.", 0.5, [el("q6-e1", "قاعدتان للحماية على الأقل", 0.5)], [D1])
    q("q7", "1.2", P_EX1, "حدّد نمط الاهتزاز واستنتج قيمة شبه الدور $T$.", 0.5,
      [el("q7-e1", "نمط الاهتزاز", 0.25), el("q7-e2", "قيمة شبه الدور T", 0.25)], [D1, D1S2, F3])
    q("q8", "2.2", P_EX1, "جِد قيمة ذاتية الوشيعة $L$ باعتبار $T\\approx T_0$ حيث: $T_0$ الدور الذاتي للدارة المثالية $L,C$.", 0.5,
      [el("q8-e1", "عبارة L", 0.25), el("q8-e2", "قيمة L", 0.25)], [D1, D1S2, F3])

    # 1.1 — the answer is a drawing with no wording in the correction ⇒ deferred (one step per mark line)
    SCH = {"kind": "schematic", "figure": "الشكل 1",
           "model": "دارة تفريغ: مكثفة (+ في الأعلى) على التسلسل مع ناقل أومي R، سهم التوتر u_C على المكثفة، سهم التوتر u_R على الناقل الأومي، "
                    "وجهة التيار i مع كتابة (i<0) — كما في رسم الإجابة النموذجية"}
    for eid, crit in [("q1-e1", "سهم التوتر u_C بين طرفي المكثفة"), ("q1-e2", "سهم التوتر u_R بين طرفي الناقل الأومي"),
                      ("q1-e3", "جهة التيار i مع الإشارة (i<0)")]:
        deferred(eid, "bar_chart", f"رسم دارة التفريغ — معيار: {crit}", {**SCH, "criterion": crit}, {"rubric": f"{crit} (0.25)"},
                 "يُصحَّح الرسم بالمقارنة مع رسم الإجابة النموذجية: سهم $u_C$ (0.25)، سهم $u_R$ (0.25)، والإشارة $(i<0)$ (0.25).", 0.25, ELEC)
    # 2.1
    mcq("q2-e1", "بتطبيق قانون جمع التوترات الكهربائية على دارة التفريغ، أيّ علاقة صحيحة؟",
        ["$u_C(t)+u_R(t)=0$", "$u_C(t)+u_R(t)=E$", "$u_C(t)\\cdot u_R(t)=0$", "$u_C(t)+u_R(t)=R\\cdot C$"],
        "بتطبيق قانون جمع التوترات الكهربائية: $u_C(t)+u_R(t)=0$", 0.25, ELEC)
    mcq("q2-e2", "بالتعويض بعبارة توتّر المكثفة (بدلالة الشحنة $q$) وعبارة توتّر الناقل الأومي (بدلالة شدة التيار $i$)، تصبح العلاقة:",
        ["$\\frac{1}{C}\\cdot q(t)+R\\cdot i(t)=0$", "$C\\cdot q(t)+R\\cdot i(t)=0$", "$\\frac{1}{C}\\cdot q(t)+\\frac{1}{R}\\cdot i(t)=0$",
         "$\\frac{1}{C}\\cdot i(t)+R\\cdot q(t)=0$"],
        "حسب الإجابة النموذجية: توتّر المكثفة $u_C=\\frac{q}{C}$ وتوتّر الناقل الأومي $u_R=R\\,i$، ومنه العلاقة $\\frac{q}{C}+R\\,i=0$", 0.25, ELEC)
    mcq("q2-e3", "باشتقاق طرفي المعادلة السابقة بالنسبة للزمن نجد:",
        ["$\\frac{1}{C}\\cdot\\frac{dq(t)}{dt}+R\\cdot\\frac{di(t)}{dt}=0$", "$\\frac{1}{C}\\cdot\\frac{dq(t)}{dt}+R\\cdot i(t)=0$",
         "$C\\cdot\\frac{dq(t)}{dt}+R\\cdot\\frac{di(t)}{dt}=0$", "$\\frac{1}{C}\\cdot q(t)+R\\cdot\\frac{di(t)}{dt}=0$"],
        "باشتقاق طرفي المعادلة بالنسبة للزمن: $\\frac{1}{C}\\frac{dq}{dt}+R\\frac{di}{dt}=0$", 0.25, ELEC)
    mcq("q2-e4", "وبما أنّ $i=\\frac{dq}{dt}$، فإنّ المعادلة التفاضلية لتطوّر شدة التيار هي:",
        ["$\\frac{di}{dt}+\\frac{1}{R\\cdot C}\\cdot i=0$", "$\\frac{di}{dt}+R\\cdot C\\cdot i=0$", "$\\frac{di}{dt}+\\frac{R}{C}\\cdot i=0$",
         "$\\frac{di}{dt}+\\frac{C}{R}\\cdot i=0$"],
        "المعادلة التفاضلية لتطوّر شدة التيار: $\\frac{di}{dt}+\\frac{1}{RC}\\,i=0$", 0.25, ELEC)
    # 3.1 — «بيّن أنّ»: the correction's intermediate results (τ = RC)
    mcq("q3-e1", "نكتب الحلّ المقترح على الشكل $i(t)=-I_0\\,e^{-t/\\tau}$ حيث $\\tau=RC$. ما مشتقّته بالنسبة للزمن؟",
        ["$\\frac{di}{dt}=\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}$", "$\\frac{di}{dt}=-\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}$",
         "$\\frac{di}{dt}=I_0\\cdot\\tau\\cdot e^{-\\frac{t}{\\tau}}$", "$\\frac{di}{dt}=-I_0\\cdot e^{-\\frac{t}{\\tau}}$"],
        "نشتقّ عبارة شدة التيار بالنسبة للزمن فنجد $\\frac{di}{dt}=\\frac{I_0}{\\tau}e^{-t/\\tau}$", 0.25, ELEC)
    mcq("q3-e2", "نعوّض عبارتي $i$ و $\\frac{di}{dt}$ في المعادلة التفاضلية السابقة (مع $\\tau=RC$). ماذا نجد؟",
        ["$\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}-\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}=0$",
         "$\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}+\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}=0$",
         "$I_0\\cdot\\tau\\cdot e^{-\\frac{t}{\\tau}}-\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}=0$",
         "$\\frac{I_0}{\\tau}\\cdot e^{-\\frac{t}{\\tau}}-I_0\\cdot e^{-\\frac{t}{\\tau}}=0$"],
        "بالتعويض في المعادلة التفاضلية السابقة نجد: $\\frac{I_0}{\\tau}e^{-t/\\tau}-\\frac{I_0}{\\tau}e^{-t/\\tau}=0$", 0.5, ELEC)
    mcq("q3-e3", "ماذا نستنتج من هذا التعويض؟",
        ["المساواة محقّقة في كل لحظة، ومنه $i(t)=-I_0\\,e^{-t/\\tau}$ حلّ للمعادلة التفاضلية", "المساواة محقّقة عند اللحظة $t=0$ فقط",
         "المساواة غير محقّقة، فالعبارة ليست حلًّا للمعادلة التفاضلية", "المساواة محقّقة عند اللحظة $t=\\tau$ فقط"],
        "ومنه $i(t)=-I_0\\,e^{-t/\\tau}$ حلّ للمعادلة التفاضلية.", 0.25, ELEC)
    # 1.4.1 — graph readings (fig. 2: 10 minor divisions per major ⇒ 0.4×10³ A and 0.5×10⁻⁵ s)
    num("q4-e1", "اعتمادًا على البيان (الشكل 2): عند اللحظة $t=0$ يكون $i(0)=-I_0$. ما قيمة شدة التيار العظمى $I_0$ بوحدة محور التراتيب؟",
        20, 0.4, "×10³ A", "عند اللحظة $t=0$ يكون $i(t=0)=-I_0=-2\\cdot10^4\\,A$ ومنه $I_0=2\\times10^4\\,A$ (أي 20 بوحدة $10^3\\,A$).", 0.25, ELEC)
    mcq("q4-e2", "لتعيين ثابت الزمن $\\tau$ بيانيًّا، كم تكون شدة التيار عند اللحظة $t=\\tau$؟",
        ["$i(\\tau)=-0{,}37\\cdot I_0$", "$i(\\tau)=-0{,}63\\cdot I_0$", "$i(\\tau)=-0{,}5\\cdot I_0$", "$i(\\tau)=0$"],
        "عند اللحظة $t=\\tau$ يكون $i(t=\\tau)=-0{,}37\\cdot I_0$، ونُسقط هذه القيمة على بيان $i=f(t)$. ملاحظة الإجابة النموذجية: يمكن تحديد قيمة ثابت الزمن $\\tau$ بطريقة المماس عند المبدأ.",
        0.25, ELEC)
    num("q4-e3", "بإسقاط القيمة $-0{,}37\\,I_0$ على البيان (الشكل 2)، ما قيمة ثابت الزمن $\\tau$ بوحدة محور الفواصل؟",
        5, 0.5, "×10⁻⁵ s", "بالإسقاط على البيان نحصل على $\\tau=5\\times10^{-5}\\,s$", 0.25, ELEC)
    # 2.4.1
    mcq("q5-e1", "ما العلاقة التي تسمح بحساب مقاومة الهواء $R$؟", ["$R=\\frac{E}{I_0}$", "$R=E\\cdot I_0$", "$R=\\frac{I_0}{E}$", "$R=\\frac{E}{\\tau}$"],
        "$E=R\\cdot I_0\\Rightarrow R=\\frac{E}{I_0}$", 0.25, ELEC)
    num("q5-e2", "احسب قيمة المقاومة $R$ بالأوم.", 5000, 1, "Ω", "$R=\\frac{E}{I_0}=\\frac{10^8}{2\\cdot10^4}=5000\\,\\Omega=5\\,k\\Omega$", 0.25, ELEC,
        exact=1e8 / 2e4)
    mcq("q5-e3", "ما العلاقة التي تسمح باستنتاج سعة المكثفة $C$؟", ["$C=\\frac{\\tau}{R}$", "$C=R\\cdot\\tau$", "$C=\\frac{R}{\\tau}$", "$C=\\frac{E}{R}$"],
        "$\\tau=R\\cdot C\\Rightarrow C=\\frac{\\tau}{R}$", 0.25, ELEC)
    num("q5-e4", "احسب قيمة سعة المكثفة $C$ بالنانوفاراد.", 10, 0.5, "nF", "$C=\\frac{\\tau}{R}=\\frac{5\\cdot10^{-5}}{5000}=10\\,nF$", 0.25, ELEC,
        exact=5e-5 / 5000 * 1e9)
    # 5.1 — open list («ذكر قاعدتين على الأقل» … «- …») ⇒ deferred
    deferred("q6-e1", "essay_builder", "قواعد الحماية من الصاعقة — معيار: ذكر قاعدتين على الأقل",
             {"task": "إعطاء بعض قواعد الحماية من الصاعقة على ضوء المثلين", "criterion": "ذكر قاعدتين على الأقل", "indicator": "قاعدتان صحيحتان (0.5)",
              "model_examples": ["تجنب التواجد في المرتفعات العالية عند حدوث البرق.", "تجنب التواجد قرب الأبراج المعدنية.", "تجنب التواجد قرب مصادر المياه."]},
             {"rubric": "ذكر قاعدتين على الأقل (0.5) — القائمة مفتوحة «…»"},
             "من قواعد الحماية في الإجابة النموذجية: تجنب التواجد في المرتفعات العالية عند حدوث البرق، تجنب التواجد قرب الأبراج المعدنية، تجنب التواجد قرب مصادر المياه، …",
             0.5, ELEC)
    # 2. RLC
    mcq("q7-e1", "ما نمط الاهتزاز الذي يمثّله البيان (الشكل 3)؟",
        ["اهتزازات كهربائية حرة متخامدة", "اهتزازات كهربائية حرة غير متخامدة", "اهتزازات كهربائية قسرية", "نظام لا دوري دون اهتزاز"],
        "نمط الاهتزاز: اهتزازات كهربائية حرة متخامدة.", 0.25, ELEC)
    num("q7-e2", "من البيان (الشكل 3)، كم يساوي شبه الدور $T$ بالميلي ثانية؟", 0.2, 0.02, "ms",
        "$2\\cdot T=0{,}4\\Rightarrow T=\\frac{0{,}4}{2}=0{,}2\\,ms$", 0.25, ELEC)
    mcq("q8-e1", "باعتبار $T\\approx T_0=2\\pi\\sqrt{LC}$، ما عبارة ذاتية الوشيعة $L$؟",
        ["$L=\\frac{T^2}{4\\pi^2\\cdot C}$", "$L=\\frac{4\\pi^2\\cdot C}{T^2}$", "$L=\\frac{T}{2\\pi\\cdot C}$", "$L=\\frac{T^2\\cdot C}{4\\pi^2}$"],
        "$T\\approx T_0=2\\pi\\sqrt{L\\cdot C}\\Rightarrow L=\\frac{T^2}{4\\pi^2\\cdot C}$", 0.25, ELEC)
    num("q8-e2", "احسب قيمة ذاتية الوشيعة $L$ بالهنري.", 0.1, 0.005, "H",
        "$L=\\frac{T^2}{4\\pi^2 C}=\\frac{4\\cdot10^{-8}}{40\\cdot10^{-8}}=0{,}1\\,H\\quad(4\\pi^2\\approx40)$", 0.25, ELEC,
        exact=(0.2e-3) ** 2 / (4 * math.pi ** 2 * 1e-8))

    # ── التمرين الثاني ──
    D2S1 = text_doc("d-ex2-s1", "نصّ التمرين الثاني (السؤال 1)",
                    "نقترح ثلاثة محاليل مائية $(S_1)$، $(S_2)$ و $(S_3)$ للأحماض $HA_1$، $HA_2$ و $HA_3$ على الترتيب لها نفس التركيز المولي "
                    "$c=5\\times10^{-2}\\,mol\\cdot L^{-1}$، قيم الـ $pH$ للمحاليل الثلاث: 1,3، 3,2 و 2,9 وترتب هذه الأحماض حسب تزايد قوتها الحمضية الشكل 4.\n"
                    "يهدف هذا التمرين إلى مقارنة قوة الأحماض.\nكل المحاليل مأخوذة في الدرجة $25^{\\circ}C$.")
    F4 = fig("f-ex2-4", "image", "الشكل 4", "fig4", "الشكل 4 من ورقة الموضوع: محور ترتيب الأحماض HA3 وHA2 وHA1 حسب تزايد القوة الحمضية",
             "الشكل 4: ترتيب الأحماض على محور القوة الحمضية")
    D2S61 = text_doc("d-ex2-s61", "نصّ السؤال 6.1",
                     "من أجل قيم مختلفة للتركيز المولي $[HA]_{éq}$ للمحلولين الحمضيين الضعيفين السابقين، نقيس قيم $pH$ الموافقة ثم نمثل "
                     "المنحنى البياني لتطور الـ $pH$ بدلالة $-\\log[HA]_{éq}$ (الشكل 5).")
    F5 = fig("f-ex2-5", "graph", "الشكل 5", "fig5", "الشكل 5 من ورقة الموضوع: المستقيمان ① و② لتطور الـ pH بدلالة −log[HA]éq",
             "الشكل 5: pH بدلالة −log[HA]")
    D2S2 = text_doc("d-ex2-s2", "نصّ السؤال 2",
                    "نسخن بالارتداد وبوجود وسيط، مزيجا ستوكيومتريا لأحد الحمضين النقيين السابقين مع الايثانول $(C_2H_5-OH)$ فينتج المركب "
                    "العضوي $(CH_3COO-C_2H_5)$ والماء.")
    D2S22 = text_doc("d-ex2-s22", "نصّ السؤال 2.2",
                     "المتابعة الزمنية للتحول الكيميائي الحادث عن طريق معايرة الحمض المتبقي مكنت من رسم المنحنى البياني لتطور كمية مادة "
                     "الحمض المتبقي بدلالة الزمن $n=f(t)$ الشكل 6.")
    F6 = fig("f-ex2-6", "graph", "الشكل 6", "fig6", "الشكل 6 من ورقة الموضوع: منحنى كمية مادة الحمض المتبقي n (mol) بدلالة الزمن t (min)",
             "الشكل 6: n بدلالة t")
    E2A = [D2S1, F4]
    q("q9", "1.1", P_EX2, "أعط تعريفا للحمض الضعيف.", 0.25, [el("q9-e1", "تعريف الحمض الضعيف", 0.25)], E2A)
    q("q10", "2.1", P_EX2, "انسب لكل محلول قيمة الـ $pH$ الموافق له مع التبرير.", 1,
      [el("q10-e1", "التبرير", 0.25), el("q10-e2", "pH محلول HA1", 0.25), el("q10-e3", "pH محلول HA2", 0.25), el("q10-e4", "pH محلول HA3", 0.25)], E2A)
    q("q11", "3.1", P_EX2, "بيّن أن الحمضين $HA_2$ و $HA_3$ ضعيفان وأن $HA_1$ حمض قوي.", 1,
      [el("q11-e1", "تركيز شوارد الهيدرونيوم بدلالة pH", 0.25), el("q11-e2", "HA1 حمض قوي", 0.25), el("q11-e3", "HA2 حمض ضعيف", 0.25),
       el("q11-e4", "HA3 حمض ضعيف", 0.25)], E2A)
    q("q12", "4.1", P_EX2, "اكتب عبارة ثابت الحموضة $Ka$ للثنائية $HA(aq)/A^-(aq)$.", 0.25, [el("q12-e1", "عبارة Ka", 0.25)], E2A)
    q("q13", "5.1", P_EX2, "اثبت أن عبارة الـ $pH$ تعطى بالعلاقة:\n$pH=-\\frac{1}{2}\\log[HA]_{éq}+\\frac{1}{2}pKa$", 1,
      [el("q13-e1", "إدخال اللوغاريتم على عبارة Ka", 0.25), el("q13-e2", "تعويض تركيز A- بتركيز H3O+", 0.25),
       el("q13-e3", "العلاقة بين pKa و pH", 0.25), el("q13-e4", "عبارة pH", 0.25)], E2A)
    q("q14", "1.6.1", P_EX2, "ارفق كل منحنى بالحمض الموافق له مع التعليل.", 0.75,
      [el("q14-e1", "التعليل", 0.25), el("q14-e2", "المنحنى (2)", 0.25), el("q14-e3", "المنحنى (1)", 0.25)], E2A + [D2S61, F5])
    q("q15", "2.6.1", P_EX2, "حدّد قيمة $pKa$ لكل ثنائية $HA(aq)/A^-(aq)$ من المنحنيين ① و ② بالشكل 5.", 1,
      [el("q15-e1", "تقاطع المنحنى (1) مع محور التراتيب", 0.25), el("q15-e2", "pKa للمنحنى (1)", 0.25),
       el("q15-e3", "تقاطع المنحنى (2) مع محور التراتيب", 0.25), el("q15-e4", "pKa للمنحنى (2)", 0.25)], E2A + [D2S61, F5])
    q("q16", "1.2", P_EX2, "حدّد الوظيفة الكيميائية للمركب العضوي الناتج مع ذكر اسمه.", 0.5,
      [el("q16-e1", "الوظيفة الكيميائية", 0.25), el("q16-e2", "اسم المركب", 0.25)], [D2S1, D2S2])
    q("q17", "1.2.2", P_EX2, "احسب سرعة اختفاء الحمض عند اللحظة $t=10\\,min$ واستنتج سرعة التفاعل عند نفس اللحظة.", 0.75,
      [el("q17-e1", "رسم المماس وحساب الميل", 0.25), el("q17-e2", "سرعة اختفاء الحمض", 0.25), el("q17-e3", "سرعة التفاعل", 0.25)],
      [D2S1, D2S2, D2S22, F6])
    q("q18", "2.2.2", P_EX2, "اذكر العوامل التي تؤثر في سرعة هذا التحول.", 0.5, [el("q18-e1", "العاملان الحركيان (2×0.25)", 0.5)], [D2S1, D2S2, D2S22])

    mcq("q9-e1", "ما تعريف الحمض الضعيف؟",
        ["حمض يكون انحلاله في الماء وفق تفاعل غير تام (محدود)", "حمض يكون انحلاله في الماء وفق تفاعل تام", "حمض لا ينحلّ في الماء إطلاقًا",
         "حمض يكون تركيزه المولي صغيرًا دائمًا"],
        "الحمض الضعيف: يكون انحلاله في الماء وفق تفاعل غير تام (محدود).", 0.25, CHEM)
    mcq("q10-e1", "لماذا يوافق الحمضَ الأقوى أصغرُ قيمة للـ $pH$ في هذه المحاليل الثلاثة؟",
        ["لأنّ كل المحاليل لها نفس التركيز، والحمض الأقوى (الأكثر انحلالًا) يوافق قيمة $pH$ أقل", "لأنّ الحمض الأقوى له أكبر تركيز مولي",
         "لأنّ الحمض الأقوى هو الأقلّ انحلالًا في الماء", "لأنّ قيمة الـ $pH$ لا تتعلّق بقوة الحمض"],
        "كل المحاليل لها نفس التركيز: الحمض الأقوى (الأكثر انحلال) يوافق قيمة $pH$ أقل.", 0.25, CHEM)
    PH_EXPL = "حسب الشكل 4: $HA_1$ يوافق $pH_1=1{,}3$، $HA_2$ يوافق $pH_2=2{,}9$، $HA_3$ يوافق $pH_3=3{,}2$."
    mcq("q10-e2", "ما قيمة الـ $pH$ لمحلول الحمض $HA_1$؟", ["1,3", "2,9", "3,2"], PH_EXPL, 0.25, CHEM)
    mcq("q10-e3", "ما قيمة الـ $pH$ لمحلول الحمض $HA_2$؟", ["2,9", "1,3", "3,2"], PH_EXPL, 0.25, CHEM)
    mcq("q10-e4", "ما قيمة الـ $pH$ لمحلول الحمض $HA_3$؟", ["3,2", "1,3", "2,9"], PH_EXPL, 0.25, CHEM)
    mcq("q11-e1", "انطلاقًا من تعريف الـ $pH$، كيف نحسب تركيز شوارد الهيدرونيوم في كل محلول؟",
        ["$[H_3O^+]_{eq}=10^{-pH}$", "$[H_3O^+]_{eq}=-\\log pH$", "$[H_3O^+]_{eq}=10^{pH}$", "$[H_3O^+]_{eq}=\\frac{pH}{c}$"],
        "$pH=-\\log[H_3O^+]_{eq}\\Rightarrow[H_3O^+]_{eq}=10^{-pH}$", 0.25, CHEM)
    STRONG = ["حمض قوي لأنّ $[H_3O^+]_{eq}=c$", "حمض ضعيف لأنّ $[H_3O^+]_{eq}<c$", "حمض ضعيف لأنّ $[H_3O^+]_{eq}=c$", "حمض قوي لأنّ $[H_3O^+]_{eq}<c$"]
    WEAK = [STRONG[1], STRONG[0], STRONG[3], STRONG[2]]
    mcq("q11-e2", "لمحلول الحمض $HA_1$ نجد تركيز شوارد الهيدرونيوم $[H_3O^+]_{eq}=10^{-pH_1}=5\\times10^{-2}\\,mol\\cdot L^{-1}$. بمقارنته بالتركيز $c$، الحمض $HA_1$:",
        STRONG, "بالنسبة للحمض $HA_1$ يكون تركيز شوارد الهيدرونيوم مساويًا للتركيز المولي: $[H_3O^+]_{eq}=10^{-pH_1}=5\\times10^{-2}\\,mol\\cdot L^{-1}=c$، وبالتالي $HA_1$ حمض قوي.",
        0.25, CHEM)
    mcq("q11-e3", "لمحلول الحمض $HA_2$ نجد تركيز شوارد الهيدرونيوم $[H_3O^+]_{eq}=10^{-pH_2}=1{,}25\\times10^{-3}\\,mol\\cdot L^{-1}$. بمقارنته بالتركيز $c$، الحمض $HA_2$:",
        WEAK, "بالنسبة للحمض $HA_2$ يكون تركيز شوارد الهيدرونيوم أصغر من التركيز المولي: $[H_3O^+]_{eq}=10^{-pH_2}=1{,}25\\times10^{-3}\\,mol\\cdot L^{-1}<c$، وبالتالي $HA_2$ حمض ضعيف.",
        0.25, CHEM)
    mcq("q11-e4", "لمحلول الحمض $HA_3$ نجد تركيز شوارد الهيدرونيوم $[H_3O^+]_{eq}=10^{-3{,}2}\\,mol\\cdot L^{-1}$. بمقارنته بالتركيز $c$، الحمض $HA_3$:",
        [WEAK[0], WEAK[1], WEAK[3], WEAK[2]],
        "$HA_3$: $[H_3O^+]_{eq}=10^{-pH_3}<c$ وبالتالي $HA_3$ حمض ضعيف. (ملاحظة الإجابة النموذجية: يمكن أيضًا حساب النسبة النهائية لتقدم التفاعل: $\\tau_f=1$ حمض قوي و $\\tau_f<1$ حمض ضعيف.)",
        0.25, CHEM)
    mcq("q12-e1", "ما عبارة ثابت الحموضة $Ka$ للثنائية $HA(aq)/A^-(aq)$؟",
        ["$Ka=\\frac{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}{[AH]_{eq}}$", "$Ka=\\frac{[AH]_{eq}}{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}$",
         "$Ka=[H_3O^+]_{eq}\\cdot[A^-]_{eq}$", "$Ka=\\frac{[A^-]_{eq}}{[H_3O^+]_{eq}\\cdot[AH]_{eq}}$"],
        "$Ka=\\frac{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}{[AH]_{eq}}$", 0.25, CHEM)
    # 5.1 — «اثبت»: correction's intermediate lines
    mcq("q13-e1", "بإدخال اللوغاريتم العشري على طرفي عبارة ثابت الحموضة $Ka$ نجد:",
        ["$\\log Ka=\\log\\left(\\frac{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}{[AH]_{eq}}\\right)$", "$\\log Ka=\\frac{\\log[H_3O^+]_{eq}\\cdot\\log[A^-]_{eq}}{\\log[AH]_{eq}}$",
         "$\\log Ka=-\\log\\left(\\frac{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}{[AH]_{eq}}\\right)$", "$\\log Ka=\\log[H_3O^+]_{eq}+\\log[AH]_{eq}$"],
        "$\\log Ka=\\log\\left(\\frac{[H_3O^+]_{eq}\\cdot[A^-]_{eq}}{[AH]_{eq}}\\right)$",
        0.25, CHEM)
    mcq("q13-e2", "بما أنّ $[A^-]_{eq}=[H_3O^+]_{eq}$ في محلول الحمض الضعيف، تصبح العبارة:",
        ["$\\log Ka=\\log\\left(\\frac{[H_3O^+]_{eq}^2}{[AH]_{eq}}\\right)$", "$\\log Ka=\\log\\left([H_3O^+]_{eq}^2\\cdot[AH]_{eq}\\right)$",
         "$\\log Ka=\\log\\left(\\frac{[H_3O^+]_{eq}}{[AH]_{eq}}\\right)$", "$\\log Ka=\\log\\left(\\frac{[AH]_{eq}}{[H_3O^+]_{eq}^2}\\right)$"],
        "$\\log Ka=\\log\\left(\\frac{[H_3O^+]_{eq}^2}{[AH]_{eq}}\\right)$", 0.25, CHEM)
    mcq("q13-e3", "باستعمال تعريفي $pKa=-\\log Ka$ و $pH=-\\log[H_3O^+]_{eq}$ ونقل الحدود، نجد العلاقة:",
        ["$-pKa=-2pH-\\log[AH]_{eq}$", "$-pKa=2pH-\\log[AH]_{eq}$", "$-pKa=-2pH+\\log[AH]_{eq}$", "$-pKa=-pH-\\log[AH]_{eq}$"],
        "$-pKa=\\log[H_3O^+]_{eq}^2-\\log[AH]_{eq}\\Rightarrow-pKa=-2pH-\\log[AH]_{eq}$", 0.25, CHEM)
    mcq("q13-e4", "انطلاقًا من العلاقة $-pKa=-2pH-\\log[AH]_{eq}$، أيّ عملية تعطي عبارة الـ $pH$ المطلوبة؟",
        ["نعزل $2pH$ في طرف ثم نقسم طرفي العلاقة على 2", "نضرب طرفي العلاقة في 2", "نُدخل الدالة الأسية على طرفي العلاقة",
         "نعوّض $pKa$ بقيمة الـ $pH$"],
        "$pH=-\\frac{1}{2}\\log[AH]_{eq}+\\frac{1}{2}pKa$", 0.25, CHEM)
    mcq("q14-e1", "لماذا يكون الـ $pH$ لمحلول $HA_2$ أصغر من الـ $pH$ لمحلول $HA_3$ عند نفس التركيز؟",
        ["لأنّ $HA_2$ و $HA_3$ حمضان ضعيفان و $HA_2$ أكثر انحلالًا من $HA_3$", "لأنّ $HA_3$ أكثر انحلالًا من $HA_2$", "لأنّ الحمض $HA_2$ حمض قوي",
         "لأنّ الحمض $HA_3$ حمض قوي"],
        "$HA_2$ و $HA_3$ حمضان ضعيفان و $HA_2$ أكثر انحلالًا من $HA_3$ فإنّ $pH_2<pH_3$ وبالتالي: المنحنى (2) يوافق $HA_2$ والمنحنى (1) يوافق $HA_3$.",
        0.25, CHEM)
    CURVE_EXPL = "$pH_2<pH_3$: المنحنى (2) يوافق $HA_2$ والمنحنى (1) يوافق $HA_3$."
    mcq("q14-e2", "أيّ حمض يوافق المنحنى ② في الشكل 5؟", ["$HA_2$", "$HA_3$", "$HA_1$"], CURVE_EXPL, 0.25, CHEM)
    mcq("q14-e3", "أيّ حمض يوافق المنحنى ① في الشكل 5؟", ["$HA_3$", "$HA_2$", "$HA_1$"], CURVE_EXPL, 0.25, CHEM)
    # 2.6.1 — extrapolation to the ordinate axis (fig. 5: 10 minor divisions per unit ⇒ 0.1)
    PKA_EXPL = ("باستغلال البيان نقوم بتمديد المنحنيين الى غاية التقاطع مع محور التراتيب: ① $pH_1=\\frac{1}{2}pKa_1=2{,}4\\Rightarrow pKa_1=4{,}8$ ؛ "
                "② $pH_2=\\frac{1}{2}pKa_2=1{,}9\\Rightarrow pKa_2=3{,}8$")
    num("q15-e1", "بتمديد المستقيم ① حتى يقطع محور التراتيب، ما قيمة الـ $pH$ عند نقطة التقاطع؟", 2.4, 0.1, None, PKA_EXPL, 0.25, CHEM)
    num("q15-e2", "استنتج قيمة $pKa_1$ للثنائية الموافقة للمنحنى ①.", 4.8, 0.2, None, PKA_EXPL, 0.25, CHEM)
    num("q15-e3", "بتمديد المستقيم ② حتى يقطع محور التراتيب، ما قيمة الـ $pH$ عند نقطة التقاطع؟", 1.9, 0.1, None, PKA_EXPL, 0.25, CHEM)
    num("q15-e4", "استنتج قيمة $pKa_2$ للثنائية الموافقة للمنحنى ②.", 3.8, 0.2, None, PKA_EXPL, 0.25, CHEM)
    mcq("q16-e1", "ما الوظيفة الكيميائية للمركب العضوي الناتج $CH_3COO-C_2H_5$؟", ["إسترية", "حمضية كربوكسيلية", "كحولية", "ألدهيدية"],
        "الوظيفة الكيميائية: إسترية.", 0.25, CHEM)
    mcq("q16-e2", "ما اسم المركب العضوي الناتج؟", ["إيثانوات الإيثيل", "إيثانوات الميثيل", "بروبانوات الإيثيل", "حمض الإيثانويك"],
        "اسم المركب العضوي الناتج: إيثانوات الإيثيل.", 0.25, CHEM)
    mcq("q17-e1", "كيف نحسب بيانيًّا سرعة اختفاء الحمض عند اللحظة $t=10\\,min$؟",
        ["برسم المماس للمنحنى عند هذه اللحظة وحساب ميله", "بقراءة كمية المادة عند هذه اللحظة مباشرة", "بقسمة كمية المادة عند هذه اللحظة على 10",
         "برسم المماس للمنحنى عند المبدأ"],
        "سرعة اختفاء الحمض عند اللحظة $t=10\\,min$: برسم المماس وحساب الميل.", 0.25, KIN)
    num("q17-e2", "برسم المماس عند $t=10\\,min$ على البيان (الشكل 6)، احسب سرعة اختفاء الحمض $v_{acide}=-\\frac{dn_{acide}}{dt}$.", 0.01, 0.001,
        "mol·min⁻¹", "$v_{acide}=-\\frac{dn_{acide}}{dt}=10^{-2}\\,mol\\cdot min^{-1}$", 0.25, KIN)
    mcq("q17-e3", "استنتج سرعة التفاعل عند نفس اللحظة:",
        ["$v=v_{acide}=10^{-2}\\,mol\\cdot min^{-1}$", "$v=2\\,v_{acide}=2\\times10^{-2}\\,mol\\cdot min^{-1}$",
         "$v=\\frac{v_{acide}}{2}=5\\times10^{-3}\\,mol\\cdot min^{-1}$", "$v=0$"],
        "استنتاج سرعة التفاعل عند نفس اللحظة: $v=v_{acide}=10^{-2}\\,mol\\cdot min^{-1}$", 0.25, KIN)
    multi("q18-e1", "اختر العاملين اللذين يؤثّران في سرعة هذا التحول:", ["درجة الحرارة", "الوسيط", "لون المزيج الابتدائي", "شكل الإناء المستعمل"], 2,
          "العوامل التي تؤثر في سرعة التحول الحادث: درجة الحرارة والوسيط.", 0.5, KIN)

    # ── التمرين التجريبي ──
    DX = text_doc("d-x-intro", "تقديم التمرين التجريبي",
                  "تُعتبر منطقة تيميمون بولاية أدرار المعروفة بالواحة الحمراء مقصداً للسُيَّاح لممارسة رياضة التزحلق على الكثبان الرملية.\n"
                  "يهدف التمرين الى دراسة الحركة المستقيمة لمتزحلق على الرمل.\n"
                  "باستغلال شريط فيديو لمتزحلق (الشخص + لوازمه) تم تصويره من طرف أحد زوار منطقة تيميمون، ندرس الجملة {المتزحلق} التي "
                  "مركز عطالتها $G$ المنمذجة بنقطة مادية كتلتها $m$.")
    DXD = text_doc("d-x-data", "المعطيات",
                   f"{DATA}\n◄ كتلة الجملة $m=70\\,kg$؛\n◄ شدة تسارع حقل الجاذبية الأرضية $g=9{{,}}8\\,m\\cdot s^{{-2}}$؛\n"
                   "◄ طول المسار الأفقي $BC=12\\,m$؛\n◄ زاوية الميل $\\alpha=41^{\\circ}$.")
    F7 = fig("f-x-7", "image", "الشكل 7", "fig7", "الشكل 7 من ورقة الموضوع: المسار المائل AB بزاوية الميل α والمسار الأفقي BC مع المتزحلق",
             "الشكل 7: المسار ABC")
    DXS1 = text_doc("d-x-s1", "نصّ الجزء 1",
                    "المرحلة الأولى (المسار $AB$):\nحركة المتزحلق تتم على مستو مائل انطلاقا من النقطة $A$ دون سرعة ابتدائية الشكل 7.\n"
                    "معالجة شريط الفيديو السابق ببرمجية $Avistep$ مكّنتنا من تسجيل المواضع المتتالية لمركز عطالة الجملة خلال مجالات زمنية "
                    "متتالية ومتساوية $\\Delta t=0{,}8\\,s$ الشكل 8.")
    F8 = fig("f-x-8", "image", "الشكل 8", "fig8", "الشكل 8 من ورقة الموضوع: المواضع المتتالية G0…G8 لمركز عطالة الجملة على ورق ميليمتري مع سهم السلّم 4m",
             "الشكل 8: تسجيل المواضع المتتالية")
    DXS61 = text_doc("d-x-s61", "نصّ السؤال 6.1", "بإهمال قوى الاحتكاك على المسار $AB$:")
    DXS2 = text_doc("d-x-s2", "نصّ الجزء 2",
                    "المرحلة الثانية(المسار $BC$):\nيصل المتزحلق الى النقطة $B$ بسرعة $v_B=12\\,m\\cdot s^{-1}$ ويواصل حركته المستقيمة على "
                    "المستوي الأفقي $BC$ ليتوقف عند الموضع $C$. تنمذج القوى المعيقة للحركة بقوة وحيدة $\\overrightarrow{f}$ مماسية للمسار وثابتة في الشدة.")
    XA = [DX, DXD, F7, DXS1, F8]
    q("q19", "1.1", P_X1, "عرّف المرجع الغاليلي (العطالي).", 0.5, [el("q19-e1", "تعريف المرجع الغاليلي", 0.5)], XA)
    q("q20", "2.1", P_X1, "احسب قيم السرعة في اللحظات $t_3$، $t_5$ و $t_7$ الموافقة للمواضع $G_3$، $G_5$، $G_7$ على الترتيب.", 1,
      [el("q20-e1", "عبارة السرعة اللحظية v3", 0.25), el("q20-e2", "قيمة v3", 0.25), el("q20-e3", "قيمة v5", 0.25), el("q20-e4", "قيمة v7", 0.25)], XA)
    q("q21", "3.1", P_X1, "ارسم على ورق ميليمتري المنحنى البياني لتطور السرعة اللحظية بدلالة الزمن $v=f(t)$.", 0.5,
      [el("q21-e1", "رسم البيان v=f(t) (2×0.25)", 0.5)], XA)
    q("q22", "4.1", P_X1, "جِد بيانياً قيمة تسارع مركز عطالة الجملة $a_G$ واستنتج طبيعة الحركة.", 0.75,
      [el("q22-e1", "قيمة التسارع", 0.25), el("q22-e2", "طبيعة الحركة", 0.5)], XA)
    q("q23", "5.1", P_X1, "احسب بيانياً المسافة المقطوعة بين الموضعين $G_0$ و $G_8$.", 0.5,
      [el("q23-e1", "لحظة الموضع G8", 0.25), el("q23-e2", "المسافة G0G8", 0.25)], XA)
    q("q24", "1.6.1", P_X1, "بتطبيق القانون الثاني لنيوتن، جِد عبارة التسارع $a'_G$ واحسب قيمته.", 1.25,
      [el("q24-e1", "تمثيل القوى", 0.25), el("q24-e2", "المعلم", 0.25), el("q24-e3", "القانون الثاني لنيوتن", 0.25),
       el("q24-e4", "عبارة التسارع", 0.25), el("q24-e5", "قيمة التسارع", 0.25)], XA + [DXS61])
    q("q25", "2.6.1", P_X1, "برّر الاختلاف بين قيمتي التسارع المحسوبتين في السؤالين (4.1.) و(1.6.1.).", 0.5,
      [el("q25-e1", "مقارنة القيمتين", 0.25), el("q25-e2", "التبرير", 0.25)], XA + [DXS61])
    q("q26", "1.2", P_X2, "أحص ومثّل القوى الخارجية المطبقة على مركز عطالة الجملة $G$.", 0.75,
      [el("q26-e1", "إحصاء القوى (3×0.25)", 0.75)], [DX, DXD, F7, DXS2])
    q("q27", "2.2", P_X2, "جِد شدة القوة $\\overrightarrow{f}$، بتطبيق مبدأ إنحفاظ الطاقة للجملة المدروسة.", 1.25,
      [el("q27-e1", "معادلة انحفاظ الطاقة (2×0.25)", 0.5), el("q27-e2", "العلاقة بين الطاقتين (2×0.25)", 0.5), el("q27-e3", "قيمة f", 0.25)],
      [DX, DXD, F7, DXS2])

    mcq("q19-e1", "ما المرجع الغاليلي (العطالي)؟",
        ["هو كل مرجع يتحقق فيه مبدأ العطالة", "هو كل مرجع مرتبط بجسم متسارع", "هو كل مرجع يدور حول محور ثابت", "هو كل مرجع لا يتحقق فيه مبدأ العطالة"],
        "المرجع الغاليلي: هو كل مرجع يتحقق فيه مبدأ العطالة.", 0.5, MCH)
    V_EXPL = ("$v_3=\\frac{G_2G_4}{2\\tau}=\\frac{1{,}8\\times4}{1{,}6}=4{,}5\\,m\\cdot s^{-1}$ ; $v_5=\\frac{G_4G_6}{2\\tau}=\\frac{3\\times4}{1{,}6}=7{,}5\\,m\\cdot s^{-1}$ ; "
              "$v_7=\\frac{G_6G_8}{2\\tau}=\\frac{4{,}2\\times4}{1{,}6}=10{,}5\\,m\\cdot s^{-1}$ ($\\tau=\\Delta t=0{,}8\\,s$)")
    mcq("q20-e1", "بأيّ عبارة تُحسب السرعة اللحظية $v_3$ عند الموضع $G_3$؟ (نرمز بـ $\\tau$ للمدة $\\Delta t=0{,}8\\,s$)",
        ["$v_3=\\frac{G_2G_4}{2\\cdot\\tau}$", "$v_3=\\frac{G_2G_4}{\\tau}$", "$v_3=\\frac{G_0G_3}{3\\cdot\\tau}$", "$v_3=2\\cdot\\tau\\cdot G_2G_4$"],
        V_EXPL, 0.25, MCH)
    SCALE = "باستعمال سلّم الشكل 8 (طول السهم يمثّل $4\\,m$)"
    num("q20-e2", f"{SCALE}، احسب قيمة السرعة $v_3$.", 4.5, 0.25, "m·s⁻¹", V_EXPL, 0.25, MCH)
    num("q20-e3", f"{SCALE}، احسب قيمة السرعة $v_5$.", 7.5, 0.25, "m·s⁻¹", V_EXPL, 0.25, MCH)
    num("q20-e4", f"{SCALE}، احسب قيمة السرعة $v_7$.", 10.5, 0.25, "m·s⁻¹", V_EXPL, 0.25, MCH)
    deferred("q21-e1", "function_plot", "رسم البيان $v=f(t)$ على ورق ميليمتري",
             {"x": "t (s)", "y": "v (m·s⁻¹)", "points": "النقاط (t3; v3)، (t5; v5)، (t7; v7) من السؤال 2.1",
              "model": "مستقيم يمرّ بالمبدأ — بيان الإجابة النموذجية بسلّم 0,8 s و 2 m·s⁻¹ للتدريجة", "criterion": "رسم البيان (2×0.25)"},
             {"rubric": "بيان تطور السرعة اللحظية بدلالة الزمن (2×0.25)"},
             "بيان تطور السرعة اللحظية بدلالة الزمن مستقيم يمرّ بالمبدأ (انظر بيان الإجابة النموذجية).", 0.5, MCH)
    num("q22-e1", "من البيان $v=f(t)$ (ميله)، احسب قيمة التسارع $a_G=\\frac{\\Delta v}{\\Delta t}$.", 1.88, 0.05, "m·s⁻²",
        "$a=\\frac{\\Delta v}{\\Delta t}=1{,}88\\,m\\cdot s^{-2}$", 0.25, MCH, exact=(10.5 - 4.5) / 3.2)
    mcq("q22-e2", "استنتج طبيعة حركة مركز عطالة الجملة على المسار $AB$:",
        ["حركة مستقيمة متسارعة بانتظام", "حركة مستقيمة منتظمة", "حركة مستقيمة متباطئة بانتظام", "حركة دائرية منتظمة"],
        "طبيعة الحركة: حركة مستقيمة متسارعة بانتظام.", 0.5, MCH)
    num("q23-e1", "ما اللحظة $t_8$ الموافقة للموضع $G_8$؟", 6.4, 0.1, "s",
        "$t_8=8\\times\\Delta t=6{,}4\\,s$؛ والمسافة $G_0G_8$ تساوي عدديًّا مساحة المثلث المحصور بين اللحظتين $t=0\\,s$ و $t=6{,}4\\,s$.", 0.25, MCH, exact=8 * 0.8)
    num("q23-e2", "احسب بيانيًّا المسافة $G_0G_8$ (مساحة المثلث تحت البيان $v=f(t)$ بين $t=0$ و $t_8$).", 38.4, 0.5, "m",
        "بيانيًّا: المسافة $G_0G_8$ قيمتها تساوي عدديًّا مساحة المثلث المحصور بين اللحظتين $t=0\\,s$ و $t=6{,}4\\,s$: $G_0G_8=\\frac{12\\times6{,}4}{2}=38{,}4\\,m$",
        0.25, MCH)
    mcq("q24-e1", "على المسار $AB$ وبإهمال قوى الاحتكاك، ما القوى الخارجية المطبقة على الجملة {المتزحلق}؟",
        ["ثقل الجملة $\\vec{P}$ ورد فعل المستوي المائل $\\vec{R}$ العمودي عليه", "ثقل الجملة $\\vec{P}$ فقط",
         "ثقل الجملة $\\vec{P}$ ورد الفعل $\\vec{R}$ وقوة احتكاك $\\vec{f}$", "رد فعل المستوي $\\vec{R}$ وقوة دفع في جهة الحركة"],
        "الجملة المدروسة: متزحلق؛ القوى الممثّلة في رسم الإجابة النموذجية: الثقل $\\vec{P}$ ورد فعل المستوي $\\vec{R}$.", 0.25, MCH)
    mcq("q24-e2", "ما المعلم المناسب لتطبيق القانون الثاني لنيوتن؟",
        ["سطحي أرضي نعتبره عطاليًّا", "معلم مرتبط بالمتزحلق نفسه", "معلم مرتبط بمركز عطالة الجملة", "أيّ معلم متسارع بالنسبة للأرض"],
        "المعلم: سطحي أرضي نعتبره عطاليا.", 0.25, MCH)
    mcq("q24-e3", "بتطبيق القانون الثاني لنيوتن لمركز عطالة الجملة:",
        ["$\\sum\\vec{F}_{ext}=m\\cdot\\vec{a}_G$", "$\\sum\\vec{F}_{ext}=\\vec{0}$", "$\\sum\\vec{F}_{ext}=m\\cdot\\vec{v}_G$", "$\\sum\\vec{F}_{ext}=\\frac{1}{2}m\\cdot v_G^2$"],
        "بتطبيق القانون الثاني لنيوتن لمركز عطالة الجملة: $\\sum\\vec{F}_{ext}=m\\cdot\\vec{a}_G$", 0.25, MCH)
    mcq("q24-e4", "بإسقاط العلاقة $\\vec{P}+\\vec{R}=m\\cdot\\vec{a}'_G$ على محور الحركة نجد:",
        ["$a'_G=g\\cdot\\sin\\alpha$", "$a'_G=g\\cdot\\cos\\alpha$", "$a'_G=g$", "$a'_G=g\\cdot\\tan\\alpha$"],
        "بالإسقاط على محور الحركة: $a'_G=g\\cdot\\sin\\alpha$", 0.25, MCH)
    num("q24-e5", "احسب قيمة التسارع $a'_G$.", 6.4, 0.1, "m·s⁻²", "$a'_G=g\\cdot\\sin\\alpha=9{,}80\\times\\sin(41^{\\circ})=6{,}4\\,m\\cdot s^{-2}$",
        0.25, MCH, exact=9.8 * math.sin(math.radians(41)))
    mcq("q25-e1", "قارن القيمة النظرية للتسارع (السؤال 1.6.1) بالقيمة التجريبية (السؤال 4.1):",
        ["القيمة النظرية للتسارع أكبر من القيمة التجريبية", "القيمة النظرية للتسارع أصغر من القيمة التجريبية", "القيمتان متساويتان"],
        "القيمة النظرية للتسارع أكبر من القيمة التجريبية.", 0.25, MCH)
    mcq("q25-e2", "بمَ يُبرَّر هذا الاختلاف؟",
        ["بوجود قوى معيقة للحركة", "بخطأ في قيمة شدة تسارع حقل الجاذبية", "بكبر كتلة الجملة", "بكون الحركة على المسار AB منتظمة"],
        "يعود الاختلاف الى وجود قوى معيقة للحركة (أُهملت في الحساب النظري).", 0.25, MCH)
    multi("q26-e1", "أحص القوى الخارجية المطبقة على مركز عطالة الجملة على المسار الأفقي $BC$ (اختر كل القوى):",
          ["قوة الثقل $\\vec{P}$", "قوة رد فعل السطح الأفقي على المتزحلق $\\vec{R}$", "قوة الاحتكاك $\\vec{f}$", "قوة دفع في جهة الحركة", "قوة توتر خيط"], 3,
          "القوى الخارجية: قوة الثقل $\\vec{P}$، قوة رد فعل السطح الأفقي على المتزحلق $\\vec{R}$، قوة الاحتكاك $\\vec{f}$ (0.25 لكل قوة؛ تمثيلها في رسم الإجابة النموذجية).",
          0.75, MCH)
    mcq("q27-e1", "ما معادلة انحفاظ الطاقة للجملة المدروسة؟",
        ["$E_f=E_i+E_{re}-E_{ced}$", "$E_f=E_i-E_{re}+E_{ced}$", "$E_f=E_i+E_{re}+E_{ced}$", "$E_f=E_i\\cdot E_{ced}$"],
        "معادلة انحفاظ الطاقة: $E_f=E_i+E_{re}-E_{ced}$", 0.25, MCH)
    mcq("q27-e1", "بتطبيقها بين الموضعين $B$ و $C$ (الجملة تتوقف عند $C$ ولا تستقبل طاقة) نجد:",
        ["$E_i-E_{ced}=0$", "$E_i+E_{ced}=0$", "$E_i=0$", "$E_{ced}=0$"],
        "$E_f=E_i+E_{re}-E_{ced}\\Rightarrow E_i-E_{ced}=0$", 0.25, MCH)
    mcq("q27-e2", "ما الطاقة الابتدائية $E_i$ للجملة عند الموضع $B$ على المستوي الأفقي؟",
        ["$E_i=\\frac{1}{2}m\\,v_B^2$", "$E_i=m\\,g\\,BC$", "$E_i=m\\,v_B$", "$E_i=\\frac{1}{2}m\\,v_B$"],
        "$\\frac{1}{2}m\\,v_B^2=f\\cdot BC$", 0.25, MCH)
    mcq("q27-e2", "ما الطاقة المحوّلة $E_{ced}$ بفعل القوة $\\vec{f}$ على المسار $BC$؟",
        ["$E_{ced}=f\\cdot BC$", "$E_{ced}=\\frac{f}{BC}$", "$E_{ced}=f\\cdot BC\\cdot\\sin\\alpha$", "$E_{ced}=\\frac{1}{2}f\\cdot BC^2$"],
        "$\\frac{1}{2}m\\,v_B^2=f\\cdot BC$", 0.25, MCH)
    num("q27-e3", "احسب شدة القوة $f$.", 420, 1, "N",
        "$\\frac{1}{2}m\\,v_B^2=f\\cdot BC\\Rightarrow f=420\\,N$ (ملاحظة الإجابة النموذجية: تغيير الجملة المدروسة مع نتيجة صحيحة يُمنح 0,50)", 0.25, MCH,
        exact=0.5 * 70 * 12 ** 2 / 12)

    title = "بكالوريا 2019 (الدورة العادية) – العلوم الفيزيائية – شعبة علوم تجريبية – الموضوع الأول"
    notes = (
        "موضوع البكالوريا الرسمي (الديوان الوطني للامتحانات والمسابقات، دورة 2019، الشعبة: علوم تجريبية، المدة 03 سا و30 د) — الموضوع الأول (ص1–4 من 8)؛ "
        "«الدورة العادية» من اسم الملف في Drive. نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): رُسمت الصفحات بـ pdftoppm -r 200 وقُرئت مكبّرة. "
        "طبقة النص في الـ PDF غير صالحة (أرقام خاطئة: «40» بدل 04، «72» بدل 27، «0» بدل 4؛ كلمات مقطّعة؛ حركات ساقطة) ونص OCR في Drive يشوّه الصيغ: لم يُعتمد أيّ منهما. "
        "الصيغ بـ LaTeX كما طُبعت؛ الفاصلة العشرية داخل الصيغ تُكتب {,}. الأشكال 1–8 مقصوصة من صورة الصفحة (scripts/play/crop_figure.py)؛ "
        "الصورتان الزخرفيتان (البرق، المتزحلق) لم تُنقلا. "
        "الإجابات والعلامات من «الإجابة النموذجية» الرسمية (ص1–4 من 9، صور). المجموع 20 = تمرين أول 6 + تمرين ثان 7 + تجريبي 7. "
        "اختلافات في التصحيح وُثّقت ولم تُنقل: (1) 1.4.1 كُتب «i(t=τ)=−0,37·I0=−0,74A» والصحيح −0,74×10⁴ A — لم تُستعمل القيمة؛ "
        "(2) 2.4.1 مقام C مقطوع «5·» — استُعمل R=5000 Ω من السطر نفسه؛ (3) 2.2 كُتب Π بدل π و4π²≈40؛ "
        "(4) التمرين الثاني 3.1: سطر HA3 كتب «10^{−pH2}» و«6,3×10⁻³» والصحيح 10^{−3,2}≈6,3×10⁻⁴ — الخطوة لا تطلب القيمة العددية؛ "
        "HA2 كُتب 1,25×10⁻³ (10^{−2,9}≈1,26×10⁻³) وأُبقي كما في التصحيح في نص الخطوة وشرحها (دون سؤال عددي)؛ "
        "(5) التجريبي: عمود «مجموع» يذكر 4.75 و2.25 بينما العلامات المجزأة 5 (المرحلة 1) و2 (المرحلة 2)؛ اتُّبعت المجزأة والمجموع 7 لا يتغيّر؛ "
        "(6) التصحيح يرمز بـ τ للمدة Δt=0,8 s في 2.1 التجريبي. "
        "قرارات: 1.1 (رسم الدارة 3×0.25) و3.1 التجريبي (رسم v=f(t) 2×0.25) مؤجلان؛ 5.1 (قواعد الحماية، قائمة مفتوحة) مؤجل essay_builder؛ "
        "2.6.1 «4x0.25» قُسّمت على القيم الأربع (2,4؛ 4,8؛ 1,9؛ 3,8) — اجتهاد يُراجَع؛ 2.2.2 و1.2 (المرحلة 2) عنصر واحد لعناصر متبادلة (multi)؛ "
        "1.6.1: علامة الرسم (0.25) دُرّبت بسؤال عن القوى الممثلة (P، R). "
        "هوامش القيم العددية: قراءة بيان = تدريجة صغرى (I0: 0,4×10³ A؛ τ: 0,5×10⁻⁵ s؛ T: 0,02 ms؛ تقاطعات الشكل 5: 0,1)؛ ميل مماس = 10% (v_acide)؛ "
        "قياس المسافات على الشكل 8 (1 mm = 0,4 m) ⇒ ±0,25 m·s⁻¹ للسرعات؛ a_G ±0,05؛ G0G8 ±0,5 m؛ الحسابات = رقم واحد من آخر خانة مطبوعة (بحدّ 5%).")
    return title, notes


# ═════════════════════════════ TOPIC 2 ═════════════════════════════
def topic2():
    P_EX1 = "التمرين الأول: (06 نقاط)"
    P_EX2A = "التمرين الثاني: (07 نقاط) — أولاً: دراسة الحركة الاهتزازية للنواس البسيط"
    P_EX2B = "التمرين الثاني: (07 نقاط) — ثانياً: دراسة حركة قذيفة"
    P_XA = "التمرين التجريبي: (07 نقاط) — أولا: تفاعل الكحول (B) مع شوارد البرمنغنات"
    P_XB = "التمرين التجريبي: (07 نقاط) — ثانيا: تفاعل الكحول (B) مع حمض الايثانويك"

    D1 = text_doc("d-ex1-intro", "تقديم التمرين الأول",
                  "داء الفاكيز يصيب النخاع العظمي ويُحدِث تكاثر غير طبيعي في الكريات الحمراء. لمعالجة هذا المرض يُحقن المريض بمحلول يحتوي على "
                  "نظير الفوسفور ${}^{32}_{15}P$ الذي يُدمر الكريات الحمراء الزائدة بفعل الإشعاع المُنبعث منه.\n"
                  "يهدف هذا التمرين إلى دراسة النشاط الإشعاعي لنظير الفوسفور.")
    D1D = text_doc("d-ex1-data", "المعطيات",
                   f"{DATA}\n◄ ثابت أفوغادرو $N_A=6{{,}}02\\times10^{{23}}\\,mol^{{-1}}$؛\n◄ نصف العمر $t_{{1/2}}({{}}^{{32}}_{{15}}P)=14{{,}}32\\,jours$؛\n"
                   "◄ $m({}^{32}_{15}P)=31{,}97391\\,u$؛\n◄ $m({}^{30}_{15}P)=29{,}97831\\,u$؛\n◄ كتلة البروتون $m_p=1{,}00728\\,u$؛\n"
                   "◄ كتلة النيترون $m_n=1{,}00866\\,u$؛\n◄ $1u=931{,}5\\,MeV/c^2$.")
    D1S2 = text_doc("d-ex1-s2", "نصّ السؤال 2", "اعتمادا على المخطط الممثل في الشكل 1:")
    F1 = fig("f-ex1-1", "image", "الشكل 1", "fig1", "الشكل 1 من ورقة الموضوع: مستخرج من المخطط (N–Z) فيه 30P و32P و33S وسهم من 32P نحو النواة Y",
             "الشكل 1: مستخرج من المخطط N–Z")
    D1S3 = text_doc("d-ex1-s3", "نصّ السؤال 3",
                    "في اللحظة $t=0$ يُحقن مريض بجرعة من محلول يحتوي على كمية قدرها $n_0=3{,}12\\times10^{-10}\\,mol$ من نظير الفوسفور 32.")
    D1S4 = text_doc("d-ex1-s4", "نصّ السؤال 4", "لعنصر الفوسفور نظير آخر هو ${}^{30}_{15}P$.")
    E1 = [D1, D1D]
    q("q1", "1", P_EX1, "اذكر أنواع التفككات الإشعاعية الطبيعية مع تحديد الجسيم المنبعث عن كل تفكك.", 0.75,
      [el("q1-e1", "التفكك α وجسيمه", 0.25), el("q1-e2", "التفكك β− وجسيمه", 0.25), el("q1-e3", "التفكك β+ وجسيمه", 0.25)], E1)
    q("q2", "1.2", P_EX1, "استنتج قيمة كل من العددين $A$ و $Z$ ثم أعط رمز النواة الموافقة.", 0.75,
      [el("q2-e1", "N و Z من المخطط", 0.25), el("q2-e2", "العدد A", 0.25), el("q2-e3", "رمز النواة", 0.25)], E1 + [D1S2, F1])
    q("q3", "2.2", P_EX1, "اكتب معادلة تفكك النواة ${}^{32}_{15}P$ إلى النواة ${}^{A}_{Z}Y$، محددا نوع التفكك النووي الحادث.", 0.75,
      [el("q3-e1", "شكل معادلة التفكك", 0.25), el("q3-e2", "تطبيق قانوني الانحفاظ", 0.25), el("q3-e3", "نوع الإشعاع", 0.25)], E1 + [D1S2, F1])
    q("q4", "1.3", P_EX1, "احسب عدد أنوية الفوسفور 32 المحتواة في هذه الجرعة.", 0.5,
      [el("q4-e1", "العلاقة", 0.25), el("q4-e2", "عدد الأنوية", 0.25)], E1 + [D1S3])
    q("q5", "2.3", P_EX1, "يزول مفعول الجرعة عندما تتفكك $99\\%$ من الأنوية الابتدائية، بيّن أن مفعولها يزول بعد $95\\,jours$ من لحظة الحقن.", 1.5,
      [el("q5-e1", "قانون التناقص الإشعاعي", 0.25), el("q5-e2", "عبارة الزمن بدلالة λ", 0.25), el("q5-e3", "عبارة الزمن بدلالة نصف العمر", 0.25),
       el("q5-e4", "عدد الأنوية المتبقية", 0.25), el("q5-e5", "التعويض العددي", 0.25), el("q5-e6", "الاستنتاج", 0.25)], E1 + [D1S3])
    q("q6", "1.4", P_EX1, "احسب طاقة الربط النووي $E_\\ell$ لكل من النواتين ${}^{30}_{15}P$ و ${}^{32}_{15}P$ بالـ $MeV$.", 0.75,
      [el("q6-e1", "عبارة طاقة الربط", 0.25), el("q6-e2", "طاقة ربط الفوسفور 32", 0.25), el("q6-e3", "طاقة ربط الفوسفور 30", 0.25)], E1 + [D1S4])
    q("q7", "2.4", P_EX1, "بيّن أي النواتين أكثر استقرارا مع التعليل.", 1,
      [el("q7-e1", "طاقة الربط لكل نوية للفوسفور 30", 0.25), el("q7-e2", "طاقة الربط لكل نوية للفوسفور 32", 0.25),
       el("q7-e3", "النواة الأكثر استقرارا", 0.25), el("q7-e4", "التعليل", 0.25)], E1 + [D1S4])

    mcq("q1-e1", "ما الجسيم المنبعث في التفكك $\\alpha$؟",
        ["نواة الهيليوم ${}^{4}_{2}He$", "الإلكترون ${}^{0}_{-1}e$", "البوزيتون ${}^{0}_{+1}e$", "النيترون ${}^{1}_{0}n$"],
        "التفكك $\\alpha$: هو نواة الهيليوم ${}^{4}_{2}He$.", 0.25, NUC)
    mcq("q1-e2", "ما الجسيم المنبعث في التفكك $\\beta^-$؟",
        ["جسيم له مواصفات الإلكترون ${}^{0}_{-1}e$", "البوزيتون ${}^{0}_{+1}e$", "نواة الهيليوم ${}^{4}_{2}He$", "البروتون ${}^{1}_{1}p$"],
        "التفكك $\\beta^-$: ${}^{0}_{-1}e$ جسيم له مواصفات الالكترون.", 0.25, NUC)
    mcq("q1-e3", "ما الجسيم المنبعث في التفكك $\\beta^+$؟",
        ["البوزيتون ${}^{0}_{+1}e$", "الإلكترون ${}^{0}_{-1}e$", "نواة الهيليوم ${}^{4}_{2}He$", "النيترون ${}^{1}_{0}n$"],
        "التفكك $\\beta^+$: و هو البوزيتون ${}^{0}_{+1}e$.", 0.25, NUC)
    mcq("q2-e1", "من المخطط (الشكل 1)، ما عدد النيترونات $N$ والعدد الشحني $Z$ للنواة $Y$؟",
        ["$N=16\\;;\\;Z=16$", "$N=17\\;;\\;Z=16$", "$N=16\\;;\\;Z=15$", "$N=15\\;;\\;Z=16$"], "من المخطط: $Z=16$ ، $N=16$", 0.25, NUC)
    num("q2-e2", "استنتج العدد الكتلي $A$ للنواة $Y$.", 32, 0, None, "لدينا $A=N+Z$ ومنه $A=32$", 0.25, NUC, exact=32)
    mcq("q2-e3", "ما رمز النواة الموافقة؟", ["${}^{32}_{16}S$", "${}^{33}_{16}S$", "${}^{32}_{15}P$", "${}^{16}_{32}S$"], "و منه رمز النواة ${}^{32}_{16}S$", 0.25, NUC)
    mcq("q3-e1", "نكتب معادلة التفكك على الشكل:",
        ["${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{A}_{Z}X$", "${}^{32}_{16}S\\rightarrow{}^{32}_{15}P+{}^{A}_{Z}X$",
         "${}^{32}_{15}P+{}^{A}_{Z}X\\rightarrow{}^{33}_{16}S$", "${}^{32}_{15}P\\rightarrow{}^{30}_{15}P+{}^{A}_{Z}X$"],
        "${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{A}_{Z}X$", 0.25, NUC)
    mcq("q3-e2", "بتطبيق قانوني الانحفاظ (العدد الكتلي والعدد الشحني)، ما معادلة التفكك؟",
        ["${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{0}_{-1}e$", "${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{0}_{+1}e$",
         "${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{4}_{2}He$", "${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{1}_{0}n$"],
        "بتطبيق معادلة الانحفاظ: $A=0$ و $Z=-1$ ومنه المعادلة ${}^{32}_{15}P\\rightarrow{}^{32}_{16}S+{}^{0}_{-1}e$", 0.25, NUC)
    mcq("q3-e3", "ما نوع الإشعاع الحادث؟", ["$\\beta^-$", "$\\beta^+$", "$\\alpha$", "$\\gamma$"], "نوع الإشعاع هو $\\beta^-$", 0.25, NUC)
    mcq("q4-e1", "ما العلاقة بين عدد الأنوية $N_0$ وكمية المادة $n_0$؟", ["$N_0=n_0\\cdot N_A$", "$N_0=\\frac{n_0}{N_A}$", "$N_0=\\frac{N_A}{n_0}$", "$N_0=n_0+N_A$"],
        "$N_0=n_0\\cdot N_A$", 0.25, NUC)
    num("q4-e2", "احسب عدد الأنوية $N_0$ المحتواة في الجرعة.", 1.88, 0.01, "×10¹⁴ نواة",
        "$N_0=3{,}12\\times10^{-10}\\times6{,}02\\times10^{23}=1{,}88\\times10^{14}$ noyaux", 0.25, NUC, exact=3.12e-10 * 6.02e23 / 1e14)
    mcq("q5-e1", "حسب قانون التناقص الإشعاعي $N=N_0e^{-\\lambda t}$ نكتب:",
        ["$\\frac{N}{N_0}=e^{-\\lambda t}$", "$\\frac{N}{N_0}=e^{\\lambda t}$", "$\\frac{N_0}{N}=e^{-\\lambda t}$", "$\\frac{N}{N_0}=-\\lambda t$"],
        "$N=N_0e^{-\\lambda t}\\Rightarrow\\frac{N}{N_0}=e^{-\\lambda t}$", 0.25, NUC)
    mcq("q5-e2", "ومنه عبارة الزمن $t$:",
        ["$t=\\frac{1}{\\lambda}\\ln\\frac{N_0}{N}$", "$t=\\lambda\\ln\\frac{N_0}{N}$", "$t=\\frac{1}{\\lambda}\\ln\\frac{N}{N_0}$", "$t=\\frac{1}{\\lambda}\\cdot\\frac{N_0}{N}$"],
        "$t=\\frac{1}{\\lambda}\\ln\\frac{N_0}{N}$", 0.25, NUC)
    mcq("q5-e3", "بدلالة نصف العمر $t_{1/2}$ تصبح العبارة:",
        ["$t=\\frac{t_{1/2}}{\\ln2}\\ln\\frac{N_0}{N}$", "$t=t_{1/2}\\cdot\\ln2\\cdot\\ln\\frac{N_0}{N}$", "$t=\\frac{\\ln2}{t_{1/2}}\\ln\\frac{N_0}{N}$",
         "$t=\\frac{t_{1/2}}{2}\\ln\\frac{N_0}{N}$"],
        "$t=\\frac{t_{1/2}}{\\ln2}\\ln\\frac{N_0}{N}$", 0.25, NUC)
    mcq("q5-e4", "عندما يزول مفعول الجرعة، كم يكون عدد الأنوية المتبقية $N$؟",
        ["$N=(100-99)\\%N_0=1\\%\\cdot N_0$", "$N=99\\%\\cdot N_0$", "$N=0$", "$N=\\frac{N_0}{2}$"],
        "حيث عدد الأنوية المتبقية $N=(100-99)\\%N_0=1\\%\\cdot N_0$", 0.25, NUC)
    mcq("q5-e5", "بالتعويض العددي تصبح عبارة الزمن:",
        ["$t=\\frac{14{,}32}{\\ln2}\\ln100$", "$t=\\frac{14{,}32}{\\ln2}\\ln99$", "$t=14{,}32\\cdot\\ln2\\cdot\\ln100$", "$t=\\frac{\\ln2}{14{,}32}\\ln100$"],
        "$t=\\frac{14{,}32}{\\ln2}\\ln100=95\\,jours\\quad\\left(\\frac{N_0}{N}=100\\right)$", 0.25, NUC)
    mcq("q5-e6", "لماذا نقول إنّ مفعول الجرعة يزول بعد 95 يومًا من لحظة الحقن؟",
        ["لأنّه بعد 95 يومًا لا يتبقّى إلا $1\\%$ من الأنوية الابتدائية", "لأنّ كل الأنوية تكون قد تفكّكت تمامًا بعد 95 يومًا",
         "لأنّ 95 يومًا تساوي نصف عمر الفوسفور 32", "لأنّ عدد الأنوية يتضاعف بعد 95 يومًا"],
        "وعليه فإن بعد 95 يوما يزول مفعول الجرعة.", 0.25, NUC)
    mcq("q6-e1", "ما عبارة طاقة الربط النووي $E_\\ell$ لنواة ${}^{A}_{Z}X$؟",
        ["$E_\\ell=[Z\\cdot m_p+(A-Z)\\cdot m_n-m_X]\\cdot c^2$", "$E_\\ell=[m_X-Z\\cdot m_p-(A-Z)\\cdot m_n]\\cdot c^2$",
         "$E_\\ell=[Z\\cdot m_n+(A-Z)\\cdot m_p-m_X]\\cdot c^2$", "$E_\\ell=[A\\cdot m_p-m_X]\\cdot c^2$"],
        "$E_\\ell=[Z\\cdot m_p+(A-Z)\\cdot m_n-m_X]\\cdot c^2$", 0.25, NUC)
    num("q6-e2", "احسب طاقة الربط $E_\\ell({}^{32}_{15}P)$ (قرّب إلى $10^{-3}$).", 263.158, 0.001, "MeV",
        "$E_\\ell({}^{32}_{15}P)=[15\\times1{,}00728+17\\times1{,}00866-31{,}97391]\\times931{,}5=263{,}158\\,MeV$", 0.25, NUC,
        exact=(15 * 1.00728 + 17 * 1.00866 - 31.97391) * 931.5)
    num("q6-e3", "احسب طاقة الربط $E_\\ell({}^{30}_{15}P)$ (قرّب إلى $10^{-3}$).", 242.926, 0.001, "MeV",
        "$E_\\ell({}^{30}_{15}P)=[15\\times1{,}00728+15\\times1{,}00866-29{,}97831]\\times931{,}5=242{,}926\\,MeV$", 0.25, NUC,
        exact=(15 * 1.00728 + 15 * 1.00866 - 29.97831) * 931.5)
    num("q7-e1", "احسب طاقة الربط لكل نوية $\\frac{E_\\ell}{A}$ للنواة ${}^{30}_{15}P$ (قرّب إلى $10^{-3}$).", 8.097, 0.001, "MeV/nuc",
        "$\\frac{E_\\ell}{A}({}^{30}_{15}P)=\\frac{242{,}926}{30}=8{,}097\\,MeV/nuc$", 0.25, NUC, exact=242.926 / 30)
    num("q7-e2", "احسب طاقة الربط لكل نوية $\\frac{E_\\ell}{A}$ للنواة ${}^{32}_{15}P$ (قرّب إلى $10^{-3}$).", 8.224, 0.001, "MeV/nuc",
        "$\\frac{E_\\ell}{A}({}^{32}_{15}P)=\\frac{263{,}158}{32}=8{,}224\\,MeV/nuc$", 0.25, NUC, exact=263.158 / 32)
    mcq("q7-e3", "أيّ النواتين أكثر استقرارًا؟", ["${}^{32}_{15}P$", "${}^{30}_{15}P$", "لهما نفس الاستقرار"], "النواة الأكثر استقرارا هي ${}^{32}_{15}P$", 0.25, NUC)
    mcq("q7-e4", "ما التعليل؟",
        ["لأنّ طاقة الربط لكل نوية للنواة ${}^{32}_{15}P$ أكبر من طاقة الربط لكل نوية للنواة ${}^{30}_{15}P$", "لأنّ طاقة الربط لكل نوية للنواة ${}^{32}_{15}P$ أصغر من طاقة الربط لكل نوية للنواة ${}^{30}_{15}P$",
         "لأنّ طاقة الربط الكلّية للفوسفور 32 أكبر", "لأنّ كتلة الفوسفور 32 أكبر"],
        "التعليل: $\\frac{E_\\ell}{A}({}^{32}_{15}P)>\\frac{E_\\ell}{A}({}^{30}_{15}P)$ — المقارنة تكون بطاقة الربط لكل نوية.", 0.25, NUC)

    # ── التمرين الثاني ──
    D2 = text_doc("d-ex2-intro", "تقديم التمرين الثاني",
                  "في حياتنا اليومية، أمثلة كثيرة عن النواس الثقلي مثل: الأرجوحة، رقاص ساعة حائط، ثُريّة...\n"
                  "يُعتبر العالم الفيزيائي والفلكي الإيطالي غاليلو غاليلي، أوّل من استوحَى فكرة دراسة النواس الثقلي عندما شاهد الثُريّة "
                  "المعلّقة في سقف قاعة الحفلات وهي تهتز بعد أن حرّكتها التيّارات الهوائية.")
    D2D = text_doc("d-ex2-data", "المعطيات", f"{DATA}\n◄ شدة تسارع حقل الجاذبية الأرضية $g=9{{,}}8\\,m\\cdot s^{{-2}}$؛\n◄ نهمل تأثير الهواء.")
    D2A = text_doc("d-ex2-a", "نصّ الجزء أولاً",
                   "أولاً: دراسة الحركة الاهتزازية للنواس البسيط\n"
                   "يُعتبر النواس البسيط نموذجا مثاليا للنواس الثقلي ويتألف من خيط مهمل الكتلة وعديم الامتطاط طوله $\\ell$ مثبت من إحدى نهايتيه "
                   "بنقطة $O'$ ومعلق بنهايته الحرة كريّة كتلتها $m$ مهملة الأبعاد بالنسبة لطول الخيط (جسم نقطي) الشكل 2.\n"
                   "نُزيح النواس في المستوي الشاقولي عن وضع توازنه المستقر $O$ بزاوية $\\theta_0=8^{\\circ}$ في جهة نعتبرها موجبة، ثم نتركه لحاله من "
                   "النقطة $A$ دون سرعة ابتدائية في اللحظة $t=0$، فيُنجز اهتزازات حرّة حول محور أفقي مار بالنقطة $O'$ ونقيس بواسطة ميقاتية زمن "
                   "10 اهتزازات كاملة فنجده $t=14\\,s$.")
    F2 = fig("f-ex2-2", "image", "الشكل 2", "fig2", "الشكل 2 من ورقة الموضوع: النواس البسيط (O′، A، θ0)، وضع التوازن O، المعلم (Ox، Oy)، الارتفاع h وسطح الأرض والنقطة E",
             "الشكل 2: النواس والمعلم")
    D2B = text_doc("d-ex2-b", "نصّ الجزء ثانياً",
                   "ثانياً: دراسة حركة قذيفة\n"
                   "عند مرور الكرية بوضع التوازن $O$ في الاتجاه الموجب بالسرعة $v_0=0{,}3\\,m\\cdot s^{-1}$ ينقطع الخيط فتتحرر الكريّة في الهواء "
                   "لتصطدم بسطح الأرض الذي يبعد عن المستوي الأفقي المار بنقطة التعليق $O'$ بارتفاع $h=1{,}5\\,m$.")
    E2A = [D2, D2D, D2A, F2]
    E2B = [D2, D2D, D2A, F2, D2B]
    q("q8", "1", P_EX2A, "عرّف دور النواس البسيط.", 0.25, [el("q8-e1", "تعريف الدور", 0.25)], E2A)
    q("q9", "2", P_EX2A, "احسب قيمة الدور الذاتي $T_0$ للنواس البسيط.", 0.25, [el("q9-e1", "قيمة الدور الذاتي", 0.25)], E2A)
    q("q10", "3", P_EX2A, "نقترح أربع عبارات للدور الذاتي للنواس البسيط، اختر العبارة الصحيحة ثم علل إجابتك باستعمال التحليل البُعدي.\n"
      "(1) $T_0=2\\pi\\cdot\\sqrt{\\frac{g}{\\ell}}$ ؛ (2) $T_0=2\\pi\\cdot\\sqrt{\\frac{\\ell}{g}}$ ؛ (3) $T_0=2\\pi\\cdot\\sqrt{\\frac{\\theta_0}{g}}$ ؛ (4) $T_0=2\\pi\\cdot\\sqrt{\\frac{m}{\\ell}}$",
      0.75, [el("q10-e1", "بُعد الدور", 0.25), el("q10-e2", "التحليل البُعدي", 0.25), el("q10-e3", "العبارة الصحيحة والتجانس", 0.25)], E2A)
    q("q11", "4", P_EX2A, "احسب طول النواس البسيط$(\\ell)$.", 0.5, [el("q11-e1", "عبارة الطول", 0.25), el("q11-e2", "قيمة الطول", 0.25)], E2A)
    q("q12", "5", P_EX2A, "ضع الإشارة (✓) أمام العبارة الصحيحة والاشارة (×) أمام العبارة الخاطئة لما يلي:\n"
      "– الدور لا يتعلق بالكتلة $m$ ..........☐\n– الدور يتناسب طردا مع $\\sqrt{\\ell}$ .........☐\n"
      "– الدور يتناسب طردا مع $\\sqrt{g}$ .........☐\n– الدور يتعلق بالسعات الصغيرة $\\theta_0$ ....☐", 1,
      [el("q12-e1", "الدور والكتلة", 0.25), el("q12-e2", "الدور وجذر الطول", 0.25), el("q12-e3", "الدور وجذر الجاذبية", 0.25),
       el("q12-e4", "الدور والسعات الصغيرة", 0.25)], E2A)
    q("q13", "1", P_EX2B, "جِد، بتطبيق القانون الثاني لنيوتن المعادلتين الزمنيّتين للحركة $x(t)$ و $y(t)$ في المعلم $(Ox,Oy)$. الشكل 2.", 2,
      [el("q13-e1", "الجملة المدروسة", 0.25), el("q13-e2", "المرجع", 0.25), el("q13-e3", "تمثيل القوى", 0.25), el("q13-e4", "القانون الثاني لنيوتن", 0.25),
       el("q13-e5", "المعادلات على المحور Ox", 0.5), el("q13-e6", "المعادلات على المحور Oy", 0.5)], E2B)
    q("q14", "2", P_EX2B, "استنتج معادلة المسار وحدّد احداثيي نقطة الاصطدام $E$ بسطح الأرض.", 1,
      [el("q14-e1", "معادلة المسار", 0.25), el("q14-e2", "ترتيب نقطة الاصطدام", 0.25), el("q14-e3", "لحظة الاصطدام", 0.25),
       el("q14-e4", "فاصلة نقطة الاصطدام", 0.25)], E2B)
    q("q15", "3", P_EX2B, "عيّن خصائص شعاع سرعة مركز عطالة الكرية $G$ عند الموضع $E$.", 1.25,
      [el("q15-e1", "علاقة زاوية الاتجاه", 0.25), el("q15-e2", "مركبتا السرعة (2×0.25)", 0.5), el("q15-e3", "طويلة السرعة", 0.25),
       el("q15-e4", "المبدأ والحامل (الشكل)", 0.25)], E2B)

    mcq("q8-e1", "ما دور النواس البسيط؟", ["زمن اهتزازة كاملة", "زمن نصف اهتزازة", "عدد الاهتزازات في الثانية الواحدة", "المدة الكلية للاهتزازات العشر"],
        "دور النواس البسيط: زمن اهتزازة كاملة (تُقبل صيغ أخرى للتعبير عن الدور).", 0.25, WAV)
    num("q9-e1", "احسب قيمة الدور الذاتي $T_0$.", 1.4, 0.07, "s", "$T_0=\\frac{t}{10}=1{,}4\\,s$", 0.25, WAV, exact=14 / 10)
    mcq("q10-e1", "بالتحليل البُعدي للعبارة (2)، بُعد الدور $[T_0]$ يساوي:",
        ["$\\left[\\frac{\\ell}{g}\\right]^{1/2}$", "$\\left[\\frac{g}{\\ell}\\right]^{1/2}$", "$[\\ell]\\cdot[g]$", "$\\left[\\frac{\\ell}{g}\\right]^{2}$"],
        "$[T_0]=\\left[\\frac{l}{g}\\right]^{1/2}=\\frac{[l]^{1/2}}{[g]^{1/2}}=\\frac{L^{1/2}\\cdot T}{L^{1/2}}=T$", 0.25, WAV)
    mcq("q10-e2", "علمًا أنّ $[\\ell]=L$ و $[g]=L\\cdot T^{-2}$، فإنّ $\\frac{[\\ell]^{1/2}}{[g]^{1/2}}$ يساوي:",
        ["$\\frac{L^{1/2}\\cdot T}{L^{1/2}}=T$", "$\\frac{L^{1/2}}{L^{1/2}\\cdot T}=T^{-1}$", "$L^{1/2}$", "$L\\cdot T^{2}$"],
        "$\\frac{[l]^{1/2}}{[g]^{1/2}}=\\frac{L^{1/2}\\cdot T}{L^{1/2}}=T$", 0.25, WAV)
    mcq("q10-e3", "ما العبارة الصحيحة للدور الذاتي؟",
        ["العبارة (2) لأنّ لها نفس بعد الزمن فهي متجانسة", "العبارة (1) لأنّ لها نفس بعد الزمن فهي متجانسة",
         "العبارة (3) لأنّ الدور يتعلق بالسعة", "العبارة (4) لأنّ الدور يتعلق بالكتلة"],
        "اختيار العبارة الصحيحة: $T_0=2\\pi\\sqrt{\\frac{\\ell}{g}}$ (أو إلغاء الخاطئة منها)، بما أنّ للدور $T_0$ نفس بعد الزمن فهو متجانس.", 0.25, WAV)
    mcq("q11-e1", "من العبارة الصحيحة للدور، ما عبارة طول النواس $\\ell$؟",
        ["$\\ell=\\frac{T_0^2\\cdot g}{4\\pi^2}$", "$\\ell=\\frac{4\\pi^2\\cdot g}{T_0^2}$", "$\\ell=\\frac{T_0\\cdot g}{2\\pi}$", "$\\ell=\\frac{T_0^2}{4\\pi^2\\cdot g}$"],
        "$\\ell=\\frac{T_0^2\\cdot g}{4\\pi^2}$", 0.25, WAV)
    num("q11-e2", "احسب طول النواس $\\ell$.", 0.5, 0.025, "m", "$\\ell=\\frac{T_0^2\\cdot g}{4\\pi^2}\\approx0{,}5\\,m$", 0.25, WAV,
        exact=1.4 ** 2 * 9.8 / (4 * math.pi ** 2))
    tf("q12-e1", "الدور لا يتعلق بالكتلة $m$", True, "صحيحة (✓): الدور لا يتعلق بالكتلة $m$.", 0.25, WAV)
    tf("q12-e2", "الدور يتناسب طردا مع $\\sqrt{\\ell}$", True, "صحيحة (✓): الدور يتناسب طردا مع $\\sqrt{\\ell}$.", 0.25, WAV)
    tf("q12-e3", "الدور يتناسب طردا مع $\\sqrt{g}$", False, "خاطئة (×): الدور لا يتناسب طردا مع $\\sqrt{g}$.", 0.25, WAV)
    tf("q12-e4", "الدور يتعلق بالسعات الصغيرة $\\theta_0$", False, "خاطئة (×): الدور لا يتعلق بالسعات الصغيرة $\\theta_0$.", 0.25, WAV)
    mcq("q13-e1", "ما الجملة المدروسة بعد انقطاع الخيط؟", ["الكرية", "الخيط", "الكرية والخيط معًا", "نقطة التعليق"], "الجملة المدروسة: الكرية.", 0.25, MCH)
    mcq("q13-e2", "ما المرجع المناسب لدراسة حركة الكرية؟",
        ["السطحي الأرضي المعتبر غاليليًّا", "مرجع مرتبط بالكرية", "مرجع مرتبط بالخيط المنقطع", "مرجع متسارع بالنسبة للأرض"],
        "المرجع المناسب: السطحي الأرضي المعتبر غاليليا.", 0.25, MCH)
    mcq("q13-e3", "بإهمال تأثير الهواء، ما القوى المطبقة على الكرية بعد انقطاع الخيط؟",
        ["ثقلها $\\vec{p}$ فقط، شاقولي نحو الأسفل", "ثقلها $\\vec{p}$ وتوتر الخيط", "ثقلها $\\vec{p}$ ودافعة أرخميدس", "قوة في جهة الحركة فقط"],
        "تمثيل القوى: الثقل $\\vec{p}$ وحده (كما في رسم الإجابة النموذجية).", 0.25, MCH)
    mcq("q13-e4", "بتطبيق القانون الثاني لنيوتن على الكرية:",
        ["$\\sum\\vec{F}_{ext}=m\\vec{a}_G\\Rightarrow\\vec{p}=m\\vec{a}_G$", "$\\sum\\vec{F}_{ext}=\\vec{0}\\Rightarrow\\vec{p}=\\vec{0}$",
         "$\\sum\\vec{F}_{ext}=m\\vec{v}_G\\Rightarrow\\vec{p}=m\\vec{v}_G$", "$\\sum\\vec{F}_{ext}=m\\vec{a}_G\\Rightarrow\\vec{a}_G=\\vec{0}$"],
        "$\\sum\\vec{F}_{ext}=m\\vec{a}_G\\Rightarrow\\vec{p}=m\\vec{a}_G$", 0.25, MCH)
    XEQ = "$(Ox):\\;a_x=0\\;;\\;v_x=v_0\\;;\\;x=v_0\\cdot t$"
    YEQ = "$(Oy):\\;a_y=g\\;;\\;v_y=g\\cdot t\\;;\\;y=\\frac{1}{2}g\\cdot t^2$"
    mcq("q13-e5", "بالإسقاط على المحور $(Ox)$:",
        ["$a_x=0\\;;\\;v_x=v_0$", "$a_x=g\\;;\\;v_x=g\\cdot t$", "$a_x=0\\;;\\;v_x=0$", "$a_x=-g\\;;\\;v_x=v_0-g\\cdot t$"], XEQ, 0.25, MCH)
    mcq("q13-e5", "المعادلة الزمنية $x(t)$:", ["$x=v_0\\cdot t$", "$x=\\frac{1}{2}g\\cdot t^2$", "$x=v_0\\cdot t+\\frac{1}{2}g\\cdot t^2$", "$x=v_0$"], XEQ, 0.25, MCH)
    mcq("q13-e6", "بالإسقاط على المحور $(Oy)$ الموجّه نحو الأسفل (الشكل 2):",
        ["$a_y=g\\;;\\;v_y=g\\cdot t$", "$a_y=-g\\;;\\;v_y=-g\\cdot t$", "$a_y=0\\;;\\;v_y=v_0$", "$a_y=g\\;;\\;v_y=v_0+g\\cdot t$"], YEQ, 0.25, MCH)
    mcq("q13-e6", "المعادلة الزمنية $y(t)$:",
        ["$y=\\frac{1}{2}g\\cdot t^2$", "$y=-\\frac{1}{2}g\\cdot t^2$", "$y=v_0\\cdot t+\\frac{1}{2}g\\cdot t^2$", "$y=g\\cdot t^2$"], YEQ, 0.25, MCH)
    mcq("q14-e1", "بحذف الزمن بين المعادلتين الزمنيتين، ما معادلة المسار؟",
        ["$y=\\frac{g}{2v_0^2}\\cdot x^2$", "$y=\\frac{2v_0^2}{g}\\cdot x^2$", "$y=\\frac{g}{2v_0}\\cdot x$", "$y=\\frac{g}{v_0^2}\\cdot x^2$"],
        "معادلة المسار: $y=\\frac{g}{2v_0^2}x^2$", 0.25, MCH)
    E_EXPL = ("احداثيي نقطة الاصطدام بسطح الأرض: $y=h-\\ell=1\\,m$؛ $y=\\frac{1}{2}g\\,t^2\\rightarrow t=\\sqrt{\\frac{2y}{g}}\\approx0{,}45\\,s$؛ "
              "$x=v_0\\,t\\approx0{,}14\\,m$ ومنه $E(0{,}14\\,m\\,;\\,1\\,m)$ (ملاحظة الإجابة النموذجية: يمكن استعمال معادلة المسار).")
    num("q14-e2", "ما ترتيب نقطة الاصطدام $y_E$ في المعلم $(Ox,Oy)$؟", 1, 0.05, "m", E_EXPL, 0.25, MCH, exact=1.5 - 1.4 ** 2 * 9.8 / (4 * math.pi ** 2))
    num("q14-e3", "احسب لحظة الاصطدام $t$ انطلاقًا من $y=\\frac{1}{2}g\\,t^2$.", 0.45, 0.01, "s", E_EXPL, 0.25, MCH, exact=math.sqrt(2 * 1 / 9.8))
    num("q14-e4", "احسب فاصلة نقطة الاصطدام $x_E$.", 0.14, 0.007, "m", E_EXPL, 0.25, MCH, exact=0.3 * math.sqrt(2 / 9.8))
    VE_EXPL = ("$v_{xE}=v_0=0{,}3\\,m\\cdot s^{-1}\\;;\\;v_{yE}=g\\cdot t=9{,}80\\times0{,}45\\approx4{,}4\\,m\\cdot s^{-1}\\;;\\;\\alpha\\approx86^{\\circ}$ ; "
               "$v_E=\\sqrt{v_{xE}^2+v_{yE}^2}=\\sqrt{0{,}3^2+4{,}4^2}\\approx4{,}4\\,m\\cdot s^{-1}$")
    mcq("q15-e1", "لتحديد اتجاه شعاع السرعة $\\vec{v}_E$ نحسب الزاوية $\\alpha$ التي يصنعها مع المحور الأفقي $(Ox)$ بالعلاقة:",
        ["$\\tan\\alpha=\\frac{v_{yE}}{v_{xE}}$", "$\\tan\\alpha=\\frac{v_{xE}}{v_{yE}}$", "$\\sin\\alpha=\\frac{v_{xE}}{v_E}$", "$\\tan\\alpha=v_{xE}\\cdot v_{yE}$"],
        "الاتجاه: يجب تحديد الزاوية التي يصنعها الشعاع $\\vec{v}_E$ مع المحور الأفقي $(Ox)$: $\\tan\\alpha=\\frac{v_{yE}}{v_{xE}}$ ومنه $\\alpha\\approx86^{\\circ}$", 0.25, MCH)
    num("q15-e2", "احسب المركبة الأفقية للسرعة $v_{xE}$.", 0.3, 0.01, "m·s⁻¹", VE_EXPL, 0.25, MCH, exact=0.3)
    num("q15-e2", "احسب المركبة الشاقولية للسرعة $v_{yE}$.", 4.4, 0.1, "m·s⁻¹", VE_EXPL, 0.25, MCH, exact=9.8 * math.sqrt(2 / 9.8))
    num("q15-e3", "احسب طويلة شعاع السرعة $v_E$.", 4.4, 0.1, "m·s⁻¹", "الطويلة $v_E=\\sqrt{v_{xE}^2+v_{yE}^2}=\\sqrt{0{,}3^2+4{,}4^2}\\approx4{,}4\\,m\\cdot s^{-1}$، ويمكن أيضًا استعمال مبدأ انحفاظ الطاقة.", 0.25, MCH, exact=math.hypot(0.3, 9.8 * math.sqrt(2 / 9.8)))
    mcq("q15-e4", "ما مبدأ شعاع السرعة $\\vec{v}_E$ وما حامله؟",
        ["المبدأ: موضع السقوط $E$، والحامل: مستقيم مماس للمسار في الموضع $E$", "المبدأ: وضع التوازن $O$، والحامل: المحور الأفقي $(Ox)$",
         "المبدأ: موضع السقوط $E$، والحامل: المحور الأفقي $(Ox)$", "المبدأ: نقطة التعليق $O'$، والحامل: الخيط"],
        "المبدأ: موضع السقوط $E$؛ الحامل: مستقيم مماس للمسار في الموضع $E$ (يُمثَّل الشعاع على الشكل).", 0.25, MCH)

    # ── التمرين التجريبي ──
    DX = text_doc("d-x-intro", "تقديم التمرين التجريبي",
                  "تُصنّف التحولات الكيميائية إلى تامة وغير تامة.\nنقترح في هذا التمرين دراسة تحولين أحدهما تام والآخر غير تام.")
    DXA = text_doc("d-x-a", "نصّ الجزء أولا",
                   "أولا: دراسة تفاعل الكحول $(B)$ ذي الصيغة المجملة $C_3H_8O$ مع شوارد البرمنغنات $MnO_4^-$\n"
                   f"{DATA}\n◄ الكتلة المولية الجزيئية للكحول $(B)$ $M(B)=60\\,g\\cdot mol^{{-1}}$.\n"
                   "نضع في إيرلينة ماير موضوعة فوق مخلاط مغناطيسي حجما $V_0=50\\,mL$ من محلول برمنغنات البوتاسيوم $(K^+(aq)+MnO_4^-(aq))$ "
                   "تركيزه المولي $c_0=0{,}1\\,mol\\cdot L^{-1}$، المحمّض بحمض الكبريت المركّز.\n"
                   "في اللحظة $t=0$ نضيف للمزيج كتلة قدرها $m=3{,}75\\,g$ من الكحول $(B)$ ذي الصيغة الجزيئية المجملة $C_3H_8O$، حيث يصبح حجم الوسط "
                   "التفاعلي $V_T=60\\,mL$. التحوّل الكيميائي الحادث بطيء، نُنمذِجه بالمعادلة الكيميائية:\n"
                   "$5C_3H_8O(l)+2MnO_4^-(aq)+6H^+(aq)=5C_3H_6O(l)+2Mn^{2+}(aq)+8H_2O(l)$")
    DXA5 = text_doc("d-x-a5", "نصّ السؤال 5", "المتابعة الزّمنية لتطور كمّية مادة الكحول $(B)$، مكّنتنا من رسم المنحنى البيّاني الممثّل بالشكل 3.")
    F3 = fig("f-x-3", "graph", "الشكل 3", "fig3", "الشكل 3 من ورقة الموضوع: منحنى كمية مادة الكحول n_B (mmol) بدلالة الزمن t (min) مع مستقيم منقّط عند المبدأ",
             "الشكل 3: n_B بدلالة t")
    DXB = text_doc("d-x-b", "نصّ الجزء ثانيا",
                   "ثانيا: دراسة تفاعل الكحول $(B)$ مع حمض الايثانويك $(CH_3COOH)$.\n"
                   "لتحديد صِنف الكحول $(B)$، نجري تفاعل أسترة لمزيج ابتدائي متساوي المولات($50\\,mmol$ من الكحول $(B)$ و $50\\,mmol$ من حمض "
                   "الايثانويك $(A)$) مع إضافة قطرات من حمض الكبريت المركّز.\nنُسخِّن المزيج بالارتداد لمدة ساعة.")
    DXB4 = text_doc("d-x-b4", "نصّ السؤال 4", "المنحنى البياني الممثّل بالشكل 4 يُمثِّل تطور كمّية مادة الكحول $(B)$ بدلالة الزمن:")
    F4 = fig("f-x-4", "graph", "الشكل 4", "fig4", "الشكل 4 من ورقة الموضوع: منحنى كمية مادة الكحول n_B (mmol) بدلالة الزمن t (min) في تفاعل الأسترة",
             "الشكل 4: n_B بدلالة t")
    XA = [DX, DXA]
    XB = [DX, DXB]
    q("q16", "1", P_XA, "عرّف كل من المُؤكسِد والمُرجِع.", 0.5, [el("q16-e1", "تعريف المؤكسد", 0.25), el("q16-e2", "تعريف المرجع", 0.25)], XA)
    q("q17", "2", P_XA, "بيّن أنّ التفاعل الحادث هو تفاعل أكسدة–إرجاع، ثم اكتب الثنائيتين $Ox/Red$ المشاركتين في التفاعل.", 1,
      [el("q17-e1", "المعادلة النصفية للأكسدة", 0.25), el("q17-e2", "ثنائية الكحول", 0.25), el("q17-e3", "المعادلة النصفية للإرجاع", 0.25),
       el("q17-e4", "ثنائية المنغنيز", 0.25)], XA)
    q("q18", "3", P_XA, "وضّح دور حمض الكبريت المركّز في هذا التفاعل.", 0.25, [el("q18-e1", "دور حمض الكبريت", 0.25)], XA)
    q("q19", "4", P_XA, "أنشئ جدولاً لتقدّم التفاعل واحسب قيمة التقدّم الأعظمي $x_{\\max}$.", 0.75,
      [el("q19-e1", "جدول التقدم", 0.5), el("q19-e2", "التقدم الأعظمي", 0.25)], XA)
    q("q20", "1.5", P_XA, "حدّد قيمة التقدّم النهائي $x_f$ ثمّ أثبت أنّ هذا التفاعل تام.", 0.5,
      [el("q20-e1", "التقدم النهائي", 0.25), el("q20-e2", "التفاعل تام", 0.25)], XA + [DXA5, F3])
    q("q21", "2.5", P_XA, "عرّف زمن نصف التفاعل $t_{1/2}$ ثمّ حدّد بيانياً قيمته.", 0.5,
      [el("q21-e1", "تعريف زمن نصف التفاعل", 0.25), el("q21-e2", "قيمة زمن نصف التفاعل", 0.25)], XA + [DXA5, F3])
    q("q22", "3.5", P_XA, "احسب السرعة الحجمية لاختفاء الكحول $(B)$ في اللحظة $t=0$.", 0.5,
      [el("q22-e1", "عبارة السرعة الحجمية", 0.25), el("q22-e2", "قيمة السرعة الحجمية", 0.25)], XA + [DXA5, F3])
    q("q23", "1", P_XB, "وضِّح دور حمض الكبريت المركّز في هذا التفاعل.", 0.25, [el("q23-e1", "دور حمض الكبريت", 0.25)], XB)
    q("q24", "2", P_XB, "اكتب معادلة التفاعل الحادث.", 0.25, [el("q24-e1", "معادلة التفاعل", 0.25)], XB)
    q("q25", "3", P_XB, "أنشئ جدولاً لتقدّم التفاعل واحسب قيمة التقدّم الأعظمي $x_{max}$.", 0.75,
      [el("q25-e1", "جدول التقدم", 0.5), el("q25-e2", "التقدم الأعظمي", 0.25)], XB)
    q("q26", "1.4", P_XB, "اكتب بروتوكولا تجريبيا توضح فيه كيفية الحصول على المنحنى البياني الشكل 4.", 0.5,
      [el("q26-e1", "أخذ أنبوب وتبريده", 0.25), el("q26-e2", "معايرة الحمض المتبقي", 0.25)], XB + [DXB4, F4])
    q("q27", "2.4", P_XB, "حدّد قيمة التقدّم النهائي $x_f$ وأثبت أنّ هذا التفاعل غير تام.", 0.5,
      [el("q27-e1", "التقدم النهائي", 0.25), el("q27-e2", "التفاعل غير تام", 0.25)], XB + [DXB4, F4])
    q("q28", "3.4", P_XB, "احسب مردود التفاعل واستنتج صِنف الكحول $(B)$.", 0.5,
      [el("q28-e1", "مردود التفاعل", 0.25), el("q28-e2", "صنف الكحول", 0.25)], XB + [DXB4, F4])
    q("q29", "5", P_XB, "دعّم هذه الجملة بالتفسير أكثر «يمكن الحصول على الإستر السابق بتفاعل آخر تام، سريع وناشر للحرارة».", 0.25,
      [el("q29-e1", "التفاعل التام", 0.25)], XB)

    mcq("q16-e1", "ما المُؤكسِد؟", ["هو كل فرد كيميائي يكتسب الكترون أو أكثر خلال تحول كيميائي", "هو كل فرد كيميائي يفقد الكترون أو أكثر خلال تحول كيميائي",
                                  "هو كل فرد كيميائي يكتسب بروتون أو أكثر خلال تحول كيميائي", "هو كل فرد كيميائي يفقد بروتون أو أكثر خلال تحول كيميائي"],
        "المؤكسد: هو كل فرد كيميائي يكتسب الكترون أو أكثر خلال تحول كيميائي.", 0.25, KIN)
    mcq("q16-e2", "ما المُرجِع؟", ["هو كل فرد كيميائي يفقد الكترون أو أكثر خلال تحول كيميائي", "هو كل فرد كيميائي يكتسب الكترون أو أكثر خلال تحول كيميائي",
                                 "هو كل فرد كيميائي يفقد بروتون أو أكثر خلال تحول كيميائي", "هو كل فرد كيميائي يكتسب بروتون أو أكثر خلال تحول كيميائي"],
        "المرجع: هو كل فرد كيميائي يفقد الكترون أو أكثر خلال تحول كيميائي.", 0.25, KIN)
    REDOX = ("م.ن للأكسدة: $C_3H_8O=C_3H_6O+2H^++2e^-$ والثنائية $C_3H_6O/C_3H_8O$ ؛ م.ن للإرجاع: $MnO_4^-+8H^++5e^-=Mn^{2+}(aq)+4H_2O(l)$ "
             "والثنائية $MnO_4^-/Mn^{2+}$. التفاعل الحادث تفاعل أكسدة إرجاع لأن هناك انتقال في الإلكترونات.")
    mcq("q17-e1", "ما المعادلة النصفية للأكسدة؟",
        ["$C_3H_8O=C_3H_6O+2H^++2e^-$", "$C_3H_8O+2H^++2e^-=C_3H_6O$", "$C_3H_8O=C_3H_6O+H^++e^-$", "$C_3H_6O=C_3H_8O+2H^++2e^-$"], REDOX, 0.25, KIN)
    mcq("q17-e2", "ما ثنائية الكحول $Ox/Red$ المشاركة في التفاعل؟", ["$C_3H_6O/C_3H_8O$", "$C_3H_8O/C_3H_6O$", "$H^+/C_3H_8O$", "$C_3H_6O/H_2O$"],
        REDOX, 0.25, KIN)
    mcq("q17-e3", "ما المعادلة النصفية للإرجاع؟",
        ["$MnO_4^-+8H^++5e^-=Mn^{2+}(aq)+4H_2O(l)$", "$MnO_4^-+8H^+=Mn^{2+}(aq)+4H_2O(l)+5e^-$", "$MnO_4^-+4H^++5e^-=Mn^{2+}(aq)+4H_2O(l)$",
         "$MnO_4^-+8H^++3e^-=Mn^{2+}(aq)+4H_2O(l)$"], REDOX, 0.25, KIN)
    mcq("q17-e4", "ما ثنائية المنغنيز $Ox/Red$ المشاركة في التفاعل؟", ["$MnO_4^-/Mn^{2+}$", "$Mn^{2+}/MnO_4^-$", "$MnO_4^-/H_2O$", "$H^+/Mn^{2+}$"],
        REDOX, 0.25, KIN)
    mcq("q18-e1", "ما دور حمض الكبريت المركّز في هذا التفاعل؟",
        ["توفير شوارد $H_3O^+$ اللازمة للتفاعل، ولا يُعتبر وسيطًا لأنّ هذه الشوارد تشارك في التفاعل", "وسيط يسرّع التفاعل دون أن يشارك فيه",
         "مؤكسد للكحول $(B)$", "إيقاف التفاعل في لحظة معيّنة"],
        "دور حمض الكبريت المركز هو توفير شوارد $H_3O^+$ اللازمة للتفاعل ولا يُعتبر وسيطا لأن $H_3O^+$ تشارك في التفاعل.", 0.25, KIN)
    TABLE1 = [["حالة الجملة", "التقدم", "5C3H8O(l)", "2MnO4⁻(aq)", "6H⁺(aq)", "5C3H6O(l)", "2Mn²⁺(aq)", "8H2O(l)"],
              ["ح. إ", "x=0", "62,5", "5", "بزيادة", "0", "0", "بزيادة"],
              ["ح. و", "x(t)", "62,5−5x(t)", "5−2x(t)", "بزيادة", "5x(t)", "2x(t)", "بزيادة"],
              ["ح. ن", "xf", "62,5−5xf", "5−2xf", "بزيادة", "5xf", "2xf", "بزيادة"]]
    deferred("q19-e1", "table_fill", "جدول تقدّم تفاعل الكحول (B) مع شوارد البرمنغنات (بالـ mmol)",
             {"columns": TABLE1[0], "rows": ["ح. إ", "ح. و", "ح. ن"], "unit": "mmol", "criterion": "جدول التقدم (0.5)"},
             {"model": TABLE1, "rubric": "0.5 — يكفي ملء الحالة ح. إ وإحدى الحالات الأخرى"},
             "جدول التقدم كما في الإجابة النموذجية (يكفي ملء الحالة الابتدائية وإحدى الحالات الأخرى).", 0.5, KIN)
    num("q19-e2", "احسب قيمة التقدّم الأعظمي $x_{max}$.", 2.5, 0.1, "mmol",
        "$62{,}5-5x_{max}=0\\rightarrow x_{max}=12{,}5\\,mmol\\;;\\;5-2x_{max}=0\\rightarrow x_{max}=2{,}5\\,mmol\\;\\Rightarrow\\;x_{max}=2{,}5\\,mmol$", 0.25, KIN,
        exact=min(62.5 / 5, 5 / 2))
    num("q20-e1", "من جدول التقدّم $n_f(B)=n_0(B)-5x_f$ ومن المنحنى (الشكل 3)، احسب التقدّم النهائي $x_f$.", 2.5, 0.1, "mmol",
        "من جدول التقدم لدينا: $n_f(B)=n_0(B)-5x_f$ ومن المنحنى لدينا: $n_f(B)=50\\,mmol$ ومنه نجد: $x_f=2{,}5\\,mmol$", 0.25, KIN, exact=(62.5 - 50) / 5)
    mcq("q20-e2", "ماذا تستنتج عن تفاعل الكحول مع شوارد البرمنغنات؟",
        ["بما أنّ $x_f=x_{max}$ فإنّ التفاعل تام", "بما أنّ $x_f<x_{max}$ فإنّ التفاعل غير تام", "بما أنّ $x_f>x_{max}$ فإنّ التفاعل تام",
         "بما أنّ $x_f=x_{max}$ فإنّ التفاعل غير تام"],
        "بما أن $x_f=x_{max}$ فإن التفاعل تام.", 0.25, KIN)
    mcq("q21-e1", "ما زمن نصف التفاعل $t_{1/2}$؟",
        ["هو المدة الزمنية اللازمة لبلوغ تقدم التفاعل نصف قيمته الأعظمية", "هو نصف المدة الزمنية اللازمة لانتهاء التفاعل",
         "هو المدة الزمنية اللازمة لاختفاء كل الكحول", "هو المدة الزمنية اللازمة لبلوغ التقدم قيمته الأعظمية"],
        "زمن نصف التفاعل $t_{1/2}$: هو المدة الزمنية اللازمة لبلوغ تقدم التفاعل نصف قيمته الأعظمية.", 0.25, KIN)
    num("q21-e2", "حدّد بيانيًّا قيمة $t_{1/2}$ علمًا أنّ $n_B(t_{1/2})=\\frac{n_0(B)+n_f(B)}{2}$.", 2.4, 0.4, "min",
        "تحديد قيمة $t_{1/2}$ بيانيا: من العلاقة $n_B(t_{1/2})=\\frac{n_0(B)+n_f(B)}{2}$ وبالإسقاط نجد $t_{1/2}=2{,}4\\,min$", 0.25, KIN)
    mcq("q22-e1", "ما عبارة السرعة الحجمية لاختفاء الكحول $(B)$؟",
        ["$v_{Vol}(B)=-\\frac{1}{V_T}\\cdot\\frac{dn(B)}{dt}$", "$v_{Vol}(B)=\\frac{1}{V_T}\\cdot\\frac{dn(B)}{dt}$", "$v_{Vol}(B)=-V_T\\cdot\\frac{dn(B)}{dt}$",
         "$v_{Vol}(B)=-\\frac{dn(B)}{dt}$"],
        "$v_{Vol}(B)=-\\frac{1}{V_T}\\cdot\\frac{dn(B)}{dt}$", 0.25, KIN)
    num("q22-e2", "باستعمال المماس المرسوم عند المبدأ في الشكل 3، احسب السرعة الحجمية لاختفاء الكحول عند $t=0$.", 57.87, 1.5, "mmol·L⁻¹·min⁻¹",
        "$v_{Vol(B)}(0)=-\\frac{1}{0{,}06}\\cdot\\frac{0-62{,}5}{18-0}=57{,}87\\,mmol\\cdot L^{-1}\\cdot min^{-1}$", 0.25, KIN, exact=62.5 / (0.06 * 18))
    mcq("q23-e1", "ما دور حمض الكبريت المركّز في تفاعل الأسترة؟",
        ["تسريع التفاعل، ويُعتبر وسيطًا", "توفير شوارد $H_3O^+$ التي تشارك في التفاعل", "جعل التفاعل تامًّا", "رفع مردود التفاعل"],
        "دور حمض الكبريت المركز: تسريع التفاعل ويُعتبر وسيطا.", 0.25, CHEM)
    mcq("q24-e1", "ما معادلة التفاعل الحادث؟",
        ["$C_3H_8O(l)+CH_3COOH(l)=CH_3COOC_3H_7(l)+H_2O(l)$", "$C_3H_8O(l)+CH_3COOH(l)=CH_3COOC_3H_7(l)+H_2(g)$",
         "$C_3H_8O(l)+CH_3COOH(l)=CH_3COOC_2H_5(l)+H_2O(l)$", "$C_3H_8O(l)+CH_3COOH(l)=CH_3COOC_3H_7(l)$"],
        "$C_3H_8O(l)+CH_3COOH(l)=CH_3COOC_3H_7(l)+H_2O(l)$", 0.25, CHEM)
    TABLE2 = [["حالة الجملة", "التقدم", "كحول", "حمض", "إستر", "ماء"], ["ح. إ", "x=0", "50", "50", "0", "0"], ["ح. ن", "xf", "50−xf", "50−xf", "xf", "xf"]]
    deferred("q25-e1", "table_fill", "جدول تقدّم تفاعل الأسترة (بالـ mmol)",
             {"columns": TABLE2[0], "rows": ["ح. إ", "ح. ن"], "unit": "mmol", "criterion": "جدول التقدم (0.5)"},
             {"model": TABLE2, "rubric": "0.5"}, "جدول تقدم التفاعل كما في الإجابة النموذجية.", 0.5, CHEM)
    num("q25-e2", "احسب قيمة التقدّم الأعظمي $x_{max}$ لتفاعل الأسترة.", 50, 1, "mmol",
        "حساب قيمة التقدم الأعظمي: $50-x_{max}=0$ ومنه $x_{max}=50\\,mmol$", 0.25, CHEM, exact=50)
    PROTO = ("البروتوكول التجريبي: نقسم المزيج الابتدائي بالتساوي على عدة انابيب اختبار، نسدها بإحكام ونضعها في حمام مائي درجة حرارته ثابتة. "
             "نأخذ من حين لآخر أحد الأنابيب ونبرده ثم نعاير الحمض المتبقي بواسطة محلول أساسي ذو تركيز مولي معلوم. "
             "كمية الكحول المتبقية هي نفسها كمية الحمض المتبقية.")
    mcq("q26-e1", "في البروتوكول التجريبي، ماذا نفعل بالأنبوب الذي نأخذه من الحمام المائي من حين لآخر قبل المعايرة؟",
        ["نبرّده", "نسخّنه إلى درجة حرارة أعلى", "نضيف إليه قطرات أخرى من حمض الكبريت المركّز", "نضيف إليه كمية من الكحول"], PROTO, 0.25, CHEM)
    mcq("q26-e2", "كيف نحدّد كمية الحمض المتبقي في الأنبوب؟",
        ["نعاير الحمض المتبقي بواسطة محلول أساسي ذي تركيز مولي معلوم", "نعاير الحمض المتبقي بواسطة محلول حمضي ذي تركيز مولي معلوم",
         "نقيس كتلة الأنبوب قبل التفاعل وبعده", "نقيس حجم الماء الناتج"], PROTO, 0.25, CHEM)
    num("q27-e1", "من جدول التقدّم $n_f(B)=50-x_f$ ومن المنحنى (الشكل 4)، احسب التقدّم النهائي $x_f$.", 30, 1, "mmol",
        "من جدول التقدم لدينا: $n_f(B)=50-x_f$ ومن المنحنى لدينا: $n_f(B)=20\\,mmol$ ومنه نجد: $x_f=30\\,mmol$", 0.25, CHEM, exact=50 - 20)
    mcq("q27-e2", "ماذا تستنتج عن تفاعل الأسترة؟",
        ["بما أنّ $x_f<x_{max}$ فإنّ التفاعل غير تام", "بما أنّ $x_f=x_{max}$ فإنّ التفاعل تام", "بما أنّ $x_f>x_{max}$ فإنّ التفاعل غير تام",
         "بما أنّ $x_f<x_{max}$ فإنّ التفاعل تام"],
        "التحقق أنّ التفاعل غير تام: بما أن $x_f<x_{max}$ فإن التفاعل غير تام.", 0.25, CHEM)
    num("q28-e1", "احسب مردود التفاعل $r$.", 60, 1, "%", "$r=\\frac{x_f}{x_{max}}\\times100=60\\%$", 0.25, CHEM, exact=30 / 50 * 100)
    mcq("q28-e2", "استنتج صِنف الكحول $(B)$:", ["ثانوي", "أولي", "ثالثي"], "صنف الكحول $(B)$ المستعمل: ثانوي.", 0.25, CHEM)
    mcq("q29-e1", "كيف يمكن الحصول على الإستر السابق بتفاعل تام، سريع وناشر للحرارة؟",
        ["باستعمال كلور الإيثانويل بدل حمض الإيثانويك", "بإضافة كمية أكبر من حمض الكبريت المركّز", "برفع درجة حرارة المزيج فقط",
         "باستعمال الماء بدل الكحول"],
        "يمكن تحضير الإستر الناتج بتفاعل تام: استعمال كلور الإيثانويل بدل حمض الإيثانويك.", 0.25, CHEM)

    title = "بكالوريا 2019 (الدورة العادية) – العلوم الفيزيائية – شعبة علوم تجريبية – الموضوع الثاني"
    notes = (
        "موضوع البكالوريا الرسمي (الديوان الوطني للامتحانات والمسابقات، دورة 2019، الشعبة: علوم تجريبية) — الموضوع الثاني (ص5–8 من 8)؛ "
        "«الدورة العادية» من اسم الملف في Drive. نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): رُسمت الصفحات بـ pdftoppm -r 200 وقُرئت مكبّرة. "
        "طبقة النص في الـ PDF غير صالحة (أرقام خاطئة، كلمات مقطّعة، حركات ساقطة) ونص OCR في Drive يشوّه الصيغ: لم يُعتمد أيّ منهما. "
        "الصيغ بـ LaTeX كما طُبعت؛ الفاصلة العشرية داخل الصيغ تُكتب {,}؛ رموز القوائم ◄ وخانات ☐ كما في الورقة. الأشكال 1–4 مقصوصة من صورة الصفحة؛ "
        "صورة غاليلي (زخرفية) لم تُنقل. الإجابات والعلامات من «الإجابة النموذجية» الرسمية (ص5–9 من 9، صور). المجموع 20 = تمرين أول 6 + تمرين ثان 7 + تجريبي 7. "
        "ملاحظات على التصحيح: يكتب الإلكترون é (كُتب $e^-$)؛ رسم القذيفة في التصحيح يسمّي المبدأ B بدل O؛ تعليق أحمر «100 المقلوب» تحت ln100 (أي N0/N=100)؛ "
        "ℓ≈0,5 m (الدقيق 0,487) فـ y_E=1 m كما في التصحيح؛ 0,135 قُرّبت إلى 0,14 m. "
        "قرارات: جدولا التقدم (0.5 لكل منهما، «يكفي ملء الحالة ح إ وإحدى الحالات الأخرى») مؤجلان table_fill؛ "
        "س5 (✓/×) أربعة عناصر صح/خطأ؛ تعريف الدور «تُقبل صيغ أخرى» دُرّب باختيار من متعدد بمشتّتات خاطئة قطعًا؛ "
        "قذيفة س1 «8×0.25»: علامة 0.25 المكتوبة بجانب الرسم قُرئت علامةً للجملة المدروسة (الكرية) مع الشكل — اجتهاد يُراجَع؛ "
        "س3 (خصائص شعاع السرعة): علامة الرسم (0.25) دُرّبت بسؤال المبدأ والحامل كما كتبهما التصحيح؛ "
        "البروتوكول التجريبي 1.4: علامتا 0.25 (التبريد، المعايرة بمحلول أساسي) دُرّبتا باختيار من متعدد؛ "
        "2.3 «بيّن أنّ … 95 jours»: لا يُطلب الرقم 95 بل خطوات التصحيح الست. "
        "هوامش القيم العددية: الحسابات = رقم واحد من آخر خانة مطبوعة (بحدّ 5%) مع التحقق من القيمة الدقيقة؛ قراءة t1/2 من الشكل 3 = تدريجة صغرى 0,4 min؛ "
        "السرعة الحجمية من المماس المطبوع ±1,5؛ x_f ±0,1 mmol (الشكل 3) و±1 mmol (الشكل 4).")
    return title, notes


# ───────────────────────────── checks ─────────────────────────────
_SKILLS_TS = ROOT / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(phys\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) >= 6, "skills.ts not parsed"
QUEUED = {"table_fill", "bar_chart", "variation_table", "function_plot", "map_locate", "essay_builder"}


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _ltr(s):
    """mirror of textDir() in src/components/play/rich-text.tsx (applies only to strings rendered through RichText, i.e. containing $)"""
    return "$" in s and len(re.findall("[\u0600-\u06FF]", s)) < len(re.findall("[A-Za-z]", s))


def _math_ok(s):
    assert s.count("$") % 2 == 0, ("odd $", s)
    for m in re.findall(r"\$([^$]*)\$", s):
        assert m.strip() and "\n" not in m, ("empty/multiline math", s)
        depth = 0
        for c in m:
            depth += c == "{"
            depth -= c == "}"
            assert depth >= 0, ("brace", m)
        assert depth == 0, ("brace", m)


def _check(total=20):
    warn = []
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        _math_ok(qq["verbatim_text"])
        if _ltr(qq["verbatim_text"]):
            warn.append(f"LTR verbatim {qq['id']}")
        ids = [d["id"] for d in qq["documents"]]
        assert len(ids) == len(set(ids)), (qq["id"], "duplicate doc in question")
        for d in qq["documents"]:
            assert d.get("text") or d.get("table") or d.get("media"), (qq["id"], d["id"])
            if d.get("text"):
                _math_ok(d["text"])
                if _ltr(d["text"]):
                    warn.append(f"LTR doc {d['id']}")
            if d.get("media"):
                assert (ROOT / "public" / d["media"]["local_path"].lstrip("/")).exists(), d["id"]
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    got = {}
    ltr_errors = []
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        texts = [s["prompt"], s["explanation"]] + (p.get("options") or []) + ([p["text"]] + p["bank"] if t == "fill_blank" else [])
        for x in texts:
            _math_ok(x)
            if t not in QUEUED and re.search("[\u0600-\u06FF]", x) and _ltr(x):
                ltr_errors.append((s["id"], x))
        if t == "mcq":
            tfq = _META.get(s["id"], {}).get("tf")
            assert (len(p["options"]) == 2 if tfq else 3 <= len(p["options"]) <= 4), (s["id"], "mcq options")
            assert tfq or a["correct"] == 0, (s["id"], "right option first before shuffling")
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
        if t == "numeric":
            assert math.isfinite(a["value"]) and a["tolerance"] >= 0 and a["unit"] == p["unit"], s["id"]
            assert p["unit"] is None or "$" not in p["unit"], (s["id"], "unit is plain text")
            ex = _META.get(s["id"], {}).get("exact")
            if ex is not None:
                assert abs(ex - a["value"]) <= a["tolerance"] + 1e-9, (s["id"], "exact value outside tolerance", ex, a["value"])
        if t in QUEUED:
            assert s["review_status"] == "needs_engine_support" and "spec" in p and "spec" in s["answer"], s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    # an Arabic sentence with more Latin letters (LaTeX commands count) than Arabic ones would be laid out LTR and scrambled
    assert not ltr_errors, "Arabic strings that would render LTR (rich-text textDir):\n" + "\n".join(f"  {i}: {x}" for i, x in ltr_errors)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(s["points"] for s in S) - total) < 1e-9
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"
    return warn


TITLE, NOTES = (topic1 if PAPER == 1 else topic2)()
WARN = _check()
for w in WARN:
    print("warning:", w)

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{PAPER_ID}-p{PAPER}",
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "PHYS", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": PAPER_URL,
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
    "review_log": [{"at": "2026-10-29T10:35:00Z", "by": "claude", "action": "generated",
                    "note": "تحويل تجريبي (مادة الفيزياء) من صور الموضوع الرسمي والإجابة النموذجية في Drive؛ النصوص منسوخة من الصورة؛ العلامات من سلّم التنقيط؛ "
                            "الإجابات الصحيحة من الإجابة النموذجية؛ المشتّتات والهوامش العددية من إعداد التحويل وتحتاج مراجعة."}],
}
pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
types = {}
for s in S:
    types[s["type"]] = types.get(s["type"], 0) + 1
dfr = sum(s["points"] for s in S if s["type"] in QUEUED)
print(SET_ID, len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", types,
      sum(s["points"] for s in S), "points (deferred", dfr, ")")
