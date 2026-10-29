-- Penanda pesan hasil "Teruskan" (forward) oleh Petugas.
ALTER TABLE `messages` ADD COLUMN `forwarded` BOOLEAN NOT NULL DEFAULT false;
