"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Heir {
  id: string;
  name: string;
  relationship: string;
}

interface AssetItem {
  id: string;
  type: string;
  label: string;
  amount: number;
}

interface Allocation {
  heirId: string;
  assetType: string;
  assetId: string;
  amount: number;
}

export default function PartitionEditPage({ params }: { params: Promise<{ caseId: string; datasetId: string; partitionId: string }> }) {
  const { caseId, datasetId, partitionId } = use(params);
  const [heirs, setHeirs] = useState<Heir[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map());
  const [planTitle, setPlanTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [dsRes, planRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}`),
        fetch(`/api/datasets/${datasetId}/partitions/${partitionId}`),
      ]);
      const ds = await dsRes.json();
      const plan = await planRes.json();

      setHeirs(ds.heirs || []);
      setPlanTitle(plan.title || "");

      // Build asset list
      const assetList: AssetItem[] = [];
      (ds.landAssets || []).forEach((a: { id: string; location: string; landType: string; evaluationAmount: number }) => {
        assetList.push({ id: a.id, type: "land", label: `土地: ${a.location || a.landType}`, amount: a.evaluationAmount });
      });
      (ds.buildingAssets || []).forEach((a: { id: string; location: string; subType: string; evaluationAmount: number }) => {
        assetList.push({ id: a.id, type: "building", label: `建物: ${a.location || a.subType}`, amount: a.evaluationAmount });
      });
      (ds.securityAssets || []).forEach((a: { id: string; name: string; securityType: string; amount: number }) => {
        assetList.push({ id: a.id, type: "security", label: `有価証券: ${a.name || a.securityType}`, amount: a.amount });
      });
      (ds.cashDeposits || []).forEach((a: { id: string; institution: string; depositType: string; amount: number }) => {
        assetList.push({ id: a.id, type: "deposit", label: `預貯金: ${a.institution || a.depositType}`, amount: a.amount });
      });
      (ds.insuranceAssets || []).forEach((a: { id: string; company: string; insuranceType: string; amount: number }) => {
        assetList.push({ id: a.id, type: "insurance", label: `保険: ${a.company || a.insuranceType}`, amount: a.amount });
      });
      (ds.otherAssets || []).forEach((a: { id: string; description: string; assetType: string; amount: number }) => {
        assetList.push({ id: a.id, type: "other", label: `その他: ${a.description || a.assetType}`, amount: a.amount });
      });
      (ds.liabilities || []).forEach((a: { id: string; creditorName: string; liabilityType: string; amount: number }) => {
        assetList.push({ id: a.id, type: "liability", label: `債務: ${a.creditorName || a.liabilityType}`, amount: -a.amount });
      });
      setAssets(assetList);

      // Load existing allocations
      const allocMap = new Map<string, number>();
      (plan.allocations || []).forEach((a: Allocation) => {
        allocMap.set(`${a.assetType}:${a.assetId}:${a.heirId}`, a.amount);
      });
      setAllocations(allocMap);
    };
    load();
  }, [datasetId, partitionId]);

  const getAllocation = (assetType: string, assetId: string, heirId: string): number => {
    return allocations.get(`${assetType}:${assetId}:${heirId}`) || 0;
  };

  const setAllocation = (assetType: string, assetId: string, heirId: string, amount: number) => {
    setAllocations(prev => {
      const next = new Map(prev);
      next.set(`${assetType}:${assetId}:${heirId}`, amount);
      return next;
    });
  };

  const getRowTotal = (asset: AssetItem): number => {
    return heirs.reduce((sum, h) => sum + getAllocation(asset.type, asset.id, h.id), 0);
  };

  const getHeirTotal = (heirId: string): number => {
    return assets.reduce((sum, a) => sum + getAllocation(a.type, a.id, heirId), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    const allocationList: Allocation[] = [];
    allocations.forEach((amount, key) => {
      if (amount === 0) return;
      const [assetType, assetId, heirId] = key.split(":");
      allocationList.push({ heirId, assetType, assetId, amount });
    });

    await fetch(`/api/datasets/${datasetId}/partitions/${partitionId}/allocations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations: allocationList }),
    });
    setSaving(false);
  };

  const basePath = `/cases/${caseId}/datasets/${datasetId}`;

  return (
    <div>
      <div className="mb-6">
        <Link href={`${basePath}/partitions`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />分割案一覧に戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">分割シミュレーション: {planTitle}</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />{saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {heirs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
          先に親族関係を登録してください。
          <Link href={`${basePath}/heirs`} className="text-blue-600 hover:underline ml-2">親族関係の登録</Link>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
          財産が登録されていません。
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">種類</TableHead>
                <TableHead className="min-w-[200px]">明細</TableHead>
                <TableHead className="text-right min-w-[120px]">評価額</TableHead>
                {heirs.map(h => (
                  <TableHead key={h.id} className="text-center min-w-[120px]">
                    {h.name}<br /><span className="text-xs text-gray-400">({h.relationship})</span>
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-[120px]">配分合計</TableHead>
                <TableHead className="text-center min-w-[60px]">状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(asset => {
                const rowTotal = getRowTotal(asset);
                const diff = Math.abs(asset.amount) - Math.abs(rowTotal);
                const isMatch = Math.abs(diff) < 1;

                return (
                  <TableRow key={`${asset.type}-${asset.id}`}>
                    <TableCell className="text-xs">
                      {asset.type === "liability" ? (
                        <Badge variant="destructive">債務</Badge>
                      ) : (
                        <Badge variant="secondary">{asset.label.split(":")[0]}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{asset.label.split(":").slice(1).join(":").trim()}</TableCell>
                    <TableCell className={`text-right font-mono ${asset.amount < 0 ? "text-red-600" : ""}`}>
                      {formatCurrency(asset.amount)}円
                    </TableCell>
                    {heirs.map(h => (
                      <TableCell key={h.id} className="p-1">
                        <Input
                          type="number"
                          value={getAllocation(asset.type, asset.id, h.id) || ""}
                          onChange={e => setAllocation(asset.type, asset.id, h.id, parseInt(e.target.value) || 0)}
                          className="text-right text-sm w-full"
                          placeholder="0"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono">{formatCurrency(rowTotal)}円</TableCell>
                    <TableCell className="text-center">
                      {isMatch ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="warning">差額{formatCurrency(diff)}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t bg-gray-50">
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">各人取得合計:</span>
              {heirs.map(h => (
                <span key={h.id} className="text-sm">
                  {h.name}: <span className="font-bold font-mono">{formatCurrency(getHeirTotal(h.id))}円</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
