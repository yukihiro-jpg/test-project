import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Button, FormField, Input, Select, SecondaryButton } from '../components/FormField';
import { showError, showInfo } from '../components/toast';

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = () => Promise.all([
    window.api.payments.list().then(setRows),
    window.api.customers.list().then(setCustomers),
    window.api.suppliers.list().then(setSuppliers),
    window.api.bankAccounts.list().then(setBanks),
    window.api.salesInvoices.list().then(setSalesInvoices),
    window.api.purchaseInvoices.list().then(setPurchaseInvoices)
  ]);
  useEffect(() => { load(); }, []);

  const openNew = () => setEdit({
    type: 'receipt', date: new Date().toISOString().slice(0, 10),
    amount: 0, bank_account_id: banks[0]?.id ?? null,
    counterparty_type: 'customer', counterparty_id: null,
    memo: '', allocations: []
  });

  const candidates = () => {
    if (!edit) return [];
    if (edit.type === 'receipt') {
      return salesInvoices.filter(i => i.status !== 'paid' && i.status !== 'void' && (!edit.counterparty_id || i.customer_id === edit.counterparty_id))
        .map(i => ({ ...i, invoice_type: 'sales' as const }));
    } else {
      return purchaseInvoices.filter(i => i.status !== 'paid' && i.status !== 'void' && (!edit.counterparty_id || i.supplier_id === edit.counterparty_id))
        .map(i => ({ ...i, invoice_type: 'purchase' as const }));
    }
  };

  const setAlloc = (invId: number, invoiceType: 'sales' | 'purchase', amount: number) => {
    setEdit((ed: any) => {
      const others = ed.allocations.filter((a: any) => !(a.invoice_id === invId && a.invoice_type === invoiceType));
      if (amount > 0) others.push({ invoice_type: invoiceType, invoice_id: invId, allocated_amount: amount });
      return { ...ed, allocations: others };
    });
  };

  const allocAmount = (invId: number, invoiceType: string) => {
    return edit?.allocations.find((a: any) => a.invoice_id === invId && a.invoice_type === invoiceType)?.allocated_amount ?? 0;
  };

  const save = async () => {
    if (!edit) return;
    const allocTotal = edit.allocations.reduce((s: number, a: any) => s + a.allocated_amount, 0);
    if (allocTotal > edit.amount) { if (!confirm('割当合計が入出金額を超えています。続けますか？')) return; }
    try {
      await window.api.payments.create(edit);
      setEdit(null); load();
      showInfo('入出金を登録しました');
    } catch (e: any) { showError(e); }
  };

  const del = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    try { await window.api.payments.delete(id); load(); }
    catch (e: any) { showError(e); }
  };

  const autoAllocate = () => {
    if (!edit) return;
    let remaining = edit.amount as number;
    const allocs: any[] = [];
    for (const inv of candidates()) {
      if (remaining <= 0) break;
      const already = edit.allocations.find((a: any) => a.invoice_id === inv.id && a.invoice_type === inv.invoice_type)?.allocated_amount ?? 0;
      const outstanding = (inv.total_inc_tax as number) - already;
      const take = Math.min(remaining, Math.max(0, outstanding));
      if (take > 0) {
        allocs.push({ invoice_type: inv.invoice_type, invoice_id: inv.id, allocated_amount: take });
        remaining -= take;
      }
    }
    setEdit({ ...edit, allocations: allocs });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">入出金 / 消込</h1>
        <Button onClick={openNew}>新規入出金</Button>
      </div>
      <DataTable rows={rows} getRowKey={r => r.id}
        columns={[
          { key: 'date', header: '日付' },
          { key: 'type', header: '区分', render: r => r.type === 'receipt' ? '入金' : '出金' },
          { key: 'amount', header: '金額', render: r => r.amount?.toLocaleString() },
          { key: 'counterparty', header: '取引先', render: r => {
            const list = r.counterparty_type === 'customer' ? customers : r.counterparty_type === 'supplier' ? suppliers : [];
            return list.find((x: any) => x.id === r.counterparty_id)?.name ?? '';
          } },
          { key: 'bank', header: '銀行口座', render: r => banks.find((b: any) => b.id === r.bank_account_id)?.name ?? '' },
          { key: 'memo', header: '備考' },
          { key: 'del', header: '削除', render: r => <button className="text-red-600" onClick={() => del(r.id)}>削除</button> }
        ]} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="入出金登録" widthClass="max-w-4xl">
        {edit && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="区分">
                <Select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value, counterparty_type: e.target.value === 'receipt' ? 'customer' : 'supplier', counterparty_id: null, allocations: [] })}>
                  <option value="receipt">入金</option><option value="payment">出金</option>
                </Select>
              </FormField>
              <FormField label="日付"><Input type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} /></FormField>
              <FormField label="金額"><Input type="number" value={edit.amount} onChange={e => setEdit({ ...edit, amount: Number(e.target.value) })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label={edit.type === 'receipt' ? '顧客' : '仕入先'}>
                <Select value={edit.counterparty_id ?? ''} onChange={e => setEdit({ ...edit, counterparty_id: Number(e.target.value) || null })}>
                  <option value="">（全て）</option>
                  {(edit.type === 'receipt' ? customers : suppliers).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <FormField label="銀行口座">
                <Select value={edit.bank_account_id ?? ''} onChange={e => setEdit({ ...edit, bank_account_id: Number(e.target.value) || null })}>
                  <option value="">（未指定）</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </FormField>
            </div>
            <FormField label="メモ"><Input value={edit.memo ?? ''} onChange={e => setEdit({ ...edit, memo: e.target.value })} /></FormField>

            <div className="flex items-center justify-between mt-4 mb-2">
              <h3 className="font-semibold">消込（請求書への割当）</h3>
              <SecondaryButton onClick={autoAllocate}>残額を自動割当</SecondaryButton>
            </div>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100"><tr><th>請求書番号</th><th>発行日</th><th>合計</th><th>状態</th><th>割当額</th></tr></thead>
              <tbody>
                {!candidates().length && (
                  <tr><td colSpan={5} className="px-2 py-3 text-center text-gray-500">未払の請求書はありません</td></tr>
                )}
                {candidates().map((inv: any) => (
                  <tr key={inv.invoice_type + ':' + inv.id} className="border-t">
                    <td className="px-1">{inv.invoice_no}</td>
                    <td className="px-1">{inv.issue_date}</td>
                    <td className="px-1">{inv.total_inc_tax?.toLocaleString()}</td>
                    <td className="px-1">{inv.status}</td>
                    <td><Input type="number" value={allocAmount(inv.id, inv.invoice_type)} onChange={e => setAlloc(inv.id, inv.invoice_type, Number(e.target.value))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
