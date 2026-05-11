import { forwardRef } from "react";
import type { ImportedCsv } from "../types";

interface Props {
  imported: ImportedCsv;
  selectedRow: number;
  onSelectRow: (idx: number) => void;
  onScroll: (scrollTop: number) => void;
  rowHeight: number;
}

export const RawCsvPane = forwardRef<HTMLDivElement, Props>(function RawCsvPane(
  { imported, selectedRow, onSelectRow, onScroll, rowHeight },
  ref,
) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r-4 border-slate-300 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[10px] font-bold text-white">
            L
          </span>
          <div>
            <div className="text-sm font-bold text-slate-800">
              元CSV（アップロードしたファイル）
            </div>
            <div className="text-[10px] text-slate-600">
              読み取り専用 · {imported.fileName} · {imported.encoding}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-slate-300 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
          編集不可
        </span>
      </div>
      <div
        ref={ref}
        onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}
        className="flex-1 overflow-auto bg-slate-50"
      >
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-200 text-slate-700">
            <tr style={{ height: rowHeight }}>
              <th className="w-12 border-b border-r border-slate-300 px-2 text-right text-[10px] font-medium text-slate-500">
                #
              </th>
              {imported.headers.map((h, idx) => (
                <th
                  key={idx}
                  className="whitespace-nowrap border-b border-r border-slate-300 px-2 text-left font-medium last:border-r-0"
                >
                  {h || "(空)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imported.rawRows.map((row, idx) => (
              <tr
                key={idx}
                style={{ height: rowHeight }}
                onClick={() => onSelectRow(idx)}
                className={
                  selectedRow === idx
                    ? "cursor-pointer bg-blue-100"
                    : "cursor-pointer hover:bg-slate-100"
                }
              >
                <td className="border-b border-r border-slate-200 px-2 text-right text-[10px] text-slate-400">
                  {idx + 1}
                </td>
                {imported.headers.map((_, cidx) => (
                  <td
                    key={cidx}
                    className="whitespace-nowrap border-b border-r border-slate-200 px-2 text-slate-700 last:border-r-0"
                  >
                    {row[cidx] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
