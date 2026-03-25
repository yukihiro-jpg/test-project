import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateInheritanceTax, type HeirInfo, type AssetSummary, type GiftInfo, type PartitionAllocationInfo } from "@/calclogic/inheritanceTaxCalculator";

export async function GET(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const partitionPlanId = req.nextUrl.searchParams.get("partitionPlanId");
  if (!partitionPlanId) {
    return NextResponse.json({ error: "partitionPlanIdが必要です" }, { status: 400 });
  }

  const ds = await prisma.assetDataset.findUnique({
    where: { id: datasetId },
    include: {
      heirs: true,
      landAssets: true,
      buildingAssets: true,
      securityAssets: true,
      cashDeposits: true,
      insuranceAssets: true,
      otherAssets: true,
      liabilities: true,
      annualGifts: true,
    },
  });
  if (!ds) return NextResponse.json({ error: "データセットが見つかりません" }, { status: 404 });

  const plan = await prisma.partitionPlan.findUnique({
    where: { id: partitionPlanId },
    include: { allocations: true },
  });
  if (!plan) return NextResponse.json({ error: "分割案が見つかりません" }, { status: 404 });

  const heirInfos: HeirInfo[] = ds.heirs.map(h => ({
    id: h.id,
    name: h.name,
    relationship: h.relationship,
    taxLegalShareNum: h.taxLegalShareNum,
    taxLegalShareDen: h.taxLegalShareDen,
    twentyPercentAdd: h.twentyPercentAdd,
    isDisabled: h.isDisabled,
    disabilityType: h.disabilityType,
    birthDate: h.birthDate,
    isSpouse: h.relationship === "配偶者",
  }));

  const assets: AssetSummary = {
    landTotal: ds.landAssets.reduce((s, a) => s + a.evaluationAmount, 0),
    buildingTotal: ds.buildingAssets.reduce((s, a) => s + a.evaluationAmount, 0),
    securityTotal: ds.securityAssets.reduce((s, a) => s + a.amount, 0),
    depositTotal: ds.cashDeposits.reduce((s, a) => s + a.amount, 0),
    insuranceTotal: ds.insuranceAssets.reduce((s, a) => s + a.amount, 0),
    otherAssetTotal: ds.otherAssets.reduce((s, a) => s + a.amount, 0),
    liabilityTotal: ds.liabilities.reduce((s, a) => s + a.amount, 0),
    retirementTotal: 0,
  };

  const giftInfos: GiftInfo[] = ds.annualGifts.map(g => ({
    recipientName: g.recipientName,
    giftValue: g.giftValue,
    paidGiftTax: g.paidGiftTax,
    isAddBack: g.isAddBack,
  }));

  // Aggregate allocations per heir
  const allocationMap = new Map<string, number>();
  for (const alloc of plan.allocations) {
    const current = allocationMap.get(alloc.heirId) ?? 0;
    allocationMap.set(alloc.heirId, current + alloc.amount);
  }
  const allocationInfos: PartitionAllocationInfo[] = ds.heirs.map(h => ({
    heirId: h.id,
    amount: allocationMap.get(h.id) ?? 0,
  }));

  const legalHeirCount = ds.heirs.filter(h =>
    h.acquisitionCause === "相続" || h.relationship === "配偶者"
  ).length;

  const result = calculateInheritanceTax({
    heirs: heirInfos,
    assets,
    gifts: giftInfos,
    allocations: allocationInfos,
    baseDate: ds.baseDate,
    legalHeirCount: Math.max(1, legalHeirCount),
  });

  return NextResponse.json(result);
}
