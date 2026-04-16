'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  WORKFLOW_PHASES,
  WORKFLOW_PHASE_LABELS,
  DOCUMENT_TEMPLATES,
  type CaseWorkflow,
  type WorkflowPhase,
  type PhaseStatus,
  type DocumentRequest,
  type ScheduleItem,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  Check,
  Circle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ClipboardList,
} from 'lucide-react';

// ============================================================
// フェーズ情報定義
// ============================================================

interface PhaseInfo {
  description: string;
  checklist: string[];
  links: { label: string; href: string }[];
}

const PHASE_INFO: Record<WorkflowPhase, PhaseInfo> = {
  reception: {
    description: 'お客様との初回面談。案件の概要把握、報酬の見積り、契約締結。',
    checklist: [
      '初回面談の実施',
      '案件概要のヒアリング',
      '報酬の見積り・提示',
      '契約書の締結',
      '被相続人情報の登録',
      '相続人情報の登録',
    ],
    links: [
      { label: '被相続人情報', href: 'decedent' },
      { label: '相続人情報', href: 'heirs' },
    ],
  },
  document_request: {
    description: '必要書類をお客様に依頼。チェックリストを活用。',
    checklist: [
      '必要書類リストの作成',
      'お客様への資料依頼',
      '依頼書の送付',
      '依頼状況の記録',
    ],
    links: [{ label: '資料チェックリスト', href: 'workflow/documents' }],
  },
  document_collect: {
    description: '依頼した資料の到着確認。不足資料の再依頼。',
    checklist: [
      '届いた資料の確認・チェック',
      '不足資料の特定',
      '不足資料の再依頼',
      '全資料の受領確認',
    ],
    links: [{ label: '資料チェックリスト', href: 'workflow/documents' }],
  },
  evaluation: {
    description: '財産の評価、税額計算、申告書の作成。',
    checklist: [
      '不動産の評価',
      '金融資産の評価',
      '非上場株式の評価',
      'その他財産の評価',
      '債務・葬式費用の確認',
      '相続税額の計算',
      '申告書の作成',
    ],
    links: [
      { label: '財産情報', href: 'assets' },
      { label: 'シミュレーション', href: 'simulation' },
    ],
  },
  report: {
    description: 'お客様への報告。分割案の提示と協議。',
    checklist: [
      '報告資料の作成',
      'お客様への報告会実施',
      '分割案の提示',
      '分割方針の合意',
    ],
    links: [
      { label: 'シミュレーション', href: 'simulation' },
      { label: '書類出力', href: 'export' },
    ],
  },
  agreement: {
    description: '合意内容に基づき分割協議書を作成。',
    checklist: [
      '遺産分割協議書の草案作成',
      'お客様への内容確認',
      '修正・最終化',
      '全相続人の署名・捺印',
    ],
    links: [
      { label: '遺産分割', href: 'division' },
      { label: '書類出力', href: 'export' },
    ],
  },
  filing: {
    description: '電子申告システムでの申告。納税手続きの案内。',
    checklist: [
      '電子申告データの作成',
      '申告内容の最終確認',
      '電子申告の送信',
      '納税手続きの案内',
      '納付書の作成・送付',
    ],
    links: [],
  },
  delivery: {
    description: '申告書控え・資料の返却・完了報告。',
    checklist: [
      '申告書控えの製本',
      'お客様への完了報告',
      '預かり資料の返却',
      '案件ファイルの整理・保管',
    ],
    links: [],
  },
};

// ============================================================
// デフォルトワークフロー生成
// ============================================================

function createDefaultWorkflow(): CaseWorkflow {
  const phases: Record<WorkflowPhase, PhaseStatus> = {} as Record<WorkflowPhase, PhaseStatus>;
  for (const phase of WORKFLOW_PHASES) {
    phases[phase] = { status: 'not_started' };
  }
  phases.reception = { status: 'in_progress', startedAt: new Date().toISOString() };

  const documents: DocumentRequest[] = DOCUMENT_TEMPLATES.map((t) => ({
    ...t,
    id: uuidv4(),
    status: 'not_requested' as const,
  }));

  return {
    currentPhase: 'reception',
    phases,
    documents,
    schedule: [],
    notes: [],
  };
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function WorkflowPage() {
  const params = useParams();
  const caseId = params.id as string;
  const currentCase = useCaseStore((s) => s.getCurrentCase());
  const updateWorkflow = useCaseStore((s) => s.updateWorkflow);

  const [expandedPhase, setExpandedPhase] = useState<WorkflowPhase | null>(null);
  const [memo, setMemo] = useState('');

  // ワークフロー初期化
  const workflow: CaseWorkflow = currentCase?.workflow ?? createDefaultWorkflow();

  // 初回アクセス時にワークフローがない場合は保存
  useEffect(() => {
    if (currentCase && !currentCase.workflow) {
      updateWorkflow(createDefaultWorkflow());
    }
  }, [currentCase, updateWorkflow]);

  // メモを同期
  useEffect(() => {
    if (workflow) {
      setMemo(workflow.phases[workflow.currentPhase]?.memo ?? '');
    }
  }, [workflow?.currentPhase]);

  const currentPhaseIndex = WORKFLOW_PHASES.indexOf(workflow.currentPhase);

  // ============================================================
  // フェーズ操作
  // ============================================================

  const handleNextPhase = useCallback(() => {
    if (currentPhaseIndex >= WORKFLOW_PHASES.length - 1) return;
    const now = new Date().toISOString();
    const updatedPhases = { ...workflow.phases };

    // 現在のフェーズを完了
    updatedPhases[workflow.currentPhase] = {
      ...updatedPhases[workflow.currentPhase],
      status: 'completed',
      completedAt: now,
      memo,
    };

    // 次のフェーズを開始
    const nextPhase = WORKFLOW_PHASES[currentPhaseIndex + 1];
    updatedPhases[nextPhase] = {
      ...updatedPhases[nextPhase],
      status: 'in_progress',
      startedAt: now,
    };

    updateWorkflow({
      ...workflow,
      currentPhase: nextPhase,
      phases: updatedPhases,
    });
  }, [workflow, currentPhaseIndex, memo, updateWorkflow]);

  const handlePrevPhase = useCallback(() => {
    if (currentPhaseIndex <= 0) return;
    const updatedPhases = { ...workflow.phases };

    // 現在のフェーズを未着手に戻す
    updatedPhases[workflow.currentPhase] = {
      ...updatedPhases[workflow.currentPhase],
      status: 'not_started',
      startedAt: undefined,
      memo,
    };

    // 前のフェーズを進行中に戻す
    const prevPhase = WORKFLOW_PHASES[currentPhaseIndex - 1];
    updatedPhases[prevPhase] = {
      ...updatedPhases[prevPhase],
      status: 'in_progress',
      completedAt: undefined,
    };

    updateWorkflow({
      ...workflow,
      currentPhase: prevPhase,
      phases: updatedPhases,
    });
  }, [workflow, currentPhaseIndex, memo, updateWorkflow]);

  const handleMemoSave = useCallback(() => {
    const updatedPhases = { ...workflow.phases };
    updatedPhases[workflow.currentPhase] = {
      ...updatedPhases[workflow.currentPhase],
      memo,
    };
    updateWorkflow({
      ...workflow,
      phases: updatedPhases,
    });
  }, [workflow, memo, updateWorkflow]);

  const togglePhaseDetail = useCallback(
    (phase: WorkflowPhase) => {
      setExpandedPhase((prev) => (prev === phase ? null : phase));
    },
    []
  );

  // ============================================================
  // 集計データ
  // ============================================================

  const documentsReceived = workflow.documents.filter(
    (d) => d.status === 'received' || d.status === 'confirmed'
  ).length;
  const documentsTotal = workflow.documents.filter(
    (d) => d.status !== 'not_applicable'
  ).length;
  const documentProgress =
    documentsTotal > 0 ? Math.round((documentsReceived / documentsTotal) * 100) : 0;

  const pendingTasks = workflow.schedule.filter((s) => !s.completed);
  const deadlineTasks = pendingTasks
    .filter((s) => s.category === 'deadline' || s.category === 'task')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nearestDeadline = deadlineTasks[0];

  const upcomingSchedule = [...workflow.schedule]
    .filter((s) => !s.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  const currentPhaseStatus = workflow.phases[workflow.currentPhase];

  // ============================================================
  // レンダリング
  // ============================================================

  if (!currentCase) {
    return <p className="text-gray-500">案件が見つかりません</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">業務フロー管理</h1>

      {/* ============================================================ */}
      {/* フェーズステッパー */}
      {/* ============================================================ */}
      <Card>
        <CardContent className="py-6">
          <div className="overflow-x-auto">
            <div className="flex items-start min-w-[700px]">
              {WORKFLOW_PHASES.map((phase, index) => {
                const status = workflow.phases[phase];
                const isCurrent = phase === workflow.currentPhase;
                const isCompleted = status.status === 'completed';
                const isNotStarted = status.status === 'not_started';

                return (
                  <React.Fragment key={phase}>
                    {/* コネクティングライン */}
                    {index > 0 && (
                      <div className="flex items-center flex-shrink-0 mt-4">
                        <div
                          className={`h-0.5 w-6 sm:w-10 ${
                            isCompleted || isCurrent ? 'bg-blue-400' : 'bg-gray-300'
                          }`}
                        />
                      </div>
                    )}

                    {/* フェーズ丸 */}
                    <button
                      type="button"
                      onClick={() => togglePhaseDetail(phase)}
                      className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
                      title={WORKFLOW_PHASE_LABELS[phase]}
                    >
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                          ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                                ? 'bg-blue-500 text-white ring-4 ring-blue-200 animate-pulse'
                                : 'bg-gray-300 text-gray-500'
                          }
                          group-hover:scale-110
                        `}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs text-center leading-tight max-w-[72px] ${
                          isCurrent
                            ? 'text-blue-700 font-bold'
                            : isCompleted
                              ? 'text-green-700 font-medium'
                              : 'text-gray-500'
                        }`}
                      >
                        {WORKFLOW_PHASE_LABELS[phase]}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* 現在のフェーズカード */}
      {/* ============================================================ */}
      <Card className="border-blue-200 border-2">
        <CardHeader className="bg-blue-50 border-b border-blue-200">
          <CardTitle className="flex items-center gap-2">
            <Circle className="w-5 h-5 text-blue-500 fill-blue-500" />
            現在のフェーズ: {WORKFLOW_PHASE_LABELS[workflow.currentPhase]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm text-gray-600">
            {PHASE_INFO[workflow.currentPhase].description}
          </p>

          {/* 日付情報 */}
          <div className="flex flex-wrap gap-4 text-sm">
            {currentPhaseStatus.startedAt && (
              <div className="flex items-center gap-1 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  開始日:{' '}
                  {new Date(currentPhaseStatus.startedAt).toLocaleDateString('ja-JP')}
                </span>
              </div>
            )}
            {currentPhaseStatus.completedAt && (
              <div className="flex items-center gap-1 text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                <span>
                  完了日:{' '}
                  {new Date(currentPhaseStatus.completedAt).toLocaleDateString('ja-JP')}
                </span>
              </div>
            )}
          </div>

          {/* メモ */}
          <div className="space-y-2">
            <label htmlFor="phase-memo" className="block text-sm font-medium text-gray-700">
              フェーズメモ
            </label>
            <textarea
              id="phase-memo"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="このフェーズに関するメモを入力..."
            />
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={handleMemoSave}>
                メモを保存
              </Button>
            </div>
          </div>

          {/* フェーズ移動ボタン */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={handlePrevPhase}
              disabled={currentPhaseIndex <= 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              前のフェーズに戻る
            </Button>
            <Button
              variant="primary"
              onClick={handleNextPhase}
              disabled={currentPhaseIndex >= WORKFLOW_PHASES.length - 1}
            >
              次のフェーズへ進む
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* クイックステータスサマリー */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 資料収集状況 */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">資料収集状況</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {documentsReceived}/{documentsTotal}件 受領済
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${documentProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{documentProgress}% 完了</p>
          </CardContent>
        </Card>

        {/* 期限タスク */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">期限タスク</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {deadlineTasks.length}件 残り
            </p>
            {nearestDeadline ? (
              <p className="text-xs text-orange-600 mt-1">
                最近の期限: {nearestDeadline.title}（
                {new Date(nearestDeadline.dueDate).toLocaleDateString('ja-JP')}）
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">期限タスクなし</p>
            )}
          </CardContent>
        </Card>

        {/* 直近のスケジュール */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">直近のスケジュール</span>
            </div>
            {upcomingSchedule.length > 0 ? (
              <ul className="space-y-1">
                {upcomingSchedule.map((item) => (
                  <li key={item.id} className="text-xs text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400 flex-shrink-0">
                      {new Date(item.dueDate).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">予定なし</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* フェーズ詳細（アコーディオン） */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            フェーズ一覧・詳細
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          {WORKFLOW_PHASES.map((phase, index) => {
            const status = workflow.phases[phase];
            const info = PHASE_INFO[phase];
            const isExpanded = expandedPhase === phase;
            const isCurrent = phase === workflow.currentPhase;
            const isCompleted = status.status === 'completed';

            return (
              <div key={phase} className="py-2">
                <button
                  type="button"
                  onClick={() => togglePhaseDetail(phase)}
                  className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-md px-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-300 text-gray-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
                    </div>
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          isCurrent
                            ? 'text-blue-700'
                            : isCompleted
                              ? 'text-green-700'
                              : 'text-gray-700'
                        }`}
                      >
                        {WORKFLOW_PHASE_LABELS[phase]}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          進行中
                        </span>
                      )}
                      {isCompleted && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          完了
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-11 mt-2 mb-3 space-y-3">
                    {/* 説明 */}
                    <p className="text-sm text-gray-600">{info.description}</p>

                    {/* 日付 */}
                    {(status.startedAt || status.completedAt) && (
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        {status.startedAt && (
                          <span>
                            開始: {new Date(status.startedAt).toLocaleDateString('ja-JP')}
                          </span>
                        )}
                        {status.completedAt && (
                          <span>
                            完了: {new Date(status.completedAt).toLocaleDateString('ja-JP')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* メモ */}
                    {status.memo && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-800">
                        {status.memo}
                      </div>
                    )}

                    {/* チェックリスト */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">主な作業項目</p>
                      <ul className="space-y-1">
                        {info.checklist.map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                                isCompleted
                                  ? 'bg-green-100 border-green-400'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isCompleted && (
                                <Check className="w-2.5 h-2.5 text-green-600" />
                              )}
                            </div>
                            <span className={isCompleted ? 'line-through text-gray-400' : ''}>
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 関連ページリンク */}
                    {info.links.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">関連ページ</p>
                        <div className="flex flex-wrap gap-2">
                          {info.links.map((link) => (
                            <Link
                              key={link.href}
                              href={`/case/${caseId}/${link.href}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
