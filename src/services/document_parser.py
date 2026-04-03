"""書類パーサー.

謄本、固定資産税評価証明書（課税明細書）、名寄帳、農地台帳の
PDF/画像からテキストを抽出し、不動産情報を構造化する。

Claude API消費を最小化するため、ルールベース（正規表現）で抽出する。
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

import pdfplumber

from ..models import UploadedProperty

logger = logging.getLogger(__name__)


def parse_document(file_path: Path) -> list[UploadedProperty]:
    """書類ファイルから不動産情報を抽出.

    Args:
        file_path: アップロードされたファイルのパス

    Returns:
        抽出された不動産情報のリスト（1ファイルに複数筆含む場合あり）
    """
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return _parse_pdf(file_path)
    elif suffix in (".txt", ".csv"):
        return _parse_text(file_path)
    else:
        logger.warning("未対応のファイル形式: %s", suffix)
        return []


def _parse_pdf(file_path: Path) -> list[UploadedProperty]:
    """PDFファイルから不動産情報を抽出."""
    properties: list[UploadedProperty] = []
    full_text = ""

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                full_text += text + "\n"

                # テーブル抽出も試みる
                tables = page.extract_tables() or []
                for table in tables:
                    props = _extract_from_table(table, file_path.name)
                    properties.extend(props)
    except Exception as e:
        logger.error("PDF読み込みエラー (%s): %s", file_path.name, e)
        return properties

    # テーブルから取得できなかった場合、テキストベースで抽出
    if not properties:
        properties = _extract_from_text(full_text, file_path.name)

    return properties


def _parse_text(file_path: Path) -> list[UploadedProperty]:
    """テキストファイルから不動産情報を抽出."""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    return _extract_from_text(text, file_path.name)


def _extract_from_table(
    table: list[list[Optional[str]]], source_file: str
) -> list[UploadedProperty]:
    """テーブルデータから不動産情報を抽出."""
    properties: list[UploadedProperty] = []

    if not table or len(table) < 2:
        return properties

    # ヘッダー行からカラム位置を特定
    header = [str(c or "").strip() for c in table[0]]
    col_map = _detect_columns(header)

    if not col_map:
        return properties

    for row in table[1:]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        cells = [str(c or "").strip() for c in row]
        prop = UploadedProperty(source_file=source_file)

        if "location" in col_map and col_map["location"] < len(cells):
            prop.location = cells[col_map["location"]]
        if "chiban" in col_map and col_map["chiban"] < len(cells):
            prop.chiban = cells[col_map["chiban"]]
        if "chimoku" in col_map and col_map["chimoku"] < len(cells):
            prop.chimoku = cells[col_map["chimoku"]]
        if "area" in col_map and col_map["area"] < len(cells):
            prop.land_area_sqm = _parse_number(cells[col_map["area"]])
        if "value" in col_map and col_map["value"] < len(cells):
            prop.fixed_asset_value = _parse_int(cells[col_map["value"]])

        if prop.location or prop.chiban:
            properties.append(prop)

    return properties


def _detect_columns(header: list[str]) -> dict[str, int]:
    """ヘッダー行からカラム位置を検出."""
    col_map: dict[str, int] = {}
    for i, h in enumerate(header):
        if re.search(r"所在|所在地", h):
            col_map["location"] = i
        elif re.search(r"地番", h):
            col_map["chiban"] = i
        elif re.search(r"地目", h):
            col_map["chimoku"] = i
        elif re.search(r"地積|面積", h):
            col_map["area"] = i
        elif re.search(r"評価額|価格", h):
            col_map["value"] = i
        elif re.search(r"所有者|氏名", h):
            col_map["owner"] = i
    return col_map


def _extract_from_text(text: str, source_file: str) -> list[UploadedProperty]:
    """テキストから正規表現で不動産情報を抽出."""
    properties: list[UploadedProperty] = []
    prop = UploadedProperty(source_file=source_file)

    # 所在パターン
    m = re.search(r"所在[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        prop.location = m.group(1).strip()

    # 地番パターン
    m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        prop.chiban = m.group(1).strip()

    # 地目パターン
    m = re.search(r"地目[　\s]*[：:]?[　\s]*(宅地|田|畑|山林|原野|雑種地|墓地|境内地|公衆用道路)", text)
    if m:
        prop.chimoku = m.group(1).strip()

    # 地積パターン
    m = re.search(r"地積[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m]", text)
    if m:
        prop.land_area_sqm = _parse_number(m.group(1))

    # 固定資産税評価額パターン
    m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,，]+)\s*円?", text)
    if m:
        prop.fixed_asset_value = _parse_int(m.group(1))

    # 所有者パターン
    m = re.search(r"(?:所有者|権利者|氏名)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        prop.owner = m.group(1).strip()

    if prop.location or prop.chiban:
        properties.append(prop)

    return properties


def _parse_number(s: str) -> Optional[float]:
    """数値文字列→float変換."""
    try:
        cleaned = s.replace(",", "").replace("，", "").replace(".", ".").strip()
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    """数値文字列→int変換."""
    try:
        cleaned = s.replace(",", "").replace("，", "").replace(" ", "").strip()
        return int(cleaned) if cleaned else None
    except ValueError:
        return None
