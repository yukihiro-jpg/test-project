"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface Heir { id: string; name: string; }

interface InsuranceAsset {
  id: string;
  company: string | null;
  policyNumber: string | null;
  insuranceType: string;
  premiumPayer: string | null;
  insuredPerson: string | null;
  beneficiaryId: string | null;
  amount: number;
  isTaxExemptTarget: boolean;
  note: string | null;
  displayOrder: number;
  beneficiary?: Heir | null;
}

const INSURANCE_TYPES = ["終身保険", "定期保険", "養老保険", "個人年金保険", "その他"];

export default function InsurancesPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [insurances, setInsurances] = useState<InsuranceAsset[]>([]);
  const [heirs, setHeirs] = useState<Heir[]>([]);
  const [editing, setEditing] = useState<Partial<InsuranceAsset> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const [iRes, hRes] = await Promise.all([
      fetch(`/api/datasets/${datasetId}/insurances`),
      fetch(`/api/datasets/${datasetId}/heirs`),
    ]);
    setInsurances(await iRes.json());
    setHeirs(await hRes.json());
  };
  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => { setEditing({ company: "", policyNumber: "", insuranceType: "終身保険", premiumPayer: "", insuredPerson: "", beneficiaryId: null, amount: 0, isTaxExemptTarget: true, note: "", displayOrder: insurances.length }); setIsNew(true); };
  const openEdit = (i: InsuranceAsset) => { setEditing({ ...i }); setIsNew(false); };

  const handleSave = async () => {
    if (!editing) return;
    await fetch(`/api/datasets/${datasetId}/insurances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? editing : { ...editing, _update: true }),
    });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/insurances?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = insurances.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">生命保険</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>保険会社</TableHead>
              <TableHead>証券番号</TableHead>
              <TableHead>保険種類</TableHead>
              <TableHead>受取人</TableHead>
              <TableHead className="text-right">保険金額</TableHead>
              <TableHead>非課税対象</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insurances.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.company || "-"}</TableCell>
                <TableCell>{i.policyNumber || "-"}</TableCell>
                <TableCell>{i.insuranceType}</TableCell>
                <TableCell>{i.beneficiary?.name || "-"}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(i.amount)}円</TableCell>
                <TableCell>{i.isTaxExemptTarget ? "対象" : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(i.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {insurances.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">生命保険が登録されていません</TableCell></TableRow>}
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
            <DialogHeader><DialogTitle>{isNew ? "生命保険を追加" : "生命保険を編集"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>保険会社</Label><Input value={editing.company || ""} onChange={e => setEditing(prev => ({ ...prev!, company: e.target.value }))} /></div>
                <div><Label>証券番号</Label><Input value={editing.policyNumber || ""} onChange={e => setEditing(prev => ({ ...prev!, policyNumber: e.target.value }))} /></div>
              </div>
              <div>
                <Label>保険種類</Label>
                <Select value={editing.insuranceType} onValueChange={v => setEditing(prev => ({ ...prev!, insuranceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>保険料負担者</Label><Input value={editing.premiumPayer || ""} onChange={e => setEditing(prev => ({ ...prev!, premiumPayer: e.target.value }))} /></div>
                <div><Label>被保険者</Label><Input value={editing.insuredPerson || ""} onChange={e => setEditing(prev => ({ ...prev!, insuredPerson: e.target.value }))} /></div>
              </div>
              <div>
                <Label>受取人</Label>
                <Select value={editing.beneficiaryId || "_none"} onValueChange={v => setEditing(prev => ({ ...prev!, beneficiaryId: v === "_none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">未選択</SelectItem>
                    {heirs.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>保険金額</Label><Input type="number" value={editing.amount} onChange={e => setEditing(prev => ({ ...prev!, amount: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-center gap-2">
                <Checkbox checked={editing.isTaxExemptTarget} onCheckedChange={v => setEditing(prev => ({ ...prev!, isTaxExemptTarget: !!v }))} />
                <Label>非課税計算対象</Label>
              </div>
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
