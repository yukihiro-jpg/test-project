import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { heirSchema } from "@/validators/heir";
import { calculateLegalShares } from "@/calclogic/legalShareCalculator";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const heirs = await prisma.heir.findMany({
    where: { datasetId },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(heirs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body._update && body.id) {
    const { _update, id, createdAt, updatedAt, datasetId: _, ...updateData } = body;
    const parsed = heirSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.heir.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  }

  const parsed = heirSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const created = await prisma.heir.create({
    data: { ...parsed.data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();

  if (body.autoCalcShares) {
    const heirs = await prisma.heir.findMany({
      where: { datasetId },
      orderBy: { displayOrder: "asc" },
    });
    const shares = calculateLegalShares(heirs.map((h) => ({ relationship: h.relationship })));
    const results = await Promise.all(
      heirs.map(async (heir, i) => {
        const share = shares[i];
        return prisma.heir.update({
          where: { id: heir.id },
          data: {
            civilLegalShareNum: share.civilShareNum,
            civilLegalShareDen: share.civilShareDen,
            taxLegalShareNum: share.taxShareNum,
            taxLegalShareDen: share.taxShareDen,
            twentyPercentAdd: share.twentyPercentAdd,
          },
        });
      })
    );
    return NextResponse.json(results);
  }

  const { items } = body as { items: Array<{ id: string } & Record<string, unknown>> };
  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: "items配列が必要です" }, { status: 400 });
  }
  const results = await Promise.all(
    items.map(async (item) => {
      const { id, ...data } = item;
      const parsed = heirSchema.safeParse(data);
      if (!parsed.success) return { id, error: parsed.error.flatten() };
      return prisma.heir.update({ where: { id }, data: parsed.data });
    })
  );
  return NextResponse.json(results);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const deleteId = req.nextUrl.searchParams.get("deleteId");
  if (!deleteId) {
    return NextResponse.json({ error: "deleteIdが必要です" }, { status: 400 });
  }
  await prisma.heir.delete({ where: { id: deleteId } });
  return NextResponse.json({ success: true });
}
