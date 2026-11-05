-- CreateTable
CREATE TABLE `madrasa_email_settings` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `mode` ENUM('PLATFORM', 'CUSTOM_SMTP') NOT NULL DEFAULT 'PLATFORM',
    `fromName` VARCHAR(150) NULL,
    `fromEmail` VARCHAR(255) NULL,
    `replyToEmail` VARCHAR(255) NULL,
    `smtpHost` VARCHAR(255) NULL,
    `smtpPort` INTEGER NULL DEFAULT 587,
    `smtpSecurity` ENUM('SSL_TLS', 'STARTTLS') NOT NULL DEFAULT 'STARTTLS',
    `smtpUsername` VARCHAR(255) NULL,
    `smtpPasswordEncrypted` TEXT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `lastTestedAt` DATETIME(3) NULL,
    `lastVerificationErrorCode` VARCHAR(100) NULL,
    `configVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `madrasa_email_settings_madrasaId_key`(`madrasaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `madrasa_email_settings` ADD CONSTRAINT `madrasa_email_settings_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
