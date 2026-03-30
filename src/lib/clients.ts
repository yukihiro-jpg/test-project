/**
 * 顧問先（法人）管理
 *
 * 顧問先情報はGoogle Driveの年度フォルダ内に _clients.json として保存される。
 * フォルダ構造: 年末調整ルート / 令和〇年度 / 法人コード_法人名 /
 */

export interface Client {
  /** 法人コード (例: "001") */
  code: string
  /** 法人名 (例: "株式会社サンプル") */
  name: string
  /** Google Drive上の法人フォルダID */
  driveFolderId: string
}

/**
 * URLパラメータ用のクライアントID
 * 法人コードをそのまま使用する
 */
export function getClientId(code: string): string {
  return code
}

/**
 * Google Driveのフォルダ名
 */
export function getClientFolderName(code: string, name: string): string {
  return `${code}_${name}`
}
