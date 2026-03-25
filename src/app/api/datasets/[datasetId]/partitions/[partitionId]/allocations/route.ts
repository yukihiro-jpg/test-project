import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ partitionId: string }> }) {
  const { partitionId } = await params;
  const allocations = await prisma.partitionAllocation.findMany({
    where: { partitionPlanId: partitionId },
    include: { heir: true },
  });
  return NextResponse.json(allocations);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ partitionId: string }> }) {
  const { partitionId } = await params;
  const body = await req.json();
  const { allocations } = body as {
    allocations: Array<{
      heirId: string;
      assetType: string;
      assetId: string;
      amount: number;
    }>;
  };
  if (!allocations || !Array.isArray(allocations)) {
    return NextResponse.json({ error: "allocations配列が必要です" }, { status: 400 });
  }

  // Delete existing and recreate
  await prisma.partitionAllocation.deleteMany({
    where: { partitionPlanId: partitionId },
  });

  const created = await prisma.partitionAllocation.createMany({
    data: allocations.map((a) => ({
      partitionPlanId: partitionId,
      heirId: a.heirId,
      assetType: a.assetType,
      assetId: a.assetId,
      amount: a.amount,
    })),
  });

  return NextResponse.json({ count: created.count });
}
