DROP INDEX IF EXISTS "content_node_idx";
DROP INDEX IF EXISTS "content_subject_idx";
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_curriculum_node_id_curriculum_nodes_id_fk";
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_subject_id_subjects_id_fk";
ALTER TABLE "content" DROP COLUMN IF EXISTS "curriculum_node_id";
ALTER TABLE "content" DROP COLUMN IF EXISTS "subject_id";
