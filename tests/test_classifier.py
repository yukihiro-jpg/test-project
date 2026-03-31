"""classifier モジュールのテスト"""

from mjs_pdf_splitter.classifier import (
    classify_page,
    extract_company_name_from_pages,
    extract_fiscal_period,
    find_document_boundaries,
    sanitize_for_filename,
)
from mjs_pdf_splitter.extractor import PageText


class TestClassifyPage:
    def test_corporate_tax_beppyo(self):
        assert classify_page("別表一（一）") == "法人税申告書"
        assert classify_page("別表四") == "法人税申告書"
        assert classify_page("別表五（二）") == "法人税申告書"

    def test_corporate_tax_explicit(self):
        assert classify_page("法人税の確定申告書") == "法人税申告書"

    def test_consumption_tax(self):
        assert classify_page("消費税及び地方消費税の確定申告書") == "消費税申告書"
        assert classify_page("消費税申告書") == "消費税申告書"

    def test_financial_statements(self):
        assert classify_page("貸借対照表") == "決算報告書"
        assert classify_page("損益計算書") == "決算報告書"
        assert classify_page("株主資本等変動計算書") == "決算報告書"
        assert classify_page("個別注記表") == "決算報告書"
        assert classify_page("社員資本等変動計算書") == "決算報告書"

    def test_account_breakdown(self):
        assert classify_page("預貯金等の内訳書") == "勘定科目内訳明細書"
        assert classify_page("売掛金の内訳書") == "勘定科目内訳明細書"
        assert classify_page("勘定科目内訳明細書") == "勘定科目内訳明細書"

    def test_business_overview(self):
        assert classify_page("法人事業概況説明書") == "法人事業概況説明書"
        assert classify_page("事業概況説明書") == "法人事業概況説明書"

    def test_tax_proxy(self):
        assert classify_page("税務代理権限証書") == "税務代理権限証書"

    def test_prefectural_tax(self):
        assert classify_page("道府県民税") == "県税申告書"
        assert classify_page("都民税") == "県税申告書"
        assert classify_page("第六号様式") == "県税申告書"

    def test_municipal_tax(self):
        assert classify_page("市町村民税") == "市税申告書"
        assert classify_page("市民税") == "市税申告書"
        assert classify_page("特別区民税") == "市税申告書"
        assert classify_page("第二十号様式") == "市税申告書"

    def test_applied_amount(self):
        assert classify_page("適用額明細書") == "適用額明細書"

    def test_depreciation_asset(self):
        assert classify_page("償却資産申告書") == "償却資産税申告書"
        assert classify_page("償却資産税") == "償却資産税申告書"

    def test_no_match(self):
        assert classify_page("関係ないテキスト") is None
        assert classify_page("") is None

    def test_whitespace_handling(self):
        assert classify_page("別 表 一") == "法人税申告書"
        assert classify_page("貸 借 対 照 表") == "決算報告書"


class TestExtractCompanyName:
    def _make_pages(self, texts: list[str]) -> list[PageText]:
        return [
            PageText(page_index=i, full_text=t, header_text=t)
            for i, t in enumerate(texts)
        ]

    def test_goudo_kaisha(self):
        pages = self._make_pages([
            "申告書 合同会社和泉 令和6年",
            "別表一 合同会社和泉",
        ])
        assert extract_company_name_from_pages(pages) == "合同会社和泉"

    def test_kabushiki_kaisha_prefix(self):
        pages = self._make_pages(["株式会社サンプル 法人税申告書"])
        assert extract_company_name_from_pages(pages) == "株式会社サンプル"

    def test_kabushiki_kaisha_suffix(self):
        pages = self._make_pages(["サンプル株式会社 法人税申告書"])
        assert extract_company_name_from_pages(pages) == "サンプル株式会社"

    def test_most_common_wins(self):
        """最も多く出現する法人名が採用される"""
        pages = self._make_pages([
            "合同会社和泉 税理士法人テスト",
            "合同会社和泉",
            "合同会社和泉",
            "税理士法人テスト",
        ])
        assert extract_company_name_from_pages(pages) == "合同会社和泉"

    def test_not_found(self):
        pages = self._make_pages(["関係ないテキスト"])
        assert extract_company_name_from_pages(pages) == "不明"

    def test_empty(self):
        assert extract_company_name_from_pages([]) == "不明"


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
            self._make_page(0, "別表一", "別表一 合同会社和泉 令和6年3月"),
            self._make_page(1, "別表四", "別表四 合同会社和泉"),
            self._make_page(2, "別表五", "別表五 合同会社和泉"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 1
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].start_page == 0
        assert segments[0].end_page == 2
        assert segments[0].company_name == "合同会社和泉"
        assert segments[0].fiscal_period == "令和6年3月決算"

    def test_multiple_documents(self):
        pages = [
            self._make_page(0, "別表一", "別表一 合同会社和泉 令和6年3月"),
            self._make_page(1, "別表四"),
            self._make_page(2, "預貯金等の内訳書", "預貯金等の内訳書 合同会社和泉"),
            self._make_page(3, "売掛金の内訳書"),
            self._make_page(4, "貸借対照表", "貸借対照表 合同会社和泉"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 3
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].end_page == 1
        assert segments[1].doc_type == "勘定科目内訳明細書"
        assert segments[1].start_page == 2
        assert segments[1].end_page == 3
        assert segments[2].doc_type == "決算報告書"
        assert segments[2].start_page == 4
        assert segments[2].end_page == 4
        # 全セグメントで同じ会社名
        for seg in segments:
            assert seg.company_name == "合同会社和泉"

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

    def test_unclassified_pages_inherit(self):
        """判定不可のページは前のページの種類を継承する"""
        pages = [
            self._make_page(0, "別表一", "別表一 合同会社和泉"),
            self._make_page(1, "ここは判定不可なテキスト"),
            self._make_page(2, "ここも判定不可"),
            self._make_page(3, "貸借対照表"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 2
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].start_page == 0
        assert segments[0].end_page == 2  # ページ1,2は法人税申告書に継承
        assert segments[1].doc_type == "決算報告書"
        assert segments[1].start_page == 3
