-- Sistem notifikasi: tipe baru, judul + tautan di notifikasi, dan tabel aturan yang diatur Admin.

-- Tipe notifikasi baru (NEW_TICKET, ANNOUNCEMENT). Daftar enum MySQL ditulis ulang utuh.
ALTER TABLE `notifications`
    MODIFY `type` ENUM('SLA_WARNING', 'SLA_BREACH', 'NEW_REPLY', 'STATUS_CHANGE', 'NEW_TICKET', 'ANNOUNCEMENT') NOT NULL,
    ADD COLUMN `title` VARCHAR(160) NULL,
    ADD COLUMN `href` VARCHAR(255) NULL;

-- Daftar notifikasi per user, terbaru dulu.
CREATE INDEX `notifications_userId_createdAt_idx` ON `notifications`(`userId`, `createdAt`);

-- CreateTable
CREATE TABLE `notification_rules` (
    `id` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(40) NULL,
    `name` VARCHAR(80) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `title` VARCHAR(160) NOT NULL,
    `message` TEXT NOT NULL,
    `audience` VARCHAR(160) NOT NULL,
    `target` ENUM('TICKET', 'TICKET_LIST', 'DASHBOARD', 'CUSTOM') NOT NULL DEFAULT 'TICKET',
    `customPath` VARCHAR(200) NULL,
    `lastSentAt` DATETIME(3) NULL,
    `lastSentCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_rules_eventKey_key`(`eventKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
