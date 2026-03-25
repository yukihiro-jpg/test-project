"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Copy, Calculator } from "lucide-react";
import { calcAge } from "@/lib/utils";

interface Heir {
  id: string;
  name: string;
  nameKana: string | null;
  relationship: string;
  acquisitionCause: string;
  civilLegalShareNum: number;
  civilLegalShareDen: number;
  taxLegalShareNum: number;
  taxLegalShareDen: number;
  twentyPercentAdd: boolean;
  isDisabled: boolean;
  disabilityType: string | null;
  birthDate: string | null;
  note: string | null;
  displayOrder: number;
}

interface DatasetInfo {
  id: string;
  baseDate: string;
  case: { id: string; name: string };
}

const RELATIONSHIPS = ["配偶者", "長男", "長女", "次男", "次女", "三男", "三女", "父", "母", "兄弟姉妹", "甥姪", "孫", "その他"];

export default function HeirsPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [heirs, setHeirs] = useState<Heir[]>([]);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);

  const fetchData = async () => {
    const [hRes, dRes] = await Promise.all([
      fetch(`/api/datasets/${datasetId}/heirs`),
      fetch(`/api/datasets/${datasetId}`),
    ]);
    setHeirs(await hRes.json());
    setDataset(await dRes.json());
  };

  useEffect(() => { fetchData(); }, [datasetId]);

  const handleAdd = async () => {
    const maxOrder = heirs.length > 0 ? Math.max(...heirs.map(h => h.displayOrder)) + 1 : 0;
    await fetch(`/api/datasets/${datasetId}/heirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "新規相続人",
        relationship: "長男",
        displayOrder: maxOrder,
      }),
    });
    fetchData();
  };

  const handleDuplicate = async (heir: Heir) => {
    const { id, ...data } = heir;
    await fetch(`/api/datasets/${datasetId}/heirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, name: `${data.name}（コピー）`, displayOrder: heirs.length }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/heirs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: heirs.filter(h => h.id !== id) }),
    });
    // Direct delete via individual endpoint
    const res = await fetch(`/api/datasets/${datasetId}/heirs`, { method: "GET" });
    // We need a delete endpoint - let's use a workaround
    // Actually, let's call PUT on the heirs endpoint to save remaining heirs
    // For now, reload after deletion
    await fetch(`/api/datasets/${datasetId}`, { method: "GET" }); // trigger refresh
    // Better approach: use a DELETE call
    setHeirs(prev => prev.filter(h => h.id !== id));
    // We need to actually delete from DB - let's add inline
    await fetch(`/api/datasets/${datasetId}/heirs?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleSave = async (heir: Heir) => {
    await fetch(`/api/datasets/${datasetId}/heirs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [heir] }),
    });
  };

  const updateHeir = (id: string, field: string, value: unknown) => {
    setHeirs(prev => prev.map(h => {
      if (h.id !== id) return h;
      const updated = { ...h, [field]: value };
      // Auto-save on change (debounced would be better, but simple for MVP)
      setTimeout(() => handleSave(updated), 0);
      return updated;
    }));
  };

  const handleAutoCalcShares = async () => {
    // Simple auto-calculation using the legalShareCalculator
    const res = await fetch(`/api/datasets/${datasetId}/heirs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: heirs,
        autoCalcShares: true,
      }),
    });
    fetchData();
  };

  if (!dataset) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">親族関係</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoCalcShares}>
            <Calculator className="w-4 h-4 mr-1" />法定相続分を自動計算
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />追加
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>フリガナ</TableHead>
              <TableHead>続柄</TableHead>
              <TableHead>取得原因</TableHead>
              <TableHead>民法 法定相続分</TableHead>
              <TableHead>税法 法定相続分</TableHead>
              <TableHead>2割加算</TableHead>
              <TableHead>障害者</TableHead>
              <TableHead>生年月日</TableHead>
              <TableHead>年齢</TableHead>
              <TableHead>注記</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {heirs.map((heir) => (
              <TableRow key={heir.id}>
                <TableCell>
                  <Input
                    value={heir.name}
                    onChange={e => updateHeir(heir.id, "name", e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={heir.nameKana || ""}
                    onChange={e => updateHeir(heir.id, "nameKana", e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={heir.relationship}
                    onValueChange={v => updateHeir(heir.id, "relationship", v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={heir.acquisitionCause}
                    onValueChange={v => updateHeir(heir.id, "acquisitionCause", v)}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="相続">相続</SelectItem>
                      <SelectItem value="遺贈">遺贈</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={heir.civilLegalShareNum}
                      onChange={e => updateHeir(heir.id, "civilLegalShareNum", parseInt(e.target.value) || 0)}
                      className="w-14 text-center"
                    />
                    <span>/</span>
                    <Input
                      type="number"
                      value={heir.civilLegalShareDen}
                      onChange={e => updateHeir(heir.id, "civilLegalShareDen", parseInt(e.target.value) || 1)}
                      className="w-14 text-center"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={heir.taxLegalShareNum}
                      onChange={e => updateHeir(heir.id, "taxLegalShareNum", parseInt(e.target.value) || 0)}
                      className="w-14 text-center"
                    />
                    <span>/</span>
                    <Input
                      type="number"
                      value={heir.taxLegalShareDen}
                      onChange={e => updateHeir(heir.id, "taxLegalShareDen", parseInt(e.target.value) || 1)}
                      className="w-14 text-center"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={heir.twentyPercentAdd}
                    onCheckedChange={v => updateHeir(heir.id, "twentyPercentAdd", !!v)}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={heir.isDisabled}
                    onCheckedChange={v => updateHeir(heir.id, "isDisabled", !!v)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={heir.birthDate || ""}
                    onChange={e => updateHeir(heir.id, "birthDate", e.target.value)}
                    className="w-36"
                  />
                </TableCell>
                <TableCell className="text-center">
                  {heir.birthDate && dataset ? calcAge(heir.birthDate, dataset.baseDate) : "-"}
                </TableCell>
                <TableCell>
                  <Input
                    value={heir.note || ""}
                    onChange={e => updateHeir(heir.id, "note", e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" title="複製" onClick={() => handleDuplicate(heir)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="削除">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>相続人を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>「{heir.name}」を削除します。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(heir.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {heirs.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                  相続人が登録されていません。「追加」ボタンで登録してください。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
