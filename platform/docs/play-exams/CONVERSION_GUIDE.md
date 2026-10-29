# Converting an exam + its correction into a PLAY exam set

Audience: whoever converts (human or agent). Read fully before converting. Arabic summary for the owner is in `README-AR.md`.

## Non-negotiable rules

1. **No fabrication.** Every original question, document text and mark comes from the source files. If a value is unreadable, stop and record a blocker; never guess.
2. **Verbatim originals.** `original_questions[].verbatim_text` and `documents[]` are copied character for character from the source export (keep diacritics, tatweel, punctuation). Never "fix" them.
3. **Correct answers come only from the correction / model answer** (`حل`, `تصحيح`, `الإجابة النموذجية`, `سلم التنقيط`). No correction ⇒ the set stays `BLOCKED` (or `NEEDS_HUMAN_REVIEW` with `source.correction_* = null`, which the validator refuses to publish).
4. **Marks.** One `rubric_element` per mark line of the official rubric (e.g. «1.5 ن (1 الرّبط بالشّاهد + 0.5 الغرض)» ⇒ two elements 1 and 0.5). Elements of a question sum to its mark; questions sum to `score_total` (20 for BAC, the paper's total otherwise).
5. **Steps.** Each training step belongs to exactly one element. Steps of an element share its mark: Σ `points` = `max_points` (multiples of 0.25 preferred). Never inflate.
6. **Derived ≠ original.** Steps are derived training (`is_verbatim_original: false`) unless the prompt is the original question text exactly.
7. **Status.** Every set you produce: `"status": "NEEDS_HUMAN_REVIEW"`, every interactive step `"review_status": "needs_human_review"`, `source.verified: false`, rubric `verified: false`. Only the owner approves.
8. **Unsupported interactions are deferred, not forced.** Essay / integration situation (الوضعية الإدماجية, المقال), table filling, graphs, maps, variation tables ⇒ steps of type `essay_builder`, `table_fill`, `bar_chart`, `map_locate`, `variation_table`, `function_plot` with `payload: {type, spec:{…}}`, `answer: {type, spec:{…}}`, `review_status: "needs_engine_support"`, one step per rubric criterion carrying that criterion's mark. Do not turn them into MCQ.
9. **Stream-specific parts.** When a question has alternative parts per stream («أ) لشعبة آداب وفلسفة / ب) لشعبة لغات أجنبية»), put `"streams": ["LIT"]` on the (أ) rubric elements and `"streams": ["LANG"]` on the (ب) elements (codes must be among `source.streams`). For every stream, the applicable elements of the question must sum to its mark and all applicable steps must sum to `score_total`; students only see the steps of their stream.
10. **Exact comparisons.** Options are compared character for character (diacritics and symbols count), so i'rab options that differ only by harakat, or prosody symbols like `//0/0` vs `/0//0`, are valid distinct options. Fill-blank grading is exact whenever two bank words differ only by diacritics.
11. **Open answers stay deferred.** If the model answer accepts any reasoned answer («يُقبل كلّ رأي معلّل», «تُقبل كلّ إجابة مناسبة», «جملة من إنشاء المترشّح»), the element is deferred as `essay_builder` (spec: the criterion and the model's example). Never turn it into an MCQ where reasoned alternatives are marked wrong, and never add rules that the correction does not state.
12. **Captions are ours, not the paper's.** `documents[].caption` is a neutral label («النّصّ», «تقديم النّصّ»). Never put the metre, genre, school or any other answer in a caption; the validator rejects answers that appear in a caption but not on the paper (`ANSWER_IN_CAPTION`).
13. **Year.** Only what the paper or the official archive states (BAC year); the owner's tests/devoirs have `year: null`.
14. **Images.** Never invent or describe an image as if shown. Portrait steps require a real local file in `public/` with `source_url`, `license`, `attribution`, `image_verified_at`, `sha256`; otherwise do not create the portrait step.

## Interaction types available now

| type | payload | answer | grading |
|---|---|---|---|
| `mcq` | `options: string[]` (3–4) | `correct: index` | 0/1 |
| `multi` | `options` (≥3) | `correct: index[]` | (hits − wrong)/|correct|, clamped |
| `fill_blank` | `text` with `____` holes, `bank: string[]` (answers + 2–3 distractors) | `blanks: string[][]` (accepted variants per hole) | share of holes (Arabic-normalised) |
| `matching` | `lefts`, `rights` (rights may have extra distractors) | `pairs[i]` = index in `rights` for `lefts[i]`, all distinct | share of pairs |
| `ordering` | `items` (in correct order before shuffling) | `order: [0..n-1]` | share of positions |
| `numeric` | `unit` | `value`, `tolerance`, `unit` | within tolerance |
| `short_text` | — | `accepted: string[]` | normalised equality |

Distractors must be plausible and clearly wrong *according to the correction*. Use the correction's own wording for the right option and for `explanation`.

Good decomposition patterns (see the exemplar):
- «بمَ ربط… وما غرضه؟» ⇒ mcq for the idea + matching idea ↔ evidence verse + mcq for the purpose.
- «اذكر أربعة مظاهر» (0.5 each) ⇒ multi (pick the 4 among 6) + matching manifestation ↔ verse.
- «أعرب ما تحته خط» ⇒ one mcq per word/sentence (one element each) with the model i'rab as the correct option and near-miss i'rabs as distractors.
- «حدّد نوع الصورة واشرحها وبيّن سرّ بلاغتها» ⇒ mcq type + fill_blank explanation + mcq effect.
- «حدّد أركان التشبيه» ⇒ matching ركن ↔ text, with one extra distractor.
- Mark-scheme lines «0.25 النوع + 0.5 الشرح» become separate elements and steps.

## File layout

`content/play-exams/sets/<LEVEL>/<SUBJECT>/<set_id>.json`, `set_id` = lowercase ascii, e.g. `ar-2as-t1-sci-03`, `ar-3as-bac-2019-sci-p1`.
Schema: `src/server/play/exams/types.ts` (`ExamSetDocument`). Exemplar: `content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json` and its builder `scripts/play/converters/build_ar_2as_t1_sci_03.py`.

`source`:
- `kind`: `TEST` (اختبار فصلي), `DEVOIR` (فرض), `BAC`.
- `year`: BAC year; for tests/devoirs the school-year start (2026 for 2026/2027) only if stated or obvious from the owner's folder; else `null`.
- `level`: `1AS` (جذع مشترك), `2AS`, `3AS`, `4AM`.
- `streams`: PLAY codes — الشعب العلمية = `["SCI","MATH","TM","GE"]` (adjust to what the header lists: ع.ت=SCI، ر=MATH، ت.ر=TM، ت.ا=GE); آداب وفلسفة = `LIT`; لغات أجنبية = `LANG`; جذع مشترك علوم وتكنولوجيا = `TC_SCI`; جذع مشترك آداب = `TC_LIT`.
- `subject`: `AR` for اللغة العربية وآدابها.
- `term`: 1–3 (null for BAC); `paper`: 1|2 for BAC (الموضوع الأول/الثاني), else null.
- `original_file_ref` / `correction_file_ref`: `gdrive:<fileId> (<title>)`; `original_url` / `correction_url`: `https://drive.google.com/file/d/<fileId>/view`.
- `trust`: `owner_authored` for the owner's own tests and model answers; `official_mirror` for a BAC paper copied from the ministry/ONEC; `third_party` otherwise.

## Procedure

1. Read the exam and its correction (Drive `read_file_content`, the `.docx` export is the most faithful).
2. Write a builder `scripts/play/converters/build_<set_id>.py` (copy the exemplar's helpers) that emits the JSON. Keep the builder: it documents the conversion.
3. `python3 scripts/play/converters/build_<id>.py content/play-exams/sets/<…>/<id>.json && python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/<…>/<id>.json`
4. `npx tsx scripts/play/exams.ts validate` — must print `✓` for your set with **0 errors** and `20/20` (or the paper total). Fix and rebuild (rebuild + shuffle again from scratch, never shuffle twice).
5. Log blockers (unreadable text, missing correction, ambiguous underline, image-only question) in the builder's docstring and in `source.notes`.

## Appendix A — other subjects (owner decision 2026-10-29: «نعمّم البقية»)

### Reading PDF-only papers (most non-Arabic BAC papers have no Word copy)
1. `read_file_content <fileId>` gives an OCR text export: **columns are scrambled, marks are separated from their lines and there are OCR typos** («فلد» for «قاد»). Use it only as a helper.
2. The faithful source is the page image: `download_file_content <fileId>` (the result is saved to a file under `tool-results/`; decode `content` from base64 with `python3 -I`), then `pdftoppm -r 150 -png file.pdf page` in a fresh scratch directory and `Read` each PNG. Transcribe `verbatim_text`, documents and marks **from the image**, character by character; when the scan is unreadable, record a blocker — never guess.
3. Put «نُسخ النص من صورة الورقة الرسمية (لا نسخة Word)» in `source.notes`, plus every place where OCR and image disagreed.
4. Each ONEC PDF holds **both topics** (الموضوع الأول / الثاني): one set per topic (`paper` 1|2), each 20/20.
5. Same folder: `01_الموضوع.pdf` (paper) and `02_التصحيح.pdf` (official model answer + rubric). When the correction is inside the paper's PDF, use it and say so in `notes`.

### History & geography (التاريخ والجغرافيا) — `subject: "HIST"`
- One set per topic covers **both** history (10) and geography (10); `subject` is `HIST` (the platform's course code HISTGEO maps to HIST) and the set is also listed under الجغرافيا. `set_id`: `hg-bac-<year>-<sci|lit|lang|ge|litlang>-p<1|2>`, file under `content/play-exams/sets/3AS/HIST/`.
- `streams` exactly as the header lists them (آداب وفلسفة → LIT, لغات أجنبية → LANG, علوم تجريبية → SCI, رياضيات → MATH, تقني رياضي → TM, تسيير واقتصاد → GE; «الشعب العلمية» without detail → `["SCI","MATH","TM","GE"]` only if the header says so).
- `original_questions`: one per numbered task, `part` = «التاريخ — الجزء الأول» etc.
- **Terms (مصطلحات)**: one element per term (its mark) → `mcq` «ما المقصود بـ«…»؟», correct option = the correction's definition (its own wording, trimmed only of OCR noise), 3 distractors = definitions of *other* terms of the same programme (clearly not this term).
- **Persons (شخصيات)**: one element per person → `mcq` «من هو …؟», correct = the correction's identification (dates + role), distractors = identifications of other figures of the programme.
- **Event ↔ date / completing the events table**: one element per row (its own mark) → one `mcq` per row with 4 dates (or events) taken from the same table/programme.
- **Maps (التوقيع على الخريطة، أكمل المفتاح)**: deferred `map_locate`, one step per rubric line (العنوان / المفتاح / الإنجاز …) with its mark; never describe or reproduce the map.
- **Graphs / curves to draw**: deferred `bar_chart` or `function_plot`; a numeric table printed on the paper may be reproduced as a `table` document verbatim. «علّق على…» items may be interactive only if the data is reproduced (a printed table) and the correction states the conclusion; otherwise defer as `essay_builder`.
- **Part 2 (المقال التاريخي / الموضوع الجغرافي)**: deferred `essay_builder`, one step per rubric line (المقدمة، كل عنصر من العرض، الخاتمة) with its mark; the paragraph given to the candidate is a `text` document.
- `skill_id`: `hist.terms`, `hist.figures`, `hist.dates`, `hist.map`, `hist.essay`, `geo.terms`, `geo.data`, `geo.map`, `geo.essay`.

### Islamic sciences (العلوم الإسلامية) — `subject: "ISL"`
- `set_id`: `isl-bac-<year>-p<1|2>` (add `-<stream>` only if the header restricts streams), file under `content/play-exams/sets/3AS/ISL/`; streams as the header lists (usually all streams: `["SCI","MATH","TM","GE","LIT","LANG"]` when the header says «جميع الشعب»).
- Quranic verses and hadith are copied exactly as printed (with their diacritics, brackets and references); never complete or correct a verse from memory.
- Interactive: meanings of words, rulings stated in the correction, evidence ↔ ruling matching, concepts/definitions, «استخرج» items whose answer is printed in the text. Deferred `essay_builder`: «ناقش»، «علّل برأيك»، الوضعية الإدماجية، any item the correction accepts in several formulations.
- `skill_id`: `isl.vocab`, `isl.ruling`, `isl.evidence`, `isl.concept`, `isl.values`, `isl.writing`.

### English (`subject: "EN"`) and French (`subject: "FR"`)
- Content is shown left-to-right inside the Arabic interface (the runner sets `dir="ltr"` for these subjects). Write `prompt`, options, `explanation` and documents **in the subject's language**; keep the paper's own wording for originals. Do not translate.
- `set_id`: `en-bac-<year>-<sci|lit|lang|ge…>-p<1|2>` / `fr-bac-…`, files under `content/play-exams/sets/3AS/EN|FR/`; streams exactly as the header lists them.
- Reading passage = one `text` document (paragraph breaks as `\n`, line numbers only if printed).
- Interactive (one element per rubric line, its own mark): true/false statements (`mcq` True/False, or Vrai/Faux), comprehension answers stated in the key (`mcq`, correct = the key's answer), reference words («what do the underlined words refer to» → `mcq`), synonyms/opposites/definitions (`mcq` or `matching` within one element), word formation and grammar transformations with a single answer in the key (`mcq`: the key's form + 3 ungrammatical/incorrect variants), gap filling from a list (`fill_blank`), pronunciation classification (`matching`), re-ordering sentences (`ordering`).
- Deferred `essay_builder`: written expression (both topics/choices), any item the key says accepts several answers («accept any…», «toute réponse cohérente»).
- `skill_id`: `en.comprehension`, `en.vocabulary`, `en.grammar`, `en.phonology`, `en.discourse`, `en.writing` (French: `fr.comprehension`, `fr.vocabulaire`, `fr.grammaire`, `fr.enonciation`, `fr.discours`, `fr.ecriture`).
