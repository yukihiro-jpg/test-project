import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Button, FormField, Input, Select, SecondaryButton } from '../components/FormField';
import Modal from '../components/Modal';
import { showError } from '../components/toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function CashflowPage() {
  const navigate = useNavigate();
  const today = new Date();
  const m0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const m1 = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(m0);
  const [to, setTo] = useState(m1);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankId, setBankId] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);
  const [projection, setProjection] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    setEntries(await window.api.cashflow.list({ from, to, bank_account_id: bankId ? Number(bankId) : null }));
    setProjection(await window.api.cashflow.getProjection(from, to, bankId ? Number(bankId) : null));
  };
  useEffect(() => { window.api.bankAccounts.list().then(setBanks); }, []);
  useEffect(() => { load(); }, [from, to, bankId]);

  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.cashflow.update(edit.id, edit);
    else await window.api.cashflow.create(edit);
    setEdit(null); load();
  };

  const del = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    try { await window.api.cashflow.delete(id); load(); }
    catch (e: any) { showError(e); }
  };

  const gotoSource = (sourceType: string) => {
    if (sourceType === 'sales_invoice') navigate('/sales-invoices');
    else if (sourceType === 'purchase_invoice') navigate('/purchase-invoices');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">資金繰り表</h1>
      <div className="flex flex-wrap gap-2 items-end mb-4">
        <FormField label="開始日"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></FormField>
        <FormField label="終了日"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></FormField>
        <FormField label="銀行口座">
          <Select value={bankId} onChange={e => setBankId(e.target.value)}>
            <option value="">（全て）</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </FormField>
        <Button onClick={() => setEdit({ type: 'in', scheduled_date: new Date().toISOString().slice(0, 10), amount: 0, status: 'scheduled', category: '' })}>個別登録</Button>
      </div>

      <div className="bg-white border rounded p-2 mb-4" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={projection}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="balance" stroke="#2563eb" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <DataTable rows={entries} getRowKey={r => r.id}
        columns={[
          { key: 'scheduled_date', header: '予定日' },
          { key: 'actual_date', header: '実績日' },
          { key: 'type', header: '区分', render: r => r.type === 'in' ? '入金' : '出金' },
          { key: 'amount', header: '金額', render: r => r.amount?.toLocaleString() },
          { key: 'category', header: 'カテゴリ' },
          { key: 'source_type', header: '出所', render: r => r.source_type === 'manual' ? '手動' :
            <button className="text-blue-600 underline" onClick={e => { e.stopPropagation(); gotoSource(r.source_type); }}>
              {r.source_type === 'sales_invoice' ? '売上請求書' : '仕入請求書'} #{r.source_id}
            </button> },
          { key: 'status', header: '状態', render: r => r.status === 'completed' ? '完了' : r.status === 'cancelled' ? '取消' : '予定' },
          { key: 'memo', header: 'メモ' },
          { key: 'act', header: '操作', render: r => r.source_type === 'manual' ?
            <span><button className="text-blue-600 mr-2" onClick={e => { e.stopPropagation(); setEdit({ ...r }); }}>編集</button>
              <button className="text-red-600" onClick={e => { e.stopPropagation(); del(r.id); }}>削除</button>
            </span> : null }
        ]} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="手動キャッシュフローエントリ">
        {edit && (
          <div>
            <FormField label="区分">
              <Select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })}>
                <option value="in">入金</option><option value="out">出金</option>
              </Select>
            </FormField>
            <FormField label="予定日"><Input type="date" value={edit.scheduled_date} onChange={e => setEdit({ ...edit, scheduled_date: e.target.value })} /></FormField>
            <FormField label="金額"><Input type="number" value={edit.amount} onChange={e => setEdit({ ...edit, amount: Number(e.target.value) })} /></FormField>
            <FormField label="カテゴリ"><Input value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category: e.target.value })} /></FormField>
            <FormField label="メモ"><Input value={edit.memo ?? ''} onChange={e => setEdit({ ...edit, memo: e.target.value })} /></FormField>
            <FormField label="銀行口座">
              <Select value={edit.bank_account_id ?? ''} onChange={e => setEdit({ ...edit, bank_account_id: Number(e.target.value) || null })}>
                <option value="">（未指定）</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
            <div className="flex justify-end gap-2 mt-4">
              <SecondaryButton onClick={() => setEdit(null)}>キャンセル</SecondaryButton>
              <Button onClick={save}>保存</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
