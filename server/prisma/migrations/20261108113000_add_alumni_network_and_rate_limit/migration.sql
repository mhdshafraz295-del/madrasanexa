-- CreateTable
CREATE TABLE `alumni_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `alumniIndexNumber` VARCHAR(50) NOT NULL,
    `admissionDate` DATE NOT NULL,
    `leavingDate` DATE NOT NULL,
    `leavingReason` VARCHAR(100) NULL,
    `completedProgrammes` JSON NULL,
    `academicHighlights` JSON NULL,
    `characterAssessmentRating` ENUM('EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'CONDITIONAL') NULL,
    `characterAssessmentText` TEXT NULL,
    `allowPublicConductShare` BOOLEAN NOT NULL DEFAULT false,
    `publicationStatus` ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'REVOKED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `publishedByUserId` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` TEXT NULL,
    `consentStatus` ENUM('PENDING', 'GRANTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `consentGivenBy` ENUM('STUDENT', 'GUARDIAN', 'BOTH') NULL,
    `consentSignerName` VARCHAR(191) NULL,
    `consentGrantedAt` DATETIME(3) NULL,
    `consentWithdrawnAt` DATETIME(3) NULL,
    `consentWithdrawnReason` TEXT NULL,
    `consentVersion` VARCHAR(20) NOT NULL DEFAULT 'v1.0-2026',
    `consentProofType` VARCHAR(50) NULL,
    `consentFileId` VARCHAR(191) NULL,
    `consentNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `alumni_profiles_alumniIndexNumber_key`(`alumniIndexNumber`),
    UNIQUE INDEX `alumni_profiles_studentId_madrasaId_key`(`studentId`, `madrasaId`),
    INDEX `alumni_profiles_madrasaId_publicationStatus_idx`(`madrasaId`, `publicationStatus`),
    INDEX `alumni_profiles_publicationStatus_consentStatus_idx`(`publicationStatus`, `consentStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alumni_index_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `lastSequence` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `alumni_index_sequences_madrasaId_year_key`(`madrasaId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alumni_consent_records` (
    `id` VARCHAR(191) NOT NULL,
    `alumniProfileId` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `action` ENUM('INITIAL_GRANT', 'WITHDRAWAL', 'RENEWAL') NOT NULL,
    `consentParty` ENUM('STUDENT', 'GUARDIAN', 'BOTH') NULL,
    `signerName` VARCHAR(191) NULL,
    `consentVersion` VARCHAR(20) NOT NULL,
    `proofType` VARCHAR(50) NULL,
    `evidenceFileId` VARCHAR(191) NULL,
    `withdrawalReason` TEXT NULL,
    `recordedByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alumni_consent_records_alumniProfileId_createdAt_idx`(`alumniProfileId`, `createdAt`),
    INDEX `alumni_consent_records_madrasaId_createdAt_idx`(`madrasaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alumni_verification_requests` (
    `id` VARCHAR(191) NOT NULL,
    `alumniProfileId` VARCHAR(191) NOT NULL,
    `targetMadrasaId` VARCHAR(191) NOT NULL,
    `requestingMadrasaId` VARCHAR(191) NOT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(255) NOT NULL,
    `specificInquiry` TEXT NULL,
    `includeCharacter` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'APPROVED_VERIFIED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `responseNotes` TEXT NULL,
    `respondedByUserId` VARCHAR(191) NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alumni_verification_requests_targetMadrasaId_status_idx`(`targetMadrasaId`, `status`),
    INDEX `alumni_verification_requests_requestingMadrasaId_status_idx`(`requestingMadrasaId`, `status`),
    INDEX `alumni_verification_requests_alumniProfileId_idx`(`alumniProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit_buckets` (
    `key` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `resetAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rate_limit_buckets_resetAt_idx`(`resetAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `alumni_profiles` ADD CONSTRAINT `alumni_profiles_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_profiles` ADD CONSTRAINT `alumni_profiles_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_profiles` ADD CONSTRAINT `alumni_profiles_consentFileId_fkey` FOREIGN KEY (`consentFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_profiles` ADD CONSTRAINT `alumni_profiles_publishedByUserId_fkey` FOREIGN KEY (`publishedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_index_sequences` ADD CONSTRAINT `alumni_index_sequences_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_consent_records` ADD CONSTRAINT `alumni_consent_records_alumniProfileId_fkey` FOREIGN KEY (`alumniProfileId`) REFERENCES `alumni_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_consent_records` ADD CONSTRAINT `alumni_consent_records_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_consent_records` ADD CONSTRAINT `alumni_consent_records_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `file_objects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_consent_records` ADD CONSTRAINT `alumni_consent_records_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_verification_requests` ADD CONSTRAINT `alumni_verification_requests_alumniProfileId_fkey` FOREIGN KEY (`alumniProfileId`) REFERENCES `alumni_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_verification_requests` ADD CONSTRAINT `alumni_verification_requests_targetMadrasaId_fkey` FOREIGN KEY (`targetMadrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_verification_requests` ADD CONSTRAINT `alumni_verification_requests_requestingMadrasaId_fkey` FOREIGN KEY (`requestingMadrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_verification_requests` ADD CONSTRAINT `alumni_verification_requests_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumni_verification_requests` ADD CONSTRAINT `alumni_verification_requests_respondedByUserId_fkey` FOREIGN KEY (`respondedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Reconcile centralized date/time and attendance settings on madrasa_settings
ALTER TABLE `madrasa_settings`
    ADD COLUMN `dateFormat` VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    ADD COLUMN `timeFormat` VARCHAR(10) NOT NULL DEFAULT '12_HOUR',
    ADD COLUMN `workingHoursStart` VARCHAR(5) NOT NULL DEFAULT '07:30',
    ADD COLUMN `workingHoursEnd` VARCHAR(5) NOT NULL DEFAULT '16:30',
    ADD COLUMN `workingDays` JSON NULL,
    ADD COLUMN `weeklyHolidays` JSON NULL,
    ADD COLUMN `attendanceStartTime` VARCHAR(5) NOT NULL DEFAULT '07:30',
    ADD COLUMN `attendanceClosingTime` VARCHAR(5) NOT NULL DEFAULT '08:30',
    ADD COLUMN `lateMarkingTime` VARCHAR(5) NOT NULL DEFAULT '08:00',
    ADD COLUMN `attendanceGracePeriodMinutes` INT NOT NULL DEFAULT 15,
    ADD COLUMN `autoAttendanceClosing` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timetableSlotDurationMinutes` INT NOT NULL DEFAULT 45;
