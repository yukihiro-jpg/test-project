"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft, Users, Map, Building, TrendingUp, Wallet, Shield, FileText, Gift, Calculator, LayoutGrid } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SummaryItem {
  category: string;
  count: number;
  total: number | null;
  updatedAt: string | null;
}

interface SummaryData {
  items: SummaryItem[];
  assetTotal: number;
  liabilityTotal: number;
  netAssets: number;
}

interface DatasetInfo {
  id: string;
  name: string;
  baseDate: string;
  status: string;
  case: { id: string; name: string; code: string };
  partitionPlans: { id: string; title: string }[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "親族関係": <Users className="w-4 h-4" />,
  "土地": <Map className="w-4 h-4" />,
  "建物": <Building className="w-4 h-4" />,
  "上場有価証券等": <TrendingUp className="w-4 h-4" />,
  "預貯金・現金": <Wallet className="w-4 h-4" />,
  "生命保険": <Shield className="w-4 h-4" />,
  "その他財産": <FileText className="w-4 h-4" />,
  "債務・葬式費用": <FileText className="w-4 h-4" />,
  "生前贈与（暦年課税）": <Gift className="w-4 h-4" />,
};

const CATEGORY_LINKS: Record<string, string> = {
  "親族関係": "heirs",
  "土地": "lands",
  "建物": "buildings",
  "上場有価証券等": "securities",
  "預貯金・現金": "deposits",
  "生命保険": "insurances",
  "その他財産": "",
  "債務・葬式費用": "liabilities",
  "生前贈与（暦年課税）": "gifts",
};

export default function DatasetDetailPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}`).then(r => r.json()).then(setDataset);
    fetch(`/api/datasets/${datasetId}/summary`).then(r => r.json()).then(setSummary);
  }, [datasetId]);

  if (!dataset) return <p className="text-gray-500">読み込み中...</p>;

  const basePath = `/cases/${caseId}/datasets/${datasetId}`;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />{dataset.case.name} に戻る
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{dataset.name}</h1>
          <p className="text-sm text-gray-500 mt-1">基準日: {dataset.baseDate} / {dataset.case.name}（{dataset.case.code}）</p>
        </div>
        <div className="flex gap-2">
          <Link href={`${basePath}/partitions`}>
            <Button variant="outline" size="sm"><LayoutGrid className="w-4 h-4 mr-1" />分割案</Button>
          </Link>
          <Link href={`${basePath}/tax-estimate`}>
            <Button size="sm"><Calculator className="w-4 h-4 mr-1" />税額概算</Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-700">財産サマリー</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>種類</TableHead>
              <TableHead className="text-right">件数</TableHead>
              <TableHead className="text-right">合計金額</TableHead>
              <TableHead>更新日</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary?.items.map((item) => (
              <TableRow key={item.category}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {CATEGORY_ICONS[item.category] || <FileText className="w-4 h-4" />}
                    <span className="font-medium">{item.category}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.count}件</TableCell>
                <TableCell className="text-right font-mono">
                  {item.total !== null ? `${formatCurrency(item.total)}円` : "-"}
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ja-JP") : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {CATEGORY_LINKS[item.category] !== undefined && CATEGORY_LINKS[item.category] !== "" && (
                    <Link href={`${basePath}/${CATEGORY_LINKS[item.category]}`}>
                      <Button variant="ghost" size="sm">編集</Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {summary && (
          <div className="px-4 py-3 border-t bg-gray-50">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">財産総額:</span>
                <span className="ml-2 font-bold text-lg">{formatCurrency(summary.assetTotal)}円</span>
              </div>
              <div>
                <span className="text-gray-500">債務・葬式費用:</span>
                <span className="ml-2 font-bold text-lg text-red-600">-{formatCurrency(summary.liabilityTotal)}円</span>
              </div>
              <div>
                <span className="text-gray-500">純資産額:</span>
                <span className="ml-2 font-bold text-lg text-blue-600">{formatCurrency(summary.netAssets)}円</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
