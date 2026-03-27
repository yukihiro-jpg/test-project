"""書類種類パターン・会社名パターン・決算期パターンの定義"""

import re

# 書類種類の正規表現パターンと表示名のマッピング
# マッチ優先度順に定義（先にマッチしたものが採用される）
DOCUMENT_TYPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"法人税.*申告書"), "法人税申告書"),
    (re.compile(r"消費税.*申告書"), "消費税申告書"),
    (re.compile(r"(決算書|決算報告書)"), "決算報告書"),
    (re.compile(r"(勘定科目内訳明細書|科目内訳書)"), "勘定科目内訳明細書"),
    (re.compile(r"事業概況説明書"), "事業概況説明書"),
    (re.compile(r"県.*税.*申告書"), "県税申告書"),
    (re.compile(r"市.*税.*申告書"), "市税申告書"),
    (re.compile(r"適用額明細書"), "適用額明細書"),
]

# 会社名を抽出するためのパターン
COMPANY_NAME_PATTERNS: list[re.Pattern] = [
    re.compile(r"(?:法人名|名称|申告法人|納税者|会社名)\s*[:：]?\s*(.+)"),
]

# 決算期（和暦）を抽出するためのパターン
FISCAL_PERIOD_PATTERN = re.compile(
    r"(令和|平成|昭和)\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月"
)

# ファイル名に使用できない文字の置換パターン
INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]')
