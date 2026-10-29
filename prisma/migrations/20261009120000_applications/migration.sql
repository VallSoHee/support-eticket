-- Master aplikasi (CRUD Admin): client memilih aplikasi saat submit tiket, bukan mengetik sendiri.
-- `platforms` = daftar platform yang tersedia, teks pisah koma (mis. 'WEB,ANDROID').

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `platforms` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `applications_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `applicationId` VARCHAR(191) NULL;

-- Backfill: aplikasi yang sudah pernah diketik client di tiket lama dijadikan master data,
-- dengan platform = gabungan platform yang pernah dipakai di tiket-tiket itu.
INSERT INTO `applications` (`id`, `nama`, `platforms`)
SELECT UUID(), MIN(TRIM(`aplikasi`)), GROUP_CONCAT(DISTINCT `platform` ORDER BY FIELD(`platform`, 'WEB', 'ANDROID', 'IOS', 'DESKTOP', 'OTHER'))
FROM `tickets`
WHERE `aplikasi` <> '-'
GROUP BY LOWER(TRIM(`aplikasi`));

UPDATE `tickets` t
JOIN `applications` a ON LOWER(TRIM(t.`aplikasi`)) = LOWER(a.`nama`)
SET t.`applicationId` = a.`id`
WHERE t.`aplikasi` <> '-';

-- CreateIndex
CREATE INDEX `tickets_applicationId_idx` ON `tickets`(`applicationId`);

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
