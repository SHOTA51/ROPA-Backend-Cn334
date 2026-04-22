/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `departmentId` INTEGER NULL,
    ADD COLUMN `email` VARCHAR(191) NOT NULL,
    ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `lastActive` DATETIME(3) NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `roleId` INTEGER NOT NULL,
    ADD COLUMN `status` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'OFFLINE';

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RopaRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purpose` TEXT NOT NULL,
    `dataSubject` VARCHAR(191) NOT NULL,
    `dataCategory` VARCHAR(191) NOT NULL,
    `legalBasis` ENUM('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST') NOT NULL,
    `dataSource` VARCHAR(191) NULL,
    `recipient` TEXT NULL,
    `retentionPeriod` VARCHAR(191) NOT NULL,
    `securityMeasures` TEXT NULL,
    `exerciseOfRights` VARCHAR(191) NULL,
    `dataProcessor` VARCHAR(191) NULL,
    `transferDestination` VARCHAR(191) NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE') NOT NULL DEFAULT 'DRAFT',
    `departmentId` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NULL,
    `importFileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RopaRecord_departmentId_idx`(`departmentId`),
    INDEX `RopaRecord_createdById_idx`(`createdById`),
    INDEX `RopaRecord_updatedById_idx`(`updatedById`),
    INDEX `RopaRecord_importFileId_idx`(`importFileId`),
    INDEX `RopaRecord_status_idx`(`status`),
    INDEX `RopaRecord_riskLevel_idx`(`riskLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RopaHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ropaRecordId` INTEGER NOT NULL,
    `fieldName` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `changedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RopaHistory_ropaRecordId_idx`(`ropaRecordId`),
    INDEX `RopaHistory_changedById_idx`(`changedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `activity` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
    `description` TEXT NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `sensitivity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_activity_idx`(`activity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `recordCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);

-- CreateIndex
CREATE INDEX `User_roleId_idx` ON `User`(`roleId`);

-- CreateIndex
CREATE INDEX `User_departmentId_idx` ON `User`(`departmentId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaRecord` ADD CONSTRAINT `RopaRecord_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaRecord` ADD CONSTRAINT `RopaRecord_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaRecord` ADD CONSTRAINT `RopaRecord_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaRecord` ADD CONSTRAINT `RopaRecord_importFileId_fkey` FOREIGN KEY (`importFileId`) REFERENCES `ImportFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaHistory` ADD CONSTRAINT `RopaHistory_ropaRecordId_fkey` FOREIGN KEY (`ropaRecordId`) REFERENCES `RopaRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RopaHistory` ADD CONSTRAINT `RopaHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
