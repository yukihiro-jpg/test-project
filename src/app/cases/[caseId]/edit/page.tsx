"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [caseData, setCaseData] = useState<Record<string, string | null> | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`).then(r => r.json()).then(setCaseData);
  }, [caseId]);

  if (!caseData) return <p className="text-gray-500">読み込み中...</p>;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      code: fd.get("code") as string,
      name: fd.get("name") as string,
      nameKana: fd.get("nameKana") as string,
      birthDate: fd.get("birthDate") as string || null,
      address: fd.get("address") as string || null,
      phone: fd.get("phone") as string || null,
      email: fd.get("email") as string || null,
      note: fd.get("note") as string || null,
    };
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      router.push(`/cases/${caseId}`);
    } else {
      const err = await res.json();
      setError(typeof err.error === "string" ? err.error : "入力内容を確認してください");
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href={`/cases/${caseId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />案件詳細に戻る
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">案件 編集</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="code">コード <span className="text-red-500">*</span></Label>
            <Input id="code" name="code" required defaultValue={caseData.code || ""} />
          </div>
          <div>
            <Label htmlFor="name">被相続人氏名 <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required defaultValue={caseData.name || ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nameKana">フリガナ <span className="text-red-500">*</span></Label>
            <Input id="nameKana" name="nameKana" required defaultValue={caseData.nameKana || ""} />
          </div>
          <div>
            <Label htmlFor="birthDate">生年月日</Label>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={caseData.birthDate || ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="address">住所</Label>
          <Input id="address" name="address" defaultValue={caseData.address || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">電話番号</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={caseData.phone || ""} />
          </div>
          <div>
            <Label htmlFor="email">メール</Label>
            <Input id="email" name="email" type="email" defaultValue={caseData.email || ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="note">備考</Label>
          <Textarea id="note" name="note" rows={3} defaultValue={caseData.note || ""} />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={submitting}>{submitting ? "保存中..." : "保存"}</Button>
          <Link href={`/cases/${caseId}`}><Button type="button" variant="outline">キャンセル</Button></Link>
        </div>
      </form>
    </div>
  );
}
