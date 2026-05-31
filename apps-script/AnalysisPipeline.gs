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
 *   [書類種別]解析データ_[元ファイル名]_YYYY年MM月DD日受領分
 */
function buildAnalysisSheetName_(docType, originalFileName, date) {
  const dateStr = formatDateJa_(date);
  // 元ファイル名から拡張子除去
  const baseName = stripExtension_(originalFileName);
  return `${docType}解析データ_${baseName}_${dateStr}受領分`;
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

  // Spreadsheet作成 → 指定フォルダに移動
  const newSpreadsheet = SpreadsheetApp.create(sheetName);
  const newFile = DriveApp.getFileById(newSpreadsheet.getId());
  newFile.moveTo(destFolder);

  // 詳細解析実行（既存の callGeminiApi を使用）
  const analysisRows = callGeminiApi(base64Data, docType, bankName, newSpreadsheet);
  writeAnalysisResult(newSpreadsheet, docType, analysisRows, bankName, accountNumber, '');

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

      const files = sub.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (processedIds.has(file.getId())) continue;

        const result = analyzeFileToAnalysisFolder_({
          file: file,
          clientFolder: clientFolder,
          clientName: clientName,
          route: 'sync',
          receivedDate: new Date(),
        });
        result.clientName = clientName;
        result.sourceFolder = subName;
        results.push(result);

        // ログに記録（再処理防止）
        syncLogSheet.appendRow([
          new Date(), clientName, subName, file.getName(),
          result.docType || result.action, result.confidence || '',
          file.getId(), result.note || result.error || result.action
        ]);
      }
    }
  }

  console.log(`同期ファイル解析V2 完了: ${results.length}件処理`);
  // 結果サマリーを保存（通知メールで使う）
  saveAnalysisSummary_(results);
  return results;
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

function collectProcessedFileIds_(syncLogSheet) {
  const data = syncLogSheet.getDataRange().getValues();
  const set = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][6]) set.add(data[i][6]);
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

        logSheet.appendRow([
          new Date(), clientName, dateFolderName, file.getName(),
          result.docType || result.action, result.confidence || '',
          file.getId(), result.note || result.error || result.action
        ]);
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
