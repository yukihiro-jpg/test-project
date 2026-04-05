"""
勘定科目マッピング、定数、色定義
"""

# 決算月デフォルト（3月決算）
DEFAULT_FISCAL_YEAR_END_MONTH = 3

# 勘定科目 → (財務諸表区分, カテゴリ, 表示グループ) のマッピング
# statement_type: "PL" (損益計算書), "BS" (貸借対照表)
# category: 詳細カテゴリ
# display_group: 表示用グループ名
ACCOUNT_MAP = {
    # ── 売上高 ──
    "売上高": ("PL", "revenue", "売上高"),
    "売上": ("PL", "revenue", "売上高"),
    "売上値引": ("PL", "revenue", "売上高"),
    "売上戻り": ("PL", "revenue", "売上高"),
    "売上割引": ("PL", "revenue", "売上高"),

    # ── 売上原価 ──
    "仕入高": ("PL", "cogs", "売上原価"),
    "仕入": ("PL", "cogs", "売上原価"),
    "期首商品棚卸高": ("PL", "cogs", "売上原価"),
    "期末商品棚卸高": ("PL", "cogs", "売上原価"),
    "期首製品棚卸高": ("PL", "cogs", "売上原価"),
    "期末製品棚卸高": ("PL", "cogs", "売上原価"),
    "材料費": ("PL", "cogs", "売上原価"),
    "外注加工費": ("PL", "cogs", "売上原価"),
    "仕入値引": ("PL", "cogs", "売上原価"),
    "仕入戻し": ("PL", "cogs", "売上原価"),

    # ── 販売費及び一般管理費 ──
    "役員報酬": ("PL", "sga", "販売費及び一般管理費"),
    "給料手当": ("PL", "sga", "販売費及び一般管理費"),
    "給与手当": ("PL", "sga", "販売費及び一般管理費"),
    "賞与": ("PL", "sga", "販売費及び一般管理費"),
    "雑給": ("PL", "sga", "販売費及び一般管理費"),
    "法定福利費": ("PL", "sga", "販売費及び一般管理費"),
    "福利厚生費": ("PL", "sga", "販売費及び一般管理費"),
    "広告宣伝費": ("PL", "sga", "販売費及び一般管理費"),
    "旅費交通費": ("PL", "sga", "販売費及び一般管理費"),
    "交通費": ("PL", "sga", "販売費及び一般管理費"),
    "通信費": ("PL", "sga", "販売費及び一般管理費"),
    "消耗品費": ("PL", "sga", "販売費及び一般管理費"),
    "事務用品費": ("PL", "sga", "販売費及び一般管理費"),
    "水道光熱費": ("PL", "sga", "販売費及び一般管理費"),
    "地代家賃": ("PL", "sga", "販売費及び一般管理費"),
    "賃借料": ("PL", "sga", "販売費及び一般管理費"),
    "保険料": ("PL", "sga", "販売費及び一般管理費"),
    "修繕費": ("PL", "sga", "販売費及び一般管理費"),
    "減価償却費": ("PL", "sga", "販売費及び一般管理費"),
    "租税公課": ("PL", "sga", "販売費及び一般管理費"),
    "荷造運賃": ("PL", "sga", "販売費及び一般管理費"),
    "支払手数料": ("PL", "sga", "販売費及び一般管理費"),
    "会議費": ("PL", "sga", "販売費及び一般管理費"),
    "接待交際費": ("PL", "sga", "販売費及び一般管理費"),
    "交際費": ("PL", "sga", "販売費及び一般管理費"),
    "新聞図書費": ("PL", "sga", "販売費及び一般管理費"),
    "諸会費": ("PL", "sga", "販売費及び一般管理費"),
    "車両費": ("PL", "sga", "販売費及び一般管理費"),
    "研修費": ("PL", "sga", "販売費及び一般管理費"),
    "リース料": ("PL", "sga", "販売費及び一般管理費"),
    "貸倒引当金繰入": ("PL", "sga", "販売費及び一般管理費"),
    "雑費": ("PL", "sga", "販売費及び一般管理費"),

    # ── 営業外収益 ──
    "受取利息": ("PL", "non_op_income", "営業外収益"),
    "受取配当金": ("PL", "non_op_income", "営業外収益"),
    "雑収入": ("PL", "non_op_income", "営業外収益"),
    "為替差益": ("PL", "non_op_income", "営業外収益"),

    # ── 営業外費用 ──
    "支払利息": ("PL", "non_op_expense", "営業外費用"),
    "支払利息割引料": ("PL", "non_op_expense", "営業外費用"),
    "為替差損": ("PL", "non_op_expense", "営業外費用"),
    "雑損失": ("PL", "non_op_expense", "営業外費用"),

    # ── 特別利益 ──
    "固定資産売却益": ("PL", "extraordinary_income", "特別利益"),
    "貸倒引当金戻入": ("PL", "extraordinary_income", "特別利益"),

    # ── 特別損失 ──
    "固定資産売却損": ("PL", "extraordinary_loss", "特別損失"),
    "固定資産除却損": ("PL", "extraordinary_loss", "特別損失"),

    # ── 法人税等 ──
    "法人税等": ("PL", "tax", "法人税等"),
    "法人税": ("PL", "tax", "法人税等"),
    "法人住民税": ("PL", "tax", "法人税等"),
    "法人事業税": ("PL", "tax", "法人税等"),

    # ── BS: 現金及び預金 ──
    "現金": ("BS", "cash", "現金及び預金"),
    "小口現金": ("BS", "cash", "現金及び預金"),
    "普通預金": ("BS", "cash", "現金及び預金"),
    "当座預金": ("BS", "cash", "現金及び預金"),
    "定期預金": ("BS", "cash", "現金及び預金"),

    # ── BS: 売上債権 ──
    "売掛金": ("BS", "receivable", "売掛金"),
    "受取手形": ("BS", "receivable", "受取手形"),

    # ── BS: 棚卸資産 ──
    "商品": ("BS", "inventory", "棚卸資産"),
    "製品": ("BS", "inventory", "棚卸資産"),
    "原材料": ("BS", "inventory", "棚卸資産"),
    "仕掛品": ("BS", "inventory", "棚卸資産"),

    # ── BS: 固定資産 ──
    "建物": ("BS", "fixed_asset", "固定資産"),
    "建物附属設備": ("BS", "fixed_asset", "固定資産"),
    "機械装置": ("BS", "fixed_asset", "固定資産"),
    "車両運搬具": ("BS", "fixed_asset", "固定資産"),
    "工具器具備品": ("BS", "fixed_asset", "固定資産"),
    "土地": ("BS", "fixed_asset", "固定資産"),
    "ソフトウェア": ("BS", "fixed_asset", "固定資産"),

    # ── BS: 仕入債務 ──
    "買掛金": ("BS", "payable", "買掛金"),
    "支払手形": ("BS", "payable", "支払手形"),

    # ── BS: 借入金 ──
    "短期借入金": ("BS", "short_term_loan", "短期借入金"),
    "長期借入金": ("BS", "long_term_loan", "長期借入金"),
    "一年以内返済長期借入金": ("BS", "short_term_loan", "短期借入金"),

    # ── BS: その他負債 ──
    "未払金": ("BS", "other_liability", "未払金"),
    "未払費用": ("BS", "other_liability", "未払費用"),
    "預り金": ("BS", "other_liability", "預り金"),
    "未払法人税等": ("BS", "other_liability", "未払法人税等"),
    "未払消費税等": ("BS", "other_liability", "未払消費税等"),

    # ── BS: 純資産 ──
    "資本金": ("BS", "equity", "資本金"),
    "繰越利益剰余金": ("BS", "equity", "繰越利益剰余金"),
}

# 固変分類（損益分岐点分析用）
# "fixed" = 固定費, "variable" = 変動費
COST_BEHAVIOR = {
    # 売上原価は基本的に変動費
    "cogs": "variable",
    # 販管費の個別分類
    "役員報酬": "fixed",
    "給料手当": "fixed",
    "給与手当": "fixed",
    "賞与": "fixed",
    "雑給": "variable",
    "法定福利費": "fixed",
    "福利厚生費": "fixed",
    "広告宣伝費": "variable",
    "旅費交通費": "variable",
    "交通費": "variable",
    "通信費": "fixed",
    "消耗品費": "variable",
    "事務用品費": "fixed",
    "水道光熱費": "fixed",
    "地代家賃": "fixed",
    "賃借料": "fixed",
    "保険料": "fixed",
    "修繕費": "fixed",
    "減価償却費": "fixed",
    "租税公課": "fixed",
    "荷造運賃": "variable",
    "支払手数料": "variable",
    "会議費": "variable",
    "接待交際費": "variable",
    "交際費": "variable",
    "新聞図書費": "fixed",
    "諸会費": "fixed",
    "車両費": "fixed",
    "研修費": "fixed",
    "リース料": "fixed",
    "貸倒引当金繰入": "fixed",
    "雑費": "fixed",
}

# 借入金関連の科目名
LOAN_ACCOUNTS = ["短期借入金", "長期借入金", "一年以内返済長期借入金"]
INTEREST_ACCOUNTS = ["支払利息", "支払利息割引料"]

# ── 色パレット ──
COLORS = {
    "primary": "#1E3A5F",
    "secondary": "#2E86AB",
    "accent_blue": "#4ECDC4",
    "accent_green": "#27AE60",
    "accent_red": "#E74C3C",
    "accent_orange": "#F39C12",
    "accent_yellow": "#F1C40F",
    "light_gray": "#BDC3C7",
    "dark_gray": "#7F8C8D",
    "background": "#F8F9FA",
    # チャート用カラーシーケンス
    "chart_sequence": [
        "#1E3A5F", "#2E86AB", "#4ECDC4", "#F39C12",
        "#E74C3C", "#9B59B6", "#27AE60", "#34495E",
    ],
    # 3期比較用
    "period_colors": ["#1E3A5F", "#2E86AB", "#A8DADC"],
    # 増減表示
    "positive": "#27AE60",
    "negative": "#E74C3C",
}

# 数値フォーマットヘルパー
def format_currency(value, unit="円"):
    """金額をフォーマット（カンマ区切り）"""
    if abs(value) >= 100_000_000:
        return f"{value / 100_000_000:,.1f}億{unit}"
    elif abs(value) >= 10_000:
        return f"{value / 10_000:,.0f}万{unit}"
    return f"{value:,.0f}{unit}"


def format_percentage(value):
    """パーセンテージをフォーマット"""
    return f"{value:.2f}%"


def format_delta(value):
    """増減額をフォーマット（+/-付き）"""
    sign = "+" if value >= 0 else ""
    return f"{sign}{format_currency(value)}"
