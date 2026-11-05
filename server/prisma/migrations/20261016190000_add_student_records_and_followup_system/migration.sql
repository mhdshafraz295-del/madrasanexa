-- AlterTable
ALTER TABLE `notification_jobs` MODIFY `eventType` ENUM('FEE_PARTIAL_PAYMENT', 'FEE_FULLY_PAID', 'FEE_MONTH_END_REMINDER', 'SALARY_PAID', 'TIMETABLE_FINALIZED', 'FOLLOW_UP_ASSIGNED', 'FOLLOW_UP_REMINDER') NOT NULL;

-- CreateTable
CREATE TABLE `student_qualifications` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `recordType` ENUM('QUALIFICATION', 'ACHIEVEMENT') NOT NULL DEFAULT 'QUALIFICATION',
    `category` ENUM('HIFZ_JUZ', 'QIRAATH', 'NAZIRA_QURAN', 'TAJWEED', 'ISLAMIC_STUDIES', 'ARABIC_LANGUAGE', 'PREVIOUS_SCHOOLING', 'EXTERNAL_CERTIFICATE', 'AWARD_ACHIEVEMENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `title` VARCHAR(191) NOT NULL,
    `issuingAuthority` VARCHAR(191) NULL,
    `certificateNumber` VARCHAR(100) NULL,
    `progressStatus` ENUM('IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'COMPLETED',
    `verificationStatus` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `achievedDate` DATE NULL,
    `expiryDate` DATE NULL,
    `gradeOrScore` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `certificateFileId` VARCHAR(191) NULL,
    `examinerUstadhId` VARCHAR(191) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `student_qualifications_madrasaId_studentId_deletedAt_idx`(`madrasaId`, `studentId`, `deletedAt`),
    INDEX `student_qualifications_madrasaId_recordType_category_idx`(`madrasaId`, `recordType`, `category`),
    INDEX `student_qualifications_madrasaId_verificationStatus_progress_idx`(`madrasaId`, `verificationStatus`, `progressStatus`),
    UNIQUE INDEX `student_qualifications_id_madrasaId_key`(`id`, `madrasaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_incidents` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` ENUM('ATTENDANCE_TARDINESS', 'BEHAVIOR_CONDUCT', 'ACADEMIC_INTEGRITY', 'DRESS_CODE', 'PEER_CONFLICT', 'PROPERTY_DAMAGE', 'SAFETY_CONCERN', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `occurredAt` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `isConfidential` BOOLEAN NOT NULL DEFAULT true,
    `reportedDescription` TEXT NOT NULL,
    `reportedByUstadhId` VARCHAR(191) NULL,
    `reportedByUserId` VARCHAR(191) NOT NULL,
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verificationStatus` ENUM('REPORTED', 'UNDER_REVIEW', 'CONFIRMED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'REPORTED',
    `investigatedFindings` TEXT NULL,
    `actionTaken` TEXT NULL,
    `dismissalReason` TEXT NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `evidenceFileId` VARCHAR(191) NULL,
    `guardianNotified` BOOLEAN NOT NULL DEFAULT false,
    `guardianNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `student_incidents_madrasaId_studentId_deletedAt_idx`(`madrasaId`, `studentId`, `deletedAt`),
    INDEX `student_incidents_madrasaId_verificationStatus_severity_idx`(`madrasaId`, `verificationStatus`, `severity`),
    INDEX `student_incidents_madrasaId_occurredAt_idx`(`madrasaId`, `occurredAt`),
    UNIQUE INDEX `student_incidents_id_madrasaId_key`(`id`, `madrasaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_meetings` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `meetingType` ENUM('GUARDIAN_CONFERENCE', 'ACADEMIC_REVIEW', 'DISCIPLINARY_HEARING', 'COUNSELING', 'GENERAL') NOT NULL DEFAULT 'GUARDIAN_CONFERENCE',
    `title` VARCHAR(191) NOT NULL,
    `meetingAt` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `participantsSummary` VARCHAR(255) NOT NULL,
    `ustadhId` VARCHAR(191) NULL,
    `incidentId` VARCHAR(191) NULL,
    `discussionNotes` TEXT NOT NULL,
    `outcomeSummary` TEXT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `student_meetings_madrasaId_studentId_meetingAt_deletedAt_idx`(`madrasaId`, `studentId`, `meetingAt`, `deletedAt`),
    INDEX `student_meetings_madrasaId_meetingType_idx`(`madrasaId`, `meetingType`),
    UNIQUE INDEX `student_meetings_id_madrasaId_key`(`id`, `madrasaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_follow_ups` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `incidentId` VARCHAR(191) NULL,
    `qualificationId` VARCHAR(191) NULL,
    `meetingId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `dueDate` DATE NOT NULL,
    `reminderAt` DATETIME(3) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `assignedToUstadhId` VARCHAR(191) NULL,
    `assignedToUserId` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedByUserId` VARCHAR(191) NULL,
    `outcomeNotes` TEXT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `student_follow_ups_madrasaId_studentId_status_dueDate_idx`(`madrasaId`, `studentId`, `status`, `dueDate`),
    INDEX `student_follow_ups_madrasaId_status_dueDate_deletedAt_idx`(`madrasaId`, `status`, `dueDate`, `deletedAt`),
    INDEX `student_follow_ups_madrasaId_status_reminderAt_idx`(`madrasaId`, `status`, `reminderAt`),
    UNIQUE INDEX `student_follow_ups_id_madrasaId_key`(`id`, `madrasaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `file_objects_id_madrasaId_key` ON `file_objects`(`id`, `madrasaId`);

-- CreateIndex
CREATE UNIQUE INDEX `ustadhs_id_madrasaId_key` ON `ustadhs`(`id`, `madrasaId`);

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_certificateFileId_madrasaId_fkey` FOREIGN KEY (`certificateFileId`, `madrasaId`) REFERENCES `file_objects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_examinerUstadhId_madrasaId_fkey` FOREIGN KEY (`examinerUstadhId`, `madrasaId`) REFERENCES `ustadhs`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_qualifications` ADD CONSTRAINT `student_qualifications_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_reportedByUstadhId_madrasaId_fkey` FOREIGN KEY (`reportedByUstadhId`, `madrasaId`) REFERENCES `ustadhs`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_reportedByUserId_fkey` FOREIGN KEY (`reportedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_incidents` ADD CONSTRAINT `student_incidents_evidenceFileId_madrasaId_fkey` FOREIGN KEY (`evidenceFileId`, `madrasaId`) REFERENCES `file_objects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_meetings` ADD CONSTRAINT `student_meetings_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_meetings` ADD CONSTRAINT `student_meetings_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_meetings` ADD CONSTRAINT `student_meetings_ustadhId_madrasaId_fkey` FOREIGN KEY (`ustadhId`, `madrasaId`) REFERENCES `ustadhs`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_meetings` ADD CONSTRAINT `student_meetings_incidentId_madrasaId_fkey` FOREIGN KEY (`incidentId`, `madrasaId`) REFERENCES `student_incidents`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_meetings` ADD CONSTRAINT `student_meetings_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_incidentId_madrasaId_fkey` FOREIGN KEY (`incidentId`, `madrasaId`) REFERENCES `student_incidents`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_qualificationId_madrasaId_fkey` FOREIGN KEY (`qualificationId`, `madrasaId`) REFERENCES `student_qualifications`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_meetingId_madrasaId_fkey` FOREIGN KEY (`meetingId`, `madrasaId`) REFERENCES `student_meetings`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_assignedToUstadhId_madrasaId_fkey` FOREIGN KEY (`assignedToUstadhId`, `madrasaId`) REFERENCES `ustadhs`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_completedByUserId_fkey` FOREIGN KEY (`completedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_follow_ups` ADD CONSTRAINT `student_follow_ups_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
