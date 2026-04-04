import { NextRequest, NextResponse } from 'next/server';
import { extractFromPdf } from '@/lib/gemini';
import { ExtractedInsuranceDataSchema } from '@/lib/extracted-schema';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが送信されていません' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'PDFファイルのみ対応しています' }, { status: 400 });
    }

    // PDFをBase64に変換
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Gemini APIで抽出
    const rawExtracted = await extractFromPdf(base64);

    // Zodでバリデーション
    const parseResult = ExtractedInsuranceDataSchema.safeParse(rawExtracted);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: '抽出データのバリデーションに失敗しました', details: parseResult.error.issues },
        { status: 422 },
      );
    }

    return NextResponse.json({ extracted: parseResult.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
