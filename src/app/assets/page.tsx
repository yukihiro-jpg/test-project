'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDecedent } from '@/hooks/useDecedent';
import { useAssets } from '@/hooks/useAssets';
import PdfUploader from '@/components/PdfUploader';
import AssetCard from '@/components/AssetCard';
import SummaryTable from '@/components/SummaryTable';
import { classify } from '@/lib/classifier';
import { calculate } from '@/lib/valuator';
import type { ExtractedInsuranceData } from '@/types/extracted';

export default function AssetsPage() {
  const router = useRouter();
  const decedent = useDecedent((s) => s.decedent);
  const { assets, addAsset, updateAsset, removeAsset } = useAssets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!decedent) return;

      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'エラーが発生しました');
          return;
        }

        const extracted: ExtractedInsuranceData = data.extracted;
        const category = classify(extracted, decedent);
        const valuation = calculate(extracted, category, decedent);

        addAsset({
          id: crypto.randomUUID(),
          extracted,
          category,
          categoryConfidence: 'auto',
          valuation,
          fileName: file.name,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ネットワークエラー');
      } finally {
        setIsLoading(false);
      }
    },
    [decedent, addAsset],
  );

  if (!decedent) {
    return (
      <main className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            先に被相続人情報を入力してください
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline"
          >
            入力画面へ戻る
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ヘッダー */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">保険資産分類</h1>
            <p className="text-sm text-gray-500">
              被相続人: {decedent.name} / 死亡日: {decedent.dateOfDeath} / 法定相続人: {decedent.numberOfLegalHeirs}人
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:underline"
          >
            被相続人情報を変更
          </button>
        </div>

        {/* PDF アップロード */}
        <PdfUploader onUpload={handleUpload} isLoading={isLoading} />

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* 資産カード一覧 */}
        {assets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">
              分類結果（{assets.length}件）
            </h2>
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                decedent={decedent}
                onUpdate={updateAsset}
                onRemove={removeAsset}
              />
            ))}
          </div>
        )}

        {/* サマリーテーブル */}
        <SummaryTable
          assets={assets}
          numberOfLegalHeirs={decedent.numberOfLegalHeirs}
        />
      </div>
    </main>
  );
}
