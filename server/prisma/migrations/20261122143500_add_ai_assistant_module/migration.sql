-- AlterTable madrasas: Add ai_enabled and ai_expires_at
ALTER TABLE `madrasas`
    ADD COLUMN `ai_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ai_expires_at` DATETIME(3) NULL;

-- CreateTable platform_ai_settings
CREATE TABLE `platform_ai_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `monthly_price` DECIMAL(10, 2) NOT NULL DEFAULT 2500.00,
    `yearly_price` DECIMAL(10, 2) NOT NULL DEFAULT 25000.00,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'LKR',
    `bank_name` VARCHAR(191) NULL,
    `account_name` VARCHAR(191) NULL,
    `account_number` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `instructions` TEXT NULL,
    `features_list` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ai_subscription_requests
CREATE TABLE `ai_subscription_requests` (
    `id` VARCHAR(191) NOT NULL,
    `madrasa_id` VARCHAR(191) NOT NULL,
    `submitted_by_user_id` VARCHAR(191) NOT NULL,
    `plan_name` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `transaction_ref` VARCHAR(191) NOT NULL,
    `receipt_url` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `admin_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_subscription_requests_madrasa_id_idx`(`madrasa_id`),
    INDEX `ai_subscription_requests_status_idx`(`status`),
    INDEX `ai_subscription_requests_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_subscription_requests` ADD CONSTRAINT `ai_subscription_requests_madrasa_id_fkey` FOREIGN KEY (`madrasa_id`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_subscription_requests` ADD CONSTRAINT `ai_subscription_requests_submitted_by_user_id_fkey` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
