import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { datasetSchema } from "@/validators/dataset";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const ds = await prisma.assetDataset.findUnique({
    where: { id: datasetId },
    include: {
      case: true,
      heirs: { orderBy: { displayOrder: "asc" } },
      landAssets: { orderBy: { displayOrder: "asc" } },
      buildingAssets: { orderBy: { displayOrder: "asc" } },
      securityAssets: { orderBy: { displayOrder: "asc" } },
      cashDeposits: { orderBy: { displayOrder: "asc" } },
      insuranceAssets: { orderBy: { displayOrder: "asc" } },
      otherAssets: { orderBy: { displayOrder: "asc" } },
      liabilities: { orderBy: { displayOrder: "asc" } },
      annualGifts: { orderBy: { displayOrder: "asc" } },
      settlementGifts: { orderBy: { displayOrder: "asc" } },
      partitionPlans: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!ds) return NextResponse.json({ error: "データセットが見つかりません" }, { status: 404 });
  return NextResponse.json(ds);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();
  const parsed = datasetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.assetDataset.update({
    where: { id: datasetId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  await prisma.assetDataset.delete({ where: { id: datasetId } });
  return NextResponse.json({ success: true });
}
