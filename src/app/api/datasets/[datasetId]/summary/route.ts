import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;

  const [
    heirs, lands, buildings, securities, deposits,
    insurances, otherAssets, liabilities, annualGifts, settlementGifts,
  ] = await Promise.all([
    prisma.heir.findMany({ where: { datasetId } }),
    prisma.landAsset.findMany({ where: { datasetId } }),
    prisma.buildingAsset.findMany({ where: { datasetId } }),
    prisma.securityAsset.findMany({ where: { datasetId } }),
    prisma.cashDepositAsset.findMany({ where: { datasetId } }),
    prisma.insuranceAsset.findMany({ where: { datasetId } }),
    prisma.otherAsset.findMany({ where: { datasetId } }),
    prisma.liabilityExpense.findMany({ where: { datasetId } }),
    prisma.annualGift.findMany({ where: { datasetId } }),
    prisma.settlementGift.findMany({ where: { datasetId } }),
  ]);

  const summary = [
    { category: "親族関係", count: heirs.length, total: null, updatedAt: heirs.length > 0 ? heirs.reduce((latest, h) => h.updatedAt > latest ? h.updatedAt : latest, heirs[0].updatedAt) : null },
    { category: "土地", count: lands.length, total: lands.reduce((s, a) => s + a.evaluationAmount, 0), updatedAt: lands.length > 0 ? lands.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, lands[0].updatedAt) : null },
    { category: "建物", count: buildings.length, total: buildings.reduce((s, a) => s + a.evaluationAmount, 0), updatedAt: buildings.length > 0 ? buildings.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, buildings[0].updatedAt) : null },
    { category: "上場有価証券等", count: securities.length, total: securities.reduce((s, a) => s + a.amount, 0), updatedAt: securities.length > 0 ? securities.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, securities[0].updatedAt) : null },
    { category: "自社株等", count: 0, total: 0, updatedAt: null }, // プレースホルダ
    { category: "預貯金・現金", count: deposits.length, total: deposits.reduce((s, a) => s + a.amount, 0), updatedAt: deposits.length > 0 ? deposits.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, deposits[0].updatedAt) : null },
    { category: "生命保険", count: insurances.length, total: insurances.reduce((s, a) => s + a.amount, 0), updatedAt: insurances.length > 0 ? insurances.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, insurances[0].updatedAt) : null },
    { category: "退職手当金", count: 0, total: 0, updatedAt: null }, // プレースホルダ
    { category: "その他財産", count: otherAssets.length, total: otherAssets.reduce((s, a) => s + a.amount, 0), updatedAt: otherAssets.length > 0 ? otherAssets.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, otherAssets[0].updatedAt) : null },
    { category: "債務・葬式費用", count: liabilities.length, total: liabilities.reduce((s, a) => s + a.amount, 0), updatedAt: liabilities.length > 0 ? liabilities.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, liabilities[0].updatedAt) : null },
    { category: "生前贈与（相続時精算課税）", count: settlementGifts.length, total: settlementGifts.reduce((s, a) => s + a.giftValue, 0), updatedAt: settlementGifts.length > 0 ? settlementGifts.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, settlementGifts[0].updatedAt) : null },
    { category: "生前贈与（暦年課税）", count: annualGifts.length, total: annualGifts.reduce((s, a) => s + a.giftValue, 0), updatedAt: annualGifts.length > 0 ? annualGifts.reduce((latest, a) => a.updatedAt > latest ? a.updatedAt : latest, annualGifts[0].updatedAt) : null },
  ];

  const assetTotal = summary
    .filter(s => !["親族関係", "債務・葬式費用", "生前贈与（相続時精算課税）", "生前贈与（暦年課税）"].includes(s.category))
    .reduce((s, a) => s + (a.total ?? 0), 0);
  const liabilityTotal = summary.find(s => s.category === "債務・葬式費用")?.total ?? 0;
  const netAssets = assetTotal - liabilityTotal;

  return NextResponse.json({
    items: summary,
    assetTotal,
    liabilityTotal,
    netAssets,
  });
}
