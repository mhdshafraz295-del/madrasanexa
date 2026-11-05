-- Add curriculumJson column to madrasa_profiles
ALTER TABLE `madrasa_profiles`
  ADD COLUMN `curriculumJson` LONGTEXT NULL;
