"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface LandAsset {
  id: string;
  landType: string;
  location: string | null;
  usage: string | null;
  area: number;
  valuationMethod: string;
  rosenka: number;
  fixedAssetTaxValue: number;
  multiplier: number;
  ownershipShareNum: number;
  ownershipShareDen: number;
  adjustmentCoeff: number;
  autoCalc: boolean;
  evaluationAmount: number;
  smallLandReduction: boolean;
  urlMemo: string | null;
  note: string | null;
  displayOrder: number;
}

const LAND_TYPES = ["宅地", "田", "畑", "山林", "原野", "雑種地", "その他"];

function calcLandEval(land: Partial<LandAsset>): number {
  const share = (land.ownershipShareNum || 1) / (land.ownershipShareDen || 1);
  const coeff = land.adjustmentCoeff || 1.0;
  if (land.valuationMethod === "路線価方式") {
    return Math.floor((land.rosenka || 0) * (land.area || 0) * share * coeff);
  }
  return Math.floor((land.fixedAssetTaxValue || 0) * (land.multiplier || 1.0) * share * coeff);
}

const defaultLand: Omit<LandAsset, "id"> = {
  landType: "宅地", location: "", usage: "", area: 0,
  valuationMethod: "路線価方式", rosenka: 0, fixedAssetTaxValue: 0,
  multiplier: 1.0, ownershipShareNum: 1, ownershipShareDen: 1,
  adjustmentCoeff: 1.0, autoCalc: true, evaluationAmount: 0,
  smallLandReduction: false, urlMemo: "", note: "", displayOrder: 0,
};

export default function LandsPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [lands, setLands] = useState<LandAsset[]>([]);
  const [editing, setEditing] = useState<Partial<LandAsset> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/lands`);
    setLands(await res.json());
  };

  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => {
    setEditing({ ...defaultLand, displayOrder: lands.length });
    setIsNew(true);
  };

  const openEdit = (land: LandAsset) => {
    setEditing({ ...land });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    if (data.autoCalc) {
      data.evaluationAmount = calcLandEval(data);
    }
    if (isNew) {
      await fetch(`/api/datasets/${datasetId}/lands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      // Update via POST with id (we'll handle this)
      await fetch(`/api/datasets/${datasetId}/lands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, _update: true }),
      });
    }
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/lands?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = lands.reduce((s, l) => s + l.evaluationAmount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">土地</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>地目</TableHead>
              <TableHead>所在場所</TableHead>
              <TableHead>利用状況</TableHead>
              <TableHead className="text-right">面積(㎡)</TableHead>
              <TableHead>評価方式</TableHead>
              <TableHead className="text-right">所有割合</TableHead>
              <TableHead className="text-right">評価額</TableHead>
              <TableHead>小規模宅地</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lands.map(land => (
              <TableRow key={land.id}>
                <TableCell>{land.landType}</TableCell>
                <TableCell className="max-w-[150px] truncate">{land.location || "-"}</TableCell>
                <TableCell>{land.usage || "-"}</TableCell>
                <TableCell className="text-right font-mono">{land.area}</TableCell>
                <TableCell>{land.valuationMethod}</TableCell>
                <TableCell className="text-right">{land.ownershipShareNum}/{land.ownershipShareDen}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(land.evaluationAmount)}円</TableCell>
                <TableCell>{land.smallLandReduction ? "対象" : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(land)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>土地を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(land.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {lands.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  土地が登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t bg-gray-50 text-right">
          <span className="text-gray-500 mr-2">合計:</span>
          <span className="font-bold text-lg">{formatCurrency(total)}円</span>
        </div>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isNew ? "土地を追加" : "土地を編集"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>地目</Label>
                  <Select value={editing.landType} onValueChange={v => setEditing(prev => ({ ...prev!, landType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>所在場所</Label>
                  <Input value={editing.location || ""} onChange={e => setEditing(prev => ({ ...prev!, location: e.target.value }))} />
                </div>
                <div>
                  <Label>利用状況</Label>
                  <Input value={editing.usage || ""} onChange={e => setEditing(prev => ({ ...prev!, usage: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>面積 (㎡)</Label>
                  <Input type="number" step="0.01" value={editing.area} onChange={e => setEditing(prev => ({ ...prev!, area: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>評価方式</Label>
                  <Select value={editing.valuationMethod} onValueChange={v => setEditing(prev => ({ ...prev!, valuationMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="路線価方式">路線価方式</SelectItem>
                      <SelectItem value="倍率方式">倍率方式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>調整係数</Label>
                  <Input type="number" step="0.01" value={editing.adjustmentCoeff} onChange={e => setEditing(prev => ({ ...prev!, adjustmentCoeff: parseFloat(e.target.value) || 1.0 }))} />
                </div>
              </div>
              {editing.valuationMethod === "路線価方式" ? (
                <div>
                  <Label>路線価 (円/㎡)</Label>
                  <Input type="number" value={editing.rosenka} onChange={e => setEditing(prev => ({ ...prev!, rosenka: parseInt(e.target.value) || 0 }))} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>固定資産税評価額</Label>
                    <Input type="number" value={editing.fixedAssetTaxValue} onChange={e => setEditing(prev => ({ ...prev!, fixedAssetTaxValue: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>倍率</Label>
                    <Input type="number" step="0.1" value={editing.multiplier} onChange={e => setEditing(prev => ({ ...prev!, multiplier: parseFloat(e.target.value) || 1.0 }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>所有割合</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={editing.ownershipShareNum} onChange={e => setEditing(prev => ({ ...prev!, ownershipShareNum: parseInt(e.target.value) || 1 }))} className="w-20" />
                    <span>/</span>
                    <Input type="number" value={editing.ownershipShareDen} onChange={e => setEditing(prev => ({ ...prev!, ownershipShareDen: parseInt(e.target.value) || 1 }))} className="w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.autoCalc} onCheckedChange={v => setEditing(prev => ({ ...prev!, autoCalc: v }))} />
                    <Label>自動計算</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editing.smallLandReduction} onCheckedChange={v => setEditing(prev => ({ ...prev!, smallLandReduction: !!v }))} />
                    <Label>小規模宅地等</Label>
                  </div>
                </div>
              </div>
              {!editing.autoCalc && (
                <div>
                  <Label>評価額（手入力）</Label>
                  <Input type="number" value={editing.evaluationAmount} onChange={e => setEditing(prev => ({ ...prev!, evaluationAmount: parseInt(e.target.value) || 0 }))} />
                </div>
              )}
              {editing.autoCalc && (
                <div className="p-3 bg-blue-50 rounded text-sm">
                  自動計算評価額: <span className="font-bold">{formatCurrency(calcLandEval(editing))}円</span>
                </div>
              )}
              <div>
                <Label>URLメモ</Label>
                <Input value={editing.urlMemo || ""} onChange={e => setEditing(prev => ({ ...prev!, urlMemo: e.target.value }))} placeholder="参考URLなど" />
              </div>
              <div>
                <Label>注記</Label>
                <Textarea value={editing.note || ""} onChange={e => setEditing(prev => ({ ...prev!, note: e.target.value }))} rows={2} />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditing(null)}>キャンセル</Button>
                <Button onClick={handleSave}>{isNew ? "追加" : "保存"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
