"""レポートスタイル定義"""

import os
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import TableStyle
import config
from config import (
    FONT_DIR, FONT_FILE,
    COLOR_HEADER_BG, COLOR_HEADER_TEXT, COLOR_ROW_ALT, COLOR_BORDER,
    COLOR_TOTAL_BG, COLOR_HIGHLIGHT_RED, COLOR_HIGHLIGHT_GREEN,
)

# 実行時に確定するフォント名（register_fonts() で更新される）
_active_font = config.FONT_NAME


def register_fonts():
    """日本語フォントを登録。成功時True、フォールバック時Falseを返す。"""
    global _active_font
    registered = False
    font_name = config.FONT_NAME  # "IPAexGothic"

    # 1. プロジェクト同梱フォント
    if os.path.exists(FONT_FILE):
        try:
            pdfmetrics.registerFont(TTFont(font_name, FONT_FILE))
            registered = True
        except Exception:
            pass

    # 2. システムフォントを探索
    if not registered:
        _windir = os.environ.get("WINDIR", r"C:\Windows")
        system_fonts = [
            # Windows (.ttc はsubfontIndex=0で読む)
            (os.path.join(_windir, "Fonts", "msgothic.ttc"), 0),
            (os.path.join(_windir, "Fonts", "YuGothM.ttc"), 0),
            (os.path.join(_windir, "Fonts", "meiryo.ttc"), 0),
            # Linux
            ("/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf", None),
            ("/usr/share/fonts/truetype/fonts-japanese-gothic.ttf", None),
            ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", 0),
            # macOS
            ("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc", 0),
        ]
        for font_path, subfont_idx in system_fonts:
            if os.path.exists(font_path):
                try:
                    if subfont_idx is not None:
                        pdfmetrics.registerFont(
                            TTFont(font_name, font_path, subfontIndex=subfont_idx)
                        )
                    else:
                        pdfmetrics.registerFont(TTFont(font_name, font_path))
                    registered = True
                    break
                except Exception:
                    continue

    if registered:
        # Bold/Italic バリアントのマッピングを登録（同一フォントを使用）
        pdfmetrics.registerFontFamily(
            font_name,
            normal=font_name,
            bold=font_name,
            italic=font_name,
            boldItalic=font_name,
        )
        _active_font = font_name
    else:
        # 日本語フォントが見つからない場合、Helveticaにフォールバック
        # （日本語は文字化けするが、エラーでPDF生成が止まることは防ぐ）
        _active_font = "Helvetica"
        config.FONT_NAME = "Helvetica"

    return registered


def _get_font():
    """現在のアクティブフォント名を返す"""
    return _active_font


def get_paragraph_style(name, font_size=8, alignment=TA_LEFT, bold=False):
    """ParagraphStyleを返す"""
    return ParagraphStyle(
        name=name,
        fontName=_active_font,
        fontSize=font_size,
        leading=font_size * 1.4,
        alignment=alignment,
        wordWrap="CJK",
    )


def _build_base_table_style():
    """現在のフォント設定でベーステーブルスタイルを構築"""
    return [
        ("FONTNAME", (0, 0), (-1, -1), _active_font),
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
    style_cmds = _build_base_table_style() + list(HEADER_STYLE)

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
