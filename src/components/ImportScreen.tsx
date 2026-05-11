import { useRef, useState } from "react";
import { importCsvFromFile } from "../lib/csv";
import type { ImportedCsv } from "../types";

interface Props {
  onImported: (imported: ImportedCsv) => void;
}

export function ImportScreen({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const imported = await importCsvFromFile(files[0]);
      if (imported.headers.length === 0) {
        setError("CSVが空、または読み取り可能な行がありませんでした。");
        return;
      }
      onImported(imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSVの読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">銀行CSV修正ツール</h1>
        <p className="mt-2 text-sm text-gray-600">
          ネットバンキングからダウンロードしたCSVを選択してください。
          摘要欄が空欄の行を抽出し、補完作業を効率化します。
        </p>

        <div
          className="mt-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-gray-700">
            CSVファイルをここにドラッグ＆ドロップ
          </p>
          <p className="mt-1 text-xs text-gray-500">または</p>
          <button
            type="button"
            disabled={loading}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
          >
            {loading ? "読み込み中..." : "ファイルを選択"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500">
          対応文字コード: UTF-8 / UTF-8 BOM / Shift_JIS（自動判定）
        </div>
      </div>
    </div>
  );
}
