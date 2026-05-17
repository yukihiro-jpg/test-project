import { useEffect, useState } from 'react';
import { Button, DangerButton, FormField, Input, SecondaryButton, Select } from '../components/FormField';
import Modal from '../components/Modal';
import { showError } from '../components/toast';

export default function SettingsPage() {
  const [company, setCompany] = useState({ name: '', postal_code: '', address: '', phone: '', registered_invoice_no: '' });
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankEdit, setBankEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const all = await window.api.settings.getAll();
    setCompany({
      name: all.company_name ?? '',
      postal_code: all.company_postal_code ?? '',
      address: all.company_address ?? '',
      phone: all.company_phone ?? '',
      registered_invoice_no: all.registered_invoice_no ?? all.company_registered_invoice_no ?? ''
    });
    setApiKeySet(all.gemini_api_key === '***SET***');
    setBanks(await window.api.bankAccounts.list());
  };
  useEffect(() => { load(); }, []);

  const saveCompany = async () => {
    try {
      await window.api.settings.set('company_name', company.name);
      await window.api.settings.set('company_postal_code', company.postal_code);
      await window.api.settings.set('company_address', company.address);
      await window.api.settings.set('company_phone', company.phone);
      // Write to both the historical key (used by sales PDF generator) and the spec key for compatibility.
      await window.api.settings.set('registered_invoice_no', company.registered_invoice_no);
      await window.api.settings.set('company_registered_invoice_no', company.registered_invoice_no);
      setMsg('会社情報を保存しました');
    } catch (e: any) { showError(e); }
  };
  const saveApiKey = async () => {
    if (!apiKey) return;
    await window.api.settings.set('gemini_api_key', apiKey);
    setApiKey(''); setApiKeySet(true);
    setMsg('Gemini APIキーを保存しました（暗号化）');
  };
  const saveBank = async () => {
    if (!bankEdit) return;
    if (bankEdit.id) await window.api.bankAccounts.update(bankEdit.id, bankEdit);
    else await window.api.bankAccounts.create(bankEdit);
    setBankEdit(null); load();
  };
  const delBank = async () => {
    if (!bankEdit?.id) return;
    if (!confirm('削除しますか？')) return;
    await window.api.bankAccounts.delete(bankEdit.id);
    setBankEdit(null); load();
  };

  const exportBackup = async () => {
    try {
      const p = await window.api.backup.exportAll();
      if (p) setMsg('バックアップを保存しました: ' + p);
    } catch (e: any) { showError(e); }
  };
  const restoreBackup = async () => {
    if (!confirm('現在のデータが上書きされます。続行しますか？')) return;
    try {
      const m = await window.api.backup.restoreFromZip();
      if (m) setMsg(m);
    } catch (e: any) { showError(e); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">設定</h1>
      {msg && <div className="mb-4 p-2 bg-green-50 border border-green-300 rounded text-sm">{msg}</div>}

      <section className="mb-6">
        <h2 className="font-semibold mb-2">会社情報</h2>
        <FormField label="会社名"><Input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} /></FormField>
        <FormField label="郵便番号"><Input value={company.postal_code} onChange={e => setCompany({ ...company, postal_code: e.target.value })} /></FormField>
        <FormField label="住所"><Input value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} /></FormField>
        <FormField label="電話"><Input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} /></FormField>
        <FormField label="適格請求書番号"><Input value={company.registered_invoice_no} onChange={e => setCompany({ ...company, registered_invoice_no: e.target.value })} /></FormField>
        <Button onClick={saveCompany}>保存</Button>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Gemini APIキー {apiKeySet && <span className="ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">設定済み</span>}</h2>
        <p className="text-sm text-gray-600 mb-2">仕入請求書PDFの自動解析に使用します。安全な保管領域に暗号化して保存します。</p>
        <FormField label={apiKeySet ? 'APIキー（再入力で上書き）' : 'APIキー'}>
          <Input type="password" placeholder={apiKeySet ? '（保存済み・伏字）' : ''} value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </FormField>
        <Button onClick={saveApiKey} disabled={!apiKey}>保存</Button>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">銀行口座</h2>
        <table className="w-full text-sm border mb-2">
          <thead className="bg-gray-100"><tr><th>名称</th><th>銀行</th><th>支店</th><th>口座番号</th><th>期首残高</th><th>既定</th></tr></thead>
          <tbody>
            {!banks.length && (
              <tr><td colSpan={6} className="px-2 py-4 text-center text-gray-500">銀行口座が登録されていません</td></tr>
            )}
            {banks.map(b => (
              <tr key={b.id} className="border-t cursor-pointer hover:bg-blue-50" onClick={() => setBankEdit({ ...b })}>
                <td className="px-2">{b.name}</td><td className="px-2">{b.bank_name}</td><td className="px-2">{b.branch_name}</td>
                <td className="px-2">{b.account_number}</td><td className="px-2 text-right">{b.opening_balance?.toLocaleString()}</td>
                <td className="px-2 text-center">{b.is_default ? '●' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button onClick={() => setBankEdit({ name: '', opening_balance: 0, is_default: 0 })}>新規口座</Button>
      </section>

      <section>
        <h2 className="font-semibold mb-2">バックアップ</h2>
        <div className="flex gap-2">
          <Button onClick={exportBackup}>バックアップ作成</Button>
          <DangerButton onClick={restoreBackup}>バックアップから復元</DangerButton>
        </div>
      </section>

      <Modal open={!!bankEdit} onClose={() => setBankEdit(null)} title={bankEdit?.id ? '口座編集' : '新規口座'}>
        {bankEdit && (
          <div>
            <FormField label="名称*"><Input value={bankEdit.name ?? ''} onChange={e => setBankEdit({ ...bankEdit, name: e.target.value })} /></FormField>
            <FormField label="銀行名"><Input value={bankEdit.bank_name ?? ''} onChange={e => setBankEdit({ ...bankEdit, bank_name: e.target.value })} /></FormField>
            <FormField label="支店名"><Input value={bankEdit.branch_name ?? ''} onChange={e => setBankEdit({ ...bankEdit, branch_name: e.target.value })} /></FormField>
            <FormField label="預金種別">
              <Select value={bankEdit.account_type ?? ''} onChange={e => setBankEdit({ ...bankEdit, account_type: e.target.value })}>
                <option value="">（選択）</option>
                <option value="普通">普通</option><option value="当座">当座</option>
              </Select>
            </FormField>
            <FormField label="口座番号"><Input value={bankEdit.account_number ?? ''} onChange={e => setBankEdit({ ...bankEdit, account_number: e.target.value })} /></FormField>
            <FormField label="期首残高"><Input type="number" value={bankEdit.opening_balance ?? 0} onChange={e => setBankEdit({ ...bankEdit, opening_balance: Number(e.target.value) })} /></FormField>
            <FormField label="期首残高日付"><Input type="date" value={bankEdit.opening_balance_date ?? ''} onChange={e => setBankEdit({ ...bankEdit, opening_balance_date: e.target.value })} /></FormField>
            <label className="block"><input type="checkbox" checked={!!bankEdit.is_default} onChange={e => setBankEdit({ ...bankEdit, is_default: e.target.checked ? 1 : 0 })} /> 既定の口座</label>
            <div className="flex justify-between mt-4">
              {bankEdit.id ? <DangerButton onClick={delBank}>削除</DangerButton> : <span />}
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setBankEdit(null)}>キャンセル</SecondaryButton>
                <Button onClick={saveBank}>保存</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
