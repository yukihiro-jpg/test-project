import { useEffect, useRef, useState } from "react";
import { suggestCounterparties, type CounterpartyRecord } from "../lib/db";

interface Props {
  amount: number;
  date: string;
  value: string;
  rowHeight: number;
  stillEmpty: boolean;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onFocus: () => void;
}

export function SummaryEditCell({
  amount,
  date,
  value,
  rowHeight,
  stillEmpty,
  onChange,
  onCommit,
  onFocus,
}: Props) {
  const [suggestions, setSuggestions] = useState<CounterpartyRecord[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  async function loadSuggestions() {
    const results = await suggestCounterparties(amount, date, 5);
    setSuggestions(results);
  }

  function handleFocus() {
    onFocus();
    if (value.trim() === "") {
      void loadSuggestions().then(() => setOpen(true));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && containerRef.current?.contains(next)) {
      return;
    }
    setOpen(false);
    onCommit(lastValueRef.current);
  }

  function applySuggestion(s: CounterpartyRecord) {
    onChange(s.summary);
    lastValueRef.current = s.summary;
    setOpen(false);
    onCommit(s.summary);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={stillEmpty ? "未入力" : ""}
        className={`block h-full w-full bg-transparent px-2 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          stillEmpty ? "placeholder:text-amber-600" : ""
        }`}
        style={{ height: rowHeight }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-0.5 w-72 max-w-md rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-600">
            候補 (同じ金額・日付の過去入力)
          </div>
          <ul>
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50"
                >
                  <span className="truncate">{s.summary}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {s.hitCount}回
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
