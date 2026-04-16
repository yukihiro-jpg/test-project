/**
 * 通帳の「取引内容」サジェスト用プリセット
 * カテゴリごとに分類し、ドロップダウンで選択可能にする
 */

export interface PresetCategory {
  label: string
  items: string[]
}

export const TRANSACTION_TYPE_PRESETS: PresetCategory[] = [
  {
    label: '売上関連',
    items: [
      '売上入金',
      '売掛金回収',
    ],
  },
  {
    label: '仕入・外注',
    items: [
      '仕入代金',
      '外注費',
      '買掛金支払',
    ],
  },
  {
    label: '人件費',
    items: [
      '給与',
      '賞与',
      '社会保険料',
      '源泉所得税',
      '住民税',
    ],
  },
  {
    label: '固定費',
    items: [
      '家賃・地代',
      '水道光熱費',
      '通信費',
      'リース料',
      '保険料',
    ],
  },
  {
    label: '借入関連',
    items: [
      '借入金入金',
      '借入返済',
      '利息支払',
    ],
  },
  {
    label: '税金',
    items: [
      '法人税',
      '消費税',
      '固定資産税',
      '自動車税',
    ],
  },
  {
    label: 'その他',
    items: [
      '振込手数料',
      '事務用品',
      '交通費',
      '交際費',
      '消耗品費',
      '車両費',
      '広告宣伝費',
      '修繕費',
      '福利厚生費',
      '諸会費',
      '新聞図書費',
      '雑費',
      '預金利息',
      '還付金',
      '雑収入',
    ],
  },
]

/**
 * 全プリセットをフラットなリストで取得
 */
export function getAllPresetItems(): string[] {
  return TRANSACTION_TYPE_PRESETS.flatMap((cat) => cat.items)
}

/**
 * 現金出納帳の摘要用のよく使う例
 */
export const CASH_DESCRIPTION_EXAMPLES = [
  '文房具購入',
  'タクシー代',
  '切手・印紙購入',
  '駐車場代',
  '宅配便送料',
  'コピー用紙購入',
  '会議用お茶代',
  '慶弔費',
  '売上現金入金',
  'つり銭準備',
  '銀行引出し',
  '銀行預入れ',
]
