-- =====================================================================================
-- MIGRATION: 20261117110000_add_teacher_portal_tables
-- TARGET: MadrasaNexa Multi-Tenant Platform
-- SUMMARY: Teacher Portal Core Models, Composite Relations, and Shortened Keys
-- =====================================================================================

SET SESSION lock_wait_timeout = 5;

-- -------------------------------------------------------------------------------------
-- Step 2.1: Create table `classrooms`
-- -------------------------------------------------------------------------------------
CREATE TABLE `classrooms` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `roomNumber` VARCHAR(191) NOT NULL,
  `roomToken` VARCHAR(100) NOT NULL,
  `capacity` INT NULL,
  `facilities` TEXT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `classrooms_roomToken_key` (`roomToken`),
  UNIQUE KEY `classrooms_id_madrasaId_key` (`id`, `madrasaId`),
  UNIQUE KEY `classrooms_madrasaId_roomNumber_key` (`madrasaId`, `roomNumber`),
  INDEX `classrooms_madrasaId_isActive_idx` (`madrasaId`, `isActive`),
  CONSTRAINT `classrooms_madrasaId_fkey`
    FOREIGN KEY (`madrasaId`) REFERENCES `madrasas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Step 2.2: Reconcile `ustadh_schedules` (Legacy FK Drop + Composite FK Add)
-- -------------------------------------------------------------------------------------
ALTER TABLE `ustadh_schedules`
  ADD COLUMN `classroomId` VARCHAR(191) NULL AFTER `subjectId`,
  ADD UNIQUE KEY `ustadh_schedules_id_madrasaId_key` (`id`, `madrasaId`),
  ADD UNIQUE KEY `ustadh_schedules_id_ustadhId_madrasaId_key` (`id`, `ustadhId`, `madrasaId`),
  ADD INDEX `ustadh_schedules_madrasaId_classroomId_idx` (`madrasaId`, `classroomId`);

ALTER TABLE `ustadh_schedules`
  DROP FOREIGN KEY `ustadh_schedules_subjectId_fkey`,
  DROP FOREIGN KEY `ustadh_schedules_classId_fkey`,
  DROP FOREIGN KEY `ustadh_schedules_ustadhId_fkey`;

ALTER TABLE `ustadh_schedules`
  ADD CONSTRAINT `ustadh_schedules_classroomId_madrasaId_fkey`
    FOREIGN KEY (`classroomId`, `madrasaId`) REFERENCES `classrooms` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ustadh_schedules_subjectId_madrasaId_fkey`
    FOREIGN KEY (`subjectId`, `madrasaId`) REFERENCES `subjects` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ustadh_schedules_classId_madrasaId_fkey`
    FOREIGN KEY (`classId`, `madrasaId`) REFERENCES `classes` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ustadh_schedules_ustadhId_madrasaId_fkey`
    FOREIGN KEY (`ustadhId`, `madrasaId`) REFERENCES `ustadhs` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------------------------
-- Step 2.3: Reconcile `ustadh_salaries` (Legacy FK Drop + Composite FK Add)
-- -------------------------------------------------------------------------------------
ALTER TABLE `ustadh_salaries`
  ADD UNIQUE KEY `ustadh_salaries_id_madrasaId_key` (`id`, `madrasaId`),
  ADD UNIQUE KEY `ustadh_salaries_id_ustadhId_madrasaId_key` (`id`, `ustadhId`, `madrasaId`);

ALTER TABLE `ustadh_salaries`
  DROP FOREIGN KEY `ustadh_salaries_ustadhId_fkey`;

ALTER TABLE `ustadh_salaries`
  ADD CONSTRAINT `ustadh_salaries_ustadhId_madrasaId_fkey`
    FOREIGN KEY (`ustadhId`, `madrasaId`) REFERENCES `ustadhs` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------------------------------------------------------------------------
-- Step 2.4: Create table `class_period_attendance_sessions`
-- -------------------------------------------------------------------------------------
CREATE TABLE `class_period_attendance_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `teacherId` VARCHAR(191) NOT NULL,
  `sessionDate` DATE NOT NULL,
  `periodNumber` INT NOT NULL,
  `topicCovered` VARCHAR(255) NULL,
  `remarks` TEXT NULL,
  `verifiedRoomQr` VARCHAR(100) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_period_attendance_sessions_id_madrasaId_key` (`id`, `madrasaId`),
  UNIQUE KEY `class_period_attendance_sessions_unique_session` (`madrasaId`, `scheduleId`, `sessionDate`, `periodNumber`),
  INDEX `class_period_attendance_sessions_madrasaId_sessionDate_idx` (`madrasaId`, `sessionDate`),
  INDEX `class_period_attendance_sessions_madrasaId_teacherId_idx` (`madrasaId`, `teacherId`),
  INDEX `class_period_attendance_sessions_schedule_teacher_madrasa_idx` (`scheduleId`, `teacherId`, `madrasaId`),
  CONSTRAINT `cpa_sessions_madrasaId_fkey`
    FOREIGN KEY (`madrasaId`) REFERENCES `madrasas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cpa_sessions_scheduleId_teacherId_madrasaId_fkey`
    FOREIGN KEY (`scheduleId`, `teacherId`, `madrasaId`) REFERENCES `ustadh_schedules` (`id`, `ustadhId`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cpa_sessions_teacherId_madrasaId_fkey`
    FOREIGN KEY (`teacherId`, `madrasaId`) REFERENCES `ustadhs` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Step 2.5: Create table `class_period_attendance_records`
-- -------------------------------------------------------------------------------------
CREATE TABLE `class_period_attendance_records` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') NOT NULL DEFAULT 'PRESENT',
  `remarks` VARCHAR(255) NULL,
  `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_period_attendance_records_sessionId_studentId_key` (`sessionId`, `studentId`),
  INDEX `class_period_attendance_records_madrasaId_studentId_idx` (`madrasaId`, `studentId`),
  INDEX `class_period_attendance_records_madrasaId_status_idx` (`madrasaId`, `status`),
  CONSTRAINT `cpa_records_madrasaId_fkey`
    FOREIGN KEY (`madrasaId`) REFERENCES `madrasas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cpa_records_sessionId_madrasaId_fkey`
    FOREIGN KEY (`sessionId`, `madrasaId`) REFERENCES `class_period_attendance_sessions` (`id`, `madrasaId`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cpa_records_studentId_madrasaId_fkey`
    FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Step 2.6: Create table `ustadh_salary_components`
-- -------------------------------------------------------------------------------------
CREATE TABLE `ustadh_salary_components` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `ustadhId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('ALLOWANCE', 'DEDUCTION') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `isRecurring` TINYINT(1) NOT NULL DEFAULT 1,
  `effectiveFrom` DATE NOT NULL,
  `effectiveTo` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ustadh_salary_components_id_madrasaId_key` (`id`, `madrasaId`),
  INDEX `ustadh_salary_components_madrasaId_ustadhId_idx` (`madrasaId`, `ustadhId`),
  CONSTRAINT `ustadh_salary_components_madrasaId_fkey`
    FOREIGN KEY (`madrasaId`) REFERENCES `madrasas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ustadh_salary_components_ustadhId_madrasaId_fkey`
    FOREIGN KEY (`ustadhId`, `madrasaId`) REFERENCES `ustadhs` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Step 2.7: Create table `ustadh_payslip_records` (With Phase 4D-2F Approved Defaults)
-- -------------------------------------------------------------------------------------
CREATE TABLE `ustadh_payslip_records` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `ustadhSalaryId` VARCHAR(191) NOT NULL,
  `ustadhId` VARCHAR(191) NOT NULL,
  `payslipNumber` VARCHAR(191) NOT NULL,
  `revision` INT NOT NULL DEFAULT 1,
  `status` ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `salaryMonth` DATE NOT NULL,
  `basicSalary` DECIMAL(12, 2) NOT NULL,
  `totalAllowances` DECIMAL(12, 2) NOT NULL,
  `totalDeductions` DECIMAL(12, 2) NOT NULL,
  `grossEarnings` DECIMAL(12, 2) NOT NULL,
  `netPayable` DECIMAL(12, 2) NOT NULL,
  `netPayableWords` VARCHAR(255) NULL,
  `workingDays` INT NULL,
  `lecturesConducted` INT NULL,
  `attendanceRate` DECIMAL(5, 2) NULL,
  `allowancesJson` JSON NULL,
  `deductionsJson` JSON NULL,
  `employeeEpfAmount` DECIMAL(12, 2) NULL,
  `employerEpfAmount` DECIMAL(12, 2) NULL,
  `employerEtfAmount` DECIMAL(12, 2) NULL,
  `disbursedAt` DATETIME(3) NULL,
  `disbursementMethod` VARCHAR(50) NULL,
  `disbursementRef` VARCHAR(100) NULL,
  `voidReason` TEXT NULL,
  `voidedAt` DATETIME(3) NULL,
  `voidedById` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ustadh_payslip_records_payslipNumber_key` (`payslipNumber`),
  UNIQUE KEY `ustadh_payslip_records_id_madrasaId_key` (`id`, `madrasaId`),
  UNIQUE KEY `ustadh_payslip_records_ustadhSalaryId_revision_key` (`ustadhSalaryId`, `revision`),
  UNIQUE KEY `upr_madrasa_ustadh_month_rev_key` (`madrasaId`, `ustadhId`, `salaryMonth`, `revision`),
  INDEX `ustadh_payslip_records_madrasaId_ustadhId_idx` (`madrasaId`, `ustadhId`),
  INDEX `ustadh_payslip_records_madrasaId_status_idx` (`madrasaId`, `status`),
  CONSTRAINT `ustadh_payslip_records_madrasaId_fkey`
    FOREIGN KEY (`madrasaId`) REFERENCES `madrasas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ustadh_payslip_records_ustadhSalaryId_ustadhId_madrasaId_fkey`
    FOREIGN KEY (`ustadhSalaryId`, `ustadhId`, `madrasaId`) REFERENCES `ustadh_salaries` (`id`, `ustadhId`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ustadh_payslip_records_ustadhId_madrasaId_fkey`
    FOREIGN KEY (`ustadhId`, `madrasaId`) REFERENCES `ustadhs` (`id`, `madrasaId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ustadh_payslip_records_voidedById_fkey`
    FOREIGN KEY (`voidedById`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
