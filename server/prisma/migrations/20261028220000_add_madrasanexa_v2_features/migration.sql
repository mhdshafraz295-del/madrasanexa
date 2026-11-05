
-- 1. Add non-destructive composite UNIQUE index to classes for tenant isolation
ALTER TABLE `classes` 
  ADD UNIQUE INDEX `classes_id_madrasaId_key` (`id`, `madrasaId`);

-- 2. Extend FileType enum in file_objects
ALTER TABLE `file_objects` 
  MODIFY COLUMN `type` ENUM(
    'MADRASA_LOGO',
    'STUDENT_PHOTO',
    'STUDENT_DOCUMENT',
    'REPORT',
    'RECEIPT',
    'OTHER',
    'ABOUT_US_HERO',
    'ABOUT_US_STORY',
    'SUBSCRIPTION_RECEIPT',
    'EXAM_PAST_PAPER',
    'CURRICULUM_RESOURCE'
  ) NOT NULL;

-- 3. Extend NotificationEventType enum in notification_jobs
ALTER TABLE `notification_jobs`
  MODIFY COLUMN `eventType` ENUM(
    'FEE_PARTIAL_PAYMENT',
    'FEE_FULLY_PAID',
    'FEE_MONTH_END_REMINDER',
    'SALARY_PAID',
    'TIMETABLE_FINALIZED',
    'FOLLOW_UP_ASSIGNED',
    'FOLLOW_UP_REMINDER',
    'INVOICE_DUE_SOON_REMINDER',
    'APPLICATION_STATUS_UPDATE',
    'EXAM_RESULT_PUBLISHED',
    'DAILY_ACTIVITY_LOGGED',
    'MADRASA_NOTICE_BROADCAST'
  ) NOT NULL;

-- 4. Create Table: madrasa_profiles (Madrasa Homepage CMS)
CREATE TABLE IF NOT EXISTS `madrasa_profiles` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `isPublished` BOOLEAN NOT NULL DEFAULT false,
  `publishedAt` DATETIME(3) NULL,
  `introduction` TEXT NULL,
  `mission` TEXT NULL,
  `vision` TEXT NULL,
  `syllabusInfo` TEXT NULL,
  `rulesAndRegulations` TEXT NULL,
  `generatedSummary` TEXT NULL,
  `summaryGeneratedAt` DATETIME(3) NULL,
  `eventsJson` JSON NULL,
  `noticesJson` JSON NULL,
  `contactPhone` VARCHAR(50) NULL,
  `contactEmail` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `heroTitle` VARCHAR(255) NULL,
  `heroSubtitle` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `madrasa_profiles_madrasaId_key`(`madrasaId`),
  CONSTRAINT `madrasa_profiles_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create Table: admission_periods (Student Intake Cycles)
CREATE TABLE IF NOT EXISTS `admission_periods` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `academicYear` INT NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `isOpen` BOOLEAN NOT NULL DEFAULT true,
  `instructions` TEXT NULL,
  `capacity` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `admission_periods_id_madrasaId_key`(`id`, `madrasaId`),
  UNIQUE INDEX `admission_periods_madrasaId_academicYear_code_key`(`madrasaId`, `academicYear`, `code`),
  INDEX `admission_periods_madrasaId_isOpen_idx`(`madrasaId`, `isOpen`),
  CONSTRAINT `admission_periods_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Create Table: student_applications (Online / Intake Applications)
CREATE TABLE IF NOT EXISTS `student_applications` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `admissionPeriodId` VARCHAR(191) NOT NULL,
  `applicationNo` VARCHAR(50) NOT NULL,
  `applicantName` VARCHAR(191) NOT NULL,
  `dateOfBirth` DATE NOT NULL,
  `gender` ENUM('MALE', 'FEMALE') NOT NULL,
  `guardianName` VARCHAR(191) NOT NULL,
  `guardianRelationship` VARCHAR(100) NOT NULL,
  `guardianPhone` VARCHAR(50) NOT NULL,
  `guardianEmail` VARCHAR(255) NULL,
  `address` TEXT NOT NULL,
  `appliedClassId` VARCHAR(191) NULL,
  `previousSchool` VARCHAR(255) NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONVERTED') NOT NULL DEFAULT 'PENDING',
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedByUserId` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewRemarks` TEXT NULL,
  `convertedStudentId` VARCHAR(191) NULL,
  `convertedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `student_applications_id_madrasaId_key`(`id`, `madrasaId`),
  UNIQUE INDEX `student_applications_madrasaId_applicationNo_key`(`madrasaId`, `applicationNo`),
  INDEX `student_applications_madrasaId_admissionPeriodId_idx`(`madrasaId`, `admissionPeriodId`),
  INDEX `student_applications_madrasaId_status_idx`(`madrasaId`, `status`),

  CONSTRAINT `student_applications_admissionPeriod_fkey` FOREIGN KEY (`admissionPeriodId`, `madrasaId`) REFERENCES `admission_periods`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `student_applications_appliedClass_fkey` FOREIGN KEY (`appliedClassId`, `madrasaId`) REFERENCES `classes`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `student_applications_reviewedByUser_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `student_applications_convertedStudent_fkey` FOREIGN KEY (`convertedStudentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Create Table: exam_past_papers (Past Papers Repository)
CREATE TABLE IF NOT EXISTS `exam_past_papers` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `classId` VARCHAR(191) NOT NULL,
  `subjectId` VARCHAR(191) NULL,
  `fileObjectId` VARCHAR(191) NOT NULL,
  `academicYear` INT NOT NULL,
  `term` ENUM('TERM_1', 'TERM_2', 'TERM_3', 'FINAL', 'MID_TERM', 'MONTHLY') NOT NULL,
  `examTitle` VARCHAR(191) NOT NULL,
  `examDate` DATE NULL,
  `description` TEXT NULL,
  `uploadedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `exam_past_papers_id_madrasaId_key`(`id`, `madrasaId`),
  INDEX `exam_past_papers_madrasaId_classId_subjectId_idx`(`madrasaId`, `classId`, `subjectId`),
  INDEX `exam_past_papers_madrasaId_academicYear_term_idx`(`madrasaId`, `academicYear`, `term`),

  CONSTRAINT `exam_past_papers_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `exam_past_papers_classId_fkey` FOREIGN KEY (`classId`, `madrasaId`) REFERENCES `classes`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `exam_past_papers_subject_fkey` FOREIGN KEY (`subjectId`, `madrasaId`) REFERENCES `subjects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `exam_past_papers_fileObjectId_fkey` FOREIGN KEY (`fileObjectId`, `madrasaId`) REFERENCES `file_objects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `exam_past_papers_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Create Table: curriculum_resources (Books, Notes, Syllabi)
CREATE TABLE IF NOT EXISTS `curriculum_resources` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `classId` VARCHAR(191) NOT NULL,
  `subjectId` VARCHAR(191) NULL,
  `fileObjectId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `type` ENUM('SYLLABUS', 'BOOK', 'NOTE', 'WORKSHEET', 'AUDIO_RESOURCE', 'OTHER') NOT NULL,
  `author` VARCHAR(191) NULL,
  `edition` VARCHAR(100) NULL,
  `externalUrl` VARCHAR(500) NULL,
  `description` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `uploadedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `curriculum_resources_id_madrasaId_key`(`id`, `madrasaId`),
  INDEX `curriculum_resources_madrasaId_classId_subjectId_idx`(`madrasaId`, `classId`, `subjectId`),
  INDEX `curriculum_resources_madrasaId_type_idx`(`madrasaId`, `type`),

  CONSTRAINT `curriculum_resources_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `curriculum_resources_classId_fkey` FOREIGN KEY (`classId`, `madrasaId`) REFERENCES `classes`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `curriculum_resources_subject_fkey` FOREIGN KEY (`subjectId`, `madrasaId`) REFERENCES `subjects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `curriculum_resources_fileObjectId_fkey` FOREIGN KEY (`fileObjectId`, `madrasaId`) REFERENCES `file_objects`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `curriculum_resources_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9. Create Table: student_daily_activities (Daily Activity Logs & Guardian Notifications)
CREATE TABLE IF NOT EXISTS `student_daily_activities` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `recordedByUserId` VARCHAR(191) NOT NULL,
  `activityDate` DATE NOT NULL,
  `activityType` ENUM('ACADEMIC', 'BEHAVIOR', 'MEMORIZATION', 'ATTENDANCE_NOTE', 'GENERAL') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `notifyGuardian` BOOLEAN NOT NULL DEFAULT false,
  `guardianNotifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `student_daily_activities_id_madrasaId_key`(`id`, `madrasaId`),
  INDEX `student_daily_activities_madrasaId_studentId_activityDate_idx`(`madrasaId`, `studentId`, `activityDate`),
  INDEX `student_daily_activities_madrasaId_activityType_idx`(`madrasaId`, `activityType`),

  CONSTRAINT `student_daily_activities_student_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `student_daily_activities_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 10. Create Table: custom_field_definitions (Madrasa-Custom Requirements)
CREATE TABLE IF NOT EXISTS `custom_field_definitions` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `entityType` ENUM('STUDENT', 'USTADH', 'CLASS') NOT NULL,
  `fieldName` VARCHAR(100) NOT NULL,
  `fieldKey` VARCHAR(100) NOT NULL,
  `fieldType` ENUM('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX') NOT NULL,
  `optionsJson` JSON NULL,
  `isRequired` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `custom_field_definitions_id_madrasaId_key`(`id`, `madrasaId`),
  UNIQUE INDEX `custom_field_definitions_id_madrasa_entity_key`(`id`, `madrasaId`, `entityType`),
  UNIQUE INDEX `custom_field_definitions_madrasaId_entityType_fieldKey_key`(`madrasaId`, `entityType`, `fieldKey`),
  INDEX `custom_field_definitions_madrasaId_entityType_isActive_idx`(`madrasaId`, `entityType`, `isActive`),

  CONSTRAINT `custom_field_definitions_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 11. Create Table: custom_field_values (Madrasa-Custom Values)
CREATE TABLE IF NOT EXISTS `custom_field_values` (
  `id` VARCHAR(191) NOT NULL,
  `madrasaId` VARCHAR(191) NOT NULL,
  `fieldDefinitionId` VARCHAR(191) NOT NULL,
  `entityType` ENUM('STUDENT', 'USTADH', 'CLASS') NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `valueText` TEXT NULL,
  `valueNumber` DECIMAL(12, 4) NULL,
  `valueDate` DATE NULL,
  `valueBoolean` BOOLEAN NULL,
  `valueJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `custom_field_values_id_madrasaId_key`(`id`, `madrasaId`),
  UNIQUE INDEX `custom_field_values_madrasaId_fieldDef_entity_key`(`madrasaId`, `fieldDefinitionId`, `entityType`, `entityId`),
  INDEX `custom_field_values_madrasaId_entityType_entityId_idx`(`madrasaId`, `entityType`, `entityId`),

  CONSTRAINT `custom_field_values_fieldDef_fkey` FOREIGN KEY (`fieldDefinitionId`, `madrasaId`, `entityType`) REFERENCES `custom_field_definitions`(`id`, `madrasaId`, `entityType`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
