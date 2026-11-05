-- AlterTable
ALTER TABLE `users` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0 AFTER `mustChangePassword`;
