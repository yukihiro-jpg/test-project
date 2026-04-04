export const SYSTEM_INSTRUCTION = `あなたは日本の保険証券・保険支払通知書から情報を抽出する専門家です。
入力されたPDFから以下のJSON形式でデータを正確に抽出してください。
金額は数値（円単位、整数）で返してください。日付はYYYY-MM-DD形式です。
不明な項目はnullとしてください。推測せず、文書に記載されている情報のみを返してください。`;

export const EXTRACTION_PROMPT = `以下の保険関連書類PDFからデータを抽出し、必ず以下のJSON形式のみで回答してください。
JSON以外のテキストは一切含めないでください。

{
  "insuranceCompanyName": "保険会社名 (string)",
  "policyNumber": "証券番号 (string)",
  "contractHolder": "契約者氏名 (string)",
  "insuredPerson": "被保険者氏名 (string)",
  "beneficiary": "受取人氏名 (string | null)",
  "insuranceType": "保険種類 (string, 例: 終身保険, 定期保険, 養老保険, 個人年金保険, 損害保険)",
  "isLifeInsurance": "生命保険かどうか (boolean)",
  "isAnnuity": "年金保険かどうか (boolean)",
  "deathBenefitAmount": "死亡保険金額 (number | null, 円単位の整数)",
  "maturityBenefitAmount": "満期保険金額 (number | null, 円単位の整数)",
  "annualAnnuityAmount": "年金年額 (number | null, 円単位の整数)",
  "annuityPaymentPeriodYears": "年金支払期間の年数 (number | null)",
  "annuityStartDate": "年金支払開始日 (string | null, YYYY-MM-DD)",
  "hasAnnuityPaymentStarted": "年金支払が開始済みか (boolean | null)",
  "guaranteePeriodYears": "保証期間の年数 (number | null)",
  "contractDate": "契約日 (string, YYYY-MM-DD)",
  "maturityDate": "満期日 (string | null, YYYY-MM-DD)",
  "totalPremiumsPaid": "払込保険料総額 (number | null, 円単位の整数)",
  "surrenderValue": "解約返戻金額 (number | null, 円単位の整数)",
  "lumpSumOptionAmount": "一時金受取可能額 (number | null, 円単位の整数)",
  "assumedInterestRate": "予定利率 (number | null, 小数表記 例: 0.015 = 1.5%)",
  "paidOutAmount": "実際に支払われた金額 (number | null, 円単位の整数)",
  "paymentReason": "支払事由 (string | null, 例: '死亡', '満期', '年金')",
  "documentType": "書類種類 ('保険証券' | '支払通知書' | 'その他')",
  "rawNotes": "その他特記事項 (string | null)"
}`;
