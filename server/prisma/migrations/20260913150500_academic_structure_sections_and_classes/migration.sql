-- CreateTable
CREATE TABLE `academic_sections` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `academic_sections_madrasaId_isActive_sortOrder_idx`(`madrasaId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `academic_sections_id_madrasaId_key`(`id`, `madrasaId`),
    UNIQUE INDEX `academic_sections_madrasaId_name_key`(`madrasaId`, `name`),
    UNIQUE INDEX `academic_sections_madrasaId_code_key`(`madrasaId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- DropForeignKey
ALTER TABLE `classes` DROP FOREIGN KEY `classes_madrasaId_fkey`;

-- DropIndex
DROP INDEX `classes_madrasaId_name_key` ON `classes`;

-- AlterTable
ALTER TABLE `classes` ADD COLUMN `academicSectionId` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL;

-- CreateIndex
CREATE INDEX `classes_madrasaId_academicSectionId_isActive_idx` ON `classes`(`madrasaId`, `academicSectionId`, `isActive`);

-- CreateIndex
CREATE UNIQUE INDEX `classes_madrasaId_academicSectionId_name_key` ON `classes`(`madrasaId`, `academicSectionId`, `name`);

-- AddForeignKey
ALTER TABLE `academic_sections` ADD CONSTRAINT `academic_sections_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_academicSectionId_madrasaId_fkey` FOREIGN KEY (`academicSectionId`, `madrasaId`) REFERENCES `academic_sections`(`id`, `madrasaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

