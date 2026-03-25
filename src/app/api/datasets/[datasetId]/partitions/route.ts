import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partitionPlanSchema, MAX_PARTITIONS_PER_DATASET } from "@/validators/partition";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const plans = await prisma.partitionPlan.findMany({
    where: { datasetId },
    orderBy: { updatedAt: "desc" },
    include: { allocations: true },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  const body = await req.json();
  const parsed = partitionPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await prisma.partitionPlan.count({ where: { datasetId } });
  if (count >= MAX_PARTITIONS_PER_DATASET) {
    return NextResponse.json({ error: `分割案は最大${MAX_PARTITIONS_PER_DATASET}件までです` }, { status: 400 });
  }
  const created = await prisma.partitionPlan.create({
    data: { ...parsed.data, datasetId },
  });
  return NextResponse.json(created, { status: 201 });
}
