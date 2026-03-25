import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // 案件1: サンプルケース
  const case1 = await prisma.case.create({
    data: {
      code: "CASE-001",
      name: "山田 太郎",
      nameKana: "ヤマダ タロウ",
      birthDate: "1940-03-15",
      address: "東京都港区赤坂1-1-1",
      phone: "03-1234-5678",
      email: "sample@example.com",
      note: "サンプルデータ",
    },
  });

  // データセット
  const dataset1 = await prisma.assetDataset.create({
    data: {
      caseId: case1.id,
      name: "初期試算",
      baseDate: "2025-01-15",
      status: "active",
    },
  });

  // 相続人
  const spouse = await prisma.heir.create({
    data: {
      datasetId: dataset1.id,
      name: "山田 花子",
      nameKana: "ヤマダ ハナコ",
      relationship: "配偶者",
      acquisitionCause: "相続",
      civilLegalShareNum: 1,
      civilLegalShareDen: 2,
      taxLegalShareNum: 1,
      taxLegalShareDen: 2,
      twentyPercentAdd: false,
      isDisabled: false,
      birthDate: "1945-07-20",
      displayOrder: 0,
    },
  });

  const son = await prisma.heir.create({
    data: {
      datasetId: dataset1.id,
      name: "山田 一郎",
      nameKana: "ヤマダ イチロウ",
      relationship: "長男",
      acquisitionCause: "相続",
      civilLegalShareNum: 1,
      civilLegalShareDen: 4,
      taxLegalShareNum: 1,
      taxLegalShareDen: 4,
      twentyPercentAdd: false,
      isDisabled: false,
      birthDate: "1970-04-10",
      displayOrder: 1,
    },
  });

  const daughter = await prisma.heir.create({
    data: {
      datasetId: dataset1.id,
      name: "鈴木 美咲",
      nameKana: "スズキ ミサキ",
      relationship: "長女",
      acquisitionCause: "相続",
      civilLegalShareNum: 1,
      civilLegalShareDen: 4,
      taxLegalShareNum: 1,
      taxLegalShareDen: 4,
      twentyPercentAdd: false,
      isDisabled: false,
      birthDate: "1973-09-05",
      note: "婚姻により姓変更",
      displayOrder: 2,
    },
  });

  // 土地
  await prisma.landAsset.create({
    data: {
      datasetId: dataset1.id,
      landType: "宅地",
      location: "東京都港区赤坂1-1-1",
      usage: "自用地",
      area: 200,
      valuationMethod: "路線価方式",
      rosenka: 500000,
      ownershipShareNum: 1,
      ownershipShareDen: 1,
      adjustmentCoeff: 1.0,
      autoCalc: true,
      evaluationAmount: 100000000, // 5000 × 200 × 100 = 1億
      smallLandReduction: true,
      note: "自宅敷地",
      displayOrder: 0,
    },
  });

  // 建物
  await prisma.buildingAsset.create({
    data: {
      datasetId: dataset1.id,
      subType: "居宅",
      usage: "自用",
      location: "東京都港区赤坂1-1-1",
      floorArea: 150,
      fixedAssetTaxValue: 15000000,
      ownershipShareNum: 1,
      ownershipShareDen: 1,
      adjustmentCoeff: 1.0,
      autoCalc: true,
      evaluationAmount: 15000000,
      displayOrder: 0,
    },
  });

  // 上場有価証券
  await prisma.securityAsset.create({
    data: {
      datasetId: dataset1.id,
      institution: "○○証券",
      branch: "本店",
      securityType: "株式",
      name: "トヨタ自動車",
      unitPrice: 2500,
      quantity: 1000,
      adjustmentCoeff: 1.0,
      autoCalc: true,
      amount: 2500000,
      displayOrder: 0,
    },
  });

  await prisma.securityAsset.create({
    data: {
      datasetId: dataset1.id,
      institution: "○○証券",
      branch: "本店",
      securityType: "投資信託",
      name: "××ファンド",
      unitPrice: 15000,
      quantity: 200,
      adjustmentCoeff: 1.0,
      autoCalc: true,
      amount: 3000000,
      displayOrder: 1,
    },
  });

  // 預貯金
  await prisma.cashDepositAsset.create({
    data: {
      datasetId: dataset1.id,
      institution: "○○銀行",
      depositType: "普通預金",
      accountNumber: "1234567",
      amount: 20000000,
      displayOrder: 0,
    },
  });

  await prisma.cashDepositAsset.create({
    data: {
      datasetId: dataset1.id,
      institution: "△△銀行",
      depositType: "定期預金",
      accountNumber: "9876543",
      amount: 30000000,
      displayOrder: 1,
    },
  });

  await prisma.cashDepositAsset.create({
    data: {
      datasetId: dataset1.id,
      institution: "",
      depositType: "現金",
      amount: 1000000,
      note: "自宅保管現金",
      displayOrder: 2,
    },
  });

  // 生命保険
  await prisma.insuranceAsset.create({
    data: {
      datasetId: dataset1.id,
      company: "○○生命",
      policyNumber: "A-12345",
      insuranceType: "終身保険",
      premiumPayer: "山田 太郎",
      insuredPerson: "山田 太郎",
      beneficiaryId: spouse.id,
      amount: 30000000,
      isTaxExemptTarget: true,
      displayOrder: 0,
    },
  });

  await prisma.insuranceAsset.create({
    data: {
      datasetId: dataset1.id,
      company: "△△生命",
      policyNumber: "B-67890",
      insuranceType: "定期保険",
      premiumPayer: "山田 太郎",
      insuredPerson: "山田 太郎",
      beneficiaryId: son.id,
      amount: 10000000,
      isTaxExemptTarget: true,
      displayOrder: 1,
    },
  });

  // 債務・葬式費用
  await prisma.liabilityExpense.create({
    data: {
      datasetId: dataset1.id,
      liabilityType: "債務",
      subType: "住宅ローン残債",
      creditorName: "○○銀行",
      amount: 5000000,
      displayOrder: 0,
    },
  });

  await prisma.liabilityExpense.create({
    data: {
      datasetId: dataset1.id,
      liabilityType: "葬式費用",
      subType: "葬儀一式",
      creditorName: "○○葬儀社",
      amount: 2000000,
      displayOrder: 1,
    },
  });

  // 生前贈与
  await prisma.annualGift.create({
    data: {
      datasetId: dataset1.id,
      recipientName: "山田 一郎",
      giftDate: "2022-12-01",
      giftType: "現金",
      giftValue: 5000000,
      paidGiftTax: 485000,
      isAddBack: true,
      note: "住宅購入資金援助",
      displayOrder: 0,
    },
  });

  // 分割案1: 法定相続分
  const plan1 = await prisma.partitionPlan.create({
    data: {
      datasetId: dataset1.id,
      title: "法定相続分案",
      description: "法定相続分に基づく分割案",
    },
  });

  console.log("Seed data created successfully!");
  console.log(`Case: ${case1.id}`);
  console.log(`Dataset: ${dataset1.id}`);
  console.log(`Partition Plan: ${plan1.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
