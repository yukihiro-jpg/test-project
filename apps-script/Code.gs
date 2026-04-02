/**
 * Google Apps Script - 書類スキャン バックエンド
 *
 * 機能:
 * 1. PWAからの複数画像受信 → 1つのPDFにまとめてGoogle Driveに保存（OCR付き）
 * 2. 毎朝6時にアップロードサマリーをGmailで通知
 * 3. 顧問先URL一覧の管理
 *
 * セットアップ:
 * 1. CONFIG を編集
 * 2. Drive APIを有効化（サービス → Drive API → 追加）
 * 3. デプロイ → ウェブアプリ → 全員でアクセス可
 * 4. createTriggers() を一度手動実行
 */

// ============================================================
// 設定
// ============================================================
const CONFIG = {
  ROOT_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',
  NOTIFICATION_EMAIL: 'YOUR_EMAIL@gmail.com',
  OCR_LANGUAGE: 'ja',
  // フロントエンドのURL（GitHub Pages等）- 顧問先URL生成に使用
  FRONTEND_URL: 'https://あなた.github.io/test-project/frontend/',
};

// ============================================================
// Web App エンドポイント
// ============================================================

function doPost(e) {
  try {
    // フォーム送信とJSON送信の両方に対応
    let data;
    if (e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else {
      data = JSON.parse(e.postData.contents);
    }
    const result = saveBatchToDrive(data);
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

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: '書類スキャンAPIは稼働中です'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 複数画像 → 1つのPDF保存
// ============================================================

function saveBatchToDrive(data) {
  const { images, clientId, clientName, docType, bankName, accountNumber, userName, timestamp, pageCount, fileName } = data;

  // 顧問先フォルダを取得 or 作成
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const clientFolder = getOrCreateFolder(rootFolder, clientName);
  // スマホ撮影/未整理 フォルダに保存
  const scanFolder = getOrCreateFolder(clientFolder, 'スマホ撮影');
  const unsortedFolder = getOrCreateFolder(scanFolder, '未整理');
  // 処理済みフォルダも事前に作成
  getOrCreateFolder(scanFolder, '処理済み');

  // 全画像のOCRテキストを収集
  let allOcrText = '';

  // Googleドキュメントを作成（複数ページ → 1つのPDF）
  const doc = DocumentApp.create(fileName);
  const body = doc.getBody();

  for (let i = 0; i < images.length; i++) {
    const imageBlob = Utilities.newBlob(
      Utilities.base64Decode(images[i]),
      'image/jpeg',
      `page_${i + 1}.jpg`
    );

    // ページ区切り（2ページ目以降）
    if (i > 0) {
      body.appendPageBreak();
    }

    // 画像を挿入（ページ幅に合わせる）
    const image = body.appendImage(imageBlob);
    const width = 500;
    const ratio = width / image.getWidth();
    image.setWidth(width);
    image.setHeight(image.getHeight() * ratio);

    // OCR処理
    try {
      const ocrResource = {
        title: `_ocr_temp_${i}`,
        mimeType: 'image/jpeg'
      };
      const ocrFile = Drive.Files.insert(ocrResource, imageBlob, {
        ocr: true,
        ocrLanguage: CONFIG.OCR_LANGUAGE
      });
      const ocrDoc = DocumentApp.openById(ocrFile.id);
      const pageOcr = ocrDoc.getBody().getText();
      if (pageOcr) {
        allOcrText += `[ページ${i + 1}] ${pageOcr}\n`;
      }
      DriveApp.getFileById(ocrFile.id).setTrashed(true);
    } catch (ocrErr) {
      console.error(`OCR error page ${i + 1}:`, ocrErr);
    }
  }

  // OCRテキストをドキュメント末尾に追記
  if (allOcrText) {
    body.appendPageBreak();
    body.appendParagraph('--- OCR結果 ---')
      .setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph(allOcrText);
  }

  doc.saveAndClose();

  // PDFとしてエクスポート
  const pdfFileName = buildPdfFileName(docType, bankName, userName, timestamp, pageCount);
  const pdfBlob = DriveApp.getFileById(doc.getId())
    .getAs('application/pdf')
    .setName(pdfFileName);
  const pdfFile = unsortedFolder.createFile(pdfBlob);

  // OCRテキストをPDFの説明に保存（検索用）
  if (allOcrText) {
    pdfFile.setDescription('OCR: ' + allOcrText.substring(0, 800));
  }

  // 一時ドキュメントを削除
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  // ログ記録
  logUpload(clientId, clientName, docType, bankName, accountNumber, userName, timestamp, pageCount, pdfFile.getId(), allOcrText);

  return { fileId: pdfFile.getId() };
}

/**
 * PDFファイル名を生成
 */
function buildPdfFileName(docType, bankName, userName, timestamp, pageCount) {
  const date = new Date(timestamp);
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMMdd_HHmm');
  let name = `${dateStr}_${docType}`;
  if (bankName) name += `_${bankName}`;
  if (userName) name += `_${userName}`;
  name += `_${pageCount}p.pdf`;
  return name;
}

function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

// ============================================================
// アップロードログ
// ============================================================

function logUpload(clientId, clientName, docType, bankName, accountNumber, userName, timestamp, pageCount, fileId, ocrText) {
  const ss = getOrCreateLogSheet();
  const sheet = ss.getSheetByName('アップロード履歴');
  sheet.appendRow([
    new Date(),
    clientName,
    docType,
    bankName || '',
    accountNumber || '',
    userName || '',
    pageCount,
    new Date(timestamp),
    fileId,
    (ocrText || '').substring(0, 200),
    'pending'
  ]);
}

function getOrCreateLogSheet() {
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const files = rootFolder.getFilesByName('_書類スキャン管理');

  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  const ss = SpreadsheetApp.create('_書類スキャン管理');

  // シート1: アップロード履歴
  const logSheet = ss.getActiveSheet();
  logSheet.setName('アップロード履歴');
  logSheet.appendRow([
    '受信日時', '顧問先名', '書類種別', '銀行名', '口座番号', '使用者名',
    'ページ数', '撮影日時', 'ファイルID', 'OCRテキスト', 'ステータス'
  ]);
  logSheet.setFrozenRows(1);

  // シート2: 顧問先URL一覧
  const urlSheet = ss.insertSheet('顧問先URL一覧');
  urlSheet.appendRow(['顧問先名', 'クライアントID', 'URL', '登録日', 'QRコード画像URL']);
  urlSheet.setFrozenRows(1);
  urlSheet.setColumnWidth(1, 200);
  urlSheet.setColumnWidth(2, 150);
  urlSheet.setColumnWidth(3, 500);
  urlSheet.setColumnWidth(4, 120);
  urlSheet.setColumnWidth(5, 500);

  // ファイルをルートフォルダに移動
  const file = DriveApp.getFileById(ss.getId());
  rootFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return ss;
}

// ============================================================
// 顧問先URL管理
// ============================================================

/**
 * ★ 顧問先を登録する
 *
 * 使い方:
 *   1. 下の「ここに顧問先名を入力」を書き換える（例: '田中商事'）
 *   2. この関数を選択して「実行」
 *   3. 実行ログにURLが表示される → それを顧問先に渡す
 *   4. 「顧問先URL一覧」シートにも自動記録される
 */
function registerClient() {
  // ★★★ ここに顧問先名を入力してから実行 ★★★
  const clientName = 'ここに顧問先名を入力';
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★

  if (clientName === 'ここに顧問先名を入力') {
    console.log('エラー: 顧問先名を入力してから実行してください');
    console.log('例: const clientName = \'田中商事\';');
    return;
  }

  // クライアントIDを生成（タイムスタンプベースで一意に）
  const clientId = 'c' + Date.now().toString(36);

  // フォルダ作成（顧問先フォルダ + 全サブフォルダ）
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const clientFolder = getOrCreateFolder(rootFolder, clientName);

  // スマホ撮影フォルダ
  const scanFolder = getOrCreateFolder(clientFolder, 'スマホ撮影');
  getOrCreateFolder(scanFolder, '未整理');
  getOrCreateFolder(scanFolder, '処理済み');

  // 顧問先共有フォルダ（ファイル同期システムと共通）
  getOrCreateFolder(clientFolder, '顧問先からの受取物（社長用）');
  getOrCreateFolder(clientFolder, '顧問先への送付物（社長用）');
  getOrCreateFolder(clientFolder, '顧問先からの受取物（スタッフ用）');
  getOrCreateFolder(clientFolder, '顧問先への送付物（スタッフ用）');
  getOrCreateFolder(clientFolder, '_sync_logs');

  // URL生成
  const url = `${CONFIG.FRONTEND_URL}?client=${encodeURIComponent(clientId)}&name=${encodeURIComponent(clientName)}`;

  // QRコード画像URL生成
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=2`;

  // 一覧に追記（QRコードURL付き）
  const ss = getOrCreateLogSheet();
  const urlSheet = ss.getSheetByName('顧問先URL一覧');
  urlSheet.appendRow([clientName, clientId, url, new Date(), qrUrl]);

  // 結果をログに表示
  console.log('========================================');
  console.log(`登録完了: ${clientName}`);
  console.log('');
  console.log('配布用URL:');
  console.log(url);
  console.log('');
  console.log('QRコード画像（ブラウザで開いて印刷可能）:');
  console.log(qrUrl);
  console.log('');
  console.log('このURLを顧問先にお渡しください。');
  console.log('「顧問先URL一覧」シートにも記録しました。');
  console.log('========================================');
}

/**
 * 顧問先URL一覧を開く（ショートカット）
 */
function openClientUrlList() {
  const ss = getOrCreateLogSheet();
  const urlSheet = ss.getSheetByName('顧問先URL一覧');
  const url = ss.getUrl() + '#gid=' + urlSheet.getSheetId();
  console.log('顧問先URL一覧はこちら:');
  console.log(url);
}

// ============================================================
// 定時メール通知
// ============================================================

function sendDailySummaryEmail() {
  const ss = getOrCreateLogSheet();
  const sheet = ss.getSheetByName('アップロード履歴');
  const data = sheet.getDataRange().getValues();

  const pendingRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][10] === 'pending' || data[i][10] === 'analyzed') {
      pendingRows.push({
        rowIndex: i + 1,
        logDate: data[i][0],
        clientName: data[i][1],
        docType: data[i][2],
        bankName: data[i][3],
        accountNumber: data[i][4],
        userName: data[i][5],
        pageCount: data[i][6],
        timestamp: data[i][7],
        fileId: data[i][8],
        ocrText: data[i][9]
      });
    }
  }

  if (pendingRows.length === 0) {
    console.log('通知対象のアップロードはありません');
    return;
  }

  // 顧問先別にグループ化
  const byClient = {};
  pendingRows.forEach(row => {
    if (!byClient[row.clientName]) {
      byClient[row.clientName] = [];
    }
    byClient[row.clientName].push(row);
  });

  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const folderUrl = rootFolder.getUrl();

  let htmlBody = `
    <div style="font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; max-width: 600px;">
      <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">
        書類スキャン - 日次レポート
      </h2>
      <p style="color: #666;">
        ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')} 時点で
        <strong>${pendingRows.length}件</strong>の新規アップロードがあります。
      </p>
  `;

  Object.keys(byClient).forEach(clientName => {
    const files = byClient[clientName];
    htmlBody += `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #333;">${clientName}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #e8eaed;">
            <th style="padding: 8px; text-align: left; font-size: 13px;">書類種別</th>
            <th style="padding: 8px; text-align: left; font-size: 13px;">詳細</th>
            <th style="padding: 8px; text-align: center; font-size: 13px;">ページ</th>
            <th style="padding: 8px; text-align: center; font-size: 13px;">リンク</th>
          </tr>
    `;

    files.forEach(file => {
      const driveLink = `https://drive.google.com/file/d/${file.fileId}/view`;
      const detail = file.bankName || '-';
      htmlBody += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px; font-size: 13px;">${file.docType}</td>
          <td style="padding: 8px; font-size: 13px;">${detail}</td>
          <td style="padding: 8px; text-align: center; font-size: 13px;">${file.pageCount}p</td>
          <td style="padding: 8px; text-align: center;">
            <a href="${driveLink}" style="color: #1a73e8;">開く</a>
          </td>
        </tr>
      `;
    });

    htmlBody += '</table></div>';
  });

  // 解析結果スプレッドシートへのリンクを追加
  const analysisSummaryJson = PropertiesService.getScriptProperties().getProperty('lastAnalysisSummary');
  if (analysisSummaryJson) {
    try {
      const analysisSummary = JSON.parse(analysisSummaryJson);
      const sheetUrls = {};
      analysisSummary.forEach(s => { sheetUrls[s.clientName] = s.sheetUrl; });

      if (Object.keys(sheetUrls).length > 0) {
        htmlBody += `
          <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 12px 0; color: #2e7d32;">AI解析結果</h3>
            <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
              以下の顧問先の書類をAI解析しました。スプレッドシートで結果を確認できます。
            </p>
        `;
        Object.keys(sheetUrls).forEach(name => {
          htmlBody += `
            <p style="margin: 4px 0;">
              <a href="${sheetUrls[name]}" style="color: #1a73e8; font-size: 14px;">${name} の解析結果</a>
            </p>
          `;
        });
        htmlBody += '</div>';
      }
      // 使用済みのサマリーをクリア
      PropertiesService.getScriptProperties().deleteProperty('lastAnalysisSummary');
    } catch (e) {
      console.error('解析サマリー読み込みエラー:', e);
    }
  }

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

  GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL,
    `【書類スキャン】${pendingRows.length}件の新規アップロード - ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')}`,
    `${pendingRows.length}件の新規アップロードがあります。`,
    { htmlBody: htmlBody }
  );

  pendingRows.forEach(row => {
    sheet.getRange(row.rowIndex, 11).setValue('notified');
  });

  console.log(`通知メール送信完了: ${pendingRows.length}件`);
}

// ============================================================
// トリガー設定
// ============================================================

function createTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // AM3:00 - Gemini API解析
  ScriptApp.newTrigger('analyzeUploadedDocuments')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  // AM6:00 - メール通知
  ScriptApp.newTrigger('sendDailySummaryEmail')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  console.log('トリガー設定完了:');
  console.log('  AM3:00 - Gemini API解析');
  console.log('  AM6:00 - メール通知');
}

// ============================================================
// テスト用
// ============================================================

function testSendEmail() {
  sendDailySummaryEmail();
}
