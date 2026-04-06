"""NTA倍率表HTMLの構造をデバッグするスクリプト.

使い方:
    python scripts/debug_nta_html.py

水戸市の倍率表HTMLを取得し、テーブル構造を表示します。
これにより、パーサーの修正に必要な情報が得られます。
"""

import httpx
from bs4 import BeautifulSoup
import re

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}

# 水戸市の倍率表URL
url = "https://www.rosenka.nta.go.jp/main_r07/kanto/ibaraki/ratios/html/c08201rf.htm"

print(f"=== NTA倍率表HTML構造デバッグ ===")
print(f"URL: {url}\n")

resp = httpx.get(url, headers=BROWSER_HEADERS, follow_redirects=True, timeout=30)
print(f"Status: {resp.status_code}")
print(f"Content-Type: {resp.headers.get('content-type', '')}")
print(f"Content length: {len(resp.text)} chars\n")

# HTMLをファイルに保存（後で確認用）
with open("debug_nta_mito.html", "w", encoding="utf-8") as f:
    f.write(resp.text)
print("HTMLファイル保存: debug_nta_mito.html\n")

soup = BeautifulSoup(resp.text, "lxml")

# テーブル一覧
tables = soup.find_all("table")
print(f"=== テーブル数: {len(tables)} ===\n")

for i, table in enumerate(tables):
    rows = table.find_all("tr")
    attrs = dict(table.attrs) if table.attrs else {}
    print(f"--- テーブル {i+1}: {len(rows)} 行, 属性={attrs} ---")

    # 最初の5行を表示
    for j, tr in enumerate(rows[:5]):
        cells = tr.find_all(["td", "th"])
        cell_info = []
        for c in cells:
            tag = c.name
            text = re.sub(r"\s+", " ", c.get_text()).strip()
            colspan = c.get("colspan", "")
            rowspan = c.get("rowspan", "")
            extra = ""
            if colspan:
                extra += f" colspan={colspan}"
            if rowspan:
                extra += f" rowspan={rowspan}"
            cell_info.append(f"<{tag}{extra}>'{text}'")
        print(f"  行{j}: [{len(cells)}列] {' | '.join(cell_info)}")

    if len(rows) > 5:
        print(f"  ... (残り {len(rows)-5} 行)")

    # 6行目以降で最初のデータ行らしきものを表示
    for j, tr in enumerate(rows[5:15], 5):
        cells = tr.find_all(["td", "th"])
        if len(cells) >= 5:
            texts = [re.sub(r"\s+", " ", c.get_text()).strip() for c in cells]
            print(f"  行{j}: [{len(cells)}列] {texts}")
            break

    print()

# フレーム構造の確認
frames = soup.find_all("frame")
if frames:
    print(f"=== フレーム: {len(frames)} 個 ===")
    for frame in frames:
        print(f"  src={frame.get('src', '')}, name={frame.get('name', '')}")

# iframeの確認
iframes = soup.find_all("iframe")
if iframes:
    print(f"=== iframe: {len(iframes)} 個 ===")
    for iframe in iframes:
        print(f"  src={iframe.get('src', '')}")

print("\n=== 完了 ===")
print("詳細なHTMLは debug_nta_mito.html を確認してください。")
print("このスクリプトの出力結果をコピーして共有してください。")
