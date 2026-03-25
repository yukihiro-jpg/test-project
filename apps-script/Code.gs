/**
 * Google Apps Script - 書類スキャン バックエンド
 *
 * 機能:
 * 1. PWAからの画像受信 → Google Driveに保存（OCR付き）
 * 2. 毎朝6時にアップロードされたファイルのサマリーをGmailで通知
 *
 * セットアップ手順:
 * 1. Google Apps Script (https://script.google.com) で新しいプロジェクトを作成
 * 2. このコードを貼り付け
 * 3. CONFIG セクションの値を設定
 * 4. デプロイ → ウェブアプリ → アクセスできるユーザー「全員」で公開
 * 5. 初回実行時にDrive/Gmail権限を許可
 * 6. createTriggers() を一度手動実行してタイマートリガーを設定
 */

// ============================================================
// 設定 - ここを編集してください
// ============================================================
const CONFIG = {
  // アップロード先Google DriveフォルダのID
  // フォルダURLの https://drive.google.com/drive/folders/XXXXX の XXXXX 部分
  ROOT_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',

  // 通知先メールアドレス（税理士のGmail）
  NOTIFICATION_EMAIL: 'YOUR_EMAIL@gmail.com',

  // OCRの言語（日本語）
  OCR_LANGUAGE: 'ja',
};

// ============================================================
// Web App エンドポイント
// ============================================================

/**
 * POST リクエスト処理 - PWAからの画像アップロード
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = saveImageToDrive(data);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: result.fileId,
      message: 'アップロード成功'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('doPost error:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET リクエスト処理 - ヘルスチェック用
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: '書類スキャンAPIは稼働中です'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 画像保存 & OCR処理
// ============================================================

/**
 * 画像をGoogle Driveに保存し、OCR処理を行う
 */
function saveImageToDrive(data) {
  const { image, clientId, clientName, docType, timestamp, fileName } = data;

  // クライアント別フォルダを取得 or 作成
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const clientFolderName = `${clientId}_${clientName}`;
  let clientFolder = getOrCreateFolder(rootFolder, clientFolderName);

  // 日付別サブフォルダ
  const dateStr = new Date(timestamp).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/\//g, '-');
  let dateFolder = getOrCreateFolder(clientFolder, dateStr);

  // Base64デコードして画像Blobを作成
  const imageBlob = Utilities.newBlob(
    Utilities.base64Decode(image),
    'image/jpeg',
    fileName
  );

  // 1. 元画像をDriveに保存
  const imageFile = dateFolder.createFile(imageBlob);

  // 2. OCR処理: 画像をGoogle Docsとして挿入（OCR有効）
  let ocrText = '';
  try {
    const ocrResource = {
      title: fileName.replace('.jpg', '_ocr'),
      mimeType: 'image/jpeg',
      parents: [{ id: dateFolder.getId() }]
    };
    const ocrFile = Drive.Files.insert(ocrResource, imageBlob, {
      ocr: true,
      ocrLanguage: CONFIG.OCR_LANGUAGE
    });
    // OCR結果のテキストを取得
    const ocrDoc = DocumentApp.openById(ocrFile.id);
    ocrText = ocrDoc.getBody().getText();

    // OCRテキストをファイルのdescriptionに保存（検索用）
    imageFile.setDescription('OCR: ' + ocrText.substring(0, 500));

    // OCR用の一時Docを削除（テキストは取得済み）
    DriveApp.getFileById(ocrFile.id).setTrashed(true);
  } catch (ocrError) {
    console.error('OCR error:', ocrError);
    // OCR失敗しても画像保存は成功としてcontinue
  }

  // 3. OCRテキスト付きPDFを生成
  try {
    const pdfFileName = fileName.replace('.jpg', '.pdf');

    // Googleドキュメントを作成してPDFにエクスポート
    const doc = DocumentApp.create(pdfFileName.replace('.pdf', ''));
    const body = doc.getBody();

    // 画像を挿入
    body.appendImage(imageBlob).setWidth(500);

    // OCRテキストがあれば追記
    if (ocrText) {
      body.appendParagraph('--- OCR結果 ---')
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
      body.appendParagraph(ocrText);
    }

    doc.saveAndClose();

    // PDFとしてエクスポート
    const pdfBlob = DriveApp.getFileById(doc.getId())
      .getAs('application/pdf')
      .setName(pdfFileName);
    const pdfFile = dateFolder.createFile(pdfBlob);

    // 一時ドキュメントを削除
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    // アップロードログに記録
    logUpload(clientId, clientName, docType, timestamp, pdfFile.getId(), ocrText);

    return { fileId: pdfFile.getId(), ocrText: ocrText };
  } catch (pdfError) {
    console.error('PDF creation error:', pdfError);
    // PDF作成失敗でも元画像は保存されている
    logUpload(clientId, clientName, docType, timestamp, imageFile.getId(), ocrText);
    return { fileId: imageFile.getId(), ocrText: ocrText };
  }
}

/**
 * フォルダを取得、なければ作成
 */
function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

// ============================================================
// アップロードログ管理
// ============================================================

/**
 * アップロードをSpreadsheetにログ記録
 */
function logUpload(clientId, clientName, docType, timestamp, fileId, ocrText) {
  const ss = getOrCreateLogSheet();
  const sheet = ss.getSheetByName('UploadLog');
  sheet.appendRow([
    new Date(),           // ログ日時
    clientId,             // クライアントID
    clientName,           // クライアント名
    docType,              // 書類種別
    timestamp,            // 撮影日時
    fileId,               // DriveファイルID
    ocrText.substring(0, 200),  // OCRテキスト（先頭200文字）
    'pending'             // ステータス（pending/notified）
  ]);
}

/**
 * ログ用スプレッドシートを取得 or 作成
 */
function getOrCreateLogSheet() {
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const files = rootFolder.getFilesByName('_scan_upload_log');

  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  // 新規作成
  const ss = SpreadsheetApp.create('_scan_upload_log');
  const sheet = ss.getActiveSheet();
  sheet.setName('UploadLog');
  sheet.appendRow([
    'ログ日時', 'クライアントID', 'クライアント名',
    '書類種別', '撮影日時', 'ファイルID', 'OCRテキスト', 'ステータス'
  ]);
  sheet.setFrozenRows(1);

  // ログファイルをルートフォルダに移動
  const file = DriveApp.getFileById(ss.getId());
  rootFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return ss;
}

// ============================================================
// 定時メール通知
// ============================================================

/**
 * 毎朝6時に実行 - 前日のアップロードサマリーをメール送信
 */
function sendDailySummaryEmail() {
  const ss = getOrCreateLogSheet();
  const sheet = ss.getSheetByName('UploadLog');
  const data = sheet.getDataRange().getValues();

  // 未通知のレコードを抽出
  const pendingRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === 'pending') {
      pendingRows.push({
        rowIndex: i + 1,
        logDate: data[i][0],
        clientId: data[i][1],
        clientName: data[i][2],
        docType: data[i][3],
        timestamp: data[i][4],
        fileId: data[i][5],
        ocrText: data[i][6]
      });
    }
  }

  if (pendingRows.length === 0) {
    console.log('通知対象のアップロードはありません');
    return;
  }

  // クライアント別にグループ化
  const byClient = {};
  pendingRows.forEach(row => {
    const key = `${row.clientId}_${row.clientName}`;
    if (!byClient[key]) {
      byClient[key] = { name: row.clientName, files: [] };
    }
    byClient[key].files.push(row);
  });

  // メール本文を作成
  const docTypeLabels = {
    receipt: '領収書・レシート',
    invoice: '請求書',
    statement: '明細書',
    contract: '契約書',
    tax: '税務関連書類',
    other: 'その他'
  };

  let htmlBody = `
    <div style="font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; max-width: 600px;">
      <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">
        📋 書類スキャン - 日次レポート
      </h2>
      <p style="color: #666;">
        ${new Date().toLocaleDateString('ja-JP')} 時点で
        <strong>${pendingRows.length}件</strong>の新規アップロードがあります。
      </p>
  `;

  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const folderUrl = rootFolder.getUrl();

  Object.keys(byClient).forEach(key => {
    const client = byClient[key];
    htmlBody += `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #333;">${client.name}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #e8eaed;">
            <th style="padding: 8px; text-align: left; font-size: 13px;">種別</th>
            <th style="padding: 8px; text-align: left; font-size: 13px;">日時</th>
            <th style="padding: 8px; text-align: left; font-size: 13px;">OCRプレビュー</th>
            <th style="padding: 8px; text-align: center; font-size: 13px;">リンク</th>
          </tr>
    `;

    client.files.forEach(file => {
      const driveLink = `https://drive.google.com/file/d/${file.fileId}/view`;
      const ocrPreview = file.ocrText ?
        file.ocrText.substring(0, 60) + '...' : '(OCR結果なし)';

      htmlBody += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px; font-size: 13px;">
            ${docTypeLabels[file.docType] || file.docType}
          </td>
          <td style="padding: 8px; font-size: 13px;">
            ${new Date(file.timestamp).toLocaleString('ja-JP')}
          </td>
          <td style="padding: 8px; font-size: 12px; color: #666;">
            ${ocrPreview}
          </td>
          <td style="padding: 8px; text-align: center;">
            <a href="${driveLink}" style="color: #1a73e8; text-decoration: none;">開く</a>
          </td>
        </tr>
      `;
    });

    htmlBody += '</table></div>';
  });

  htmlBody += `
    <p style="margin-top: 20px;">
      <a href="${folderUrl}"
         style="display: inline-block; background: #1a73e8; color: white;
                padding: 12px 24px; border-radius: 6px; text-decoration: none;
                font-weight: bold;">
        Google Driveフォルダを開く
      </a>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 20px;">
      このメールは書類スキャンシステムから自動送信されています。
    </p>
    </div>
  `;

  // メール送信
  GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL,
    `【書類スキャン】${pendingRows.length}件の新規アップロード - ${new Date().toLocaleDateString('ja-JP')}`,
    `${pendingRows.length}件の新規アップロードがあります。HTMLメールで詳細をご確認ください。`,
    { htmlBody: htmlBody }
  );

  // ステータスを更新
  pendingRows.forEach(row => {
    sheet.getRange(row.rowIndex, 8).setValue('notified');
  });

  console.log(`通知メール送信完了: ${pendingRows.length}件`);
}

// ============================================================
// トリガー設定
// ============================================================

/**
 * 初回セットアップ時に一度だけ手動実行してください
 * - 毎朝6時にサマリーメールを送信するトリガーを設定します
 */
function createTriggers() {
  // 既存トリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 毎朝6時にメール通知
  ScriptApp.newTrigger('sendDailySummaryEmail')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  console.log('トリガーを設定しました: 毎朝6時（JST）にメール通知');
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * テスト用 - 手動でメール通知を送信
 */
function testSendEmail() {
  sendDailySummaryEmail();
}

/**
 * クライアント用URL生成ヘルパー
 * @param {string} webAppUrl - デプロイ済みPWAのURL
 * @param {string} clientId - クライアントID
 * @param {string} clientName - クライアント名
 */
function generateClientUrl(webAppUrl, clientId, clientName) {
  const url = `${webAppUrl}?client=${encodeURIComponent(clientId)}&name=${encodeURIComponent(clientName)}`;
  console.log(`クライアントURL: ${url}`);
  return url;
}
