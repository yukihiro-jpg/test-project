"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";

interface CaseItem {
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
  datasets: { id: string }[];
}

export default function CaseListPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCases = async () => {
    const res = await fetch("/api/cases");
    const data = await res.json();
    setCases(data);
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    fetchCases();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">案件一覧</h1>
        <Link href="/cases/new">
          <Button><Plus className="w-4 h-4 mr-2" />新規作成</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>案件がありません</p>
          <Link href="/cases/new">
            <Button variant="outline" className="mt-4">最初の案件を作成</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>被相続人氏名</TableHead>
                <TableHead>フリガナ</TableHead>
                <TableHead>生年月日</TableHead>
                <TableHead>住所</TableHead>
                <TableHead>データセット数</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-gray-500">{c.nameKana}</TableCell>
                  <TableCell>{c.birthDate || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{c.address || "-"}</TableCell>
                  <TableCell>{c.datasets.length}件</TableCell>
                  <TableCell className="text-gray-500 text-xs">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/cases/${c.id}`}>
                        <Button variant="ghost" size="icon" title="詳細"><Eye className="w-4 h-4" /></Button>
                      </Link>
                      <Link href={`/cases/${c.id}/edit`}>
                        <Button variant="ghost" size="icon" title="編集"><Pencil className="w-4 h-4" /></Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="削除"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>案件を削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              「{c.name}」を削除すると、関連するデータセットもすべて削除されます。この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-red-600 hover:bg-red-700">削除する</AlertDialogAction>
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
