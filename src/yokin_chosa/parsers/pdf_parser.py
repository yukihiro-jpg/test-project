"""OCR済みPDFから通帳取引データを抽出するパーサー"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Optional

from yokin_chosa.models import BankAccount, Transaction


# 和暦→西暦変換マップ
ERA_MAP = {
    "令和": 2018,
    "平成": 1988,
    "昭和": 1925,
    "大正": 1911,
    "明治": 1867,
    "R": 2018,
    "H": 1988,
    "S": 1925,
}

# 日付パターン
DATE_PATTERNS = [
    # 2021/04/01, 2021-04-01
    re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})"),
    # 令和3年4月1日, R3.4.1
    re.compile(
        r"(令和|平成|昭和|大正|明治|R|H|S)\s*(\d{1,2})[年/\-.](\d{1,2})[月/\-.](\d{1,2})日?"
    ),
    # 21/04/01 (2桁年)
    re.compile(r"(\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})"),
]


def parse_japanese_date(text: str) -> Optional[date]:
    """日本語の日付文字列をdateオブジェクトに変換"""
    text = text.strip()
    if not text:
        return None

    # 和暦パターン
    m = DATE_PATTERNS[1].search(text)
    if m:
        era, year_str, month_str, day_str = m.groups()
        base_year = ERA_MAP.get(era)
        if base_year is not None:
            return date(base_year + int(year_str), int(month_str), int(day_str))

    # 西暦4桁パターン
    m = DATE_PATTERNS[0].search(text)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))

    # 2桁年パターン
    m = DATE_PATTERNS[2].search(text)
    if m:
        year = int(m.group(1))
        if year < 50:
            year += 2000
        else:
            year += 1900
        return date(year, int(m.group(2)), int(m.group(3)))

    return None


def parse_amount(text: str) -> Optional[int]:
    """金額文字列を整数に変換。カンマ・全角数字に対応"""
    if not text or not text.strip():
        return None

    text = text.strip()
    # 全角→半角変換
    text = text.translate(str.maketrans("０１２３４５６７８９，", "0123456789,"))
    # カンマ・スペース・円記号を除去
    text = re.sub(r"[,\s¥￥円]", "", text)
    # マイナス記号の正規化
    text = text.replace("△", "-").replace("▲", "-").replace("ー", "-")

    if not text or text in ("-", "―", "*", "＊"):
        return None

    try:
        return int(text)
    except ValueError:
        return None


class ColumnMapping:
    """通帳PDFの列マッピング設定"""

    def __init__(
        self,
        date_col: int = 0,
        description_col: int = 1,
        withdrawal_col: int = 2,
        deposit_col: int = 3,
        balance_col: int = 4,
    ):
        self.date_col = date_col
        self.description_col = description_col
        self.withdrawal_col = withdrawal_col
        self.deposit_col = deposit_col
        self.balance_col = balance_col


# 銀行別のデフォルト列マッピング
DEFAULT_COLUMN_MAPPINGS: dict[str, ColumnMapping] = {
    "default": ColumnMapping(),
    "ゆうちょ銀行": ColumnMapping(
        date_col=0, description_col=1, withdrawal_col=2, deposit_col=3, balance_col=4
    ),
}


def extract_transactions_from_pdf(
    pdf_path: Path,
    account: BankAccount,
    column_mapping: Optional[ColumnMapping] = None,
) -> list[Transaction]:
    """OCR済みPDFから取引データを抽出する

    Args:
        pdf_path: PDFファイルのパス
        account: 対象の銀行口座
        column_mapping: 列マッピング（Noneの場合は銀行名から自動判定）

    Returns:
        取引リスト
    """
    if column_mapping is None:
        column_mapping = DEFAULT_COLUMN_MAPPINGS.get(
            account.bank_name,
            DEFAULT_COLUMN_MAPPINGS["default"],
        )

    import pdfplumber

    transactions: list[Transaction] = []
    last_known_date: Optional[date] = None

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                # テーブルが見つからない場合、テキストからパースを試みる
                text = page.extract_text()
                if text:
                    transactions.extend(
                        _parse_text_lines(text, account, column_mapping)
                    )
                continue

            for table in tables:
                for row in table:
                    if not row or all(cell is None or str(cell).strip() == "" for cell in row):
                        continue

                    tx, last_known_date = _parse_table_row(
                        row, account, column_mapping, last_known_date
                    )
                    if tx is not None:
                        transactions.append(tx)

    return transactions


def _parse_table_row(
    row: list,
    account: BankAccount,
    mapping: ColumnMapping,
    last_known_date: Optional[date],
) -> tuple[Optional[Transaction], Optional[date]]:
    """テーブルの1行をTransactionに変換"""
    def safe_get(idx: int) -> str:
        if idx < len(row) and row[idx] is not None:
            return str(row[idx]).strip()
        return ""

    date_str = safe_get(mapping.date_col)
    description = safe_get(mapping.description_col)
    withdrawal_str = safe_get(mapping.withdrawal_col)
    deposit_str = safe_get(mapping.deposit_col)
    balance_str = safe_get(mapping.balance_col)

    # 日付のパース
    tx_date = parse_japanese_date(date_str)
    if tx_date is None:
        # 通帳では同日の取引で日付が省略されることがある
        tx_date = last_known_date

    if tx_date is None:
        return None, last_known_date

    # 金額のパース
    withdrawal = parse_amount(withdrawal_str)
    deposit = parse_amount(deposit_str)
    balance = parse_amount(balance_str)

    # 入金も出金もない行はスキップ
    if withdrawal is None and deposit is None:
        return None, tx_date

    tx = Transaction(
        account_id=account.id,
        date=tx_date,
        description=description,
        deposit=deposit,
        withdrawal=withdrawal,
        balance=balance,
    )
    return tx, tx_date


def _parse_text_lines(
    text: str,
    account: BankAccount,
    mapping: ColumnMapping,
) -> list[Transaction]:
    """テーブル抽出に失敗した場合のフォールバック: テキスト行から取引をパース"""
    transactions: list[Transaction] = []
    lines = text.split("\n")
    last_date: Optional[date] = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 日付を含む行を探す
        tx_date = parse_japanese_date(line)
        if tx_date is not None:
            last_date = tx_date

        if last_date is None:
            continue

        # 数字が含まれる行から金額を抽出
        amounts = re.findall(r"[\d,￥¥]+(?:\d)", line)
        if len(amounts) >= 2:
            # 最低2つの数値があれば取引行の可能性
            parsed_amounts = [parse_amount(a) for a in amounts]
            valid_amounts = [a for a in parsed_amounts if a is not None and a > 0]

            if len(valid_amounts) >= 1:
                # ヒューリスティック: 行内のテキストを摘要として使用
                desc = re.sub(r"[\d,￥¥\s./\-年月日]", "", line).strip()
                tx = Transaction(
                    account_id=account.id,
                    date=last_date,
                    description=desc[:50] if desc else "",
                    deposit=valid_amounts[0] if len(valid_amounts) > 1 else None,
                    withdrawal=valid_amounts[0] if len(valid_amounts) == 1 else None,
                    balance=valid_amounts[-1] if len(valid_amounts) > 1 else None,
                )
                transactions.append(tx)

    return transactions
