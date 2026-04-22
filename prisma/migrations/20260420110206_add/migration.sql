-- AlterTable
ALTER TABLE `roparecord` ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedById` INTEGER NULL,
    ADD COLUMN `rejectionReason` TEXT NULL;

-- AddForeignKey
ALTER TABLE `RopaRecord` ADD CONSTRAINT `RopaRecord_rejectedById_fkey` FOREIGN KEY (`rejectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
