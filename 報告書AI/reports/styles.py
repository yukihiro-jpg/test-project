"""レポートスタイル定義"""

import os
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import TableStyle
from config import (
    FONT_DIR, FONT_NAME, FONT_FILE,
    COLOR_HEADER_BG, COLOR_HEADER_TEXT, COLOR_ROW_ALT, COLOR_BORDER,
    COLOR_TOTAL_BG, COLOR_HIGHLIGHT_RED, COLOR_HIGHLIGHT_GREEN,
)


def register_fonts():
    """日本語フォントを登録"""
    registered = False

    if os.path.exists(FONT_FILE):
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_FILE))
        registered = True
    else:
        # フォントがない場合のフォールバック
        # システムフォントを探す
        system_fonts = [
            "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
            "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
            "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        ]
        for font_path in system_fonts:
            if os.path.exists(font_path):
                try:
                    pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))
                    registered = True
                    break
                except Exception:
                    continue

    if registered:
        # Bold/Italic バリアントのマッピングを登録（同一フォントを使用）
        pdfmetrics.registerFontFamily(
            FONT_NAME,
            normal=FONT_NAME,
            bold=FONT_NAME,
            italic=FONT_NAME,
            boldItalic=FONT_NAME,
        )

    return registered


def get_paragraph_style(name, font_size=8, alignment=TA_LEFT, bold=False):
    """ParagraphStyleを返す"""
    return ParagraphStyle(
        name=name,
        fontName=FONT_NAME,
        fontSize=font_size,
        leading=font_size * 1.4,
        alignment=alignment,
        wordWrap="CJK",
    )


# テーブルスタイル定義
BASE_TABLE_STYLE = [
    ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
    ("FONTSIZE", (0, 0), (-1, -1), 7),
    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ("ALIGN", (0, 0), (0, -1), "LEFT"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ("TOPPADDING", (0, 0), (-1, -1), 2),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
]

HEADER_STYLE = [
    ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
    ("TEXTCOLOR", (0, 0), (-1, 0), COLOR_HEADER_TEXT),
    ("FONTSIZE", (0, 0), (-1, 0), 7),
]


def get_table_style(num_rows=0, total_rows=None, alt_rows=True):
    """テーブルスタイルを生成"""
    style_cmds = list(BASE_TABLE_STYLE) + list(HEADER_STYLE)

    # 交互行の背景色
    if alt_rows:
        for i in range(1, num_rows + 1):
            if i % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, i), (-1, i), COLOR_ROW_ALT))

    # 合計行のスタイル
    if total_rows:
        for row_idx in total_rows:
            style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), COLOR_TOTAL_BG))
            style_cmds.append(("FONTSIZE", (0, row_idx), (-1, row_idx), 7.5))

    return TableStyle(style_cmds)


def get_highlight_commands(row, col, is_positive):
    """増減ハイライトのスタイルコマンドを返す"""
    color = COLOR_HIGHLIGHT_GREEN if is_positive else COLOR_HIGHLIGHT_RED
    return [("BACKGROUND", (col, row), (col, row), color)]
