export interface Client {
  id: string
  name: string
  driveFolderId: string
}

// 顧問先設定
// 新しい顧問先を追加する場合はここに追記してください
// driveFolderIdはGoogle Drive共有ドライブ内のフォルダIDです
const clients: Client[] = [
  {
    id: 'sample-company',
    name: '株式会社サンプル',
    driveFolderId: 'REPLACE_WITH_ACTUAL_FOLDER_ID',
  },
]

export function getClient(id: string): Client | undefined {
  return clients.find((c) => c.id === id)
}

export function getAllClients(): Client[] {
  return clients
}
