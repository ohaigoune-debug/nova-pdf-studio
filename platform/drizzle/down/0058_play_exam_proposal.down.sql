-- يُرجع القيد القديم دون أن يمسّ صفوف PROPOSAL الموجودة (NOT VALID): احذفها يدويًّا قبل VALIDATE إن لزم.
ALTER TABLE "play_exam_sets" DROP CONSTRAINT IF EXISTS "play_exam_sets_kind_check";
--> statement-breakpoint
ALTER TABLE "play_exam_sets" ADD CONSTRAINT "play_exam_sets_kind_check" CHECK ("kind" IN ('BAC', 'DEVOIR', 'TEST')) NOT VALID;
