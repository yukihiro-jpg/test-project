"""アプリケーション設定・定数定義"""

import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor

# ページ設定
PAGE_SIZE = landscape(A4)  # (842, 595)
PAGE_WIDTH = PAGE_SIZE[0]
PAGE_HEIGHT = PAGE_SIZE[1]
MARGIN = 36  # 0.5 inch

# フォント設定
FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
FONT_NAME = "IPAexGothic"
FONT_FILE = os.path.join(FONT_DIR, "ipaexg.ttf")
FONT_NAME_BOLD = "IPAexGothic"  # IPAexGothicにはBoldがないので同一フォントを使用

# カラー設定
COLOR_HEADER_BG = HexColor("#2C3E50")
COLOR_HEADER_TEXT = HexColor("#FFFFFF")
COLOR_SUBHEADER_BG = HexColor("#34495E")
COLOR_ROW_ALT = HexColor("#F8F9FA")
COLOR_HIGHLIGHT_RED = HexColor("#FADBD8")
COLOR_HIGHLIGHT_GREEN = HexColor("#D5F5E3")
COLOR_TEXT_RED = HexColor("#C0392B")
COLOR_TEXT_GREEN = HexColor("#27AE60")
COLOR_BORDER = HexColor("#BDC3C7")
COLOR_ACCENT = HexColor("#2980B9")
COLOR_TOTAL_BG = HexColor("#EBF5FB")

# PL科目階層（社長向けサマリー）
PL_SUMMARY_ITEMS = [
    "売上高",
    "売上原価",
    "売上総利益",
    "販売費及び一般管理費",
    "営業利益",
    "営業外収益",
    "営業外費用",
    "経常利益",
    "特別利益",
    "特別損失",
    "税引前当期純利益",
    "法人税等",
    "当期純利益",
]

# PL集計科目（太字表示する科目）
PL_TOTAL_ITEMS = {
    "売上総利益",
    "営業利益",
    "経常利益",
    "税引前当期純利益",
    "当期純利益",
}

# 増減分析の閾値
VARIANCE_THRESHOLD_PCT = 20.0   # 20%以上の変動をハイライト
VARIANCE_THRESHOLD_ABS = 1_000_000  # 100万円以上の変動をハイライト

# 表示単位
DISPLAY_UNIT = 1000  # 千円表示
DISPLAY_UNIT_LABEL = "（単位：千円）"

# 科目名の名寄せマッピング
ACCOUNT_ALIASES = {
    "売上": "売上高",
    "売上げ高": "売上高",
    "売上原価": "売上原価",
    "原価": "売上原価",
    "粗利": "売上総利益",
    "粗利益": "売上総利益",
    "売上総利益": "売上総利益",
    "販管費": "販売費及び一般管理費",
    "販売費及び一般管理費": "販売費及び一般管理費",
    "販売費・一般管理費": "販売費及び一般管理費",
    "営業利益": "営業利益",
    "営業外収益": "営業外収益",
    "営業外費用": "営業外費用",
    "経常利益": "経常利益",
    "特別利益": "特別利益",
    "特別損失": "特別損失",
    "税引前当期純利益": "税引前当期純利益",
    "税引前利益": "税引前当期純利益",
    "法人税等": "法人税等",
    "法人税、住民税及び事業税": "法人税等",
    "当期純利益": "当期純利益",
    "当期利益": "当期純利益",
}
