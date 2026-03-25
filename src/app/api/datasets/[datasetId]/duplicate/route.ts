import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_DATASETS_PER_CASE } from "@/validators/dataset";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const source = await prisma.assetDataset.findUnique({
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
      settlementGifts: true,
    },
  });
  if (!source) {
    return NextResponse.json({ error: "データセットが見つかりません" }, { status: 404 });
  }
  const count = await prisma.assetDataset.count({ where: { caseId: source.caseId } });
  if (count >= MAX_DATASETS_PER_CASE) {
    return NextResponse.json({ error: `データセットは最大${MAX_DATASETS_PER_CASE}件までです` }, { status: 400 });
  }

  const newDataset = await prisma.assetDataset.create({
    data: {
      caseId: source.caseId,
      name: `${source.name}（コピー）`,
      baseDate: source.baseDate,
      status: "draft",
      heirs: {
        create: source.heirs.map(({ id, datasetId, createdAt, updatedAt, ...h }) => h),
      },
      landAssets: {
        create: source.landAssets.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      buildingAssets: {
        create: source.buildingAssets.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      securityAssets: {
        create: source.securityAssets.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      cashDeposits: {
        create: source.cashDeposits.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      insuranceAssets: {
        create: source.insuranceAssets.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      otherAssets: {
        create: source.otherAssets.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      liabilities: {
        create: source.liabilities.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      annualGifts: {
        create: source.annualGifts.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
      settlementGifts: {
        create: source.settlementGifts.map(({ id, datasetId, createdAt, updatedAt, ...a }) => a),
      },
    },
  });

  return NextResponse.json(newDataset, { status: 201 });
}
