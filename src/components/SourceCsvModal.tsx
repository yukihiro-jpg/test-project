import type { ImportedCsv } from "../types";

interface Props {
  imported: ImportedCsv;
  onClose: () => void;
}

export function SourceCsvModal({ imported, onClose }: Props) {
  const text = [
    imported.headers.join(","),
    ...imported.rawRows.map((row) => row.join(",")),
  ].join("\n");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">元CSVの内容</h2>
            <p className="text-xs text-gray-500">
              {imported.fileName} · {imported.encoding}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            閉じる
          </button>
        </div>
        <pre className="flex-1 overflow-auto whitespace-pre bg-gray-50 p-4 font-mono text-xs text-gray-800">
          {text}
        </pre>
      </div>
    </div>
  );
}
