"""国税庁 評価倍率表スクレイパー.

rosenka.nta.go.jp から評価倍率表(HTMLテーブル)を取得し、
路線価地域/倍率地域の判定と倍率値を抽出する。

バッチモード: 都道府県全体の倍率表を一括取得しJSON/CSVに保存する機能も提供。
"""

from __future__ import annotations

import csv
import json
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from ..config import config
from ..models import MultiplierInfo

logger = logging.getLogger(__name__)

# 国税局→都道府県のマッピング
BUREAU_PREFECTURE_MAP: dict[str, tuple[str, str]] = {
    # (国税局コード, 都道府県ローマ字): URL上のパス
    "北海道": ("sapporo", "hokkaido"),
    "青森県": ("sendai", "aomori"),
    "岩手県": ("sendai", "iwate"),
    "宮城県": ("sendai", "miyagi"),
    "秋田県": ("sendai", "akita"),
    "山形県": ("sendai", "yamagata"),
    "福島県": ("sendai", "fukusima"),
    "茨城県": ("kanto", "ibaraki"),
    "栃木県": ("kanto", "tochigi"),
    "群馬県": ("kanto", "gunma"),
    "埼玉県": ("kanto", "saitama"),
    "千葉県": ("kanto", "chiba"),
    "東京都": ("tokyo", "tokyo"),
    "神奈川県": ("tokyo", "kanagawa"),
    "新潟県": ("kanto", "niigata"),
    "富山県": ("kanazawa", "toyama"),
    "石川県": ("kanazawa", "ishikawa"),
    "福井県": ("kanazawa", "fukui"),
    "山梨県": ("tokyo", "yamanashi"),
    "長野県": ("kanto", "nagano"),
    "岐阜県": ("nagoya", "gifu"),
    "静岡県": ("nagoya", "shizuoka"),
    "愛知県": ("nagoya", "aichi"),
    "三重県": ("nagoya", "mie"),
    "滋賀県": ("osaka", "shiga"),
    "京都府": ("osaka", "kyoto"),
    "大阪府": ("osaka", "osaka"),
    "兵庫県": ("osaka", "hyogo"),
    "奈良県": ("osaka", "nara"),
    "和歌山県": ("osaka", "wakayama"),
    "鳥取県": ("hirosima", "tottori"),
    "島根県": ("hirosima", "shimane"),
    "岡山県": ("hirosima", "okayama"),
    "広島県": ("hirosima", "hirosima"),
    "山口県": ("hirosima", "yamaguchi"),
    "徳島県": ("hirosima", "tokushima"),
    "香川県": ("hirosima", "kagawa"),
    "愛媛県": ("hirosima", "ehime"),
    "高知県": ("hirosima", "kochi"),
    "福岡県": ("fukuoka", "fukuoka"),
    "佐賀県": ("fukuoka", "saga"),
    "長崎県": ("fukuoka", "nagasaki"),
    "熊本県": ("kumamoto", "kumamoto"),
    "大分県": ("kumamoto", "oita"),
    "宮崎県": ("kumamoto", "miyazaki"),
    "鹿児島県": ("kumamoto", "kagosima"),
    "沖縄県": ("okinawa", "okinawa"),
}

# ブラウザヘッダー
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}


@dataclass
class MultiplierRow:
    """倍率表の1行."""

    town_name: str
    area_name: str
    leasehold_ratio: str
    residential: str  # 宅地
    paddy: str        # 田
    field: str        # 畑
    forest: str       # 山林
    wasteland: str    # 原野


async def resolve_municipality_code(
    prefecture: str,
    city_name: str,
) -> str:
    """市区町村名から倍率表のページコード（例: d21104rf）を自動解決.

    国税庁の市区町村一覧フレームページをスクレイピングして、
    市区町村名→倍率表HTMLファイル名のマッピングを行う。

    Args:
        prefecture: 都道府県名（例: "東京都"）
        city_name: 市区町村名（例: "渋谷区", "八王子市"）

    Returns:
        倍率表コード（例: "d21104rf"）。見つからない場合は空文字。
    """
    bureau_pref = BUREAU_PREFECTURE_MAP.get(prefecture)
    if not bureau_pref:
        logger.warning("都道府県マッピングなし: %s", prefecture)
        return ""

    bureau, pref = bureau_pref
    # 倍率表の市区町村一覧ページ
    city_list_url = (
        f"{config.nta_base_url}/{config.nta_year_path}"
        f"/{bureau}/{pref}/ratios/city_frm.htm"
    )

    try:
        async with httpx.AsyncClient(
            timeout=15.0, headers=BROWSER_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(city_list_url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            # フレームセットの場合、市区町村リストのフレームURLを取得
            frames = soup.find_all("frame")
            city_list_frame_url = ""
            for frame in frames:
                src = frame.get("src", "")
                if "city" in src.lower() or "menu" in src.lower():
                    if src.startswith("http"):
                        city_list_frame_url = src
                    else:
                        # 相対URL解決
                        base = city_list_url.rsplit("/", 1)[0]
                        city_list_frame_url = f"{base}/{src}"
                    break

            # フレームがなければ直接パース
            if city_list_frame_url:
                resp2 = await client.get(city_list_frame_url)
                resp2.raise_for_status()
                soup = BeautifulSoup(resp2.text, "lxml")

            # リンクから市区町村名→コードのマッピングを構築
            for a_tag in soup.find_all("a", href=True):
                link_text = _clean_text(a_tag.get_text())
                href = a_tag["href"]

                # 市区町村名が部分一致するか
                if city_name in link_text or link_text in city_name:
                    # href から倍率表コードを抽出
                    # 例: "html/d21104rf.htm" → "d21104rf"
                    m = re.search(r"([a-z]\d{5}rf)", href)
                    if m:
                        code = m.group(1)
                        logger.info("倍率表コード解決: %s → %s", city_name, code)
                        return code

    except Exception as e:
        logger.warning("市区町村コード解決失敗 (%s, %s): %s", prefecture, city_name, e)

    return ""


async def fetch_multiplier_table(
    prefecture: str,
    municipality_code: str,
) -> list[MultiplierRow]:
    """評価倍率表をHTMLから取得・パース.

    Args:
        prefecture: 都道府県名（例: "東京都"）
        municipality_code: 市区町村コード（例: "d21104rf"）

    Returns:
        倍率表の行データリスト
    """
    bureau_pref = BUREAU_PREFECTURE_MAP.get(prefecture)
    if not bureau_pref:
        logger.warning("都道府県マッピングなし: %s", prefecture)
        return []

    bureau, pref = bureau_pref
    url = (
        f"{config.nta_base_url}/{config.nta_year_path}"
        f"/{bureau}/{pref}/ratios/html/{municipality_code}.htm"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=BROWSER_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return _parse_multiplier_html(resp.text)
    except Exception as e:
        logger.warning("倍率表取得失敗 (%s): %s", url, e)
        return []


def _parse_multiplier_html(html: str) -> list[MultiplierRow]:
    """倍率表HTMLをパースして行データに変換."""
    soup = BeautifulSoup(html, "lxml")
    rows: list[MultiplierRow] = []

    tables = soup.find_all("table")
    if not tables:
        return rows

    # メインのデータテーブルを探す（最大の行数を持つテーブル）
    main_table = max(tables, key=lambda t: len(t.find_all("tr")))

    for tr in main_table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        texts = [_clean_text(c.get_text()) for c in cells]

        # ヘッダー行をスキップ（最低7列、かつ数値/「路線」を含む行のみ）
        if len(texts) < 7:
            continue
        if texts[0] in ("", "町（丁目）又は大字名", "町(丁目)又は大字名"):
            continue

        row = MultiplierRow(
            town_name=texts[0] if len(texts) > 0 else "",
            area_name=texts[1] if len(texts) > 1 else "",
            leasehold_ratio=texts[2] if len(texts) > 2 else "",
            residential=texts[3] if len(texts) > 3 else "",
            paddy=texts[4] if len(texts) > 4 else "",
            field=texts[5] if len(texts) > 5 else "",
            forest=texts[6] if len(texts) > 6 else "",
            wasteland=texts[7] if len(texts) > 7 else "",
        )
        rows.append(row)

    return rows


def lookup_multiplier(
    rows: list[MultiplierRow],
    town_name: str,
) -> MultiplierInfo:
    """町名から該当する倍率情報を検索.

    Args:
        rows: 倍率表の行データ
        town_name: 検索対象の町名（部分一致）

    Returns:
        MultiplierInfo
    """
    info = MultiplierInfo()

    for row in rows:
        if town_name in row.town_name or row.town_name in town_name:
            info.town_name = row.town_name
            info.area_name = row.area_name
            info.leasehold_ratio = row.leasehold_ratio
            info.residential_multiplier = row.residential
            info.paddy_multiplier = row.paddy
            info.field_multiplier = row.field
            info.forest_multiplier = row.forest
            info.wasteland_multiplier = row.wasteland

            # 「路線」と書いてあれば路線価地域
            info.is_rosenka_area = row.residential.strip() == "路線"
            return info

    info.notes = "該当する町名が見つかりませんでした"
    return info


def _clean_text(text: str) -> str:
    """HTMLテキストのクリーンアップ."""
    return re.sub(r"\s+", " ", text).strip()


# ------------------------------------------------------------------
# バッチスクレイピング: 都道府県全体の倍率表を一括取得
# ------------------------------------------------------------------
REQUEST_DELAY = 1.0  # リクエスト間隔（秒）


async def fetch_municipality_list(
    prefecture: str,
) -> list[tuple[str, str]]:
    """都道府県の市区町村一覧を国税庁サイトから取得.

    Returns:
        [(市町村名, コード), ...] 例: [("水戸市", "d08201rf"), ...]
    """
    import asyncio

    bureau_pref = BUREAU_PREFECTURE_MAP.get(prefecture)
    if not bureau_pref:
        logger.warning("都道府県マッピングなし: %s", prefecture)
        return []

    bureau, pref = bureau_pref
    city_frm_url = (
        f"{config.nta_base_url}/{config.nta_year_path}"
        f"/{bureau}/{pref}/ratios/city_frm.htm"
    )

    async with httpx.AsyncClient(
        timeout=30.0, headers=BROWSER_HEADERS, follow_redirects=True
    ) as client:
        logger.info("市区町村一覧フレーム取得: %s", city_frm_url)
        resp = await client.get(city_frm_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # フレームセット対応
        target_url = city_frm_url
        frames = soup.find_all("frame")
        if frames:
            for frame in frames:
                src = frame.get("src", "")
                if any(kw in src.lower() for kw in ("city", "menu", "left")):
                    base = city_frm_url.rsplit("/", 1)[0]
                    target_url = src if src.startswith("http") else f"{base}/{src}"
                    break
            else:
                src = frames[0].get("src", "")
                if src:
                    base = city_frm_url.rsplit("/", 1)[0]
                    target_url = src if src.startswith("http") else f"{base}/{src}"

        if target_url != city_frm_url:
            logger.info("市区町村リストフレーム取得: %s", target_url)
            await asyncio.sleep(REQUEST_DELAY)
            resp = await client.get(target_url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

        municipalities: list[tuple[str, str]] = []
        for a_tag in soup.find_all("a", href=True):
            link_text = _clean_text(a_tag.get_text())
            href = a_tag["href"]
            if not link_text:
                continue
            m = re.search(r"([a-z]\d{5}rf)", href)
            if m:
                municipalities.append((link_text, m.group(1)))

        logger.info("市区町村数: %d", len(municipalities))
        return municipalities


async def scrape_prefecture_multipliers(
    prefecture: str,
) -> list[dict]:
    """都道府県全体の倍率表を一括スクレイピング.

    Args:
        prefecture: 都道府県名（例: "茨城県"）

    Returns:
        各レコードの辞書リスト
    """
    import asyncio

    bureau_pref = BUREAU_PREFECTURE_MAP.get(prefecture)
    if not bureau_pref:
        return []

    bureau, pref = bureau_pref
    municipalities = await fetch_municipality_list(prefecture)
    if not municipalities:
        return []

    all_records: list[dict] = []

    async with httpx.AsyncClient(
        timeout=30.0, headers=BROWSER_HEADERS, follow_redirects=True
    ) as client:
        total = len(municipalities)
        for i, (city_name, code) in enumerate(municipalities, 1):
            logger.info("[%d/%d] %s (%s) を取得中...", i, total, city_name, code)

            try:
                await asyncio.sleep(REQUEST_DELAY)
                url = (
                    f"{config.nta_base_url}/{config.nta_year_path}"
                    f"/{bureau}/{pref}/ratios/html/{code}.htm"
                )
                resp = await client.get(url)
                resp.raise_for_status()
                rows = _parse_multiplier_html(resp.text)

                for row in rows:
                    all_records.append({
                        "municipality": city_name,
                        "municipality_code": code,
                        "town_name": row.town_name,
                        "area_name": row.area_name,
                        "leasehold_ratio": row.leasehold_ratio,
                        "residential": row.residential,
                        "paddy": row.paddy,
                        "field": row.field,
                        "forest": row.forest,
                        "wasteland": row.wasteland,
                        "is_rosenka_area": row.residential.strip() == "路線",
                    })

                logger.info("  → %d 行取得", len(rows))

            except Exception as e:
                logger.warning("  → 取得失敗 (%s): %s", code, e)

    return all_records


def save_multipliers_json(
    records: list[dict],
    prefecture: str,
    path: Path,
) -> None:
    """スクレイピング結果をJSONファイルに保存."""
    data = {
        "prefecture": prefecture,
        "year": f"令和{config.nta_year[1:]}年",
        "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": len(records),
        "municipalities": {},
    }

    for rec in records:
        city = rec["municipality"]
        if city not in data["municipalities"]:
            data["municipalities"][city] = {
                "code": rec["municipality_code"],
                "records": [],
            }
        data["municipalities"][city]["records"].append({
            k: v for k, v in rec.items()
            if k not in ("municipality", "municipality_code")
        })

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info("JSON保存: %s (%d レコード)", path, len(records))


def save_multipliers_csv(
    records: list[dict],
    path: Path,
) -> None:
    """スクレイピング結果をCSVファイルに保存."""
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
                "市区町村": rec["municipality"],
                "倍率表コード": rec["municipality_code"],
                "町名": rec["town_name"],
                "適用地域名": rec["area_name"],
                "借地権割合": rec["leasehold_ratio"],
                "宅地": rec["residential"],
                "田": rec["paddy"],
                "畑": rec["field"],
                "山林": rec["forest"],
                "原野": rec["wasteland"],
                "路線価地域": "○" if rec["is_rosenka_area"] else "",
            })

    logger.info("CSV保存: %s (%d レコード)", path, len(records))


def load_multipliers_json(path: Path) -> dict:
    """保存済みJSONから倍率データを読み込み.

    Returns:
        JSONデータの辞書。読み込み失敗時は空辞書。
    """
    if not path.exists():
        logger.warning("倍率データファイルなし: %s", path)
        return {}

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def lookup_from_saved_data(
    data: dict,
    city_name: str,
    town_name: str,
) -> MultiplierInfo:
    """保存済みJSONデータから倍率情報を検索.

    Args:
        data: load_multipliers_json で読み込んだデータ
        city_name: 市区町村名
        town_name: 町名（部分一致）

    Returns:
        MultiplierInfo
    """
    info = MultiplierInfo()
    municipalities = data.get("municipalities", {})

    # 市区町村名の部分一致検索
    target_city = None
    for name in municipalities:
        if city_name in name or name in city_name:
            target_city = municipalities[name]
            break

    if not target_city:
        info.notes = f"市区町村 '{city_name}' が見つかりませんでした"
        return info

    # 町名の部分一致検索
    for rec in target_city.get("records", []):
        rec_town = rec.get("town_name", "")
        if town_name in rec_town or rec_town in town_name:
            info.town_name = rec_town
            info.area_name = rec.get("area_name", "")
            info.leasehold_ratio = rec.get("leasehold_ratio", "")
            info.residential_multiplier = rec.get("residential", "")
            info.paddy_multiplier = rec.get("paddy", "")
            info.field_multiplier = rec.get("field", "")
            info.forest_multiplier = rec.get("forest", "")
            info.wasteland_multiplier = rec.get("wasteland", "")
            info.is_rosenka_area = rec.get("is_rosenka_area", False)
            return info

    info.notes = f"町名 '{town_name}' が見つかりませんでした"
    return info
