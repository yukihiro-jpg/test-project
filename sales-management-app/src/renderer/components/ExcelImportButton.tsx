import { useRef, useState } from 'react';
import { SecondaryButton } from './FormField';

export default function ExcelImportButton({ label, onImport }: {
  label: string;
  onImport: (buffer: ArrayBuffer) => Promise<{ inserted: number; updated: number; errors: string[] }>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const r = await onImport(buf);
      setMsg(`登録 ${r.inserted} 件 / 更新 ${r.updated} 件${r.errors.length ? ` / エラー ${r.errors.length} 件` : ''}`);
      if (r.errors.length) alert(r.errors.join('\n'));
    } catch (err: any) {
      setMsg('エラー: ' + (err?.message ?? String(err)));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <SecondaryButton onClick={() => ref.current?.click()} disabled={busy}>{busy ? '取込中...' : label}</SecondaryButton>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={handle} />
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
    </span>
  );
}
