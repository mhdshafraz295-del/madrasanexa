-- AlterTable: Add guardianEmail to students
ALTER TABLE `students` ADD COLUMN `guardianEmail` VARCHAR(255) NULL;

-- AlterTable: Add notification settings to madrasa_settings
ALTER TABLE `madrasa_settings`
    ADD COLUMN `autoFeePaymentSmsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoPartialFeeSmsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoFeeReminderSmsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoFeePaymentEmailEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoPartialFeeEmailEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoFeeReminderEmailEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoSalaryPaidEmailEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `feeReminderSendTime` VARCHAR(5) NOT NULL DEFAULT '09:00';

-- CreateTable: notification_jobs
CREATE TABLE IF NOT EXISTS `notification_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `channel` ENUM('SMS', 'EMAIL') NOT NULL,
    `eventType` ENUM('FEE_PARTIAL_PAYMENT', 'FEE_FULLY_PAID', 'FEE_MONTH_END_REMINDER', 'SALARY_PAID', 'TIMETABLE_FINALIZED') NOT NULL,
    `recipientType` VARCHAR(50) NOT NULL,
    `recipientEntityId` VARCHAR(191) NULL,
    `recipientAddress` VARCHAR(255) NULL,
    `recipientName` VARCHAR(255) NULL,
    `subject` VARCHAR(255) NULL,
    `message` TEXT NOT NULL,
    `payloadJson` JSON NULL,
    `relatedEntityType` VARCHAR(50) NULL,
    `relatedEntityId` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'DELIVERY_UNKNOWN', 'SKIPPED_NO_RECIPIENT') NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextAttemptAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processingStartedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_jobs_madrasaId_dedupeKey_key`(`madrasaId`, `dedupeKey`),
    INDEX `notification_jobs_madrasaId_status_nextAttemptAt_idx`(`madrasaId`, `status`, `nextAttemptAt`),
    INDEX `notification_jobs_madrasaId_channel_createdAt_idx`(`madrasaId`, `channel`, `createdAt`),
    INDEX `notification_jobs_madrasaId_eventType_createdAt_idx`(`madrasaId`, `eventType`, `createdAt`),
    INDEX `notification_jobs_status_processingStartedAt_idx`(`status`, `processingStartedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: timetable_publications
CREATE TABLE IF NOT EXISTS `timetable_publications` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `requestHash` VARCHAR(64) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `sendEmail` BOOLEAN NOT NULL DEFAULT false,
    `recipientScope` ENUM('ALL_TEACHING_STAFF', 'USTADH_ONLY', 'SCHOOL_TEACHER_ONLY', 'SELECTED_STAFF', 'AFFECTED_STAFF_ONLY') NOT NULL,
    `selectedStaffIdsJson` JSON NULL,
    `staffCount` INTEGER NOT NULL DEFAULT 0,
    `queuedCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `scheduleFingerprint` VARCHAR(64) NOT NULL,
    `scheduleSnapshotJson` JSON NOT NULL,
    `notes` TEXT NULL,
    `publishedById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `timetable_publications_madrasaId_idempotencyKey_key`(`madrasaId`, `idempotencyKey`),
    INDEX `timetable_publications_madrasaId_publishedAt_idx`(`madrasaId`, `publishedAt`),
    INDEX `timetable_publications_publishedById_idx`(`publishedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_jobs` ADD CONSTRAINT `notification_jobs_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_publications` ADD CONSTRAINT `timetable_publications_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_publications` ADD CONSTRAINT `timetable_publications_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

