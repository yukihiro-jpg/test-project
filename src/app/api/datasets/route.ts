import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { datasetSchema, MAX_DATASETS_PER_CASE } from "@/validators/dataset";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { caseId, ...rest } = body;
  if (!caseId) {
    return NextResponse.json({ error: "caseIdは必須です" }, { status: 400 });
  }
  const parsed = datasetSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await prisma.assetDataset.count({ where: { caseId } });
  if (count >= MAX_DATASETS_PER_CASE) {
    return NextResponse.json({ error: `データセットは最大${MAX_DATASETS_PER_CASE}件までです` }, { status: 400 });
  }
  const created = await prisma.assetDataset.create({
    data: { ...parsed.data, caseId },
  });
  return NextResponse.json(created, { status: 201 });
}
