"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface AnnualGift {
  id: string;
  recipientName: string | null;
  giftDate: string | null;
  giftType: string | null;
  subType: string | null;
  giftValue: number;
  paidGiftTax: number;
  isAddBack: boolean;
  note: string | null;
  displayOrder: number;
}

export default function GiftsPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [gifts, setGifts] = useState<AnnualGift[]>([]);
  const [editing, setEditing] = useState<Partial<AnnualGift> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/gifts`);
    setGifts(await res.json());
  };
  useEffect(() => { fetchData(); }, [datasetId]);

  const openNew = () => { setEditing({ recipientName: "", giftDate: "", giftType: "", subType: "", giftValue: 0, paidGiftTax: 0, isAddBack: true, note: "", displayOrder: gifts.length }); setIsNew(true); };
  const openEdit = (g: AnnualGift) => { setEditing({ ...g }); setIsNew(false); };

  const handleSave = async () => {
    if (!editing) return;
    await fetch(`/api/datasets/${datasetId}/gifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? editing : { ...editing, _update: true }),
    });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/gifts?deleteId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const total = gifts.reduce((s, g) => s + g.giftValue, 0);
  const addBackTotal = gifts.filter(g => g.isAddBack).reduce((s, g) => s + g.giftValue, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}/datasets/${datasetId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">生前贈与（暦年課税）</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />追加</Button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>受贈者</TableHead>
              <TableHead>贈与年月日</TableHead>
              <TableHead>種類</TableHead>
              <TableHead>細目</TableHead>
              <TableHead className="text-right">贈与価額</TableHead>
              <TableHead className="text-right">納付済贈与税額</TableHead>
              <TableHead>加算対象</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gifts.map(g => (
              <TableRow key={g.id}>
                <TableCell>{g.recipientName || "-"}</TableCell>
                <TableCell>{g.giftDate || "-"}</TableCell>
                <TableCell>{g.giftType || "-"}</TableCell>
                <TableCell>{g.subType || "-"}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(g.giftValue)}円</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(g.paidGiftTax)}円</TableCell>
                <TableCell>{g.isAddBack ? "対象" : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {gifts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">生前贈与が登録されていません</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
          <span className="text-sm text-gray-500">加算対象合計: <span className="font-bold">{formatCurrency(addBackTotal)}円</span></span>
          <span><span className="text-gray-500 mr-2">贈与価額合計:</span><span className="font-bold text-lg">{formatCurrency(total)}円</span></span>
        </div>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{isNew ? "生前贈与を追加" : "編集"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>受贈者</Label><Input value={editing.recipientName || ""} onChange={e => setEditing(prev => ({ ...prev!, recipientName: e.target.value }))} /></div>
              <div><Label>贈与年月日</Label><Input type="date" value={editing.giftDate || ""} onChange={e => setEditing(prev => ({ ...prev!, giftDate: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>種類</Label><Input value={editing.giftType || ""} onChange={e => setEditing(prev => ({ ...prev!, giftType: e.target.value }))} /></div>
                <div><Label>細目</Label><Input value={editing.subType || ""} onChange={e => setEditing(prev => ({ ...prev!, subType: e.target.value }))} /></div>
              </div>
              <div><Label>贈与価額</Label><Input type="number" value={editing.giftValue} onChange={e => setEditing(prev => ({ ...prev!, giftValue: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>納付済贈与税額</Label><Input type="number" value={editing.paidGiftTax} onChange={e => setEditing(prev => ({ ...prev!, paidGiftTax: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-center gap-2">
                <Checkbox checked={editing.isAddBack} onCheckedChange={v => setEditing(prev => ({ ...prev!, isAddBack: !!v }))} />
                <Label>加算対象</Label>
                <span className="text-xs text-gray-400">（仮仕様: 相続開始前7年以内）</span>
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
