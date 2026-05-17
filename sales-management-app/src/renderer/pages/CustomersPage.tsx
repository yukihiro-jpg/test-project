import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Button, DangerButton, FormField, Input, SecondaryButton } from '../components/FormField';
import ExcelImportButton from '../components/ExcelImportButton';

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = () => window.api.customers.list().then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.customers.update(edit.id, edit);
    else await window.api.customers.create(edit);
    setEdit(null);
    load();
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.customers.delete(edit.id);
    setEdit(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">取引先（顧客）</h1>
        <div className="flex gap-2">
          <ExcelImportButton label="Excel取込" onImport={buf => window.api.customers.importFromExcel(buf).then(r => { load(); return r; })} />
          <Button onClick={() => setEdit({ code: '', name: '' })}>新規</Button>
        </div>
      </div>
      <DataTable rows={rows} getRowKey={r => r.id} onRowClick={r => setEdit({ ...r })}
        columns={[
          { key: 'code', header: 'コード' },
          { key: 'name', header: '名称' },
          { key: 'name_kana', header: 'カナ' },
          { key: 'phone', header: '電話' },
          { key: 'registered_invoice_no', header: '適格請求書番号' }
        ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '顧客編集' : '新規顧客'}>
        {edit && (
          <div>
            <FormField label="コード*"><Input value={edit.code ?? ''} onChange={e => setEdit({ ...edit, code: e.target.value })} /></FormField>
            <FormField label="名称*"><Input value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></FormField>
            <FormField label="カナ"><Input value={edit.name_kana ?? ''} onChange={e => setEdit({ ...edit, name_kana: e.target.value })} /></FormField>
            <FormField label="郵便番号"><Input value={edit.postal_code ?? ''} onChange={e => setEdit({ ...edit, postal_code: e.target.value })} /></FormField>
            <FormField label="住所"><Input value={edit.address ?? ''} onChange={e => setEdit({ ...edit, address: e.target.value })} /></FormField>
            <FormField label="電話"><Input value={edit.phone ?? ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></FormField>
            <FormField label="メール"><Input value={edit.email ?? ''} onChange={e => setEdit({ ...edit, email: e.target.value })} /></FormField>
            <FormField label="適格請求書番号"><Input value={edit.registered_invoice_no ?? ''} onChange={e => setEdit({ ...edit, registered_invoice_no: e.target.value })} /></FormField>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="サイト日数"><Input type="number" value={edit.payment_terms_days ?? ''} onChange={e => setEdit({ ...edit, payment_terms_days: Number(e.target.value) || null })} /></FormField>
              <FormField label="締日"><Input type="number" value={edit.closing_day ?? ''} onChange={e => setEdit({ ...edit, closing_day: Number(e.target.value) || null })} /></FormField>
              <FormField label="支払日"><Input type="number" value={edit.payment_day ?? ''} onChange={e => setEdit({ ...edit, payment_day: Number(e.target.value) || null })} /></FormField>
            </div>
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
