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
const ANALYZABLE_TYPES = ['レシート・領収書', '通帳', '売上請求書', '仕入請求書'];

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
    const status = data[i][9];
    const docType = data[i][2];
    if (status === 'pending' && ANALYZABLE_TYPES.indexOf(docType) >= 0) {
      targets.push({
        rowIndex: i + 1,
        clientName: data[i][1],
        docType: data[i][2],
        bankName: data[i][3],
        userName: data[i][4],
        pageCount: data[i][5],
        fileId: data[i][7]
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
        writeAnalysisResult(clientSheet, target.docType, analysisResult, target.bankName, target.userName);

        // ステータスを更新
        sheet.getRange(target.rowIndex, 10).setValue('analyzed');

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
        sheet.getRange(target.rowIndex, 10).setValue('analyze_error');
      }
    });
  });

  // 解析結果のサマリーをプロパティに保存（メール送信時に使用）
  if (resultSummary.length > 0) {
    PropertiesService.getScriptProperties().setProperty(
      'lastAnalysisSummary', JSON.stringify(resultSummary)
    );
  }

  console.log(`解析処理完了: ${resultSummary.length}件`);
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

    case '通帳':
      return `この画像は銀行通帳のページです${bankName ? `（${bankName}）` : ''}。
全ての取引明細を1行ずつJSON配列で抽出してください。

各オブジェクトのキー:
- "年月日": "YYYY/MM/DD"形式（年が省略されている場合は通帳の他の情報から推測してください）
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

  // シート2: 通帳
  const bankSheet = ss.insertSheet('通帳');
  bankSheet.appendRow(['解析日', '銀行名', '年月日', '摘要', '入金額', '出金額', '残高', '備考']);
  bankSheet.setFrozenRows(1);

  // シート3: 売上請求書
  const salesSheet = ss.insertSheet('売上請求書');
  salesSheet.appendRow(['解析日', '請求日', '請求相手先名称', '案件名', '10%売上高', '軽減8%売上高', '不課税売上高', '総売上高', '備考']);
  salesSheet.setFrozenRows(1);

  // シート4: 仕入請求書
  const purchaseSheet = ss.insertSheet('仕入請求書');
  purchaseSheet.appendRow(['解析日', '請求日', '相手方名称', '主たる購入品目', '10%仕入高', '軽減8%仕入高', '不課税仕入高', '総仕入高', '備考']);
  purchaseSheet.setFrozenRows(1);

  // ファイルを顧問先フォルダに移動
  const file = DriveApp.getFileById(ss.getId());
  clientFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return ss;
}

// ============================================================
// 解析結果をスプレッドシートに書き込み
// ============================================================

function writeAnalysisResult(clientSheet, docType, rows, bankName, userName) {
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

    case '通帳':
      sheet = clientSheet.getSheetByName('通帳');
      rows.forEach(row => {
        sheet.appendRow([
          today,
          bankName || '',
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
// テスト用
// ============================================================

function testAnalyze() {
  analyzeUploadedDocuments();
}
