'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { cases, initialized, initialize, createCase, selectCase, deleteCase } = useCaseStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  const handleCreate = () => {
    const id = createCase();
    router.push(`/case/${id}/decedent`);
  };

  const handleSelect = (id: string) => {
    selectCase(id);
    router.push(`/case/${id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('この案件を削除しますか？')) {
      deleteCase(id);
    }
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">相続税シミュレーター</h1>
          <p className="text-gray-500">相続税シミュレーション・遺産分割協議書作成</p>
        </div>

        <div className="mb-6 flex justify-end">
          <Button onClick={handleCreate} size="lg">
            <Plus size={20} className="mr-2" />
            新規案件作成
          </Button>
        </div>

        {cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">案件がありません</p>
              <Button onClick={handleCreate}>
                <Plus size={18} className="mr-2" />
                最初の案件を作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {cases.map(c => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => handleSelect(c.id)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {c.decedent.name || '（未入力）'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      基準日: {c.referenceDate} / 相続人: {c.heirs.length}人
                    </p>
                    <p className="text-xs text-gray-400">
                      更新: {new Date(c.updatedAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => handleDelete(e, c.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
