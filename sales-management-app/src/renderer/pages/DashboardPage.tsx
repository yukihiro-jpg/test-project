import { useEffect, useState } from 'react';

interface Upcoming {
  type: 'in' | 'out';
  scheduled_date: string;
  amount: number;
  memo: string | null;
  source_type: string;
  source_id: number | null;
}

interface Summary {
  monthSales: number;
  monthPurchase: number;
  arTotal: number;
  apTotal: number;
  monthIn: number;
  monthOut: number;
  upcoming: Upcoming[];
}

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { window.api.dashboard.summary().then(setS); }, []);
  const f = (n: number) => n.toLocaleString('ja-JP') + ' 円';
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">ダッシュボード</h1>
      {!s ? <div>読み込み中...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Card title="今月売上" value={f(s.monthSales)} />
            <Card title="今月仕入" value={f(s.monthPurchase ?? 0)} />
            <Card title="売掛金残高（本日基準）" value={f(s.arTotal)} />
            <Card title="買掛金残高（本日基準）" value={f(s.apTotal)} />
            <Card title="今月予定入金" value={f(s.monthIn)} />
            <Card title="今月予定出金" value={f(s.monthOut)} />
          </div>
          <section>
            <h2 className="font-semibold mb-2">直近1週間の入出金予定</h2>
            <div className="bg-white border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">予定日</th>
                    <th className="px-2 py-1 text-left">区分</th>
                    <th className="px-2 py-1 text-right">金額</th>
                    <th className="px-2 py-1 text-left">摘要</th>
                    <th className="px-2 py-1 text-left">出所</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.upcoming ?? []).map((u, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{u.scheduled_date}</td>
                      <td className="px-2 py-1">{u.type === 'in' ? '入金' : '出金'}</td>
                      <td className="px-2 py-1 text-right">{u.amount.toLocaleString('ja-JP')}</td>
                      <td className="px-2 py-1">{u.memo ?? ''}</td>
                      <td className="px-2 py-1 text-gray-600 text-xs">{u.source_type}</td>
                    </tr>
                  ))}
                  {!(s.upcoming ?? []).length && (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">予定はありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
