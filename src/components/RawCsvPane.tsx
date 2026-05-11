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
    <div className="flex h-full min-h-0 flex-col border-r-4 border-rose-300 bg-rose-50">
      <div className="flex items-center justify-between border-b border-rose-300 bg-rose-100 px-4 py-2.5">
        <div>
          <div className="text-sm font-bold text-rose-900">
            元CSV（アップロードしたファイル）
          </div>
          <div className="text-[10px] text-rose-700">
            読み取り専用 · {imported.fileName} · {imported.encoding}
          </div>
        </div>
        <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[10px] font-semibold text-rose-800">
          編集不可
        </span>
      </div>
      <div
        ref={ref}
        onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}
        className="flex-1 overflow-auto bg-rose-50"
      >
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-rose-100 text-rose-900">
            <tr style={{ height: rowHeight }}>
              <th className="w-12 border-b border-r border-rose-200 px-2 text-right text-[10px] font-medium text-rose-500">
                #
              </th>
              {imported.headers.map((h, idx) => (
                <th
                  key={idx}
                  className="whitespace-nowrap border-b border-r border-rose-200 px-2 text-center font-medium last:border-r-0"
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
                    : "cursor-pointer hover:bg-rose-100/60"
                }
              >
                <td className="border-b border-r border-rose-100 px-2 text-right text-[10px] text-rose-400">
                  {idx + 1}
                </td>
                {imported.headers.map((_, cidx) => (
                  <td
                    key={cidx}
                    className="whitespace-nowrap border-b border-r border-rose-100 px-2 text-slate-700 last:border-r-0"
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
