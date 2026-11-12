-- AlterTable: Add Special Offer and Original Pricing metadata to plans
ALTER TABLE `plans`
    ADD COLUMN `originalPrice` DECIMAL(12, 2) NULL AFTER `price`,
    ADD COLUMN `isSpecialOffer` BOOLEAN NOT NULL DEFAULT false AFTER `originalPrice`,
    ADD COLUMN `specialOfferLabel` VARCHAR(100) NULL AFTER `isSpecialOffer`;
