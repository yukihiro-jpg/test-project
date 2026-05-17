import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import { Button, FormField, Input, Select, SecondaryButton } from '../components/FormField';
import { showError, showInfo } from '../components/toast';

type TabKey = 'receipt' | 'payment' | 'offset';

interface Alloc {
  invoice_type: 'sales' | 'purchase';
  invoice_id: number;
  allocated_amount: number;
  adjustment_amount: number;
  adjustment_reason: string;
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<TabKey>('receipt');
  const [rows, setRows] = useState<any[]>([]);
  const [offsetRows, setOffsetRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [arRows, setArRows] = useState<any[]>([]);
  const [apRows, setApRows] = useState<any[]>([]);

  // Receipt form state
  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recBank, setRecBank] = useState<number | ''>('');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recCustomerId, setRecCustomerId] = useState<number | ''>('');
  const [recMemo, setRecMemo] = useState('');
  const [recAllocs, setRecAllocs] = useState<Alloc[]>([]);

  // Payment form state
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payBank, setPayBank] = useState<number | ''>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paySupplierId, setPaySupplierId] = useState<number | ''>('');
  const [payMemo, setPayMemo] = useState('');
  const [payAllocs, setPayAllocs] = useState<Alloc[]>([]);

  // Offset form state
  const [offDate, setOffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [offCounterpartyName, setOffCounterpartyName] = useState<string>('');
  const [offSalesInvId, setOffSalesInvId] = useState<number | ''>('');
  const [offPurchaseInvId, setOffPurchaseInvId] = useState<number | ''>('');
  const [offAmount, setOffAmount] = useState<number>(0);
  const [offMemo, setOffMemo] = useState('');

  const load = () => Promise.all([
    window.api.payments.list().then(setRows),
    window.api.payments.listOffsets().then(setOffsetRows),
    window.api.customers.list().then(setCustomers),
    window.api.suppliers.list().then(setSuppliers),
    window.api.bankAccounts.list().then(setBanks),
    window.api.salesInvoices.list().then(setSalesInvoices),
    window.api.purchaseInvoices.list().then(setPurchaseInvoices),
    window.api.arAging.getReceivablesAsOf(new Date().toISOString().slice(0, 10)).then((r: any) => setArRows(r.rows ?? [])),
    window.api.apAging.getPayablesAsOf(new Date().toISOString().slice(0, 10)).then((r: any) => setApRows(r.rows ?? []))
  ]);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (recBank === '' && banks[0]) setRecBank(banks[0].id);
    if (payBank === '' && banks[0]) setPayBank(banks[0].id);
  }, [banks]); // eslint-disable-line

  // Sales invoices with outstanding for selected customer
  const recCandidates = useMemo(() => {
    if (recCustomerId === '') return [];
    return arRows.filter((r: any) => r.customer_id === Number(recCustomerId))
      .map((r: any) => {
        const inv = salesInvoices.find((i: any) => i.id === r.invoice_id);
        return {
          invoice_id: r.invoice_id,
          invoice_no: r.invoice_no,
          issue_date: inv?.issue_date,
          due_date: r.due_date,
          total_inc_tax: r.total_inc_tax,
          outstanding: r.outstanding
        };
      });
  }, [recCustomerId, arRows, salesInvoices]);

  const payCandidates = useMemo(() => {
    if (paySupplierId === '') return [];
    return apRows.filter((r: any) => r.supplier_id === Number(paySupplierId))
      .map((r: any) => {
        const inv = purchaseInvoices.find((i: any) => i.id === r.invoice_id);
        return {
          invoice_id: r.invoice_id,
          invoice_no: r.invoice_no,
          issue_date: inv?.issue_date,
          due_date: r.due_date,
          total_inc_tax: r.total_inc_tax,
          outstanding: r.outstanding
        };
      });
  }, [paySupplierId, apRows, purchaseInvoices]);

  const upsertAlloc = (
    setter: (fn: (prev: Alloc[]) => Alloc[]) => void,
    invoiceType: 'sales' | 'purchase',
    invoiceId: number,
    patch: Partial<Alloc>
  ) => {
    setter(prev => {
      const idx = prev.findIndex(a => a.invoice_id === invoiceId && a.invoice_type === invoiceType);
      if (idx === -1) {
        return [...prev, { invoice_type: invoiceType, invoice_id: invoiceId, allocated_amount: 0, adjustment_amount: 0, adjustment_reason: '', ...patch }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const allocOf = (list: Alloc[], invoiceType: 'sales' | 'purchase', invoiceId: number): Alloc | undefined =>
    list.find(a => a.invoice_id === invoiceId && a.invoice_type === invoiceType);

  const autoAllocate = (type: 'receipt' | 'payment') => {
    if (type === 'receipt') {
      let remain = recAmount;
      const allocs: Alloc[] = [];
      for (const c of recCandidates) {
        if (remain <= 0) break;
        const take = Math.min(remain, c.outstanding);
        if (take > 0) {
          allocs.push({ invoice_type: 'sales', invoice_id: c.invoice_id, allocated_amount: take, adjustment_amount: 0, adjustment_reason: '' });
          remain -= take;
        }
      }
      setRecAllocs(allocs);
    } else {
      let remain = payAmount;
      const allocs: Alloc[] = [];
      for (const c of payCandidates) {
        if (remain <= 0) break;
        const take = Math.min(remain, c.outstanding);
        if (take > 0) {
          allocs.push({ invoice_type: 'purchase', invoice_id: c.invoice_id, allocated_amount: take, adjustment_amount: 0, adjustment_reason: '' });
          remain -= take;
        }
      }
      setPayAllocs(allocs);
    }
  };

  const saveReceipt = async () => {
    try {
      if (!recCustomerId) { showInfo('取引先を選択してください'); return; }
      const input = {
        type: 'receipt',
        date: recDate,
        amount: recAmount,
        bank_account_id: recBank === '' ? null : recBank,
        counterparty_type: 'customer',
        counterparty_id: Number(recCustomerId),
        memo: recMemo,
        allocations: recAllocs.filter(a => (a.allocated_amount ?? 0) > 0 || (a.adjustment_amount ?? 0) > 0)
          .map(a => ({ ...a, adjustment_reason: a.adjustment_reason || null }))
      };
      await window.api.payments.create(input);
      setRecAllocs([]); setRecAmount(0); setRecMemo('');
      showInfo('入金を登録しました');
      load();
    } catch (e: any) { showError(e); }
  };

  const savePayment = async () => {
    try {
      if (!paySupplierId) { showInfo('仕入先を選択してください'); return; }
      const input = {
        type: 'payment',
        date: payDate,
        amount: payAmount,
        bank_account_id: payBank === '' ? null : payBank,
        counterparty_type: 'supplier',
        counterparty_id: Number(paySupplierId),
        memo: payMemo,
        allocations: payAllocs.filter(a => (a.allocated_amount ?? 0) > 0 || (a.adjustment_amount ?? 0) > 0)
          .map(a => ({ ...a, adjustment_reason: a.adjustment_reason || null }))
      };
      await window.api.payments.create(input);
      setPayAllocs([]); setPayAmount(0); setPayMemo('');
      showInfo('出金を登録しました');
      load();
    } catch (e: any) { showError(e); }
  };

  const saveOffset = async () => {
    try {
      if (!offSalesInvId || !offPurchaseInvId || !offAmount) { showInfo('入力が不足しています'); return; }
      await window.api.payments.createOffset({
        date: offDate,
        sales_invoice_id: Number(offSalesInvId),
        purchase_invoice_id: Number(offPurchaseInvId),
        amount: offAmount,
        memo: offMemo
      });
      setOffSalesInvId(''); setOffPurchaseInvId(''); setOffAmount(0); setOffMemo('');
      showInfo('相殺を登録しました');
      load();
    } catch (e: any) { showError(e); }
  };

  const delPayment = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    try { await window.api.payments.delete(id); load(); } catch (e: any) { showError(e); }
  };

  const delOffset = async (id: number) => {
    if (!confirm('相殺を削除しますか？')) return;
    try { await window.api.payments.removeOffset(id); load(); } catch (e: any) { showError(e); }
  };

  // Matched customer/supplier for offset by name
  const offsetCounterparties = useMemo(() => {
    const set = new Map<string, { customer?: any; supplier?: any }>();
    for (const c of customers) {
      const e = set.get(c.name) ?? {};
      e.customer = c;
      set.set(c.name, e);
    }
    for (const s of suppliers) {
      const e = set.get(s.name) ?? {};
      e.supplier = s;
      set.set(s.name, e);
    }
    return Array.from(set.entries()).map(([name, v]) => ({ name, ...v }));
  }, [customers, suppliers]);

  const offCp = offsetCounterparties.find(c => c.name === offCounterpartyName);
  const offSalesCandidates = useMemo(() => {
    if (!offCp?.customer) return [];
    return arRows.filter(r => r.customer_id === offCp.customer.id);
  }, [offCp, arRows]);
  const offPurchaseCandidates = useMemo(() => {
    if (!offCp?.supplier) return [];
    return apRows.filter(r => r.supplier_id === offCp.supplier.id);
  }, [offCp, apRows]);

  // When sales+purchase chosen, default amount = min(outstanding)
  useEffect(() => {
    if (offSalesInvId && offPurchaseInvId) {
      const s = offSalesCandidates.find(r => r.invoice_id === Number(offSalesInvId));
      const p = offPurchaseCandidates.find(r => r.invoice_id === Number(offPurchaseInvId));
      if (s && p) setOffAmount(Math.min(s.outstanding, p.outstanding));
    }
  }, [offSalesInvId, offPurchaseInvId, offSalesCandidates, offPurchaseCandidates]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">入出金 / 消込</h1>
      <div className="flex gap-2 border-b mb-4">
        <button className={`px-4 py-2 text-sm ${tab === 'receipt' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('receipt')}>入金登録</button>
        <button className={`px-4 py-2 text-sm ${tab === 'payment' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('payment')}>出金登録</button>
        <button className={`px-4 py-2 text-sm ${tab === 'offset' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('offset')}>相殺消込</button>
      </div>

      {tab === 'receipt' && (
        <div className="bg-white border rounded p-4 mb-4">
          <div className="grid grid-cols-4 gap-2">
            <FormField label="入金日"><Input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} /></FormField>
            <FormField label="入金口座">
              <Select value={recBank === '' ? '' : String(recBank)} onChange={e => setRecBank(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">（未指定）</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
            <FormField label="入金額"><Input type="number" value={recAmount} onChange={e => setRecAmount(Number(e.target.value))} /></FormField>
            <FormField label="取引先">
              <Select value={recCustomerId === '' ? '' : String(recCustomerId)} onChange={e => { setRecCustomerId(e.target.value === '' ? '' : Number(e.target.value)); setRecAllocs([]); }}>
                <option value="">（選択）</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="メモ"><Input value={recMemo} onChange={e => setRecMemo(e.target.value)} /></FormField>

          <div className="flex items-center justify-between mt-3 mb-2">
            <h3 className="font-semibold">未消込売上請求書</h3>
            <SecondaryButton onClick={() => autoAllocate('receipt')}>残額自動割当</SecondaryButton>
          </div>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">請求書No</th>
                <th className="px-2 py-1 text-left">発行日</th>
                <th className="px-2 py-1 text-left">入金予定日</th>
                <th className="px-2 py-1 text-right">合計</th>
                <th className="px-2 py-1 text-right">残額</th>
                <th className="px-2 py-1">消込額</th>
                <th className="px-2 py-1">差引額</th>
                <th className="px-2 py-1">差引理由</th>
              </tr>
            </thead>
            <tbody>
              {!recCandidates.length && <tr><td colSpan={8} className="px-2 py-3 text-center text-gray-500">未消込の売上請求書はありません</td></tr>}
              {recCandidates.map(c => {
                const a = allocOf(recAllocs, 'sales', c.invoice_id);
                return (
                  <tr key={c.invoice_id} className="border-t">
                    <td className="px-2 py-1">{c.invoice_no}</td>
                    <td className="px-2 py-1">{c.issue_date ?? ''}</td>
                    <td className="px-2 py-1">{c.due_date}</td>
                    <td className="px-2 py-1 text-right">{c.total_inc_tax.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{c.outstanding.toLocaleString()}</td>
                    <td className="px-2 py-1"><Input type="number" value={a?.allocated_amount ?? 0} onChange={e => upsertAlloc(setRecAllocs, 'sales', c.invoice_id, { allocated_amount: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input type="number" value={a?.adjustment_amount ?? 0} onChange={e => upsertAlloc(setRecAllocs, 'sales', c.invoice_id, { adjustment_amount: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input value={a?.adjustment_reason ?? ''} onChange={e => upsertAlloc(setRecAllocs, 'sales', c.invoice_id, { adjustment_reason: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-end mt-3"><Button onClick={saveReceipt}>保存</Button></div>
        </div>
      )}

      {tab === 'payment' && (
        <div className="bg-white border rounded p-4 mb-4">
          <div className="grid grid-cols-4 gap-2">
            <FormField label="出金日"><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></FormField>
            <FormField label="出金口座">
              <Select value={payBank === '' ? '' : String(payBank)} onChange={e => setPayBank(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">（未指定）</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
            <FormField label="出金額"><Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></FormField>
            <FormField label="仕入先">
              <Select value={paySupplierId === '' ? '' : String(paySupplierId)} onChange={e => { setPaySupplierId(e.target.value === '' ? '' : Number(e.target.value)); setPayAllocs([]); }}>
                <option value="">（選択）</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="メモ"><Input value={payMemo} onChange={e => setPayMemo(e.target.value)} /></FormField>

          <div className="flex items-center justify-between mt-3 mb-2">
            <h3 className="font-semibold">未消込仕入請求書</h3>
            <SecondaryButton onClick={() => autoAllocate('payment')}>残額自動割当</SecondaryButton>
          </div>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">請求書No</th>
                <th className="px-2 py-1 text-left">発行日</th>
                <th className="px-2 py-1 text-left">支払予定日</th>
                <th className="px-2 py-1 text-right">合計</th>
                <th className="px-2 py-1 text-right">残額</th>
                <th className="px-2 py-1">消込額</th>
                <th className="px-2 py-1">差引額</th>
                <th className="px-2 py-1">差引理由</th>
              </tr>
            </thead>
            <tbody>
              {!payCandidates.length && <tr><td colSpan={8} className="px-2 py-3 text-center text-gray-500">未消込の仕入請求書はありません</td></tr>}
              {payCandidates.map(c => {
                const a = allocOf(payAllocs, 'purchase', c.invoice_id);
                return (
                  <tr key={c.invoice_id} className="border-t">
                    <td className="px-2 py-1">{c.invoice_no}</td>
                    <td className="px-2 py-1">{c.issue_date ?? ''}</td>
                    <td className="px-2 py-1">{c.due_date}</td>
                    <td className="px-2 py-1 text-right">{c.total_inc_tax.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{c.outstanding.toLocaleString()}</td>
                    <td className="px-2 py-1"><Input type="number" value={a?.allocated_amount ?? 0} onChange={e => upsertAlloc(setPayAllocs, 'purchase', c.invoice_id, { allocated_amount: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input type="number" value={a?.adjustment_amount ?? 0} onChange={e => upsertAlloc(setPayAllocs, 'purchase', c.invoice_id, { adjustment_amount: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input value={a?.adjustment_reason ?? ''} onChange={e => upsertAlloc(setPayAllocs, 'purchase', c.invoice_id, { adjustment_reason: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-end mt-3"><Button onClick={savePayment}>保存</Button></div>
        </div>
      )}

      {tab === 'offset' && (
        <div className="bg-white border rounded p-4 mb-4">
          <div className="grid grid-cols-3 gap-2">
            <FormField label="相殺日"><Input type="date" value={offDate} onChange={e => setOffDate(e.target.value)} /></FormField>
            <FormField label="取引先（同名で売上・仕入が紐付けられます）">
              <Select value={offCounterpartyName} onChange={e => { setOffCounterpartyName(e.target.value); setOffSalesInvId(''); setOffPurchaseInvId(''); }}>
                <option value="">（選択）</option>
                {offsetCounterparties.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}{c.customer ? '（顧客）' : ''}{c.supplier ? '（仕入先）' : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="相殺金額"><Input type="number" value={offAmount} onChange={e => setOffAmount(Number(e.target.value))} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="売上請求書">
              <Select value={offSalesInvId === '' ? '' : String(offSalesInvId)} onChange={e => setOffSalesInvId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">（選択）</option>
                {offSalesCandidates.map(r => <option key={r.invoice_id} value={r.invoice_id}>{r.invoice_no} 残額 {r.outstanding.toLocaleString()}</option>)}
              </Select>
            </FormField>
            <FormField label="仕入請求書">
              <Select value={offPurchaseInvId === '' ? '' : String(offPurchaseInvId)} onChange={e => setOffPurchaseInvId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">（選択）</option>
                {offPurchaseCandidates.map(r => <option key={r.invoice_id} value={r.invoice_id}>{r.invoice_no} 残額 {r.outstanding.toLocaleString()}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="メモ"><Input value={offMemo} onChange={e => setOffMemo(e.target.value)} /></FormField>
          <div className="flex justify-end mt-3"><Button onClick={saveOffset}>相殺を保存</Button></div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">相殺履歴</h3>
            <DataTable rows={offsetRows} getRowKey={r => r.id} columns={[
              { key: 'date', header: '日付' },
              { key: 'sales_invoice_id', header: '売上請求書ID' },
              { key: 'purchase_invoice_id', header: '仕入請求書ID' },
              { key: 'amount', header: '金額', render: r => r.amount?.toLocaleString() },
              { key: 'memo', header: 'メモ' },
              { key: 'del', header: '削除', render: r => <button className="text-red-600" onClick={() => delOffset(r.id)}>削除</button> }
            ]} />
          </div>
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-2 mt-6">入出金履歴</h2>
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
            { key: 'del', header: '削除', render: r => <button className="text-red-600" onClick={() => delPayment(r.id)}>削除</button> }
          ]} />
      </section>
    </div>
  );
}
