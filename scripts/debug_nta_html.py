"""NTA倍率表PDF構造デバッグスクリプト.

使い方:
    python scripts/debug_nta_html.py

阿見町の倍率表PDFをダウンロードし、pdfplumberでテーブル構造を表示します。
"""

import httpx
import pdfplumber
import re
import tempfile
import os

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}

# 阿見町の倍率表PDF URL
# HTMLページ: html/c11105rf.htm → PDF: pdf/c11105rt.pdf (rf→rt)
pdf_url = "https://www.rosenka.nta.go.jp/main_r07/kanto/ibaraki/ratios/pdf/c11105rt.pdf"

print(f"=== NTA倍率表PDF構造デバッグ ===")
print(f"PDF URL: {pdf_url}\n")

# PDFダウンロード
resp = httpx.get(pdf_url, headers=BROWSER_HEADERS, follow_redirects=True, timeout=30)
print(f"Status: {resp.status_code}")
print(f"Content-Type: {resp.headers.get('content-type', '')}")
print(f"Content length: {len(resp.content)} bytes\n")

if resp.status_code != 200:
    print("PDFのダウンロードに失敗しました。")
    exit(1)

# PDFを一時ファイルに保存
pdf_path = "debug_nta_ami.pdf"
with open(pdf_path, "wb") as f:
    f.write(resp.content)
print(f"PDF保存: {pdf_path}\n")

# pdfplumberでPDFを解析
with pdfplumber.open(pdf_path) as pdf:
    print(f"ページ数: {len(pdf.pages)}\n")

    for page_num, page in enumerate(pdf.pages, 1):
        print(f"=== ページ {page_num} ===")
        print(f"ページサイズ: {page.width} x {page.height}")

        # テーブル抽出
        tables = page.extract_tables()
        print(f"テーブル数: {len(tables)}\n")

        for t_idx, table in enumerate(tables):
            print(f"--- テーブル {t_idx + 1}: {len(table)} 行 ---")
            for row_idx, row in enumerate(table):
                # 最初の10行 + 最後の2行を表示
                if row_idx < 10 or row_idx >= len(table) - 2:
                    # セル内の改行をスペースに置換
                    cleaned = []
                    for cell in row:
                        if cell is None:
                            cleaned.append("")
                        else:
                            cleaned.append(re.sub(r"\s+", " ", str(cell)).strip())
                    print(f"  行{row_idx}: [{len(row)}列] {cleaned}")
                elif row_idx == 10:
                    print(f"  ... (省略: 行10～{len(table)-3}) ...")
            print()

        # テーブルが見つからない場合、テキスト抽出を試行
        if not tables:
            text = page.extract_text()
            if text:
                lines = text.split("\n")
                print(f"テキスト行数: {len(lines)}")
                for i, line in enumerate(lines[:20]):
                    print(f"  行{i}: {line}")
                if len(lines) > 20:
                    print(f"  ... (残り {len(lines)-20} 行)")
            else:
                print("テキストも抽出できませんでした")
        print()

        # 最初の2ページだけ表示
        if page_num >= 2:
            if len(pdf.pages) > 2:
                print(f"(残り {len(pdf.pages) - 2} ページは省略)")
            break

print("\n=== 完了 ===")
print("この出力結果をコピーして共有してください。")
