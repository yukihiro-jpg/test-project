import { useEffect, useState } from 'react';
import { FormField, Input, Button } from '../components/FormField';

export default function ARAgingPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);

  const load = () => window.api.arAging.getReceivablesAsOf(date).then(setData);
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n.toLocaleString('ja-JP');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">売掛金残高一覧</h1>
      <div className="flex gap-2 items-end mb-4">
        <FormField label="基準日"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
        <Button onClick={load}>更新</Button>
      </div>
      {data && (
        <div>
          <h2 className="font-semibold mb-2">顧客別合計</h2>
          <table className="w-full text-sm border mb-4">
            <thead className="bg-gray-100"><tr>
              <th className="px-2 py-1 text-left">顧客</th><th>合計</th>
              <th>当月</th><th>1-30日</th><th>31-60日</th><th>61-90日</th><th>90日超</th>
            </tr></thead>
            <tbody>
              {data.customers.map((c: any) => (
                <tr key={c.customer_id} className="border-t">
                  <td className="px-2">{c.customer_name}</td>
                  <td className="text-right px-2">{fmt(c.total)}</td>
                  <td className="text-right px-2">{fmt(c.buckets.current)}</td>
                  <td className="text-right px-2">{fmt(c.buckets['1-30'])}</td>
                  <td className="text-right px-2">{fmt(c.buckets['31-60'])}</td>
                  <td className="text-right px-2">{fmt(c.buckets['61-90'])}</td>
                  <td className="text-right px-2">{fmt(c.buckets['90+'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className="font-semibold mb-2">明細</h2>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100"><tr>
              <th>請求書番号</th><th>顧客</th><th>発行日</th><th>支払期日</th><th>請求額</th><th>入金済</th><th>残高</th><th>区分</th>
            </tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.invoice_id} className="border-t">
                  <td className="px-2">{r.invoice_no}</td>
                  <td className="px-2">{r.customer_name}</td>
                  <td className="px-2">{r.issue_date}</td>
                  <td className="px-2">{r.due_date}</td>
                  <td className="text-right px-2">{fmt(r.total_inc_tax)}</td>
                  <td className="text-right px-2">{fmt(r.paid_amount)}</td>
                  <td className="text-right px-2 font-semibold">{fmt(r.outstanding)}</td>
                  <td className="px-2">{r.bucket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
