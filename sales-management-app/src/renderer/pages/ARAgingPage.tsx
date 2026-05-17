import { Fragment, useEffect, useState } from 'react';
import { FormField, Input, Button } from '../components/FormField';

export default function ARAgingPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = () => window.api.arAging.getReceivablesAsOf(date).then(setData);
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
      <h1 className="text-2xl font-bold mb-4">売掛金残高一覧</h1>
      <div className="flex gap-2 items-end mb-4">
        <FormField label="基準日"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <Button onClick={load}>集計</Button>
      </div>
      {!data ? <div className="text-gray-500">「集計」ボタンを押してください</div> : (
        <div>
          <h2 className="font-semibold mb-2">顧客別合計</h2>
          <table className="w-full text-sm border mb-4">
            <thead className="bg-gray-100"><tr>
              <th className="px-2 py-1 text-left">顧客</th>
              <th className="px-2 py-1 text-right">件数</th>
              <th className="px-2 py-1 text-right">残高合計</th>
              <th className="px-2 py-1 text-right">当月</th>
              <th className="px-2 py-1 text-right">1-30日</th>
              <th className="px-2 py-1 text-right">31-60日</th>
              <th className="px-2 py-1 text-right">61-90日</th>
              <th className="px-2 py-1 text-right">90日超</th>
            </tr></thead>
            <tbody>
              {data.customers.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-gray-500">データがありません</td></tr>
              )}
              {data.customers.map((c: any) => (
                <Fragment key={c.customer_id}>
                  <tr className="border-t cursor-pointer hover:bg-blue-50" onClick={() => toggle(c.customer_id)}>
                    <td className="px-2">{expanded.has(c.customer_id) ? '▼' : '▶'} {c.customer_name}</td>
                    <td className="text-right px-2">{c.rows.length}</td>
                    <td className="text-right px-2 font-semibold">{fmt(c.total)}</td>
                    <td className="text-right px-2">{fmt(c.buckets.current)}</td>
                    <td className="text-right px-2">{fmt(c.buckets['1-30'])}</td>
                    <td className="text-right px-2">{fmt(c.buckets['31-60'])}</td>
                    <td className="text-right px-2">{fmt(c.buckets['61-90'])}</td>
                    <td className="text-right px-2">{fmt(c.buckets['90+'])}</td>
                  </tr>
                  {expanded.has(c.customer_id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-2 py-2">
                        <table className="w-full text-xs border">
                          <thead className="bg-gray-100"><tr>
                            <th className="px-2 py-1 text-left">請求書No</th>
                            <th className="px-2 py-1 text-left">発行日</th>
                            <th className="px-2 py-1 text-left">入金予定日</th>
                            <th className="px-2 py-1 text-right">請求額</th>
                            <th className="px-2 py-1 text-right">入金済額</th>
                            <th className="px-2 py-1 text-right">残高</th>
                          </tr></thead>
                          <tbody>
                            {c.rows.map((r: any) => (
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
