"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface BuildingAsset {
  id: string;
  subType: string;
  usage: string | null;
  location: string | null;
  floorArea: number;
  fixedAssetTaxValue: number;
  ownershipShareNum: number;
  ownershipShareDen: number;
  adjustmentCoeff: number;
  autoCalc: boolean;
  evaluationAmount: number;
  note: string | null;
  displayOrder: number;
}

const BUILDING_TYPES = ["居宅", "店舗", "事務所", "工場", "倉庫", "共同住宅", "その他"];

function calcBuildingEval(b: Partial<BuildingAsset>): number {
  const share = (b.ownershipShareNum || 1) / (b.ownershipShareDen || 1);
  return Math.floor((b.fixedAssetTaxValue || 0) * share * (b.adjustmentCoeff || 1.0));
}

const defaultBuilding: Omit<BuildingAsset, "id"> = {
  subType: "居宅", usage: "", location: "", floorArea: 0,
  fixedAssetTaxValue: 0, ownershipShareNum: 1, ownershipShareDen: 1,
  adjustmentCoeff: 1.0, autoCalc: true, evaluationAmount: 0,
  note: "", displayOrder: 0,
};

export default function BuildingsPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [buildings, setBuildings] = useState<BuildingAsset[]>([]);
  const [editing, setEditing] = useState<Partial<BuildingAsset> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/buildings`);
    setBuildings(await res.json());
  };

  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => { setEditing({ ...defaultBuilding, displayOrder: buildings.length }); setIsNew(true); };
  const openEdit = (b: BuildingAsset) => { setEditing({ ...b }); setIsNew(false); };

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    if (data.autoCalc) data.evaluationAmount = calcBuildingEval(data);
    await fetch(`/api/datasets/${datasetId}/buildings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? data : { ...data, _update: true }),
    });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/buildings?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = buildings.reduce((s, b) => s + b.evaluationAmount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">建物</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>細目</TableHead>
              <TableHead>利用状況</TableHead>
              <TableHead>所在場所</TableHead>
              <TableHead className="text-right">床面積(㎡)</TableHead>
              <TableHead className="text-right">固定資産税評価額</TableHead>
              <TableHead className="text-right">所有割合</TableHead>
              <TableHead className="text-right">評価額</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buildings.map(b => (
              <TableRow key={b.id}>
                <TableCell>{b.subType}</TableCell>
                <TableCell>{b.usage || "-"}</TableCell>
                <TableCell className="max-w-[150px] truncate">{b.location || "-"}</TableCell>
                <TableCell className="text-right font-mono">{b.floorArea}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(b.fixedAssetTaxValue)}円</TableCell>
                <TableCell className="text-right">{b.ownershipShareNum}/{b.ownershipShareDen}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(b.evaluationAmount)}円</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>建物を削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(b.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {buildings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">建物が登録されていません</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t bg-gray-50 text-right">
          <span className="text-gray-500 mr-2">合計:</span>
          <span className="font-bold text-lg">{formatCurrency(total)}円</span>
        </div>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{isNew ? "建物を追加" : "建物を編集"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>細目</Label>
                  <Select value={editing.subType} onValueChange={v => setEditing(prev => ({ ...prev!, subType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUILDING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>利用状況</Label><Input value={editing.usage || ""} onChange={e => setEditing(prev => ({ ...prev!, usage: e.target.value }))} /></div>
              </div>
              <div><Label>所在場所</Label><Input value={editing.location || ""} onChange={e => setEditing(prev => ({ ...prev!, location: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>床面積 (㎡)</Label><Input type="number" step="0.01" value={editing.floorArea} onChange={e => setEditing(prev => ({ ...prev!, floorArea: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>固定資産税評価額</Label><Input type="number" value={editing.fixedAssetTaxValue} onChange={e => setEditing(prev => ({ ...prev!, fixedAssetTaxValue: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>所有割合</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={editing.ownershipShareNum} onChange={e => setEditing(prev => ({ ...prev!, ownershipShareNum: parseInt(e.target.value) || 1 }))} className="w-20" />
                    <span>/</span>
                    <Input type="number" value={editing.ownershipShareDen} onChange={e => setEditing(prev => ({ ...prev!, ownershipShareDen: parseInt(e.target.value) || 1 }))} className="w-20" />
                  </div>
                </div>
                <div><Label>調整係数</Label><Input type="number" step="0.01" value={editing.adjustmentCoeff} onChange={e => setEditing(prev => ({ ...prev!, adjustmentCoeff: parseFloat(e.target.value) || 1.0 }))} /></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={editing.autoCalc} onCheckedChange={v => setEditing(prev => ({ ...prev!, autoCalc: v }))} />
                  <Label>自動計算</Label>
                </div>
              </div>
              {!editing.autoCalc && (
                <div><Label>評価額（手入力）</Label><Input type="number" value={editing.evaluationAmount} onChange={e => setEditing(prev => ({ ...prev!, evaluationAmount: parseInt(e.target.value) || 0 }))} /></div>
              )}
              {editing.autoCalc && (
                <div className="p-3 bg-blue-50 rounded text-sm">自動計算評価額: <span className="font-bold">{formatCurrency(calcBuildingEval(editing))}円</span></div>
              )}
              <div><Label>注記</Label><Textarea value={editing.note || ""} onChange={e => setEditing(prev => ({ ...prev!, note: e.target.value }))} rows={2} /></div>
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
