-- OTP email untuk register & ganti email.
CREATE TABLE `email_otps` (
    `id` VARCHAR(191) NOT NULL,
    `purpose` ENUM('REGISTER', 'EMAIL_CHANGE_OLD', 'EMAIL_CHANGE_NEW') NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_otps_purpose_email_idx`(`purpose`, `email`),
    INDEX `email_otps_userId_purpose_idx`(`userId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_otps` ADD CONSTRAINT `email_otps_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
