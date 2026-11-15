-- AlterTable
ALTER TABLE `students` ADD COLUMN `category` ENUM('DAY_SCHOLAR', 'BOARDING') NULL;

-- AlterTable
ALTER TABLE `madrasa_settings` ADD COLUMN `autoGateAttendanceReconciliation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `gateParentEmailNotificationsEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `student_gate_events` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `recordedByUserId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('ENTRY', 'EXIT') NOT NULL,
    `category` ENUM('DAY_SCHOLAR', 'BOARDING') NOT NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idempotencyKey` VARCHAR(36) NULL,
    `emailStatus` ENUM('NOT_APPLICABLE', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED_NO_RECIPIENT') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `processingStartedAt` DATETIME(3) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `emailError` VARCHAR(500) NULL,
    `emailResponse` TEXT NULL,
    `emailSkipReason` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_gate_events_madrasaId_studentId_createdAt_idx`(`madrasaId`, `studentId`, `createdAt` DESC),
    INDEX `student_gate_events_emailStatus_nextAttemptAt_idx`(`emailStatus`, `nextAttemptAt`),
    INDEX `student_gate_events_emailStatus_processingStartedAt_idx`(`emailStatus`, `processingStartedAt`),
    UNIQUE INDEX `student_gate_events_madrasaId_idempotencyKey_key`(`madrasaId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `students_madrasaId_category_idx` ON `students`(`madrasaId`, `category`);

-- AddForeignKey
ALTER TABLE `student_gate_events` ADD CONSTRAINT `student_gate_events_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_gate_events` ADD CONSTRAINT `student_gate_events_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_gate_events` ADD CONSTRAINT `student_gate_events_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
