// Google Drive API連携モジュール
// クライアントサイドでOAuth2フローを使用
// データは共有ドライブの【削除禁止】相続税シミュレーターフォルダに保存

'use client';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = '【削除禁止】相続税シミュレーター';
const APP_DATA_FOLDER = 'souzoku-simulator-data';

interface GoogleAuthState {
  accessToken: string | null;
  clientId: string | null;
  initialized: boolean;
}

const authState: GoogleAuthState = {
  accessToken: null,
  clientId: null,
  initialized: false,
};

/**
 * Google Client IDを設定
 */
export function setGoogleClientId(clientId: string) {
  authState.clientId = clientId;
}

/**
 * Google Client IDを取得（localStorage保存）
 */
export function getStoredClientId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('google-client-id');
}

export function storeClientId(clientId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('google-client-id', clientId);
  authState.clientId = clientId;
}

/**
 * GIS(Google Identity Services)スクリプトをロード
 */
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services の読み込みに失敗しました'));
    document.head.appendChild(script);
  });
}

/**
 * OAuth2トークンを取得
 */
export async function authenticate(): Promise<string> {
  if (authState.accessToken) return authState.accessToken;

  const clientId = authState.clientId || getStoredClientId();
  if (!clientId) {
    throw new Error('Google Client ID が設定されていません。設定画面から登録してください。');
  }

  await loadGisScript();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(`認証エラー: ${response.error}`));
          return;
        }
        authState.accessToken = response.access_token;
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });
}

/**
 * ログアウト
 */
export function logout() {
  if (authState.accessToken && (window as any).google?.accounts?.oauth2) {
    (window as any).google.accounts.oauth2.revoke(authState.accessToken);
  }
  authState.accessToken = null;
}

/**
 * 認証済みかどうか
 */
export function isAuthenticated(): boolean {
  return authState.accessToken !== null;
}

// --- Drive API ヘルパー ---

async function driveRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await authenticate();
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    // トークン期限切れ → 再認証
    authState.accessToken = null;
    const newToken = await authenticate();
    return fetch(`https://www.googleapis.com/drive/v3${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    });
  }
  return res;
}

/**
 * フォルダを検索 or 作成
 */
async function findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
  // 検索
  let q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const searchRes = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 作成
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await driveRequest('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const createData = await createRes.json();
  return createData.id;
}

/**
 * アプリ用フォルダIDを取得（【削除禁止】相続税シミュレーター/data）
 */
async function getAppFolderId(): Promise<string> {
  const mainFolderId = await findOrCreateFolder(FOLDER_NAME);
  const dataFolderId = await findOrCreateFolder(APP_DATA_FOLDER, mainFolderId);
  return dataFolderId;
}

/**
 * ドキュメント用フォルダIDを取得（【削除禁止】相続税シミュレーター/documents）
 */
async function getDocumentsFolderId(): Promise<string> {
  const mainFolderId = await findOrCreateFolder(FOLDER_NAME);
  const docsFolderId = await findOrCreateFolder('documents', mainFolderId);
  return docsFolderId;
}

// --- データ保存・読込 ---

/**
 * 案件データをGoogleドライブに保存
 */
export async function saveToGoogleDrive(caseId: string, caseName: string, data: any): Promise<string> {
  const folderId = await getAppFolderId();
  const fileName = `case_${caseId}.json`;

  // 既存ファイルを検索
  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const searchData = await searchRes.json();

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });

  if (searchData.files && searchData.files.length > 0) {
    // 既存ファイルを更新
    const fileId = searchData.files[0].id;
    const token = await authenticate();
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      }
    );
    const result = await res.json();
    return result.id;
  } else {
    // 新規ファイル作成
    const metadata = {
      name: fileName,
      parents: [folderId],
      description: `相続税シミュレーション: ${caseName}`,
    };

    const token = await authenticate();
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    const result = await res.json();
    return result.id;
  }
}

/**
 * Googleドライブから案件データを読み込み
 */
export async function loadFromGoogleDrive(caseId: string): Promise<any | null> {
  const folderId = await getAppFolderId();
  const fileName = `case_${caseId}.json`;

  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const searchData = await searchRes.json();

  if (!searchData.files || searchData.files.length === 0) return null;

  const fileId = searchData.files[0].id;
  const res = await driveRequest(`/files/${fileId}?alt=media`);
  return res.json();
}

/**
 * 全案件データをGoogleドライブに保存
 */
export async function saveAllCasesToDrive(cases: any[]): Promise<void> {
  const folderId = await getAppFolderId();
  const fileName = 'all_cases.json';

  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const searchData = await searchRes.json();

  const jsonContent = JSON.stringify(cases, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const token = await authenticate();

  if (searchData.files && searchData.files.length > 0) {
    const fileId = searchData.files[0].id;
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      }
    );
  } else {
    const metadata = {
      name: fileName,
      parents: [folderId],
      description: '相続税シミュレーション 全案件データ',
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
  }
}

/**
 * Googleドライブから全案件データを読み込み
 */
export async function loadAllCasesFromDrive(): Promise<any[] | null> {
  const folderId = await getAppFolderId();
  const fileName = 'all_cases.json';

  const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const searchData = await searchRes.json();

  if (!searchData.files || searchData.files.length === 0) return null;

  const fileId = searchData.files[0].id;
  const res = await driveRequest(`/files/${fileId}?alt=media`);
  return res.json();
}

/**
 * ドキュメント(PDF/XLSX/DOCX)をGoogleドライブにアップロード
 */
export async function uploadDocumentToDrive(
  blob: Blob,
  fileName: string,
  mimeType: string,
  convertToGoogleFormat: boolean = false
): Promise<string> {
  const folderId = await getDocumentsFolderId();
  const token = await authenticate();

  const metadata: Record<string, any> = {
    name: fileName,
    parents: [folderId],
  };

  // .docxの場合、Googleドキュメントに変換
  if (convertToGoogleFormat && mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    metadata.mimeType = 'application/vnd.google-apps.document';
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const url = convertToGoogleFormat
    ? 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const result = await res.json();
  if (result.error) {
    throw new Error(`アップロードエラー: ${result.error.message}`);
  }
  return result.id;
}

/**
 * Googleドライブ内の保存済み案件リストを取得
 */
export async function listSavedCases(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const folderId = await getAppFolderId();
  const q = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
  const res = await driveRequest(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
  );
  const data = await res.json();
  return data.files || [];
}
