-- CreateTable
CREATE TABLE `student_scan_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `tokenEncrypted` TEXT NOT NULL,
    `tokenIv` VARCHAR(32) NOT NULL,
    `tokenAuthTag` VARCHAR(32) NOT NULL,
    `keyVersion` INTEGER NOT NULL DEFAULT 1,
    `tokenHint` VARCHAR(16) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `activeStudentId` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issuedById` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedById` VARCHAR(191) NULL,
    `revokeReason` VARCHAR(255) NULL,
    `lastScannedAt` DATETIME(3) NULL,
    `scanCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_scan_tokens_tokenHash_key`(`tokenHash`),
    UNIQUE INDEX `student_scan_tokens_madrasaId_activeStudentId_key`(`madrasaId`, `activeStudentId`),
    INDEX `student_scan_tokens_madrasaId_tokenHash_idx`(`madrasaId`, `tokenHash`),
    INDEX `student_scan_tokens_madrasaId_studentId_isActive_idx`(`madrasaId`, `studentId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_scan_tokens` ADD CONSTRAINT `student_scan_tokens_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_scan_tokens` ADD CONSTRAINT `student_scan_tokens_studentId_madrasaId_fkey` FOREIGN KEY (`studentId`, `madrasaId`) REFERENCES `students`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;
