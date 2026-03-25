import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { landSchema } from "@/validators/land";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const lands = await prisma.landAsset.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(lands);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = landSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = { ...parsed.data };
    if (data.autoCalc) {
      data.evaluationAmount = calcLandValue(data);
    }
    const updated = await prisma.landAsset.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  }

  const parsed = landSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = { ...parsed.data };
  if (data.autoCalc) {
    data.evaluationAmount = calcLandValue(data);
  }
  const created = await prisma.landAsset.create({
    data: { ...data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.landAsset.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}

function calcLandValue(d: Record<string, unknown>): number {
  const share = (d.ownershipShareNum as number) / (d.ownershipShareDen as number);
  const coeff = d.adjustmentCoeff as number;
  if (d.valuationMethod === "路線価方式") {
    return Math.floor((d.rosenka as number) * (d.area as number) * share * coeff);
  }
  return Math.floor((d.fixedAssetTaxValue as number) * (d.multiplier as number) * share * coeff);
}
