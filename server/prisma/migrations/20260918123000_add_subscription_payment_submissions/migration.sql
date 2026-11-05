-- AlterTable
ALTER TABLE `file_objects` MODIFY `type` ENUM('MADRASA_LOGO', 'STUDENT_PHOTO', 'STUDENT_DOCUMENT', 'REPORT', 'RECEIPT', 'OTHER', 'ABOUT_US_HERO', 'ABOUT_US_STORY', 'SUBSCRIPTION_RECEIPT') NOT NULL;

-- CreateTable
CREATE TABLE `subscription_payment_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `subscriptionPaymentId` VARCHAR(191) NULL,
    `submittedAmount` DECIMAL(12, 2) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `receiptFileId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscription_payment_submissions_madrasaId_status_idx`(`madrasaId`, `status`),
    INDEX `subscription_payment_submissions_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `subscription_payment_submissions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_bank_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `bankName` VARCHAR(191) NULL,
    `accountName` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `instructions` TEXT NULL,
    `isConfigured` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_subscriptionPaymentId_fkey` FOREIGN KEY (`subscriptionPaymentId`) REFERENCES `subscription_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_receiptFileId_fkey` FOREIGN KEY (`receiptFileId`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_payment_submissions` ADD CONSTRAINT `subscription_payment_submissions_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

