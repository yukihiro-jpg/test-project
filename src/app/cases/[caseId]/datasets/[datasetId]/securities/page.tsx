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

interface SecurityAsset {
  id: string;
  institution: string | null;
  branch: string | null;
  securityType: string;
  name: string | null;
  unitPrice: number;
  quantity: number;
  adjustmentCoeff: number;
  autoCalc: boolean;
  amount: number;
  urlMemo: string | null;
  note: string | null;
  displayOrder: number;
}

const SECURITY_TYPES = ["株式", "投資信託", "公社債", "その他"];

function calcSecurityAmount(s: Partial<SecurityAsset>): number {
  return Math.floor((s.unitPrice || 0) * (s.quantity || 0) * (s.adjustmentCoeff || 1.0));
}

const defaultSecurity: Omit<SecurityAsset, "id"> = {
  institution: "", branch: "", securityType: "株式", name: "",
  unitPrice: 0, quantity: 0, adjustmentCoeff: 1.0,
  autoCalc: true, amount: 0, urlMemo: "", note: "", displayOrder: 0,
};

export default function SecuritiesPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [securities, setSecurities] = useState<SecurityAsset[]>([]);
  const [editing, setEditing] = useState<Partial<SecurityAsset> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/securities`);
    setSecurities(await res.json());
  };
  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => { setEditing({ ...defaultSecurity, displayOrder: securities.length }); setIsNew(true); };
  const openEdit = (s: SecurityAsset) => { setEditing({ ...s }); setIsNew(false); };

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    if (data.autoCalc) data.amount = calcSecurityAmount(data);
    await fetch(`/api/datasets/${datasetId}/securities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? data : { ...data, _update: true }),
    });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/securities?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = securities.reduce((s, sec) => s + sec.amount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">上場有価証券等</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>金融機関</TableHead>
              <TableHead>種類</TableHead>
              <TableHead>銘柄</TableHead>
              <TableHead className="text-right">単価</TableHead>
              <TableHead className="text-right">数量</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {securities.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.institution || "-"}{s.branch ? ` ${s.branch}` : ""}</TableCell>
                <TableCell>{s.securityType}</TableCell>
                <TableCell>{s.name || "-"}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.unitPrice)}円</TableCell>
                <TableCell className="text-right font-mono">{s.quantity}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(s.amount)}円</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {securities.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">有価証券が登録されていません</TableCell></TableRow>}
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
            <DialogHeader><DialogTitle>{isNew ? "有価証券を追加" : "有価証券を編集"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>金融機関名</Label><Input value={editing.institution || ""} onChange={e => setEditing(prev => ({ ...prev!, institution: e.target.value }))} /></div>
                <div><Label>支店名</Label><Input value={editing.branch || ""} onChange={e => setEditing(prev => ({ ...prev!, branch: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>種類</Label>
                  <Select value={editing.securityType} onValueChange={v => setEditing(prev => ({ ...prev!, securityType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SECURITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>銘柄</Label><Input value={editing.name || ""} onChange={e => setEditing(prev => ({ ...prev!, name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>単価</Label><Input type="number" value={editing.unitPrice} onChange={e => setEditing(prev => ({ ...prev!, unitPrice: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label>数量</Label><Input type="number" step="0.01" value={editing.quantity} onChange={e => setEditing(prev => ({ ...prev!, quantity: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>調整係数</Label><Input type="number" step="0.01" value={editing.adjustmentCoeff} onChange={e => setEditing(prev => ({ ...prev!, adjustmentCoeff: parseFloat(e.target.value) || 1.0 }))} /></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={editing.autoCalc} onCheckedChange={v => setEditing(prev => ({ ...prev!, autoCalc: v }))} /><Label>自動計算</Label></div>
              </div>
              {!editing.autoCalc && <div><Label>金額（手入力）</Label><Input type="number" value={editing.amount} onChange={e => setEditing(prev => ({ ...prev!, amount: parseInt(e.target.value) || 0 }))} /></div>}
              {editing.autoCalc && <div className="p-3 bg-blue-50 rounded text-sm">自動計算金額: <span className="font-bold">{formatCurrency(calcSecurityAmount(editing))}円</span></div>}
              <div><Label>URLメモ</Label><Input value={editing.urlMemo || ""} onChange={e => setEditing(prev => ({ ...prev!, urlMemo: e.target.value }))} /></div>
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
