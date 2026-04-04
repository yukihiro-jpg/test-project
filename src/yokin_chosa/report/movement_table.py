"""預金移動表の生成"""

from __future__ import annotations

import pandas as pd

from yokin_chosa.models import BankAccount, FlaggedTransaction


def generate_movement_table(
    accounts: list[BankAccount],
    flagged: list[FlaggedTransaction],
) -> pd.DataFrame:
    """全口座横断の預金移動表を生成する

    ヘッダ: 日付 | 摘要 | [口座1 入金 | 口座1 出金] | ... | 検証結果 | 備考
    行: 時系列（古い順）
    """
    if not flagged:
        return pd.DataFrame()

    # 時系列でソート
    sorted_flagged = sorted(flagged, key=lambda f: f.transaction.date)

    # 口座IDから表示名へのマップ
    account_map = {a.id: a for a in accounts}

    rows = []
    for f in sorted_flagged:
        tx = f.transaction
        acc = account_map.get(tx.account_id)
        acc_name = acc.display_name if acc else tx.account_id

        row: dict[str, object] = {
            "日付": tx.date.strftime("%Y/%m/%d"),
            "摘要": tx.description,
        }

        # 各口座の入金・出金列を設定
        for a in accounts:
            deposit_col = f"{a.display_name}_入金"
            withdrawal_col = f"{a.display_name}_出金"
            if a.id == tx.account_id:
                row[deposit_col] = tx.deposit if tx.deposit else None
                row[withdrawal_col] = tx.withdrawal if tx.withdrawal else None
            else:
                row[deposit_col] = None
                row[withdrawal_col] = None

        row["検証結果"] = f.verification_result.value
        row["備考"] = f.notes

        rows.append(row)

    df = pd.DataFrame(rows)

    # 列の順序を整理
    base_cols = ["日付", "摘要"]
    account_cols = []
    for a in accounts:
        account_cols.append(f"{a.display_name}_入金")
        account_cols.append(f"{a.display_name}_出金")
    end_cols = ["検証結果", "備考"]

    ordered_cols = base_cols + account_cols + end_cols
    existing_cols = [c for c in ordered_cols if c in df.columns]
    df = df[existing_cols]

    return df
