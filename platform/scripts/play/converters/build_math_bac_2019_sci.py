"""Conversion (PILOT for mathematics): BAC 2019 – الرياضيات – شعبة علوم تجريبية – الموضوع الأول / الثاني.

Usage:  python3 scripts/play/converters/build_math_bac_2019_sci.py [1|2] <out.json>
        (the paper number may be omitted when <out.json> ends in -p1.json / -p2.json)
then ONCE: python3 scripts/play/shuffle_exam_set.py <out.json>

Sources (owner's Drive, ONEC copies):
  paper      gdrive 1E7zQH28AK454kN6vvemn94NScQGCqRpl «2019 - الرياضيات - علوم تجريبية - الدورة العادية - الموضوع.pdf» (4 pages, both topics)
  correction gdrive 1Vg_5N6oNOd7UZnhbXGBRikNgU_BCfT08 «2019 - الرياضيات - علوم تجريبية - الدورة العادية - الحل.pdf» (6 pages, model answer + barème)

How the text was read
- Both PDFs are Word exports with a text layer, but that layer is NOT usable as the source: the Arabic font maps digits wrongly
  (04→40, 05→45, 07→70, 0.25→0725, 0.5→075, 4)→0), 2019→9102, 120→127), it drops most shaddas (بيّن أنّ → بين أن) and the
  MathType equations come out as Symbol-font private-use glyphs (U+F05B «[», U+F05D «]», U+F0A5 «∞», U+F0CE «∈» …).
- Every verbatim string and every mark was transcribed from the page images (pdftoppm -r 200 and -r 300 strips, -r 500 crops).
  The interval brackets and the left-to-right order of formulas were cross-checked against `pdftotext -bbox` glyph positions
  (Symbol-font codes mapped back to [ ] ∞ ∈ ∪ …): e.g. the domain of T2-Ex2 is [4;7[ and the correction's intervals of
  variation are ]0;1], [4;+∞[, [1;2[, ]2;4].
- Correction, P1-Ex4-2: in the rendered page the two «²» glyphs of f'(x) are invisible (it shows (x −5x+4)/(x(x−2))); the text
  layer holds «x²» and «(x−2)²», and the correction's own variation intervals (roots 1 and 4, decreasing on [1;2[) need them,
  so f'(x) = (x²−5x+4)/(x(x−2)²) is used. Correction P1-Ex2-3 prints «025×3» for 0.25×3. Correction T2-Ex4-6 writes
  «A = ∫[g(x)−f(x)]dx = ∫(−½ex²+ex)dx»: the integrand is f−g (typo «g−f»); only the stated results 2e/3 ua and 8e/3 cm² are used.

Transcription conventions (decided here, to be reused by the batch)
- Logical order = the RTL reading order of the printed line (rightmost first) when several formulas are joined by Arabic words:
  «النقط $A$ ، $B$ و $C$», the three limits of P1-Ex4-1أ (x→0 first), and in T2-Ex4 the definitions line «$g(x)=…$ و
  $f(x)=…$» (g is printed on the right). Inside one formula the order is left-to-right as printed.
- LaTeX: \\left…\\right only around fractions/tall content (plain parentheses around (C_f), (O;i,j) — sizing is typography),
  \\dfrac for full-size printed fractions, \\frac for the small ones (T2-Ex2-4أ), \\lim_{…} (subscript placement is
  typography), x\\overset{>}{\\longrightarrow}0 for the printed one-sided limits, \\vec / \\overrightarrow as printed, (C_f) in
  P1 and \\mathscr{C}_f in T2 (script C as printed), \\mathscr{A} for the area, \\mathrm{e}^2 for the upright e printed in
  «(يُعطى e²−2e≈2)». Spaces between words and formulas are normalised to one space; wrapped lines are joined, separate printed
  lines/sentences are separated by \\n.
- Rubric: one element per printed mark line of the barème; a «×n» multiplier stays in the label (one element) and its steps
  split the mark. Element totals = question totals = 20.
- Interactive only from results printed in the correction: mcq for expressions, fractions and conclusions (the correction's
  own form is the right option; distractors are converter-made and checked to differ from it), multi for «choose all» sets
  (solutions, values of X, asymptotes) so the partial grading reproduces the 0.25/0.5 per item, numeric only when the
  correction prints an integer (tolerance 0).
- «بيّن أنّ / برهن / أثبت / استنتج أنّ» whose result is printed in the question: interactive only through an intermediate
  result the correction writes (f'(x), f(i) in trigonometric form, (zC−zA)/(zC−zD) = −1, (−6√2/(zC−zA))^n = e^{−inπ/3} …);
  otherwise one deferred essay_builder step (reason "proof_without_intermediate").
- A barème line that names the task but prints no result («الشكل الآسي لـ zA», «حساب zD», «h(x)+f(x)», the probabilities of
  T2-Ex1, the direction of variation of g) is deferred as essay_builder/table_fill with reason "official_result_missing" — the
  converter does not compute missing answers itself.
- The sign of f'(x) in P1-Ex4-2 (line «إشارة f'(x)», 0.5) is read from the correction's own variation intervals (f strictly
  increasing ⇔ f'>0 there): flagged for review.
- Drawings → function_plot, variation tables → variation_table (deferred, one step per barème line).
- No figure is printed in this paper (nothing to crop).

Renderer note: src/components/play/rich-text.tsx chooses the paragraph direction by counting Latin vs Arabic letters INCLUDING
the LaTeX source inside $…$, so a math-heavy Arabic string is rendered LTR (word order reversed for the reader, and «تحت/فوق»
options would read backwards). All converter-written prompts/options/explanations are checked here to stay RTL; the verbatim
strings that would flip are listed by this builder (they cannot be reworded) — the renderer should ignore $…$ when counting.
"""
import json, pathlib, re, subprocess, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[3]
if len(sys.argv) == 3:
    PAPER, OUT = int(sys.argv[1]), sys.argv[2]
else:
    OUT = sys.argv[1]
    m = re.search(r"-p([12])\.json$", OUT)
    assert m, "usage: build_math_bac_2019_sci.py [1|2] <out.json>"
    PAPER = int(m.group(1))
assert PAPER in (1, 2)

SET_ID = f"math-bac-2019-sci-p{PAPER}"
PAPER_ID = "1E7zQH28AK454kN6vvemn94NScQGCqRpl"
PAPER_TITLE = "2019 - الرياضيات - علوم تجريبية - الدورة العادية - الموضوع.pdf"
CORR_ID = "1Vg_5N6oNOd7UZnhbXGBRikNgU_BCfT08"
CORR_TITLE = "2019 - الرياضيات - علوم تجريبية - الدورة العادية - الحل.pdf"
STREAMS = ["SCI"]

PROOF = "proof_without_intermediate"
MISSING = "official_result_missing"

# ───────────────────────────── helpers ─────────────────────────────
Q, S = [], []
_qmap = {}


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


def doc(i, caption, text):
    return {"id": i, "kind": "text", "caption": caption, "text": text}


def q(qid, number, part, text, total, elements, docs):
    qq = {"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements}
    Q.append(qq)
    _qmap[qid] = qq


def _variant(eid):
    return "abcdefgh"[sum(1 for s in S if s["rubric_element_id"] == eid)]


def _sid():
    return f"s{len(S) + 1:02d}"


def _push(qid, eid, typ, prompt, payload, answer, expl, pts, skill, status="needs_human_review"):
    S.append({"id": _sid(), "source_question_id": qid, "rubric_element_id": eid, "variant": _variant(eid), "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": prompt == _qmap[qid]["verbatim_text"], "review_status": status})


def mcq(qid, eid, prompt, correct, wrong, expl, pts, skill):
    """correct option first (shuffle_exam_set.py permutes)"""
    _push(qid, eid, "mcq", prompt, {"options": [correct, *wrong]}, {"correct": 0}, expl, pts, skill)


def multi(qid, eid, prompt, right, wrong, expl, pts, skill):
    _push(qid, eid, "multi", prompt, {"options": [*right, *wrong]}, {"correct": list(range(len(right)))}, expl, pts, skill)


def num(qid, eid, prompt, value, tol, expl, pts, skill, unit=None):
    _push(qid, eid, "numeric", prompt, {"unit": unit}, {"value": value, "tolerance": tol, "unit": unit}, expl, pts, skill)


EXPL = {
    PROOF: "النتيجة معطاة في نصّ السؤال والإجابة النموذجية لا تكتب نتيجة وسيطة لهذا البند: تحرير البرهان يُصحَّح يدويًّا (لا يُحوَّل إلى اختيار من متعدّد).",
    MISSING: "الإجابة النموذجية الرسمية تذكر هذا البند وعلامته دون أن تكتب النتيجة: لا تُنشأ خطوة تفاعليّة قبل أن تتوفّر النتيجة الرسميّة.",
    "drawing": "الرسم يُصحَّح بشبكة التنقيط الرسمية (محرّك الرسم غير متوفّر بعد).",
    "variation_table": "جدول التغيّرات يُصحَّح بشبكة التنقيط الرسمية (محرّك الجداول غير متوفّر بعد).",
}


def deferred(qid, eid, typ, prompt, pts, skill, reason, official, statement=None, extra=None):
    spec = {"official_correction": official, "reason_deferred": reason, **({"statement": statement} if statement else {}), **(extra or {})}
    _push(qid, eid, typ, prompt, {"spec": spec}, {"spec": {"rubric": official, "official_result": statement}},
          EXPL["drawing" if typ == "function_plot" else "variation_table" if typ == "variation_table" else reason], pts, skill,
          status="needs_engine_support")


# ───────────────────────────── الموضوع الأول ─────────────────────────────
def paper1():
    A, B, C, D = "التمرين الأول: (04 نقاط)", "التمرين الثاني: (04 نقاط)", "التمرين الثالث: (05 نقاط)", "التمرين الرابع: (07 نقاط)"
    SEQ, PROB, CPLX, AN = "math.sequences", "math.probability", "math.complex", "math.analysis"

    # ── التمرين الأول ──
    D1 = [doc("d-ex1", "نصّ التمرين", r"$(u_n)$ المتتالية العددية المعرفة بـ : $u_0=13$ ومن أجل كل عدد طبيعي $n$، $u_{n+1}=\dfrac{1}{5}u_n+\dfrac{4}{5}$")]
    q("q1", "1أ", A, r"برهن بالتراجع أنه: من أجل كل عدد طبيعي $n$ ، $u_n>1$ .", 1.5, [el("q1-e1", "1أ) البرهان بالتراجع (0.75×2)", 1.5)], D1)
    q("q2", "1ب", A, r"أُدرس اتجاه تغير المتتالية $(u_n)$ واستنتج أنها متقاربة.", 1,
      [el("q2-e1", "1ب) اتجاه تغيّر المتتالية", 0.5), el("q2-e2", "1ب) التقارب وتعليله", 0.5)], D1)
    q("q3", "2", A, r"$(v_n)$ المتتالية العددية المعرفة على $\mathbb{N}$ بـ : $v_n=\ln(u_n-1)$ ." "\n" r"أثبت أنّ المتتالية $(v_n)$ حسابية يطلب تعيين أساسها وحدها الأول.", 0.5,
      [el("q3-e1", "2) الفرق بين حدّين متتابعين (الأساس)", 0.25), el("q3-e2", "2) الحدّ الأول", 0.25)], D1)
    q("q4", "3", A, r"اكتب $v_n$ بدلالة $n$ ثم بين أنه: من أجل كل عدد طبيعي $n$، $u_n=1+\dfrac{12}{5^n}$ واحسب عندئذ $\lim_{n\to+\infty}u_n$ .", 0.75,
      [el("q4-e1", "3) كتابة v(n) بدلالة n", 0.25), el("q4-e2", "3) تبيان عبارة u(n)", 0.25), el("q4-e3", "3) نهاية المتتالية", 0.25)], D1)
    q("q5", "4", A, r"بيّن أنّه: من أجل كل عدد طبيعي $n$ ، $(u_0-1)(u_1-1)\times\ldots\times(u_n-1)=\left(\dfrac{12}{5^{\frac{n}{2}}}\right)^{n+1}$ .", 0.25,
      [el("q5-e1", "4) تبيان مساواة الجداء", 0.25)], D1)

    deferred("q1", "q1-e1", "essay_builder", r"1أ) تحرير البرهان بالتراجع: من أجل كل عدد طبيعي $n$ ، $u_n>1$.", 1.5, SEQ, PROOF,
             "تبيان بالتراجع أنه من أجل كل عدد طبيعي n : u(n) > 1 (0.75×2)", r"$u_n>1$")
    mcq("q2", "q2-e1", r"ما اتجاه تغيّر المتتالية $(u_n)$ على مجموعة الأعداد الطبيعية؟",
        r"$(u_n)$ متناقصة تماما على $\mathbb{N}$", [r"$(u_n)$ متزايدة تماما على $\mathbb{N}$", r"$(u_n)$ متتالية ثابتة على $\mathbb{N}$", r"$(u_n)$ ليست رتيبة على $\mathbb{N}$"],
        r"حسب الإجابة النموذجية: $(u_n)$ متناقصة تماما على $\mathbb{N}$.", 0.5, SEQ)
    mcq("q2", "q2-e2", r"لماذا نستنتج أنّ المتتالية $(u_n)$ متقاربة؟",
        r"لأنّ $(u_n)$ متناقصة ومحدودة من الأسفل", [r"لأنّ $(u_n)$ متزايدة ومحدودة من الأعلى", r"لأنّ $(u_n)$ متتالية حسابية", r"لأنّ حدّها الأول $u_0=13$ موجب"],
        r"بما أنّ $(u_n)$ متناقصة ومحدودة من الأسفل فهي متقاربة.", 0.5, SEQ)
    mcq("q3", "q3-e1", r"لإثبات أنّ $(v_n)$ حسابية نحسب الفرق بين حدّين متتابعين: ما قيمة $v_{n+1}-v_n$ من أجل كل عدد طبيعي $n$؟",
        r"$v_{n+1}-v_n=-\ln 5$", [r"$v_{n+1}-v_n=\ln 5$", r"$v_{n+1}-v_n=\dfrac{1}{5}$", r"$v_{n+1}-v_n=-\ln 4$"],
        r"من أجل كل عدد طبيعي $n$: $v_{n+1}-v_n=-\ln 5$ وهو عدد ثابت، إذن $(v_n)$ حسابية أساسها $-\ln 5$.", 0.25, SEQ)
    mcq("q3", "q3-e2", r"ما الحدّ الأول $v_0$ للمتتالية الحسابية $(v_n)$؟",
        r"$v_0=\ln(12)$", [r"$v_0=\ln(13)$", r"$v_0=\ln(14)$", r"$v_0=12$"], r"حدّها الأول: $v_0=\ln(12)$.", 0.25, SEQ)
    mcq("q4", "q4-e1", r"اكتب $v_n$ بدلالة $n$: أيّ العبارات الآتية هي الصحيحة؟",
        r"$v_n=\ln\left(\dfrac{12}{5^n}\right)$", [r"$v_n=\ln\left(\dfrac{5^n}{12}\right)$", r"$v_n=\ln(12)+n\ln 5$", r"$v_n=n\ln\left(\dfrac{12}{5}\right)$"],
        r"$v_n=\ln\left(\dfrac{12}{5^n}\right)$", 0.25, SEQ)
    deferred("q4", "q4-e2", "essay_builder", r"3) تحرير تبيان أنّ $u_n=1+\dfrac{12}{5^n}$ من أجل كل عدد طبيعي $n$.", 0.25, SEQ, PROOF,
             "تبيان أن u(n) = 1 + 12/5^n (0.25)", r"$u_n=1+\dfrac{12}{5^n}$")
    num("q4", "q4-e3", r"احسب نهاية المتتالية $(u_n)$ عندما يؤول $n$ إلى $+\infty$، ثم اكتب قيمتها العددية في الخانة.", 1, 0,
        r"حساب نهاية المتتالية $(u_n)$: $\lim_{n\to+\infty}u_n=1$.", 0.25, SEQ)
    deferred("q5", "q5-e1", "essay_builder", "4) تحرير تبيان مساواة الجداء المعطاة في السؤال الرابع.", 0.25, SEQ, PROOF,
             "تبيان أن (u0−1)(u1−1)×…×(un−1) = (12/5^(n/2))^(n+1) (0.25)", r"$(u_0-1)(u_1-1)\times\ldots\times(u_n-1)=\left(\dfrac{12}{5^{\frac{n}{2}}}\right)^{n+1}$")

    # ── التمرين الثاني ──
    D2 = [doc("d-ex2", "نصّ التمرين", "يحتوي كيس على خمس كريات حمراء منها أربع كريات تحمل الرقم 1 وكرية واحدة تحمل الرقم 2 وسبع كريات خضراء منها أربع كريات تحمل الرقم 1 وثلاث كريات تحمل الرقم 2 (كل الكريات متماثلة لا نفرق بينها عند اللمس). نسحب عشوائيا كريتين من الكيس في آن واحد ونعتبر الحادثتين $A$ و $B$ حيث: $A$ : \" سحب كريتين من نفس اللون \" ، $B$ : \" سحب كريتين تحملان نفس الرقم \" .")]
    q("q6", "1", B, r"بيّن أنّ احتمال الحادثة $A$ هو $P(A)=\dfrac{31}{66}$ واحسب احتمال الحادثة $B$ .", 2,
      [el("q6-e1", "1) تبيان احتمال الحادثة A", 1), el("q6-e2", "1) احتمال الحادثة B", 1)], D2)
    q("q7", "2", B, "علما أنّ الكريتين المسحوبتين من نفس اللون، ما احتمال أن تحملا نفس الرقم؟", 0.25, [el("q7-e1", "2) الاحتمال الشرطي", 0.25)], D2)
    q("q8", "3", B, r"ليكن $X$ المتغير العشوائي الذي يرفق بكل عملية سحب عدد الكريات الحمراء المتبقية في الكيس." "\n" r"عرف قانون الاحتمال للمتغير العشوائي $X$ واحسب أمله الرياضياتي $E(X)$", 1.75,
      [el("q8-e1", "3) قيم المتغير العشوائي X (0.25×3)", 0.75), el("q8-e2", "3) احتمالات القيم (0.25×3)", 0.75), el("q8-e3", "3) الأمل الرياضياتي", 0.25)], D2)

    deferred("q6", "q6-e1", "essay_builder", r"1) تحرير تبيان أنّ $P(A)=\dfrac{31}{66}$.", 1, PROB, PROOF, "تبيان أن P(A) = 31/66 (01)", r"$P(A)=\dfrac{31}{66}$")
    mcq("q6", "q6-e2", r"ما احتمال الحادثة $B$؟", r"$P(B)=\dfrac{17}{33}$", [r"$P(B)=\dfrac{15}{66}$", r"$P(B)=\dfrac{31}{66}$", r"$P(B)=\dfrac{14}{33}$"],
        r"حسب الإجابة النموذجية: $P(B)=\dfrac{17}{33}$.", 1, PROB)
    mcq("q7", "q7-e1", "علما أنّ الكريتين المسحوبتين من نفس اللون، ما احتمال أن تحملا نفس الرقم؟",
        r"$P(B/A)=\dfrac{15}{31}$", [r"$P(B/A)=\dfrac{15}{66}$", r"$P(B/A)=\dfrac{17}{31}$", r"$P(B/A)=\dfrac{31}{66}$"],
        r"احتمال أن تحملا نفس الرقم علما أنّهما من نفس اللون: $P(B/A)=\dfrac{P(A\cap B)}{P(A)}=\dfrac{15}{31}$.", 0.25, PROB)
    multi("q8", "q8-e1", r"ما القيم الّتي يأخذها المتغير العشوائي $X$؟ اختر كلّ القيم الممكنة.", ["$3$", "$4$", "$5$"], ["$1$", "$2$"],
          r"حسب الإجابة النموذجية، قيم المتغير العشوائي $X$ هي $3$ و $4$ و $5$.", 0.75, PROB)
    LAW1 = r"قانون الاحتمال حسب الإجابة النموذجية: $P(X=3)=\dfrac{10}{66}$ ، $P(X=4)=\dfrac{35}{66}$ ، $P(X=5)=\dfrac{21}{66}$."
    mcq("q8", "q8-e2", r"ما قيمة الاحتمال $P(X=3)$؟", r"$\dfrac{10}{66}$", [r"$\dfrac{35}{66}$", r"$\dfrac{21}{66}$", r"$\dfrac{20}{66}$"], LAW1, 0.25, PROB)
    mcq("q8", "q8-e2", r"ما قيمة الاحتمال $P(X=4)$؟", r"$\dfrac{35}{66}$", [r"$\dfrac{10}{66}$", r"$\dfrac{21}{66}$", r"$\dfrac{25}{66}$"], LAW1, 0.25, PROB)
    mcq("q8", "q8-e2", r"ما قيمة الاحتمال $P(X=5)$؟", r"$\dfrac{21}{66}$", [r"$\dfrac{10}{66}$", r"$\dfrac{35}{66}$", r"$\dfrac{15}{66}$"], LAW1, 0.25, PROB)
    mcq("q8", "q8-e3", r"احسب الأمل الرياضياتي $E(X)$ للمتغير العشوائي $X$.", r"$E(X)=\dfrac{275}{66}$", [r"$E(X)=\dfrac{245}{66}$", r"$E(X)=\dfrac{305}{66}$", r"$E(X)=4$"],
        r"الأمل الرياضياتي: $E(X)=\dfrac{275}{66}$.", 0.25, PROB)

    # ── التمرين الثالث ──
    D3 = [doc("d-ex3", "معطيات الجزء II", r"نعتبر في المستوي المركب المنسوب إلى المعلم المتعامد والمتجانس $(O;\vec{u},\vec{v})$ ، النقط $A$ ، $B$ و $C$ التي لاحقاتها $i$ ، $2-i$ و $2+i$ على الترتيب.")]
    D32 = D3 + [doc("d-ex3-2", "معطيات السؤال 2", r"من أجل كل عدد مركب $z$ يختلف عن $2+i$ نضع $f(z)=\dfrac{iz-1-2i}{2z-4-2i}$")]
    D33 = D3 + [doc("d-ex3-3", "معطيات السؤال 3", r"نعتبر الدوران $r$ الذي مركزه $C$ و زاويته $\dfrac{\pi}{2}$ .")]
    q("q9", "I", C, r"حل في مجموعة الأعداد المركبة $\mathbb{C}$ المعادلة ذات المجهول $z$ التالية: $(z-i)(z^2-4z+5)=0$ .", 1.5,
      [el("q9-e1", "I) حلول المعادلة (0.5×3)", 1.5)], [])
    q("q10", "II-1", C, r"اكتب العدد المركب $\dfrac{z_C-z_A}{z_C-z_B}$ على الشكل الأسي، ثم استنتج طبيعة المثلث $ABC$ .", 1.25,
      [el("q10-e1", "II-1) الشكل الأسي", 0.75), el("q10-e2", "II-1) طبيعة المثلث ABC", 0.5)], D3)
    q("q11", "II-2أ", C, r"عين المجموعة $(E)$ للنقط $M$ من المستوي ذات اللاحقة $z$ التي تحقق: $|f(z)|=\dfrac{1}{2}$", 0.75,
      [el("q11-e1", "II-2أ) المجموعة (E)", 0.75)], D32)
    q("q12", "II-2ب", C, r"بيّن أن العدد $\left[f(i)\right]^{1440}$ حقيقي موجب.", 0.75, [el("q12-e1", "II-2ب) f(i) على الشكل المثلثي والاستنتاج", 0.75)], D32)
    q("q13", "II-3أ", C, r"عيّن لاحقة $D$ صورة $B$ بالدوران $r$ وبيّن أنّ النقط $D$ ، $A$ و $C$ في استقامية.", 0.5,
      [el("q13-e1", "II-3أ) لاحقة D والاستقامية", 0.5)], D33)
    q("q14", "II-3ب", C, r"استنتج أنّ $D$ هي صورة النقطة $A$ بتحويل نقطي بسيط يطلب تحديد طبيعته وعناصره .", 0.25,
      [el("q14-e1", "II-3ب) طبيعة التحويل وعناصره", 0.25)], D33)

    multi("q9", "q9-e1", r"ما حلول المعادلة $(z-i)(z^2-4z+5)=0$ في $\mathbb{C}$؟ اختر كلّ الحلول.", ["$i$", "$2-i$", "$2+i$"], ["$-i$", "$-2+i$", "$-2-i$"],
          r"حلول المعادلة هي: $i$ ، $2-i$ ، $2+i$.", 1.5, CPLX)
    mcq("q10", "q10-e1", r"اكتب العدد المركب $\dfrac{z_C-z_A}{z_C-z_B}$ على الشكل الأسي: أيّ كتابة صحيحة؟",
        r"$-i=e^{-i\frac{\pi}{2}}$", [r"$i=e^{i\frac{\pi}{2}}$", r"$-1=e^{i\pi}$", r"$-2i=2e^{-i\frac{\pi}{2}}$"],
        r"$\dfrac{z_C-z_A}{z_C-z_B}=-i=e^{-i\frac{\pi}{2}}$", 0.75, CPLX)
    mcq("q10", "q10-e2", r"استنتج طبيعة المثلث $ABC$.", r"قائم في $C$ ومتساوي الساقين",
        [r"متقايس الأضلاع", r"قائم في $A$ ومتساوي الساقين", r"متساوي الساقين رأسه $C$ وغير قائم"], r"المثلث $ABC$ قائم في $C$ ومتساوي الساقين.", 0.5, CPLX)
    mcq("q11", "q11-e1", r"ما المجموعة $(E)$ للنقط $M$ ذات اللاحقة $z$ الّتي تحقق $|f(z)|=\dfrac{1}{2}$؟",
        r"$(E)$ هي محور القطعة $[BC]$", [r"$(E)$ هي محور القطعة $[AB]$", r"$(E)$ هي الدائرة الّتي مركزها $C$ ونصف قطرها $\dfrac{1}{2}$", r"$(E)$ هي المستقيم $(BC)$"],
        r"المجموعة $(E)$ هي محور القطعة $[BC]$.", 0.75, CPLX)
    mcq("q12", "q12-e1", r"لتبيان أنّ العدد $\left[f(i)\right]^{1440}$ حقيقي موجب نكتب $f(i)$ على الشكل المثلثي: أيّ كتابة هي الصحيحة؟",
        r"$f(i)=\dfrac{\sqrt{2}}{2}\left(\cos\dfrac{\pi}{4}+i\sin\dfrac{\pi}{4}\right)$",
        [r"$f(i)=\dfrac{\sqrt{2}}{2}\left(\cos\dfrac{\pi}{2}+i\sin\dfrac{\pi}{2}\right)$", r"$f(i)=\sqrt{2}\left(\cos\dfrac{\pi}{4}+i\sin\dfrac{\pi}{4}\right)$",
         r"$f(i)=\dfrac{\sqrt{2}}{2}\left(\cos\dfrac{3\pi}{4}+i\sin\dfrac{3\pi}{4}\right)$"],
        r"$f(i)=\dfrac{\sqrt{2}}{2}\left(\cos\dfrac{\pi}{4}+i\sin\dfrac{\pi}{4}\right)\quad\left[f(i)\right]^{1440}\in\mathbb{R}^+$", 0.75, CPLX)
    mcq("q13", "q13-e1", r"عيّن لاحقة النقطة $D$ صورة النقطة $B$ بالدوران $r$.", r"$z_D=4+i$", [r"$z_D=4-i$", r"$z_D=i$", r"$z_D=2+3i$"],
        r"لاحقة النقطة $D$ هي $z_D=4+i$.", 0.25, CPLX)
    mcq("q13", "q13-e1", r"لتبيان أنّ النقط $D$ ، $A$ و $C$ في استقامية نحسب النسبة $\dfrac{z_C-z_A}{z_C-z_D}$: ما قيمتها؟",
        r"$\dfrac{z_C-z_A}{z_C-z_D}=-1$", [r"$\dfrac{z_C-z_A}{z_C-z_D}=i$", r"$\dfrac{z_C-z_A}{z_C-z_D}=-i$", r"$\dfrac{z_C-z_A}{z_C-z_D}=1+i$"],
        r"لدينا $\dfrac{z_C-z_A}{z_C-z_D}=-1$ أي $\overrightarrow{CD}=-\overrightarrow{CA}$، إذن النقط في استقامية حسب الإجابة النموذجية.", 0.25, CPLX)
    mcq("q14", "q14-e1", r"استنتج طبيعة التحويل النقطي البسيط الّذي يحوّل النقطة $A$ إلى النقطة $D$ وعناصره.",
        r"تحاك مركزه $C$ ونسبته $-1$", [r"تحاك مركزه $C$ ونسبته $2$", r"دوران مركزه $C$ وزاويته $\dfrac{\pi}{2}$", r"انسحاب شعاعه $\vec{AC}$"],
        r"$D$ هي صورة $A$ بتحاك مركزه $C$ ونسبته $-1$، أو بدوران مركزه $C$ وزاويته $\pi$، أو بتناظر مركزي بالنسبة لـ $C$، أو بتشابه مباشر نسبته 1 مركزه $C$ وزاويته $\pi$.",
        0.25, CPLX)

    # ── التمرين الرابع ──
    D4 = [doc("d-ex4", "نصّ التمرين", r"$f$ الدّالة العددية المعرفة على $]0;2[\cup]2;+\infty[$ بـ : $f(x)=\dfrac{1}{x-2}+\ln x$ ." "\n"
              r"$(C_f)$ تمثيلها البياني في المستوي المنسوب إلى المعلم المتعامد والمتجانس $(O;\overrightarrow{i},\overrightarrow{j})$.")]
    D43 = D4 + [doc("d-ex4-3", "معطيات السؤال 3", r'نسمي $(\Gamma)$ المنحنى البياني للدّالة اللّوغاريتمية النّيبيرية "ln" في المعلم السابق.')]
    D45 = D4 + [doc("d-ex4-5", "معطيات السؤال 5", r"$H$ الدّالة المعرفة على المجال $[3;+\infty[$ بـ: $H(x)=\int_3^x\ln(t)dt$ حيث $t$ متغيّر حقيقي موجب تماما.")]
    q("q15", "1أ", D, r"احسب $\lim_{x\overset{>}{\longrightarrow}0}f(x)$ ، $\lim_{x\overset{<}{\longrightarrow}2}f(x)$ و $\lim_{x\overset{>}{\longrightarrow}2}f(x)$ ثم فسِّر النتائج بيانيا.", 2,
      [el("q15-e1", "1أ) النهايات الثلاث (0.5×3)", 1.5), el("q15-e2", "1أ) التفسير الهندسي (0.25×2)", 0.5)], D4)
    q("q16", "1ب", D, r"احسب $\lim_{x\to+\infty}f(x)$ .", 0.5, [el("q16-e1", "1ب) النهاية عند +∞", 0.5)], D4)
    q("q17", "2", D, r"ادرس اتجاه تغيّر الدّالة $f$ على $]0;2[\cup]2;+\infty[$ وشكِّل جدول تغيُّراتها.", 1.75,
      [el("q17-e1", "2) الدالة المشتقة", 0.5), el("q17-e2", "2) إشارة الدالة المشتقة", 0.5), el("q17-e3", "2) اتجاه التغيّر وجدول التغيّرات (3×0.25)", 0.75)], D4)
    q("q18", "3أ", D, r"احسب $\lim_{x\to+\infty}\left(f(x)-\ln x\right)$ ثم فسِّر النَّتيجة بيانيا.", 0.75,
      [el("q18-e1", "3أ) النهاية", 0.5), el("q18-e2", "3أ) التفسير البياني", 0.25)], D43)
    q("q19", "3ب", D, r"ادرس وضعية المنحنى $(C_f)$ بالنِّسبة إلى المنحنى $(\Gamma)$.", 0.5, [el("q19-e1", "3ب) الوضعية النسبية", 0.5)], D43)
    q("q20", "4", D, r"ارسم بعناية المنحنى $(\Gamma)$ ثمَّ المنحنى $(C_f)$.", 0.5, [el("q20-e1", "4) الرسم", 0.5)], D43)
    q("q21", "5أ", D, r"باستعمال المكاملة بالتّجزئة، عيِّن عبارة $H(x)$ بدلالة $x$ .", 0.25, [el("q21-e1", "5أ) عبارة H(x)", 0.25)], D45)
    q("q22", "5ب", D, r"احسب $\mathscr{A}$ مساحة الحيِّز المستوي المحدَّد بالمنحنى $(C_f)$ وحامل محور الفواصل والمستقيمين ذوي المعادلتين: $x=3$ و $x=4$ .", 0.25,
      [el("q22-e1", "5ب) المساحة", 0.25)], D45)
    q("q23", "6", D, r"$g$ الدّالة المعرَّفة على $]-\infty;-1[\cup]-1;0[$ بـ : $g(x)=f(-2x)$ ." "\n" r"دون حساب عبارة $g(x)$ حدّد اتجاه تغيّر الدالة $g$ على مجموعة تعريفها.", 0.5,
      [el("q23-e1", "6) عبارة g'(x)", 0.25), el("q23-e2", "6) اتجاه تغيّر g", 0.25)], D4)

    LIM = r"النهايات حسب الإجابة النموذجية: $\lim_{x\overset{>}{\longrightarrow}0}f(x)=-\infty$ ، $\lim_{x\overset{<}{\longrightarrow}2}f(x)=-\infty$ ، $\lim_{x\overset{>}{\longrightarrow}2}f(x)=+\infty$"
    mcq("q15", "q15-e1", r"احسب النهاية $\lim_{x\overset{>}{\longrightarrow}0}f(x)$ واختر قيمتها من بين الخيارات.", r"$-\infty$", [r"$+\infty$", "$0$", r"$-\dfrac{1}{2}$"],
        r"$\lim_{x\overset{>}{\longrightarrow}0}f(x)=-\infty$", 0.5, AN)
    mcq("q15", "q15-e1", r"احسب النهاية $\lim_{x\overset{<}{\longrightarrow}2}f(x)$ واختر قيمتها من بين الخيارات.", r"$-\infty$", [r"$+\infty$", "$0$", r"$\ln 2$"],
        r"$\lim_{x\overset{<}{\longrightarrow}2}f(x)=-\infty$", 0.5, AN)
    mcq("q15", "q15-e1", r"احسب النهاية $\lim_{x\overset{>}{\longrightarrow}2}f(x)$ واختر قيمتها من بين الخيارات.", r"$+\infty$", [r"$-\infty$", "$0$", r"$\ln 2$"],
        r"$\lim_{x\overset{>}{\longrightarrow}2}f(x)=+\infty$", 0.5, AN)
    multi("q15", "q15-e2", r"فسِّر النتائج بيانيا: ما معادلات المستقيمات المقاربة للمنحنى $(C_f)$ الّتي تستنتجها من هذه النهايات؟ اختر كلّ المعادلات الصحيحة.",
          ["$x=0$", "$x=2$"], ["$y=0$", "$y=2$", "$y=x$"],
          r"التفسير الهندسي: $x=0$ و $x=2$ معادلتا المستقيمين المقاربين للمنحنى $(C_f)$.", 0.5, AN)
    mcq("q16", "q16-e1", r"احسب $\lim_{x\to+\infty}f(x)$ ثم اختر النتيجة الصحيحة.", r"$+\infty$", [r"$-\infty$", "$0$", "$1$"],
        r"$\lim_{x\to+\infty}f(x)=+\infty$", 0.5, AN)
    mcq("q17", "q17-e1", r"ما عبارة الدالة المشتقة $f'(x)$ على $]0;2[\cup]2;+\infty[$؟",
        r"$f'(x)=\dfrac{x^2-5x+4}{x(x-2)^2}$", [r"$f'(x)=\dfrac{x^2-3x+4}{x(x-2)^2}$", r"$f'(x)=\dfrac{-x^2+5x-4}{x(x-2)^2}$", r"$f'(x)=\dfrac{x^2-5x+4}{(x-2)^2}$"],
        r"$f'(x)=\dfrac{x^2-5x+4}{x(x-2)^2}$", 0.5, AN)
    mcq("q17", "q17-e2", r"ما إشارة الدالة المشتقة $f'(x)$ على مجموعة التعريف؟",
        r"$f'(x)>0$ على $]0;1[$ وعلى $]4;+\infty[$، و $f'(x)<0$ على $]1;2[$ وعلى $]2;4[$",
        [r"$f'(x)<0$ على $]0;1[$ وعلى $]4;+\infty[$، و $f'(x)>0$ على $]1;2[$ وعلى $]2;4[$",
         r"$f'(x)>0$ على المجال $]0;2[$، و $f'(x)<0$ على المجال $]2;+\infty[$", r"$f'(x)>0$ على كامل المجال $]0;2[\cup]2;+\infty[$"],
        r"من تغيّرات $f$ الواردة في الإجابة النموذجية: $f'(x)>0$ على $]0;1[$ وعلى $]4;+\infty[$، و $f'(x)<0$ على $]1;2[$ وعلى $]2;4[$.", 0.5, AN)
    VAR1 = r"حسب الإجابة النموذجية: $f$ متزايدة تماما على كل من المجالين $]0;1]$ و $[4;+\infty[$، ومتناقصة تماما على كل من المجالين $[1;2[$ و $]2;4]$."
    mcq("q17", "q17-e3", r"على أيّ مجالين تكون الدالة $f$ متزايدة تماما؟", r"المجالان $]0;1]$ و $[4;+\infty[$",
        [r"المجالان $[1;2[$ و $]2;4]$", r"المجالان $]0;2[$ و $]2;+\infty[$", r"المجالان $]0;1]$ و $]2;4]$"], VAR1, 0.25, AN)
    mcq("q17", "q17-e3", r"وعلى أيّ مجالين تكون الدالة $f$ متناقصة تماما؟", r"المجالان $[1;2[$ و $]2;4]$",
        [r"المجالان $]0;1]$ و $[4;+\infty[$", r"المجالان $]0;2[$ و $]2;4]$", r"المجالان $[1;2[$ و $[4;+\infty[$"], VAR1, 0.25, AN)
    deferred("q17", "q17-e3", "variation_table", "2) تشكيل جدول تغيّرات الدالة $f$.", 0.25, AN, "variation_table", "وتشكيل جدول التغيرات (ضمن 3×0.25)", None,
             {"function": "$f$", "domain": r"$]0;2[\cup]2;+\infty[$", "derivative": r"$f'(x)=\dfrac{x^2-5x+4}{x(x-2)^2}$",
              "increasing": [r"$]0;1]$", r"$[4;+\infty[$"], "decreasing": [r"$[1;2[$", r"$]2;4]$"],
              "limits": [r"$\lim_{x\overset{>}{\longrightarrow}0}f(x)=-\infty$", r"$\lim_{x\overset{<}{\longrightarrow}2}f(x)=-\infty$",
                         r"$\lim_{x\overset{>}{\longrightarrow}2}f(x)=+\infty$", r"$\lim_{x\to+\infty}f(x)=+\infty$"]})
    num("q18", "q18-e1", r"احسب النهاية $\lim_{x\to+\infty}(f(x)-\ln x)$ ثم اكتب قيمتها العددية في الخانة.", 0, 0,
        r"$\lim_{x\to+\infty}\left(f(x)-\ln x\right)=0$", 0.5, AN)
    mcq("q18", "q18-e2", "ما التفسير البياني لهذه النتيجة؟", r"$(\Gamma)$ منحنى مقارب للمنحنى $(C_f)$ بجوار $+\infty$",
        [r"المستقيم ذو المعادلة $y=0$ مقارب للمنحنى $(C_f)$ بجوار $+\infty$", r"المستقيم ذو المعادلة $x=2$ مقارب للمنحنى $(\Gamma)$",
         r"المنحنيان $(C_f)$ و $(\Gamma)$ متناظران بالنسبة إلى محور الفواصل"],
        r"التفسير البياني: $(\Gamma)$ منحنى مقارب للمنحنى $(C_f)$ بجوار $+\infty$.", 0.25, AN)
    mcq("q19", "q19-e1", r"لدراسة الوضعية نحسب الفرق: ما عبارة $f(x)-\ln x$؟", r"$f(x)-\ln x=\dfrac{1}{x-2}$",
        [r"$f(x)-\ln x=\dfrac{1}{x+2}$", r"$f(x)-\ln x=x-2$", r"$f(x)-\ln x=\ln(x-2)$"], r"$f(x)-\ln x=\dfrac{1}{x-2}$", 0.25, AN)
    POS1 = r"على المجال $]0;2[$ المنحنى $(C_f)$ يقع تحت المنحنى $(\Gamma)$، وعلى المجال $]2;+\infty[$ المنحنى $(C_f)$ يقع فوق المنحنى $(\Gamma)$"
    mcq("q19", "q19-e1", r"ما وضعية المنحنى $(C_f)$ بالنسبة إلى المنحنى $(\Gamma)$؟", POS1,
        [r"على المجال $]0;2[$ المنحنى $(C_f)$ يقع فوق المنحنى $(\Gamma)$، وعلى المجال $]2;+\infty[$ المنحنى $(C_f)$ يقع تحت المنحنى $(\Gamma)$",
         r"المنحنى $(C_f)$ يقع فوق المنحنى $(\Gamma)$ على كامل المجال $]0;2[\cup]2;+\infty[$",
         r"المنحنى $(C_f)$ يقع تحت المنحنى $(\Gamma)$ على كامل المجال $]0;2[\cup]2;+\infty[$"],
        "إذن: " + POS1 + ".", 0.25, AN)
    deferred("q20", "q20-e1", "function_plot", r"4) رسم المنحنى $(\Gamma)$ ثم المنحنى $(C_f)$.", 0.5, AN, "drawing", "الرسم (0.5)", None,
             {"curves": [r"$(\Gamma)$", r"$(C_f)$"], "frame": r"$(O;\overrightarrow{i},\overrightarrow{j})$"})
    mcq("q21", "q21-e1", r"باستعمال المكاملة بالتجزئة، ما عبارة $H(x)$ بدلالة $x$؟", r"$H(x)=-x+3+x\ln x-3\ln 3$",
        [r"$H(x)=x\ln x-x$", r"$H(x)=-x+3+x\ln x+3\ln 3$", r"$H(x)=\dfrac{1}{x}-\dfrac{1}{3}$"],
        r"$H(x)=\int_3^x(\ln t)dt=-x+3+x\ln x-3\ln 3$", 0.25, AN)
    mcq("q22", "q22-e1", r"احسب المساحة $\mathscr{A}$ للحيّز المحدّد بالمنحنى $(C_f)$ وحامل محور الفواصل والمستقيمين اللذين معادلتاهما $x=3$ و $x=4$.",
        r"$\mathscr{A}=(-1+9\ln 2-3\ln 3)\,(u.a)$", [r"$\mathscr{A}=(-1+8\ln 2-3\ln 3)\,(u.a)$", r"$\mathscr{A}=(1+9\ln 2-3\ln 3)\,(u.a)$", r"$\mathscr{A}=\ln 2\,(u.a)$"],
        r"$\mathscr{A}=(-1+9\ln 2-3\ln 3)\,(u.a)$", 0.25, AN)
    mcq("q23", "q23-e1", r"دون حساب عبارة $g(x)$: ما عبارة الدالة المشتقة $g'(x)$ بدلالة $f'$؟", r"$g'(x)=-2f'(-2x)$",
        [r"$g'(x)=f'(-2x)$", r"$g'(x)=2f'(-2x)$", r"$g'(x)=-2f'(x)$"], r"$g'(x)=-2f'(-2x)$", 0.25, AN)
    G_OK = r"الدالة $g$ متناقصة تماما على $]-\infty;-2[\cup]-\frac{1}{2};0[$ ومتزايدة تماما على $]-2;-1[\cup]-1;-\frac{1}{2}[$"
    mcq("q23", "q23-e2", r"ما اتجاه تغيّر الدالة $g$ على مجموعة تعريفها؟", G_OK,
        [r"الدالة $g$ متزايدة تماما على $]-\infty;-2[\cup]-\frac{1}{2};0[$ ومتناقصة تماما على $]-2;-1[\cup]-1;-\frac{1}{2}[$",
         r"الدالة $g$ متناقصة تماما على $]-\infty;-1[$ ومتزايدة تماما على $]-1;0[$", r"الدالة $g$ متزايدة تماما على كل من المجالين $]-\infty;-1[$ و $]-1;0[$"],
        "حسب الإجابة النموذجية: " + G_OK + ".", 0.25, AN)

    title = "بكالوريا 2019 (الدورة العادية) – الرياضيات – شعبة علوم تجريبية – الموضوع الأول"
    notes = (NOTES_COMMON +
             " قرارات الموضوع الأول: التمرين1 س1أ «0.75×2» عنصر واحد (1.5) مؤجَّل كاملا لأنّ الإجابة لا تكتب نتيجة وسيطة للبرهان بالتراجع؛ "
             "س3 «تبيان u(n)=1+12/5^n» و س4 مؤجَّلان للسبب نفسه. التمرين2: «تبيان P(A)=31/66» (1 ن) مؤجَّل؛ سطر «025×3» في التصحيح يُقرأ 0.25×3 "
             "(قيم X)، وقيم X ثلاث (multi بعلامة جزئية 0.25 لكل قيمة) والاحتمالات الثلاثة بصيغة التصحيح (10/66 لا 5/33). "
             "التمرين3 س3ب: يقبل التصحيح أربع إجابات (تحاك نسبته −1، دوران زاويته π، تناظر مركزي، تشابه مباشر)؛ الخيار الصحيح هو الأوّل منها "
             "ولا يظهر غيره بين المشتّتات. التمرين4 س2: عبارة f'(x) مأخوذة من طبقة النصّ لأنّ رمز «²» لا يظهر في صورة التصحيح؛ سطر «إشارة f'(x)» "
             "(0.5) لا يكتب الإشارة فاستُنتجت من مجالات التغيّر المكتوبة في التصحيح نفسه (قرار يُراجَع). مؤجَّل: البرهان بالتراجع 1.5، تبيانات 0.25+0.25، "
             "تبيان P(A) 1، جدول التغيّرات 0.25، الرسم 0.5 = 3.75 ن.")
    return title, notes


# ───────────────────────────── الموضوع الثاني ─────────────────────────────
def paper2():
    A, B, C, D = "التمرين الأوّل: (04 نقاط)", "التمرين الثاني: (04 نقاط)", "التمرين الثالث: (05 نقاط)", "التمرين الرابع: (07 نقاط)"
    SEQ, PROB, CPLX, AN = "math.sequences", "math.probability", "math.complex", "math.analysis"

    # ── التمرين الأول ──
    D1 = [doc("d-ex1", "نصّ التمرين", "يحتوي صندوق على 10 كريات لا نفرق بينها عند اللّمس منها كريتان تحملان الرقم 0 وثلاث تحمل الرقم 1 والكريات الأخرى تحمل الرقم 2. نسحب عشوائياً وفي آنٍ واحدٍ ثلاث كريات من الصندوق." "\n"
              r"ليكن $X$ المتغيّر العشوائي الذي يرفق بكل سحب، جداء الأرقام المسجّلة على الكريات المسحوبة.")]
    q("q1", "1", A, r"عرّف قانون الاحتمال للمتغير العشوائي $X$ ثم احسب أمله الرياضياتي $E(X)$ .", 2.5,
      [el("q1-e1", "1) عدد الإمكانيات", 0.5), el("q1-e2", "1) قانون الاحتمال: القيم واحتمالاتها", 1.5), el("q1-e3", "1) الأمل الرياضياتي", 0.5)], D1)
    q("q2", "2", A, r"بيّن أنّ احتمال الحصول على ثلاث كريات كل منها تحمل رقماً زوجياً هو $\dfrac{7}{24}$ .", 1, [el("q2-e1", "2) تبيان الاحتمال 7/24", 1)], D1)
    q("q3", "3", A, "نسحب الآن من الصندوق كريتين على التوالي دون إرجاع." "\n" "ما احتمال الحصول على كريتين تحملان رقمين مجموعهما فردي علما أن جداءهما زوجي؟", 0.5,
      [el("q3-e1", "3) الاحتمال الشرطي (0.25×2)", 0.5)], D1)

    num("q1", "q1-e1", "نسحب عشوائيا وفي آن واحد ثلاث كريات من الكريات العشر: ما عدد الإمكانيات (عدد السحبات الممكنة)؟", 120, 0,
        "عدد الإمكانيات هو 120.", 0.5, PROB)
    multi("q1", "q1-e2", r"ما القيم الّتي يأخذها المتغير العشوائي $X$؟ اختر كلّ القيم الممكنة.", ["$0$", "$1$", "$2$", "$4$", "$8$"], ["$3$", "$6$"],
          r"قانون الاحتمال حسب الإجابة النموذجية: قيم $X$ هي $0$ ، $1$ ، $2$ ، $4$ ، $8$ مع احتمالاتها.", 0.5, PROB)
    deferred("q1", "q1-e2", "table_fill", r"1) احتمالات القيم $0$ ، $1$ ، $2$ ، $4$ ، $8$ للمتغير العشوائي $X$.", 1, PROB, MISSING,
             "قانون الاحتمال: قيم X هي 0، 1، 2، 4، 8 مع احتمالاتها (01.5) — لا يكتب التصحيح الاحتمالات", None,
             {"columns": ["$x_i$", "$0$", "$1$", "$2$", "$4$", "$8$"], "rows": ["$P(X=x_i)$"], "official_values": None})
    mcq("q1", "q1-e3", r"احسب الأمل الرياضياتي $E(X)$ للمتغير العشوائي $X$.", r"$E(X)=\dfrac{231}{120}$",
        [r"$E(X)=\dfrac{120}{231}$", r"$E(X)=\dfrac{15}{8}$", r"$E(X)=2$"], r"الأمل الرياضياتي هو $E(X)=\dfrac{231}{120}$.", 0.5, PROB)
    deferred("q2", "q2-e1", "essay_builder", r"2) تحرير تبيان أنّ احتمال الحصول على ثلاث كريات تحمل أرقاما زوجية هو $\dfrac{7}{24}$.", 1, PROB, PROOF,
             "احتمال الحصول على 3 كريات تحمل كل منها رقما زوجيا 7/24 (01)", r"$\dfrac{7}{24}$")
    mcq("q3", "q3-e1", "ما احتمال الحصول على كريتين تحملان رقمين مجموعهما فردي علما أن جداءهما زوجي؟", r"$\dfrac{1}{2}$",
        [r"$\dfrac{7}{15}$", r"$\dfrac{14}{15}$", r"$\dfrac{3}{7}$"],
        r"احتمال الحصول على كريتين تحملان رقمين مجموعهما فردي علما أنّ الجداء زوجي هو $\dfrac{1}{2}$.", 0.5, PROB)

    # ── التمرين الثاني ──
    D2 = [doc("d-ex2", "نصّ التمرين", r"$f$ الدّالة المعرّفة على المجال $[4;7[$ بـ: $f(x)=\sqrt{x+2}+4$ .")]
    D23 = D2 + [doc("d-ex2-3", "معطيات السؤال 3", r"$(u_n)$ المتتالية العددية المعرّفة بـ : $u_0=4$ ومن أجل كلّ عدد طبيعي $n$، $u_{n+1}=f(u_n)$ .")]
    q("q4", "1أ", B, r"بيّن أنّ الدالة $f$ متزايدة تماما على المجال $[4;7[$.", 0.75, [el("q4-e1", "1أ) الدالة المشتقة واتجاه التغيّر", 0.75)], D2)
    q("q5", "1ب", B, r"استنتج أنَّه: من أجل كل عدد حقيقي $x$ من المجال $[4;7[$ فإنّ $f(x)\in[4;7[$ .", 0.5, [el("q5-e1", "1ب) الاستنتاج", 0.5)], D2)
    q("q6", "2", B, r"برهن أنَّه: من أجل كل عدد حقيقي $x$ من المجال $[4;7[$ فإنّ $f(x)-x=\dfrac{-x^2+9x-14}{x-4+\sqrt{x+2}}$ ." "\n"
      r"ثمّ استنتج أنّه: من أجل كل عدد حقيقي $x$ من المجال $[4;7[$ فإنّ $f(x)-x>0$", 0.75, [el("q6-e1", "2) البرهان والاستنتاج", 0.75)], D2)
    q("q7", "3أ", B, r"برهن بالتّراجع أنّه: من أجل كل عدد طبيعي $n$ $4\le u_n<7$ .", 0.75, [el("q7-e1", "3أ) البرهان بالتراجع", 0.75)], D23)
    q("q8", "3ب", B, r"استنتج اتجاه تغيّر المتتالية $(u_n)$ ثمّ بيّن أنّها متقاربة.", 0.5,
      [el("q8-e1", "3ب) اتجاه تغيّر المتتالية", 0.25), el("q8-e2", "3ب) التقارب", 0.25)], D23)
    q("q9", "4أ", B, r"بيّن أنّه: من أجل كلّ عدد طبيعي $n$ $7-u_{n+1}<\frac{1}{4}(7-u_n)$ .", 0.25, [el("q9-e1", "4أ) البرهان", 0.25)], D23)
    q("q10", "4ب", B, r"استنتج أنّه: من أجل كلّ عدد طبيعي $n$ $0<7-u_n<3\left(\dfrac{1}{4}\right)^n$ ، ثمَّ احسب نهاية المتتالية $(u_n)$ .", 0.5,
      [el("q10-e1", "4ب) استنتاج الحصر", 0.25), el("q10-e2", "4ب) نهاية المتتالية", 0.25)], D23)

    mcq("q4", "q4-e1", r"لتبيان أنّ الدالة $f$ متزايدة تماما على المجال $[4;7[$ نحسب مشتقتها: ما عبارة $f'(x)$؟", r"$f'(x)=\dfrac{1}{2\sqrt{x+2}}$",
        [r"$f'(x)=\dfrac{1}{\sqrt{x+2}}$", r"$f'(x)=\dfrac{-1}{2\sqrt{x+2}}$", r"$f'(x)=\dfrac{1}{2\sqrt{x+2}}+4$"],
        r"$f'(x)=\dfrac{1}{2\sqrt{x+2}}$ ومنه الدّالة $f$ متزايدة تماما على المجال $[4;7[$.", 0.75, AN)
    deferred("q5", "q5-e1", "essay_builder", r"1ب) تحرير الاستنتاج: من أجل كل $x$ من $[4;7[$ فإنّ $f(x)\in[4;7[$.", 0.5, AN, PROOF,
             "من أجل كل عدد حقيقي x من المجال [4;7[ يكون: f(x) ∈ [4;7[ (0.5)", r"$f(x)\in[4;7[$")
    deferred("q6", "q6-e1", "essay_builder", "2) تحرير برهان عبارة الفرق المعطاة ثم استنتاج إشارته.", 0.75, AN, PROOF,
             "f(x) − x = (−x²+9x−14)/(√(x+2)+x−4) ومن أجل كل x من المجال [4;7[ : f(x) − x > 0 (0.75)",
             r"$f(x)-x=\dfrac{-x^2+9x-14}{x-4+\sqrt{x+2}}$ ; $f(x)-x>0$")
    deferred("q7", "q7-e1", "essay_builder", r"3أ) تحرير البرهان بالتراجع: من أجل كل عدد طبيعي $n$ ، $4\le u_n<7$.", 0.75, SEQ, PROOF,
             "برهان بالتّراجع أنّه من أجل كلّ عدد طبيعي n : 4 ≤ u(n) < 7 (0.75)", r"$4\le u_n<7$")
    mcq("q8", "q8-e1", r"لدينا $u_{n+1}-u_n=f(u_n)-u_n$: ما اتجاه تغيّر المتتالية $(u_n)$؟", r"$(u_n)$ متزايدة تماما",
        [r"$(u_n)$ متناقصة تماما", r"$(u_n)$ ثابتة", r"$(u_n)$ ليست رتيبة"],
        r"لدينا $u_{n+1}-u_n=f(u_n)-u_n$ إذن $u_{n+1}-u_n>0$ ومنه المتتالية $(u_n)$ متزايدة تماما.", 0.25, SEQ)
    deferred("q8", "q8-e2", "essay_builder", r"3ب) تحرير تبيان أنّ المتتالية $(u_n)$ متقاربة.", 0.25, SEQ, PROOF,
             "(u_n) متقاربة (0.25) — دون تعليل مكتوب في التصحيح", "متقاربة")
    deferred("q9", "q9-e1", "essay_builder", r"4أ) تحرير برهان المتباينة المعطاة في السؤال من أجل كل عدد طبيعي $n$.", 0.25, SEQ, PROOF,
             "برهان أنّه من أجل كلّ عدد طبيعي n : 7 − u(n+1) < ¼(7 − u(n)) (0.25)", r"$7-u_{n+1}<\frac{1}{4}(7-u_n)$")
    deferred("q10", "q10-e1", "essay_builder", r"4ب) تحرير استنتاج الحصر المعطى في السؤال من أجل كل عدد طبيعي $n$.", 0.25, SEQ, PROOF,
             "استنتاج أنّه من أجل كلّ عدد طبيعي n : 0 < 7 − u(n) < 3/4^n (0.25)", r"$0<7-u_n<\dfrac{3}{4^n}$")
    num("q10", "q10-e2", r"احسب نهاية المتتالية $(u_n)$ ثم اكتب قيمتها العددية في الخانة.", 7, 0,
        r"حسب مبرهنة الحصر تكون نهاية المتتالية: $\lim_{n\to+\infty}u_n=7$.", 0.25, SEQ)

    # ── التمرين الثالث ──
    D3 = [doc("d-ex3", "نصّ التمرين", r"المستوي المركب منسوب إلى المعلم المتعامد والمتجانس $(O;\vec{u},\vec{v})$." "\n"
              r"نعتبر النّقط $A$ ، $B$ و $C$ التي لاحقاتها $z_A$ ، $z_B$ و $z_C$ على التّرتيب حيث:" "\n"
              r"$z_A=\sqrt{2}+i\sqrt{6}$ ، $z_B=\overline{z_A}$ و $z_C=-2z_A$ .")]
    q("q11", "1أ", C, r"اكتب العدد المركب $z_A$ على الشكل الأسي .", 1, [el("q11-e1", "1أ) الشكل الأسي لـ zA", 1)], D3)
    q("q12", "1ب", C, r"احسب العدد $\left(\dfrac{z_A}{2\sqrt{2}}\right)^{2019}+\left(\dfrac{z_B}{2\sqrt{2}}\right)^{2019}$ .", 0.5, [el("q12-e1", "1ب) الحساب", 0.5)], D3)
    q("q13", "2أ", C, r"$T$ الانسحاب الذي يحوِّل $A$ إلى $C$ ، عيّن $z_D$ لاحقة النّقطة $D$ صورة $B$ بالانسحاب $T$ .", 0.75, [el("q13-e1", "2أ) حساب zD", 0.75)], D3)
    q("q14", "2ب", C, r"استنتج طبيعة الرّباعي $ABDC$ .", 0.75, [el("q14-e1", "2ب) طبيعة الرباعي ABDC", 0.75)], D3)
    q("q15", "3", C, r"اكتب العدد المركب $z_C-z_A$ على الشكل الأسي.", 0.75, [el("q15-e1", "3) الشكل الأسي لـ zC − zA", 0.75)], D3)
    q("q16", "4", C, r"جد قيم العدد الطّبيعي $n$ التي يكون من أجلها العدد المركب $\left(\dfrac{-6\sqrt{2}}{z_C-z_A}\right)^n$ عددا حقيقيا.", 0.5,
      [el("q16-e1", "4) قيم n", 0.5)], D3)
    q("q17", "5", C, r"لتكن $M$ نقطة كيفيّة من المستوي لاحقتها $z$ حيث $M$ تختلف عن $A$ وتختلف عن $C$ ." "\n"
      r"عيّن $(E)$ مجموعة النّقط $M$ التي من أجلها يكون $\dfrac{z_A-z}{z_C-z}$ عددا حقيقيا موجبا تماما.", 0.75, [el("q17-e1", "5) المجموعة (E)", 0.75)], D3)

    deferred("q11", "q11-e1", "essay_builder", r"1أ) كتابة العدد المركب $z_A$ على الشكل الأسي.", 1, CPLX, MISSING, "الشكل الآسي لـ zA . (01) — بلا نتيجة")
    deferred("q12", "q12-e1", "essay_builder", "1ب) حساب العدد المطلوب في السؤال (مجموع القوّتين 2019).", 0.5, CPLX, MISSING, "حساب (zA/2√2)^2019 + (zB/2√2)^2019 (0.5) — بلا نتيجة")
    deferred("q13", "q13-e1", "essay_builder", r"2أ) حساب $z_D$ لاحقة صورة $B$ بالانسحاب $T$.", 0.75, CPLX, MISSING, "حساب zD صورة B بواسطة T (0.75) — بلا نتيجة")
    mcq("q14", "q14-e1", r"استنتج طبيعة الرباعي $ABDC$.", "متوازي أضلاع", ["مستطيل", "معيّن", "مربّع"], r"الرّباعي $ABDC$ متوازي أضلاع.", 0.75, CPLX)
    mcq("q15", "q15-e1", r"اكتب العدد المركب $z_C-z_A$ على الشكل الأسي: أيّ كتابة هي الصحيحة؟", r"$6\sqrt{2}e^{i\frac{4\pi}{3}}$",
        [r"$6\sqrt{2}e^{i\frac{\pi}{3}}$", r"$3\sqrt{2}e^{i\frac{4\pi}{3}}$", r"$6\sqrt{2}e^{i\frac{2\pi}{3}}$"],
        r"الشكل الأسّي للعدد المركب $z_C-z_A$ هو $6\sqrt{2}e^{i\frac{4\pi}{3}}$.", 0.75, CPLX)
    mcq("q16", "q16-e1", r"اكتب العدد المركب $\left(\dfrac{-6\sqrt{2}}{z_C-z_A}\right)^n$ على الشكل الأسي بدلالة العدد الطبيعي $n$.", r"$e^{-in\frac{\pi}{3}}$",
        [r"$e^{in\frac{\pi}{3}}$", r"$e^{-in\frac{2\pi}{3}}$", r"$2^ne^{-in\frac{\pi}{3}}$"],
        r"$\left(\dfrac{-6\sqrt{2}}{z_C-z_A}\right)^n=e^{-in\frac{\pi}{3}}$", 0.25, CPLX)
    NK = r"قيم $n$ هي الأعداد {} حيث $k$ عدد صحيح سالب أو معدوم ($k\in\mathbb{{Z}}_-$)"
    mcq("q16", "q16-e1", r"ما قيم العدد الطبيعي $n$ الّتي يكون من أجلها هذا العدد حقيقيا؟", NK.format("$n=-3k$"),
        [NK.format("$n=-6k$"), NK.format("$n=-2k$"), NK.format("$n=-3k+1$")],
        r"العدد $e^{-in\frac{\pi}{3}}$ حقيقي يعني أنّ $n=-3k$ حيث $k$ عدد صحيح سالب أو معدوم ($k\in\mathbb{Z}_-$).", 0.25, CPLX)
    mcq("q17", "q17-e1", r"عيّن $(E)$ مجموعة النقط $M$ الّتي من أجلها يكون $\dfrac{z_A-z}{z_C-z}$ عددا حقيقيا موجبا تماما.",
        r"$(E)$ هي المستقيم $(AC)$ باستثناء القطعة المستقيمة $[AC]$",
        [r"$(E)$ هي القطعة المستقيمة $[AC]$ باستثناء النقطتين $A$ و $C$", r"$(E)$ هي المستقيم $(AC)$ باستثناء النقطتين $A$ و $C$", r"$(E)$ هي محور القطعة $[AC]$"],
        r"$(E)$ هي المستقيم $(AC)$ باستثناء القطعة المستقيمة $[AC]$ أي أنّ $(E)=(AC)-[AC]$.", 0.75, CPLX)

    # ── التمرين الرابع ──
    D4 = [doc("d-ex4", "نصّ التمرين", r"المستوي منسوب إلى المعلم المتعامد والمتجانس $(O;\vec{i},\vec{j})$. تُؤخذ وحدة الطول $2cm$" "\n"
              r"$(\mathscr{C}_f)$ و $(\mathscr{C}_g)$ التمثيلان البيانيان للدالتين $f$ و $g$ المعرّفتين على $\mathbb{R}$ كما يلي:" "\n"
              r"$g(x)=e^x-ex$ و $f(x)=e^x-\dfrac{1}{2}ex^2$")]
    D47 = D4 + [doc("d-ex4-7", "معطيات السؤال 7", r"$h$ الدالة المعرّفة على المجال $[-2;2]$ كما يلي: $h(x)=\dfrac{1}{2}ex^2-e^{|x|}$ و ليكن $(\Gamma)$ تمثيلها البياني في المعلم السابق.")]
    q("q18", "1أ", D, r"ادرس اتجاه تغير الدالة $g$ .", 1, [el("q18-e1", "1أ) دراسة اتجاه تغيّر g (0.5×2)", 1)], D4)
    q("q19", "1ب", D, r"استنتج اشارة $g(x)$ حسب قيم $x$ الحقيقية.", 1, [el("q19-e1", "1ب) القيمة الحدّية الصغرى وإشارة g(x) (0.5×2)", 1)], D4)
    q("q20", "2", D, r"ادرس اتجاه تغيّر الدالة $f$ .", 1, [el("q20-e1", "2) عبارة f'(x)", 0.5), el("q20-e2", "2) اتجاه تغيّر f", 0.5)], D4)
    q("q21", "3", D, r"احسب كلاً من $\lim_{x\to-\infty}f(x)$ و $\lim_{x\to+\infty}f(x)$ ؛ ثمّ شكّل جدول تغيّرات الدالة $f$ .", 0.75,
      [el("q21-e1", "3) النهاية عند −∞", 0.25), el("q21-e2", "3) النهاية عند +∞", 0.25), el("q21-e3", "3) جدول التغيّرات", 0.25)], D4)
    q("q22", "4", D, r"ادرس الوضع النسبي للمنحنيين $(\mathscr{C}_f)$ و $(\mathscr{C}_g)$ على $\mathbb{R}$ .", 1.25,
      [el("q22-e1", "4) عبارة f(x) − g(x)", 0.5), el("q22-e2", "4) الوضعية النسبية", 0.75)], D4)
    q("q23", "5", D, r"ارسم على المجال $[0;2]$ المنحنيين $(\mathscr{C}_f)$ و $(\mathscr{C}_g)$ في نفس المعلم $(O;\vec{i},\vec{j})$. (يُعطى $\mathrm{e}^2-2e\approx 2$)", 0.5,
      [el("q23-e1", "5) رسم المنحنى Cf", 0.25), el("q23-e2", "5) رسم المنحنى Cg", 0.25)], D4)
    q("q24", "6", D, r"احسب بالسنتمتر المربّع، مساحة الحيّز المستوي المحدّد بالمنحنيين $(\mathscr{C}_f)$ و $(\mathscr{C}_g)$.", 0.5,
      [el("q24-e1", "6) المساحة بوحدة المساحات", 0.25), el("q24-e2", "6) المساحة بالسنتمتر المربع", 0.25)], D4)
    q("q25", "7أ", D, r"بيّن أنّ $h$ دالة زوجية.", 0.25, [el("q25-e1", "7أ) h دالة زوجية", 0.25)], D47)
    q("q26", "7ب", D, r"من أجل $x\in[0;2]$ احسب $h(x)+f(x)$ ثم استنتج كيفية رسم $(\Gamma)$ انطلاقا من $(\mathscr{C}_f)$ ثم ارسمه.", 0.75,
      [el("q26-e1", "7ب) حساب h(x) + f(x)", 0.25), el("q26-e2", "7ب) استنتاج كيفية رسم (Γ)", 0.25), el("q26-e3", "7ب) الرسم", 0.25)], D47)

    mcq("q18", "q18-e1", r"من أجل كل عدد حقيقي $x$: ما عبارة الدالة المشتقة $g'(x)$؟", r"$g'(x)=e^x-e$", [r"$g'(x)=e^x-ex$", r"$g'(x)=e^x-1$", r"$g'(x)=e^x$"],
        r"من أجل كل عدد حقيقي $x$: $g'(x)=e^x-e$.", 0.5, AN)
    deferred("q18", "q18-e1", "essay_builder", r"1أ) دراسة إشارة $g'(x)$ واتجاه تغيّر الدالة $g$.", 0.5, AN, MISSING,
             "دراسة اتجاه تغيّر الدالة g (0.5×2): يكتب التصحيح g'(x) = e^x − e فقط، دون مجالات التغيّر")
    mcq("q19", "q19-e1", r"تقبل الدالة $g$ قيمة حدّية صغرى: ما هي؟", r"$g(1)=e^1-e=0$", [r"$g(0)=1$", r"$g(1)=e$", r"$g(e)=0$"],
        r"الدالة $g$ تقبل قيمة حدّية صغرى هي $g(1)=e^1-e=0$.", 0.5, AN)
    mcq("q19", "q19-e1", r"استنتج إشارة $g(x)$ حسب قيم $x$ الحقيقية.", r"$g(x)\ge 0$ من أجل كل عدد حقيقي $x$",
        [r"$g(x)>0$ من أجل كل عدد حقيقي $x$", r"$g(x)\le 0$ من أجل كل عدد حقيقي $x$", r"$g(x)<0$ من أجل كل عدد حقيقي $x$ أصغر من 1، و $g(x)>0$ من أجل كل $x$ أكبر من 1"],
        r"لدينا $g(1)=e^1-e=0$ إذن من أجل كل عدد حقيقي $x$: $g(x)\ge 0$.", 0.5, AN)
    mcq("q20", "q20-e1", r"من أجل كل عدد حقيقي $x$: ما عبارة الدالة المشتقة $f'(x)$؟", r"$f'(x)=e^x-ex=g(x)$",
        [r"$f'(x)=e^x-ex^2$", r"$f'(x)=e^x-e=g'(x)$", r"$f'(x)=e^x-\dfrac{1}{2}ex$"], r"من أجل كل عدد حقيقي $x$: $f'(x)=e^x-ex=g(x)$.", 0.5, AN)
    mcq("q20", "q20-e2", r"ما اتجاه تغيّر الدالة $f$؟", r"$f$ متزايدة تماما على $\mathbb{R}$",
        [r"$f$ متناقصة تماما على $\mathbb{R}$", r"$f$ متناقصة على $]-\infty;1]$ ومتزايدة على $[1;+\infty[$", r"$f$ متزايدة على $]-\infty;1]$ ومتناقصة على $[1;+\infty[$"],
        r"لدينا $f'(1)=g(1)=0$ ومن أجل $x\in\mathbb{R}-\{1\}$: $g(x)>0$ أي $f'(x)>0$، إذاً الدالة $f$ متزايدة تماما على $\mathbb{R}$.", 0.5, AN)
    mcq("q21", "q21-e1", r"احسب النهاية $\lim_{x\to-\infty}f(x)$ واختر قيمتها من بين الخيارات.", r"$-\infty$", [r"$+\infty$", "$0$", "$1$"],
        r"النهاية عند $-\infty$ تساوي $-\infty$، لأنّ نهاية $e^x$ عند $-\infty$ هي $0$ ونهاية $-\dfrac{1}{2}ex^2$ عند $-\infty$ هي $-\infty$.", 0.25, AN)
    mcq("q21", "q21-e2", r"احسب النهاية $\lim_{x\to+\infty}f(x)$ واختر قيمتها من بين الخيارات.", r"$+\infty$", [r"$-\infty$", "$0$", "$1$"],
        r"حسب الإجابة النموذجية النهاية هي $+\infty$؛ نحلّل $f(x)$ بإخراج $x^2$ عاملا مشتركا ثم نستعمل $\lim_{x\to+\infty}\dfrac{e^x}{x^2}=+\infty$.", 0.25, AN)
    deferred("q21", "q21-e3", "variation_table", "3) تشكيل جدول تغيّرات الدالة $f$.", 0.25, AN, "variation_table", "جدول التغيرات (0.25)", None,
             {"function": "$f$", "domain": r"$\mathbb{R}$", "derivative": r"$f'(x)=e^x-ex=g(x)$", "increasing": [r"$\mathbb{R}$"],
              "limits": [r"$\lim_{x\to-\infty}f(x)=-\infty$", r"$\lim_{x\to+\infty}f(x)=+\infty$"]})
    mcq("q22", "q22-e1", r"من أجل كل عدد حقيقي $x$: ما عبارة الفرق $f(x)-g(x)$؟", r"$f(x)-g(x)=ex\left(-\dfrac{1}{2}x+1\right)$",
        [r"$f(x)-g(x)=ex\left(\dfrac{1}{2}x+1\right)$", r"$f(x)-g(x)=ex\left(-\dfrac{1}{2}x-1\right)$", r"$f(x)-g(x)=-\dfrac{1}{2}ex^2$"],
        r"$f(x)-g(x)=ex\left(-\dfrac{1}{2}x+1\right)$", 0.5, AN)
    UNDER, OVER = r"المنحنى $(\mathscr{C}_f)$ يقع تحت المنحنى $(\mathscr{C}_g)$", r"المنحنى $(\mathscr{C}_f)$ يقع فوق المنحنى $(\mathscr{C}_g)$"
    CROSS = r"المنحنيان $(\mathscr{C}_f)$ و $(\mathscr{C}_g)$ يتقاطعان في نقط هذه المجموعة"
    for where, ok, wrong in [(r"$x\in]-\infty;0[\cup]2;+\infty[$", UNDER, [OVER, CROSS]), (r"$x\in]0;2[$", OVER, [UNDER, CROSS]), (r"$x\in\{0;2\}$", CROSS, [UNDER, OVER])]:
        mcq("q22", "q22-e2", f"من أجل {where}: ما الوضع النسبي للمنحنيين؟", ok, wrong, f"حسب الإجابة النموذجية: من أجل {where} {ok}.", 0.25, AN)
    deferred("q23", "q23-e1", "function_plot", r"5) رسم المنحنى $(\mathscr{C}_f)$ على المجال $[0;2]$.", 0.25, AN, "drawing", "الرسم: (Cf) (0.25)", None,
             {"curves": [r"$(\mathscr{C}_f)$"], "interval": "$[0;2]$", "given": r"$\mathrm{e}^2-2e\approx 2$", "unit": "2cm"})
    deferred("q23", "q23-e2", "function_plot", r"5) رسم المنحنى $(\mathscr{C}_g)$ على المجال $[0;2]$.", 0.25, AN, "drawing", "الرسم: (Cg) (0.25)", None,
             {"curves": [r"$(\mathscr{C}_g)$"], "interval": "$[0;2]$", "given": r"$\mathrm{e}^2-2e\approx 2$", "unit": "2cm"})
    mcq("q24", "q24-e1", r"احسب مساحة الحيّز المستوي المحدّد بالمنحنيين على المجال $[0;2]$ بوحدة المساحات $ua$.", r"$A=\dfrac{2e}{3}\,ua$",
        [r"$A=\dfrac{4e}{3}\,ua$", r"$A=\dfrac{8e}{3}\,ua$", r"$A=\dfrac{e}{3}\,ua$"],
        r"$A=\int_0^2\left(-\dfrac{1}{2}ex^2+ex\right)dx=\left[-\dfrac{1}{6}ex^3+\dfrac{1}{2}ex^2\right]_0^2=\dfrac{2e}{3}\,ua$", 0.25, AN)
    mcq("q24", "q24-e2", r"وحدة الطول $2cm$: ما قيمة هذه المساحة بالسنتمتر المربّع؟", r"$A=\dfrac{8e}{3}\,cm^2$",
        [r"$A=\dfrac{4e}{3}\,cm^2$", r"$A=\dfrac{2e}{3}\,cm^2$", r"$A=\dfrac{16e}{3}\,cm^2$"], r"$A=\dfrac{8e}{3}\,cm^2$", 0.25, AN)
    deferred("q25", "q25-e1", "essay_builder", r"7أ) تحرير تبيان أنّ $h$ دالة زوجية.", 0.25, AN, PROOF, "h دالة زوجية (0.25)", r"$h$ دالة زوجية")
    deferred("q26", "q26-e1", "essay_builder", r"7ب) حساب $h(x)+f(x)$ من أجل $x\in[0;2]$.", 0.25, AN, MISSING, "حساب h(x) + f(x) (0.25) — بلا نتيجة")
    deferred("q26", "q26-e2", "essay_builder", r"7ب) استنتاج كيفية رسم $(\Gamma)$ انطلاقا من $(\mathscr{C}_f)$.", 0.25, AN, MISSING,
             "استنتاج كيفية رسم (Γ) انطلاقا من (Cf) (0.25) — بلا نتيجة")
    deferred("q26", "q26-e3", "function_plot", r"7ب) رسم المنحنى $(\Gamma)$.", 0.25, AN, "drawing", "الرسم (0.25)", None,
             {"curves": [r"$(\Gamma)$"], "interval": "$[-2;2]$"})

    title = "بكالوريا 2019 (الدورة العادية) – الرياضيات – شعبة علوم تجريبية – الموضوع الثاني"
    notes = (NOTES_COMMON +
             " قرارات الموضوع الثاني: سطر الرموز في التمرين الرابع مطبوع وعبارة g على اليمين فنُقل بترتيب القراءة «g(x)=… و f(x)=…». "
             "بنود يذكرها التصحيح بلا نتيجة فأُجِّلت (official_result_missing): احتمالات قانون X في التمرين1 (1 ن من سطر 1.5؛ القيم 0،1،2،4،8 "
             "مذكورة فصارت multi بـ0.5 — تقسيم 0.5/1 اجتهاد يُراجَع)، الشكل الأسي لـ zA (1)، حساب المجموع ذي القوّة 2019 (0.5)، zD (0.75)، "
             "اتجاه تغيّر g (0.5 من «0.5×2»)، h(x)+f(x) (0.25)، كيفية رسم (Γ) (0.25). براهين بلا نتيجة وسيطة (proof_without_intermediate): "
             "7/24 (1)، f(x)∈[4;7[ (0.5)، عبارة f(x)−x وإشارتها (0.75)، التراجع (0.75)، التقارب (0.25 — التصحيح لا يكتب التعليل)، 4أ (0.25)، "
             "حصر 4ب (0.25)، زوجية h (0.25). التصحيح يكتب في التمرين4 س6 «A=∫[g(x)−f(x)]dx=∫(−½ex²+ex)dx» والمكامَل هو f−g (سهو في "
             "التصحيح)؛ استُعملت النتيجتان 2e/3 ua و 8e/3 cm² فقط. شرط n في التمرين3 س4 بصيغة التصحيح n=−3k حيث k∈ℤ₋ (أي k عدد صحيح "
             "سالب أو معدوم). مؤجَّل: 9.25 ن (منها رسم 0.75 وجدول تغيّرات 0.25).")
    return title, notes


NOTES_COMMON = (
    "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الموضوع والتصحيح ملفّا PDF من الديوان الوطني للامتحانات والمسابقات (دورة 2019، الشعبة: علوم "
    "تجريبية؛ «الدورة العادية» من عنوان الملف في Drive). للملفّين طبقة نصّ من Word لكنها غير صالحة مصدرا: أرقام الخطّ العربي مقلوبة "
    "(04→40، 05→45، 07→70، 0.25→0725، 4)→0)، 2019→9102، 120→127)، والشدّات ساقطة (بيّن أنّ→بين أن)، والمعادلات رموز خطّ Symbol "
    "(أقواس المجالات و ℝ ℂ ℕ و² تسقط من النصّ المستخرَج أو تتشوّه)؛ فنُسخ كلّ "
    "نصّ وكلّ علامة من صور الصفحات (200 و300 نقطة/بوصة مع تكبير)، وقوبلت الأقواس وترتيب الصيغ بمواضع الرموز في الطبقة (pdftotext -bbox). "
    "اختلاف الصورة والطبقة: في صورة التصحيح (الموضوع الأول، التمرين4 س2) لا يظهر رمز «²» في f'(x) والطبقة تحويه: "
    "f'(x)=(x²−5x+4)/(x(x−2)²) وهو ما تقتضيه مجالات التغيّر في التصحيح نفسه. الصيغ بـ LaTeX بين $…$ كما طُبعت؛ الترتيب المنطقي لصيغ متعدّدة بينها "
    "كلمات عربية هو ترتيب القراءة من اليمين (النقط A ، B و C)؛ المسافات موحَّدة. لا شكل في هذه الورقة (لا قصّ). "
    "قواعد التحويل: عنصر لكل سطر علامة في السلّم (يبقى «×n» في التسمية)؛ الإجابات الصحيحة من الإجابة النموذجية بصيغتها، والمشتّتات من إعداد "
    "التحويل وتختلف عدديًّا عن الإجابة؛ numeric حين يطبع التصحيح عددا صحيحا (هامش 0)؛ «بيّن/برهن/استنتج أنّ» تفاعلية فقط عبر نتيجة وسيطة يكتبها "
    "التصحيح وإلا فـ essay_builder مؤجَّل؛ ما يذكره التصحيح بلا نتيجة مؤجَّل ولا يحسبه المحوِّل؛ الرسم function_plot وجدول التغيّرات variation_table.")


TITLE, NOTES = paper1() if PAPER == 1 else paper2()

# ───────────────────────────── local checks ─────────────────────────────
_SKILLS_TS = ROOT / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(math\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) >= 6, "skills.ts not parsed"
MATH_RE = re.compile(r"\$\$([^$]+)\$\$|\$([^$\n]+)\$")  # = rich-text.tsx


def _dir(s):
    """= textDir() in src/components/play/rich-text.tsx (counts LaTeX letters too)"""
    ar = len(re.findall("[؀-ۿ]", s))
    la = len(re.findall("[A-Za-z]", s))
    return ar, la, ("ltr" if la > ar else "rtl")


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
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for e in qq["rubric_elements"]:
            assert "$" not in e["label"], (e["id"], "labels are plain text")
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    got, flips, verb_flips, latex = {}, [], [], []
    for qq in Q:
        latex += [qq["verbatim_text"], *[d["text"] for d in qq["documents"]]]
        for t in [qq["verbatim_text"], *[d["text"] for d in qq["documents"]]]:
            ar, la, d = _dir(t)  # RichText decides the direction once for the whole string
            if ar and d == "ltr":
                verb_flips.append((qq["id"], ar, la, t[:70]))
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        shown = [s["prompt"], s["explanation"]]
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
            shown += p["options"]
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
        if t == "numeric":
            assert isinstance(a["value"], (int, float)) and a["tolerance"] >= 0, s["id"]
        if t in ("essay_builder", "table_fill", "variation_table", "function_plot"):
            assert s["review_status"] == "needs_engine_support", s["id"]
            latex += [s["prompt"]]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            latex += shown
            for x in shown:  # النصوص الّتي يكتبها المحوِّل يجب أن تُعرض من اليمين إلى اليسار
                ar, la, d = _dir(x)
                if ar and d == "ltr":
                    flips.append((s["id"], ar, la, x))
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"
    assert not flips, "converter-written strings that rich-text.tsx would render LTR:\n" + "\n".join(map(str, flips))
    # KaTeX: every $…$ must parse (same library as the renderer)
    spans = sorted({(m.group(1) or m.group(2)).strip() for x in latex for m in MATH_RE.finditer(x)})
    js = ("const k=require(process.argv[1]);let bad=0;for(const t of JSON.parse(require('fs').readFileSync(0,'utf8'))){"
          "try{k.renderToString(t,{throwOnError:true,strict:'error'})}catch(e){bad++;console.log('KATEX',t,e.message)}}process.exit(bad?1:0)")
    katex = ROOT / "node_modules" / "katex"
    if katex.exists():
        r = subprocess.run(["node", "-e", js, str(katex)], input=json.dumps(spans), capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr
    else:
        print("warning: node_modules/katex missing — LaTeX not parsed")
    return spans, verb_flips


SPANS, VERB_FLIPS = _check()

doc_json = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{PAPER_ID}-p{PAPER}",
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "MATH", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated",
                    "note": "تحويل تجريبي للرياضيات من صور الموضوع والإجابة النموذجية الرسميّين في Drive؛ العلامات من سلّم التنقيط؛ الإجابات الصحيحة من الإجابة النموذجية؛ المشتّتات من إعداد التحويل وتحتاج مراجعة."}],
}
pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
json.dump(doc_json, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
inter = sum(s["points"] for s in S if s["review_status"] == "needs_human_review")
types = {}
for s in S:
    types[s["type"]] = types.get(s["type"], 0) + 1
print(f"{SET_ID}: {len(Q)} questions, {sum(len(qq['rubric_elements']) for qq in Q)} elements, {len(S)} steps {types}, "
      f"{sum(s['points'] for s in S)} points (interactive {inter}, deferred {20 - inter}), {len(SPANS)} LaTeX spans parsed")
for f in VERB_FLIPS:
    print("  verbatim rendered LTR by rich-text.tsx (ar, latin):", f)
