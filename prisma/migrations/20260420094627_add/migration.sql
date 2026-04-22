-- AlterTable
ALTER TABLE `roparecord` ADD COLUMN `accessControl` TEXT NULL,
    ADD COLUMN `article28Exception` TEXT NULL,
    ADD COLUMN `auditMeasure` TEXT NULL,
    ADD COLUMN `collectionMethod` ENUM('SOFT_FILE', 'HARD_COPY', 'BOTH') NULL,
    ADD COLUMN `dataType` ENUM('GENERAL', 'SENSITIVE') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `deletionMethod` TEXT NULL,
    ADD COLUMN `destinationStandard` TEXT NULL,
    ADD COLUMN `disclosureExempt` TEXT NULL,
    ADD COLUMN `intraGroupTransfer` TEXT NULL,
    ADD COLUMN `minorConsent` ENUM('NONE', 'AGE_UNDER_10', 'AGE_10_20') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `organizationalMeasures` TEXT NULL,
    ADD COLUMN `personalDataItems` TEXT NULL,
    ADD COLUMN `physicalMeasures` TEXT NULL,
    ADD COLUMN `processingActivity` TEXT NULL,
    ADD COLUMN `processorAddress` TEXT NULL,
    ADD COLUMN `recordType` ENUM('CONTROLLER', 'PROCESSOR') NOT NULL DEFAULT 'CONTROLLER',
    ADD COLUMN `rightsRejection` TEXT NULL,
    ADD COLUMN `sourceDirect` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sourceIndirect` TEXT NULL,
    ADD COLUMN `storageMethod` TEXT NULL,
    ADD COLUMN `storageType` VARCHAR(191) NULL,
    ADD COLUMN `technicalMeasures` TEXT NULL,
    ADD COLUMN `transferExists` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `transferMethod` TEXT NULL,
    ADD COLUMN `userResponsibility` TEXT NULL,
    MODIFY `exerciseOfRights` TEXT NULL;

-- CreateIndex
CREATE INDEX `RopaRecord_recordType_idx` ON `RopaRecord`(`recordType`);

-- CreateIndex
CREATE INDEX `RopaRecord_dataType_idx` ON `RopaRecord`(`dataType`);
