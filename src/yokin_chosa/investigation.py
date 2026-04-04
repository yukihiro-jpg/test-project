"""メインパイプライン（オーケストレーター）"""

from __future__ import annotations

from datetime import timedelta
from io import BytesIO
from pathlib import Path
from typing import Union

import pandas as pd

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.matching.gift_tax import GiftTaxChecker
from yokin_chosa.matching.interbank import InterbankMatcher
from yokin_chosa.matching.nominal import NominalDepositChecker
from yokin_chosa.models import (
    BankAccount,
    FlaggedTransaction,
    FlagReason,
    GiftTaxFinding,
    InvestigationCase,
    NominalDepositFinding,
    Transaction,
    VerificationResult,
)
from yokin_chosa.report.excel_writer import write_investigation_excel
from yokin_chosa.report.movement_table import generate_movement_table
from yokin_chosa.report.summary import (
    generate_account_list,
    generate_case_summary,
    generate_confirmation_list,
    generate_flag_summary,
    generate_gift_tax_report,
    generate_nominal_deposit_report,
)


class DepositInvestigation:
    """預金調査パイプライン

    PDF読み込み→期間フィルタ→閾値フラグ→銀行間マッチング
    →名義預金チェック→贈与税チェック→レポート生成
    """

    def __init__(
        self,
        case: InvestigationCase,
        config: InvestigationConfig | None = None,
    ):
        self.case = case
        self.config = config or InvestigationConfig(
            investigation_period_years=case.investigation_period_years,
            threshold_amount=case.threshold_amount,
        )
        # account_id -> 全取引
        self.all_transactions: dict[str, list[Transaction]] = {}
        # account_id -> 期間内取引
        self.filtered_transactions: dict[str, list[Transaction]] = {}
        # フラグ付き取引
        self.flagged: list[FlaggedTransaction] = []
        # 名義預金検出結果
        self.nominal_findings: list[NominalDepositFinding] = []
        # 贈与税チェック結果
        self.gift_tax_findings: list[GiftTaxFinding] = []

    def load_transactions_from_pdf(
        self, account: BankAccount, pdf_path: Path
    ) -> list[Transaction]:
        """PDFから取引データを読み込む"""
        from yokin_chosa.parsers.pdf_parser import extract_transactions_from_pdf
        txs = extract_transactions_from_pdf(pdf_path, account)
        self.all_transactions[account.id] = txs
        return txs

    def load_transactions_directly(
        self, account: BankAccount, transactions: list[Transaction]
    ) -> None:
        """取引データを直接読み込む（テスト用）"""
        self.all_transactions[account.id] = transactions

    def filter_by_period(self) -> None:
        """調査期間内の取引のみをフィルタ"""
        start = self.case.investigation_start_date
        end = self.case.date_of_death

        for acc_id, txs in self.all_transactions.items():
            self.filtered_transactions[acc_id] = [
                t for t in txs if start <= t.date <= end
            ]

    def flag_large_transactions(self) -> None:
        """閾値以上の取引をフラグ付け"""
        threshold = self.config.threshold_amount
        death_date = self.case.date_of_death
        proximity_days = self.config.death_proximity_days
        round_min = self.config.round_number_min_amount

        self.flagged = []

        for acc_id, txs in self.filtered_transactions.items():
            for tx in txs:
                if tx.abs_amount < threshold:
                    continue

                reasons: list[FlagReason] = []

                # 高額入金/出金
                if tx.is_deposit:
                    reasons.append(FlagReason.LARGE_DEPOSIT)
                if tx.is_withdrawal:
                    reasons.append(FlagReason.LARGE_WITHDRAWAL)

                # 相続開始直前
                if (death_date - tx.date).days <= proximity_days:
                    reasons.append(FlagReason.DEATH_PROXIMITY)

                # 端数なし
                if tx.abs_amount >= round_min and tx.abs_amount % 100_000 == 0:
                    reasons.append(FlagReason.ROUND_NUMBER)

                if reasons:
                    self.flagged.append(
                        FlaggedTransaction(
                            transaction=tx,
                            flag_reasons=reasons,
                            verification_result=VerificationResult.NEEDS_CONFIRMATION,
                        )
                    )

    def detect_interbank_transfers(self) -> None:
        """銀行間資金移動を自動検出"""
        matcher = InterbankMatcher(self.config)
        self.flagged = matcher.apply_matches(self.flagged)

    def check_nominal_deposits(self) -> None:
        """名義預金チェック"""
        checker = NominalDepositChecker(self.config)
        self.nominal_findings = checker.check(
            self.case.accounts, self.filtered_transactions
        )

        # 名義預金疑いのフラグを追加
        suspect_account_ids = {f.account.id for f in self.nominal_findings}
        for f in self.flagged:
            if f.transaction.account_id in suspect_account_ids:
                if FlagReason.NOMINAL_SUSPECT not in f.flag_reasons:
                    f.flag_reasons.append(FlagReason.NOMINAL_SUSPECT)
                if f.verification_result == VerificationResult.NEEDS_CONFIRMATION:
                    f.verification_result = VerificationResult.NOMINAL_DEPOSIT_SUSPECT

    def check_gift_tax(self) -> None:
        """贈与税チェック"""
        checker = GiftTaxChecker(self.config)
        self.gift_tax_findings = checker.check(
            self.case.accounts, self.case.heirs, self.filtered_transactions
        )

        # 贈与税超過のフラグを追加
        for finding in self.gift_tax_findings:
            if finding.exceeds_exemption:
                for tx in finding.transactions:
                    for f in self.flagged:
                        if f.transaction.id == tx.id:
                            if f.verification_result == VerificationResult.NEEDS_CONFIRMATION:
                                f.verification_result = VerificationResult.GIFT_TAX_ISSUE

    def run_analysis(self) -> None:
        """全分析を実行"""
        self.filter_by_period()
        self.flag_large_transactions()
        self.detect_interbank_transfers()
        self.check_nominal_deposits()
        self.check_gift_tax()

    def generate_excel(self, output: Union[Path, BytesIO]) -> None:
        """Excel レポートを生成"""
        sheets: dict[str, pd.DataFrame] = {}

        # 預金移動表
        movement_df = generate_movement_table(self.case.accounts, self.flagged)
        if not movement_df.empty:
            sheets["預金移動表"] = movement_df

        # 要確認リスト
        confirmation_df = generate_confirmation_list(self.flagged)
        if not confirmation_df.empty:
            sheets["要確認リスト"] = confirmation_df

        # 名義預金チェック
        nominal_df = generate_nominal_deposit_report(self.nominal_findings)
        if not nominal_df.empty:
            sheets["名義預金チェック"] = nominal_df

        # 贈与税チェック
        gift_df = generate_gift_tax_report(self.gift_tax_findings)
        if not gift_df.empty:
            sheets["贈与税チェック"] = gift_df

        # サマリー
        summary_df = generate_case_summary(self.case)
        account_df = generate_account_list(self.case)
        flag_df = generate_flag_summary(self.flagged)

        # サマリーは複数のDataFrameを縦に並べる
        summary_parts = [summary_df]
        if not account_df.empty:
            summary_parts.append(pd.DataFrame([["", ""]], columns=["項目", "内容"]))
            # 口座一覧はカラムが違うのでサマリーシートとは別に追加
        if not flag_df.empty:
            sheets["フラグ集計"] = flag_df

        sheets["案件概要"] = summary_df
        sheets["口座一覧"] = account_df

        write_investigation_excel(
            sheets, output, movement_table_accounts_count=len(self.case.accounts)
        )
