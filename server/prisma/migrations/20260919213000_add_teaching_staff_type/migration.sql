-- AlterTable
ALTER TABLE `ustadhs` ADD COLUMN `staffType` ENUM('USTADH', 'SCHOOL_TEACHER') NOT NULL DEFAULT 'USTADH';

-- CreateIndex
CREATE INDEX `ustadhs_madrasaId_staffType_idx` ON `ustadhs`(`madrasaId`, `staffType`);

