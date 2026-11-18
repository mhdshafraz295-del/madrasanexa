-- =====================================================================================
-- MIGRATION: 20261118223000_add_platform_polls
-- TARGET: MadrasaNexa Multi-Tenant Platform
-- SUMMARY: Super Admin Multi-Tenant Poll & Community Governance System
-- =====================================================================================

CREATE TABLE IF NOT EXISTS `platform_polls` (
    `id` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'GOVERNANCE',
    `targetAudience` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `targetMadrasaIds` JSON NULL,
    `allowMultipleChoice` TINYINT(1) NOT NULL DEFAULT 0,
    `isAnonymous` TINYINT(1) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `closesAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `platform_polls_status_closesAt_idx`(`status`, `closesAt`),
    INDEX `platform_polls_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `platform_polls_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_poll_options` (
    `id` VARCHAR(191) NOT NULL,
    `pollId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `sortOrder` INT NOT NULL DEFAULT 0,

    INDEX `platform_poll_options_pollId_sortOrder_idx`(`pollId`, `sortOrder`),
    PRIMARY KEY (`id`),
    CONSTRAINT `platform_poll_options_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `platform_polls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_poll_votes` (
    `id` VARCHAR(191) NOT NULL,
    `pollId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `voterRole` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_poll_votes_pollId_optionId_userId_key`(`pollId`, `optionId`, `userId`),
    INDEX `platform_poll_votes_pollId_userId_idx`(`pollId`, `userId`),
    INDEX `platform_poll_votes_madrasaId_idx`(`madrasaId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `platform_poll_votes_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `platform_polls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `platform_poll_votes_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `platform_poll_options`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `platform_poll_votes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `platform_poll_votes_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
