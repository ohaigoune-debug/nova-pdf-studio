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
11. **Images.** Never invent or describe an image as if shown. Portrait steps require a real local file in `public/` with `source_url`, `license`, `attribution`, `image_verified_at`, `sha256`; otherwise do not create the portrait step.

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
