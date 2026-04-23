'use client';

import { useState, useEffect } from 'react';
import { toWareki, fromWareki, isValidDate, getEraList } from '@/lib/dates/wareki';

interface WarekiInputProps {
  label?: string;
  value: string;       // YYYY-MM-DD
  onChange: (value: string) => void;
  showWareki?: boolean;
  compact?: boolean;   // true: ラベル非表示、コンパクト表示
}

const ERAS = getEraList();

export function WarekiInput({ label, value, onChange, showWareki = true, compact = false }: WarekiInputProps) {
  const [mode, setMode] = useState<'western' | 'wareki'>('western');
  const [era, setEra] = useState<string>('昭和');
  const [eraYear, setEraYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [day, setDay] = useState<string>('');
  const [warekiDisplay, setWarekiDisplay] = useState<string>('');

  // 西暦値が変わった時に和暦の個別欄も更新
  useEffect(() => {
    if (value && isValidDate(value)) {
      setWarekiDisplay(toWareki(value));
      // 和暦の元号と年を逆算
      const match = toWareki(value).match(/^(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日$/);
      if (match) {
        const [, eraName, eraYearStr, m, d] = match;
        setEra(eraName);
        setEraYear(eraYearStr === '元' ? '1' : eraYearStr);
        setMonth(m);
        setDay(d);
      }
    } else {
      setWarekiDisplay('');
    }
  }, [value]);

  const handleWarekiChange = (newEra: string, newYear: string, newMonth: string, newDay: string) => {
    setEra(newEra);
    setEraYear(newYear);
    setMonth(newMonth);
    setDay(newDay);
    if (newEra && newYear && newMonth && newDay) {
      const str = `${newEra}${newYear}年${newMonth}月${newDay}日`;
      const iso = fromWareki(str);
      if (iso) onChange(iso);
    }
  };

  const labelElement = label ? (
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  ) : null;

  return (
    <div className={compact ? '' : 'space-y-1'}>
      {labelElement}

      {/* モード切替タブ */}
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onClick={() => setMode('western')}
          className={`px-2 py-0.5 text-xs rounded ${mode === 'western' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          西暦
        </button>
        <button
          type="button"
          onClick={() => setMode('wareki')}
          className={`px-2 py-0.5 text-xs rounded ${mode === 'wareki' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          和暦
        </button>
      </div>

      {mode === 'western' ? (
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <div className="flex items-center gap-1">
          <select
            value={era}
            onChange={e => handleWarekiChange(e.target.value, eraYear, month, day)}
            className="border border-gray-300 rounded px-1 py-1 text-sm"
          >
            {ERAS.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
          <input
            type="number"
            value={eraYear}
            onChange={e => handleWarekiChange(era, e.target.value, month, day)}
            placeholder="年"
            min="1"
            max="99"
            className="w-12 border border-gray-300 rounded px-1 py-1 text-sm text-right"
          />
          <span className="text-xs text-gray-500">年</span>
          <input
            type="number"
            value={month}
            onChange={e => handleWarekiChange(era, eraYear, e.target.value, day)}
            placeholder="月"
            min="1"
            max="12"
            className="w-10 border border-gray-300 rounded px-1 py-1 text-sm text-right"
          />
          <span className="text-xs text-gray-500">月</span>
          <input
            type="number"
            value={day}
            onChange={e => handleWarekiChange(era, eraYear, month, e.target.value)}
            placeholder="日"
            min="1"
            max="31"
            className="w-10 border border-gray-300 rounded px-1 py-1 text-sm text-right"
          />
          <span className="text-xs text-gray-500">日</span>
        </div>
      )}

      {showWareki && warekiDisplay && mode === 'western' && (
        <p className="text-xs text-gray-500 ml-1">
          和暦: {warekiDisplay}
        </p>
      )}
      {showWareki && value && mode === 'wareki' && (
        <p className="text-xs text-gray-500 ml-1">
          西暦: {value}
        </p>
      )}
    </div>
  );
}
