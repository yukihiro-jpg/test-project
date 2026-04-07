"""謄本PDFのテキスト抽出デバッグ.

使い方:
    python scripts/debug_tohon_pdf.py <PDFファイルパス>

pdfplumberで謄本PDFからテキストを抽出し、生のテキスト構造を表示します。
parse_tohon()の正規表現が合わない原因を調べるために使います。
"""

import sys
import pdfplumber

if len(sys.argv) < 2:
    print("使い方: python scripts/debug_tohon_pdf.py <PDFファイルパス>")
    sys.exit(1)

pdf_path = sys.argv[1]
print(f"=== 謄本PDFデバッグ: {pdf_path} ===\n")

with pdfplumber.open(pdf_path) as pdf:
    print(f"ページ数: {len(pdf.pages)}\n")
    for page_num, page in enumerate(pdf.pages, 1):
        print(f"--- ページ {page_num} ({page.width} x {page.height}) ---")

        text = page.extract_text()
        if text:
            print(f"[extract_text() 行数: {len(text.splitlines())}]")
            for i, line in enumerate(text.splitlines()):
                print(f"  {i:3d}: {repr(line)}")
        else:
            print("[extract_text() は空]")

        print()

        # 単語単位の位置情報も表示（レイアウト確認用）
        words = page.extract_words()
        print(f"[extract_words() 単語数: {len(words)}]")
        for i, w in enumerate(words[:30]):
            print(f"  {i:3d}: x0={w['x0']:.1f} top={w['top']:.1f} '{w['text']}'")
        if len(words) > 30:
            print(f"  ... (残り {len(words) - 30} 単語)")
        print()

print("=== 完了 ===")
print("この出力を共有してください。正規表現を実際の形式に合わせて修正します。")
