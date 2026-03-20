"""
会計大将インポートCSV出力モジュール
26列フォーマットのCSVファイルを生成する
"""
import csv
import os
from datetime import datetime


class JournalEntry:
    """仕訳1行分のデータ"""

    def __init__(self):
        self.date = ""                # YYYYMMDD
        self.debit_code = ""          # 借方科目コード
        self.debit_name = ""          # 借方科目名
        self.debit_sub_code = ""      # 借方補助コード
        self.debit_sub_name = ""      # 借方補助名
        self.debit_tax_sales = "0"    # 借方税売仕区分
        self.debit_gyoshu = "0"       # 借方業種
        self.debit_tax_type = "0"     # 借方税込税抜
        self.debit_amount = 0         # 借方金額
        self.debit_tax_amount = 0     # 借方消費税額
        self.debit_tax_code = ""      # 借方消費税コード
        self.debit_tax_rate = ""      # 借方消費税率コード
        self.debit_biz_type = "0"     # 借方事業者区分
        self.credit_code = ""         # 貸方科目コード
        self.credit_name = ""         # 貸方科目名
        self.credit_sub_code = ""     # 貸方補助コード
        self.credit_sub_name = ""     # 貸方補助名
        self.credit_tax_sales = "0"   # 貸方税売仕区分
        self.credit_gyoshu = "0"      # 貸方業種
        self.credit_tax_type = "0"    # 貸方税込税抜
        self.credit_amount = 0        # 貸方金額
        self.credit_tax_amount = 0    # 貸方消費税額
        self.credit_tax_code = ""     # 貸方消費税コード
        self.credit_tax_rate = ""     # 貸方消費税率コード
        self.credit_biz_type = "0"    # 貸方事業者区分
        self.tekiyo = ""              # 摘要
        self.confidence = ""          # 判定信頼度（出力には含まない。デバッグ用）

    def to_row(self):
        """26列のリストに変換"""
        return [
            self.date,
            self.debit_code, self.debit_name,
            self.debit_sub_code, self.debit_sub_name,
            self.debit_tax_sales, self.debit_gyoshu, self.debit_tax_type,
            str(self.debit_amount), str(self.debit_tax_amount),
            self.debit_tax_code, self.debit_tax_rate, self.debit_biz_type,
            self.credit_code, self.credit_name,
            self.credit_sub_code, self.credit_sub_name,
            self.credit_tax_sales, self.credit_gyoshu, self.credit_tax_type,
            str(self.credit_amount), str(self.credit_tax_amount),
            self.credit_tax_code, self.credit_tax_rate, self.credit_biz_type,
            self.tekiyo,
        ]

    @classmethod
    def from_bank_transaction(cls, tx, debit_info, credit_info, tekiyo=""):
        """銀行取引から仕訳エントリを生成"""
        entry = cls()
        entry.date = tx.date
        entry.tekiyo = tekiyo or tx.tekiyo

        if tx.withdrawal > 0:
            # 出金: 借方=費用等、貸方=銀行口座
            entry.debit_amount = tx.withdrawal
            entry.credit_amount = tx.withdrawal
            entry.debit_code = debit_info.get("account_code", "174")
            entry.debit_name = debit_info.get("account_name", "仮払金")
            entry.debit_sub_code = debit_info.get("sub_code", "")
            entry.debit_sub_name = debit_info.get("sub_name", "")
            entry.credit_code = credit_info.get("account_code", "")
            entry.credit_name = credit_info.get("account_name", "")
            entry.credit_sub_code = credit_info.get("sub_code", "")
            entry.credit_sub_name = credit_info.get("sub_name", "")
        else:
            # 入金: 借方=銀行口座、貸方=売上等
            entry.debit_amount = tx.deposit
            entry.credit_amount = tx.deposit
            entry.debit_code = debit_info.get("account_code", "")
            entry.debit_name = debit_info.get("account_name", "")
            entry.debit_sub_code = debit_info.get("sub_code", "")
            entry.debit_sub_name = debit_info.get("sub_name", "")
            entry.credit_code = credit_info.get("account_code", "174")
            entry.credit_name = credit_info.get("account_name", "仮払金")
            entry.credit_sub_code = credit_info.get("sub_code", "")
            entry.credit_sub_name = credit_info.get("sub_name", "")

        # 消費税設定
        tax = debit_info.get("tax", {})
        if tax:
            entry.debit_tax_sales = tax.get("ts", "0")
            entry.debit_gyoshu = tax.get("gy", "0")
            entry.debit_tax_type = tax.get("tt", "0")
            entry.debit_tax_code = tax.get("tc", "")
            entry.debit_tax_rate = tax.get("tr", "")
            entry.debit_biz_type = tax.get("bt", "0")

        tax_c = credit_info.get("tax", {})
        if tax_c:
            entry.credit_tax_sales = tax_c.get("ts", "0")
            entry.credit_gyoshu = tax_c.get("gy", "0")
            entry.credit_tax_type = tax_c.get("tt", "0")
            entry.credit_tax_code = tax_c.get("tc", "")
            entry.credit_tax_rate = tax_c.get("tr", "")
            entry.credit_biz_type = tax_c.get("bt", "0")

        return entry


def export_csv(entries, output_path, encoding="cp932"):
    """
    仕訳エントリのリストをCSVファイルに出力

    Args:
        entries: list[JournalEntry]
        output_path: 出力ファイルパス
        encoding: エンコーディング（デフォルトはShift_JIS互換のcp932）
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding=encoding, newline="") as f:
        writer = csv.writer(f)
        for entry in entries:
            writer.writerow(entry.to_row())

    return output_path


def export_review_csv(entries, review_items, output_path):
    """
    要確認リスト付きCSVを出力（人間レビュー用）

    Args:
        entries: 確定仕訳のリスト
        review_items: 要確認の取引リスト
        output_path: 出力パス
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["=== 要確認取引 ===", "", "", "", ""])
        writer.writerow(["日付", "摘要", "金額", "出入", "理由"])
        for item in review_items:
            writer.writerow([
                item.get("date", ""),
                item.get("tekiyo", ""),
                item.get("amount", ""),
                item.get("direction", ""),
                item.get("reason", ""),
            ])
        writer.writerow([])
        writer.writerow(["=== 確定仕訳 ==="] + [""] * 24)
        for entry in entries:
            writer.writerow(entry.to_row())

    return output_path
