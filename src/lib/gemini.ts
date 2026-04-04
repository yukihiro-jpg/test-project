import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION, EXTRACTION_PROMPT } from './prompt';
import type { ExtractedInsuranceData } from '@/types/extracted';

let genai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genai = new GoogleGenAI({ apiKey });
  }
  return genai;
}

/**
 * PDFのBase64データからGemini APIを使って保険情報を抽出する
 */
export async function extractFromPdf(
  pdfBase64: string,
): Promise<ExtractedInsuranceData> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: 'gemini-2.5-pro-preview-06-05',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64,
            },
          },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0,
    },
  });

  const text = response.text ?? '';

  // JSONブロックを抽出（```json ... ``` で囲まれている場合に対応）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini response does not contain valid JSON');
  }

  const jsonStr = jsonMatch[1] ?? jsonMatch[0];
  const parsed = JSON.parse(jsonStr) as ExtractedInsuranceData;
  return parsed;
}
