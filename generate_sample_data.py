"""
サンプル元帳データ・予算データ生成スクリプト
3期分（2023年4月〜2026年3月）の仕訳データを生成
"""
import csv
import random
import os

random.seed(42)

# 季節性係数（4月=index 0, 3月=index 11）
SEASONALITY = [0.95, 1.00, 0.90, 0.85, 0.80, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20, 1.25]

# 年度ごとの成長率
GROWTH = {2024: 1.0, 2025: 1.08, 2026: 1.12}

# 基本月次売上
BASE_MONTHLY_SALES = 12000000  # 1,200万円


def generate_date(year, month, day_range=(1, 28)):
    day = random.randint(*day_range)
    return f"{year}/{month:02d}/{day:02d}"


def get_fiscal_year(year, month):
    if month <= 3:
        return year
    return year + 1


def generate_ledger():
    rows = []

    for year in range(2023, 2026):
        for month in range(4, 13):
            fy = get_fiscal_year(year, month)
            growth = GROWTH.get(fy, 1.0)
            season = SEASONALITY[month - 4]
            _generate_month(rows, year, month, growth, season)

        for month in range(1, 4):
            next_year = year + 1
            fy = get_fiscal_year(next_year, month)
            growth = GROWTH.get(fy, 1.0)
            season = SEASONALITY[month + 8]
            _generate_month(rows, next_year, month, growth, season)

    return rows


def _generate_month(rows, year, month, growth, season):
    base_sales = BASE_MONTHLY_SALES * growth * season
    variation = random.uniform(0.92, 1.08)
    sales = int(base_sales * variation)

    date_str = generate_date(year, month, (1, 5))

    # 売上高
    rows.append([date_str, "売上高", "", "0", str(sales), f"{month}月売上計上", "営業部"])
    rows.append([date_str, "売掛金", "", str(sales), "0", f"{month}月売上計上", "営業部"])

    # 売掛金回収（前月売上分を当月回収）
    collection_date = generate_date(year, month, (20, 28))
    collection = int(sales * random.uniform(0.85, 0.95))
    rows.append([collection_date, "普通預金", "", str(collection), "0", "売掛金回収", ""])
    rows.append([collection_date, "売掛金", "", "0", str(collection), "売掛金回収", ""])

    # 仕入高（売上の55-65%）
    cogs_ratio = random.uniform(0.55, 0.65)
    cogs = int(sales * cogs_ratio)
    purchase_date = generate_date(year, month, (1, 10))
    rows.append([purchase_date, "仕入高", "", str(cogs), "0", f"{month}月仕入", ""])
    rows.append([purchase_date, "買掛金", "", "0", str(cogs), f"{month}月仕入", ""])

    # 買掛金支払い
    pay_date = generate_date(year, month, (25, 28))
    payment = int(cogs * random.uniform(0.80, 0.95))
    rows.append([pay_date, "買掛金", "", str(payment), "0", "買掛金支払", ""])
    rows.append([pay_date, "普通預金", "", "0", str(payment), "買掛金支払", ""])

    # 販管費
    sga_items = [
        ("役員報酬", 800000, 800000),
        ("給料手当", 1200000, 1500000),
        ("法定福利費", 250000, 350000),
        ("福利厚生費", 30000, 80000),
        ("地代家賃", 350000, 350000),
        ("水道光熱費", 40000, 80000),
        ("通信費", 30000, 50000),
        ("消耗品費", 20000, 60000),
        ("旅費交通費", 30000, 80000),
        ("接待交際費", 20000, 60000),
        ("支払手数料", 15000, 40000),
        ("保険料", 25000, 25000),
        ("減価償却費", 120000, 120000),
        ("租税公課", 10000, 30000),
        ("広告宣伝費", 50000, 150000),
        ("荷造運賃", 30000, 60000),
        ("雑費", 5000, 20000),
    ]

    expense_date = generate_date(year, month, (25, 28))
    for account, low, high in sga_items:
        if low == high:
            amount = low
        else:
            amount = random.randint(low, high)
        # 成長に伴う経費増（一部）
        if account in ["給料手当", "法定福利費", "広告宣伝費"]:
            amount = int(amount * growth)

        rows.append([expense_date, account, "", str(amount), "0", f"{account}支払", "管理部"])
        rows.append([expense_date, "普通預金", "", "0", str(amount), f"{account}支払", ""])

    # 支払利息（借入金があれば）
    interest = int(50000 * (1 - (year - 2023) * 0.05))  # 徐々に減少
    if interest > 0:
        int_date = generate_date(year, month, (25, 28))
        rows.append([int_date, "支払利息", "", str(interest), "0", "借入金利息", ""])
        rows.append([int_date, "普通預金", "", "0", str(interest), "借入金利息", ""])

    # 借入金返済（毎月定額）
    loan_repay = 200000
    repay_date = generate_date(year, month, (20, 25))
    rows.append([repay_date, "長期借入金", "", str(loan_repay), "0", "長期借入金返済", ""])
    rows.append([repay_date, "普通預金", "", "0", str(loan_repay), "長期借入金返済", ""])

    # 初期借入（2023年4月のみ）
    if year == 2023 and month == 4:
        rows.append(["2023/04/01", "普通預金", "", "15000000", "0", "長期借入金実行", ""])
        rows.append(["2023/04/01", "長期借入金", "", "0", "15000000", "長期借入金実行", ""])

    # 追加借入（2024年10月）
    if year == 2024 and month == 10:
        rows.append(["2024/10/01", "普通預金", "", "5000000", "0", "追加借入実行", ""])
        rows.append(["2024/10/01", "長期借入金", "", "0", "5000000", "追加借入実行", ""])

    # 決算月（3月）は法人税計上
    if month == 3:
        tax = int(sales * 0.08)
        rows.append([generate_date(year, 3, (28, 28)), "法人税等", "", str(tax), "0", "法人税等計上", ""])
        rows.append([generate_date(year, 3, (28, 28)), "未払法人税等", "", "0", str(tax), "法人税等計上", ""])


def generate_budget():
    rows = []
    # 当期（2025年4月〜2026年3月）の予算
    for month_offset in range(12):
        if month_offset < 9:
            year = 2025
            month = 4 + month_offset
        else:
            year = 2026
            month = month_offset - 8

        season = SEASONALITY[month_offset]
        budget_sales = int(BASE_MONTHLY_SALES * 1.15 * season)  # 成長目標15%増
        budget_cogs = int(budget_sales * 0.58)

        ym = f"{year}/{month:02d}"
        rows.append([ym, "売上高", str(budget_sales)])
        rows.append([ym, "仕入高", str(budget_cogs)])

    return rows


def main():
    os.makedirs("data", exist_ok=True)

    # 元帳データ
    ledger = generate_ledger()
    with open("data/sample_ledger.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["日付", "勘定科目", "補助科目", "借方金額", "貸方金額", "摘要", "部門"])
        writer.writerows(ledger)

    print(f"元帳データ: {len(ledger)} 行生成 -> data/sample_ledger.csv")

    # 予算データ
    budget = generate_budget()
    with open("data/sample_budget.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["年月", "勘定科目", "予算額"])
        writer.writerows(budget)

    print(f"予算データ: {len(budget)} 行生成 -> data/sample_budget.csv")


if __name__ == "__main__":
    main()
