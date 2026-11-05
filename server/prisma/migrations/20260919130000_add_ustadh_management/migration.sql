-- CreateTable
CREATE TABLE `ustadhs` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `ustadhCode` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `whatsappNumber` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `joinDate` DATE NOT NULL,
    `leaveDate` DATE NULL,
    `baseMonthlySalary` DECIMAL(12, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ustadhs_madrasaId_isActive_idx`(`madrasaId`, `isActive`),
    UNIQUE INDEX `ustadhs_madrasaId_ustadhCode_key`(`madrasaId`, `ustadhCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ustadh_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `ustadhId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `startMinutes` INTEGER NOT NULL,
    `endMinutes` INTEGER NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ustadh_schedules_madrasaId_ustadhId_idx`(`madrasaId`, `ustadhId`),
    INDEX `ustadh_schedules_madrasaId_dayOfWeek_idx`(`madrasaId`, `dayOfWeek`),
    INDEX `ustadh_schedules_madrasaId_classId_idx`(`madrasaId`, `classId`),
    INDEX `ustadh_schedules_madrasaId_subjectId_idx`(`madrasaId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ustadh_attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `ustadhId` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `attendanceDate` DATE NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT') NOT NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ustadh_attendance_records_madrasaId_ustadhId_attendanceDate_idx`(`madrasaId`, `ustadhId`, `attendanceDate`),
    INDEX `ustadh_attendance_records_madrasaId_attendanceDate_idx`(`madrasaId`, `attendanceDate`),
    UNIQUE INDEX `ustadh_attendance_records_scheduleId_attendanceDate_key`(`scheduleId`, `attendanceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ustadh_salaries` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `ustadhId` VARCHAR(191) NOT NULL,
    `salaryMonth` DATE NOT NULL,
    `baseSalarySnapshot` DECIMAL(12, 2) NOT NULL,
    `payableAmount` DECIMAL(12, 2) NOT NULL,
    `adjustmentReason` TEXT NULL,
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER') NULL,
    `paymentDate` DATE NULL,
    `paymentReference` VARCHAR(191) NULL,
    `paymentNote` TEXT NULL,
    `paidById` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ustadh_salaries_madrasaId_salaryMonth_idx`(`madrasaId`, `salaryMonth`),
    INDEX `ustadh_salaries_madrasaId_status_idx`(`madrasaId`, `status`),
    UNIQUE INDEX `ustadh_salaries_madrasaId_ustadhId_salaryMonth_key`(`madrasaId`, `ustadhId`, `salaryMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ustadhs` ADD CONSTRAINT `ustadhs_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_schedules` ADD CONSTRAINT `ustadh_schedules_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_schedules` ADD CONSTRAINT `ustadh_schedules_ustadhId_fkey` FOREIGN KEY (`ustadhId`) REFERENCES `ustadhs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_schedules` ADD CONSTRAINT `ustadh_schedules_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_schedules` ADD CONSTRAINT `ustadh_schedules_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_attendance_records` ADD CONSTRAINT `ustadh_attendance_records_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_attendance_records` ADD CONSTRAINT `ustadh_attendance_records_ustadhId_fkey` FOREIGN KEY (`ustadhId`) REFERENCES `ustadhs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_attendance_records` ADD CONSTRAINT `ustadh_attendance_records_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ustadh_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_attendance_records` ADD CONSTRAINT `ustadh_attendance_records_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_salaries` ADD CONSTRAINT `ustadh_salaries_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_salaries` ADD CONSTRAINT `ustadh_salaries_ustadhId_fkey` FOREIGN KEY (`ustadhId`) REFERENCES `ustadhs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ustadh_salaries` ADD CONSTRAINT `ustadh_salaries_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

