-- CreateIndex
CREATE UNIQUE INDEX `student_fee_settings_madrasaId_studentId_effectiveFrom_key` ON `student_fee_settings`(`madrasaId`, `studentId`, `effectiveFrom`);

