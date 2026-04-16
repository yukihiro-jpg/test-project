'use client';

import React, { useState, useMemo } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  CaseWorkflow,
  ScheduleItem,
  PhaseStatus,
  WorkflowPhase,
} from '@/types';
import { WORKFLOW_PHASES, DOCUMENT_TEMPLATES } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Flag,
  Users,
  CheckSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { toWareki } from '@/lib/dates/wareki';

// --- 自動期限生成 ---

function generateAutoDeadlines(deathDate: string): ScheduleItem[] {
  const death = new Date(deathDate);
  const items: ScheduleItem[] = [];

  // 3ヶ月: 相続放棄・限定承認
  const d3 = new Date(death);
  d3.setMonth(d3.getMonth() + 3);
  items.push({
    id: 'auto-3month',
    title: '相続放棄・限定承認の期限',
    dueDate: d3.toISOString().split('T')[0],
    description: '家庭裁判所への申述期限',
    completed: false,
    category: 'deadline',
  });

  // 4ヶ月: 準確定申告
  const d4 = new Date(death);
  d4.setMonth(d4.getMonth() + 4);
  items.push({
    id: 'auto-4month',
    title: '準確定申告の期限',
    dueDate: d4.toISOString().split('T')[0],
    description: '被相続人の所得税の確定申告',
    completed: false,
    category: 'deadline',
  });

  // 10ヶ月: 相続税申告・納付
  const d10 = new Date(death);
  d10.setMonth(d10.getMonth() + 10);
  items.push({
    id: 'auto-10month',
    title: '相続税申告・納付期限',
    dueDate: d10.toISOString().split('T')[0],
    description: '相続税の申告書提出および納付',
    completed: false,
    category: 'deadline',
  });

  return items;
}

// --- カテゴリ設定 ---

const CATEGORY_OPTIONS: { value: ScheduleItem['category']; label: string }[] = [
  { value: 'deadline', label: '法定期限' },
  { value: 'meeting', label: '面談・打合せ' },
  { value: 'task', label: 'タスク' },
  { value: 'milestone', label: 'マイルストーン' },
];

function getCategoryIcon(category: ScheduleItem['category']) {
  switch (category) {
    case 'deadline':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'meeting':
      return <Users className="h-4 w-4 text-blue-500" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-gray-500" />;
    case 'milestone':
      return <Flag className="h-4 w-4 text-purple-500" />;
  }
}

function getCategoryLabel(category: ScheduleItem['category']): string {
  return CATEGORY_OPTIONS.find(o => o.value === category)?.label ?? category;
}

// --- 残日数の計算 ---

function calcRemainingDays(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function remainingLabel(days: number): string {
  if (days > 0) return `あと${days}日`;
  if (days === 0) return '本日期限';
  return `${Math.abs(days)}日超過`;
}

// --- ボーダー色の判定 ---

function getBorderColor(item: ScheduleItem, remainingDays: number): string {
  if (item.completed) return 'border-green-500';
  if (remainingDays < 0) return 'border-red-500';
  if (remainingDays <= 14) return 'border-amber-500';
  return 'border-gray-300';
}

function getBadgeClasses(item: ScheduleItem, remainingDays: number): string {
  if (item.completed) return 'bg-green-100 text-green-800';
  if (remainingDays < 0) return 'bg-red-100 text-red-800';
  if (remainingDays <= 14) return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

// --- 空ワークフロー生成 ---

function createEmptyWorkflow(): CaseWorkflow {
  const phases = {} as Record<WorkflowPhase, PhaseStatus>;
  for (const phase of WORKFLOW_PHASES) {
    phases[phase] = { status: 'not_started' };
  }
  return {
    currentPhase: 'reception',
    phases,
    documents: [],
    schedule: [],
    notes: [],
  };
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function SchedulePage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateWorkflow = useCaseStore(s => s.updateWorkflow);

  // 新規スケジュール項目のフォーム
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCategory, setNewCategory] = useState<ScheduleItem['category']>('task');
  const [newDescription, setNewDescription] = useState('');

  if (!currentCase) {
    return <p className="text-gray-500">案件を選択してください</p>;
  }

  // ワークフロー初期化
  const workflow: CaseWorkflow = currentCase.workflow ?? createEmptyWorkflow();

  // 自動期限の生成
  const deathDate = currentCase.decedent.deathDate;
  const autoDeadlines = useMemo(() => {
    if (!deathDate) return [];
    return generateAutoDeadlines(deathDate);
  }, [deathDate]);

  // 全スケジュール項目をマージ（自動期限 + 手動追加分）
  // 自動期限は手動側に同じIDが存在すればそちらを優先（完了状態を保持するため）
  const allItems = useMemo(() => {
    const manualItems = workflow.schedule;
    const manualIds = new Set(manualItems.map(i => i.id));

    const merged: ScheduleItem[] = [];

    // 自動期限を追加（手動側に同IDがあればそちらを優先）
    for (const auto of autoDeadlines) {
      const manual = manualItems.find(m => m.id === auto.id);
      merged.push(manual ?? auto);
    }

    // 手動追加分（自動期限以外）
    for (const m of manualItems) {
      if (!autoDeadlines.some(a => a.id === m.id)) {
        merged.push(m);
      }
    }

    // 日付順ソート
    merged.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return merged;
  }, [autoDeadlines, workflow.schedule]);

  // 今日の日付文字列
  const todayStr = new Date().toISOString().split('T')[0];

  // --- ハンドラ ---

  function handleAdd() {
    if (!newTitle || !newDueDate) return;
    const item: ScheduleItem = {
      id: uuidv4(),
      title: newTitle,
      dueDate: newDueDate,
      description: newDescription || undefined,
      completed: false,
      category: newCategory,
    };
    const updatedSchedule = [...workflow.schedule, item];
    updateWorkflow({ ...workflow, schedule: updatedSchedule });
    setNewTitle('');
    setNewDueDate('');
    setNewCategory('task');
    setNewDescription('');
  }

  function handleToggleComplete(itemId: string) {
    // 自動期限でまだworkflow.scheduleに存在しない場合は追加
    let scheduleItems = [...workflow.schedule];
    const existingIdx = scheduleItems.findIndex(i => i.id === itemId);
    if (existingIdx >= 0) {
      const existing = scheduleItems[existingIdx];
      scheduleItems[existingIdx] = {
        ...existing,
        completed: !existing.completed,
        completedAt: !existing.completed ? new Date().toISOString() : undefined,
      };
    } else {
      // 自動期限アイテムをworkflow.scheduleに追加
      const autoItem = autoDeadlines.find(a => a.id === itemId);
      if (autoItem) {
        scheduleItems.push({
          ...autoItem,
          completed: true,
          completedAt: new Date().toISOString(),
        });
      }
    }
    updateWorkflow({ ...workflow, schedule: scheduleItems });
  }

  function handleDelete(itemId: string) {
    const updatedSchedule = workflow.schedule.filter(i => i.id !== itemId);
    updateWorkflow({ ...workflow, schedule: updatedSchedule });
  }

  // 今日マーカーの挿入位置を計算
  const todayIndex = allItems.findIndex(item => item.dueDate >= todayStr);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        <Calendar className="inline-block h-6 w-6 mr-2 align-text-bottom" />
        スケジュール管理
      </h1>

      {/* 被相続人の死亡日情報 */}
      {deathDate ? (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-gray-600">
              <Clock className="inline-block h-4 w-4 mr-1 align-text-bottom" />
              被相続人死亡日: <span className="font-semibold">{toWareki(deathDate)}</span>
              <span className="ml-2 text-gray-400">({deathDate})</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-amber-600">
              <AlertTriangle className="inline-block h-4 w-4 mr-1 align-text-bottom" />
              死亡日が未設定のため、法定期限が自動計算されません。被相続人情報ページで死亡日を設定してください。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 新規スケジュール追加 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Plus className="inline-block h-5 w-5 mr-1 align-text-bottom" />
            スケジュール追加
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="タイトル"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="例: 初回面談"
            />
            <Input
              label="期日"
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="カテゴリ"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as ScheduleItem['category'])}
              options={CATEGORY_OPTIONS}
            />
            <Input
              label="説明（任意）"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="補足説明"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleAdd}
              disabled={!newTitle || !newDueDate}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* タイムライン */}
      <Card>
        <CardHeader>
          <CardTitle>タイムライン</CardTitle>
        </CardHeader>
        <CardContent>
          {allItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              スケジュール項目がありません
            </p>
          ) : (
            <div className="space-y-0">
              {allItems.map((item, index) => {
                const days = calcRemainingDays(item.dueDate);
                const borderColor = getBorderColor(item, days);
                const badgeClasses = getBadgeClasses(item, days);
                const isAutoItem = autoDeadlines.some(a => a.id === item.id);

                // 今日マーカー: 過去→未来の境界に挿入
                const showTodayMarker =
                  todayIndex === index &&
                  (index === 0 || allItems[index - 1].dueDate < todayStr);

                return (
                  <React.Fragment key={item.id}>
                    {showTodayMarker && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-blue-400" />
                        <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                          本日 ({todayStr})
                        </span>
                        <div className="h-px flex-1 bg-blue-400" />
                      </div>
                    )}

                    <div
                      className={`border-l-4 ${borderColor} pl-4 py-3 ${
                        index < allItems.length - 1 ? 'border-b border-b-gray-100' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* 左側: チェック + アイコン + 内容 */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={item.completed}
                              onChange={() => handleToggleComplete(item.id)}
                            />
                          </div>
                          <div className="pt-0.5">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${
                                item.completed ? 'line-through text-gray-400' : 'text-gray-900'
                              }`}
                            >
                              {item.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {toWareki(item.dueDate)}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${badgeClasses}`}>
                                {item.completed ? '完了' : remainingLabel(days)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {getCategoryLabel(item.category)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>

                        {/* 右側: 削除ボタン（自動生成項目には表示しない） */}
                        {!isAutoItem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* 全項目が過去の場合、最後に今日マーカーを表示 */}
              {todayIndex === -1 && allItems.length > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-px flex-1 bg-blue-400" />
                  <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                    本日 ({todayStr})
                  </span>
                  <div className="h-px flex-1 bg-blue-400" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
