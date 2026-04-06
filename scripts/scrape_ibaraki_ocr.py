"""NTA倍率表PDF一括スクレイピング（OCR方式・v3）.

使い方:
    python scripts/scrape_ibaraki_ocr.py

改良点v3:
    - PSM 11（sparse text）で孤立した数値も検出
    - image_to_dataで位置情報を取得し列を再構成
    - 丸数字（①②③...）を通常数字に自動変換
    - 動的な列境界検出
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
DPI = 400  # 高解像度

if sys.platform == "win32":
    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path

# 丸数字→通常数字 変換テーブル
CIRCLE_NUM_MAP = {}
# ① - ⑳
for i, ch in enumerate("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳", 1):
    CIRCLE_NUM_MAP[ch] = str(i)
# ㉑ - ㉟
for i, ch in enumerate("㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟", 21):
    CIRCLE_NUM_MAP[ch] = str(i)
# ㊱ - ㊿
for i, ch in enumerate("㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿", 36):
    CIRCLE_NUM_MAP[ch] = str(i)

# 倍率表の列名
COLUMN_NAMES = [
    "town_name", "area_name", "leasehold_ratio",
    "residential", "paddy", "field", "forest",
    "wasteland", "pasture", "pond", "misc_land",
]
COLUMN_LABELS = [
    "町名", "適用地域名", "借地権割合",
    "宅地", "田", "畑", "山林",
    "原野", "牧場", "池沼", "雑種地",
]


def convert_circle_numbers(text: str) -> str:
    """丸数字を通常数字に変換."""
    result = []
    for ch in text:
        if ch in CIRCLE_NUM_MAP:
            result.append(CIRCLE_NUM_MAP[ch])
        else:
            result.append(ch)
    return "".join(result)


def zen_to_han(text: str) -> str:
    """全角→半角変換."""
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


def normalize_text(text: str) -> str:
    """テキストの正規化（丸数字+全角変換+空白整理）."""
    text = convert_circle_numbers(text)
    text = zen_to_han(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_municipality_list() -> list[tuple[str, str]]:
    """市区町村一覧を取得."""
    from bs4 import BeautifulSoup

    city_frm_url = f"{NTA_BASE}/city_frm.htm"
    print(f"市区町村一覧を取得中...")

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
    """PDFダウンロード（キャッシュ付き）."""
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


def pdf_page_to_image(pdf_path: Path, page_num: int) -> Image.Image:
    """PDFページ→画像変換."""
    doc = fitz.open(str(pdf_path))
    page = doc[page_num]
    zoom = DPI / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


def extract_words_with_positions(img: Image.Image) -> list[dict]:
    """画像から単語を位置情報付きで抽出.

    PSM 11（sparse text）で孤立した数値も検出。
    """
    data = pytesseract.image_to_data(
        img, lang="jpn", config="--psm 11",
        output_type=pytesseract.Output.DICT
    )

    words = []
    n = len(data["text"])
    for i in range(n):
        text = str(data["text"][i]).strip()
        conf = int(data["conf"][i])
        if text and conf > 5:  # 低信頼度のものも含める
            words.append({
                "text": normalize_text(text),
                "x": data["left"][i],
                "y": data["top"][i],
                "w": data["width"][i],
                "h": data["height"][i],
                "cx": data["left"][i] + data["width"][i] // 2,  # 中心X
                "cy": data["top"][i] + data["height"][i] // 2,  # 中心Y
            })

    return words


def detect_columns(words: list[dict], page_width: int) -> list[int]:
    """単語の位置から列境界を動的に検出.

    X座標のヒストグラムを作り、密集している領域を列として検出。
    """
    if not words:
        return []

    # X座標の中心値を収集
    x_centers = [w["cx"] for w in words]

    # ヒストグラムベースの列検出
    # ページを50ピクセル刻みでビンに分割
    bin_size = 50
    bins = {}
    for x in x_centers:
        b = x // bin_size
        bins[b] = bins.get(b, 0) + 1

    # 密集しているビン（平均以上）を列候補とする
    if not bins:
        return []

    avg = sum(bins.values()) / len(bins)

    # 列のクラスタを検出
    sorted_bins = sorted(bins.keys())
    clusters = []
    current_cluster = [sorted_bins[0]]

    for b in sorted_bins[1:]:
        if b - current_cluster[-1] <= 2:  # 隣接ビン
            current_cluster.append(b)
        else:
            clusters.append(current_cluster)
            current_cluster = [b]
    clusters.append(current_cluster)

    # 各クラスタの中心を列位置とする
    col_centers = []
    for cluster in clusters:
        total_count = sum(bins.get(b, 0) for b in cluster)
        if total_count >= avg * 0.3:  # 最低限の単語数
            center = sum(b * bin_size + bin_size // 2 for b in cluster) // len(cluster)
            col_centers.append(center)

    # 列境界を設定（隣接する列の中間点）
    boundaries = [0]
    for i in range(len(col_centers) - 1):
        mid = (col_centers[i] + col_centers[i + 1]) // 2
        boundaries.append(mid)
    boundaries.append(page_width)

    return boundaries


def group_into_rows(words: list[dict], row_threshold: int = 20) -> list[list[dict]]:
    """単語をY座標に基づいて行にグループ化."""
    if not words:
        return []

    words_sorted = sorted(words, key=lambda w: (w["cy"], w["cx"]))
    rows = []
    current_row = [words_sorted[0]]

    for w in words_sorted[1:]:
        if abs(w["cy"] - current_row[0]["cy"]) <= row_threshold:
            current_row.append(w)
        else:
            rows.append(sorted(current_row, key=lambda w: w["cx"]))
            current_row = [w]
    if current_row:
        rows.append(sorted(current_row, key=lambda w: w["cx"]))

    return rows


def assign_words_to_columns(row_words: list[dict], col_boundaries: list[int]) -> list[str]:
    """行内の単語を列に割り当て."""
    n_cols = len(col_boundaries) - 1
    col_texts = [""] * n_cols

    for w in row_words:
        for col_idx in range(n_cols):
            if col_boundaries[col_idx] <= w["cx"] < col_boundaries[col_idx + 1]:
                if col_texts[col_idx]:
                    col_texts[col_idx] += " " + w["text"]
                else:
                    col_texts[col_idx] = w["text"]
                break

    return col_texts


def is_data_row(col_texts: list[str]) -> bool:
    """データ行かどうか判定（ヘッダー・注記を除外）."""
    if not col_texts or not col_texts[0].strip():
        return False

    text = " ".join(col_texts)
    skip_keywords = [
        "町(丁目)", "町（丁目）", "大字名", "適用地域名",
        "倍率表", "令和", "市区町村名", "税務署",
        "固定資産", "借地権割合", "評価倍率", "頁",
        "ページ", "注意", "備考",
    ]
    for kw in skip_keywords:
        if kw in text:
            return False

    # 最初の列が数字のみならスキップ
    first = col_texts[0].strip()
    if re.match(r"^[\d\s.]+$", first):
        return False

    return True


def extract_table_from_page(img: Image.Image) -> list[dict]:
    """1ページから倍率テーブルを抽出.

    v4: 列位置ではなく、各行のテキストと数値を分離し、
    数値を順番に倍率列に割り当てる方式。
    """
    words = extract_words_with_positions(img)
    if not words:
        return []

    page_width = img.width

    # 行にグループ化
    rows = group_into_rows(words)

    records = []
    current_town = ""

    for row_words in rows:
        # 行全体のテキストを結合
        row_text = " ".join(w["text"] for w in row_words)

        # ヘッダー・注記をスキップ
        skip_keywords = [
            "倍率表", "令和", "市区町村名", "税務署",
            "固定資産", "借地権割合", "評価倍率", "頁",
            "町(丁目)", "町（丁目）", "大字名", "適用地域名",
            "注意", "備考", "イ鱒",
        ]
        if any(kw in row_text for kw in skip_keywords):
            continue

        # ページ幅の40%を境界として、左側=テキスト、右側=数値 に分離
        text_boundary = page_width * 0.38

        text_words = []  # 町名・地域名
        number_words = []  # 倍率数値

        for w in row_words:
            if w["cx"] < text_boundary:
                text_words.append(w)
            else:
                number_words.append(w)

        # テキスト部分を結合
        text_part = " ".join(w["text"] for w in sorted(text_words, key=lambda w: w["cx"]))
        text_part = text_part.strip()

        if not text_part:
            continue

        # 数字のみの行（ページ番号等）をスキップ
        if re.match(r"^[\d\s.]+$", text_part):
            continue

        # 数値部分: 各単語から数値を抽出
        numbers = []
        for w in sorted(number_words, key=lambda w: w["cx"]):
            val = w["text"].strip()
            # OCRノイズ除去
            val = re.sub(r"[|｜中帆鋼遅逸潤]", "", val).strip()
            # 「比」は「1」のOCR誤読の可能性
            val = val.replace("比", "1")
            if not val:
                continue
            # 「路線」はそのまま保持
            if "路線" in val:
                numbers.append("路線")
                continue
            # 「純」「純」のように文字だけの場合もそのまま
            if re.match(r"^[純周中比]$", val):
                numbers.append(val)
                continue
            # 数値パターンにマッチするか
            # 「1.1」「40」「5.0」「純」「路線」等
            numbers.append(val)

        # 町名と地域名の分離
        # テキスト部分から町名と適用地域名を分離
        town = ""
        area = ""

        # 地域キーワードが含まれる場合
        area_keywords = [
            "市街化区域", "市街化調整区域", "農業振興", "農用地",
            "上記以外", "主要地方道", "県道", "国道", "線沿",
            "バイパス", "以外の地域",
        ]
        has_area = any(kw in text_part for kw in area_keywords)

        if has_area:
            # テキスト全体が地域名の場合（前行の町名を引き継ぐ）
            area = text_part
            town = current_town
        else:
            # 町名として扱う
            town = text_part
            current_town = town

        # 数値を倍率列に割り当て
        # 順番: 借地権割合, 宅地, 田, 畑, 山林, 原野, 牧場, 池沼, 雑種地
        multiplier_cols = COLUMN_NAMES[2:]  # leasehold_ratio以降
        record = {
            "town_name": town,
            "area_name": area,
        }
        for i, col in enumerate(multiplier_cols):
            if i < len(numbers):
                record[col] = numbers[i]
            else:
                record[col] = ""

        record["is_rosenka_area"] = "路線" in row_text

        records.append(record)

    return records


def process_municipality(city_name: str, pdf_code: str) -> list[dict]:
    """1市区町村のPDF全ページを処理."""
    try:
        pdf_path = download_pdf(pdf_code)
        doc = fitz.open(str(pdf_path))
        num_pages = len(doc)
        doc.close()

        all_records = []
        for page_num in range(num_pages):
            print(f"  ページ {page_num + 1}/{num_pages} ...", end="", flush=True)
            img = pdf_page_to_image(pdf_path, page_num)
            records = extract_table_from_page(img)
            all_records.extend(records)
            print(f" {len(records)}行", flush=True)

        return all_records
    except Exception as e:
        print(f"\n  エラー: {e}")
        return []


def save_results(all_data: dict, prefecture: str = "茨城県"):
    """JSON/CSV保存."""
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
    print(f"\nJSON保存: {json_path} ({json_data['total_records']}件)")

    # CSV
    csv_path = OUTPUT_DIR / "ibaraki_multipliers.csv"
    fieldnames = ["市区町村"] + COLUMN_LABELS + ["路線価地域"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for city_name, records in all_data.items():
            for rec in records:
                row = {"市区町村": city_name}
                for i, label in enumerate(COLUMN_LABELS):
                    row[label] = rec.get(COLUMN_NAMES[i], "")
                row["路線価地域"] = "○" if rec.get("is_rosenka_area") else ""
                writer.writerow(row)
    print(f"CSV保存: {csv_path}")


def test_single_page():
    """阿見町2ページ目でテスト."""
    print("\n--- テスト: 阿見町PDF 2ページ目 ---")
    pdf_path = download_pdf("c11105rt")

    img = pdf_page_to_image(pdf_path, 1)
    print(f"  画像サイズ: {img.width} x {img.height}")

    print("  OCR実行中（sparse text mode）...")
    records = extract_table_from_page(img)

    print(f"\n  抽出行数: {len(records)}")
    print(f"\n  === 抽出結果 ===")
    for i, rec in enumerate(records[:15]):
        town = rec["town_name"]
        area = rec["area_name"]
        res = rec["residential"]
        paddy = rec["paddy"]
        field = rec["field"]
        forest = rec["forest"]
        print(f"  [{i+1}] {town}")
        if area:
            print(f"       地域: {area}")
        if any([res, paddy, field, forest]):
            print(f"       宅地={res}, 田={paddy}, 畑={field}, 山林={forest}")
        print()

    return records


def main():
    print("=" * 60)
    print("茨城県 倍率表一括スクレイピング（OCR方式 v3）")
    print("=" * 60)

    try:
        version = pytesseract.get_tesseract_version()
        print(f"Tesseract: {version}")
    except Exception:
        print("エラー: Tesseract未検出")
        sys.exit(1)

    langs = pytesseract.get_languages()
    if "jpn" not in langs:
        print("エラー: 日本語OCRデータなし")
        sys.exit(1)

    # テスト
    test_records = test_single_page()

    if not test_records:
        print("\nデータが抽出できませんでした。")
        return

    answer = input("\n全市区町村を処理しますか？ (y/n): ").strip().lower()
    if answer != "y":
        print("中止しました。")
        return

    # 全市区町村
    municipalities = fetch_municipality_list()
    all_data = {}

    for i, (city_name, pdf_code) in enumerate(municipalities, 1):
        print(f"\n[{i}/{len(municipalities)}] {city_name}")
        time.sleep(REQUEST_DELAY)
        records = process_municipality(city_name, pdf_code)
        all_data[city_name] = records
        print(f"  計 {len(records)} 行")

    save_results(all_data)
    total = sum(len(v) for v in all_data.values())
    print(f"\n完了！ 合計 {total} 行")


if __name__ == "__main__":
    main()
