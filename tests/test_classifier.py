"""classifier モジュールのテスト"""

from mjs_pdf_splitter.classifier import (
    classify_page,
    extract_company_name,
    extract_fiscal_period,
    find_document_boundaries,
    sanitize_for_filename,
)
from mjs_pdf_splitter.extractor import PageText


class TestClassifyPage:
    def test_corporate_tax(self):
        assert classify_page("法人税の確定申告書") == "法人税申告書"
        assert classify_page("法人税申告書") == "法人税申告書"

    def test_consumption_tax(self):
        assert classify_page("消費税及び地方消費税の確定申告書") == "消費税申告書"
        assert classify_page("消費税申告書") == "消費税申告書"

    def test_financial_statements(self):
        assert classify_page("決算書") == "決算報告書"
        assert classify_page("決算報告書") == "決算報告書"

    def test_account_breakdown(self):
        assert classify_page("勘定科目内訳明細書") == "勘定科目内訳明細書"
        assert classify_page("科目内訳書") == "勘定科目内訳明細書"

    def test_business_overview(self):
        assert classify_page("事業概況説明書") == "事業概況説明書"

    def test_prefectural_tax(self):
        assert classify_page("県民税申告書") == "県税申告書"
        assert classify_page("県 税 申告書") == "県税申告書"

    def test_municipal_tax(self):
        assert classify_page("市民税申告書") == "市税申告書"
        assert classify_page("市 税 申告書") == "市税申告書"

    def test_applied_amount(self):
        assert classify_page("適用額明細書") == "適用額明細書"

    def test_no_match(self):
        assert classify_page("関係ないテキスト") is None
        assert classify_page("") is None

    def test_whitespace_handling(self):
        assert classify_page("法 人 税 申 告 書") == "法人税申告書"


class TestExtractCompanyName:
    def test_basic_extraction(self):
        text = "法人名：サンプル株式会社\n住所：東京都"
        assert extract_company_name(text) == "サンプル株式会社"

    def test_with_colon(self):
        text = "名称: テスト合同会社"
        assert extract_company_name(text) == "テスト合同会社"

    def test_taxpayer(self):
        text = "納税者 有限会社テスト商事"
        assert extract_company_name(text) == "有限会社テスト商事"

    def test_not_found(self):
        assert extract_company_name("関係ないテキスト") == "不明"

    def test_empty(self):
        assert extract_company_name("") == "不明"


class TestExtractFiscalPeriod:
    def test_reiwa(self):
        text = "令和6年3月期決算"
        assert extract_fiscal_period(text) == "令和6年3月決算"

    def test_heisei(self):
        text = "平成31年3月"
        assert extract_fiscal_period(text) == "平成31年3月決算"

    def test_with_spaces(self):
        text = "令和 6 年 3 月 期"
        assert extract_fiscal_period(text) == "令和6年3月決算"

    def test_not_found(self):
        assert extract_fiscal_period("関係ないテキスト") == ""

    def test_empty(self):
        assert extract_fiscal_period("") == ""


class TestSanitizeForFilename:
    def test_remove_invalid_chars(self):
        assert sanitize_for_filename('テスト/会社') == "テスト会社"
        assert sanitize_for_filename('テスト:会社') == "テスト会社"

    def test_truncate(self):
        long_name = "あ" * 60
        assert len(sanitize_for_filename(long_name)) == 50

    def test_strip_whitespace(self):
        assert sanitize_for_filename("  テスト  ") == "テスト"


class TestFindDocumentBoundaries:
    def _make_page(self, index: int, header: str, full: str = "") -> PageText:
        return PageText(
            page_index=index,
            header_text=header,
            full_text=full or header,
        )

    def test_single_document(self):
        pages = [
            self._make_page(0, "法人税申告書", "法人名：テスト株式会社\n令和6年3月\n法人税申告書"),
            self._make_page(1, "別表一"),
            self._make_page(2, "別表四"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 1
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].start_page == 0
        assert segments[0].end_page == 2
        assert segments[0].company_name == "テスト株式会社"
        assert segments[0].fiscal_period == "令和6年3月決算"

    def test_multiple_documents(self):
        pages = [
            self._make_page(0, "法人税申告書", "法人名：テスト株式会社\n令和6年3月"),
            self._make_page(1, "別表一"),
            self._make_page(2, "消費税申告書", "名称: テスト株式会社\n令和6年3月"),
            self._make_page(3, "付表"),
            self._make_page(4, "決算報告書", "会社名：テスト株式会社\n令和6年3月"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 3
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].end_page == 1
        assert segments[1].doc_type == "消費税申告書"
        assert segments[1].start_page == 2
        assert segments[1].end_page == 3
        assert segments[2].doc_type == "決算報告書"
        assert segments[2].start_page == 4
        assert segments[2].end_page == 4

    def test_empty_pages(self):
        segments = find_document_boundaries([])
        assert segments == []

    def test_no_detectable_type(self):
        pages = [
            self._make_page(0, "不明なテキスト"),
            self._make_page(1, "これも不明"),
        ]
        segments = find_document_boundaries(pages)
        assert segments == []
