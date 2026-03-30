'use client';

import { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { exportPropertyList, exportSimulationResult } from '@/lib/export/spreadsheet';
import { exportDivisionAgreement } from '@/lib/export/word-agreement';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';

export default function ExportPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const [loading, setLoading] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const handleExport = async (type: string) => {
    setLoading(type);
    try {
      switch (type) {
        case 'property-list': {
          exportPropertyList(currentCase);
          break;
        }
        case 'simulation-xlsx': {
          const result = calculateInheritanceTax(currentCase);
          exportSimulationResult(currentCase, result);
          break;
        }
        case 'simulation-pdf': {
          const { exportSimulationPdf } = await import('@/lib/export/pdf-report');
          const result = calculateInheritanceTax(currentCase);
          await exportSimulationPdf(currentCase, result);
          break;
        }
        case 'division-word': {
          await exportDivisionAgreement(currentCase);
          break;
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました。' + (error instanceof Error ? error.message : ''));
    } finally {
      setLoading(null);
    }
  };

  const exports = [
    {
      id: 'property-list',
      title: '財産目録',
      description: '全財産を一覧にしたExcelスプレッドシート',
      icon: <FileSpreadsheet size={24} className="text-green-600" />,
      format: 'Excel (.xlsx)',
    },
    {
      id: 'simulation-xlsx',
      title: 'シミュレーション結果（スプレッドシート）',
      description: '相続税計算の詳細結果をExcel形式で出力',
      icon: <FileSpreadsheet size={24} className="text-green-600" />,
      format: 'Excel (.xlsx)',
    },
    {
      id: 'simulation-pdf',
      title: 'シミュレーション結果（PDF）',
      description: '相続人への報告用にフォーマットされたPDF',
      icon: <FileText size={24} className="text-red-600" />,
      format: 'PDF',
    },
    {
      id: 'division-word',
      title: '遺産分割協議書',
      description: '遺産分割の内容に基づいて自動作成されたWord文書',
      icon: <FileText size={24} className="text-blue-600" />,
      format: 'Word (.docx)',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">書類出力</h1>

      <div className="space-y-4">
        {exports.map(exp => (
          <Card key={exp.id} className="hover:border-blue-300 transition-colors">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                {exp.icon}
                <div>
                  <h3 className="font-medium text-gray-900">{exp.title}</h3>
                  <p className="text-sm text-gray-500">{exp.description}</p>
                  <p className="text-xs text-gray-400">形式: {exp.format}</p>
                </div>
              </div>
              <Button
                onClick={() => handleExport(exp.id)}
                disabled={loading !== null}
                variant="secondary"
              >
                {loading === exp.id ? (
                  <span className="animate-pulse">生成中...</span>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    ダウンロード
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="py-4 text-sm text-gray-700">
          <p className="font-medium mb-1">注意事項</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>PDFはブラウザ上で生成されます。日本語フォントの表示には制限がある場合があります。</li>
            <li>遺産分割協議書は参考用です。正式な文書は専門家にご確認ください。</li>
            <li>すべてのデータはお使いのブラウザ内で処理され、外部サーバーには送信されません。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
