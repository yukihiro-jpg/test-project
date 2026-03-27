"""splitter モジュールのテスト"""

from pathlib import Path

from mjs_pdf_splitter.classifier import DocumentSegment
from mjs_pdf_splitter.splitter import build_filename, resolve_collision


class TestBuildFilename:
    def test_full_info(self):
        seg = DocumentSegment(
            doc_type="法人税申告書",
            start_page=0,
            end_page=5,
            company_name="サンプル株式会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "法人税申告書_令和6年3月決算_サンプル株式会社.pdf"

    def test_without_fiscal_period(self):
        seg = DocumentSegment(
            doc_type="消費税申告書",
            start_page=0,
            end_page=3,
            company_name="テスト合同会社",
            fiscal_period="",
        )
        assert build_filename(seg) == "消費税申告書_テスト合同会社.pdf"

    def test_unknown_company(self):
        seg = DocumentSegment(
            doc_type="決算報告書",
            start_page=0,
            end_page=10,
            company_name="不明",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "決算報告書_令和6年3月決算_不明.pdf"


class TestResolveCollision:
    def test_no_collision(self, tmp_path: Path):
        filepath = tmp_path / "test.pdf"
        assert resolve_collision(filepath) == filepath

    def test_with_collision(self, tmp_path: Path):
        filepath = tmp_path / "test.pdf"
        filepath.touch()
        result = resolve_collision(filepath)
        assert result == tmp_path / "test_2.pdf"

    def test_multiple_collisions(self, tmp_path: Path):
        filepath = tmp_path / "test.pdf"
        filepath.touch()
        (tmp_path / "test_2.pdf").touch()
        (tmp_path / "test_3.pdf").touch()
        result = resolve_collision(filepath)
        assert result == tmp_path / "test_4.pdf"
