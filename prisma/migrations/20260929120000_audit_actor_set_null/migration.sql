-- Akun yang pernah login/beraksi sekarang bisa dihapus. Baris audit log tetap ada (FR-8.2):
-- actorId jadi NULL saat akunnya dihapus, dan actorName menyimpan namanya.

-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_actorId_fkey`;

-- AlterTable
ALTER TABLE `audit_logs`
    MODIFY `actorId` VARCHAR(191) NULL,
    ADD COLUMN `actorName` VARCHAR(191) NULL;

-- Isi nama untuk baris yang sudah ada
UPDATE `audit_logs` a JOIN `users` u ON u.`id` = a.`actorId` SET a.`actorName` = u.`name`;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
