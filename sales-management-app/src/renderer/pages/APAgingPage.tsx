import { Fragment, useEffect, useState } from 'react';
import { FormField, Input, Button } from '../components/FormField';

export default function APAgingPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = () => window.api.apAging.getPayablesAsOf(date).then(setData);
  useEffect(() => { load(); }, []);
  const fmt = (n: number) => n.toLocaleString('ja-JP');
  const toggle = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">買掛金残高一覧</h1>
      <div className="flex gap-2 items-end mb-4">
        <FormField label="基準日"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <Button onClick={load}>集計</Button>
      </div>
      {!data ? <div className="text-gray-500">「集計」ボタンを押してください</div> : (
        <div>
          <h2 className="font-semibold mb-2">仕入先別合計</h2>
          <table className="w-full text-sm border mb-4">
            <thead className="bg-gray-100"><tr>
              <th className="px-2 py-1 text-left">仕入先</th>
              <th className="px-2 py-1 text-right">件数</th>
              <th className="px-2 py-1 text-right">残高合計</th>
              <th className="px-2 py-1 text-right">当月</th>
              <th className="px-2 py-1 text-right">1-30日</th>
              <th className="px-2 py-1 text-right">31-60日</th>
              <th className="px-2 py-1 text-right">61-90日</th>
              <th className="px-2 py-1 text-right">90日超</th>
            </tr></thead>
            <tbody>
              {data.suppliers.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-gray-500">データがありません</td></tr>
              )}
              {data.suppliers.map((s: any) => (
                <Fragment key={s.supplier_id}>
                  <tr className="border-t cursor-pointer hover:bg-blue-50" onClick={() => toggle(s.supplier_id)}>
                    <td className="px-2">{expanded.has(s.supplier_id) ? '▼' : '▶'} {s.supplier_name}</td>
                    <td className="text-right px-2">{s.rows.length}</td>
                    <td className="text-right px-2 font-semibold">{fmt(s.total)}</td>
                    <td className="text-right px-2">{fmt(s.buckets.current)}</td>
                    <td className="text-right px-2">{fmt(s.buckets['1-30'])}</td>
                    <td className="text-right px-2">{fmt(s.buckets['31-60'])}</td>
                    <td className="text-right px-2">{fmt(s.buckets['61-90'])}</td>
                    <td className="text-right px-2">{fmt(s.buckets['90+'])}</td>
                  </tr>
                  {expanded.has(s.supplier_id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-2 py-2">
                        <table className="w-full text-xs border">
                          <thead className="bg-gray-100"><tr>
                            <th className="px-2 py-1 text-left">請求書No</th>
                            <th className="px-2 py-1 text-left">発行日</th>
                            <th className="px-2 py-1 text-left">支払予定日</th>
                            <th className="px-2 py-1 text-right">請求額</th>
                            <th className="px-2 py-1 text-right">支払済額</th>
                            <th className="px-2 py-1 text-right">残高</th>
                          </tr></thead>
                          <tbody>
                            {s.rows.map((r: any) => (
                              <tr key={r.invoice_id} className="border-t">
                                <td className="px-2">{r.invoice_no}</td>
                                <td className="px-2">{r.issue_date}</td>
                                <td className="px-2">{r.due_date}</td>
                                <td className="text-right px-2">{fmt(r.total_inc_tax)}</td>
                                <td className="text-right px-2">{fmt(r.paid_amount)}</td>
                                <td className="text-right px-2 font-semibold">{fmt(r.outstanding)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
