import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { caseSchema } from "@/validators/case";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { datasets: { orderBy: { updatedAt: "desc" } } },
  });
  if (!c) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await req.json();
  const parsed = caseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.case.findFirst({
    where: { code: parsed.data.code, NOT: { id: caseId } },
  });
  if (existing) {
    return NextResponse.json({ error: "このコードは既に使用されています" }, { status: 409 });
  }
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  await prisma.case.delete({ where: { id: caseId } });
  return NextResponse.json({ success: true });
}
