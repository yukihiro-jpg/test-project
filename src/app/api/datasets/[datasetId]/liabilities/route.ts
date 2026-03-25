import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liabilitySchema } from "@/validators/liability";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const liabilities = await prisma.liabilityExpense.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(liabilities);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = liabilitySchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.liabilityExpense.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  }

  const parsed = liabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.liabilityExpense.create({
    data: { ...parsed.data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.liabilityExpense.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
