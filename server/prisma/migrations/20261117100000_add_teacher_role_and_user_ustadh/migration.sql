-- =====================================================================================
-- MIGRATION: 20261117100000_add_teacher_role_and_user_ustadh
-- TARGET: MadrasaNexa Multi-Tenant Platform
-- SUMMARY: Teacher Authentication Foundation & Tenant-Safe User-Ustadh Linkage
-- =====================================================================================

-- Short lock timeout to prevent queuing behind long reads
SET SESSION lock_wait_timeout = 5;

-- Step 1.1: Extend users.role ENUM with 'TEACHER'
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('SUPER_ADMIN', 'MADRASA_ADMIN', 'TEACHER') NOT NULL;

-- Step 1.2: Add unique key on users(id, madrasaId) to support composite foreign key
ALTER TABLE `users`
  ADD UNIQUE KEY `users_id_madrasaId_key` (`id`, `madrasaId`);

-- Step 1.3: Add nullable userId and composite tenant foreign key to ustadhs table
ALTER TABLE `ustadhs`
  ADD COLUMN `userId` VARCHAR(191) NULL AFTER `notes`,
  ADD UNIQUE KEY `ustadhs_userId_key` (`userId`),
  ADD UNIQUE KEY `ustadhs_userId_madrasaId_key` (`userId`, `madrasaId`),
  ADD CONSTRAINT `ustadhs_userId_madrasaId_fkey`
    FOREIGN KEY (`userId`, `madrasaId`) REFERENCES `users` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
