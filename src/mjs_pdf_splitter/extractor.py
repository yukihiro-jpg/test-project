"""PDFからのテキスト抽出"""

from dataclasses import dataclass
from pathlib import Path

import fitz


@dataclass
class PageText:
    """1ページ分の抽出テキスト"""
    page_index: int
    full_text: str
    header_text: str  # ページ上部40%のテキスト（書類種類判定用）


def extract_page_texts(pdf_path: Path) -> list[PageText]:
    """PDFの全ページからテキストを抽出する。

    各ページについて、全文テキストとヘッダー領域（上部40%）のテキストを返す。
    """
    doc = fitz.open(str(pdf_path))

    if doc.is_encrypted:
        doc.close()
        raise ValueError(
            f"PDFファイルが暗号化されています: {pdf_path}\n"
            "暗号化を解除してから再度お試しください。"
        )

    pages: list[PageText] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        full_text = page.get_text("text")

        # ヘッダー領域（上部40%）のテキストを抽出
        header_clip = fitz.Rect(
            0, 0, page.rect.width, page.rect.height * 0.4
        )
        header_text = page.get_text("text", clip=header_clip)

        pages.append(PageText(
            page_index=page_index,
            full_text=full_text,
            header_text=header_text,
        ))

    doc.close()

    if not pages:
        raise ValueError(f"PDFファイルにページがありません: {pdf_path}")

    # テキストが全く抽出できない場合の警告チェック
    total_text = sum(len(p.full_text.strip()) for p in pages)
    if total_text == 0:
        raise ValueError(
            f"PDFからテキストを抽出できませんでした: {pdf_path}\n"
            "スキャン画像のPDFには対応していません。テキストベースのPDFをお使いください。"
        )

    return pages
