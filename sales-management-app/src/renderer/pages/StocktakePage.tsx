import { Button } from '../components/FormField';
import { useState } from 'react';

export default function StocktakePage() {
  const [msg, setMsg] = useState<string>('');
  const dl = async () => {
    setMsg('生成中...');
    try {
      const p = await window.api.inventory.generateStocktakeExcel();
      setMsg(p ? `保存しました: ${p}` : 'キャンセルされました');
    } catch (e: any) { setMsg('エラー: ' + e.message); }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">棚卸表</h1>
      <p className="mb-4 text-sm text-gray-600">商品マスタと最新の仕入実績を元に、棚卸用Excelテンプレートを出力します。</p>
      <Button onClick={dl}>Excelをダウンロード</Button>
      {msg && <div className="mt-2 text-sm">{msg}</div>}
    </div>
  );
}
