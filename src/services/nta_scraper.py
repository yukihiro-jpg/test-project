"""国税庁 評価倍率表スクレイパー.

rosenka.nta.go.jp から評価倍率表(HTMLテーブル)を取得し、
路線価地域/倍率地域の判定と倍率値を抽出する。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
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
