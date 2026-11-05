-- Add staffJson column to madrasa_profiles
ALTER TABLE `madrasa_profiles`
  ADD COLUMN `staffJson` LONGTEXT NULL;
