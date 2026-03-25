import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { securitySchema } from "@/validators/security";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const securities = await prisma.securityAsset.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(securities);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = securitySchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = { ...parsed.data };
    if (data.autoCalc) {
      data.amount = Math.floor(data.unitPrice * data.quantity * data.adjustmentCoeff);
    }
    const updated = await prisma.securityAsset.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  }

  const parsed = securitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = { ...parsed.data };
  if (data.autoCalc) {
    data.amount = Math.floor(data.unitPrice * data.quantity * data.adjustmentCoeff);
  }
  const created = await prisma.securityAsset.create({
    data: { ...data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.securityAsset.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
