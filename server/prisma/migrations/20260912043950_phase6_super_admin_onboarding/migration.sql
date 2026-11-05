-- AlterTable
ALTER TABLE `users` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `madrasa_onboarding_requests` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaName` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `whatsappNumber` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `expectedStudentCount` INTEGER NULL,
    `message` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `approvedMadrasaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `madrasa_onboarding_requests_status_idx`(`status`),
    INDEX `madrasa_onboarding_requests_email_idx`(`email`),
    INDEX `madrasa_onboarding_requests_phone_idx`(`phone`),
    INDEX `madrasa_onboarding_requests_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `madrasa_onboarding_requests` ADD CONSTRAINT `madrasa_onboarding_requests_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `madrasa_onboarding_requests` ADD CONSTRAINT `madrasa_onboarding_requests_approvedMadrasaId_fkey` FOREIGN KEY (`approvedMadrasaId`) REFERENCES `madrasas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
