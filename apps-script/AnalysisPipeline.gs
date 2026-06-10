/**
 * 解析パイプライン共通基盤
 * ==========================================================
 * 3つの入力ルート（ファイル同期・スマホ撮影・メール添付）から
 * 集まったファイルを統一的に処理するための基盤層。
 *
 * フォルダ構造:
 *   [顧問先フォルダ]/
 *     ├ メール添付資料/YYYY年MM月DD日受信分/         (新規)
 *     └ 解析データ/                                   (新規)
 *         ├ スマホ撮影/[既存_解析結果]                (蓄積型)
 *         ├ 同期システムから/YYYY年MM月DD日同期分/    (個別型)
 *         └ メール添付から/YYYY年MM月DD日受信分/      (個別型)
 */

// ============================================================
// 設定
// ============================================================

const ANALYSIS_FOLDERS = {
  ROOT: '解析データ',
  SMARTPHONE: 'スマホ撮影',
  SYNC_ROOT: '同期システムから',
  EMAIL_ROOT: 'メール添付から',
  EMAIL_ATTACHMENT: 'メール添付資料',
};

// 解析対象拡張子
const ANALYZABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

// コピーのみ対象拡張子
const COPY_ONLY_EXTENSIONS = ['xlsx', 'xls', 'csv', 'doc', 'docx', 'txt', 'zip'];

// ファイルサイズ上限（バイト）。これを超えるファイルは解析せずスキップ
const MAX_ANALYZE_BYTES = 10 * 1024 * 1024;  // 10 MB

// 1回の runUnifiedPipeline 実行で解析する最大ファイル数（タイムアウト防止）
const MAX_ANALYZE_FILES_PER_RUN = 5;


// ============================================================
// 日付フォーマット
// ============================================================

/**
 * 日付を「YYYY年MM月DD日」形式にフォーマット
 */
function formatDateJa_(date) {
  return Utilities.formatDate(date || new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
}

/**
 * 同期日フォルダ名: 「YYYY年MM月DD日同期分」
 */
function buildSyncDateFolderName_(date) {
  return formatDateJa_(date) + '同期分';
}

/**
 * メール受信日フォルダ名: 「YYYY年MM月DD日受信分」
 */
function buildEmailDateFolderName_(date) {
  return formatDateJa_(date) + '受信分';
}

/**
 * ルート別の親フォルダ名: 「同期システムから」「メール添付から」
 */
function buildRouteParentFolderName_(route) {
  if (route === 'sync') return ANALYSIS_FOLDERS.SYNC_ROOT;
  if (route === 'email') return ANALYSIS_FOLDERS.EMAIL_ROOT;
  if (route === 'smartphone') return ANALYSIS_FOLDERS.SMARTPHONE;
  return 'その他';
}

/**
 * 解析結果スプレッドシート名:
 *   通帳:   通帳解析データ_[元ファイル名]_YYYY年MM月DD日受領分
 *   その他: [書類種別]解析データ_YYYY年MM月DD日受領分  ← 同一日付内で集約
 */
function buildAnalysisSheetName_(docType, originalFileName, date) {
  const dateStr = formatDateJa_(date);
  if (docType === '通帳') {
    // 通帳は混在を避けるため個別ファイル
    const baseName = stripExtension_(originalFileName);
    return `通帳解析データ_${baseName}_${dateStr}受領分`;
  }
  // その他の書類種別は同一日付内で集約
  return `${docType}解析データ_${dateStr}受領分`;
}

/**
 * ファイル名から拡張子を除去
 */
function stripExtension_(fileName) {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

/**
 * ファイル名から拡張子を取得（小文字）
 */
function getExtension_(fileName) {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
}


// ============================================================
// フォルダ取得・作成
// ============================================================

/**
 * 解析データ ルートフォルダを取得or作成
 */
function getOrCreateAnalysisRoot_(clientFolder) {
  return getOrCreateFolder(clientFolder, ANALYSIS_FOLDERS.ROOT);
}

/**
 * 解析データ/スマホ撮影/ フォルダを取得or作成
 */
function getOrCreateAnalysisSmartphoneFolder_(clientFolder) {
  const analysisRoot = getOrCreateAnalysisRoot_(clientFolder);
  return getOrCreateFolder(analysisRoot, ANALYSIS_FOLDERS.SMARTPHONE);
}

/**
 * 解析データ/同期システムから/YYYY年MM月DD日同期分/ フォルダを取得or作成
 */
function getOrCreateSyncDateFolder_(clientFolder, date) {
  const analysisRoot = getOrCreateAnalysisRoot_(clientFolder);
  const routeFolder = getOrCreateFolder(analysisRoot, ANALYSIS_FOLDERS.SYNC_ROOT);
  return getOrCreateFolder(routeFolder, buildSyncDateFolderName_(date));
}

/**
 * 解析データ/メール添付から/YYYY年MM月DD日受信分/ フォルダを取得or作成
 */
function getOrCreateEmailDateFolder_(clientFolder, date) {
  const analysisRoot = getOrCreateAnalysisRoot_(clientFolder);
  const routeFolder = getOrCreateFolder(analysisRoot, ANALYSIS_FOLDERS.EMAIL_ROOT);
  return getOrCreateFolder(routeFolder, buildEmailDateFolderName_(date));
}

/**
 * メール添付資料/YYYY年MM月DD日受信分/ フォルダを取得or作成（同期対象外）
 */
function getOrCreateEmailAttachmentDateFolder_(clientFolder, date) {
  const root = getOrCreateFolder(clientFolder, ANALYSIS_FOLDERS.EMAIL_ATTACHMENT);
  return getOrCreateFolder(root, buildEmailDateFolderName_(date));
}


// ============================================================
// 一括初期セットアップ
// ============================================================

/**
 * 全顧問先に対して以下を一括セットアップ:
 *  - 解析データ/スマホ撮影/ フォルダ作成
 *  - 解析データ/同期システムから/ フォルダ作成（中の日付フォルダは必要時に）
 *  - 解析データ/メール添付から/ フォルダ作成
 *  - メール添付資料/ フォルダ作成
 *  - 既存の [client]_解析結果 スプレッドシートを 解析データ/スマホ撮影/ に移動
 *
 * 安全に再実行可能（既にあるものはスキップ）
 */
function setupAnalysisFolders() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) {
    throw new Error('親フォルダ（02_顧問先共有フォルダ）が取得できません');
  }

  console.log('=== 解析データフォルダの一括セットアップ開始 ===');
  let processed = 0;
  let moved = 0;

  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();

    // _で始まるフォルダはスキップ（_sync_logs等）
    if (clientName.startsWith('_')) continue;

    try {
      // 1. 解析データ配下のフォルダを作成
      getOrCreateAnalysisSmartphoneFolder_(clientFolder);
      const analysisRoot = getOrCreateAnalysisRoot_(clientFolder);
      getOrCreateFolder(analysisRoot, ANALYSIS_FOLDERS.SYNC_ROOT);
      getOrCreateFolder(analysisRoot, ANALYSIS_FOLDERS.EMAIL_ROOT);

      // 2. メール添付資料フォルダを作成
      getOrCreateFolder(clientFolder, ANALYSIS_FOLDERS.EMAIL_ATTACHMENT);

      // 3. 既存スプレッドシートを 解析データ/スマホ撮影/ に移動
      const moveResult = migrateClientAnalysisSheet_(clientFolder, clientName);
      if (moveResult.moved) moved++;

      processed++;
      console.log(`  ${clientName}: セットアップ完了${moveResult.note ? ' / ' + moveResult.note : ''}`);
    } catch (e) {
      console.error(`  ${clientName}: エラー - ${e.message}`);
    }
  }

  console.log(`=== 完了: ${processed}顧問先 / ${moved}スプレッドシート移動 ===`);
}

/**
 * 既存の [client]_解析結果 スプレッドシートを 解析データ/スマホ撮影/ に移動
 * 既にスマホ撮影フォルダ内にあればスキップ
 */
function migrateClientAnalysisSheet_(clientFolder, clientName) {
  const targetSheetName = `${clientName}_解析結果`;
  const smartphoneFolder = getOrCreateAnalysisSmartphoneFolder_(clientFolder);

  // 既にスマホ撮影フォルダ内にあればスキップ
  const inSmartphone = smartphoneFolder.getFilesByName(targetSheetName);
  if (inSmartphone.hasNext()) {
    return { moved: false, note: 'スプレッドシートは既に移動済み' };
  }

  // 顧問先フォルダ直下にあれば移動
  const inClientRoot = clientFolder.getFilesByName(targetSheetName);
  if (inClientRoot.hasNext()) {
    const file = inClientRoot.next();
    file.moveTo(smartphoneFolder);
    return { moved: true, note: 'スプレッドシートを移動' };
  }

  return { moved: false, note: '既存スプレッドシートなし（未作成）' };
}


// ============================================================
// 解析エンジン（共通）
// ============================================================

/**
 * 個別ファイルを解析して、ルート別に解析データフォルダへ出力
 *
 * @param {Object} params
 *   - file: DriveApp.File （元ファイル）
 *   - clientFolder: DriveApp.Folder （顧問先のルートフォルダ）
 *   - clientName: String （顧問先名）
 *   - route: 'sync' | 'email' | 'smartphone'
 *   - receivedDate: Date （受領日）
 *
 * @return {Object} 解析結果サマリ
 *   {action: 'analyzed' | 'copied' | 'review' | 'skipped' | 'error',
 *    docType, fileName, outputUrl, confidence, error}
 */
function analyzeFileToAnalysisFolder_(params) {
  const file = params.file;
  const clientFolder = params.clientFolder;
  const clientName = params.clientName;
  const route = params.route;
  const receivedDate = params.receivedDate || new Date();

  const fileName = file.getName();
  const ext = getExtension_(fileName);

  // 解析対象外（コピーのみ）
  if (COPY_ONLY_EXTENSIONS.indexOf(ext) >= 0) {
    const destFolder = getOutputFolderForRoute_(clientFolder, route, receivedDate);
    if (destFolder) {
      const targetName = resolveAvailableFileName_(destFolder, fileName);
      file.getBlob().setName(targetName);
      destFolder.createFile(file.getBlob());
    }
    return {
      action: 'copied',
      docType: null,
      fileName: fileName,
      outputUrl: destFolder ? destFolder.getUrl() : '',
      route: route,
    };
  }

  // 解析対象外（その他拡張子）
  if (ANALYZABLE_EXTENSIONS.indexOf(ext) < 0) {
    return { action: 'skipped', fileName: fileName, reason: '対象外拡張子: ' + ext };
  }

  // サイズ上限チェック（Gemini解析コスト爆発防止）
  const sizeBytes = file.getSize();
  if (sizeBytes > MAX_ANALYZE_BYTES) {
    const sizeMB = Math.round(sizeBytes / 1024 / 1024 * 10) / 10;
    return {
      action: 'skipped_too_large',
      fileName: fileName,
      sizeBytes: sizeBytes,
      reason: `サイズ超過 ${sizeMB}MB > ${MAX_ANALYZE_BYTES / 1024 / 1024}MB`,
    };
  }

  // ----- 解析処理 -----
  try {
    const blob = file.getBlob();
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();

    // Step 1: 分類
    const classification = classifyDocument(base64Data, mimeType, clientName);
    const docType = classification.docType || 'その他';
    const confidence = classification.confidence || '判定不能';

    // confidenceスコア化（既存は「確定」「要確認」「判定不能」の文字列）
    const confidenceScore = (confidence === '確定') ? 0.9
                          : (confidence === '要確認') ? 0.6
                          : 0.3;

    // その他 or 判定不能なら要確認シートに振り分けて終了
    if (docType === 'その他' || confidence === '判定不能') {
      addToReviewQueue_(clientName, fileName, file.getId(), docType, confidence, route, '分類不能のため要確認');
      return {
        action: 'review',
        docType: docType,
        fileName: fileName,
        confidence: confidence,
        route: route,
        note: '分類不能',
      };
    }

    // 低信頼度（要確認）も要確認シートに（自動転記しない）
    if (confidenceScore < 0.7) {
      addToReviewQueue_(clientName, fileName, file.getId(), docType, confidence, route, '低信頼度のため要確認');
      return {
        action: 'review',
        docType: docType,
        fileName: fileName,
        confidence: confidence,
        route: route,
        note: '低信頼度',
      };
    }

    // Step 2: 詳細解析
    const bankName = classification.bankName || '';
    const accountNumber = classification.accountNumber || '';

    if (route === 'smartphone') {
      // スマホ撮影は蓄積型（既存スプレッドシートに行追加）
      return analyzeForSmartphone_(file, base64Data, classification, clientFolder, clientName);
    } else {
      // 同期・メール添付は個別gsheet型
      return analyzeForIndividualSheet_(
        file, base64Data, classification, clientFolder, clientName, route, receivedDate
      );
    }
  } catch (e) {
    console.error(`解析エラー: ${clientName}/${fileName} - ${e}`);
    return { action: 'error', fileName: fileName, error: e.message, route: route };
  }
}

/**
 * ルート別の出力先フォルダを取得
 */
function getOutputFolderForRoute_(clientFolder, route, receivedDate) {
  if (route === 'sync') return getOrCreateSyncDateFolder_(clientFolder, receivedDate);
  if (route === 'email') return getOrCreateEmailDateFolder_(clientFolder, receivedDate);
  if (route === 'smartphone') return getOrCreateAnalysisSmartphoneFolder_(clientFolder);
  return null;
}

/**
 * スマホ撮影ルートの解析（既存スプレッドシートに蓄積）
 */
function analyzeForSmartphone_(file, base64Data, classification, clientFolder, clientName) {
  const clientSheet = getOrCreateClientAnalysisSheetInSmartphone_(clientFolder, clientName);
  const docType = classification.docType;
  const bankName = classification.bankName || '';
  const accountNumber = classification.accountNumber || '';

  const analysisRows = callGeminiApi(base64Data, docType, bankName, clientSheet);
  writeAnalysisResult(clientSheet, docType, analysisRows, bankName, accountNumber, '');

  if (docType === 'レシート・領収書') {
    try { writeToCashBook(clientSheet, analysisRows); } catch (e) {}
  }

  return {
    action: 'analyzed',
    docType: docType,
    fileName: file.getName(),
    outputUrl: clientSheet.getUrl(),
    rows: analysisRows.length,
    confidence: classification.confidence,
    route: 'smartphone',
  };
}

/**
 * 同期・メール添付ルートの解析（個別gsheet作成）
 */
function analyzeForIndividualSheet_(file, base64Data, classification, clientFolder, clientName, route, receivedDate) {
  const docType = classification.docType;
  const bankName = classification.bankName || '';
  const accountNumber = classification.accountNumber || '';

  // 個別gsheetを作成
  const destFolder = getOutputFolderForRoute_(clientFolder, route, receivedDate);
  const sheetName = buildAnalysisSheetName_(docType, file.getName(), receivedDate);

  // 既に同名gsheetがあれば再利用（前回エラーで残った空のgsheet等を再利用）
  let newSpreadsheet;
  const existingFiles = destFolder.getFilesByName(sheetName);
  if (existingFiles.hasNext()) {
    newSpreadsheet = SpreadsheetApp.open(existingFiles.next());
  } else {
    newSpreadsheet = SpreadsheetApp.create(sheetName);
    DriveApp.getFileById(newSpreadsheet.getId()).moveTo(destFolder);
  }

  // 書類種別に応じたタブを初期化（参照元PDFファイル列付きヘッダ）
  initializeIndividualSheetTabs_(newSpreadsheet, docType);

  // 詳細解析実行（既存の callGeminiApi を使用）
  const analysisRows = callGeminiApi(base64Data, docType, bankName, newSpreadsheet);
  // 集約gsheet用の書き込み（先頭列に参照元PDFファイル名を入れる）
  writeRowsWithSource_(newSpreadsheet, docType, analysisRows, file.getName(), bankName, accountNumber);

  return {
    action: 'analyzed',
    docType: docType,
    fileName: file.getName(),
    outputUrl: newSpreadsheet.getUrl(),
    rows: analysisRows.length,
    confidence: classification.confidence,
    route: route,
  };
}

/**
 * 個別gsheetに、書類種別に応じたタブを初期化する
 * デフォルトの空シートを書類種別タブにリネーム＋ヘッダ設定
 */
function initializeIndividualSheetTabs_(ss, docType) {
  const headers = getHeadersForDocType_(docType);
  if (!headers) return;

  const sheets = ss.getSheets();
  const defaultSheet = sheets[0];
  // 既に書類種別タブが存在する（再生成の場合）はスキップ
  if (defaultSheet.getName() === docType && defaultSheet.getLastRow() > 0) return;

  defaultSheet.setName(docType);
  if (defaultSheet.getLastRow() === 0) {
    defaultSheet.appendRow(headers);
    defaultSheet.setFrozenRows(1);
  }
}

function getHeadersForDocType_(docType) {
  // 個別gsheet用のヘッダ。先頭に「参照ファイル」列をつけて、
  // 複数PDFが集約されたときにどのPDFの行か追えるようにする。
  // 税区はレシート/請求書系のみ追加。
  switch (docType) {
    case 'レシート・領収書':
      return ['参照ファイル', '解析日', '使用者名', '日付', '相手先名称', '10%対象額', '軽減8%対象額', '対象外金額', '税区', '支払総額', '主な品名', 'インボイス番号', '備考'];
    case 'クレジットカード利用明細書':
      return ['参照ファイル', '解析日', 'カード会社名', '利用日', '利用先名称', '利用金額', '支払区分', '備考'];
    case '通帳':
      return ['参照ファイル', '解析日', '銀行名', '口座番号', '年月日', '摘要', '入金額', '出金額', '残高', '備考'];
    case '売上請求書':
      return ['参照ファイル', '解析日', '請求日', '請求相手先名称', '案件名', '10%売上高', '軽減8%売上高', '不課税売上高', '税区', '総売上高', '備考'];
    case '仕入請求書':
      return ['参照ファイル', '解析日', '請求日', '相手方名称', '主たる購入品目', '10%仕入高', '軽減8%仕入高', '不課税仕入高', '税区', '総仕入高', '備考'];
    case '賃貸送金明細':
      return ['参照ファイル', '解析日', '対象月', '送金日', '送金元', '物件名', '振込額', '収入額(税抜)', '収入消費税', '手数料', '備考'];
    default:
      return null;
  }
}

/**
 * 個別gsheetに解析結果を書き込む（先頭列に「参照元PDFファイル」を入れる）
 * 通帳以外は同一日付内の集約gsheetなので、複数PDFの行が混在する。
 */
function writeRowsWithSource_(ss, docType, rows, sourceFileName, bankName, accountNumber) {
  const sheet = ss.getSheetByName(docType);
  if (!sheet) return;
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

  switch (docType) {
    case 'レシート・領収書':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          '',  // 使用者名（同期/メール添付ルートでは空）
          row['日付'] || '',
          row['相手先名称'] || '',
          row['10%対象額'] || 0,
          row['軽減8%対象額'] || 0,
          row['対象外金額'] || 0,
          determineTaxCategory_(row, 'receipt'),
          row['支払総額'] || 0,
          row['主な品名'] || '',
          row['インボイス番号'] || '',
          row['備考'] || ''
        ]);
      });
      break;

    case 'クレジットカード利用明細書':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          row['カード会社名'] || '',
          row['利用日'] || '',
          row['利用先名称'] || '',
          row['利用金額'] || 0,
          row['支払区分'] || '',
          row['備考'] || ''
        ]);
      });
      break;

    case '通帳':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          bankName || row['銀行名'] || '',
          accountNumber || row['口座番号'] || '',
          row['年月日'] || '',
          row['摘要'] || '',
          row['入金額'] || 0,
          row['出金額'] || 0,
          row['残高'] || 0,
          row['備考'] || ''
        ]);
      });
      break;

    case '売上請求書':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          row['請求日'] || '',
          row['請求相手先名称'] || '',
          row['案件名'] || '',
          row['10%売上高'] || 0,
          row['軽減8%売上高'] || 0,
          row['不課税売上高'] || 0,
          determineTaxCategory_(row, 'sales'),
          row['総売上高'] || 0,
          row['備考'] || ''
        ]);
      });
      break;

    case '仕入請求書':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          row['請求日'] || '',
          row['相手方名称'] || '',
          row['主たる購入品目'] || '',
          row['10%仕入高'] || 0,
          row['軽減8%仕入高'] || 0,
          row['不課税仕入高'] || 0,
          determineTaxCategory_(row, 'purchase'),
          row['総仕入高'] || 0,
          row['備考'] || ''
        ]);
      });
      break;

    case '賃貸送金明細':
      rows.forEach(row => {
        sheet.appendRow([
          sourceFileName,
          today,
          row['対象月'] || '',
          row['送金日'] || '',
          row['送金元'] || '',
          row['物件名'] || '',
          row['振込額'] || 0,
          row['収入額'] || 0,
          row['収入消費税'] || 0,
          row['手数料'] || 0,
          row['備考'] || ''
        ]);
      });
      break;
  }
}

/**
 * スマホ撮影用の解析結果スプレッドシートを取得or作成（新仕様：解析データ/スマホ撮影/ に配置）
 */
function getOrCreateClientAnalysisSheetInSmartphone_(clientFolder, clientName) {
  const smartphoneFolder = getOrCreateAnalysisSmartphoneFolder_(clientFolder);
  const sheetName = `${clientName}_解析結果`;
  const existing = smartphoneFolder.getFilesByName(sheetName);
  if (existing.hasNext()) {
    return SpreadsheetApp.open(existing.next());
  }
  // 既存（顧問先ルート直下）にあれば移動
  const rootExisting = clientFolder.getFilesByName(sheetName);
  if (rootExisting.hasNext()) {
    const file = rootExisting.next();
    file.moveTo(smartphoneFolder);
    return SpreadsheetApp.open(file);
  }
  // 新規作成
  const ss = SpreadsheetApp.create(sheetName);
  const file = DriveApp.getFileById(ss.getId());
  file.moveTo(smartphoneFolder);
  return ss;
}


// ============================================================
// 要確認シート
// ============================================================

/**
 * 要確認シートに行を追加（信頼度低・分類不能のファイルを記録）
 */
function addToReviewQueue_(clientName, fileName, fileId, docType, confidence, route, note) {
  const ss = getOrCreateLogSheet();
  let sheet = ss.getSheetByName('要確認');
  if (!sheet) {
    sheet = ss.insertSheet('要確認');
    sheet.appendRow([
      '受信日時', '顧問先', 'ファイル名', 'ルート',
      '判定種別', '信頼度', 'ファイルID', '備考', '対応状況'
    ]);
    sheet.setFrozenRows(1);
    // 列幅調整
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 280);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 140);
    sheet.setColumnWidth(6, 80);
    sheet.setColumnWidth(7, 260);
    sheet.setColumnWidth(8, 200);
    sheet.setColumnWidth(9, 100);
  }
  const routeLabel = (route === 'sync') ? 'ファイル同期'
                   : (route === 'email') ? 'メール添付'
                   : (route === 'smartphone') ? 'スマホ撮影' : route;
  sheet.appendRow([
    new Date(),
    clientName,
    fileName,
    routeLabel,
    docType,
    confidence,
    fileId,
    note,
    '未対応',
  ]);
}


// ============================================================
// ルート別: ファイル同期で受信したファイルの一括解析
// ============================================================

/**
 * 「顧問先→税理士」フォルダのファイルを解析（新仕様）
 * 各ファイルを個別gsheetに出力
 *
 * 既存の analyzeSyncedFiles() を置き換える新版
 */
function analyzeSyncedFilesV2() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) {
    throw new Error('親フォルダが取得できません');
  }
  const ss = getOrCreateLogSheet();
  const syncLogSheet = ensureSyncFileLogSheet_(ss);

  // 解析済みファイルIDを収集
  const processedIds = collectProcessedFileIds_(syncLogSheet);

  const results = [];
  let analyzedThisRun = 0;  // この実行で実際に解析した件数（タイムアウト防止）
  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();
    if (clientName.startsWith('_')) continue;

    // 「→税理士」を含むサブフォルダだけ対象
    const subs = clientFolder.getFolders();
    while (subs.hasNext()) {
      const sub = subs.next();
      const subName = sub.getName();
      if (subName.indexOf('→税理士') < 0) continue;

      // 再帰的にファイルを集める（顧問先がサブフォルダ R8.3期/ 等を作る場合に対応）
      const allFiles = collectFilesRecursive_(sub);
      for (let i = 0; i < allFiles.length; i++) {
        const fileInfo = allFiles[i];
        const file = fileInfo.file;
        if (processedIds.has(file.getId())) continue;

        // 解析対象（PDF/画像）のみ件数制限の対象。Excel等のコピーは制限外
        const ext = getExtension_(file.getName());
        const isAnalyzable = ANALYZABLE_EXTENSIONS.indexOf(ext) >= 0;

        if (isAnalyzable && analyzedThisRun >= MAX_ANALYZE_FILES_PER_RUN) {
          // タイムアウト防止: 解析件数が上限に達したPDFは次回に回す
          results.push({
            action: 'pending',
            clientName: clientName,
            fileName: file.getName(),
            route: 'sync',
          });
          continue;
        }

        const result = analyzeFileToAnalysisFolder_({
          file: file,
          clientFolder: clientFolder,
          clientName: clientName,
          route: 'sync',
          receivedDate: new Date(),
        });
        result.clientName = clientName;
        // 相対パス（サブフォルダの中なら "2026-3/file.xlsx" のように）
        result.sourceFolder = subName + (fileInfo.relPath ? '/' + fileInfo.relPath : '');
        result.fileName = fileInfo.relPath ? fileInfo.relPath + '/' + file.getName() : file.getName();
        results.push(result);

        // Gemini を呼んだファイル（analyzed）のみカウント。copied/error/skipped は無料相当なので数えない
        if (result.action === 'analyzed') {
          analyzedThisRun++;
        }

        // ログに記録（再処理防止）。pending はログ残さず次回再処理
        if (result.action !== 'pending') {
          syncLogSheet.appendRow([
            new Date(), clientName, result.sourceFolder, file.getName(),
            result.docType || result.action, result.confidence || '',
            file.getId(), result.note || result.error || result.action
          ]);
        }
      }
    }
  }

  console.log(`同期ファイル解析V2 完了: ${results.length}件処理`);
  // 結果サマリーを保存（通知メールで使う）
  saveAnalysisSummary_(results);
  return results;
}

// フォルダ配下のファイルを再帰的に収集（相対パス情報付き）
function collectFilesRecursive_(folder, relPath) {
  relPath = relPath || '';
  const out = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    out.push({ file: files.next(), relPath: relPath });
  }
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    const childRel = relPath ? relPath + '/' + sub.getName() : sub.getName();
    const childFiles = collectFilesRecursive_(sub, childRel);
    for (let i = 0; i < childFiles.length; i++) out.push(childFiles[i]);
  }
  return out;
}

function ensureSyncFileLogSheet_(ss) {
  let sheet = ss.getSheetByName('同期ファイル解析ログ');
  if (!sheet) {
    sheet = ss.insertSheet('同期ファイル解析ログ');
    sheet.appendRow([
      '解析日時', '顧問先名', '元フォルダ', 'ファイル名',
      '判定種別', '判定確度', 'ファイルID', '備考'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// エラーで永久にループしないよう、リトライは MAX_ERROR_RETRIES 回まで
const MAX_ERROR_RETRIES = 3;

function collectProcessedFileIds_(syncLogSheet) {
  const data = syncLogSheet.getDataRange().getValues();
  const set = new Set();
  const errorCounts = {};

  for (let i = 1; i < data.length; i++) {
    const action = data[i][4];
    const fileId = data[i][6];
    if (!fileId) continue;

    if (action === 'error' || action === 'エラー') {
      // エラー回数をカウント。MAX_ERROR_RETRIES 回を超えたら永久スキップ
      errorCounts[fileId] = (errorCounts[fileId] || 0) + 1;
      if (errorCounts[fileId] >= MAX_ERROR_RETRIES) {
        set.add(fileId);  // これ以上リトライしない（無限ループ防止）
      }
    } else {
      // 成功・コピー済み・要確認等は処理済みとして除外
      set.add(fileId);
    }
  }
  return set;
}


// ============================================================
// ルート別: メール添付資料 の一括解析
// ============================================================

/**
 * メール添付資料/YYYY年MM月DD日受信分/ のファイルを解析
 */
function analyzeEmailAttachments() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) {
    throw new Error('親フォルダが取得できません');
  }
  const ss = getOrCreateLogSheet();
  const logSheet = ensureEmailFileLogSheet_(ss);
  const processedIds = collectProcessedFileIds_(logSheet);

  const results = [];
  let analyzedThisRun = 0;
  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();
    if (clientName.startsWith('_')) continue;

    const emailRoot = clientFolder.getFoldersByName(ANALYSIS_FOLDERS.EMAIL_ATTACHMENT);
    if (!emailRoot.hasNext()) continue;
    const emailRootFolder = emailRoot.next();

    // 日付フォルダ ごと
    const dateFolders = emailRootFolder.getFolders();
    while (dateFolders.hasNext()) {
      const dateFolder = dateFolders.next();
      const dateFolderName = dateFolder.getName();
      // 日付を抽出（フォルダ名から）
      const receivedDate = parseDateFromFolderName_(dateFolderName) || new Date();

      const files = dateFolder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (processedIds.has(file.getId())) continue;

        // 解析対象（PDF/画像）のみ件数制限の対象。Excel等のコピーは制限外
        const ext = getExtension_(file.getName());
        const isAnalyzable = ANALYZABLE_EXTENSIONS.indexOf(ext) >= 0;

        if (isAnalyzable && analyzedThisRun >= MAX_ANALYZE_FILES_PER_RUN) {
          results.push({
            action: 'pending',
            clientName: clientName,
            fileName: file.getName(),
            route: 'email',
          });
          continue;
        }

        const result = analyzeFileToAnalysisFolder_({
          file: file,
          clientFolder: clientFolder,
          clientName: clientName,
          route: 'email',
          receivedDate: receivedDate,
        });
        result.clientName = clientName;
        result.sourceFolder = ANALYSIS_FOLDERS.EMAIL_ATTACHMENT + '/' + dateFolderName;
        results.push(result);

        if (result.action === 'analyzed') analyzedThisRun++;

        if (result.action !== 'pending') {
          logSheet.appendRow([
            new Date(), clientName, dateFolderName, file.getName(),
            result.docType || result.action, result.confidence || '',
            file.getId(), result.note || result.error || result.action
          ]);
        }
      }
    }
  }

  console.log(`メール添付解析 完了: ${results.length}件処理`);
  saveAnalysisSummary_(results);
  return results;
}

function ensureEmailFileLogSheet_(ss) {
  let sheet = ss.getSheetByName('メール添付解析ログ');
  if (!sheet) {
    sheet = ss.insertSheet('メール添付解析ログ');
    sheet.appendRow([
      '解析日時', '顧問先名', '受信日フォルダ', 'ファイル名',
      '判定種別', '判定確度', 'ファイルID', '備考'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 「YYYY年MM月DD日受信分」「YYYY年MM月DD日同期分」からDateを抽出
 */
function parseDateFromFolderName_(name) {
  const m = name.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}


// ============================================================
// 解析サマリーの保存（通知メールで使う）
// ============================================================

function saveAnalysisSummary_(results) {
  if (!results || results.length === 0) return;
  const existingJson = PropertiesService.getScriptProperties().getProperty('lastAnalysisSummary');
  let existing = [];
  if (existingJson) {
    try { existing = JSON.parse(existingJson); } catch (e) {}
  }
  existing = existing.concat(results);
  // 古いものを切り捨て（最大200件保持）
  if (existing.length > 200) existing = existing.slice(-200);
  PropertiesService.getScriptProperties().setProperty(
    'lastAnalysisSummary', JSON.stringify(existing)
  );
}


// ============================================================
// 統合通知メール（案C: 到着＋解析完了を1通にまとめる）
// ============================================================

/**
 * 全顧問先のスキャン+解析+通知を1回の実行で行う統合関数
 * 10分ごとのトリガーで呼ばれる
 *
 * 流れ:
 *  1) メール添付の保存（processClientEmailAttachments）
 *  2) メール添付の解析（analyzeEmailAttachments）
 *  3) ファイル同期の解析（analyzeSyncedFilesV2）
 *  4) ファイル同期の新着検知（既存のnotifyClientSyncUploads は使わず、ここで統合）
 *  5) 統合通知メールを送信（新着があれば）
 */
function runUnifiedPipeline() {
  console.log('=== 統合パイプライン開始 ===');

  const summary = {
    analyzed: [],        // 解析完了したファイル
    copied: [],          // コピーのみのファイル（Excel等）
    review: [],          // 要確認のファイル
    errors: [],          // エラー
    tooLarge: [],        // サイズ上限超過でスキップ
    pending: [],         // この実行では処理しなかった（次回回し）
    syncUploads: [],     // 同期で新着のファイル（解析対象外も含む）
  };

  // 1) メール添付の保存
  try {
    processClientEmailAttachments();
  } catch (e) {
    console.error('processClientEmailAttachments エラー:', e);
    summary.errors.push({ phase: 'email_intake', message: e.message });
  }

  // 2) メール添付の解析
  try {
    const r = analyzeEmailAttachments();
    classifyResults_(r, summary);
  } catch (e) {
    console.error('analyzeEmailAttachments エラー:', e);
    summary.errors.push({ phase: 'email_analysis', message: e.message });
  }

  // 3) ファイル同期の解析
  try {
    const r = analyzeSyncedFilesV2();
    classifyResults_(r, summary);
  } catch (e) {
    console.error('analyzeSyncedFilesV2 エラー:', e);
    summary.errors.push({ phase: 'sync_analysis', message: e.message });
  }

  // 4) ファイル同期の新着検知（_sync_logs 経由、既存の仕組み流用）
  try {
    summary.syncUploads = collectRecentSyncUploads_();
  } catch (e) {
    console.error('collectRecentSyncUploads_ エラー:', e);
  }

  // 5) 統合通知メールを送信
  const hasNew = summary.analyzed.length > 0
              || summary.copied.length > 0
              || summary.review.length > 0
              || summary.tooLarge.length > 0
              || summary.pending.length > 0
              || summary.syncUploads.length > 0;
  if (hasNew) {
    try {
      sendUnifiedNotification_(summary);
    } catch (e) {
      console.error('sendUnifiedNotification_ エラー:', e);
    }
  } else {
    console.log('新着なし、通知メールは送信しません');
  }

  console.log('=== 統合パイプライン完了 ===');
  return summary;
}

function classifyResults_(results, summary) {
  if (!results || results.length === 0) return;
  results.forEach(r => {
    if (r.action === 'analyzed') summary.analyzed.push(r);
    else if (r.action === 'copied') summary.copied.push(r);
    else if (r.action === 'review') summary.review.push(r);
    else if (r.action === 'error') summary.errors.push(r);
    else if (r.action === 'skipped_too_large') summary.tooLarge.push(r);
    else if (r.action === 'pending') summary.pending.push(r);
  });
}

/**
 * _sync_logs を巡回して、前回チェック以降の同期アップロードを収集
 * （既存の notifyClientSyncUploads と同じロジック）
 */
function collectRecentSyncUploads_() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) return [];

  const props = PropertiesService.getScriptProperties();
  const lastCheckIso = props.getProperty(SYNC_NOTIFY_CONFIG.PROPERTY_KEY);
  const lastCheck = lastCheckIso ? new Date(lastCheckIso) : new Date(Date.now() - 15 * 60 * 1000);
  const now = new Date();

  const allUploads = [];
  let logsScanned = 0;

  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext() && logsScanned < SYNC_NOTIFY_CONFIG.MAX_LOGS_PER_RUN) {
    const clientFolder = clientFolders.next();
    const logsFolders = clientFolder.getFoldersByName(SYNC_NOTIFY_CONFIG.LOGS_FOLDER_NAME);
    if (!logsFolders.hasNext()) continue;
    const logsFolder = logsFolders.next();

    const logFiles = logsFolder.getFiles();
    while (logFiles.hasNext() && logsScanned < SYNC_NOTIFY_CONFIG.MAX_LOGS_PER_RUN) {
      const logFile = logFiles.next();
      const updated = logFile.getLastUpdated();
      if (updated <= lastCheck) continue;
      logsScanned++;

      try {
        let content = logFile.getBlob().getDataAsString('UTF-8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        const data = JSON.parse(content);
        if (!data.operations || !Array.isArray(data.operations)) continue;

        data.operations.forEach(op => {
          if (op.operation === 'upload' || op.operation === 'update_upload') {
            allUploads.push({
              clientName: data.client_name || op.client_name || '(不明)',
              deviceName: data.device_name || op.device_name || '',
              filePath: op.file_path || '(ファイル名不明)',
              sizeBytes: Number(op.size_bytes) || 0,
              operation: op.operation,
            });
          }
        });
      } catch (e) {
        console.error(`ログ解析エラー: ${logFile.getName()} - ${e}`);
      }
    }
  }

  props.setProperty(SYNC_NOTIFY_CONFIG.PROPERTY_KEY, now.toISOString());
  return allUploads;
}

/**
 * 統合通知メールを送信
 */
function sendUnifiedNotification_(summary) {
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const totalAnalyzed = summary.analyzed.length;
  const totalCopied = summary.copied.length;
  const totalReview = summary.review.length;
  const totalTooLarge = summary.tooLarge.length;
  const totalPending = summary.pending.length;
  const totalSyncUploads = summary.syncUploads.length;

  // 件名
  let subjectParts = [`解析${totalAnalyzed}件`, `コピー${totalCopied}件`, `要確認${totalReview}件`];
  if (totalTooLarge > 0) subjectParts.push(`サイズ超過${totalTooLarge}件`);
  if (totalPending > 0) subjectParts.push(`待機${totalPending}件`);
  const subject = `【新着処理完了】${subjectParts.join(' / ')} - ${nowStr}`;

  // HTML本文（絵文字を使わずプレーン記号で構築）
  let html = `
<div style="font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; max-width: 700px;">
  <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">
    新着処理サマリー
  </h2>
  <p style="color: #666;">
    ${nowStr} 時点での処理結果です。
  </p>
  <div style="background: #e8f0fe; padding: 12px; border-radius: 6px; margin: 16px 0;">
    <strong>■ 件数</strong><br>
    自動解析完了: ${totalAnalyzed} 件 ／ コピーのみ: ${totalCopied} 件 ／
    要確認: ${totalReview} 件 ／ サイズ超過: ${totalTooLarge} 件 ／
    待機中（次回回し）: ${totalPending} 件 ／ 同期新着: ${totalSyncUploads} 件
  </div>
`;

  // 自動解析完了
  if (totalAnalyzed > 0) {
    html += renderSection_('■ 自動解析完了', summary.analyzed, true);
  }

  // コピーのみ（Excel等）
  if (totalCopied > 0) {
    html += renderSection_('■ コピーのみ（Excel等）', summary.copied, false);
  }

  // 要確認
  if (totalReview > 0) {
    html += `
<div style="background: #fff3e0; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f57c00;">
  <h3 style="margin: 0 0 12px 0; color: #e65100;">【要確認】 ${totalReview}件</h3>
  <p style="font-size: 13px; color: #666; margin-bottom: 8px;">
    信頼度低・分類不能のため、人の目でチェックしてください。
    <a href="${getLogSheetUrl_()}" style="color: #1a73e8;">要確認シートを開く →</a>
  </p>
  <ul style="margin: 0; padding-left: 20px;">
`;
    summary.review.forEach(r => {
      html += `<li style="font-size: 13px; margin: 4px 0;">[${escapeHtml_(r.docType || '不明')}] ${escapeHtml_(r.fileName)} <small>(${escapeHtml_(r.clientName || '')}, ${escapeHtml_(r.route || '')})</small></li>`;
    });
    html += '</ul></div>';
  }

  // サイズ超過
  if (totalTooLarge > 0) {
    html += '<div style="background: #fff8e1; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f9a825;">';
    html += `<h3 style="margin: 0 0 12px 0; color: #f57f17;">【サイズ超過】 ${totalTooLarge}件（解析せずスキップ）</h3>`;
    html += `<p style="font-size: 13px; color: #666; margin-bottom: 8px;">${MAX_ANALYZE_BYTES / 1024 / 1024} MB を超えるファイルは自動解析の対象外です。手動でご確認ください。</p>`;
    html += '<ul style="margin: 0; padding-left: 20px;">';
    summary.tooLarge.forEach(r => {
      const mb = Math.round(r.sizeBytes / 1024 / 1024 * 10) / 10;
      html += `<li style="font-size: 13px;">${escapeHtml_(r.fileName)} <small style="color: #888;">(${mb} MB, ${escapeHtml_(r.clientName || '')})</small></li>`;
    });
    html += '</ul></div>';
  }

  // 待機中（次回回し）
  if (totalPending > 0) {
    html += '<div style="background: #e3f2fd; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #1976d2;">';
    html += `<h3 style="margin: 0 0 8px 0; color: #0d47a1;">【待機中】 ${totalPending}件（次回以降に処理）</h3>`;
    html += `<p style="font-size: 13px; color: #666;">1回の実行で処理する上限（${MAX_ANALYZE_FILES_PER_RUN}件/回）を超えたため、次回以降の10分ごと実行で順次処理されます。何もしなくて OK。</p>`;
    html += '</div>';
  }

  // 同期新着（解析対象外も含めて全部報告）
  if (totalSyncUploads > 0) {
    html += '<div style="background: #f1f8e9; border-radius: 8px; padding: 16px; margin: 16px 0;">';
    html += `<h3 style="margin: 0 0 12px 0; color: #33691e;">■ ファイル同期 新着 (${totalSyncUploads}件)</h3>`;
    const grouped = groupBy_(summary.syncUploads, u => `${u.clientName}（${u.deviceName}）`);
    Object.keys(grouped).sort().forEach(key => {
      const items = grouped[key];
      html += `<p style="font-size: 14px; margin: 8px 0 4px 0;"><strong>${escapeHtml_(key)}</strong></p><ul style="margin: 0; padding-left: 20px;">`;
      items.forEach(u => {
        const sizeKb = u.sizeBytes > 0 ? Math.round(u.sizeBytes / 1024) : 0;
        const tag = u.operation === 'update_upload' ? '更新' : '新規';
        const sizeText = sizeKb > 0 ? ` (${sizeKb} KB)` : '';
        html += `<li style="font-size: 13px; margin: 2px 0;">[${tag}] ${escapeHtml_(u.filePath)}${sizeText}</li>`;
      });
      html += '</ul>';
    });
    html += '</div>';
  }

  // エラー
  if (summary.errors.length > 0) {
    html += '<div style="background: #ffebee; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #c62828;">';
    html += `<h3 style="margin: 0 0 12px 0; color: #b71c1c;">【エラー】 ${summary.errors.length}件</h3><ul>`;
    summary.errors.forEach(e => {
      html += `<li style="font-size: 13px;">${escapeHtml_(e.phase || '')}: ${escapeHtml_(e.message || e.error || '')}</li>`;
    });
    html += '</ul></div>';
  }

  html += `
  <p style="color: #999; font-size: 12px; margin-top: 20px;">
    このメールは10分ごとに、新着があった時のみ送信されます。
  </p>
</div>
`;

  GmailApp.sendEmail(
    CONFIG.NOTIFICATION_EMAIL,
    subject,
    `解析${totalAnalyzed}件 / コピー${totalCopied}件 / 要確認${totalReview}件 / 同期新着${totalSyncUploads}件`,
    { htmlBody: html }
  );
  console.log(`統合通知メール送信: 解析${totalAnalyzed} / コピー${totalCopied} / 要確認${totalReview} / 同期${totalSyncUploads}`);
}

function renderSection_(title, items, withLink) {
  const grouped = groupBy_(items, r => r.clientName || '(不明)');
  let html = `<div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 12px 0; color: #333;">${title}（${items.length}件）</h3>`;
  Object.keys(grouped).sort().forEach(name => {
    const subs = grouped[name];
    html += `<p style="font-size: 14px; margin: 8px 0 4px 0;"><strong>${escapeHtml_(name)}</strong></p><ul style="margin: 0; padding-left: 20px;">`;
    subs.forEach(r => {
      const linkPart = (withLink && r.outputUrl)
        ? ` <a href="${r.outputUrl}" style="color: #1a73e8; font-size: 12px;">解析結果を開く →</a>`
        : '';
      const tag = r.docType ? `[${escapeHtml_(r.docType)}]` : '';
      const routeLabel = (r.route === 'sync') ? 'ファイル同期'
                       : (r.route === 'email') ? 'メール添付'
                       : (r.route === 'smartphone') ? 'スマホ撮影' : (r.route || '');
      html += `<li style="font-size: 13px; margin: 2px 0;">${tag} ${escapeHtml_(r.fileName)} <small style="color: #888;">(${escapeHtml_(routeLabel)})</small>${linkPart}</li>`;
    });
    html += '</ul>';
  });
  html += '</div>';
  return html;
}

function groupBy_(items, keyFn) {
  const out = {};
  items.forEach(it => {
    const k = keyFn(it);
    if (!out[k]) out[k] = [];
    out[k].push(it);
  });
  return out;
}

function getLogSheetUrl_() {
  try {
    const ss = getOrCreateLogSheet();
    return ss.getUrl();
  } catch (e) {
    return '';
  }
}


// ============================================================
// テスト用
// ============================================================

function testSetupAnalysisFolders() {
  setupAnalysisFolders();
}

function testAnalyzeSyncedFilesV2() {
  analyzeSyncedFilesV2();
}

function testAnalyzeEmailAttachments() {
  analyzeEmailAttachments();
}

function testRunUnifiedPipeline() {
  runUnifiedPipeline();
}

// 既存スプレッドシートに「税区」「参照ファイル」列を追加するマイグレーション
// レシート/売上請求書/仕入請求書には税区を、全タブ末尾に参照ファイルを追加
function migrateAddTaxCategoryAndSourceColumns() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) throw new Error('親フォルダが取得できません');

  // タブ別の列追加設定（税区を挿入する列名、参照ファイルは末尾追加）
  const tabConfig = {
    'レシート・領収書': { taxInsertBefore: '支払総額' },
    '売上請求書': { taxInsertBefore: '総売上高' },
    '仕入請求書': { taxInsertBefore: '総仕入高' },
    'クレジットカード利用明細書': {},
    '通帳': {},
    '賃貸送金明細': {},
  };

  let processed = 0;
  let taxAdded = 0;
  let refAdded = 0;

  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();
    if (clientName.startsWith('_')) continue;

    const sheetName = `${clientName}_解析結果`;
    let ss = null;
    const ar = clientFolder.getFoldersByName('解析データ');
    if (ar.hasNext()) {
      const sp = ar.next().getFoldersByName('スマホ撮影');
      if (sp.hasNext()) {
        const fs = sp.next().getFilesByName(sheetName);
        if (fs.hasNext()) ss = SpreadsheetApp.open(fs.next());
      }
    }
    if (!ss) {
      const fs2 = clientFolder.getFilesByName(sheetName);
      if (fs2.hasNext()) ss = SpreadsheetApp.open(fs2.next());
    }
    if (!ss) continue;
    processed++;

    Object.keys(tabConfig).forEach(tabName => {
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) return;
      const cfg = tabConfig[tabName];
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return;
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

      // 税区列の挿入
      if (cfg.taxInsertBefore && headers.indexOf('税区') < 0) {
        const idx = headers.indexOf(cfg.taxInsertBefore);
        if (idx >= 0) {
          const insertAt = idx + 1; // 1始まり
          sheet.insertColumnBefore(insertAt);
          sheet.getRange(1, insertAt).setValue('税区');
          headers.splice(idx, 0, '税区');
          taxAdded++;
        }
      }

      // 参照ファイル列の末尾追加
      const refreshed = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (refreshed.indexOf('参照ファイル') < 0) {
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue('参照ファイル');
        refAdded++;
      }
    });

    console.log(`  ${clientName}: マイグレーション処理済み`);
  }

  console.log(`=== 完了: ${processed}スプレッドシート / 税区追加 ${taxAdded}タブ / 参照ファイル追加 ${refAdded}タブ ===`);
}

// 既存スプレッドシートに「賃貸送金明細」タブを追加
function migrateAddRemittanceTab() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) throw new Error('親フォルダが取得できません');

  let added = 0;
  let alreadyDone = 0;

  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();
    if (clientName.startsWith('_')) continue;

    const sheetName = `${clientName}_解析結果`;
    let ss = null;
    const arFolders = clientFolder.getFoldersByName('解析データ');
    if (arFolders.hasNext()) {
      const sp = arFolders.next().getFoldersByName('スマホ撮影');
      if (sp.hasNext()) {
        const fs = sp.next().getFilesByName(sheetName);
        if (fs.hasNext()) ss = SpreadsheetApp.open(fs.next());
      }
    }
    if (!ss) {
      const fs2 = clientFolder.getFilesByName(sheetName);
      if (fs2.hasNext()) ss = SpreadsheetApp.open(fs2.next());
    }
    if (!ss) continue;

    if (ss.getSheetByName('賃貸送金明細')) {
      alreadyDone++;
      console.log(`  ${clientName}: 賃貸送金明細タブは既に存在`);
      continue;
    }
    const sheet = ss.insertSheet('賃貸送金明細');
    sheet.appendRow(['解析日', '対象月', '送金日', '送金元', '物件名', '振込額', '収入額(税抜)', '収入消費税', '手数料', '備考']);
    sheet.setFrozenRows(1);
    added++;
    console.log(`  ${clientName}: 賃貸送金明細タブを追加`);
  }
  console.log(`=== 完了: ${added}件追加 / ${alreadyDone}件既存 ===`);
}

// ============================================================
// 既存スプレッドシート「レシート・領収書」タブに「対象外金額」列を追加
// （既に追加済みのものはスキップ・安全に再実行可）
// ============================================================
function migrateReceiptTabAddTaxFreeColumn() {
  const parentFolder = getParentFolder_();
  if (!parentFolder) throw new Error('親フォルダが取得できません');

  let processed = 0;
  let updated = 0;
  let alreadyDone = 0;

  const clientFolders = parentFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();
    if (clientName.startsWith('_')) continue;

    const sheetName = `${clientName}_解析結果`;
    // 解析データ/スマホ撮影/ 内のスプレッドシートを優先
    let ss = null;
    const arFolders = clientFolder.getFoldersByName('解析データ');
    if (arFolders.hasNext()) {
      const ar = arFolders.next();
      const sp = ar.getFoldersByName('スマホ撮影');
      if (sp.hasNext()) {
        const spFolder = sp.next();
        const fs = spFolder.getFilesByName(sheetName);
        if (fs.hasNext()) ss = SpreadsheetApp.open(fs.next());
      }
    }
    // 旧仕様（顧問先フォルダ直下）も念のため確認
    if (!ss) {
      const fs2 = clientFolder.getFilesByName(sheetName);
      if (fs2.hasNext()) ss = SpreadsheetApp.open(fs2.next());
    }

    if (!ss) {
      // スプレッドシート未作成（スマホ撮影実績なし）
      continue;
    }
    processed++;

    const sheet = ss.getSheetByName('レシート・領収書');
    if (!sheet) {
      console.log(`  ${clientName}: レシート・領収書タブなし`);
      continue;
    }

    // ヘッダ行を確認
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // 既に「対象外金額」列がある？
    if (headers.indexOf('対象外金額') >= 0) {
      alreadyDone++;
      console.log(`  ${clientName}: 対象外金額列は既に存在`);
      continue;
    }

    // 「支払総額」列の前に挿入する
    const totalIdx = headers.indexOf('支払総額');
    if (totalIdx < 0) {
      console.warn(`  ${clientName}: 支払総額列が見つかりません`);
      continue;
    }

    // 「支払総額」の位置（1始まり）に1列挿入
    const insertAt = totalIdx + 1; // 0-indexed totalIdx → 1-indexed insertAt が「支払総額」の列
    sheet.insertColumnBefore(insertAt);
    sheet.getRange(1, insertAt).setValue('対象外金額');
    // 既存データ行は空欄（0 ではなく空）にしておく
    updated++;
    console.log(`  ${clientName}: 対象外金額列を追加`);
  }

  console.log(`=== マイグレーション完了: ${processed}スプレッドシート確認 / ${updated}件追加 / ${alreadyDone}件既存 ===`);
}
