-- AlterTable
ALTER TABLE `madrasas` ADD COLUMN `showAlumniOnWebsite` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS `alumni_scholars` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `photoUrl` TEXT NULL,
    `batchYear` VARCHAR(191) NOT NULL,
    `classOrDivision` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `academicStatus` VARCHAR(191) NOT NULL DEFAULT 'UNDERGRADUATE',
    `qualification` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NOT NULL,
    `facultyOrDepartment` VARCHAR(191) NULL,
    `currentRole` VARCHAR(191) NULL,
    `cityCountry` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `linkedinUrl` VARCHAR(191) NULL,
    `showContactPublicly` BOOLEAN NOT NULL DEFAULT false,
    `availableForMentorship` BOOLEAN NOT NULL DEFAULT true,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alumni_scholars_madrasaId_approvalStatus_idx`(`madrasaId`, `approvalStatus`),
    INDEX `alumni_scholars_madrasaId_batchYear_idx`(`madrasaId`, `batchYear`),
    INDEX `alumni_scholars_madrasaId_isFeatured_idx`(`madrasaId`, `isFeatured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `alumni_scholars` ADD CONSTRAINT `alumni_scholars_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_scholars` ADD CONSTRAINT `alumni_scholars_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
