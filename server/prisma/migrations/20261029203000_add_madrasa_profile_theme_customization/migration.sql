-- Add theme customization draft and published columns to madrasa_profiles
ALTER TABLE `madrasa_profiles`
  ADD COLUMN `themeDraftJson` LONGTEXT NULL,
  ADD COLUMN `themePublishedJson` LONGTEXT NULL;
