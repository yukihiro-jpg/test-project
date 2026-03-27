"""書類種類の判定、境界検出、会社名・決算期の抽出"""

import re
from dataclasses import dataclass

from mjs_pdf_splitter.constants import (
    COMPANY_NAME_PATTERNS,
    DOCUMENT_TYPE_PATTERNS,
    FISCAL_PERIOD_PATTERN,
    INVALID_FILENAME_CHARS,
)
from mjs_pdf_splitter.extractor import PageText


@dataclass
class DocumentSegment:
    """分割された書類の1セグメント"""
    doc_type: str
    start_page: int
    end_page: int
    company_name: str
    fiscal_period: str  # 例: "令和6年3月決算"


def classify_page(header_text: str) -> str | None:
    """ページヘッダーのテキストから書類種類を判定する。

    マッチしない場合はNoneを返す。
    """
    # 空白・改行を除去して判定しやすくする
    normalized = re.sub(r"\s+", "", header_text)
    for pattern, doc_type in DOCUMENT_TYPE_PATTERNS:
        if pattern.search(normalized):
            return doc_type
    return None


def extract_company_name(page_text: str) -> str:
    """ページテキストから会社名を抽出する。

    見つからない場合は「不明」を返す。
    """
    for pattern in COMPANY_NAME_PATTERNS:
        match = pattern.search(page_text)
        if match:
            name = match.group(1).strip()
            # 改行以降を除去（次のフィールドが続く場合）
            name = name.split("\n")[0].strip()
            # ファイル名に使えない文字を除去
            name = sanitize_for_filename(name)
            if name:
                return name
    return "不明"


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

    各セグメントには書類種類、開始/終了ページ、会社名、決算期が含まれる。
    """
    if not pages:
        return []

    segments: list[DocumentSegment] = []
    current_type: str | None = None
    current_start = 0
    current_company = "不明"
    current_fiscal = ""

    for page in pages:
        detected = classify_page(page.header_text)

        if detected is not None and detected != current_type:
            # 新しい書類種類が検出された = 境界
            if current_type is not None:
                segments.append(DocumentSegment(
                    doc_type=current_type,
                    start_page=current_start,
                    end_page=page.page_index - 1,
                    company_name=current_company,
                    fiscal_period=current_fiscal,
                ))

            current_type = detected
            current_start = page.page_index
            # 新セグメントの先頭ページから会社名と決算期を抽出
            current_company = extract_company_name(page.full_text)
            current_fiscal = extract_fiscal_period(page.full_text)

        elif detected is not None and detected == current_type:
            # 同じ書類種類が再度検出された場合
            # 会社名が異なる場合は別セグメントとして扱う
            new_company = extract_company_name(page.full_text)
            if new_company != "不明" and new_company != current_company:
                segments.append(DocumentSegment(
                    doc_type=current_type,
                    start_page=current_start,
                    end_page=page.page_index - 1,
                    company_name=current_company,
                    fiscal_period=current_fiscal,
                ))
                current_start = page.page_index
                current_company = new_company
                current_fiscal = extract_fiscal_period(page.full_text)

        # detected is None の場合は現在のセグメントの続きとして扱う

        # 最初のページで書類種類が検出されなかった場合、全文でも試す
        if current_type is None and page.page_index == 0:
            detected_full = classify_page(page.full_text)
            if detected_full is not None:
                current_type = detected_full
                current_start = 0
                current_company = extract_company_name(page.full_text)
                current_fiscal = extract_fiscal_period(page.full_text)

    # 最後のセグメントを閉じる
    if current_type is not None and pages:
        segments.append(DocumentSegment(
            doc_type=current_type,
            start_page=current_start,
            end_page=pages[-1].page_index,
            company_name=current_company,
            fiscal_period=current_fiscal,
        ))

    return segments
