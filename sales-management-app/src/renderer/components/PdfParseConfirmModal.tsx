import { useState, useEffect } from 'react';
import Modal from './Modal';
import { Button, SecondaryButton, Input, Select, FormField } from './FormField';

interface ParsedLine {
  product_name: string;
  quantity: number;
  unit_price: number;
  purchase_date?: string;
  tax_rate: number;
}
interface Parsed {
  supplier_name: string;
  invoice_no: string;
  issue_date: string;
  due_date?: string;
  lines: ParsedLine[];
}

export default function PdfParseConfirmModal({ open, onClose, parsed, suppliers, onSave }: {
  open: boolean;
  onClose: () => void;
  parsed: Parsed | null;
  suppliers: Array<{ id: number; name: string }>;
  onSave: (data: { supplier_id: number; invoice_no: string; issue_date: string; due_date: string; lines: ParsedLine[] }) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [invNo, setInvNo] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<ParsedLine[]>([]);

  useEffect(() => {
    if (!parsed) return;
    setInvNo(parsed.invoice_no);
    setIssueDate(parsed.issue_date);
    setDueDate(parsed.due_date ?? parsed.issue_date);
    setLines(parsed.lines);
    const match = suppliers.find(s => s.name === parsed.supplier_name);
    setSupplierId(match?.id ?? suppliers[0]?.id ?? null);
  }, [parsed, suppliers]);

  const updLine = (i: number, patch: Partial<ParsedLine>) => {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };
  const addLine = () => setLines(ls => [...ls, { product_name: '', quantity: 1, unit_price: 0, tax_rate: 10 }]);
  const delLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!supplierId) { alert('仕入先を選択してください'); return; }
    await onSave({ supplier_id: supplierId, invoice_no: invNo, issue_date: issueDate, due_date: dueDate, lines });
  };

  return (
    <Modal open={open} onClose={onClose} title="PDF解析結果の確認" widthClass="max-w-4xl">
      {parsed ? (
        <div className="space-y-2">
          <FormField label="仕入先">
            <Select value={supplierId ?? ''} onChange={e => setSupplierId(Number(e.target.value))}>
              <option value="">（選択）</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="請求書番号"><Input value={invNo} onChange={e => setInvNo(e.target.value)} /></FormField>
            <FormField label="発行日"><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></FormField>
            <FormField label="支払予定日"><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></FormField>
          </div>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1">品名</th><th>数量</th><th>単価</th><th>税率</th><th>仕入日</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td><Input value={l.product_name} onChange={e => updLine(i, { product_name: e.target.value })} /></td>
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
          <SecondaryButton onClick={addLine}>行を追加</SecondaryButton>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={onClose}>キャンセル</SecondaryButton>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      ) : <div>解析中...</div>}
    </Modal>
  );
}
