import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

type TabKey = 'pending' | 'invoiced';

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<number | ''>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const buildOptions = () => {
    const opts: any = { status: tab === 'pending' ? 'uninvoiced' : 'invoiced_only' };
    if (filterCustomerId !== '' && filterCustomerId != null) opts.customerId = Number(filterCustomerId);
    if (filterDateFrom) opts.dateFrom = filterDateFrom;
    if (filterDateTo) opts.dateTo = filterDateTo;
    return opts;
  };

  const load = () => Promise.all([
    window.api.deliveries.list(buildOptions()).then(setRows),
    window.api.customers.list().then(setCustomers),
    window.api.products.list().then(setProducts)
  ]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, filterCustomerId, filterDateFrom, filterDateTo]);

  const openNew = () => setEdit({ customer_id: customers[0]?.id ?? 0, delivery_date: new Date().toISOString().slice(0, 10), lines: [{ product_name_snapshot: '', quantity: 1, unit_price: 0, tax_rate: 10 }] });
  const openEdit = async (r: any) => {
    if (tab === 'invoiced' && r.invoice_id) {
      // navigate to sales invoices page
      navigate(`/sales-invoices?invoiceId=${r.invoice_id}`);
      return;
    }
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

  const pendingColumns = [
    { key: 'id', header: 'ID' },
    { key: 'delivery_date', header: '納品日' },
    { key: 'customer_id', header: '取引先', render: (r: any) => customerName(r.customer_id) },
    { key: 'status', header: '状態' },
    { key: 'notes', header: '備考' }
  ];

  const invoicedColumns = [
    { key: 'id', header: 'ID' },
    { key: 'delivery_date', header: '納品日' },
    { key: 'customer_id', header: '取引先', render: (r: any) => customerName(r.customer_id) },
    { key: 'invoice_no', header: '請求書No', render: (r: any) => r.invoice_no ?? '' },
    { key: 'invoice_issue_date', header: '請求書発行日', render: (r: any) => r.invoice_issue_date ?? '' }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">納品書</h1>
        <div className="flex gap-2">
          {tab === 'pending' && (
            <SecondaryButton onClick={aggregate}>選択した納品から請求書作成</SecondaryButton>
          )}
          <Button onClick={openNew}>新規</Button>
        </div>
      </div>

      <div className="flex gap-2 border-b mb-4">
        <button
          className={`px-4 py-2 text-sm ${tab === 'pending' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`}
          onClick={() => { setTab('pending'); setSelected([]); }}>請求書未作成</button>
        <button
          className={`px-4 py-2 text-sm ${tab === 'invoiced' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`}
          onClick={() => { setTab('invoiced'); setSelected([]); }}>請求書作成済み</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
        <FormField label="取引先フィルタ">
          <Select value={filterCustomerId === '' ? '' : String(filterCustomerId)} onChange={e => setFilterCustomerId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">（全て）</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="納品日 From"><Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} /></FormField>
        <FormField label="納品日 To"><Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} /></FormField>
        <div className="flex items-end">
          <SecondaryButton onClick={() => { setFilterCustomerId(''); setFilterDateFrom(''); setFilterDateTo(''); }}>クリア</SecondaryButton>
        </div>
      </div>

      {tab === 'pending' ? (
        <DataTable rows={rows} getRowKey={r => r.id} onRowClick={openEdit}
          selectable selectedIds={selected} onSelectionChange={setSelected}
          columns={pendingColumns} />
      ) : (
        <DataTable rows={rows} getRowKey={r => r.id} onRowClick={openEdit}
          columns={invoicedColumns} />
      )}

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
