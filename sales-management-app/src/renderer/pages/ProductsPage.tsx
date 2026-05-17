import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { Button, DangerButton, FormField, Input, Select, SecondaryButton } from '../components/FormField';
import ExcelImportButton from '../components/ExcelImportButton';

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const load = () => window.api.products.list().then(setRows);
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!edit) return;
    if (edit.id) await window.api.products.update(edit.id, edit);
    else await window.api.products.create(edit);
    setEdit(null); load();
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.products.delete(edit.id);
    setEdit(null); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">商品マスタ</h1>
        <div className="flex gap-2">
          <ExcelImportButton label="売上単価取込" onImport={buf => window.api.products.importSalesPricesFromExcel(buf).then(r => { load(); return r; })} />
          <ExcelImportButton label="仕入単価取込" onImport={buf => window.api.products.importPurchasePricesFromExcel(buf).then(r => { load(); return r; })} />
          <Button onClick={() => setEdit({ code: '', name: '', tax_rate: 10, sales_unit_price: 0, purchase_unit_price: 0 })}>新規</Button>
        </div>
      </div>
      <DataTable rows={rows} getRowKey={r => r.id} onRowClick={r => setEdit({ ...r })}
        columns={[
          { key: 'code', header: 'コード' },
          { key: 'name', header: '名称' },
          { key: 'unit', header: '単位' },
          { key: 'sales_unit_price', header: '売上単価', render: r => r.sales_unit_price?.toLocaleString() },
          { key: 'purchase_unit_price', header: '仕入単価', render: r => r.purchase_unit_price?.toLocaleString() },
          { key: 'tax_rate', header: '税率', render: r => r.tax_rate + '%' }
        ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '商品編集' : '新規商品'}>
        {edit && (
          <div>
            <FormField label="コード*"><Input value={edit.code ?? ''} onChange={e => setEdit({ ...edit, code: e.target.value })} /></FormField>
            <FormField label="名称*"><Input value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></FormField>
            <FormField label="単位"><Input value={edit.unit ?? ''} onChange={e => setEdit({ ...edit, unit: e.target.value })} /></FormField>
            <FormField label="売上単価"><Input type="number" value={edit.sales_unit_price ?? 0} onChange={e => setEdit({ ...edit, sales_unit_price: Number(e.target.value) })} /></FormField>
            <FormField label="仕入単価"><Input type="number" value={edit.purchase_unit_price ?? 0} onChange={e => setEdit({ ...edit, purchase_unit_price: Number(e.target.value) })} /></FormField>
            <FormField label="税率">
              <Select value={edit.tax_rate ?? 10} onChange={e => setEdit({ ...edit, tax_rate: Number(e.target.value) })}>
                <option value={10}>10%</option><option value={8}>8%</option>
              </Select>
            </FormField>
            <FormField label="カテゴリ"><Input value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category: e.target.value })} /></FormField>
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
