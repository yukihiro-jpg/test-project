"""Gemini API による農地台帳解析.

スキャンPDFの農地台帳をGemini のビジョン機能で画像として読み取り、
構造化データ(NochiDaicho)に変換する。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from ..config import config
from ..models import NochiDaicho

logger = logging.getLogger(__name__)

PROMPT = """\
この画像は農地台帳（農地台帳登載事項）のスキャンPDFです。
表に記載されているすべての筆（土地）の情報を読み取り、以下のJSON配列として出力してください。

出力形式（JSON配列のみ、他のテキストは不要）:
```json
[
  {
    "no": 1,
    "location": "加倉井町",
    "chiban": "2279",
    "chimoku": "田",
    "area_sqm": 1534.00,
    "farm_category": "普通田",
    "farmer_name": "鈴木 均",
    "right_type": "所有",
    "right_holder": "",
    "lease_type": "",
    "lease_period": ""
  }
]
```

各フィールドの説明:
- no: 表の行番号
- location: 土地の所在地（町名まで。例: "加倉井町", "中原町"）
- chiban: 地番（例: "2279", "32-1", "46-2"）
- chimoku: 地目（台帳の地目。例: "田", "畑", "雑種地"）
- area_sqm: 台帳面積（㎡単位の数値）
- farm_category: 利用状況/農地区分（例: "普通田", "普通畑"）
- farmer_name: 耕作者（又は借受人）の氏名
- right_type: 権利種別。自作なら"所有"、貸借があれば"賃貸借"/"使用貸借"/"利用権"等
- right_holder: 所有者の氏名（耕作者と異なる場合）
- lease_type: 貸借形態（例: "賃貸借（利用権）", "使用貸借（利用権）"）。なければ空文字
- lease_period: 貸借期間（例: "令5.6.20〜令10.12.31（5年間）"）。なければ空文字

注意:
- ページ上部の「農家世帯番号」「農業経営主 氏名」の情報も参考にしてください
- 「自」は自作（所有）、「小」は小作（貸借あり）を意味します
- 「調」は市街化調整区域を意味します
- 複数ページある場合はすべてのページの筆を含めてください
- JSON配列のみを出力し、```json マーカーは不要です
"""


def parse_nochi_with_gemini(file_path: Path) -> list[NochiDaicho]:
    """Gemini APIで農地台帳PDFを解析."""
    if not config.gemini_api_key:
        logger.warning("GEMINI_API_KEY が未設定のため農地台帳のAI解析をスキップします")
        return []

    import google.generativeai as genai

    genai.configure(api_key=config.gemini_api_key)

    try:
        uploaded = genai.upload_file(str(file_path))
    except Exception as e:
        logger.error("Gemini ファイルアップロード失敗: %s", e)
        return []

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            [PROMPT, uploaded],
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        logger.error("Gemini API呼び出し失敗: %s", e)
        return []

    try:
        genai.delete_file(uploaded.name)
    except Exception:
        pass

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        records = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Gemini応答のJSONパース失敗: %s\n応答: %s", e, raw[:500])
        return []

    if not isinstance(records, list):
        logger.error("Gemini応答が配列ではありません: %s", type(records))
        return []

    results: list[NochiDaicho] = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        location = str(rec.get("location", "")).strip()
        chiban = str(rec.get("chiban", "")).strip()
        if not location and not chiban:
            continue

        nd = NochiDaicho(
            source_file=file_path.name,
            location=location,
            chiban=chiban,
            chimoku=str(rec.get("chimoku", "")).strip(),
            area_sqm=_to_float(rec.get("area_sqm")),
            farm_category=str(rec.get("farm_category", "")).strip(),
            farmer_name=str(rec.get("farmer_name", "")).strip(),
            right_type=str(rec.get("right_type", "")).strip(),
            right_holder=str(rec.get("right_holder", "")).strip(),
        )
        results.append(nd)

    logger.info("Gemini農地台帳解析: %s → %d筆", file_path.name, len(results))
    return results


def _to_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
