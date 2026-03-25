import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { caseSchema } from "@/validators/case";

export async function GET() {
  const cases = await prisma.case.findMany({
    orderBy: { updatedAt: "desc" },
    include: { datasets: { select: { id: true } } },
  });
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = caseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.case.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "このコードは既に使用されています" }, { status: 409 });
  }
  const created = await prisma.case.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
