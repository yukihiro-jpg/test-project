'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { Case, CaseWorkflow, WorkflowPhase } from '@/types';
import { WORKFLOW_PHASE_LABELS } from '@/types';

const PHASES: WorkflowPhase[] = [
  'reception', 'document_request', 'document_collect',
  'evaluation', 'report', 'agreement', 'filing', 'delivery',
];

function getProgressPercent(workflow?: CaseWorkflow): number {
  if (!workflow) return 0;
  const completedCount = PHASES.filter(p => workflow.phases[p]?.status === 'completed').length;
  return Math.round((completedCount / PHASES.length) * 100);
}

function getCurrentPhaseName(workflow?: CaseWorkflow): string {
  if (!workflow) return '未開始';
  return WORKFLOW_PHASE_LABELS[workflow.currentPhase] || '未開始';
}

function isDeliveryCompleted(c: Case): boolean {
  return c.workflow?.phases?.delivery?.status === 'completed';
}

export default function HomePage() {
  const router = useRouter();
  const { cases, initialized, initialize, createCase, selectCase, deleteCase } = useCaseStore();
  const [showCompleted, setShowCompleted] = useState(false);

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

  const activeCases = cases.filter(c => !isDeliveryCompleted(c));
  const completedCases = cases.filter(c => isDeliveryCompleted(c));

  const renderCaseCard = (c: Case) => {
    const percent = getProgressPercent(c.workflow);
    const phaseName = getCurrentPhaseName(c.workflow);

    return (
      <Card
        key={c.id}
        className="cursor-pointer hover:border-blue-300 transition-colors"
        onClick={() => handleSelect(c.id)}
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900">
              {c.decedent.name || '（未入力）'}
            </h3>
            <p className="text-sm text-gray-500">
              基準日: {c.referenceDate} / 相続人: {c.heirs.length}人
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{phaseName}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              更新: {new Date(c.updatedAt).toLocaleString('ja-JP')}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
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
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">相続税業務管理アプリ</h1>
          <p className="text-gray-500">相続税シミュレーション・遺産分割協議書作成・業務フロー管理</p>
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
          <>
            {/* 進行中の案件 */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                進行中の案件
                {activeCases.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({activeCases.length}件)
                  </span>
                )}
              </h2>
              {activeCases.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-400">進行中の案件はありません</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeCases.map(renderCaseCard)}
                </div>
              )}
            </section>

            {/* 完了済み案件 */}
            {completedCases.length > 0 && (
              <section>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3 hover:text-gray-600 transition-colors"
                >
                  {showCompleted ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  完了済み案件
                  <span className="text-sm font-normal text-gray-500">
                    ({completedCases.length}件)
                  </span>
                </button>
                {showCompleted && (
                  <div className="space-y-3">
                    {completedCases.map(renderCaseCard)}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
