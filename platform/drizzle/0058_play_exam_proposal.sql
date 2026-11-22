-- «مواضيع مقترحة» (22 نوفمبر 2026): نوع رابع لمجموعات امتحان PLAY، موضوع على نمط البكالوريا ليس رسميًّا.
ALTER TABLE "play_exam_sets" DROP CONSTRAINT IF EXISTS "play_exam_sets_kind_check";
--> statement-breakpoint
ALTER TABLE "play_exam_sets" ADD CONSTRAINT "play_exam_sets_kind_check" CHECK ("kind" IN ('BAC', 'DEVOIR', 'TEST', 'PROPOSAL'));
