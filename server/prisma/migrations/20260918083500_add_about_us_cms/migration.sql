-- AlterTable
ALTER TABLE `file_objects` MODIFY `type` ENUM('MADRASA_LOGO', 'STUDENT_PHOTO', 'STUDENT_DOCUMENT', 'REPORT', 'RECEIPT', 'OTHER', 'ABOUT_US_HERO', 'ABOUT_US_STORY') NOT NULL;

-- CreateTable
CREATE TABLE `about_us` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `status` ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `draftTitle` VARCHAR(255) NULL,
    `draftSubtitle` TEXT NULL,
    `draftIntroduction` TEXT NULL,
    `draftStory` TEXT NULL,
    `draftMission` TEXT NULL,
    `draftVision` TEXT NULL,
    `draftCoreValues` JSON NULL,
    `draftHighlights` JSON NULL,
    `draftCtaLabel` VARCHAR(100) NULL,
    `draftCtaUrl` VARCHAR(500) NULL,
    `draftHeroFileId` VARCHAR(191) NULL,
    `draftHeroAlt` VARCHAR(255) NULL,
    `draftStoryFileId` VARCHAR(191) NULL,
    `draftStoryAlt` VARCHAR(255) NULL,
    `publishedTitle` VARCHAR(255) NULL,
    `publishedSubtitle` TEXT NULL,
    `publishedIntroduction` TEXT NULL,
    `publishedStory` TEXT NULL,
    `publishedMission` TEXT NULL,
    `publishedVision` TEXT NULL,
    `publishedCoreValues` JSON NULL,
    `publishedHighlights` JSON NULL,
    `publishedCtaLabel` VARCHAR(100) NULL,
    `publishedCtaUrl` VARCHAR(500) NULL,
    `publishedHeroFileId` VARCHAR(191) NULL,
    `publishedHeroAlt` VARCHAR(255) NULL,
    `publishedStoryFileId` VARCHAR(191) NULL,
    `publishedStoryAlt` VARCHAR(255) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `about_us` ADD CONSTRAINT `about_us_draftHeroFileId_fkey` FOREIGN KEY (`draftHeroFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `about_us` ADD CONSTRAINT `about_us_draftStoryFileId_fkey` FOREIGN KEY (`draftStoryFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `about_us` ADD CONSTRAINT `about_us_publishedHeroFileId_fkey` FOREIGN KEY (`publishedHeroFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `about_us` ADD CONSTRAINT `about_us_publishedStoryFileId_fkey` FOREIGN KEY (`publishedStoryFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
