-- =====================================================================================
-- MIGRATION: 20261118220000_add_staff_notices
-- TARGET: MadrasaNexa Multi-Tenant Platform
-- SUMMARY: Real-Time Admin to Teacher Staff Notices and Read Receipts
-- =====================================================================================

CREATE TABLE IF NOT EXISTS `staff_notices` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `targetType` VARCHAR(191) NOT NULL DEFAULT 'ALL_TEACHERS',
    `targetClassId` VARCHAR(191) NULL,
    `targetUstadhIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `staff_notices_id_madrasaId_key`(`id`, `madrasaId`),
    INDEX `staff_notices_madrasaId_idx`(`madrasaId`),
    INDEX `staff_notices_madrasaId_createdAt_idx`(`madrasaId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `staff_notices_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `staff_notices_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `staff_notices_targetClassId_fkey` FOREIGN KEY (`targetClassId`) REFERENCES `classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_notice_reads` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `noticeId` VARCHAR(191) NOT NULL,
    `ustadhId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `staff_notice_reads_noticeId_ustadhId_key`(`noticeId`, `ustadhId`),
    INDEX `staff_notice_reads_madrasaId_ustadhId_idx`(`madrasaId`, `ustadhId`),
    INDEX `staff_notice_reads_ustadhId_idx`(`ustadhId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `staff_notice_reads_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `staff_notice_reads_noticeId_fkey` FOREIGN KEY (`noticeId`) REFERENCES `staff_notices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `staff_notice_reads_ustadhId_fkey` FOREIGN KEY (`ustadhId`) REFERENCES `ustadhs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
