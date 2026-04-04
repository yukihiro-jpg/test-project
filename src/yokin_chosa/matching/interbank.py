"""銀行間資金移動の自動マッチング"""

from __future__ import annotations

from datetime import timedelta

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.models import (
    FlaggedTransaction,
    FlagReason,
    VerificationResult,
)


class InterbankMatcher:
    """銀行間資金移動を自動検出する

    出金と入金のペアを金額・日付で照合し、資金移動を判定する。
    """

    def __init__(self, config: InvestigationConfig):
        self.date_tolerance = timedelta(days=config.interbank_date_tolerance_days)

    def find_matches(
        self, flagged: list[FlaggedTransaction]
    ) -> list[tuple[FlaggedTransaction, FlaggedTransaction, float]]:
        """資金移動ペアを検出する

        Returns:
            (出金側, 入金側, 信頼度スコア) のリスト
            信頼度: 1.0=同日同額, 0.8=+1日, 0.5=+2-3日
        """
        withdrawals = [
            f for f in flagged
            if f.transaction.is_withdrawal
            and f.verification_result == VerificationResult.NEEDS_CONFIRMATION
        ]
        deposits = [
            f for f in flagged
            if f.transaction.is_deposit
            and f.verification_result == VerificationResult.NEEDS_CONFIRMATION
        ]

        matches: list[tuple[FlaggedTransaction, FlaggedTransaction, float]] = []
        used_deposit_ids: set[str] = set()

        # 出金ごとに対応する入金を検索
        for wd in withdrawals:
            best_match: tuple[FlaggedTransaction, float] | None = None

            for dp in deposits:
                # 同一口座内の移動はスキップ
                if wd.transaction.account_id == dp.transaction.account_id:
                    continue
                # 既にマッチ済みの入金はスキップ
                if dp.transaction.id in used_deposit_ids:
                    continue
                # 金額が一致するか
                if wd.transaction.abs_amount != dp.transaction.abs_amount:
                    continue

                # 日付差を計算（入金は出金と同日〜数日後）
                day_diff = (dp.transaction.date - wd.transaction.date).days
                if day_diff < 0 or day_diff > self.date_tolerance.days:
                    continue

                # 信頼度スコア
                if day_diff == 0:
                    confidence = 1.0
                elif day_diff == 1:
                    confidence = 0.8
                else:
                    confidence = 0.5

                if best_match is None or confidence > best_match[1]:
                    best_match = (dp, confidence)

            if best_match is not None:
                deposit_match, confidence = best_match
                used_deposit_ids.add(deposit_match.transaction.id)
                matches.append((wd, deposit_match, confidence))

        return matches

    def apply_matches(
        self,
        flagged: list[FlaggedTransaction],
        min_confidence: float = 0.5,
    ) -> list[FlaggedTransaction]:
        """マッチング結果を適用し、資金移動と判定されたものを更新する"""
        matches = self.find_matches(flagged)

        matched_ids: dict[str, tuple[str, float]] = {}
        for wd, dp, confidence in matches:
            if confidence >= min_confidence:
                matched_ids[wd.transaction.id] = (dp.transaction.id, confidence)
                matched_ids[dp.transaction.id] = (wd.transaction.id, confidence)

        result = []
        for f in flagged:
            if f.transaction.id in matched_ids:
                partner_id, confidence = matched_ids[f.transaction.id]
                f.verification_result = VerificationResult.FUND_TRANSFER
                f.matched_transaction_id = partner_id
                f.match_confidence = confidence
            result.append(f)

        return result
