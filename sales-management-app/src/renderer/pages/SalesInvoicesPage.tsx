import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Button, DangerButton, FormField, Input, Select, SecondaryButton } from '../components/FormField';

interface Line { product_id?: number | null; description: string; quantity: number; unit_price: number; tax_rate: number; }

export default function SalesInvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = () => Promise.all([
    window.api.salesInvoices.list().then(setRows),
    window.api.customers.list().then(setCustomers),
    window.api.products.list().then(setProducts)
  ]);
  useEffect(() => { load(); }, []);

  const openNew = () => setEdit({
    customer_id: customers[0]?.id ?? 0,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    status: 'issued',
    lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 10 }]
  });
  const openEdit = async (r: any) => setEdit(await window.api.salesInvoices.get(r.id));
  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.salesInvoices.update(edit.id, edit);
    else await window.api.salesInvoices.create(edit);
    setEdit(null); load();
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.salesInvoices.delete(edit.id);
    setEdit(null); load();
  };
  const pdf = async (id: number) => {
    try { await window.api.salesInvoices.generatePdf(id); }
    catch (e: any) { alert('PDF出力エラー: ' + e.message); }
  };

  const updLine = (i: number, patch: Partial<Line>) =>
    setEdit((ed: any) => ({ ...ed, lines: ed.lines.map((l: Line, idx: number) => idx === i ? { ...l, ...patch } : l) }));
  const addLine = () => setEdit((ed: any) => ({ ...ed, lines: [...ed.lines, { description: '', quantity: 1, unit_price: 0, tax_rate: 10 }] }));
  const delLine = (i: number) => setEdit((ed: any) => ({ ...ed, lines: ed.lines.filter((_: any, idx: number) => idx !== i) }));
  const pickProduct = (i: number, pid: string) => {
    const p = products.find(x => x.id === Number(pid));
    if (p) updLine(i, { product_id: p.id, description: p.name, unit_price: p.sales_unit_price, tax_rate: p.tax_rate });
  };

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  const customerName = (id: number) => customers.find(c => c.id === id)?.name ?? '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">売上請求書</h1>
        <div className="flex gap-2 items-center">
          <Select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">全て</option>
            <option value="draft">下書き</option>
            <option value="issued">発行</option>
            <option value="partially_paid">一部入金</option>
            <option value="paid">入金済</option>
            <option value="void">無効</option>
          </Select>
          <Button onClick={openNew}>新規</Button>
        </div>
      </div>
      <DataTable rows={filtered} getRowKey={r => r.id} onRowClick={openEdit}
        columns={[
          { key: 'invoice_no', header: '請求書番号' },
          { key: 'issue_date', header: '発行日' },
          { key: 'due_date', header: '入金予定日' },
          { key: 'customer_id', header: '顧客', render: r => customerName(r.customer_id) },
          { key: 'total_inc_tax', header: '合計', render: r => r.total_inc_tax?.toLocaleString() },
          { key: 'status', header: '状態' },
          { key: 'pdf', header: 'PDF', render: r => <button className="text-blue-600 underline" onClick={e => { e.stopPropagation(); pdf(r.id); }}>PDF出力</button> }
        ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '請求書編集' : '新規請求書'} widthClass="max-w-4xl">
        {edit && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="顧客">
                <Select value={edit.customer_id} onChange={e => setEdit({ ...edit, customer_id: Number(e.target.value) })}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <FormField label="発行日"><Input type="date" value={edit.issue_date} onChange={e => setEdit({ ...edit, issue_date: e.target.value })} /></FormField>
              <FormField label="入金予定日"><Input type="date" value={edit.due_date} onChange={e => setEdit({ ...edit, due_date: e.target.value })} /></FormField>
            </div>
            <FormField label="状態">
              <Select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                <option value="draft">下書き</option><option value="issued">発行</option>
                <option value="partially_paid">一部入金</option><option value="paid">入金済</option><option value="void">無効</option>
              </Select>
            </FormField>
            <table className="w-full text-sm border mt-2">
              <thead className="bg-gray-100"><tr><th>商品</th><th>説明</th><th>数量</th><th>単価</th><th>税率</th><th></th></tr></thead>
              <tbody>
                {(edit.lines ?? []).map((l: Line, i: number) => (
                  <tr key={i} className="border-t">
                    <td>
                      <Select value={l.product_id ?? ''} onChange={e => pickProduct(i, e.target.value)}>
                        <option value="">（任意）</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </td>
                    <td><Input value={l.description} onChange={e => updLine(i, { description: e.target.value })} /></td>
                    <td><Input type="number" value={l.quantity} onChange={e => updLine(i, { quantity: Number(e.target.value) })} /></td>
                    <td><Input type="number" value={l.unit_price} onChange={e => updLine(i, { unit_price: Number(e.target.value) })} /></td>
                    <td>
                      <Select value={l.tax_rate} onChange={e => updLine(i, { tax_rate: Number(e.target.value) })}>
                        <option value={10}>10%</option><option value={8}>8%</option>
                      </Select>
                    </td>
                    <td><button className="text-red-600" onClick={() => delLine(i)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SecondaryButton onClick={addLine} className="mt-2">行を追加</SecondaryButton>
            <FormField label="備考"><Input value={edit.notes ?? ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></FormField>
            <div className="flex justify-between mt-4">
              {edit.id ? <DangerButton onClick={del}>削除</DangerButton> : <span />}
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setEdit(null)}>キャンセル</SecondaryButton>
                <Button onClick={save}>保存</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
