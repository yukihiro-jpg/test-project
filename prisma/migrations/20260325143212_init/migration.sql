-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL,
    "birthDate" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetDataset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Heir" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "relationship" TEXT NOT NULL,
    "acquisitionCause" TEXT NOT NULL DEFAULT '相続',
    "civilLegalShareNum" INTEGER NOT NULL DEFAULT 0,
    "civilLegalShareDen" INTEGER NOT NULL DEFAULT 1,
    "taxLegalShareNum" INTEGER NOT NULL DEFAULT 0,
    "taxLegalShareDen" INTEGER NOT NULL DEFAULT 1,
    "twentyPercentAdd" BOOLEAN NOT NULL DEFAULT false,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "disabilityType" TEXT,
    "birthDate" TEXT,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Heir_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "landType" TEXT NOT NULL DEFAULT '宅地',
    "location" TEXT,
    "usage" TEXT,
    "area" REAL NOT NULL DEFAULT 0,
    "valuationMethod" TEXT NOT NULL DEFAULT '路線価方式',
    "rosenka" INTEGER NOT NULL DEFAULT 0,
    "fixedAssetTaxValue" INTEGER NOT NULL DEFAULT 0,
    "multiplier" REAL NOT NULL DEFAULT 1.0,
    "ownershipShareNum" INTEGER NOT NULL DEFAULT 1,
    "ownershipShareDen" INTEGER NOT NULL DEFAULT 1,
    "adjustmentCoeff" REAL NOT NULL DEFAULT 1.0,
    "autoCalc" BOOLEAN NOT NULL DEFAULT true,
    "evaluationAmount" INTEGER NOT NULL DEFAULT 0,
    "smallLandReduction" BOOLEAN NOT NULL DEFAULT false,
    "urlMemo" TEXT,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "subType" TEXT NOT NULL DEFAULT '居宅',
    "usage" TEXT,
    "location" TEXT,
    "floorArea" REAL NOT NULL DEFAULT 0,
    "fixedAssetTaxValue" INTEGER NOT NULL DEFAULT 0,
    "ownershipShareNum" INTEGER NOT NULL DEFAULT 1,
    "ownershipShareDen" INTEGER NOT NULL DEFAULT 1,
    "adjustmentCoeff" REAL NOT NULL DEFAULT 1.0,
    "autoCalc" BOOLEAN NOT NULL DEFAULT true,
    "evaluationAmount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildingAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "institution" TEXT,
    "branch" TEXT,
    "securityType" TEXT NOT NULL DEFAULT '株式',
    "name" TEXT,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "quantity" REAL NOT NULL DEFAULT 0,
    "adjustmentCoeff" REAL NOT NULL DEFAULT 1.0,
    "autoCalc" BOOLEAN NOT NULL DEFAULT true,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "urlMemo" TEXT,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashDepositAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "institution" TEXT,
    "depositType" TEXT NOT NULL DEFAULT '普通預金',
    "accountNumber" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashDepositAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsuranceAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "company" TEXT,
    "policyNumber" TEXT,
    "insuranceType" TEXT NOT NULL DEFAULT '終身保険',
    "premiumPayer" TEXT,
    "insuredPerson" TEXT,
    "beneficiaryId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "isTaxExemptTarget" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InsuranceAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InsuranceAsset_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Heir" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtherAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'その他',
    "subType" TEXT,
    "description" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OtherAsset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LiabilityExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "liabilityType" TEXT NOT NULL DEFAULT '債務',
    "subType" TEXT,
    "creditorName" TEXT,
    "creditorAddress" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LiabilityExpense_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnualGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "recipientName" TEXT,
    "giftDate" TEXT,
    "giftType" TEXT,
    "subType" TEXT,
    "giftValue" INTEGER NOT NULL DEFAULT 0,
    "paidGiftTax" INTEGER NOT NULL DEFAULT 0,
    "isAddBack" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnnualGift_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "recipientName" TEXT,
    "giftDate" TEXT,
    "giftType" TEXT,
    "subType" TEXT,
    "giftValue" INTEGER NOT NULL DEFAULT 0,
    "paidGiftTax" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SettlementGift_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartitionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartitionPlan_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AssetDataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartitionAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partitionPlanId" TEXT NOT NULL,
    "heirId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartitionAllocation_partitionPlanId_fkey" FOREIGN KEY ("partitionPlanId") REFERENCES "PartitionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartitionAllocation_heirId_fkey" FOREIGN KEY ("heirId") REFERENCES "Heir" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Case_code_key" ON "Case"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartitionAllocation_partitionPlanId_heirId_assetType_assetId_key" ON "PartitionAllocation"("partitionPlanId", "heirId", "assetType", "assetId");
