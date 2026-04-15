/**
 * 文字コード判定・変換ユーティリティ
 *
 * MJS会計大将のCSVは Shift-JIS で出力されるため、
 * アップロード時に文字コードを判定して UTF-8 に変換する必要があります。
 */

import chardet from 'chardet'
import iconv from 'iconv-lite'

/**
 * バッファの文字コードを判定して UTF-8 文字列に変換する
 * @param buffer ファイルのバイナリデータ
 * @returns UTF-8 に変換された文字列
 */
export function decodeBuffer(buffer: Buffer): string {
  const detected = chardet.detect(buffer)

  // BOM付き UTF-8 は BOM を除去
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString('utf-8')
  }

  // 判定結果に応じて変換
  switch (detected) {
    case 'UTF-8':
      return buffer.toString('utf-8')
    case 'Shift_JIS':
    case 'SHIFT_JIS':
    case 'windows-31j':
    case 'CP932':
      return iconv.decode(buffer, 'shift_jis')
    case 'EUC-JP':
      return iconv.decode(buffer, 'euc-jp')
    default:
      // デフォルトは Shift-JIS とみなす（MJS出力の一般的なケース）
      return iconv.decode(buffer, 'shift_jis')
  }
}
