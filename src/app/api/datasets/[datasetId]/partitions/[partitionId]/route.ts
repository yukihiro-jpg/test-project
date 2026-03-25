import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partitionPlanSchema } from "@/validators/partition";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string; partitionId: string }> }) {
  const { partitionId } = await params;
  const plan = await prisma.partitionPlan.findUnique({
    where: { id: partitionId },
    include: { allocations: { include: { heir: true } } },
  });
  if (!plan) return NextResponse.json({ error: "分割案が見つかりません" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ datasetId: string; partitionId: string }> }) {
  const { partitionId } = await params;
  const body = await req.json();
  const parsed = partitionPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.partitionPlan.update({
    where: { id: partitionId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ datasetId: string; partitionId: string }> }) {
  const { partitionId } = await params;
  await prisma.partitionPlan.delete({ where: { id: partitionId } });
  return NextResponse.json({ success: true });
}
