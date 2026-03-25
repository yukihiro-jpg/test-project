import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildingSchema } from "@/validators/building";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const buildings = await prisma.buildingAsset.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(buildings);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = buildingSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = { ...parsed.data };
    if (data.autoCalc) {
      const share = data.ownershipShareNum / data.ownershipShareDen;
      data.evaluationAmount = Math.floor(data.fixedAssetTaxValue * share * data.adjustmentCoeff);
    }
    const updated = await prisma.buildingAsset.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  }

  const parsed = buildingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = { ...parsed.data };
  if (data.autoCalc) {
    const share = data.ownershipShareNum / data.ownershipShareDen;
    data.evaluationAmount = Math.floor(data.fixedAssetTaxValue * share * data.adjustmentCoeff);
  }
  const created = await prisma.buildingAsset.create({
    data: { ...data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.buildingAsset.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
