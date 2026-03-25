import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { insuranceSchema } from "@/validators/insurance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const insurances = await prisma.insuranceAsset.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
    include: { beneficiary: true },
  });
  return NextResponse.json(insurances);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = insuranceSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.insuranceAsset.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  }

  const parsed = insuranceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.insuranceAsset.create({
    data: { ...parsed.data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.insuranceAsset.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
