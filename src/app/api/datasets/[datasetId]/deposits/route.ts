import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { depositSchema } from "@/validators/deposit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const deposits = await prisma.cashDepositAsset.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(deposits);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = depositSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.cashDepositAsset.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  }

  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.cashDepositAsset.create({
    data: { ...parsed.data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.cashDepositAsset.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
