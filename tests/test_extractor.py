"""extractor モジュールのテスト（PyMuPDFが必要）"""

import pytest
from pathlib import Path

import fitz

from mjs_pdf_splitter.extractor import extract_page_texts


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    """テスト用のシンプルなPDFを生成する"""
    pdf_path = tmp_path / "test.pdf"
    doc = fitz.open()

    # 1ページ目: 法人税申告書
    page = doc.new_page()
    text_point = fitz.Point(72, 72)
    page.insert_text(text_point, "法人税申告書", fontsize=16, fontname="japan")
    text_point2 = fitz.Point(72, 120)
    page.insert_text(text_point2, "法人名：テスト株式会社", fontsize=12, fontname="japan")
    text_point3 = fitz.Point(72, 150)
    page.insert_text(text_point3, "令和6年3月期", fontsize=12, fontname="japan")

    # 2ページ目: 別表
    page2 = doc.new_page()
    page2.insert_text(fitz.Point(72, 72), "別表一", fontsize=12, fontname="japan")

    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


@pytest.fixture
def empty_pdf(tmp_path: Path) -> Path:
    """テキストなしのPDF"""
    pdf_path = tmp_path / "empty.pdf"
    doc = fitz.open()
    doc.new_page()
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


def test_extract_basic(sample_pdf: Path):
    pages = extract_page_texts(sample_pdf)
    assert len(pages) == 2
    assert pages[0].page_index == 0
    assert pages[1].page_index == 1
    assert "法人税" in pages[0].full_text or "法人税" in pages[0].header_text


def test_extract_empty_pdf_raises(empty_pdf: Path):
    with pytest.raises(ValueError, match="テキストを抽出できません"):
        extract_page_texts(empty_pdf)


def test_extract_nonexistent_file():
    with pytest.raises(Exception):
        extract_page_texts(Path("/nonexistent/file.pdf"))
