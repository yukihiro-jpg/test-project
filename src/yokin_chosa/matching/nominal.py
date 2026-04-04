"""名義預金の検出"""

from __future__ import annotations

from collections import defaultdict

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.models import (
    BankAccount,
    HolderType,
    NominalDepositFinding,
    Transaction,
)


class NominalDepositChecker:
    """名義預金（相続人名義だが実質被相続人の財産）を検出する

    検出ヒューリスティック:
    1. 被相続人口座→相続人口座への定期的な振込
    2. 110万円前後の定額振込パターン（贈与の基礎控除意識）
    3. 端数なし大口振込（贈与の可能性）
    4. 相続人口座への一方的な資金流入
    """

    def __init__(self, config: InvestigationConfig):
        self.config = config

    def check(
        self,
        accounts: list[BankAccount],
        all_transactions: dict[str, list[Transaction]],
    ) -> list[NominalDepositFinding]:
        """名義預金の可能性がある口座を検出する

        Args:
            accounts: 全口座リスト
            all_transactions: account_id -> 取引リスト

        Returns:
            名義預金の検出結果リスト
        """
        decedent_accounts = {
            a.id: a for a in accounts if a.holder_type == HolderType.DECEDENT
        }
        heir_accounts = {
            a.id: a for a in accounts if a.holder_type != HolderType.DECEDENT
        }

        if not decedent_accounts or not heir_accounts:
            return []

        findings: list[NominalDepositFinding] = []

        for heir_acc_id, heir_acc in heir_accounts.items():
            heir_txs = all_transactions.get(heir_acc_id, [])
            evidence: list[str] = []
            suspected_txs: list[Transaction] = []
            total_suspected = 0

            # チェック1: 被相続人口座からの出金と相続人口座への入金のパターン
            deposits_to_heir = [t for t in heir_txs if t.is_deposit]
            decedent_withdrawals = []
            for dec_id in decedent_accounts:
                decedent_withdrawals.extend(
                    t for t in all_transactions.get(dec_id, []) if t.is_withdrawal
                )

            # 金額・日付が一致する振込を検出
            matched_deposits = self._find_matching_transfers(
                decedent_withdrawals, deposits_to_heir
            )
            if matched_deposits:
                evidence.append(
                    f"被相続人口座からの振込が{len(matched_deposits)}件検出"
                )
                suspected_txs.extend(matched_deposits)
                total_suspected += sum(t.abs_amount for t in matched_deposits)

            # チェック2: 定期的な同額振込パターン
            regular = self._detect_regular_transfers(deposits_to_heir)
            if regular:
                evidence.append(
                    f"定期的な同額入金パターン検出: {len(regular)}件"
                )

            # チェック3: 110万円前後の振込
            gift_like = [
                t for t in deposits_to_heir
                if t.deposit is not None
                and 1_000_000 <= t.deposit <= 1_200_000
            ]
            if gift_like:
                evidence.append(
                    f"110万円前後の入金が{len(gift_like)}件（贈与の基礎控除意識の可能性）"
                )

            # チェック4: 端数なし大口入金
            round_deposits = [
                t for t in deposits_to_heir
                if t.deposit is not None
                and t.deposit >= self.config.round_number_min_amount
                and t.deposit % 100_000 == 0
            ]
            if round_deposits:
                evidence.append(
                    f"端数なし大口入金が{len(round_deposits)}件"
                )

            if evidence:
                findings.append(
                    NominalDepositFinding(
                        account=heir_acc,
                        evidence=evidence,
                        total_suspected_amount=total_suspected,
                        related_transactions=suspected_txs,
                    )
                )

        return findings

    def _find_matching_transfers(
        self,
        withdrawals: list[Transaction],
        deposits: list[Transaction],
    ) -> list[Transaction]:
        """被相続人の出金と相続人の入金が対応するものを検出"""
        matched: list[Transaction] = []
        for dp in deposits:
            if dp.deposit is None:
                continue
            for wd in withdrawals:
                if wd.withdrawal is None:
                    continue
                if dp.deposit != wd.withdrawal:
                    continue
                day_diff = abs((dp.date - wd.date).days)
                if day_diff <= 3:
                    matched.append(dp)
                    break
        return matched

    def _detect_regular_transfers(
        self,
        deposits: list[Transaction],
    ) -> list[Transaction]:
        """定期的な同額振込パターンを検出"""
        # 金額ごとにグループ化
        amount_groups: dict[int, list[Transaction]] = defaultdict(list)
        for t in deposits:
            if t.deposit is not None and t.deposit >= self.config.threshold_amount:
                amount_groups[t.deposit].append(t)

        regular: list[Transaction] = []
        for amount, txs in amount_groups.items():
            if len(txs) >= 2:
                # 2回以上同額の振込がある場合、定期的と判断
                regular.extend(txs)

        return regular
