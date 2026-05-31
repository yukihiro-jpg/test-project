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
// テスト用
// ============================================================

function testSetupAnalysisFolders() {
  setupAnalysisFolders();
}
