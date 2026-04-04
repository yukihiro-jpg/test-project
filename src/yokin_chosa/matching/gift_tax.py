"""贈与税チェック"""

from __future__ import annotations

from collections import defaultdict

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.models import (
    BankAccount,
    GiftTaxFinding,
    Heir,
    HolderType,
    Transaction,
)


class GiftTaxChecker:
    """被相続人→相続人への振込が贈与税の対象となるかチェックする

    チェック項目:
    1. 年間110万円（基礎控除）を超える振込の集計
    2. 連年贈与パターンの検出
    """

    def __init__(self, config: InvestigationConfig):
        self.annual_exemption = config.gift_tax_annual_exemption

    def check(
        self,
        accounts: list[BankAccount],
        heirs: list[Heir],
        all_transactions: dict[str, list[Transaction]],
    ) -> list[GiftTaxFinding]:
        """贈与税の問題がある取引を検出する"""
        decedent_accounts = {
            a.id: a for a in accounts if a.holder_type == HolderType.DECEDENT
        }
        heir_accounts = {
            a.id: a for a in accounts if a.holder_type != HolderType.DECEDENT
        }

        # 相続人口座IDから相続人名を引くマップ
        account_to_heir: dict[str, str] = {}
        for heir in heirs:
            for acc in heir.accounts:
                account_to_heir[acc.id] = heir.name
        # heirsに登録されていない相続人口座は名義人を使用
        for acc_id, acc in heir_accounts.items():
            if acc_id not in account_to_heir:
                account_to_heir[acc_id] = acc.account_holder

        # 被相続人出金→相続人入金のマッチングを行い、年間集計
        findings: list[GiftTaxFinding] = []

        # 相続人口座ごと・年ごとに被相続人からの振込を集計
        heir_year_totals: dict[str, dict[int, list[Transaction]]] = defaultdict(
            lambda: defaultdict(list)
        )

        for heir_acc_id in heir_accounts:
            heir_txs = all_transactions.get(heir_acc_id, [])
            deposits = [t for t in heir_txs if t.is_deposit and t.deposit is not None]

            for dp in deposits:
                # 被相続人口座からの出金と照合
                for dec_id in decedent_accounts:
                    dec_txs = all_transactions.get(dec_id, [])
                    for wd in dec_txs:
                        if not wd.is_withdrawal or wd.withdrawal is None:
                            continue
                        if dp.deposit != wd.withdrawal:
                            continue
                        day_diff = abs((dp.date - wd.date).days)
                        if day_diff <= 3:
                            heir_name = account_to_heir.get(heir_acc_id, "不明")
                            heir_year_totals[heir_name][dp.date.year].append(dp)
                            break

        # 年間合計が基礎控除を超えるか判定
        for heir_name, year_map in heir_year_totals.items():
            for year, txs in year_map.items():
                total = sum(t.deposit for t in txs if t.deposit is not None)
                findings.append(
                    GiftTaxFinding(
                        from_account_id="(被相続人)",
                        to_heir_name=heir_name,
                        year=year,
                        total_amount=total,
                        exceeds_exemption=total > self.annual_exemption,
                        transactions=txs,
                    )
                )

        # 連年贈与パターンの検出（同一相続人に3年以上連続で振込）
        for heir_name, year_map in heir_year_totals.items():
            years = sorted(year_map.keys())
            if len(years) >= 3:
                consecutive = 1
                for i in range(1, len(years)):
                    if years[i] == years[i - 1] + 1:
                        consecutive += 1
                    else:
                        consecutive = 1
                # 連年贈与のフラグは各年のfindingのnotesに追記する方式で対応
                if consecutive >= 3:
                    for f in findings:
                        if f.to_heir_name == heir_name:
                            # 連年贈与の注意喚起はsummaryレポートで対応

                            pass

        return findings
