"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Copy, Trash2, Eye, Pencil } from "lucide-react";

interface Dataset {
  id: string;
  name: string;
  baseDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CaseDetail {
  id: string;
  code: string;
  name: string;
  nameKana: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  datasets: Dataset[];
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "secondary" }> = {
  draft: { label: "下書き", variant: "secondary" },
  active: { label: "有効", variant: "success" },
  archived: { label: "アーカイブ", variant: "default" },
};

export default function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseDate, setNewBaseDate] = useState("");

  const fetchCase = async () => {
    const res = await fetch(`/api/cases/${caseId}`);
    if (res.ok) setCaseData(await res.json());
  };

  useEffect(() => { fetchCase(); }, [caseId]);

  const handleCreateDataset = async () => {
    if (!newName || !newBaseDate) return;
    const res = await fetch("/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, name: newName, baseDate: newBaseDate }),
    });
    if (res.ok) {
      setShowNewDataset(false);
      setNewName("");
      setNewBaseDate("");
      fetchCase();
    }
  };

  const handleDuplicate = async (dsId: string) => {
    await fetch(`/api/datasets/${dsId}/duplicate`, { method: "POST" });
    fetchCase();
  };

  const handleDeleteDataset = async (dsId: string) => {
    await fetch(`/api/datasets/${dsId}`, { method: "DELETE" });
    fetchCase();
  };

  if (!caseData) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/cases" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />案件一覧に戻る
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{caseData.name}</h1>
          <p className="text-sm text-gray-500 mt-1">コード: {caseData.code} / {caseData.nameKana}</p>
        </div>
        <Link href={`/cases/${caseId}/edit`}>
          <Button variant="outline" size="sm"><Pencil className="w-4 h-4 mr-1" />編集</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">生年月日:</span> <span className="ml-2">{caseData.birthDate || "-"}</span></div>
          <div><span className="text-gray-500">住所:</span> <span className="ml-2">{caseData.address || "-"}</span></div>
          <div><span className="text-gray-500">電話:</span> <span className="ml-2">{caseData.phone || "-"}</span></div>
          <div><span className="text-gray-500">メール:</span> <span className="ml-2">{caseData.email || "-"}</span></div>
        </div>
        {caseData.note && <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{caseData.note}</p>}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">データセット一覧</h2>
        <Dialog open={showNewDataset} onOpenChange={setShowNewDataset}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />新規データセット</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規データセット作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>データセット名 <span className="text-red-500">*</span></Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: 初期試算" />
              </div>
              <div>
                <Label>基準日 <span className="text-red-500">*</span></Label>
                <Input type="date" value={newBaseDate} onChange={e => setNewBaseDate(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNewDataset(false)}>キャンセル</Button>
                <Button onClick={handleCreateDataset}>作成</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {caseData.datasets.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
          データセットがありません。新規作成してください。
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>データセット名</TableHead>
                <TableHead>基準日</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caseData.datasets.map((ds) => (
                <TableRow key={ds.id}>
                  <TableCell className="font-medium">{ds.name}</TableCell>
                  <TableCell>{ds.baseDate}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_LABELS[ds.status]?.variant || "secondary"}>
                      {STATUS_LABELS[ds.status]?.label || ds.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-xs">{new Date(ds.updatedAt).toLocaleDateString("ja-JP")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/cases/${caseId}/datasets/${ds.id}`}>
                        <Button variant="ghost" size="icon" title="詳細"><Eye className="w-4 h-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" title="複製" onClick={() => handleDuplicate(ds.id)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="削除"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>データセットを削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              「{ds.name}」を削除すると、関連する全データが削除されます。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDataset(ds.id)} className="bg-red-600 hover:bg-red-700">削除する</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
