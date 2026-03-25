"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PartitionPlan {
  id: string;
  title: string;
}

interface HeirTaxDetail {
  heirId: string;
  heirName: string;
  acquiredAmount: number;
  giftAddBack: number;
  taxablePrice: number;
  taxShare: number;
  twentyPercentAddAmount: number;
  spouseDeduction: number;
  minorDeduction: number;
  disabilityDeduction: number;
  giftTaxCredit: number;
  successionDeduction: number;
  foreignTaxCredit: number;
  finalTax: number;
  legalShareRatio: number;
  acquisitionRatio: number;
  afterTaxAmount: number;
}

interface TaxEstimateResult {
  grossAssets: number;
  insuranceExemption: number;
  retirementExemption: number;
  netAssets: number;
  giftAddBackTotal: number;
  totalTaxableAmount: number;
  basicDeduction: number;
  taxableInheritance: number;
  totalTax: number;
  heirDetails: HeirTaxDetail[];
}

export default function TaxEstimatePage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [plans, setPlans] = useState<PartitionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [result, setResult] = useState<TaxEstimateResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/partitions`).then(r => r.json()).then((data) => {
      setPlans(data);
      if (data.length > 0) setSelectedPlanId(data[0].id);
    });
  }, [datasetId]);

  const handleCalc = async () => {
    if (!selectedPlanId) return;
    setLoading(true);
    const res = await fetch(`/api/datasets/${datasetId}/tax-estimate?partitionPlanId=${selectedPlanId}`);
    if (res.ok) {
      setResult(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedPlanId) handleCalc();
  }, [selectedPlanId]);

  const basePath = `/cases/${caseId}/datasets/${datasetId}`;
  const totalFinalTax = result?.heirDetails.reduce((s, h) => s + h.finalTax, 0) ?? 0;

  return (
    <div>
      <div className="mb-6">
        <Link href={basePath} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-4">相続税概算</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-64">
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger><SelectValue placeholder="分割案を選択" /></SelectTrigger>
            <SelectContent>
              {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCalc} disabled={!selectedPlanId || loading}>
          <Calculator className="w-4 h-4 mr-1" />{loading ? "計算中..." : "再計算"}
        </Button>
      </div>

      {plans.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
          先に分割案を作成してください。
          <Link href={`${basePath}/partitions`} className="text-blue-600 hover:underline ml-2">分割案の管理</Link>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* 概要 */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">課税概要</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">財産総額</div>
                <div className="font-bold text-lg">{formatCurrency(result.grossAssets)}円</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">生命保険非課税</div>
                <div className="font-bold text-lg text-green-600">-{formatCurrency(result.insuranceExemption)}円</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">純資産額</div>
                <div className="font-bold text-lg">{formatCurrency(result.netAssets)}円</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">生前贈与加算</div>
                <div className="font-bold text-lg">{formatCurrency(result.giftAddBackTotal)}円</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">課税価格合計</div>
                <div className="font-bold text-lg">{formatCurrency(result.totalTaxableAmount)}円</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-500">基礎控除</div>
                <div className="font-bold text-lg text-green-600">-{formatCurrency(result.basicDeduction)}円</div>
              </div>
              <div className="p-3 bg-blue-50 rounded">
                <div className="text-gray-500">課税遺産総額</div>
                <div className="font-bold text-lg text-blue-600">{formatCurrency(result.taxableInheritance)}円</div>
              </div>
              <div className="p-3 bg-blue-50 rounded">
                <div className="text-gray-500">相続税の総額</div>
                <div className="font-bold text-lg text-blue-600">{formatCurrency(result.totalTax)}円</div>
              </div>
              <div className="p-3 bg-red-50 rounded">
                <div className="text-gray-500">納付税額合計</div>
                <div className="font-bold text-lg text-red-600">{formatCurrency(totalFinalTax)}円</div>
              </div>
            </div>
          </div>

          {/* 各人明細 */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-4 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-700">各人の税額明細</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>項目</TableHead>
                    {result.heirDetails.map(h => (
                      <TableHead key={h.heirId} className="text-right min-w-[120px]">{h.heirName}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">取得財産価額</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono">{formatCurrency(h.acquiredAmount)}円</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">生前贈与加算額</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono">{formatCurrency(h.giftAddBack)}円</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-gray-50">
                    <TableCell className="font-medium">課税価格</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono font-bold">{formatCurrency(h.taxablePrice)}円</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">按分後税額</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono">{formatCurrency(h.taxShare)}円</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">2割加算</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono">{h.twentyPercentAddAmount > 0 ? `+${formatCurrency(h.twentyPercentAddAmount)}円` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">配偶者税額軽減</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono text-green-600">{h.spouseDeduction > 0 ? `-${formatCurrency(h.spouseDeduction)}円` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">未成年者控除</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono text-green-600">{h.minorDeduction > 0 ? `-${formatCurrency(h.minorDeduction)}円` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">障害者控除</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono text-green-600">{h.disabilityDeduction > 0 ? `-${formatCurrency(h.disabilityDeduction)}円` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">贈与税額控除</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono text-green-600">{h.giftTaxCredit > 0 ? `-${formatCurrency(h.giftTaxCredit)}円` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-red-50">
                    <TableCell className="font-bold text-red-700">納付すべき相続税額</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono font-bold text-red-700">{formatCurrency(h.finalTax)}円</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-medium text-gray-500">法定相続分</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right text-gray-500">{(h.legalShareRatio * 100).toFixed(1)}%</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-500">取得割合</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right text-gray-500">{(h.acquisitionRatio * 100).toFixed(1)}%</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-500">税引後金額</TableCell>
                    {result.heirDetails.map(h => (
                      <TableCell key={h.heirId} className="text-right font-mono text-gray-500">{formatCurrency(h.afterTaxAmount)}円</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="text-xs text-gray-400 text-right">
            ※ 本計算は概算です。正式な相続税額は税理士にご確認ください。
          </div>
        </div>
      )}
    </div>
  );
}
