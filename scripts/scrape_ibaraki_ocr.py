"""NTA倍率表PDF一括スクレイピングスクリプト（OCR方式・改良版）.

使い方:
    python scripts/scrape_ibaraki_ocr.py

処理内容:
    1. 国税庁サイトから茨城県の全市区町村PDFをダウンロード
    2. PyMuPDFでPDFページを画像に変換
    3. Tesseract OCRで単語の位置情報付きテキスト抽出
    4. 位置情報からテーブル構造を再構成
    5. JSONおよびCSVファイルに保存
"""

import csv
import json
import os
import re
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import httpx
import pytesseract
from PIL import Image

# === 設定 ===
NTA_BASE = "https://www.rosenka.nta.go.jp/main_r07/kanto/ibaraki/ratios"
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}
REQUEST_DELAY = 1.0
OUTPUT_DIR = Path("data")
PDF_CACHE_DIR = Path("data/pdf_cache")

# Tesseractのパス（Windows）
if sys.platform == "win32":
    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path


# === 倍率表の列定義 ===
# 倍率表の列は左から:
# 町（丁目）又は大字名 | 適用地域名 | 借地権割合 | 宅地 | 田 | 畑 | 山林 | 原野 | 牧場 | 池沼 | 雑種地
COLUMN_NAMES = [
    "town_name", "area_name", "leasehold_ratio",
    "residential", "paddy", "field", "forest",
    "wasteland", "pasture", "pond", "misc_land",
]


def _zen_to_han(text: str) -> str:
    """全角数字・記号を半角に変換."""
    result = []
    for ch in text:
        cp = ord(ch)
        if 0xFF10 <= cp <= 0xFF19:
            result.append(chr(cp - 0xFF10 + ord("0")))
        elif 0xFF21 <= cp <= 0xFF3A:
            result.append(chr(cp - 0xFF21 + ord("A")))
        elif 0xFF41 <= cp <= 0xFF5A:
            result.append(chr(cp - 0xFF41 + ord("a")))
        elif ch == "．":
            result.append(".")
        elif ch == "，":
            result.append(",")
        else:
            result.append(ch)
    return "".join(result)


def fetch_municipality_list() -> list[tuple[str, str]]:
    """市区町村一覧を取得."""
    from bs4 import BeautifulSoup

    city_frm_url = f"{NTA_BASE}/city_frm.htm"
    print(f"市区町村一覧を取得中: {city_frm_url}")

    resp = httpx.get(city_frm_url, headers=BROWSER_HEADERS,
                     follow_redirects=True, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    frames = soup.find_all("frame")
    if frames:
        for frame in frames:
            src = frame.get("src", "")
            if any(kw in src.lower() for kw in ("city", "menu", "left")):
                base = city_frm_url.rsplit("/", 1)[0]
                frame_url = src if src.startswith("http") else f"{base}/{src}"
                time.sleep(REQUEST_DELAY)
                resp2 = httpx.get(frame_url, headers=BROWSER_HEADERS,
                                  follow_redirects=True, timeout=30)
                resp2.raise_for_status()
                soup = BeautifulSoup(resp2.text, "lxml")
                break

    municipalities = []
    for a_tag in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", a_tag.get_text()).strip()
        href = a_tag["href"]
        if not text:
            continue
        m = re.search(r"([a-z]\d{5})rf", href)
        if m:
            pdf_code = f"{m.group(1)}rt"
            municipalities.append((text, pdf_code))

    print(f"市区町村数: {len(municipalities)}")
    return municipalities


def download_pdf(pdf_code: str) -> Path:
    """PDFをダウンロードしてキャッシュに保存."""
    PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = PDF_CACHE_DIR / f"{pdf_code}.pdf"

    if pdf_path.exists():
        return pdf_path

    url = f"{NTA_BASE}/pdf/{pdf_code}.pdf"
    resp = httpx.get(url, headers=BROWSER_HEADERS,
                     follow_redirects=True, timeout=30)
    resp.raise_for_status()

    with open(pdf_path, "wb") as f:
        f.write(resp.content)
    return pdf_path


def pdf_page_to_image(pdf_path: Path, page_num: int, dpi: int = 300) -> Image.Image:
    """PDFの指定ページを画像に変換."""
    doc = fitz.open(str(pdf_path))
    page = doc[page_num]
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


def extract_table_from_image(img: Image.Image) -> list[dict]:
    """画像からテーブルデータを抽出（位置情報ベース）.

    pytesseractのimage_to_dataで各単語の座標を取得し、
    座標に基づいてテーブルの行・列を再構成する。
    """
    # TSV形式で位置情報付きテキストを取得
    tsv_data = pytesseract.image_to_data(
        img, lang="jpn", config="--psm 6",
        output_type=pytesseract.Output.DICT
    )

    # 有効な単語を抽出（信頼度 > 0）
    words = []
    n = len(tsv_data["text"])
    for i in range(n):
        text = str(tsv_data["text"][i]).strip()
        conf = int(tsv_data["conf"][i])
        if text and conf > 0:
            words.append({
                "text": _zen_to_han(text),
                "x": tsv_data["left"][i],
                "y": tsv_data["top"][i],
                "w": tsv_data["width"][i],
                "h": tsv_data["height"][i],
                "conf": conf,
            })

    if not words:
        return []

    # --- 行のグループ化 ---
    # Y座標が近い単語を同じ行としてグループ化
    words.sort(key=lambda w: (w["y"], w["x"]))
    rows = []
    current_row = [words[0]]
    ROW_THRESHOLD = 15  # Y座標がこの範囲内なら同じ行

    for w in words[1:]:
        if abs(w["y"] - current_row[0]["y"]) <= ROW_THRESHOLD:
            current_row.append(w)
        else:
            rows.append(sorted(current_row, key=lambda w: w["x"]))
            current_row = [w]
    if current_row:
        rows.append(sorted(current_row, key=lambda w: w["x"]))

    # --- 列の境界を推定 ---
    # ページ幅を取得
    page_width = img.width

    # 倍率表は11列: 町名 | 適用地域 | 借地権割合 | 宅地 | 田 | 畑 | 山林 | 原野 | 牧場 | 池沼 | 雑種地
    # 典型的なレイアウト: 左2列が広く、右の数値列は狭い
    # ヘッダー行を探して列境界を推定
    header_keywords = ["町", "丁目", "大字", "適用", "地域", "借地", "宅地", "田", "畑", "山林", "原野"]

    # 列境界が不明な場合、ページ幅に基づいて推定
    # A4横置き300dpi: 幅約3508px
    # 典型的な列配分（倍率表の左端からの比率）:
    col_ratios = [0.0, 0.18, 0.36, 0.46, 0.54, 0.62, 0.70, 0.78, 0.86, 0.92, 0.96, 1.0]
    col_boundaries = [int(r * page_width) for r in col_ratios]

    # --- 各行を列に割り当て ---
    records = []
    for row_words in rows:
        # 行のテキスト全体を結合して確認
        row_text = " ".join(w["text"] for w in row_words)

        # ヘッダー行・注記行をスキップ
        if any(kw in row_text for kw in [
            "町（丁目）", "町(丁目)", "大字名", "適用地域名",
            "倍率表", "令和", "市区町村", "税務署",
            "ページ", "固定資産", "借地権割合"
        ]):
            continue

        # 列ごとにテキストを割り当て
        col_texts = [""] * len(COLUMN_NAMES)
        for w in row_words:
            center_x = w["x"] + w["w"] // 2
            # どの列に属するか判定
            for col_idx in range(len(col_boundaries) - 1):
                if col_boundaries[col_idx] <= center_x < col_boundaries[col_idx + 1]:
                    if col_idx < len(col_texts):
                        if col_texts[col_idx]:
                            col_texts[col_idx] += " " + w["text"]
                        else:
                            col_texts[col_idx] = w["text"]
                    break

        # 有効なデータ行かチェック（町名があること）
        town = col_texts[0].strip()
        if not town or len(town) < 1:
            continue

        # 数字のみの行はスキップ（ページ番号など）
        if re.match(r"^[\d\s]+$", town):
            continue

        record = {}
        for i, name in enumerate(COLUMN_NAMES):
            record[name] = col_texts[i].strip() if i < len(col_texts) else ""

        # 路線価地域判定
        record["is_rosenka_area"] = "路線" in row_text

        records.append(record)

    return records


def process_municipality(city_name: str, pdf_code: str) -> list[dict]:
    """1市区町村のPDFを処理."""
    try:
        pdf_path = download_pdf(pdf_code)
        doc = fitz.open(str(pdf_path))
        num_pages = len(doc)
        doc.close()

        all_records = []
        for page_num in range(num_pages):
            print(f"  ページ {page_num + 1}/{num_pages} をOCR中...")
            img = pdf_page_to_image(pdf_path, page_num)
            records = extract_table_from_image(img)
            all_records.extend(records)

        return all_records

    except Exception as e:
        print(f"  エラー: {e}")
        import traceback
        traceback.print_exc()
        return []


def save_results(all_data: dict, prefecture: str = "茨城県"):
    """結果をJSON/CSVに保存."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # JSON
    json_path = OUTPUT_DIR / "ibaraki_multipliers.json"
    json_data = {
        "prefecture": prefecture,
        "year": "令和7年",
        "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": sum(len(v) for v in all_data.values()),
        "municipalities": {},
    }
    for city_name, records in all_data.items():
        json_data["municipalities"][city_name] = {"records": records}

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"\nJSON保存: {json_path}")

    # CSV
    csv_path = OUTPUT_DIR / "ibaraki_multipliers.csv"
    fieldnames = [
        "市区町村", "町名", "適用地域名", "借地権割合",
        "宅地", "田", "畑", "山林", "原野", "牧場", "池沼", "雑種地", "路線価地域",
    ]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for city_name, records in all_data.items():
            for rec in records:
                writer.writerow({
                    "市区町村": city_name,
                    "町名": rec.get("town_name", ""),
                    "適用地域名": rec.get("area_name", ""),
                    "借地権割合": rec.get("leasehold_ratio", ""),
                    "宅地": rec.get("residential", ""),
                    "田": rec.get("paddy", ""),
                    "畑": rec.get("field", ""),
                    "山林": rec.get("forest", ""),
                    "原野": rec.get("wasteland", ""),
                    "牧場": rec.get("pasture", ""),
                    "池沼": rec.get("pond", ""),
                    "雑種地": rec.get("misc_land", ""),
                    "路線価地域": "○" if rec.get("is_rosenka_area") else "",
                })
    print(f"CSV保存: {csv_path}")


def test_single_page():
    """阿見町の1ページだけテストして結果を詳細表示."""
    print("\n--- テスト: 阿見町PDF 2ページ目 ---")

    pdf_path = download_pdf("c11105rt")

    # 2ページ目（インデックス1）をテスト
    print("  画像変換中...")
    img = pdf_page_to_image(pdf_path, 1)

    print("  OCR実行中（位置情報付き）...")
    records = extract_table_from_image(img)

    print(f"\n  抽出行数: {len(records)}")
    print(f"\n  === 最初の10行 ===")
    for i, rec in enumerate(records[:10]):
        print(f"  [{i+1}] 町名={rec['town_name']}")
        print(f"       適用地域={rec['area_name']}")
        print(f"       宅地={rec['residential']}, 田={rec['paddy']}, "
              f"畑={rec['field']}, 山林={rec['forest']}")
        print()

    return records


def main():
    print("=" * 60)
    print("茨城県 倍率表一括スクレイピング（OCR方式・改良版）")
    print("=" * 60)

    # Tesseract確認
    try:
        version = pytesseract.get_tesseract_version()
        print(f"Tesseract バージョン: {version}")
    except Exception:
        print("エラー: Tesseractが見つかりません。")
        sys.exit(1)

    langs = pytesseract.get_languages()
    if "jpn" not in langs:
        print("エラー: 日本語OCRデータがありません。")
        sys.exit(1)
    print(f"利用可能言語: {langs}")

    # テスト実行
    test_records = test_single_page()

    if not test_records:
        print("\nテスト失敗: データが抽出できませんでした。")
        return

    answer = input("\nテスト結果を確認してください。全市区町村を処理しますか？ (y/n): ").strip().lower()
    if answer != "y":
        print("中止しました。")
        return

    # 全市区町村を処理
    municipalities = fetch_municipality_list()
    all_data = {}

    for i, (city_name, pdf_code) in enumerate(municipalities, 1):
        print(f"\n[{i}/{len(municipalities)}] {city_name} ({pdf_code})")
        time.sleep(REQUEST_DELAY)
        records = process_municipality(city_name, pdf_code)
        all_data[city_name] = records
        print(f"  → {len(records)} 行抽出")

    save_results(all_data)
    total = sum(len(v) for v in all_data.values())
    print(f"\n完了！ 合計 {total} 行")


if __name__ == "__main__":
    main()
