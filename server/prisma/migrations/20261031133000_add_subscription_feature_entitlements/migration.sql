-- Migration: 20261031133000_add_subscription_feature_entitlements
-- Description: Additive schema migration for PlanFeature entitlements and MadrasaFeatureOverride audit tracking.
-- Safety: Strictly additive. Zero DROPs, zero alterations to existing tables, zero data loss.

-- CreateTable: plan_features
CREATE TABLE IF NOT EXISTS `plan_features` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `featureKey` VARCHAR(100) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `plan_features_planId_idx`(`planId`),
    INDEX `plan_features_featureKey_idx`(`featureKey`),
    UNIQUE INDEX `plan_features_planId_featureKey_key`(`planId`, `featureKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: madrasa_feature_overrides
CREATE TABLE IF NOT EXISTS `madrasa_feature_overrides` (
    `id` VARCHAR(191) NOT NULL,
    `madrasaId` VARCHAR(191) NOT NULL,
    `featureKey` VARCHAR(100) NOT NULL,
    `overrideType` ENUM('GRANT', 'DENY') NOT NULL DEFAULT 'GRANT',
    `reason` TEXT NOT NULL,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `madrasa_feature_overrides_madrasaId_idx`(`madrasaId`),
    INDEX `madrasa_feature_overrides_featureKey_idx`(`featureKey`),
    INDEX `madrasa_feature_overrides_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `madrasa_feature_overrides_madrasaId_featureKey_key`(`madrasaId`, `featureKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: plan_features -> plans
ALTER TABLE `plan_features` ADD CONSTRAINT `plan_features_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: madrasa_feature_overrides -> madrasas
ALTER TABLE `madrasa_feature_overrides` ADD CONSTRAINT `madrasa_feature_overrides_madrasaId_fkey` FOREIGN KEY (`madrasaId`) REFERENCES `madrasas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: madrasa_feature_overrides -> users (createdBy)
ALTER TABLE `madrasa_feature_overrides` ADD CONSTRAINT `madrasa_feature_overrides_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: madrasa_feature_overrides -> users (updatedBy)
ALTER TABLE `madrasa_feature_overrides` ADD CONSTRAINT `madrasa_feature_overrides_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
