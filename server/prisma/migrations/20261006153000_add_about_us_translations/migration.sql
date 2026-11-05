-- CreateTable
CREATE TABLE IF NOT EXISTS `about_us_translations` (
    `id` VARCHAR(191) NOT NULL,
    `aboutUsId` VARCHAR(191) NOT NULL DEFAULT 'global',
    `language` ENUM('AR', 'TA') NOT NULL,
    `targetState` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `title` VARCHAR(255) NULL,
    `subtitle` TEXT NULL,
    `introduction` TEXT NULL,
    `story` TEXT NULL,
    `mission` TEXT NULL,
    `vision` TEXT NULL,
    `coreValues` JSON NULL,
    `highlights` JSON NULL,
    `ctaLabel` VARCHAR(100) NULL,
    `heroAlt` VARCHAR(255) NULL,
    `storyAlt` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `about_us_translations_aboutUsId_language_targetState_key`(`aboutUsId`, `language`, `targetState`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `about_us_translations` ADD CONSTRAINT `about_us_translations_aboutUsId_fkey` FOREIGN KEY (`aboutUsId`) REFERENCES `about_us`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
