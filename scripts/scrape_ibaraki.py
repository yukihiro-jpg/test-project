"""茨城県 全市町村の評価倍率表を一括スクレイピング.

国税庁 路線価図・評価倍率表サイトから茨城県の全市町村の
倍率表HTMLを取得し、地目別倍率をJSON・CSVで保存する。

使い方:
    python scripts/scrape_ibaraki.py

出力:
    data/ibaraki_multipliers.json
    data/ibaraki_multipliers.csv
"""

from __future__ import annotations

import asyncio
import csv
import json
import logging
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# 定数
# ------------------------------------------------------------------
NTA_BASE = "https://www.rosenka.nta.go.jp"
YEAR_PATH = "main_r07"
BUREAU = "kanto"
PREF = "ibaraki"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    "Referer": f"{NTA_BASE}/{YEAR_PATH}/{BUREAU}/{PREF}/ratios/city_frm.htm",
}

# リクエスト間隔（秒） - サーバーに負担をかけないため
REQUEST_DELAY = 1.0

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"


# ------------------------------------------------------------------
# データクラス
# ------------------------------------------------------------------
@dataclass
class MultiplierRecord:
    """倍率表の1レコード（市町村+町名+地目別倍率）."""

    municipality: str       # 市区町村名
    municipality_code: str  # 倍率表コード（例: d08201rf）
    town_name: str          # 町（丁目）又は大字名
    area_name: str          # 適用地域名
    leasehold_ratio: str    # 借地権割合
    residential: str        # 宅地
    paddy: str              # 田
    field: str              # 畑
    forest: str             # 山林
    wasteland: str          # 原野
    is_rosenka_area: bool   # 路線価地域かどうか


# ------------------------------------------------------------------
# HTMLパーサー
# ------------------------------------------------------------------
def clean_text(text: str) -> str:
    """HTMLテキストのクリーンアップ."""
    return re.sub(r"\s+", " ", text).strip()


def parse_multiplier_html(html: str) -> list[dict]:
    """倍率表HTMLをパースして行データのリストを返す.

    NTA倍率表のHTMLテーブル構造:
    - 複数テーブルが存在する場合がある（ヘッダー用と本体用）
    - データ行: 町名, 適用地域名, 借地権割合, 宅地, 田, 畑, 山林, 原野, ...
    - rowspanで町名が結合されている場合がある
    """
    soup = BeautifulSoup(html, "lxml")
    rows: list[dict] = []

    tables = soup.find_all("table")
    if not tables:
        return rows

    # メインデータテーブルを探す（行数最大のテーブル）
    main_table = max(tables, key=lambda t: len(t.find_all("tr")))

    current_town = ""  # rowspan対応: 町名が結合されている場合

    for tr in main_table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        texts = [clean_text(c.get_text()) for c in cells]

        # 空行・ヘッダー行スキップ
        if len(texts) < 5:
            continue

        # ヘッダー行の判定
        header_keywords = [
            "町（丁目）又は大字名", "町(丁目)又は大字名",
            "適用地域名", "借地権割合", "固定資産税",
        ]
        if any(kw in " ".join(texts) for kw in header_keywords):
            continue

        # rowspan 対応: 最初のセルにrowspanがある場合、町名を保持
        first_cell = cells[0]
        first_text = clean_text(first_cell.get_text())

        # セル数から列の位置を判定
        # 町名が含まれる行（7-8列以上）vs 町名がrowspanで省略された行（6-7列）
        if len(texts) >= 7:
            # 町名が含まれる完全な行
            if first_text and first_text not in ("", "　"):
                current_town = first_text

            row_data = {
                "town_name": current_town,
                "area_name": texts[1] if len(texts) > 1 else "",
                "leasehold_ratio": texts[2] if len(texts) > 2 else "",
                "residential": texts[3] if len(texts) > 3 else "",
                "paddy": texts[4] if len(texts) > 4 else "",
                "field": texts[5] if len(texts) > 5 else "",
                "forest": texts[6] if len(texts) > 6 else "",
                "wasteland": texts[7] if len(texts) > 7 else "",
            }
            rows.append(row_data)

        elif len(texts) >= 6 and current_town:
            # rowspan で町名が省略された行
            row_data = {
                "town_name": current_town,
                "area_name": texts[0] if len(texts) > 0 else "",
                "leasehold_ratio": texts[1] if len(texts) > 1 else "",
                "residential": texts[2] if len(texts) > 2 else "",
                "paddy": texts[3] if len(texts) > 3 else "",
                "field": texts[4] if len(texts) > 4 else "",
                "forest": texts[5] if len(texts) > 5 else "",
                "wasteland": texts[6] if len(texts) > 6 else "",
            }
            rows.append(row_data)

    return rows


# ------------------------------------------------------------------
# スクレイピング
# ------------------------------------------------------------------
async def fetch_municipality_list(client: httpx.AsyncClient) -> list[tuple[str, str]]:
    """茨城県の市区町村一覧を取得.

    Returns:
        [(市町村名, コード), ...] 例: [("水戸市", "d08201rf"), ...]
    """
    # まずフレームセットページを取得
    city_frm_url = f"{NTA_BASE}/{YEAR_PATH}/{BUREAU}/{PREF}/ratios/city_frm.htm"
    logger.info("市区町村一覧フレーム取得: %s", city_frm_url)

    resp = await client.get(city_frm_url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # フレームセットの場合、市区町村リストのフレームを探す
    target_url = city_frm_url
    frames = soup.find_all("frame")
    if frames:
        for frame in frames:
            src = frame.get("src", "")
            if "city" in src.lower() or "menu" in src.lower() or "left" in src.lower():
                if src.startswith("http"):
                    target_url = src
                else:
                    base = city_frm_url.rsplit("/", 1)[0]
                    target_url = f"{base}/{src}"
                break
        else:
            # 最初のフレームを使用
            src = frames[0].get("src", "")
            if src:
                if src.startswith("http"):
                    target_url = src
                else:
                    base = city_frm_url.rsplit("/", 1)[0]
                    target_url = f"{base}/{src}"

    if target_url != city_frm_url:
        logger.info("市区町村リストフレーム取得: %s", target_url)
        await asyncio.sleep(REQUEST_DELAY)
        resp = await client.get(target_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

    # リンクから市区町村名→コードを抽出
    municipalities: list[tuple[str, str]] = []
    for a_tag in soup.find_all("a", href=True):
        link_text = clean_text(a_tag.get_text())
        href = a_tag["href"]

        if not link_text:
            continue

        # 倍率表コードを抽出: "html/d08201rf.htm" や "../html/d08201rf.htm"
        m = re.search(r"([a-z]\d{5}rf)", href)
        if m:
            code = m.group(1)
            municipalities.append((link_text, code))
            logger.debug("  発見: %s → %s", link_text, code)

    logger.info("市区町村数: %d", len(municipalities))
    return municipalities


async def fetch_multiplier_page(
    client: httpx.AsyncClient,
    code: str,
) -> str:
    """倍率表HTMLページを取得.

    Args:
        code: 倍率表コード（例: d08201rf）

    Returns:
        HTML文字列
    """
    url = f"{NTA_BASE}/{YEAR_PATH}/{BUREAU}/{PREF}/ratios/html/{code}.htm"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.text


async def scrape_all() -> list[MultiplierRecord]:
    """茨城県の全市町村の倍率表をスクレイピング."""
    all_records: list[MultiplierRecord] = []

    async with httpx.AsyncClient(
        timeout=30.0,
        headers=BROWSER_HEADERS,
        follow_redirects=True,
    ) as client:
        # Step 1: 市区町村一覧を取得
        municipalities = await fetch_municipality_list(client)

        if not municipalities:
            logger.error("市区町村一覧が取得できませんでした")
            return []

        # Step 2: 各市区町村の倍率表を取得
        total = len(municipalities)
        for i, (city_name, code) in enumerate(municipalities, 1):
            logger.info("[%d/%d] %s (%s) を取得中...", i, total, city_name, code)

            try:
                await asyncio.sleep(REQUEST_DELAY)
                html = await fetch_multiplier_page(client, code)
                rows = parse_multiplier_html(html)

                for row in rows:
                    record = MultiplierRecord(
                        municipality=city_name,
                        municipality_code=code,
                        town_name=row["town_name"],
                        area_name=row["area_name"],
                        leasehold_ratio=row["leasehold_ratio"],
                        residential=row["residential"],
                        paddy=row["paddy"],
                        field=row["field"],
                        forest=row["forest"],
                        wasteland=row["wasteland"],
                        is_rosenka_area=row["residential"].strip() == "路線",
                    )
                    all_records.append(record)

                logger.info("  → %d 行取得", len(rows))

            except httpx.HTTPStatusError as e:
                logger.warning("  → HTTP エラー (%s): %s", code, e)
            except Exception as e:
                logger.warning("  → 取得失敗 (%s): %s", code, e)

    return all_records


# ------------------------------------------------------------------
# 出力
# ------------------------------------------------------------------
def save_json(records: list[MultiplierRecord], path: Path) -> None:
    """JSONファイルとして保存."""
    data = {
        "prefecture": "茨城県",
        "year": "令和7年",
        "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": len(records),
        "municipalities": {},
    }

    for rec in records:
        city = rec.municipality
        if city not in data["municipalities"]:
            data["municipalities"][city] = {
                "code": rec.municipality_code,
                "records": [],
            }
        data["municipalities"][city]["records"].append({
            "town_name": rec.town_name,
            "area_name": rec.area_name,
            "leasehold_ratio": rec.leasehold_ratio,
            "residential": rec.residential,
            "paddy": rec.paddy,
            "field": rec.field,
            "forest": rec.forest,
            "wasteland": rec.wasteland,
            "is_rosenka_area": rec.is_rosenka_area,
        })

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info("JSON保存: %s", path)


def save_csv(records: list[MultiplierRecord], path: Path) -> None:
    """CSVファイルとして保存."""
    path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "市区町村", "倍率表コード", "町名", "適用地域名",
        "借地権割合", "宅地", "田", "畑", "山林", "原野",
        "路線価地域",
    ]

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for rec in records:
            writer.writerow({
                "市区町村": rec.municipality,
                "倍率表コード": rec.municipality_code,
                "町名": rec.town_name,
                "適用地域名": rec.area_name,
                "借地権割合": rec.leasehold_ratio,
                "宅地": rec.residential,
                "田": rec.paddy,
                "畑": rec.field,
                "山林": rec.forest,
                "原野": rec.wasteland,
                "路線価地域": "○" if rec.is_rosenka_area else "",
            })

    logger.info("CSV保存: %s", path)


# ------------------------------------------------------------------
# メイン
# ------------------------------------------------------------------
async def main():
    logger.info("=" * 60)
    logger.info("茨城県 評価倍率表 一括スクレイピング開始")
    logger.info("=" * 60)

    start = time.time()
    records = await scrape_all()
    elapsed = time.time() - start

    if not records:
        logger.error("レコードが取得できませんでした")
        sys.exit(1)

    # 集計
    cities = set(r.municipality for r in records)
    rosenka_count = sum(1 for r in records if r.is_rosenka_area)
    bairitsu_count = len(records) - rosenka_count

    logger.info("-" * 60)
    logger.info("スクレイピング完了: %.1f秒", elapsed)
    logger.info("市区町村数: %d", len(cities))
    logger.info("総レコード数: %d", len(records))
    logger.info("  路線価地域: %d 件", rosenka_count)
    logger.info("  倍率地域: %d 件", bairitsu_count)

    # 保存
    json_path = OUTPUT_DIR / "ibaraki_multipliers.json"
    csv_path = OUTPUT_DIR / "ibaraki_multipliers.csv"
    save_json(records, json_path)
    save_csv(records, csv_path)

    logger.info("=" * 60)
    logger.info("完了！")
    logger.info("  JSON: %s", json_path)
    logger.info("  CSV:  %s", csv_path)
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
