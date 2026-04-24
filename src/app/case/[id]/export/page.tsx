'use client';

import { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { exportPropertyList, exportSimulationResult } from '@/lib/export/spreadsheet';
import { exportDivisionAgreement } from '@/lib/export/word-agreement';
import { isAuthenticated, uploadDocumentToDrive } from '@/lib/google/drive';
import { FileSpreadsheet, FileText, FileType, Download, Upload, Check, AlertCircle } from 'lucide-react';

type UploadStatus = Record<string, 'idle' | 'uploading' | 'done' | 'error'>;

interface ExportItem {
  id: string;
  title: string;
  description: string;
  excelAction?: () => Promise<void>;
  pdfAction?: () => Promise<void>;
  wordAction?: () => Promise<void>;
  uploadAction?: () => Promise<void>;
  note?: string;
}

export default function ExportPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const [loading, setLoading] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({});

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const name = currentCase.decedent.name || '未入力';

  const exportItems: ExportItem[] = [
    {
      id: 'property-list',
      title: '財産目録',
      description: '全財産を一覧にしたスプレッドシート',
      excelAction: async () => {
        exportPropertyList(currentCase);
      },
      pdfAction: async () => {
        const { exportPropertyListPdf } = await import('@/lib/export/pdf-property-list');
        await exportPropertyListPdf(currentCase);
      },
      uploadAction: async () => {
        const { generatePropertyListWorkbook } = await import('@/lib/export/spreadsheet-blob');
        const buf = generatePropertyListWorkbook(currentCase);
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await uploadDocumentToDrive(blob, `財産目録_${name}.xlsx`, blob.type);
      },
    },
    {
      id: 'simulation',
      title: 'シミュレーション結果',
      description: '相続税計算の詳細結果',
      excelAction: async () => {
        const result = calculateInheritanceTax(currentCase);
        exportSimulationResult(currentCase, result);
      },
      pdfAction: async () => {
        const { exportSimulationPdf } = await import('@/lib/export/pdf-report');
        const result = calculateInheritanceTax(currentCase);
        await exportSimulationPdf(currentCase, result);
      },
      uploadAction: async () => {
        const { generateSimulationWorkbook } = await import('@/lib/export/spreadsheet-blob');
        const result = calculateInheritanceTax(currentCase);
        const buf = generateSimulationWorkbook(currentCase, result);
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await uploadDocumentToDrive(blob, `相続税シミュレーション_${name}.xlsx`, blob.type);
      },
    },
    {
      id: 'division-report',
      title: '財産分割案＆相続税概算',
      description: '財産診断書形式の詳細（全財産＋相続税計算＋各相続人配分）',
      excelAction: async () => {
        const { exportDivisionReport } = await import('@/lib/export/division-report');
        const result = calculateInheritanceTax(currentCase);
        exportDivisionReport(currentCase, result);
      },
      // PDF not yet implemented
      pdfAction: undefined,
      uploadAction: undefined,
    },
    {
      id: 'division-word',
      title: '遺産分割協議書',
      description: '遺産分割の内容に基づいて自動作成された文書',
      wordAction: async () => {
        await exportDivisionAgreement(currentCase);
      },
      uploadAction: async () => {
        const { generateDivisionAgreementBlob } = await import('@/lib/export/word-agreement');
        const blob = await generateDivisionAgreementBlob(currentCase);
        await uploadDocumentToDrive(
          blob,
          `遺産分割協議書_${name}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          true
        );
      },
    },
    {
      id: 'tax-saving',
      title: '節税シミュレーション結果',
      description: '節税対策の効果一覧',
      excelAction: async () => {
        const XLSX = await import('xlsx');
        const { saveAs } = await import('file-saver');
        const taxResult = calculateInheritanceTax(currentCase);
        const totalTax = taxResult.heirTaxDetails.reduce((s: number, h: any) => s + h.finalTax, 0);
        const strategies = (currentCase as any).taxSavingStrategies || [];
        const rows: any[][] = [
          ['節税シミュレーション結果'],
          [],
          ['対策前相続税', totalTax],
          [],
          ['対策名', '節税額（円）', '内容'],
        ];
        let totalSaving = 0;
        for (const st of strategies) {
          const saving = st.estimatedReduction || 0;
          totalSaving += saving;
          rows.push([
            st.description || st.type || '',
            saving,
            st.detail || '',
          ]);
        }
        rows.push([]);
        rows.push(['合計節税額', totalSaving]);
        rows.push(['対策後相続税（推定）', Math.max(0, totalTax - totalSaving)]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[addr];
            if (cell && typeof cell.v === 'number') {
              cell.z = '#,##0';
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, '節税シミュレーション');
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        saveAs(new Blob([buf]), `節税シミュレーション_${name}.xlsx`);
      },
      pdfAction: async () => {
        const { exportTaxSavingPdf } = await import('@/lib/export/pdf-tax-saving');
        await exportTaxSavingPdf(currentCase);
      },
      uploadAction: undefined,
    },
    {
      id: 'listed-stock',
      title: '上場株式算定結果',
      description: '上場株式の評価額算定結果',
      note: '上場株式の算定結果は、上場株式ページからダウンロードしてください。',
    },
  ];

  const handleAction = async (itemId: string, actionType: string, action: () => Promise<void>) => {
    const key = `${itemId}-${actionType}`;
    setLoading(key);
    try {
      await action();
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました。' + (error instanceof Error ? error.message : ''));
    } finally {
      setLoading(null);
    }
  };

  const handleUpload = async (item: ExportItem) => {
    if (!isAuthenticated()) {
      alert('Googleドライブに接続してください（サイドバーのGoogleドライブ連携から）');
      return;
    }
    if (!item.uploadAction) return;

    setUploadStatus(prev => ({ ...prev, [item.id]: 'uploading' }));
    try {
      await item.uploadAction();
      setUploadStatus(prev => ({ ...prev, [item.id]: 'done' }));
      setTimeout(() => setUploadStatus(prev => ({ ...prev, [item.id]: 'idle' })), 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(prev => ({ ...prev, [item.id]: 'error' }));
      setTimeout(() => setUploadStatus(prev => ({ ...prev, [item.id]: 'idle' })), 3000);
    }
  };

  const getUploadIcon = (status: string | undefined) => {
    switch (status) {
      case 'uploading': return <span className="animate-pulse text-xs">送信中...</span>;
      case 'done': return <Check size={14} className="text-green-600" />;
      case 'error': return <AlertCircle size={14} className="text-red-600" />;
      default: return <Upload size={14} />;
    }
  };

  const isLoading = (itemId: string, actionType: string) => loading === `${itemId}-${actionType}`;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">書類出力</h1>

      <div className="space-y-4">
        {exportItems.map(item => (
          <Card key={item.id} className="hover:border-blue-300 transition-colors">
            <CardContent className="py-5">
              <div className="flex items-start gap-3 mb-4">
                <FileSpreadsheet size={24} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>

              {item.note ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  {item.note}
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Download buttons row */}
                  <div className="flex flex-wrap gap-2">
                    {item.excelAction && (
                      <Button
                        onClick={() => handleAction(item.id, 'excel', item.excelAction!)}
                        disabled={loading !== null}
                        variant="secondary"
                        className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                      >
                        {isLoading(item.id, 'excel') ? (
                          <span className="animate-pulse">生成中...</span>
                        ) : (
                          <>
                            <Download size={16} className="mr-1.5" />
                            Excelダウンロード
                          </>
                        )}
                      </Button>
                    )}

                    {item.pdfAction ? (
                      <Button
                        onClick={() => handleAction(item.id, 'pdf', item.pdfAction!)}
                        disabled={loading !== null}
                        variant="secondary"
                        className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      >
                        {isLoading(item.id, 'pdf') ? (
                          <span className="animate-pulse">生成中...</span>
                        ) : (
                          <>
                            <FileText size={16} className="mr-1.5" />
                            PDFダウンロード
                          </>
                        )}
                      </Button>
                    ) : item.wordAction ? null : item.excelAction ? (
                      <Button
                        disabled
                        variant="secondary"
                        className="bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                        title="準備中"
                      >
                        <FileText size={16} className="mr-1.5" />
                        PDFダウンロード
                        <span className="ml-1.5 text-xs bg-gray-200 text-gray-500 rounded px-1.5 py-0.5">準備中</span>
                      </Button>
                    ) : null}

                    {item.wordAction && (
                      <Button
                        onClick={() => handleAction(item.id, 'word', item.wordAction!)}
                        disabled={loading !== null}
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        {isLoading(item.id, 'word') ? (
                          <span className="animate-pulse">生成中...</span>
                        ) : (
                          <>
                            <FileType size={16} className="mr-1.5" />
                            Wordダウンロード
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Google Drive upload button */}
                  {item.uploadAction && (
                    <div className="flex">
                      <Button
                        onClick={() => handleUpload(item)}
                        disabled={uploadStatus[item.id] === 'uploading'}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                        title="Googleドライブにアップロード"
                      >
                        {getUploadIcon(uploadStatus[item.id])}
                        <span className="ml-1.5">Googleドライブ</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="py-4 text-sm text-gray-700">
          <p className="font-medium mb-1">注意事項</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>PDFは日本語フォント（Noto Sans JP）を使用して生成されます。</li>
            <li>遺産分割協議書は参考用です。正式な文書は専門家にご確認ください。</li>
            <li>すべてのデータはお使いのブラウザ内で処理され、外部サーバーには送信されません。</li>
            <li>Googleドライブへのアップロードは「【削除禁止】相続税業務管理アプリ/documents」フォルダに保存されます。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
