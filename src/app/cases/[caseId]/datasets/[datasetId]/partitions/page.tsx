"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Eye, Copy, Pencil } from "lucide-react";

interface PartitionPlan {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PartitionsPage({ params }: { params: Promise<{ caseId: string; datasetId: string }> }) {
  const { caseId, datasetId } = use(params);
  const [plans, setPlans] = useState<PartitionPlan[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchData = async () => {
    const res = await fetch(`/api/datasets/${datasetId}/partitions`);
    setPlans(await res.json());
  };
  useEffect(() => { fetchData(); }, [datasetId]);

  const handleCreate = async () => {
    if (!newTitle) return;
    await fetch(`/api/datasets/${datasetId}/partitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, description: newDesc || null }),
    });
    setShowNew(false);
    setNewTitle("");
    setNewDesc("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets/${datasetId}/partitions/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleDuplicate = async (plan: PartitionPlan) => {
    await fetch(`/api/datasets/${datasetId}/partitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${plan.title}（コピー）`, description: plan.description }),
    });
    fetchData();
  };

  const basePath = `/cases/${caseId}/datasets/${datasetId}`;

  return (
    <div>
      <div className="mb-6">
        <Link href={`${basePath}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />データセットに戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">分割案一覧</h1>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" />新規作成</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>分割案を作成</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>タイトル <span className="text-red-500">*</span></Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="例: 法定相続分案" /></div>
              <div><Label>説明</Label><Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNew(false)}>キャンセル</Button>
                <Button onClick={handleCreate}>作成</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイトル</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>更新日</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map(plan => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.title}</TableCell>
                <TableCell className="max-w-[300px] truncate text-gray-500">{plan.description || "-"}</TableCell>
                <TableCell className="text-xs text-gray-500">{new Date(plan.updatedAt).toLocaleDateString("ja-JP")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`${basePath}/partitions/${plan.id}`}>
                      <Button variant="ghost" size="icon" title="編集"><Pencil className="w-4 h-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" title="複製" onClick={() => handleDuplicate(plan)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>分割案を削除しますか？</AlertDialogTitle><AlertDialogDescription>「{plan.title}」を削除します。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(plan.id)} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">分割案がありません。新規作成してください。</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
