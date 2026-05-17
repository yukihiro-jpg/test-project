import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { window.api.dashboard.summary().then(setS); }, []);
  const f = (n: number) => n.toLocaleString('ja-JP') + ' 円';
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">ダッシュボード</h1>
      {!s ? <div>読み込み中...</div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card title="今月売上" value={f(s.monthSales)} />
          <Card title="売掛金残高" value={f(s.arTotal)} />
          <Card title="買掛金残高" value={f(s.apTotal)} />
          <Card title="今月予定入金" value={f(s.monthIn)} />
          <Card title="今月予定出金" value={f(s.monthOut)} />
          <Card title="今月予定差引" value={f(s.monthIn - s.monthOut)} />
        </div>
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
