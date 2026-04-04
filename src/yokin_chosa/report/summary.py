"""サマリーレポート生成"""

from __future__ import annotations

import pandas as pd

from yokin_chosa.models import (
    FlaggedTransaction,
    GiftTaxFinding,
    InvestigationCase,
    NominalDepositFinding,
    VerificationResult,
)


def generate_case_summary(case: InvestigationCase) -> pd.DataFrame:
    """案件概要のDataFrameを生成"""
    data = [
        ["被相続人", case.decedent_name],
        ["相続開始日", case.date_of_death.strftime("%Y/%m/%d")],
        ["調査期間", f"{case.investigation_start_date.strftime('%Y/%m/%d')} 〜 {case.date_of_death.strftime('%Y/%m/%d')}"],
        ["調査期間（年数）", f"{case.investigation_period_years}年"],
        ["フラグ閾値", f"¥{case.threshold_amount:,}"],
        ["相続人数", f"{len(case.heirs)}名"],
        ["調査対象口座数", f"{len(case.accounts)}口座"],
    ]
    return pd.DataFrame(data, columns=["項目", "内容"])


def generate_account_list(case: InvestigationCase) -> pd.DataFrame:
    """口座一覧のDataFrameを生成"""
    rows = []
    for acc in case.accounts:
        rows.append({
            "銀行名": acc.bank_name,
            "支店名": acc.branch_name,
            "口座種別": acc.account_type.value,
            "口座番号": acc.account_number,
            "名義人": acc.account_holder,
            "名義区分": acc.holder_type.value,
        })
    return pd.DataFrame(rows)


def generate_flag_summary(flagged: list[FlaggedTransaction]) -> pd.DataFrame:
    """フラグ集計のDataFrameを生成"""
    counts: dict[str, int] = {}
    for f in flagged:
        key = f.verification_result.value
        counts[key] = counts.get(key, 0) + 1

    rows = [{"検証結果": k, "件数": v} for k, v in sorted(counts.items())]
    rows.append({"検証結果": "合計", "件数": len(flagged)})
    return pd.DataFrame(rows)


def generate_confirmation_list(flagged: list[FlaggedTransaction]) -> pd.DataFrame:
    """要確認リストのDataFrameを生成"""
    needs_confirmation = [
        f for f in flagged
        if f.verification_result in (
            VerificationResult.NEEDS_CONFIRMATION,
            VerificationResult.NOMINAL_DEPOSIT_SUSPECT,
            VerificationResult.GIFT_TAX_ISSUE,
        )
    ]

    rows = []
    for f in sorted(needs_confirmation, key=lambda x: x.transaction.date):
        tx = f.transaction
        rows.append({
            "日付": tx.date.strftime("%Y/%m/%d"),
            "摘要": tx.description,
            "入金": f"¥{tx.deposit:,}" if tx.deposit else "",
            "出金": f"¥{tx.withdrawal:,}" if tx.withdrawal else "",
            "検証結果": f.verification_result.value,
            "フラグ理由": ", ".join(r.value for r in f.flag_reasons),
            "備考": f.notes,
        })
    return pd.DataFrame(rows)


def generate_nominal_deposit_report(
    findings: list[NominalDepositFinding],
) -> pd.DataFrame:
    """名義預金チェック結果のDataFrameを生成"""
    rows = []
    for finding in findings:
        rows.append({
            "口座": finding.account.display_name,
            "名義人": finding.account.account_holder,
            "疑わしい金額合計": f"¥{finding.total_suspected_amount:,}",
            "検出根拠": "\n".join(finding.evidence),
            "関連取引数": len(finding.related_transactions),
        })
    return pd.DataFrame(rows)


def generate_gift_tax_report(findings: list[GiftTaxFinding]) -> pd.DataFrame:
    """贈与税チェック結果のDataFrameを生成"""
    rows = []
    for f in sorted(findings, key=lambda x: (x.to_heir_name, x.year)):
        rows.append({
            "相続人": f.to_heir_name,
            "年": f.year,
            "年間振込合計": f"¥{f.total_amount:,}",
            "基礎控除超過": "超過" if f.exceeds_exemption else "範囲内",
            "取引数": len(f.transactions),
        })
    return pd.DataFrame(rows)
