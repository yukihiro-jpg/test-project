import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Button, FormField, Input, Select, SecondaryButton, DangerButton } from '../components/FormField';
import { showError, showInfo } from '../components/toast';

interface DeliveryLine {
  product_id?: number | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount_ex_tax?: number;
}

export default function DeliveriesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = () => Promise.all([
    window.api.deliveries.list().then(setRows),
    window.api.customers.list().then(setCustomers),
    window.api.products.list().then(setProducts)
  ]);
  useEffect(() => { load(); }, []);

  const openNew = () => setEdit({ customer_id: customers[0]?.id ?? 0, delivery_date: new Date().toISOString().slice(0, 10), lines: [{ product_name_snapshot: '', quantity: 1, unit_price: 0, tax_rate: 10 }] });
  const openEdit = async (r: any) => {
    const full = await window.api.deliveries.get(r.id);
    setEdit(full);
  };

  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.deliveries.update(edit.id, edit);
    else await window.api.deliveries.create(edit);
    setEdit(null); load();
  };

  const del = async () => {
    if (!edit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.deliveries.delete(edit.id);
    setEdit(null); load();
  };

  const aggregate = async () => {
    if (!selected.length) { showInfo('納品を選択してください'); return; }
    if (!confirm(`${selected.length} 件を請求書化しますか？`)) return;
    try {
      const id = await window.api.deliveries.aggregateToInvoice(selected.map(Number), {});
      const inv = await window.api.salesInvoices.get(id);
      showInfo('請求書を作成しました: ' + (inv?.invoice_no ?? `id=${id}`));
      setSelected([]); load();
    } catch (e: any) { showError(e); }
  };

  const updLine = (i: number, patch: Partial<DeliveryLine>) => {
    setEdit((ed: any) => ({ ...ed, lines: ed.lines.map((l: DeliveryLine, idx: number) => idx === i ? { ...l, ...patch } : l) }));
  };
  const addLine = () => setEdit((ed: any) => ({ ...ed, lines: [...ed.lines, { product_name_snapshot: '', quantity: 1, unit_price: 0, tax_rate: 10 }] }));
  const delLine = (i: number) => setEdit((ed: any) => ({ ...ed, lines: ed.lines.filter((_: any, idx: number) => idx !== i) }));
  const pickProduct = (i: number, pid: string) => {
    const p = products.find(x => x.id === Number(pid));
    if (p) updLine(i, { product_id: p.id, product_name_snapshot: p.name, unit_price: p.sales_unit_price, tax_rate: p.tax_rate });
  };
  const customerName = (id: number) => customers.find(c => c.id === id)?.name ?? '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">納品書</h1>
        <div className="flex gap-2">
          <SecondaryButton onClick={aggregate}>選択した納品から請求書作成</SecondaryButton>
          <Button onClick={openNew}>新規</Button>
        </div>
      </div>
      <DataTable rows={rows} getRowKey={r => r.id} onRowClick={openEdit}
        selectable selectedIds={selected} onSelectionChange={setSelected}
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'delivery_date', header: '納品日' },
          { key: 'customer_id', header: '顧客', render: r => customerName(r.customer_id) },
          { key: 'status', header: '状態' },
          { key: 'invoice_id', header: '請求書ID' }
        ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '納品編集' : '新規納品'} widthClass="max-w-4xl">
        {edit && (
          <div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="顧客">
                <Select value={edit.customer_id} onChange={e => setEdit({ ...edit, customer_id: Number(e.target.value) })}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <FormField label="納品日"><Input type="date" value={edit.delivery_date} onChange={e => setEdit({ ...edit, delivery_date: e.target.value })} /></FormField>
            </div>
            <table className="w-full text-sm border mt-2">
              <thead className="bg-gray-100"><tr><th>商品</th><th>品名</th><th>数量</th><th>単価</th><th>税率</th><th></th></tr></thead>
              <tbody>
                {edit.lines.map((l: DeliveryLine, i: number) => (
                  <tr key={i} className="border-t">
                    <td>
                      <Select value={l.product_id ?? ''} onChange={e => pickProduct(i, e.target.value)}>
                        <option value="">（任意）</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </td>
                    <td><Input value={l.product_name_snapshot} onChange={e => updLine(i, { product_name_snapshot: e.target.value })} /></td>
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
