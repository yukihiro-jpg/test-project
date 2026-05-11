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
    <div className="flex h-full min-h-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">
          元CSV（読み取り専用）
        </span>
        <span className="text-[10px] text-gray-500">
          {imported.fileName} · {imported.encoding}
        </span>
      </div>
      <div
        ref={ref}
        onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}
        className="flex-1 overflow-auto"
      >
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
            <tr style={{ height: rowHeight }}>
              <th className="w-12 border-b border-r border-gray-200 px-2 text-right text-[10px] font-medium text-gray-500">
                #
              </th>
              {imported.headers.map((h, idx) => (
                <th
                  key={idx}
                  className="whitespace-nowrap border-b border-r border-gray-200 px-2 text-left font-medium last:border-r-0"
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
                    : "cursor-pointer hover:bg-gray-50"
                }
              >
                <td className="border-b border-r border-gray-100 px-2 text-right text-[10px] text-gray-400">
                  {idx + 1}
                </td>
                {imported.headers.map((_, cidx) => (
                  <td
                    key={cidx}
                    className="whitespace-nowrap border-b border-r border-gray-100 px-2 last:border-r-0"
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
