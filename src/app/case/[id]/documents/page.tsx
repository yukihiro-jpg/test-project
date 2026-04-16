'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DOCUMENT_TEMPLATES,
  DOCUMENT_CATEGORY_LABELS,
  WORKFLOW_PHASES,
  type CaseWorkflow,
  type DocumentRequest,
  type DocumentCategory,
  type PhaseStatus,
  type WorkflowPhase,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { Check, FileText, Plus, Filter, AlertCircle, CheckCircle, Clock, X, ChevronDown, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DocumentStatus = DocumentRequest['status'];

const STATUS_LABELS: Record<DocumentStatus, string> = {
  not_requested: '未依頼',
  requested: '依頼済',
  received: '受領済',
  confirmed: '確認済',
  not_applicable: '該当なし',
};

const STATUS_COLORS: Record<DocumentStatus, string> = {
  not_requested: 'bg-gray-100 text-gray-700',
  requested: 'bg-amber-100 text-amber-700',
  received: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  not_applicable: 'bg-gray-50 text-gray-400 line-through',
};

const FILTER_TABS: { key: DocumentStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全て' },
  { key: 'not_requested', label: '未依頼' },
  { key: 'requested', label: '依頼済' },
  { key: 'received', label: '受領済' },
  { key: 'confirmed', label: '確認済' },
  { key: 'not_applicable', label: '該当なし' },
];

const CATEGORY_ORDER: DocumentCategory[] = [
  'identity',
  'real_estate',
  'financial',
  'insurance',
  'debt',
  'other',
];

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultWorkflow(): CaseWorkflow {
  const phases = {} as Record<WorkflowPhase, PhaseStatus>;
  for (const phase of WORKFLOW_PHASES) {
    phases[phase] = { status: 'not_started' };
  }

  const documents: DocumentRequest[] = DOCUMENT_TEMPLATES.map((tpl) => ({
    ...tpl,
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

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentsPage() {
  const currentCase = useCaseStore((s) => s.getCurrentCase());
  const updateWorkflow = useCaseStore((s) => s.updateWorkflow);

  const [activeFilter, setActiveFilter] = useState<DocumentStatus | 'all'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<DocumentCategory>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('other');
  const [newDocRequired, setNewDocRequired] = useState(false);

  // Ensure workflow exists
  const workflow: CaseWorkflow = useMemo(() => {
    if (currentCase?.workflow) return currentCase.workflow;
    return createDefaultWorkflow();
  }, [currentCase?.workflow]);

  // Initialize workflow if missing
  const ensureWorkflow = useCallback((): CaseWorkflow => {
    if (currentCase?.workflow) return currentCase.workflow;
    const w = createDefaultWorkflow();
    updateWorkflow(w);
    return w;
  }, [currentCase?.workflow, updateWorkflow]);

  // ----- derived data -----
  const documents = workflow.documents;

  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'all') return documents;
    return documents.filter((d) => d.status === activeFilter);
  }, [documents, activeFilter]);

  const groupedDocuments = useMemo(() => {
    const groups: Record<DocumentCategory, DocumentRequest[]> = {
      identity: [],
      real_estate: [],
      financial: [],
      insurance: [],
      debt: [],
      other: [],
    };
    for (const doc of filteredDocuments) {
      groups[doc.category].push(doc);
    }
    return groups;
  }, [filteredDocuments]);

  // Summary statistics (always computed from all documents, not filtered)
  const summary = useMemo(() => {
    const total = documents.length;
    const requested = documents.filter((d) => d.status === 'requested').length;
    const received = documents.filter((d) => d.status === 'received').length;
    const confirmed = documents.filter((d) => d.status === 'confirmed').length;
    const notApplicable = documents.filter((d) => d.status === 'not_applicable').length;
    const actionable = total - notApplicable;
    const progressPercent = actionable > 0 ? Math.round((confirmed / actionable) * 100) : 0;
    return { total, requested, received, confirmed, notApplicable, actionable, progressPercent };
  }, [documents]);

  // Per-category progress (confirmed / (total - not_applicable))
  const categoryProgress = useMemo(() => {
    const result: Record<DocumentCategory, { done: number; total: number }> = {} as never;
    for (const cat of CATEGORY_ORDER) {
      const all = documents.filter((d) => d.category === cat);
      const actionable = all.filter((d) => d.status !== 'not_applicable');
      const done = all.filter((d) => d.status === 'confirmed').length;
      result[cat] = { done, total: actionable.length };
    }
    return result;
  }, [documents]);

  // ----- handlers -----

  const updateDocuments = useCallback(
    (updater: (docs: DocumentRequest[]) => DocumentRequest[]) => {
      const w = ensureWorkflow();
      updateWorkflow({ ...w, documents: updater(w.documents) });
    },
    [ensureWorkflow, updateWorkflow],
  );

  const handleStatusChange = useCallback(
    (docId: string, newStatus: DocumentStatus) => {
      const now = todayISO();
      updateDocuments((docs) =>
        docs.map((d) => {
          if (d.id !== docId) return d;
          const updated: DocumentRequest = { ...d, status: newStatus };
          // Auto-set dates based on status progression
          if (newStatus === 'requested' && !d.requestedAt) {
            updated.requestedAt = now;
          }
          if (newStatus === 'received') {
            if (!updated.requestedAt) updated.requestedAt = now;
            updated.receivedAt = now;
          }
          if (newStatus === 'confirmed') {
            if (!updated.requestedAt) updated.requestedAt = now;
            if (!updated.receivedAt) updated.receivedAt = now;
            updated.confirmedAt = now;
          }
          if (newStatus === 'not_requested') {
            updated.requestedAt = undefined;
            updated.receivedAt = undefined;
            updated.confirmedAt = undefined;
          }
          if (newStatus === 'not_applicable') {
            // keep dates as-is, just mark
          }
          return updated;
        }),
      );
    },
    [updateDocuments],
  );

  const handleNoteChange = useCallback(
    (docId: string, note: string) => {
      updateDocuments((docs) => docs.map((d) => (d.id === docId ? { ...d, note } : d)));
    },
    [updateDocuments],
  );

  const handleReceivedDateChange = useCallback(
    (docId: string, date: string) => {
      updateDocuments((docs) => docs.map((d) => (d.id === docId ? { ...d, receivedAt: date } : d)));
    },
    [updateDocuments],
  );

  const handleBulkRequested = useCallback(() => {
    const now = todayISO();
    updateDocuments((docs) =>
      docs.map((d) => {
        if (d.status === 'not_requested') {
          return { ...d, status: 'requested' as const, requestedAt: now };
        }
        return d;
      }),
    );
  }, [updateDocuments]);

  const handleExport = useCallback(() => {
    const lines: string[] = [];
    lines.push('=== 資料依頼書 ===');
    lines.push(`案件名: ${currentCase?.name || ''}`);
    lines.push(`出力日: ${todayISO()}`);
    lines.push('');

    for (const cat of CATEGORY_ORDER) {
      const catDocs = documents.filter(
        (d) => d.category === cat && d.status !== 'not_applicable' && d.status !== 'confirmed',
      );
      if (catDocs.length === 0) continue;
      lines.push(`■ ${DOCUMENT_CATEGORY_LABELS[cat]}`);
      catDocs.forEach((d, i) => {
        const required = d.required ? ' [必須]' : '';
        const statusLabel = STATUS_LABELS[d.status];
        lines.push(`  ${i + 1}. ${d.name}${required} - ${statusLabel}`);
        if (d.note) lines.push(`     備考: ${d.note}`);
      });
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `資料依頼書_${currentCase?.name || '案件'}_${todayISO()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [documents, currentCase?.name]);

  const handleAddCustomDocument = useCallback(() => {
    if (!newDocName.trim()) return;
    const newDoc: DocumentRequest = {
      id: uuidv4(),
      category: newDocCategory,
      name: newDocName.trim(),
      required: newDocRequired,
      status: 'not_requested',
    };
    updateDocuments((docs) => [...docs, newDoc]);
    setNewDocName('');
    setNewDocCategory('other');
    setNewDocRequired(false);
    setShowAddForm(false);
  }, [newDocName, newDocCategory, newDocRequired, updateDocuments]);

  const toggleCategory = useCallback((cat: DocumentCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleNote = useCallback((docId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  // ----- render -----

  if (!currentCase) {
    return <p className="text-gray-500">案件を選択してください</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">資料依頼チェックリスト</h1>

      {/* ===== Summary Card ===== */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">総資料数</p>
              <p className="text-xl font-semibold text-gray-900">{summary.total}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">依頼済</p>
              <p className="text-xl font-semibold text-amber-600">{summary.requested}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">受領済</p>
              <p className="text-xl font-semibold text-blue-600">{summary.received}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">確認済</p>
              <p className="text-xl font-semibold text-green-600">{summary.confirmed}件</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>進捗</span>
              <span>{summary.progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Action Buttons ===== */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleBulkRequested}>
          <Check size={16} className="mr-2" />
          全て依頼済みにする
        </Button>
        <Button variant="secondary" onClick={handleExport}>
          <FileText size={16} className="mr-2" />
          資料依頼書を出力
        </Button>
        <Button variant="secondary" onClick={() => setShowAddForm((v) => !v)}>
          <Plus size={16} className="mr-2" />
          カスタム資料を追加
        </Button>
      </div>

      {/* ===== Add Custom Document Form ===== */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>カスタム資料を追加</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="資料名"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="追加する資料名"
              />
              <Select
                label="カテゴリ"
                value={newDocCategory}
                onChange={(e) => setNewDocCategory(e.target.value as DocumentCategory)}
                options={CATEGORY_ORDER.map((c) => ({
                  value: c,
                  label: DOCUMENT_CATEGORY_LABELS[c],
                }))}
              />
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    checked={newDocRequired}
                    onChange={(e) => setNewDocRequired(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  必須
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddCustomDocument}>
                追加
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Filter Tabs ===== */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-t-md transition-colors ${
              activeFilter === tab.key
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1 text-xs">
                ({documents.filter((d) => d.status === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Document Table by Category ===== */}
      {CATEGORY_ORDER.map((cat) => {
        const catDocs = groupedDocuments[cat];
        if (catDocs.length === 0) return null;

        const isCollapsed = collapsedCategories.has(cat);
        const progress = categoryProgress[cat];

        return (
          <Card key={cat}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleCategory(cat)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  <CardTitle>{DOCUMENT_CATEGORY_LABELS[cat]}</CardTitle>
                  <span className="text-sm font-normal text-gray-500">
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <div className="w-24 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {catDocs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      isNoteExpanded={expandedNotes.has(doc.id)}
                      onStatusChange={handleStatusChange}
                      onNoteChange={handleNoteChange}
                      onReceivedDateChange={handleReceivedDateChange}
                      onToggleNote={toggleNote}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentRow sub-component
// ---------------------------------------------------------------------------

interface DocumentRowProps {
  doc: DocumentRequest;
  isNoteExpanded: boolean;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onNoteChange: (id: string, note: string) => void;
  onReceivedDateChange: (id: string, date: string) => void;
  onToggleNote: (id: string) => void;
}

function DocumentRow({
  doc,
  isNoteExpanded,
  onStatusChange,
  onNoteChange,
  onReceivedDateChange,
  onToggleNote,
}: DocumentRowProps) {
  return (
    <div className="px-6 py-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Name + required badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${doc.status === 'not_applicable' ? 'line-through text-gray-400' : 'text-gray-900'}`}
            >
              {doc.name}
            </span>
            {doc.required && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                必須
              </span>
            )}
          </div>
          {doc.description && (
            <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
          )}
        </div>

        {/* Status dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={doc.status}
            onChange={(e) => onStatusChange(doc.id, e.target.value as DocumentStatus)}
            className={`text-xs rounded-md border border-gray-300 px-2 py-1 ${STATUS_COLORS[doc.status]}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Quick status buttons */}
          <div className="flex gap-1">
            <button
              title="依頼済"
              onClick={() => onStatusChange(doc.id, 'requested')}
              className={`p-1 rounded transition-colors ${doc.status === 'requested' ? 'bg-amber-200' : 'hover:bg-gray-100'}`}
            >
              <Clock size={14} className="text-amber-600" />
            </button>
            <button
              title="受領済"
              onClick={() => onStatusChange(doc.id, 'received')}
              className={`p-1 rounded transition-colors ${doc.status === 'received' ? 'bg-blue-200' : 'hover:bg-gray-100'}`}
            >
              <FileText size={14} className="text-blue-600" />
            </button>
            <button
              title="確認済"
              onClick={() => onStatusChange(doc.id, 'confirmed')}
              className={`p-1 rounded transition-colors ${doc.status === 'confirmed' ? 'bg-green-200' : 'hover:bg-gray-100'}`}
            >
              <CheckCircle size={14} className="text-green-600" />
            </button>
            <button
              title="該当なし"
              onClick={() => onStatusChange(doc.id, 'not_applicable')}
              className={`p-1 rounded transition-colors ${doc.status === 'not_applicable' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Received date */}
          {(doc.status === 'received' || doc.status === 'confirmed') && (
            <input
              type="date"
              value={doc.receivedAt || ''}
              onChange={(e) => onReceivedDateChange(doc.id, e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            />
          )}

          {/* Note toggle */}
          <button
            onClick={() => onToggleNote(doc.id)}
            title="備考"
            className={`p-1 rounded transition-colors ${isNoteExpanded || doc.note ? 'bg-yellow-100' : 'hover:bg-gray-100'}`}
          >
            <AlertCircle size={14} className={doc.note ? 'text-yellow-600' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* Expandable note */}
      {isNoteExpanded && (
        <div className="mt-2">
          <textarea
            value={doc.note || ''}
            onChange={(e) => onNoteChange(doc.id, e.target.value)}
            placeholder="備考を入力..."
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
