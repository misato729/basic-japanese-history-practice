-- Add the Center-format catalog without changing content or publication state.
ALTER TABLE exam_sets DROP CONSTRAINT exam_sets_format_code_check;
ALTER TABLE exam_sets ADD CONSTRAINT exam_sets_format_code_check
 CHECK (format_code IN ('legacy_practice','group_practice','rekiken_mock','center_mock'));
ALTER TABLE question_groups DROP CONSTRAINT question_groups_planned_question_count_check;
ALTER TABLE question_groups ADD CONSTRAINT question_groups_planned_question_count_check
 CHECK (planned_question_count IN (4,6,7,8));
