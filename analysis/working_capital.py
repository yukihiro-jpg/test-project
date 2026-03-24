"""運転資本・EBITDA・返済原資分析"""

from utils.formatting import safe_div


def compute_working_capital(bs_items: dict) -> dict:
    """
    運転資本を計算する。

    Returns:
        {
            "current_assets": 流動資産合計,
            "current_liabilities": 流動負債合計,
            "working_capital": 運転資本,
            "details": {各科目: 金額},
        }
    """
    # 流動資産の主要科目
    ca_keywords = ["現金", "預金", "売掛", "受取手形", "棚卸", "商品", "製品",
                    "原材料", "仕掛品", "前払", "短期貸付", "未収"]
    # 流動負債の主要科目
    cl_keywords = ["買掛", "支払手形", "短期借入", "未払", "前受",
                    "預り", "仮受", "賞与引当"]

    current_assets = 0
    current_liabilities = 0
    details = {}

    for name, val in bs_items.items():
        is_ca = any(kw in name for kw in ca_keywords)
        is_cl = any(kw in name for kw in cl_keywords)

        if "流動資産" in name and "合計" in name:
            current_assets = val
            details[name] = val
        elif "流動負債" in name and "合計" in name:
            current_liabilities = val
            details[name] = val
        elif is_ca:
            current_assets += val
            details[name] = val
        elif is_cl:
            current_liabilities += val
            details[name] = val

    # 合計行がある場合はそちらを優先（重複加算を避ける）
    if any("流動資産" in k and "合計" in k for k in bs_items):
        current_assets = sum(v for k, v in bs_items.items() if "流動資産" in k and "合計" in k)
    if any("流動負債" in k and "合計" in k for k in bs_items):
        current_liabilities = sum(v for k, v in bs_items.items() if "流動負債" in k and "合計" in k)

    return {
        "current_assets": current_assets,
        "current_liabilities": current_liabilities,
        "working_capital": current_assets - current_liabilities,
        "details": details,
    }


def compute_ebitda(pl_items: dict) -> dict:
    """
    EBITDAを計算する。

    EBITDA = 営業利益 + 減価償却費
    """
    operating_income = 0
    depreciation = 0

    for name, val in pl_items.items():
        if name == "営業利益":
            operating_income = val
        elif "減価償却" in name:
            depreciation += abs(val)

    ebitda = operating_income + depreciation

    return {
        "operating_income": operating_income,
        "depreciation": depreciation,
        "ebitda": ebitda,
    }


def compute_repayment_capacity(ebitda: float, annual_repayment: float,
                                working_capital_change: float = 0) -> dict:
    """
    返済原資の十分性を評価する。

    返済原資 = EBITDA - 運転資本増加額
    債務償還年数 = 有利子負債 / EBITDA
    """
    repayment_source = ebitda - working_capital_change

    coverage_ratio = safe_div(repayment_source, annual_repayment)

    return {
        "ebitda": ebitda,
        "working_capital_change": working_capital_change,
        "repayment_source": repayment_source,
        "annual_repayment": annual_repayment,
        "coverage_ratio": coverage_ratio,
        "is_sufficient": coverage_ratio is not None and coverage_ratio >= 1.0,
    }
