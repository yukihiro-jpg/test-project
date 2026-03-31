"""splitter モジュールのテスト"""

from pathlib import Path

from mjs_pdf_splitter.classifier import DocumentSegment
from mjs_pdf_splitter.splitter import build_filename, resolve_collision


class TestBuildFilename:
    def test_numbered_doc(self):
        seg = DocumentSegment(
            doc_type="法人税申告書",
            start_page=0,
            end_page=5,
            company_name="サンプル株式会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "01-法人税申告書_令和6年3月決算_サンプル株式会社.pdf"

    def test_consumption_tax_standard(self):
        seg = DocumentSegment(
            doc_type="消費税申告書（原則）",
            start_page=0,
            end_page=3,
            company_name="テスト合同会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "08-消費税申告書（原則）_令和6年3月決算_テスト合同会社.pdf"

    def test_consumption_tax_simplified(self):
        seg = DocumentSegment(
            doc_type="消費税申告書（簡易）",
            start_page=0,
            end_page=3,
            company_name="テスト合同会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "08-消費税申告書（簡易）_令和6年3月決算_テスト合同会社.pdf"

    def test_unnumbered_doc(self):
        """ナンバリング対象外の書類は番号なし"""
        seg = DocumentSegment(
            doc_type="償却資産税申告書",
            start_page=0,
            end_page=1,
            company_name="テスト合同会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "償却資産税申告書_令和6年3月決算_テスト合同会社.pdf"

    def test_without_fiscal_period(self):
        seg = DocumentSegment(
            doc_type="決算報告書",
            start_page=0,
            end_page=3,
            company_name="テスト合同会社",
            fiscal_period="",
        )
        assert build_filename(seg) == "02-決算報告書_テスト合同会社.pdf"

    def test_mail_detail(self):
        seg = DocumentSegment(
            doc_type="メール詳細",
            start_page=0,
            end_page=3,
            company_name="テスト合同会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "09-メール詳細_令和6年3月決算_テスト合同会社.pdf"

    def test_direct_payment(self):
        seg = DocumentSegment(
            doc_type="ダイレクト納付情報",
            start_page=0,
            end_page=1,
            company_name="テスト合同会社",
            fiscal_period="令和6年3月決算",
        )
        assert build_filename(seg) == "10-ダイレクト納付情報_令和6年3月決算_テスト合同会社.pdf"


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
