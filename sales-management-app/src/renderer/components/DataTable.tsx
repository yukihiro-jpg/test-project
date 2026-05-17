import { useMemo, useState } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export default function DataTable<T extends Record<string, any>>({ rows, columns, onRowClick, getRowKey, selectable, selectedIds, onSelectionChange }: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  getRowKey: (row: T) => string | number;
  selectable?: boolean;
  selectedIds?: Array<string | number>;
  onSelectionChange?: (ids: Array<string | number>) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');

  const filteredSorted = useMemo(() => {
    let r = rows;
    if (filter) {
      const f = filter.toLowerCase();
      r = r.filter(row => JSON.stringify(row).toLowerCase().includes(f));
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == bv) return 0;
        return ((av > bv ? 1 : -1) * (sortDir === 'asc' ? 1 : -1));
      });
    }
    return r;
  }, [rows, filter, sortKey, sortDir]);

  const toggle = (id: string | number) => {
    if (!onSelectionChange) return;
    const cur = new Set(selectedIds ?? []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    onSelectionChange(Array.from(cur));
  };

  return (
    <div>
      <input className="border rounded px-2 py-1 mb-2" placeholder="検索..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {selectable && <th className="px-2 py-1 w-8"></th>}
              {columns.map(c => (
                <th key={c.key} className="px-2 py-1 text-left cursor-pointer" style={c.width ? { width: c.width } : undefined}
                  onClick={() => { if (c.sortable !== false) { if (sortKey === c.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(c.key); setSortDir('asc'); } } }}>
                  {c.header}{sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map(row => {
              const id = getRowKey(row);
              return (
                <tr key={id} className="hover:bg-blue-50 cursor-pointer border-t" onClick={() => onRowClick?.(row)}>
                  {selectable && (
                    <td className="px-2 py-1" onClick={e => { e.stopPropagation(); toggle(id); }}>
                      <input type="checkbox" checked={(selectedIds ?? []).includes(id)} onChange={() => toggle(id)} />
                    </td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} className="px-2 py-1">{c.render ? c.render(row) : String(row[c.key] ?? '')}</td>
                  ))}
                </tr>
              );
            })}
            {!filteredSorted.length && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-2 py-4 text-center text-gray-500">データがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
