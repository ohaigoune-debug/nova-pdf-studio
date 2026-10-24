UPDATE "call_events" SET "result" = 'no_order' WHERE "result" = 'phone_verified';
ALTER TABLE "call_events" DROP CONSTRAINT IF EXISTS "call_events_result_check";
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_result_check" CHECK ("call_events"."result" IN ('confirmed', 'already_confirmed', 'no_order', 'invalid_phone', 'disabled'));
DROP TABLE IF EXISTS "course_codes";
