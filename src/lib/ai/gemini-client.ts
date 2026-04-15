/**
 * Gemini API クライアント
 *
 * 月次報告資料のコメント叩き台を生成する。
 * モデル: gemini-2.5-flash（コスト効率重視）
 *
 * プロンプトには以下を含める：
 *   - 会社情報・業種・資本規模
 *   - 社長プロファイル（語彙・トーン・重視KPI）
 *   - 前月のオープンコメント
 *   - 当月の数値データ（異常値・変動要因）
 *   - ベンチマーク（ある場合）
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

let genAI: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (genAI) return genAI
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY が未設定です')
  genAI = new GoogleGenerativeAI(apiKey)
  return genAI
}

export interface GenerateCommentInput {
  sectionType: string
  sectionTitle: string
  sectionContent: unknown
  clientName: string
  industryCode: string
  profile: {
    reportStyle: string
    commentTone: string
    focusedKpis: string[]
    vocabularyPreference: Record<string, string>
  } | null
  previousComments: Array<{ content: string; tags: string[] }>
  benchmark?: Record<string, number>
}

export async function generateAiComment(input: GenerateCommentInput): Promise<string> {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const model = getClient().getGenerativeModel({ model: modelName })

  const prompt = buildPrompt(input)
  const result = await model.generateContent(prompt)
  return result.response.text()
}

function buildPrompt(input: GenerateCommentInput): string {
  const toneDesc = {
    polite: '敬体（です・ます調）で丁寧に',
    casual: 'です・ます調だが親しみのある口調で',
    data_driven: 'データを中心に簡潔に',
  }[input.profile?.commentTone ?? 'polite']

  const styleDesc = {
    detailed: '数字の背景・要因まで踏み込んで',
    summary: '要点のみ短く',
    balanced: '重要ポイントに絞って',
  }[input.profile?.reportStyle ?? 'balanced']

  const vocabLines = Object.entries(input.profile?.vocabularyPreference ?? {})
    .map(([orig, replacement]) => `- 「${orig}」は「${replacement}」と表現する`)
    .join('\n')

  const previousLines = input.previousComments
    .map((c) => `- [${c.tags.join(', ')}] ${c.content}`)
    .join('\n')

  return `あなたは税理士のアシスタントです。月次の財務報告資料の${input.sectionTitle}セクションについて、
クライアント社長向けのコメント叩き台を作成してください。

# クライアント情報
- 会社名: ${input.clientName}
- 業種コード: ${input.industryCode}

# 記載ルール
- ${toneDesc}表現してください。
- ${styleDesc}書いてください。
- 重視するKPI: ${input.profile?.focusedKpis?.join(', ') || '指定なし'}
${vocabLines ? `\n# 語彙の指定\n${vocabLines}\n` : ''}
${previousLines ? `\n# 前月からの継続論点\n${previousLines}\n` : ''}
# セクションのデータ
\`\`\`json
${JSON.stringify(input.sectionContent, null, 2).slice(0, 3000)}
\`\`\`
${input.benchmark ? `\n# 業界ベンチマーク\n${JSON.stringify(input.benchmark)}\n` : ''}

# 指示
上記に基づき、社長がひと目で状況を把握でき、かつ次のアクションを検討できるコメントを
200字程度で作成してください。
コメント本文のみを返し、前置きや見出しは不要です。`
}
