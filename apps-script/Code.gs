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
    // 現金引出・預入の場合
    if (data.action === 'cashEntry') {
      const result = saveCashEntry(data);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: '現金登録成功'
      })).setMimeType(ContentService.MimeType.JSON);
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
  // 候補リスト取得API
  if (e && e.parameter && e.parameter.action === 'getCandidates') {
    const clientName = decodeURIComponent(e.parameter.client || '');
    const candidates = getCandidatesForClient(clientName);
    return ContentService.createTextOutput(JSON.stringify(candidates))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: '書類スキャンAPIは稼働中です'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * アップロード履歴と現金出納帳から、顧問先の候補リストを取得
 */
function getCandidatesForClient(clientName) {
  const result = { bankNames: [], accountNumbers: [], userNames: [] };

  try {
    const ss = getOrCreateLogSheet();
    const sheet = ss.getSheetByName('アップロード履歴');
    if (!sheet) return result;

    const data = sheet.getDataRange().getValues();
    const bankSet = new Set();
    const accountSet = new Set();
    const userSet = new Set();

    for (let i = 1; i < data.length; i++) {
      // 顧問先名が一致する行のみ
      if (data[i][1] !== clientName) continue;

      const bankName = (data[i][3] || '').toString().trim();
      const accountNumber = (data[i][4] || '').toString().trim();
      const userName = (data[i][5] || '').toString().trim();

      if (bankName) bankSet.add(bankName);
      if (accountNumber) accountSet.add(accountNumber);
      if (userName) userSet.add(userName);
    }

    result.bankNames = [...bankSet];
    result.accountNumbers = [...accountSet];
    result.userNames = [...userSet];
  } catch (err) {
    console.error('getCandidatesForClient error:', err);
  }

  return result;
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
// ============================================================
// 現金引出・預入の保存
// ============================================================

function saveCashEntry(data) {
  const { clientName, entryType, date, bankName, accountNumber, amount, depositType, timestamp } = data;

  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const clientFolder = getOrCreateFolder(rootFolder, clientName);
  const clientSheet = getOrCreateClientAnalysisSheet_Code(clientName, clientFolder);

  // 現金出納帳シートを取得
  let cashSheet = clientSheet.getSheetByName('現金出納帳');
  if (!cashSheet) {
    cashSheet = clientSheet.insertSheet('現金出納帳');
    cashSheet.appendRow(['月日', '相手先名称', '主な品名', '入金額', '出金額', '残高', '処理日']);
    cashSheet.setFrozenRows(1);
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  let description = '';
  let inAmount = 0;
  let outAmount = 0;

  if (entryType === '現金引出') {
    description = `${bankName}_現金引出`;
    inAmount = amount;
  } else {
    // 現金預入
    const typeLabel = depositType || '預入';
    description = `${bankName}_${typeLabel}`;
    outAmount = amount;
  }

  const accountInfo = accountNumber ? `(${accountNumber})` : '';

  // 新しいデータを一時的に追加
  const newRow = [date, `${description}${accountInfo}`, entryType, inAmount, outAmount, 0, today];

  // 全データを取得して日付順にソート+残高再計算
  const allData = cashSheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < allData.length; i++) {
    rows.push(allData[i]);
  }
  rows.push(newRow);

  // 月日（列0）でソート
  rows.sort((a, b) => {
    const dateA = new Date(a[0]);
    const dateB = new Date(b[0]);
    if (dateA.getTime() === dateB.getTime()) {
      // 同日の場合は処理日でソート
      return new Date(a[6]) - new Date(b[6]);
    }
    return dateA - dateB;
  });

  // 残高を再計算
  let balance = 0;
  rows.forEach(row => {
    balance += (Number(row[3]) || 0) - (Number(row[4]) || 0);
    row[5] = balance;
  });

  // シートをヘッダー以外クリアして再書き込み
  if (cashSheet.getLastRow() > 1) {
    cashSheet.getRange(2, 1, cashSheet.getLastRow() - 1, 7).clearContent();
  }
  if (rows.length > 0) {
    cashSheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  return { success: true };
}

/**
 * Code.gsから解析結果スプシを取得or作成（GeminiAnalysis.gsのgetOrCreateClientAnalysisSheetと同等）
 */
function getOrCreateClientAnalysisSheet_Code(clientName, clientFolder) {
  const sheetName = `${clientName}_解析結果`;
  const files = clientFolder.getFilesByName(sheetName);

  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  const ss = SpreadsheetApp.create(sheetName);

  const receiptSheet = ss.getActiveSheet();
  receiptSheet.setName('レシート・領収書');
  receiptSheet.appendRow(['解析日', '使用者名', '日付', '相手先名称', '10%対象額', '軽減8%対象額', '支払総額', '主な品名', 'インボイス番号', '備考']);
  receiptSheet.setFrozenRows(1);

  const ccSheet = ss.insertSheet('クレジットカード利用明細書');
  ccSheet.appendRow(['解析日', 'カード会社名', '利用日', '利用先名称', '利用金額', '支払区分', '備考']);
  ccSheet.setFrozenRows(1);

  const bankSheet = ss.insertSheet('通帳');
  bankSheet.appendRow(['解析日', '銀行名', '口座番号', '年月日', '摘要', '入金額', '出金額', '残高', '備考']);
  bankSheet.setFrozenRows(1);

  const salesSheet = ss.insertSheet('売上請求書');
  salesSheet.appendRow(['解析日', '請求日', '請求相手先名称', '案件名', '10%売上高', '軽減8%売上高', '不課税売上高', '総売上高', '備考']);
  salesSheet.setFrozenRows(1);

  const purchaseSheet = ss.insertSheet('仕入請求書');
  purchaseSheet.appendRow(['解析日', '請求日', '相手方名称', '主たる購入品目', '10%仕入高', '軽減8%仕入高', '不課税仕入高', '総仕入高', '備考']);
  purchaseSheet.setFrozenRows(1);

  const cashSheet = ss.insertSheet('現金出納帳');
  cashSheet.appendRow(['月日', '相手先名称', '主な品名', '入金額', '出金額', '残高', '処理日']);
  cashSheet.setFrozenRows(1);

  const file = DriveApp.getFileById(ss.getId());
  clientFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return ss;
}

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

  // シート3: メールアドレス対応表（将来のメール自動振分用）
  const emailSheet = ss.insertSheet('メールアドレス対応表');
  emailSheet.appendRow(['メールアドレス', '顧問先名', '区分', '登録日', '備考']);
  emailSheet.setFrozenRows(1);
  emailSheet.setColumnWidth(1, 300);
  emailSheet.setColumnWidth(2, 200);
  emailSheet.setColumnWidth(3, 100);
  emailSheet.setColumnWidth(4, 120);
  emailSheet.setColumnWidth(5, 200);

  // シート4: 同期ファイル解析ログ
  const syncLogSheet = ss.insertSheet('同期ファイル解析ログ');
  syncLogSheet.appendRow([
    '解析日時', '顧問先名', '元フォルダ', 'ファイル名',
    '判定種別', '判定確度', 'ファイルID', '備考'
  ]);
  syncLogSheet.setFrozenRows(1);

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
  const displayName = clientName.replace(/^\d+_/, '');
  getOrCreateFolder(clientFolder, `${displayName}→税理士（社長用）`);
  getOrCreateFolder(clientFolder, `税理士→${displayName}（社長用）`);
  getOrCreateFolder(clientFolder, `${displayName}→税理士（スタッフ用）`);
  getOrCreateFolder(clientFolder, `税理士→${displayName}（スタッフ用）`);
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
// スプレッドシートから顧問先を自動登録
// ============================================================

/**
 * 「顧問先URL一覧」シートに顧問先名だけ入力すれば、
 * フォルダ作成・URL生成・QRコード生成を自動実行する。
 *
 * 使い方:
 *   1. _書類スキャン管理 → 「顧問先URL一覧」シートを開く
 *   2. A列（顧問先名）に新しい顧問先名を入力
 *   3. B列以降が空欄なら未登録と判断し、自動で登録処理が走る
 *
 * この関数は onEdit トリガーまたは手動実行で動作する。
 */
function autoRegisterClients() {
  const ss = getOrCreateLogSheet();
  const urlSheet = ss.getSheetByName('顧問先URL一覧');
  const data = urlSheet.getDataRange().getValues();
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);

  let registered = 0;

  for (let i = 1; i < data.length; i++) {
    const clientName = (data[i][0] || '').toString().trim();
    const clientId = (data[i][1] || '').toString().trim();

    // 顧問先名があり、クライアントIDが空欄 = 未登録
    if (clientName && !clientId) {
      const newClientId = 'c' + Date.now().toString(36) + i;

      // フォルダ作成
      const clientFolder = getOrCreateFolder(rootFolder, clientName);
      const scanFolder = getOrCreateFolder(clientFolder, 'スマホ撮影');
      getOrCreateFolder(scanFolder, '未整理');
      getOrCreateFolder(scanFolder, '処理済み');
      const dn = clientName.replace(/^\d+_/, '');
      getOrCreateFolder(clientFolder, `${dn}→税理士（社長用）`);
      getOrCreateFolder(clientFolder, `税理士→${dn}（社長用）`);
      getOrCreateFolder(clientFolder, `${dn}→税理士（スタッフ用）`);
      getOrCreateFolder(clientFolder, `税理士→${dn}（スタッフ用）`);
      getOrCreateFolder(clientFolder, '_sync_logs');

      // URL生成
      const url = `${CONFIG.FRONTEND_URL}?client=${encodeURIComponent(newClientId)}&name=${encodeURIComponent(clientName)}`;
      const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=2`;

      // シートに書き込み（B〜E列）
      const row = i + 1;
      urlSheet.getRange(row, 2).setValue(newClientId);
      urlSheet.getRange(row, 3).setValue(url);
      urlSheet.getRange(row, 4).setValue(new Date());
      urlSheet.getRange(row, 5).setValue(qrUrl);

      console.log(`自動登録完了: ${clientName} → ${url}`);
      registered++;
    }
  }

  if (registered === 0) {
    console.log('新規登録対象はありませんでした。');
  } else {
    console.log(`${registered}件の顧問先を自動登録しました。`);
  }
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
