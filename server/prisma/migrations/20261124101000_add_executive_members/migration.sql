-- CreateTable
CREATE TABLE IF NOT EXISTS `madrasa_executive_members` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `photoUrl` TEXT NULL,
    `photoFileId` VARCHAR(191) NULL,
    `qualification` VARCHAR(191) NULL,
    `messageOrBio` TEXT NULL,
    `termPeriod` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `madrasa_executive_members_madrasaId_isActive_displayOrder_idx`(`madrasaId`, `isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `madrasa_executive_members` ADD CONSTRAINT `madrasa_executive_members_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
