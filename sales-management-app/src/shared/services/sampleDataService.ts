import ExcelJS from 'exceljs';

// Japanese-ish realistic dummy data for construction-related sales business.

const CUSTOMER_NAMES = [
  'サンプル商事(株)', '東京建材(株)', '大阪工務店', '山田建設(株)', '富士住宅(株)',
  '青空リフォーム', '北陸建工(株)', '関東鋼業(株)', '西日本建材', '中部住宅サービス',
  '九州工務店', '東海建設(株)', '北海道資材', '湘南ハウス', '京都町家工房',
  '神戸エンジニアリング', '横浜建装(株)', '札幌ホーム(株)', '仙台木材(株)', '広島工業所',
  '名古屋鉄骨(株)', '福岡建材センター', '岡山住建', '埼玉住宅サービス', '千葉建工(株)',
  '群馬リフォーム', '長野住宅(株)', '新潟建設', '静岡工務店', '愛知住宅資材'
];

const SUPPLIER_NAMES = [
  '日本鉄鋼販売(株)', '東洋セメント', '関西木材(株)', 'マルヨシ建材', '大東金物',
  '昭和鋼材', '太平洋資材', 'カネタ木材', '富士工業', '光建材',
  'メイワ商事', 'タナカ建材', '東光産業', '三和金属(株)', '中央コンクリート',
  '日東建材', '東邦工業', '丸八商店', 'カワダ資材', '高木鋼業',
  '大成商会', '東和金属', '南海建材', 'マルイ商事', '北星セメント',
  '九州資材センター', '東邦電材', 'タイヘイ商事', '丸金建材', '昭栄産業'
];

const PRODUCT_NAMES = [
  '鉄筋φ10', '鉄筋φ13', '鉄筋φ16', 'コンクリート 1m3', 'コンクリート 2m3',
  '型枠合板 12mm', '型枠合板 15mm', '足場パイプ 2m', '足場パイプ 3m', '単管クランプ',
  'ブロック A種', 'ブロック B種', 'モルタル 25kg', 'セメント 25kg', '砂利 1袋',
  '砕石 1袋', '骨材 0号', '骨材 1号', 'アスファルト合材', '養生シート',
  '断熱材 50mm', '石膏ボード 9mm', '石膏ボード 12mm', 'サイディング外壁材', 'ルーフィング',
  '木材 杉KD 105x105', '木材 桧KD 105x105', '配筋スペーサ', '止水材', '釘 N50 1kg'
];

const TODAY = new Date();

function pad(n: number) { return n < 10 ? '0' + n : '' + n; }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randPrice() { return randInt(10, 1000) * 100; } // 1000〜100000

export async function generateCustomerSample(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('取引先');
  ws.columns = [
    { header: '取引先コード', key: 'code', width: 14 },
    { header: '取引先名', key: 'name', width: 28 },
    { header: 'カナ', key: 'kana', width: 20 },
    { header: '郵便番号', key: 'postal', width: 12 },
    { header: '住所', key: 'address', width: 36 },
    { header: '電話番号', key: 'phone', width: 16 },
    { header: 'メール', key: 'email', width: 22 },
    { header: '適格請求書番号', key: 'rin', width: 18 },
    { header: 'サイト日数', key: 'site', width: 10 },
    { header: '締日', key: 'close', width: 8 },
    { header: '支払日', key: 'pay', width: 8 }
  ];
  for (let i = 0; i < 30; i++) {
    const code = 'C' + String(i + 1).padStart(3, '0');
    const name = CUSTOMER_NAMES[i];
    ws.addRow({
      code,
      name,
      kana: '',
      postal: `${randInt(100, 999)}-${String(randInt(0, 9999)).padStart(4, '0')}`,
      address: `東京都サンプル区${i + 1}-${randInt(1, 30)}-${randInt(1, 20)}`,
      phone: `03-${String(randInt(1000, 9999))}-${String(randInt(1000, 9999))}`,
      email: `customer${i + 1}@example.com`,
      rin: `T${String(randInt(1000000000000, 9999999999999))}`,
      site: [30, 45, 60][i % 3],
      close: [20, 25, 31][i % 3],
      pay: [10, 25, 31][i % 3]
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function generateSupplierSample(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('仕入先');
  ws.columns = [
    { header: '取引先コード', key: 'code', width: 14 },
    { header: '取引先名', key: 'name', width: 28 },
    { header: 'カナ', key: 'kana', width: 20 },
    { header: '郵便番号', key: 'postal', width: 12 },
    { header: '住所', key: 'address', width: 36 },
    { header: '電話番号', key: 'phone', width: 16 },
    { header: 'メール', key: 'email', width: 22 },
    { header: '適格請求書番号', key: 'rin', width: 18 },
    { header: 'サイト日数', key: 'site', width: 10 },
    { header: '締日', key: 'close', width: 8 },
    { header: '支払日', key: 'pay', width: 8 }
  ];
  for (let i = 0; i < 30; i++) {
    const code = 'S' + String(i + 1).padStart(3, '0');
    const name = SUPPLIER_NAMES[i];
    ws.addRow({
      code,
      name,
      kana: '',
      postal: `${randInt(100, 999)}-${String(randInt(0, 9999)).padStart(4, '0')}`,
      address: `大阪府サンプル市${i + 1}-${randInt(1, 30)}-${randInt(1, 20)}`,
      phone: `06-${String(randInt(1000, 9999))}-${String(randInt(1000, 9999))}`,
      email: `supplier${i + 1}@example.com`,
      rin: `T${String(randInt(1000000000000, 9999999999999))}`,
      site: [30, 45, 60][i % 3],
      close: [20, 25, 31][i % 3],
      pay: [10, 25, 31][i % 3]
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function generateProductSample(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('商品マスタ');
  ws.columns = [
    { header: '商品コード', key: 'code', width: 14 },
    { header: '商品名', key: 'name', width: 28 },
    { header: '単位', key: 'unit', width: 8 },
    { header: '売上単価', key: 'sales_price', width: 12 },
    { header: '仕入単価', key: 'purchase_price', width: 12 },
    { header: '税率', key: 'tax', width: 6 }
  ];
  const UNITS = ['個', '本', '袋', 'm3', '枚', 'kg', 'セット'];
  for (let i = 0; i < 30; i++) {
    const code = 'P' + String(i + 1).padStart(3, '0');
    const sales = randPrice();
    const purchase = Math.round(sales * (0.55 + Math.random() * 0.25));
    ws.addRow({
      code,
      name: PRODUCT_NAMES[i],
      unit: UNITS[i % UNITS.length],
      sales_price: sales,
      purchase_price: purchase,
      tax: 10
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function generateDeliverySample(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('売上納品');
  ws.columns = [
    { header: '納品日', key: 'date', width: 12 },
    { header: '取引先コード', key: 'customer_code', width: 14 },
    { header: '商品コード', key: 'product_code', width: 14 },
    { header: '数量', key: 'qty', width: 8 },
    { header: '単価', key: 'price', width: 12 },
    { header: '備考', key: 'memo', width: 30 }
  ];
  for (let i = 0; i < 30; i++) {
    const d = new Date(TODAY.getTime() - randInt(0, 29) * 86400000);
    const custIdx = randInt(0, 29);
    const prodIdx = randInt(0, 29);
    ws.addRow({
      date: ymd(d),
      customer_code: 'C' + String(custIdx + 1).padStart(3, '0'),
      product_code: 'P' + String(prodIdx + 1).padStart(3, '0'),
      qty: randInt(1, 50),
      price: randPrice(),
      memo: ''
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
