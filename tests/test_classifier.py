"""classifier モジュールのテスト"""

from mjs_pdf_splitter.classifier import (
    classify_page,
    extract_company_name_from_pages,
    extract_fiscal_period_from_pages,
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

    def test_financial_statements(self):
        assert classify_page("貸借対照表") == "決算報告書"
        assert classify_page("損益計算書") == "決算報告書"
        assert classify_page("株主資本等変動計算書") == "決算報告書"
        assert classify_page("個別注記表") == "決算報告書"

    def test_account_breakdown(self):
        assert classify_page("預貯金等の内訳書") == "勘定科目内訳明細書"
        assert classify_page("売掛金の内訳書") == "勘定科目内訳明細書"
        assert classify_page("勘定科目内訳明細書") == "勘定科目内訳明細書"

    def test_business_overview(self):
        assert classify_page("法人事業概況説明書") == "法人事業概況説明書"
        assert classify_page("事業概況説明書") == "法人事業概況説明書"

    def test_tax_proxy(self):
        assert classify_page("税務代理権限証書") == "税務代理権限証書"

    def test_prefectural_tax_form_number(self):
        """様式番号で県税を判定"""
        assert classify_page("第六号様式") == "県税申告書"
        assert classify_page("第6号様式") == "県税申告書"

    def test_prefectural_tax_keyword(self):
        """キーワードで県税を判定"""
        assert classify_page("道府県民税") == "県税申告書"
        assert classify_page("都民税") == "県税申告書"

    def test_municipal_tax_form_number(self):
        """様式番号で市税を判定"""
        assert classify_page("第二十号様式") == "市税申告書"
        assert classify_page("第20号様式") == "市税申告書"

    def test_municipal_tax_keyword(self):
        assert classify_page("市町村民税") == "市税申告書"
        assert classify_page("特別区民税") == "市税申告書"

    def test_applied_amount_is_unclassified(self):
        """適用額明細書は法人税申告書の一部として扱う（個別パターンなし）"""
        # 適用額明細書のみのテキストは判定不可→前ページ継承で法人税申告書に含まれる
        assert classify_page("適用額明細書") is None

    def test_depreciation_asset(self):
        assert classify_page("償却資産申告書") == "償却資産税申告書"
        assert classify_page("第二十六号様式") == "償却資産税申告書"
        assert classify_page("第26号様式") == "償却資産税申告書"

    def test_depreciation_asset_not_genka(self):
        """「減価償却資産」は償却資産税ではなく法人税の別表十六"""
        # 別表があるので法人税申告書になる
        assert classify_page("別表十六 減価償却資産") == "法人税申告書"

    def test_no_match(self):
        assert classify_page("関係ないテキスト") is None
        assert classify_page("") is None

    def test_whitespace_handling(self):
        assert classify_page("別 表 一") == "法人税申告書"
        assert classify_page("貸 借 対 照 表") == "決算報告書"

    # --- 実際のMJSフォームでの誤判定テスト ---

    def test_beppyo4_with_dofuken(self):
        """別表四に「道府県民税」があっても法人税申告書（別表が優先）"""
        text = "別表四 簡易様式 損金経理をした道府県民税及び市町村民税"
        assert classify_page(text) == "法人税申告書"

    def test_beppyo5_with_dofuken(self):
        """別表五に「道府県民税」があっても法人税申告書"""
        text = "別表五 租税公課の納付状況 道府県民税 市町村民税"
        assert classify_page(text) == "法人税申告書"

    def test_beppyo16_with_shokyaku(self):
        """別表十六に「減価償却資産」があっても法人税申告書"""
        text = "別表十六 減価償却資産の償価額の計算に関する明細書"
        assert classify_page(text) == "法人税申告書"

    def test_kenzeiform_with_beppyo(self):
        """県税の第六号様式に「別表」が含まれても県税（様式番号が優先）"""
        text = "第六号様式 別表九 控除前所得金額 道府県民税"
        assert classify_page(text) == "県税申告書"

    def test_shokyaku_form26_with_beppyo(self):
        """償却資産の第二十六号様式に「別表」があっても償却資産（様式番号が優先）"""
        text = "第二十六号様式 別表一 資産コード"
        assert classify_page(text) == "償却資産税申告書"

    # --- メール詳細・ダイレクト納付 ---

    def test_mail_detail_jushin(self):
        assert classify_page("受信通知 送信されたデータを受け付けました") == "メール詳細"

    def test_mail_detail_kanryo(self):
        assert classify_page("申告受付完了通知 送信された申告データを受け付けました") == "メール詳細"

    def test_direct_payment_nofu_kakunin(self):
        assert classify_page("納付確認 納付・納入金額(総括表)") == "ダイレクト納付情報"

    def test_direct_payment_kubun(self):
        assert classify_page("受信通知（納付区分番号通知）ダイレクト納付") == "ダイレクト納付情報"

    def test_direct_payment_shiteibi(self):
        assert classify_page("ダイレクト納付指定日 令和7年05月30日") == "ダイレクト納付情報"

    # --- 消費税 ---

    def test_houjinzei_tou_not_matched(self):
        """決算書の「法人税等 67,432」は法人税申告書にマッチしない"""
        assert classify_page("法人税等 67,432 保険料 66,800") is None

    def test_consumption_tax(self):
        """消費税は一旦「消費税申告書」として判定される（原則/簡易は後処理）"""
        assert classify_page("消費税及び地方消費税の確定申告書") == "消費税申告書"

    def test_consumption_tax_over_uchiwake(self):
        """消費税は勘定科目内訳明細書より優先される"""
        text = "消費税額計算表 税率別内訳明細"
        assert classify_page(text) == "消費税申告書"


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
    def _make_pages(self, texts: list[str]) -> list[PageText]:
        return [
            PageText(page_index=i, full_text=t, header_text=t)
            for i, t in enumerate(texts)
        ]

    def test_prefers_itari_date(self):
        """「至」の後の日付を優先（設立年月日等を拾わない）"""
        pages = self._make_pages([
            "設立年月日 平成27年4月1日 事業年度 自 令和6年4月1日 至 令和7年3月31日",
        ])
        assert extract_fiscal_period_from_pages(pages) == "令和7年3月決算"

    def test_itari_with_spaces(self):
        pages = self._make_pages(["至 令和 7 年 3 月 31 日"])
        assert extract_fiscal_period_from_pages(pages) == "令和7年3月決算"

    def test_fallback_most_common(self):
        """「至」がない場合は最頻出の日付を採用"""
        pages = self._make_pages([
            "平成27年4月 設立",
            "令和7年3月 申告",
            "令和7年3月 決算",
        ])
        assert extract_fiscal_period_from_pages(pages) == "令和7年3月決算"

    def test_not_found(self):
        pages = self._make_pages(["関係ないテキスト"])
        assert extract_fiscal_period_from_pages(pages) == ""


class TestSanitizeForFilename:
    def test_remove_invalid_chars(self):
        assert sanitize_for_filename('テスト/会社') == "テスト会社"

    def test_truncate(self):
        assert len(sanitize_for_filename("あ" * 60)) == 50


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

    def test_forward_inheritance(self):
        """先頭の未判定ページは次に判定できたページの種類を継承する"""
        pages = [
            self._make_page(0, "判定不可なテキスト", "ＦＢ６１３ 合同会社和泉"),
            self._make_page(1, "別表一 次葉", "別表一 合同会社和泉"),
            self._make_page(2, "別表四"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 1
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].start_page == 0  # ページ1も含まれる
        assert segments[0].end_page == 2

    def test_empty_pages(self):
        assert find_document_boundaries([]) == []

    def test_no_detectable_type(self):
        pages = [
            self._make_page(0, "不明なテキスト"),
            self._make_page(1, "これも不明"),
        ]
        assert find_document_boundaries(pages) == []

    def test_unclassified_pages_inherit_backward(self):
        """中間の判定不可ページは前のページの種類を継承する"""
        pages = [
            self._make_page(0, "別表一", "別表一 合同会社和泉"),
            self._make_page(1, "判定不可テキスト"),
            self._make_page(2, "貸借対照表"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 2
        assert segments[0].doc_type == "法人税申告書"
        assert segments[0].end_page == 1
        assert segments[1].doc_type == "決算報告書"

    def test_form_number_priority_over_beppyo(self):
        """様式番号が別表より優先される"""
        pages = [
            self._make_page(0, "別表一", "別表一 合同会社和泉"),
            self._make_page(1, "第六号様式 別表九", "第六号様式 別表九 合同会社和泉"),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 2
        assert segments[0].doc_type == "法人税申告書"
        assert segments[1].doc_type == "県税申告書"

    def test_consumption_tax_standard(self):
        """消費税（一般用）→ 原則"""
        pages = [
            self._make_page(
                0, "消費税申告書",
                "消費税及び地方消費税の確定申告書 一般用 合同会社和泉"
            ),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 1
        assert segments[0].doc_type == "消費税申告書（原則）"

    def test_consumption_tax_simplified(self):
        """消費税（簡易課税用）→ 簡易"""
        pages = [
            self._make_page(
                0, "消費税申告書",
                "消費税及び地方消費税の確定申告書 簡易課税用 合同会社和泉"
            ),
        ]
        segments = find_document_boundaries(pages)
        assert len(segments) == 1
        assert segments[0].doc_type == "消費税申告書（簡易）"
