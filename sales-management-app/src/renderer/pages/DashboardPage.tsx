import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

interface OverdueAR {
  invoice_id: number;
  invoice_no: string;
  customer_id: number;
  customer_name: string;
  due_date: string;
  outstanding: number;
  days_overdue: number;
}

interface UpcomingAP {
  invoice_id: number;
  invoice_no: string;
  supplier_id: number;
  supplier_name: string;
  due_date: string;
  outstanding: number;
  days_remaining: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [s, setS] = useState<Summary | null>(null);
  const [overdue, setOverdue] = useState<OverdueAR[]>([]);
  const [upcomingAP, setUpcomingAP] = useState<UpcomingAP[]>([]);

  useEffect(() => {
    window.api.dashboard.summary().then(setS);
    window.api.dashboard.overdueReceivables().then(setOverdue);
    window.api.dashboard.upcomingPayables(14).then(setUpcomingAP);
  }, []);
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

          <section className="mb-6">
            <h2 className="font-semibold mb-2">入金予定日超過の売上請求書</h2>
            <div className="bg-white border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">請求書No</th>
                    <th className="px-2 py-1 text-left">取引先</th>
                    <th className="px-2 py-1 text-left">入金予定日</th>
                    <th className="px-2 py-1 text-right">残額</th>
                    <th className="px-2 py-1 text-right">遅延日数</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map(r => (
                    <tr key={r.invoice_id} className="border-t cursor-pointer hover:bg-blue-50"
                      onClick={() => navigate(`/payments`)}>
                      <td className="px-2 py-1">{r.invoice_no}</td>
                      <td className="px-2 py-1">{r.customer_name}</td>
                      <td className="px-2 py-1">{r.due_date}</td>
                      <td className="px-2 py-1 text-right">{r.outstanding.toLocaleString('ja-JP')}</td>
                      <td className="px-2 py-1 text-right text-red-600 font-semibold">{r.days_overdue}日</td>
                    </tr>
                  ))}
                  {!overdue.length && (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">遅延中の売上請求書はありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="font-semibold mb-2">支払予定日が2週間以内の仕入請求書</h2>
            <div className="bg-white border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">請求書No</th>
                    <th className="px-2 py-1 text-left">仕入先</th>
                    <th className="px-2 py-1 text-left">支払予定日</th>
                    <th className="px-2 py-1 text-right">残額</th>
                    <th className="px-2 py-1 text-right">残日数</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingAP.map(r => (
                    <tr key={r.invoice_id} className="border-t cursor-pointer hover:bg-blue-50"
                      onClick={() => navigate(`/payments`)}>
                      <td className="px-2 py-1">{r.invoice_no}</td>
                      <td className="px-2 py-1">{r.supplier_name}</td>
                      <td className="px-2 py-1">{r.due_date}</td>
                      <td className="px-2 py-1 text-right">{r.outstanding.toLocaleString('ja-JP')}</td>
                      <td className="px-2 py-1 text-right">{r.days_remaining}日</td>
                    </tr>
                  ))}
                  {!upcomingAP.length && (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">直近の支払予定はありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

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
