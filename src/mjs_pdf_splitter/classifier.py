"""書類種類の判定、境界検出、会社名・決算期の抽出"""

import logging
import re
from dataclasses import dataclass

from mjs_pdf_splitter.constants import (
    COMPANY_NAME_PATTERN,
    DOCUMENT_TYPE_PATTERNS,
    FISCAL_PERIOD_PATTERN,
    INVALID_FILENAME_CHARS,
)
from mjs_pdf_splitter.extractor import PageText

logger = logging.getLogger(__name__)


@dataclass
class DocumentSegment:
    """分割された書類の1セグメント"""
    doc_type: str
    start_page: int
    end_page: int
    company_name: str
    fiscal_period: str  # 例: "令和6年3月決算"


def classify_page(page_text: str) -> str | None:
    """ページのテキストから書類種類を判定する。

    全文テキストから空白を除去した上でパターンマッチする。
    マッチしない場合はNoneを返す。
    """
    # 空白・改行を除去して判定しやすくする
    normalized = re.sub(r"\s+", "", page_text)
    for pattern, doc_type in DOCUMENT_TYPE_PATTERNS:
        if pattern.search(normalized):
            return doc_type
    return None


def extract_company_name_from_pages(pages: list[PageText]) -> str:
    """全ページのテキストから会社名（法人名）を抽出する。

    法人格パターン（株式会社、合同会社等）を含む文字列を検索する。
    最も多く出現する法人名を採用することで、誤検出を防ぐ。
    見つからない場合は「不明」を返す。
    """
    from collections import Counter

    name_counter: Counter[str] = Counter()

    for page in pages:
        text = page.full_text
        matches = COMPANY_NAME_PATTERN.findall(text)
        for match in matches:
            # 空白を正規化
            cleaned = re.sub(r"\s+", "", match).strip()
            cleaned = sanitize_for_filename(cleaned)
            if cleaned and len(cleaned) >= 3:  # 法人格 + 最低1文字
                name_counter[cleaned] += 1

    if not name_counter:
        return "不明"

    # 最も多く出現する法人名を採用
    most_common_name, count = name_counter.most_common(1)[0]
    logger.debug("会社名候補: %s", name_counter.most_common(5))
    logger.debug("採用: %s (%d回出現)", most_common_name, count)
    return most_common_name


def extract_fiscal_period(page_text: str) -> str:
    """ページテキストから和暦の決算期を抽出する。

    例: "令和6年3月決算"
    見つからない場合は空文字を返す。
    """
    # 空白を正規化してからマッチ
    normalized = re.sub(r"[\s　]+", "", page_text)
    match = FISCAL_PERIOD_PATTERN.search(normalized)
    if match:
        era = match.group(1)
        year = match.group(2)
        month = match.group(3)
        return f"{era}{year}年{month}月決算"
    return ""


def sanitize_for_filename(text: str) -> str:
    """ファイル名に使用できない文字を除去する。"""
    result = INVALID_FILENAME_CHARS.sub("", text)
    # 前後の空白を除去し、最大50文字に制限
    return result.strip()[:50]


def find_document_boundaries(pages: list[PageText]) -> list[DocumentSegment]:
    """ページリストから書類の境界を検出し、セグメントのリストを返す。

    1. 各ページを全文テキストで書類種類判定（ヘッダーだけでなく全文を使用）
    2. 書類種類が変わったページを境界とする
    3. 判定できないページは前のページの書類種類を継承する
    4. 会社名はPDF全体から1つ抽出して全セグメントに適用する
       （1つのPDF = 1社の書類のため）
    """
    if not pages:
        return []

    # 会社名をPDF全体から抽出（全セグメント共通）
    company_name = extract_company_name_from_pages(pages)

    # 決算期を最初に見つかったもので統一
    fiscal_period = ""
    for page in pages:
        fp = extract_fiscal_period(page.full_text)
        if fp:
            fiscal_period = fp
            break

    # 各ページの書類種類を判定
    page_types: list[str | None] = []
    for page in pages:
        # まずヘッダー領域で判定
        detected = classify_page(page.header_text)
        if detected is None:
            # ヘッダーで判定できなければ全文で判定
            detected = classify_page(page.full_text)
        page_types.append(detected)
        logger.debug(
            "ページ %d: 判定=%s",
            page.page_index + 1,
            detected or "（判定不可→前ページ継承）",
        )

    # 境界検出: 書類種類が変わったところで分割
    segments: list[DocumentSegment] = []
    current_type: str | None = None
    current_start = 0

    for i, detected in enumerate(page_types):
        if detected is not None and detected != current_type:
            # 新しい書類種類 = 境界
            if current_type is not None:
                segments.append(DocumentSegment(
                    doc_type=current_type,
                    start_page=current_start,
                    end_page=i - 1,
                    company_name=company_name,
                    fiscal_period=fiscal_period,
                ))
            current_type = detected
            current_start = i
        # detected is None or detected == current_type → 継承

    # 最後のセグメントを閉じる
    if current_type is not None:
        segments.append(DocumentSegment(
            doc_type=current_type,
            start_page=current_start,
            end_page=len(pages) - 1,
            company_name=company_name,
            fiscal_period=fiscal_period,
        ))

    return segments
