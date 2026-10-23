-- تراجع عن 0026_madrasadz_play (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0026_madrasadz_play.down.sql
BEGIN;
DROP TABLE IF EXISTS "play_question_reports", "play_student_badges", "play_question_memory", "play_lesson_progress", "play_subject_stats", "play_student_stats", "play_answers", "play_sessions", "play_questions", "play_lessons", "play_subjects";
COMMIT;
