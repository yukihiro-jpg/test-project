"""NTA倍率表PDF一括スクレイピングスクリプト（OCR方式）.

使い方:
    python scripts/scrape_ibaraki_ocr.py

処理内容:
    1. 国税庁サイトから茨城県の全市区町村PDFをダウンロード
    2. PyMuPDFでPDFページを画像に変換
    3. TesseractでOCR（日本語テキスト抽出）
    4. テーブル構造をパースして倍率データを抽出
    5. JSONおよびCSVファイルに保存

前提:
    - Tesseract OCRがインストール済み
    - pip install pymupdf pytesseract
"""

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
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}
REQUEST_DELAY = 1.0  # リクエスト間隔（秒）
OUTPUT_DIR = Path("data")
PDF_CACHE_DIR = Path("data/pdf_cache")

# Tesseractのパス（Windowsのデフォルト）
if sys.platform == "win32":
    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path


def fetch_municipality_list() -> list[tuple[str, str]]:
    """市区町村一覧を取得.

    Returns:
        [(市町村名, PDFコード), ...] 例: [("水戸市", "c08201rt"), ...]
    """
    from bs4 import BeautifulSoup

    city_frm_url = f"{NTA_BASE}/city_frm.htm"
    print(f"市区町村一覧を取得中: {city_frm_url}")

    resp = httpx.get(city_frm_url, headers=BROWSER_HEADERS,
                     follow_redirects=True, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # フレーム対応
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
        # HTMLページコード（rf）を抽出し、PDFコード（rt）に変換
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
        print(f"  キャッシュ使用: {pdf_path}")
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
    # 高解像度でレンダリング
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


def ocr_image(img: Image.Image) -> str:
    """画像からテキストを抽出（日本語OCR）."""
    # Tesseract設定: 日本語、PSM 6（テーブル向き）
    text = pytesseract.image_to_string(
        img,
        lang="jpn",
        config="--psm 6"
    )
    return text


def parse_multiplier_text(text: str) -> list[dict]:
    """OCRテキストから倍率データをパース.

    倍率表の典型的な構造:
    町(丁目)又は大字名 | 適用地域名 | 借地権割合 | 宅地 | 田 | 畑 | 山林 | 原野 | ...
    """
    records = []
    lines = text.strip().split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # ヘッダー行や注記をスキップ
        if any(kw in line for kw in [
            "町（丁目）", "町(丁目)", "適用地域", "借地権",
            "固定資産税", "評価倍率", "ページ", "令和",
            "市区町村", "倍率表"
        ]):
            continue

        # 全角数字→半角変換
        line = _zen_to_han(line)

        # スペースやタブで分割
        parts = re.split(r"[\s\t|｜]+", line)
        parts = [p.strip() for p in parts if p.strip()]

        if len(parts) < 4:
            continue

        # 最初の要素が町名かどうか判定（数字のみの行はスキップ）
        if re.match(r"^\d+$", parts[0]):
            continue

        record = {
            "town_name": parts[0] if len(parts) > 0 else "",
            "area_name": parts[1] if len(parts) > 1 else "",
            "leasehold_ratio": parts[2] if len(parts) > 2 else "",
            "residential": parts[3] if len(parts) > 3 else "",
            "paddy": parts[4] if len(parts) > 4 else "",
            "field": parts[5] if len(parts) > 5 else "",
            "forest": parts[6] if len(parts) > 6 else "",
            "wasteland": parts[7] if len(parts) > 7 else "",
            "is_rosenka_area": "路線" in line,
        }
        records.append(record)

    return records


def _zen_to_han(text: str) -> str:
    """全角数字・記号を半角に変換."""
    result = []
    for ch in text:
        cp = ord(ch)
        if 0xFF10 <= cp <= 0xFF19:  # ０-９
            result.append(chr(cp - 0xFF10 + ord("0")))
        elif 0xFF21 <= cp <= 0xFF3A:  # Ａ-Ｚ
            result.append(chr(cp - 0xFF21 + ord("A")))
        elif 0xFF41 <= cp <= 0xFF5A:  # ａ-ｚ
            result.append(chr(cp - 0xFF41 + ord("a")))
        elif ch == "．":
            result.append(".")
        elif ch == "，":
            result.append(",")
        else:
            result.append(ch)
    return "".join(result)


def process_municipality(city_name: str, pdf_code: str) -> list[dict]:
    """1市区町村のPDFをダウンロード→OCR→パース."""
    try:
        pdf_path = download_pdf(pdf_code)
        doc = fitz.open(str(pdf_path))
        num_pages = len(doc)
        doc.close()

        all_records = []
        for page_num in range(num_pages):
            print(f"  ページ {page_num + 1}/{num_pages} をOCR中...")
            img = pdf_page_to_image(pdf_path, page_num)
            text = ocr_image(img)
            records = parse_multiplier_text(text)
            all_records.extend(records)

        return all_records

    except Exception as e:
        print(f"  エラー: {e}")
        return []


def save_results(all_data: dict, prefecture: str = "茨城県"):
    """結果をJSON/CSVに保存."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # JSON保存
    json_path = OUTPUT_DIR / "ibaraki_multipliers.json"
    json_data = {
        "prefecture": prefecture,
        "year": "令和7年",
        "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": sum(len(v) for v in all_data.values()),
        "municipalities": {},
    }
    for city_name, records in all_data.items():
        json_data["municipalities"][city_name] = {
            "records": records,
        }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"\nJSON保存: {json_path}")

    # CSV保存
    import csv
    csv_path = OUTPUT_DIR / "ibaraki_multipliers.csv"
    fieldnames = [
        "市区町村", "町名", "適用地域名", "借地権割合",
        "宅地", "田", "畑", "山林", "原野", "路線価地域",
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
                    "路線価地域": "○" if rec.get("is_rosenka_area") else "",
                })
    print(f"CSV保存: {csv_path}")


def main():
    print("=" * 60)
    print("茨城県 倍率表一括スクレイピング（OCR方式）")
    print("=" * 60)

    # Tesseractの確認
    try:
        version = pytesseract.get_tesseract_version()
        print(f"Tesseract バージョン: {version}")
    except Exception:
        print("エラー: Tesseractが見つかりません。")
        print("インストール手順:")
        print("  1. https://github.com/UB-Mannheim/tesseract/wiki からダウンロード")
        print("  2. インストール時に「Japanese」言語データにチェック")
        sys.exit(1)

    # 日本語データの確認
    langs = pytesseract.get_languages()
    if "jpn" not in langs:
        print("エラー: 日本語OCRデータがありません。")
        print("Tesseractを再インストールし、「Japanese」にチェックしてください。")
        sys.exit(1)
    print(f"利用可能言語: {langs}")

    # まずテスト: 1市町村だけ試行
    print("\n--- テスト: 阿見町のPDFで動作確認 ---")
    test_records = process_municipality("阿見町（テスト）", "c11105rt")
    print(f"テスト結果: {len(test_records)} 行抽出")
    if test_records:
        print(f"  例: {test_records[0]}")
    else:
        print("  テキストが抽出できませんでした。OCR設定を確認してください。")

    # ユーザーに続行確認
    print(f"\nテスト結果を確認してください。")
    answer = input("全市区町村のスクレイピングを続行しますか？ (y/n): ").strip().lower()
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

    # 保存
    save_results(all_data)
    print(f"\n完了！ 合計 {sum(len(v) for v in all_data.values())} 行")


if __name__ == "__main__":
    main()
