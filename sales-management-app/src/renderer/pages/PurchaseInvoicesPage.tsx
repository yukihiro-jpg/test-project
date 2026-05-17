import { useEffect, useRef, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PdfParseConfirmModal from '../components/PdfParseConfirmModal';
import { Button, DangerButton, FormField, Input, Select, SecondaryButton } from '../components/FormField';
import { showError, showInfo } from '../components/toast';

interface Line { product_id?: number | null; description: string; quantity: number; unit_price: number; tax_rate: number; purchase_date?: string | null }

export default function PurchaseInvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [parsed, setParsed] = useState<any | null>(null);
  const [parseOpen, setParseOpen] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => Promise.all([
    window.api.purchaseInvoices.list().then(setRows),
    window.api.suppliers.list().then(setSuppliers),
    window.api.products.list().then(setProducts)
  ]);
  useEffect(() => { load(); }, []);

  const openNew = () => setEdit({
    invoice_no: '', supplier_id: suppliers[0]?.id ?? 0,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10), status: 'issued',
    lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 10 }]
  });
  const openEdit = async (r: any) => setEdit(await window.api.purchaseInvoices.get(r.id));
  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.purchaseInvoices.update(edit.id, edit);
    else await window.api.purchaseInvoices.create(edit);
    setEdit(null); load();
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.purchaseInvoices.delete(edit.id);
    setEdit(null); load();
  };

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    setPendingPdf(buf);
    setParseOpen(true); setParsed(null);
    try {
      const result = await window.api.purchaseInvoices.parsePdf(buf);
      setParsed(result);
    } catch (err: any) {
      setParseOpen(false);
      setPendingPdf(null);
      if (err?.code === 'NO_API_KEY' || /API ?キー/.test(err?.message ?? '')) {
        alert('設定画面で Gemini API キーを登録してください');
      } else {
        showError(err);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const updLine = (i: number, patch: Partial<Line>) =>
    setEdit((ed: any) => ({ ...ed, lines: ed.lines.map((l: Line, idx: number) => idx === i ? { ...l, ...patch } : l) }));
  const addLine = () => setEdit((ed: any) => ({ ...ed, lines: [...ed.lines, { description: '', quantity: 1, unit_price: 0, tax_rate: 10 }] }));
  const delLine = (i: number) => setEdit((ed: any) => ({ ...ed, lines: ed.lines.filter((_: any, idx: number) => idx !== i) }));
  const supplierName = (id: number) => suppliers.find(s => s.id === id)?.name ?? '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">買掛・仕入請求書</h1>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => fileRef.current?.click()}>PDFアップロード（自動解析）</SecondaryButton>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={uploadPdf} />
          <Button onClick={openNew}>新規</Button>
        </div>
      </div>
      <DataTable rows={rows} getRowKey={r => r.id} onRowClick={openEdit}
        columns={[
          { key: 'invoice_no', header: '請求書番号' },
          { key: 'issue_date', header: '発行日' },
          { key: 'due_date', header: '支払予定日' },
          { key: 'supplier_id', header: '仕入先', render: r => supplierName(r.supplier_id) },
          { key: 'total_inc_tax', header: '合計', render: r => r.total_inc_tax?.toLocaleString() },
          { key: 'status', header: '状態' }
        ]} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '仕入請求書編集' : '新規仕入請求書'} widthClass="max-w-4xl">
        {edit && (
          <div>
            <div className="grid grid-cols-4 gap-2">
              <FormField label="請求書番号"><Input value={edit.invoice_no} onChange={e => setEdit({ ...edit, invoice_no: e.target.value })} /></FormField>
              <FormField label="仕入先">
                <Select value={edit.supplier_id} onChange={e => setEdit({ ...edit, supplier_id: Number(e.target.value) })}>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </FormField>
              <FormField label="発行日"><Input type="date" value={edit.issue_date} onChange={e => setEdit({ ...edit, issue_date: e.target.value })} /></FormField>
              <FormField label="支払予定日"><Input type="date" value={edit.due_date} onChange={e => setEdit({ ...edit, due_date: e.target.value })} /></FormField>
            </div>
            <FormField label="状態">
              <Select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                <option value="draft">下書き</option><option value="issued">発行</option>
                <option value="partially_paid">一部支払</option><option value="paid">支払済</option><option value="void">無効</option>
              </Select>
            </FormField>
            <table className="w-full text-sm border mt-2">
              <thead className="bg-gray-100"><tr><th>品名</th><th>数量</th><th>単価</th><th>税率</th><th>仕入日</th><th></th></tr></thead>
              <tbody>
                {(edit.lines ?? []).map((l: Line, i: number) => (
                  <tr key={i} className="border-t">
                    <td><Input value={l.description} onChange={e => updLine(i, { description: e.target.value })} /></td>
                    <td><Input type="number" value={l.quantity} onChange={e => updLine(i, { quantity: Number(e.target.value) })} /></td>
                    <td><Input type="number" value={l.unit_price} onChange={e => updLine(i, { unit_price: Number(e.target.value) })} /></td>
                    <td>
                      <Select value={l.tax_rate} onChange={e => updLine(i, { tax_rate: Number(e.target.value) })}>
                        <option value={10}>10%</option><option value={8}>8%</option>
                      </Select>
                    </td>
                    <td><Input type="date" value={l.purchase_date ?? ''} onChange={e => updLine(i, { purchase_date: e.target.value })} /></td>
                    <td><button className="text-red-600" onClick={() => delLine(i)}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SecondaryButton onClick={addLine} className="mt-2">行を追加</SecondaryButton>
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

      <PdfParseConfirmModal
        open={parseOpen}
        onClose={() => { setParseOpen(false); setPendingPdf(null); }}
        parsed={parsed}
        suppliers={suppliers}
        onSave={async (data) => {
          try {
            // Auto-create missing products by name.
            const lines = [];
            for (const l of data.lines) {
              let prod = products.find(p => p.name === l.product_name);
              if (!prod && l.product_name) {
                prod = await window.api.products.getOrCreateByName(l.product_name, { purchase_unit_price: l.unit_price, tax_rate: l.tax_rate });
              }
              lines.push({ product_id: prod?.id ?? null, description: l.product_name, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, purchase_date: l.purchase_date });
            }
            const inv = await window.api.purchaseInvoices.create({
              invoice_no: data.invoice_no,
              supplier_id: data.supplier_id,
              issue_date: data.issue_date,
              due_date: data.due_date,
              status: 'issued',
              lines
            });
            if (pendingPdf && inv?.id) {
              try { await window.api.purchaseInvoices.savePdfFile(pendingPdf, inv.id); } catch { /* ignore */ }
            }
            setParseOpen(false); setParsed(null); setPendingPdf(null);
            showInfo('仕入請求書を取り込みました: ' + (inv?.invoice_no ?? ''));
            load();
          } catch (e: any) {
            showError(e);
          }
        }}
      />
    </div>
  );
}
