/**
 * マイナンバー（個人番号）の妥当性検証
 *
 * マイナンバーは12桁の数字で、最後の1桁がチェックデジット。
 * 総務省告示の計算式により算出される。
 */

const WEIGHTS = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/**
 * マイナンバーが妥当な形式かを検証する
 * - 12桁の数字
 * - チェックデジットが正しい
 */
export function validateMyNumber(input: string): boolean {
  const num = input.replace(/[\s-]/g, '')

  // 12桁の数字のみ許可
  if (!/^\d{12}$/.test(num)) return false

  const digits = num.split('').map(Number)
  const checkDigit = digits[11]

  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * WEIGHTS[i]
  }

  const remainder = sum % 11
  const expected = remainder <= 1 ? 0 : 11 - remainder

  return expected === checkDigit
}

/**
 * 入力値からハイフン・空白を除去し12桁形式に正規化
 */
export function normalizeMyNumber(input: string): string {
  return input.replace(/[\s-]/g, '')
}

/**
 * 全角カタカナのみで構成されているかチェック
 * 長音記号（ー）と全角スペースも許可
 */
export function isValidFurigana(input: string): boolean {
  if (!input.trim()) return false
  return /^[ァ-ヶー　\s]+$/.test(input)
}
