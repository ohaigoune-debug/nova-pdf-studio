# Independent audit: 5 Arabic exam sets against the Drive originals

Date: 2026-10-29. Auditor: independent reviewer (read-only; no set files edited).

Sources read from Drive for each set: `source.original_file_ref` (the exam) and `source.correction_file_ref` (الحلّ النّموذجيّ وسلّم التّنقيط).

**Method.**
- Each exam export was saved verbatim to scratch. Every `verbatim_text`, document text and poem cell was then compared to it by script: exact string match with diacritics and tatweel, a full-line check (so no truncation can pass), and a row-by-row check of each poem table.
- Marks were checked against every «العلامة» line, with per-element sums, per-question sums and paper totals.
- Every one of the 212 steps was read against the model answer: the keyed option, every distractor and the explanation.
- Every «quote» (بN) in prompts, options and explanations (108 in all) was checked against verse N.

## Summary

| set_id | steps checked | verbatim mismatches | mark mismatches | wrong keys | doubtful distractors | fabrication |
|---|---|---|---|---|---|---|
| ar-2as-t1-lit-03 | 46 (4 essay) | 0 | 0 | 0 | 0 | 1: poem caption adds «(من المتقارب)», which reveals the answer to s39 |
| ar-2as-t2-sci-06 | 43 (4 essay) | 0 | 0 | 0 | 0 | 1: poem caption adds «(من الوافر)» (not on the paper, but nothing is revealed) |
| ar-3as-t1-litlang-03 | 46 | 0 | 0 | 0 | 0 | 1: poem caption adds «(من البسيط)», which reveals the answer to s38 |
| ar-1as-t1-tcsci-03 | 36 (4 essay) | 0 | 0 | 0 | 1 (low): s30 | 1: poem caption adds «(من الرّمل)» (not on the paper, but nothing is revealed) |
| ar-2as-t3-sci-d02 | 41 | 0 | 0 | 0 | 2: s14, options 0 and 3 | 1: the s14 explanation adds an acceptance rule that is not in the correction |
| **Total** | **212** | **0** | **0** | **0** | **3** | **5** |

These checks found no problems:
- All 59 `verbatim_text` values are complete lines of the exam and character-identical to it.
- All documents (intro, poem, reference, glossary, critique preamble) match the exam. Poem tables match cell for cell, including tatweel.
- Every `rubric_total` and `max_points` equals the correction. Element sums equal the question marks. Paper totals are 20 (8/8/4, 10/6/4 and 10/10 layouts).
- Step points sum to each element's mark.
- Every keyed answer agrees with the model answer: mcq/multi indices, fill_blank blanks (all present in the bank), matching pairs and ordering permutations.
- Model-answer alternatives that the correction explicitly accepts are never used as wrong options. Examples: «مفعول به ثانٍ» for رَاتِعًا, «استعارة تصريحيّة» for ب7, «الحجاجيّ» in 1AS, and «ردّ العجز على الصّدر» in d02.
- The essay specs match the grids: line counts, required features and `underline_required`. The 1AS model essay is identical to the correction.

## Findings

1. **ar-2as-t1-lit-03, s39 (q10-e4 «البحر», 0.25 pt). The answer is visible in the document caption.**
   - The exam introduces the poem table with only «النَّصّ:».
   - The JSON's `d-poem.caption` is «النّصّ: أبيات أبي العتاهية (من المتقارب)».
   - `exam-runner.tsx:23` renders `doc.caption` in the «النصّ» drawer, and that drawer is open on every step.
   - Correction: «البحر: المتقارب».
   - The meter is the answer to s39 «ما بحر القصيدة؟». It also helps with s37 and s38 (the تفعيلات).

2. **ar-3as-t1-litlang-03, s38 (q11-e4 «البحر», 0.25 pt). Same leak.**
   - `d-poem.caption` is «النّصّ: أبيات البارودي (من البسيط)».
   - Correction: «البحر: البسيط».
   - It also helps with s36 and s37.

3. **The same caption pattern recurs outside this sample.**
   - A regex scan of all 30 sets found the meter in the poem caption in 11 sets. In 7 of them the paper asks for the meter:
     - ar-1as-t1-tclit-03
     - ar-1as-t1-tcsci-d01
     - ar-2as-t1-lit-03
     - ar-2as-t2-lit-06
     - ar-2as-t3-lit-09
     - ar-3as-t1-litlang-03
     - ar-3as-t1-sci-03
   - The 5 sets outside this sample were identified by regex only and have not been checked by hand.
   - In ar-2as-t2-sci-06 «(من الوافر)» and ar-1as-t1-tcsci-03 «(من الرّمل)» nothing is revealed, because those papers have no meter question. The text is still not on the paper.

4. **ar-2as-t3-sci-d02, s14 (q5-e2 «الرّأي المعلّل», 0.5 pt). Two doubtful distractors, and the explanation overreaches.**
   - Correction: «الرّأي (نموذج): أؤيّده، لأنّ الأيّام دول… (يُقبل كلّ رأي معلّل.)».
   - Options 0 «أؤيّده، لأنّ المعتمد كان ملكًا شاعرًا.» and 3 «لا أؤيّده، لأنّ العيد يوم فرح.» are both reasoned opinions, yet they are keyed wrong.
   - The explanation says «أمّا الرّأي بلا تعليل أو بتعليل لا صلة له بالعبرة فلا يُقبل». The second half of that rule is not in the correction.
   - s14 and s15 (1 pt in total) also only reward agreeing with the model's «أؤيّده». The open question accepts any reasoned position, including disagreement.

5. **ar-1as-t1-tcsci-03, s30 (q9-e1 «التّسمية», 0.5 pt). One doubtful distractor (low).**
   - The key is «مقابلة», which is correct.
   - The correction also says: «يُقبل "طباق" (حسن/قبيح، نعم/لا) مع خصم 0.25».
   - Distractor 0 «طباق سلب» is the wrong subtype, so keeping it is defensible. But a student who recognised the طباق gets 0 here, where the paper would give 0.25.

6. **Later prompts reveal earlier answers (all five sets).**
   - The forward arrow in `exam-runner.tsx:477` is disabled only on the last step. A student can therefore read later prompts before answering an earlier step, in both PRACTICE and EXAM.
   - Leaks that give the full answer away (earlier step → later step and the text that reveals it):

     | set | earlier → later | revealing text |
     |---|---|---|
     | t1-lit-03 | s12 → s13 | the prompt quotes «فَتِلْكَ الَّتِي كُنْتَ مِنْهَا تَحِيدُ» |
     | t1-lit-03 | s23 → s24 | «الغرض من النّهي» |
     | t1-lit-03 | s25 → s26 | the prompt contains «إيّاك والتّكثّرَ بدار البِلى!» |
     | t1-lit-03 | s29 → s31 | «سرّ بلاغة التّشبيه»; s29 has only one تشبيه option |
     | t2-sci-06 | s17 → s18 | «للنّمط الحجاجيّ» |
     | t2-sci-06 | s30 → s31 | «نافية للجنس» |
     | 3as-litlang-03 | s14 → s16 | «بقصّة يوسف» |
     | 3as-litlang-03 | s21 → s22 | «للنّمط الحجاجيّ» |
     | 3as-litlang-03 | s27 → s28 | the text «فحذف ____ وأبقى لازمة من لوازمه» describes a مكنيّة |
     | 1as-tcsci-03 | s13 → s14 | «للنّمط الإيعازيّ» |
     | 1as-tcsci-03 | s30 → s31/s32 | «وضّح المقابلة» / «أثر المقابلة» |
     | 1as-tcsci-03 | s22 → s23 | matching rights «الكاف» and «محذوف (النّهش والإيذاء)» identify the مرسل مجمل |
     | d02 | s09 → s10 | «يخاطب نفسه» |
     | d02 | s34 → s35/s36 | «ورمز إليه بشيء من لوازمه» / «بلاغة الاستعارة» |

   - Partial hints that narrow the options:
     - t2-sci-06 s37 → s38/s39 («التّشبيه»)
     - 3as s08 → s09 («عوقب بلا ذنب»)
     - 3as s30 → s31 («هذا الأسلوب الإنشائيّ», which leaves 2 options)
     - 1as s25 → s26 («غرض النّهي»)
     - d02 s37 → s38 («هذه الكناية»)
     - d02 s39 → s41 (left «الجناس (مَسْرُورَا / مَأْسُورَا)», which leaves تامّ or ناقص)
     - d02 s40 → s41 («الطّباق»)
     - d02 s23 → s24 («اسم كأنّ»)

7. **Steps not backed by the correction (low; not counted as fabrication).**
   - These were derived by the converter and checked against the poem. Their content is correct:
     - t1-lit-03 s02 (ordering of ideas)
     - t2-sci-06 s02 (ordering of ideas)
     - 3as s01 (timeline, consistent with «حوكم… ونُفي معهم سنة 1882م»)
     - d02 s05
     - d02 s24 (اسم كأنّ = «ها» for الأقدام, consistent with the correction's تأنيث table)
   - Extra rules added in explanations are also correct: t1-lit-03 s35 (حذف واو «أولو») and s25 («المحذَّر منه منصوب»).
   - The distractor verses in t1-lit-03 s13 are disclosed in `notes` and quoted accurately (النساء 78، الجمعة 8، آل عمران 185).

8. **Low notes, not counted.**
   - t1-lit-03 s13: distractor الجمعة:8 «…الَّذِي تَفِرُّونَ مِنْهُ…» has the same meaning as the verse. The prompt's «أُخذ» points to the wording, which only ق:19 matches, so the key stands.
   - 1as-tcsci-03 s16: distractor 0 «فاعل مرفوع لـ«حَسَنٌ»» is defensible under the Kufan/al-Akhfash view. The correction keys مبتدأ مؤخّر.
   - `source.year = 2026` (sets 1–4) does not appear on any paper. It is inferred from Drive dates.
