"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface LiabilityExpense {
  id: string;
  liabilityType: string;
  subType: string | null;
  creditorName: string | null;
  creditorAddress: string | null;
  amount: number;
  note: string | null;
  displayOrder: number;
}

const LIABILITY_TYPES = ["債務", "葬式費用"];

export default function LiabilitiesPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [items, setItems] = useState<LiabilityExpense[]>([]);
  const [editing, setEditing] = useState<Partial<LiabilityExpense> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/liabilities`);
    setItems(await res.json());
  };
  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => { setEditing({ liabilityType: "債務", subType: "", creditorName: "", creditorAddress: "", amount: 0, note: "", displayOrder: items.length }); setIsNew(true); };
  const openEdit = (item: LiabilityExpense) => { setEditing({ ...item }); setIsNew(false); };

  const handleSave = async () => {
    if (!editing) return;
    await fetch(`/api/datasets/${datasetId}/liabilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? editing : { ...editing, _update: true }),
    });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/liabilities?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">債務・葬式費用</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>種類</TableHead>
              <TableHead>細目</TableHead>
              <TableHead>債権者名</TableHead>
              <TableHead>債権者住所等</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.liabilityType}</TableCell>
                <TableCell>{item.subType || "-"}</TableCell>
                <TableCell>{item.creditorName || "-"}</TableCell>
                <TableCell className="max-w-[150px] truncate">{item.creditorAddress || "-"}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(item.amount)}円</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">債務・葬式費用が登録されていません</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t bg-gray-50 text-right">
          <span className="text-gray-500 mr-2">合計:</span>
          <span className="font-bold text-lg text-red-600">{formatCurrency(total)}円</span>
        </div>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{isNew ? "債務・葬式費用を追加" : "編集"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>種類</Label>
                <Select value={editing.liabilityType} onValueChange={v => setEditing(prev => ({ ...prev!, liabilityType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIABILITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>細目</Label><Input value={editing.subType || ""} onChange={e => setEditing(prev => ({ ...prev!, subType: e.target.value }))} /></div>
              <div><Label>債権者名</Label><Input value={editing.creditorName || ""} onChange={e => setEditing(prev => ({ ...prev!, creditorName: e.target.value }))} /></div>
              <div><Label>債権者住所等</Label><Input value={editing.creditorAddress || ""} onChange={e => setEditing(prev => ({ ...prev!, creditorAddress: e.target.value }))} /></div>
              <div><Label>金額</Label><Input type="number" value={editing.amount} onChange={e => setEditing(prev => ({ ...prev!, amount: parseInt(e.target.value) || 0 }))} /></div>
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
