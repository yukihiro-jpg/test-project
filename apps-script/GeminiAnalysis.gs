/**
 * Gemini API によるドキュメント解析
 *
 * AM3:00 に実行され、前回解析以降にアップロードされた書類を
 * Gemini API で解析し、顧問先別スプレッドシートに書き込む
 */

/**
 * APIキーの設定方法:
 * Apps Scriptエディタ → 左メニュー「プロジェクトの設定」（歯車アイコン）
 * → 下部「スクリプトプロパティ」→「スクリプトプロパティを追加」
 * → プロパティ名: GEMINI_API_KEY / 値: あなたのAPIキー
 */
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 解析対象の書類種別
const ANALYZABLE_TYPES = ['レシート・領収書', 'クレジットカード利用明細書', '通帳', '売上請求書', '仕入請求書'];

// ============================================================
// メイン: 日次解析処理（AM3:00トリガー）
// ============================================================

function analyzeUploadedDocuments() {
  const ss = getOrCreateLogSheet();
  const sheet = ss.getSheetByName('アップロード履歴');
  const data = sheet.getDataRange().getValues();

  // ステータスが 'pending' かつ解析対象の書類種別を抽出
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    const status = data[i][10];
    const docType = data[i][2];
    if (status === 'pending' && ANALYZABLE_TYPES.indexOf(docType) >= 0) {
      targets.push({
        rowIndex: i + 1,
        clientName: data[i][1],
        docType: data[i][2],
        bankName: data[i][3],
        accountNumber: data[i][4],
        userName: data[i][5],
        pageCount: data[i][6],
        fileId: data[i][8]
      });
    }
  }

  if (targets.length === 0) {
    console.log('解析対象のアップロードはありません');
    return;
  }

  console.log(`解析対象: ${targets.length}件`);

  // 顧問先別にグループ化
  const byClient = {};
  targets.forEach(t => {
    if (!byClient[t.clientName]) byClient[t.clientName] = [];
    byClient[t.clientName].push(t);
  });

  // 顧問先別に処理
  const resultSummary = [];
  Object.keys(byClient).forEach(clientName => {
    const clientTargets = byClient[clientName];
    const clientSheet = getOrCreateClientAnalysisSheet(clientName);

    clientTargets.forEach(target => {
      try {
        console.log(`解析中: ${clientName} / ${target.docType} (fileId: ${target.fileId})`);

        // PDFをDriveから取得
        const file = DriveApp.getFileById(target.fileId);
        const blob = file.getBlob();
        const base64Data = Utilities.base64Encode(blob.getBytes());

        // Gemini APIで解析
        const analysisResult = callGeminiApi(base64Data, target.docType, target.bankName, clientSheet);

        // スプレッドシートに書き込み
        writeAnalysisResult(clientSheet, target.docType, analysisResult, target.bankName, target.accountNumber, target.userName);

        // レシート・領収書の場合、現金出納帳にも書き込み
        if (target.docType === 'レシート・領収書') {
          writeToCashBook(clientSheet, analysisResult);
        }

        // ステータスを更新
        sheet.getRange(target.rowIndex, 11).setValue('analyzed');

        resultSummary.push({
          clientName: clientName,
          docType: target.docType,
          bankName: target.bankName,
          rows: analysisResult.length,
          sheetUrl: clientSheet.getUrl()
        });

        console.log(`解析完了: ${analysisResult.length}行を書き込み`);

      } catch (err) {
        console.error(`解析エラー (${clientName}/${target.docType}):`, err);
        sheet.getRange(target.rowIndex, 11).setValue('analyze_error');
      }
    });
  });

  // 解析結果のサマリーをプロパティに保存（メール送信時に使用）
  if (resultSummary.length > 0) {
    PropertiesService.getScriptProperties().setProperty(
      'lastAnalysisSummary', JSON.stringify(resultSummary)
    );
  }

  console.log(`スマホスキャン解析完了: ${resultSummary.length}件`);

  // 同期ファイルの解析も実行
  console.log('--- 同期ファイル解析を開始 ---');
  analyzeSyncedFiles();
}

// ============================================================
// Gemini API 呼び出し
// ============================================================

function callGeminiApi(base64Pdf, docType, bankName, clientSheet) {
  const prompt = buildPrompt(docType, bankName, clientSheet);

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'application/pdf',
            data: base64Pdf
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(
    `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
    options
  );

  const responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    throw new Error(`Gemini API error (${responseCode}): ${response.getContentText()}`);
  }

  const result = JSON.parse(response.getContentText());
  const text = result.candidates[0].content.parts[0].text;
  let parsed = JSON.parse(text);

  // 通帳の場合は残高検証
  if (docType === '通帳') {
    parsed = verifyBankBalance(parsed, base64Pdf);
  }

  return Array.isArray(parsed) ? parsed : [parsed];
}

// ============================================================
// 書類種別ごとのプロンプト
// ============================================================

function buildPrompt(docType, bankName, clientSheet) {
  switch (docType) {
    case 'レシート・領収書':
      return `この画像はレシートまたは領収書です。以下の情報をJSON配列で抽出してください。
1枚のレシートにつき1つのJSONオブジェクトです。複数枚ある場合は配列に複数入れてください。

各オブジェクトのキー:
- "日付": "YYYY/MM/DD"形式
- "相手先名称": 店舗名・発行者名
- "10%対象額": 消費税10%対象の税込金額（数値、該当なしは0）
- "軽減8%対象額": 軽減税率8%対象の税込金額（数値、該当なしは0）
- "支払総額": 支払い合計金額（数値）
- "主な品名": そのレシート内で一番金額の大きい品目の名前
- "インボイス番号": T+13桁の登録番号（見つからなければ空文字""）
- "備考": 読み取りに不確実な部分があれば記載、なければ空文字""

JSON配列のみを返してください。説明文は不要です。`;

    case 'クレジットカード利用明細書':
      return `この画像はクレジットカード利用明細書です。
全ての利用明細を1行ずつJSON配列で抽出してください。

各オブジェクトのキー:
- "カード会社名": クレジットカード会社名（例: 三井住友カード、楽天カード等）
- "利用日": "YYYY/MM/DD"形式
- "利用先名称": 店舗名・サービス名
- "利用金額": 利用金額（数値）
- "支払区分": 1回払い/分割/リボ等（記載があれば）、なければ空文字""
- "備考": 読み取りが不確実な箇所があれば「読取不確実」と記載、なければ空文字""

重要:
- 年会費、利息、手数料なども1行として記録してください
- 金額のカンマは除去し、数値型で返してください
- カード会社名が明細書のヘッダー等に記載されていれば、全行に同じ値を入れてください

JSON配列のみを返してください。説明文は不要です。`;

    case '通帳':
      return `この書類は銀行通帳または銀行取引明細です${bankName ? `（${bankName}）` : ''}。
全ての取引明細を1行ずつJSON配列で抽出してください。

抽出対象の列:
取引日（日付）、摘要（取引内容）、出金額、入金額、残高の5項目のみを抽出してください。
それ以外の列（支払い額の内訳、受取り額の内訳、法人・個人の区分、振り金・預り金の区分など）は全て無視してください。

ファイルに複数のシート（タブ）がある場合:
各シートはそれぞれ別の口座を表している可能性があります。
全シートを読み取り、各行に銀行名と口座番号を含めてください。
シート名やシート内の記載から銀行名と口座番号を推測してください。

各オブジェクトのキー:
- "銀行名": 銀行名（シート名やヘッダーから推測。不明なら空文字""）
- "口座番号": 口座番号（シート名やヘッダーから推測。不明なら空文字""）
- "年月日": "YYYY/MM/DD"形式（年が省略されている場合は他の情報から推測してください）
- "摘要": 取引の摘要・内容
- "入金額": 入金額（数値、入金でなければ0）
- "出金額": 出金額（数値、出金でなければ0）
- "残高": その取引後の残高（数値）
- "備考": 読み取りが不確実な箇所があれば「読取不確実」と記載、なければ空文字""

重要:
- 残高は前の行の残高+入金額-出金額と一致するはずです
- 一致しない場合は画像をよく確認し、正確な数値を読み取ってください
- それでも不一致の場合は備考に「残高不一致:計算上はXXX円」と記載してください
- 金額のカンマは除去し、数値型で返してください
- ヘッダー行やタイトル行はデータとして含めないでください

JSON配列のみを返してください。説明文は不要です。`;

    case '売上請求書':
      return `この画像は売上請求書です。以下の情報をJSON配列で抽出してください。
1枚の請求書につき1つのJSONオブジェクトです。

各オブジェクトのキー:
- "請求日": "YYYY/MM/DD"形式
- "請求相手先名称": 請求先の会社名・個人名
- "案件名": 案件名・件名（記載がなければ空文字""）
- "10%売上高": 消費税10%対象の税抜売上高（数値、該当なしは0）
- "軽減8%売上高": 軽減税率8%対象の税抜売上高（数値、該当なしは0）
- "不課税売上高": 不課税の売上高（数値、該当なしは0）
- "総売上高": 税込の請求総額（数値）
- "備考": 読み取りに不確実な部分があれば記載、なければ空文字""

JSON配列のみを返してください。説明文は不要です。`;

    case '仕入請求書':
      return `この画像は仕入請求書（経費の請求書）です。以下の情報をJSON配列で抽出してください。
1枚の請求書につき1つのJSONオブジェクトです。

各オブジェクトのキー:
- "請求日": "YYYY/MM/DD"形式
- "相手方名称": 請求元の会社名・個人名
- "主たる購入品目": 主な購入品目または案件名
- "10%仕入高": 消費税10%対象の税抜仕入高（数値、該当なしは0）
- "軽減8%仕入高": 軽減税率8%対象の税抜仕入高（数値、該当なしは0）
- "不課税仕入高": 不課税の仕入高（数値、該当なしは0）
- "総仕入高": 税込の請求総額（数値）
- "備考": 読み取りに不確実な部分があれば記載、なければ空文字""

JSON配列のみを返してください。説明文は不要です。`;

    default:
      return `この書類の内容をJSON形式で要約してください。`;
  }
}

// ============================================================
// 通帳の残高検証
// ============================================================

function verifyBankBalance(rows, base64Pdf) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;

  let hasError = false;
  for (let i = 1; i < rows.length; i++) {
    const prevBalance = Number(rows[i - 1]['残高']) || 0;
    const deposit = Number(rows[i]['入金額']) || 0;
    const withdrawal = Number(rows[i]['出金額']) || 0;
    const actualBalance = Number(rows[i]['残高']) || 0;
    const expectedBalance = prevBalance + deposit - withdrawal;

    if (expectedBalance !== actualBalance) {
      hasError = true;
      rows[i]['備考'] = `残高不一致:計算上は${expectedBalance}円`;
    }
  }

  // 不一致があった場合、再度Gemini APIで確認
  if (hasError) {
    console.log('残高不一致を検出。Gemini APIで再確認中...');
    try {
      const retryPrompt = `この通帳画像を再度確認してください。前回の読み取り結果で残高の不一致がありました。

前回の読み取り結果:
${JSON.stringify(rows, null, 2)}

残高は「前の行の残高 + 入金額 - 出金額」と一致するはずです。
不一致がある行の数値を画像から再確認し、正しい値で修正したJSON配列を返してください。
それでも画像から正確な数値が読み取れない場合は、備考に「読取不確実」と記載してください。

JSON配列のみを返してください。`;

      const requestBody = {
        contents: [{
          parts: [
            { text: retryPrompt },
            { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
          ]
        }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      };

      const response = UrlFetchApp.fetch(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true }
      );

      if (response.getResponseCode() === 200) {
        const result = JSON.parse(response.getContentText());
        const text = result.candidates[0].content.parts[0].text;
        const retryRows = JSON.parse(text);
        if (Array.isArray(retryRows)) {
          console.log('再確認完了');
          return retryRows;
        }
      }
    } catch (retryErr) {
      console.error('再確認エラー:', retryErr);
    }
  }

  return rows;
}

// ============================================================
// 顧問先別解析スプレッドシート
// ============================================================

function getOrCreateClientAnalysisSheet(clientName) {
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const clientFolder = getOrCreateFolder(rootFolder, clientName);
  const sheetName = `${clientName}_解析結果`;
  const files = clientFolder.getFilesByName(sheetName);

  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  // 新規作成
  const ss = SpreadsheetApp.create(sheetName);

  // シート1: レシート・領収書
  const receiptSheet = ss.getActiveSheet();
  receiptSheet.setName('レシート・領収書');
  receiptSheet.appendRow(['解析日', '使用者名', '日付', '相手先名称', '10%対象額', '軽減8%対象額', '支払総額', '主な品名', 'インボイス番号', '備考']);
  receiptSheet.setFrozenRows(1);

  // シート2: クレジットカード利用明細書
  const ccSheet = ss.insertSheet('クレジットカード利用明細書');
  ccSheet.appendRow(['解析日', 'カード会社名', '利用日', '利用先名称', '利用金額', '支払区分', '備考']);
  ccSheet.setFrozenRows(1);

  // シート3: 通帳
  const bankSheet = ss.insertSheet('通帳');
  bankSheet.appendRow(['解析日', '銀行名', '口座番号', '年月日', '摘要', '入金額', '出金額', '残高', '備考']);
  bankSheet.setFrozenRows(1);

  // シート3: 売上請求書
  const salesSheet = ss.insertSheet('売上請求書');
  salesSheet.appendRow(['解析日', '請求日', '請求相手先名称', '案件名', '10%売上高', '軽減8%売上高', '不課税売上高', '総売上高', '備考']);
  salesSheet.setFrozenRows(1);

  // シート4: 仕入請求書
  const purchaseSheet = ss.insertSheet('仕入請求書');
  purchaseSheet.appendRow(['解析日', '請求日', '相手方名称', '主たる購入品目', '10%仕入高', '軽減8%仕入高', '不課税仕入高', '総仕入高', '備考']);
  purchaseSheet.setFrozenRows(1);

  // シート5: 現金出納帳
  const cashSheet = ss.insertSheet('現金出納帳');
  cashSheet.appendRow(['月日', '相手先名称', '主な品名', '入金額', '出金額', '残高', '処理日']);
  cashSheet.setFrozenRows(1);

  // ファイルを顧問先フォルダに移動
  const file = DriveApp.getFileById(ss.getId());
  clientFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return ss;
}

// ============================================================
// 解析結果をスプレッドシートに書き込み
// ============================================================

function writeAnalysisResult(clientSheet, docType, rows, bankName, accountNumber, userName) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  let sheet;

  switch (docType) {
    case 'レシート・領収書':
      sheet = clientSheet.getSheetByName('レシート・領収書');
      rows.forEach(row => {
        sheet.appendRow([
          today,
          userName || '',
          row['日付'] || '',
          row['相手先名称'] || '',
          row['10%対象額'] || 0,
          row['軽減8%対象額'] || 0,
          row['支払総額'] || 0,
          row['主な品名'] || '',
          row['インボイス番号'] || '',
          row['備考'] || ''
        ]);
      });
      break;

    case 'クレジットカード利用明細書':
      sheet = clientSheet.getSheetByName('クレジットカード利用明細書');
      rows.forEach(row => {
        sheet.appendRow([
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
      sheet = clientSheet.getSheetByName('通帳');
      rows.forEach(row => {
        // 銀行名・口座番号: 手入力値を優先、なければGemini解析結果から取得
        const rowBank = bankName || row['銀行名'] || '';
        const rowAccount = accountNumber || row['口座番号'] || '';
        sheet.appendRow([
          today,
          rowBank,
          rowAccount,
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
      sheet = clientSheet.getSheetByName('売上請求書');
      rows.forEach(row => {
        sheet.appendRow([
          today,
          row['請求日'] || '',
          row['請求相手先名称'] || '',
          row['案件名'] || '',
          row['10%売上高'] || 0,
          row['軽減8%売上高'] || 0,
          row['不課税売上高'] || 0,
          row['総売上高'] || 0,
          row['備考'] || ''
        ]);
      });
      break;

    case '仕入請求書':
      sheet = clientSheet.getSheetByName('仕入請求書');
      rows.forEach(row => {
        sheet.appendRow([
          today,
          row['請求日'] || '',
          row['相手方名称'] || '',
          row['主たる購入品目'] || '',
          row['10%仕入高'] || 0,
          row['軽減8%仕入高'] || 0,
          row['不課税仕入高'] || 0,
          row['総仕入高'] || 0,
          row['備考'] || ''
        ]);
      });
      break;
  }
}

// ============================================================
// 同期ファイル解析（顧問先からの受取物フォルダを自動解析）
// ============================================================

/**
 * 顧問先からの受取物フォルダ内の未解析ファイルをGemini AIで自動解析
 * - 書類種別を自動判定（通帳/請求書/レシート等）
 * - 通帳の場合は銀行名・口座番号も自動読み取り
 * - 請求書の場合は売上/仕入を顧問先名から自動判定
 */
function analyzeSyncedFiles() {
  const rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const ss = getOrCreateLogSheet();

  // 同期ファイル解析ログシートを取得or作成
  let syncLogSheet = ss.getSheetByName('同期ファイル解析ログ');
  if (!syncLogSheet) {
    syncLogSheet = ss.insertSheet('同期ファイル解析ログ');
    syncLogSheet.appendRow([
      '解析日時', '顧問先名', '元フォルダ', 'ファイル名',
      '判定種別', '判定確度', 'ファイルID', '備考'
    ]);
    syncLogSheet.setFrozenRows(1);
  }

  // 解析済みファイルIDを収集（二重処理防止）
  const logData = syncLogSheet.getDataRange().getValues();
  const processedIds = new Set();
  for (let i = 1; i < logData.length; i++) {
    if (logData[i][6]) processedIds.add(logData[i][6]);
  }

  // 顧問先URL一覧から顧問先名リストを取得
  const urlSheet = ss.getSheetByName('顧問先URL一覧');
  const urlData = urlSheet ? urlSheet.getDataRange().getValues() : [];
  const clientNames = [];
  for (let i = 1; i < urlData.length; i++) {
    if (urlData[i][0]) clientNames.push(urlData[i][0]);
  }

  const resultSummary = [];
  const targetFolders = ['顧問先からの受取物（社長用）', '顧問先からの受取物（スタッフ用）'];

  // 各顧問先フォルダを走査
  const clientFolders = rootFolder.getFolders();
  while (clientFolders.hasNext()) {
    const clientFolder = clientFolders.next();
    const clientName = clientFolder.getName();

    // _で始まるフォルダはスキップ
    if (clientName.startsWith('_')) continue;

    for (const targetFolderName of targetFolders) {
      const folders = clientFolder.getFoldersByName(targetFolderName);
      if (!folders.hasNext()) continue;
      const targetFolder = folders.next();

      // フォルダ内のファイルを取得
      const files = targetFolder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const fileId = file.getId();

        // 既に解析済みならスキップ
        if (processedIds.has(fileId)) continue;

        // 対象拡張子チェック
        const fileName = file.getName();
        const ext = fileName.toLowerCase().split('.').pop();
        if (!['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'csv'].includes(ext)) continue;

        try {
          console.log(`同期ファイル解析中: ${clientName}/${targetFolderName}/${fileName}`);

          const blob = file.getBlob();
          const base64Data = Utilities.base64Encode(blob.getBytes());
          const mimeType = blob.getContentType();

          // Step1: 書類種別を自動判定
          const classification = classifyDocument(base64Data, mimeType, clientName);
          console.log(`  判定: ${classification.docType} (確度: ${classification.confidence})`);

          // ログに記録
          syncLogSheet.appendRow([
            new Date(), clientName, targetFolderName, fileName,
            classification.docType, classification.confidence, fileId,
            classification.note || ''
          ]);

          // 対象外・判定不能はスキップ
          if (classification.docType === 'その他' || classification.confidence === '判定不能') {
            console.log(`  スキップ: ${classification.docType}`);
            continue;
          }

          // Step2: 詳細解析
          const clientSheet = getOrCreateClientAnalysisSheet(clientName);
          const bankName = classification.bankName || '';
          const accountNumber = classification.accountNumber || '';
          const userName = '';

          const analysisResult = callGeminiApi(base64Data, classification.docType, bankName, clientSheet);
          writeAnalysisResult(clientSheet, classification.docType, analysisResult, bankName, accountNumber, userName);

          // レシートの場合、現金出納帳にも書き込み
          if (classification.docType === 'レシート・領収書') {
            writeToCashBook(clientSheet, analysisResult);
          }

          resultSummary.push({
            clientName: clientName,
            docType: classification.docType,
            bankName: bankName,
            rows: analysisResult.length,
            sheetUrl: clientSheet.getUrl(),
            source: 'sync'
          });

          console.log(`  解析完了: ${analysisResult.length}行`);

        } catch (err) {
          console.error(`同期ファイル解析エラー (${clientName}/${fileName}):`, err);
          syncLogSheet.appendRow([
            new Date(), clientName, targetFolderName, fileName,
            'エラー', '', fileId, err.message
          ]);
        }
      }
    }
  }

  // 解析結果サマリーを既存のサマリーに追記
  if (resultSummary.length > 0) {
    const existingJson = PropertiesService.getScriptProperties().getProperty('lastAnalysisSummary');
    let existing = [];
    if (existingJson) {
      try { existing = JSON.parse(existingJson); } catch(e) {}
    }
    existing = existing.concat(resultSummary);
    PropertiesService.getScriptProperties().setProperty(
      'lastAnalysisSummary', JSON.stringify(existing)
    );
  }

  console.log(`同期ファイル解析完了: ${resultSummary.length}件`);
}

/**
 * Gemini AIで書類種別を自動判定
 */
function classifyDocument(base64Data, mimeType, clientName) {
  const prompt = `あなたは税理士事務所のAIアシスタントです。この書類の種別を判定してください。

顧問先名: ${clientName}

以下の種別から最も適切なものを1つ選んでください:
- "レシート・領収書": 店舗のレシート、領収書
- "クレジットカード利用明細書": クレジットカード会社からの利用明細
- "通帳": 銀行通帳のコピーや取引明細（Excelファイルで複数シートがある場合も含む）
- "売上請求書": この顧問先（${clientName}）が発行した請求書（${clientName}が請求元・発行者として記載されている）
- "仕入請求書": この顧問先（${clientName}）が受け取った請求書（${clientName}が宛先・請求先として記載されている）
- "その他": 上記のいずれにも該当しない書類

判定のポイント:
- 請求書の場合、「${clientName}」またはそれに類する名称が請求元（発行者）に記載されていれば「売上請求書」
- 「${clientName}」またはそれに類する名称が宛先（請求先・お客様名）に記載されていれば「仕入請求書」
- 会社名の表記揺れ（株式会社の有無、略称等）も考慮してください

以下のJSON形式で回答してください:
{
  "docType": "判定した種別",
  "confidence": "確定" または "要確認",
  "bankName": "通帳の場合の銀行名（通帳でなければ空文字）",
  "accountNumber": "通帳の場合の口座番号（通帳でなければ空文字）",
  "note": "判定理由や補足（簡潔に）"
}

JSONのみを返してください。`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = UrlFetchApp.fetch(
    `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    return { docType: 'その他', confidence: '判定不能', note: 'API エラー' };
  }

  try {
    const result = JSON.parse(response.getContentText());
    const text = result.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (e) {
    return { docType: 'その他', confidence: '判定不能', note: '応答解析エラー' };
  }
}

// ============================================================
// レシートデータを現金出納帳に書き込み
// ============================================================

/**
 * レシート解析結果を現金出納帳に追加し、日付順ソート+残高再計算を行う
 * 10%と8%が両方ある場合は2行に分けて記録する
 */
function writeToCashBook(clientSheet, receiptRows) {
  let cashSheet = clientSheet.getSheetByName('現金出納帳');
  if (!cashSheet) {
    cashSheet = clientSheet.insertSheet('現金出納帳');
    cashSheet.appendRow(['月日', '相手先名称', '主な品名', '入金額', '出金額', '残高', '処理日']);
    cashSheet.setFrozenRows(1);
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

  // 新しいレシートデータを行に変換
  const newRows = [];
  receiptRows.forEach(row => {
    const date = row['日付'] || '';
    const vendor = row['相手先名称'] || '';
    const mainItem = row['主な品名'] || '';
    const amount10 = Number(row['10%対象額']) || 0;
    const amount8 = Number(row['軽減8%対象額']) || 0;

    if (amount10 > 0 && amount8 > 0) {
      // 両方ある場合は2行に分ける
      newRows.push([date, `${vendor}_${mainItem}_10%`, mainItem, 0, amount10, 0, today]);
      newRows.push([date, `${vendor}_${mainItem}_軽8%`, mainItem, 0, amount8, 0, today]);
    } else if (amount10 > 0) {
      newRows.push([date, `${vendor}_10%`, mainItem, 0, amount10, 0, today]);
    } else if (amount8 > 0) {
      newRows.push([date, `${vendor}_軽8%`, mainItem, 0, amount8, 0, today]);
    } else {
      // 税率不明の場合は支払総額を使用
      const total = Number(row['支払総額']) || 0;
      if (total > 0) {
        newRows.push([date, vendor, mainItem, 0, total, 0, today]);
      }
    }
  });

  if (newRows.length === 0) return;

  // 既存データを取得
  const allData = cashSheet.getDataRange().getValues();
  const existingRows = [];
  for (let i = 1; i < allData.length; i++) {
    existingRows.push(allData[i]);
  }

  // 既存 + 新規を結合
  const allRows = existingRows.concat(newRows);

  // 月日でソート
  allRows.sort((a, b) => {
    const dateA = new Date(a[0]);
    const dateB = new Date(b[0]);
    if (dateA.getTime() === dateB.getTime()) {
      return new Date(a[6]) - new Date(b[6]);
    }
    return dateA - dateB;
  });

  // 残高を再計算
  let balance = 0;
  allRows.forEach(row => {
    balance += (Number(row[3]) || 0) - (Number(row[4]) || 0);
    row[5] = balance;
  });

  // シートをヘッダー以外クリアして再書き込み
  if (cashSheet.getLastRow() > 1) {
    cashSheet.getRange(2, 1, cashSheet.getLastRow() - 1, 7).clearContent();
  }
  if (allRows.length > 0) {
    cashSheet.getRange(2, 1, allRows.length, 7).setValues(allRows);
  }
}

// ============================================================
// テスト用
// ============================================================

function testAnalyze() {
  analyzeUploadedDocuments();
}

function testAnalyzeSyncedFiles() {
  analyzeSyncedFiles();
}
