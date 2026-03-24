"""統合テスト - サンプルデータでの動作確認"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import io
from datetime import date

from analysis.pl_summary import compute_pl_summary, compute_monthly_transition
from analysis.variance import compute_variance_analysis
from analysis.working_capital import compute_working_capital, compute_ebitda, compute_repayment_capacity
from analysis.forecast import compute_forecast
from analysis.loan_schedule import compute_loan_schedule
from reports.excel_generator import generate_excel
from reports.pdf_generator import generate_pdf
from utils.formatting import format_yen, format_percent
from utils.fiscal_year import get_elapsed_months, get_remaining_months


def create_sample_data():
    """サンプルデータを生成"""
    months = ["2025/04", "2025/05", "2025/06", "2025/07", "2025/08",
              "2025/09", "2025/10", "2025/11", "2025/12", "2026/01",
              "2026/02", "2026/03"]

    pl_data = {
        "売上高": {m: 10_000_000 + i * 500_000 for i, m in enumerate(months)},
        "売上原価": {m: 6_000_000 + i * 300_000 for i, m in enumerate(months)},
        "売上総利益": {m: 4_000_000 + i * 200_000 for i, m in enumerate(months)},
        "販売費及び一般管理費": {m: 3_000_000 + i * 50_000 for i, m in enumerate(months)},
        "営業利益": {m: 1_000_000 + i * 150_000 for i, m in enumerate(months)},
        "営業外収益": {m: 50_000 for i, m in enumerate(months)},
        "営業外費用": {m: 100_000 for i, m in enumerate(months)},
        "経常利益": {m: 950_000 + i * 150_000 for i, m in enumerate(months)},
        "特別利益": {m: 0 for i, m in enumerate(months)},
        "特別損失": {m: 0 for i, m in enumerate(months)},
        "税引前当期純利益": {m: 950_000 + i * 150_000 for i, m in enumerate(months)},
        "法人税等": {m: 285_000 + i * 45_000 for i, m in enumerate(months)},
        "当期純利益": {m: 665_000 + i * 105_000 for i, m in enumerate(months)},
    }

    return pl_data, months


def test_pl_summary():
    """PLサマリーテスト"""
    pl_data, months = create_sample_data()
    # 11月（インデックス7）を当月とする
    summary = compute_pl_summary(pl_data, months, 7)

    assert len(summary["items"]) == 13
    print(f"  売上高当月: {format_yen(summary['items'][0]['current_month'])}")
    print(f"  営業利益当月: {format_yen(summary['items'][4]['current_month'])}")
    print("  ✅ PLサマリー OK")


def test_variance():
    """増減分析テスト"""
    data = {
        "売上高": {"第10期": 100_000_000, "第11期": 120_000_000, "第12期": 115_000_000},
        "売上原価": {"第10期": 60_000_000, "第11期": 70_000_000, "第12期": 72_000_000},
        "営業利益": {"第10期": 15_000_000, "第11期": 20_000_000, "第12期": 18_000_000},
    }
    periods = ["第10期", "第11期", "第12期"]

    results = compute_variance_analysis(data, periods)
    assert len(results) == 3
    # 売上高: 第11期→第12期 = -5,000,000 (-4.2%)
    assert results[0]["changes"][-1]["amount"] == -5_000_000
    print(f"  売上高増減: {format_yen(results[0]['changes'][-1]['amount'])}")
    print("  ✅ 増減分析 OK")


def test_working_capital():
    """運転資本テスト"""
    bs_items = {
        "現金及び預金": 20_000_000,
        "売掛金": 15_000_000,
        "棚卸資産": 5_000_000,
        "買掛金": 10_000_000,
        "短期借入金": 5_000_000,
        "未払金": 3_000_000,
    }

    wc = compute_working_capital(bs_items)
    print(f"  流動資産: {format_yen(wc['current_assets'])}")
    print(f"  流動負債: {format_yen(wc['current_liabilities'])}")
    print(f"  運転資本: {format_yen(wc['working_capital'])}")
    assert wc["working_capital"] == wc["current_assets"] - wc["current_liabilities"]
    print("  ✅ 運転資本 OK")


def test_ebitda():
    """EBITDAテスト"""
    pl_items = {
        "営業利益": 18_000_000,
        "減価償却費": 5_000_000,
    }

    ebitda = compute_ebitda(pl_items)
    assert ebitda["ebitda"] == 23_000_000
    print(f"  EBITDA: {format_yen(ebitda['ebitda'])}")
    print("  ✅ EBITDA OK")


def test_repayment_capacity():
    """返済原資テスト"""
    result = compute_repayment_capacity(
        ebitda=23_000_000,
        annual_repayment=12_000_000,
        working_capital_change=2_000_000
    )
    assert result["repayment_source"] == 21_000_000
    assert result["is_sufficient"] is True
    print(f"  返済カバー率: {result['coverage_ratio']:.2f}倍")
    print("  ✅ 返済原資 OK")


def test_forecast():
    """決算着地見込みテスト"""
    pl_data, months = create_sample_data()
    forecast = compute_forecast(pl_data, months, 7)  # 11月まで

    assert forecast["elapsed"] == 8
    assert forecast["remaining"] == 4
    print(f"  経過: {forecast['elapsed']}ヶ月, 残: {forecast['remaining']}ヶ月")
    print(f"  売上高実績累計: {format_yen(forecast['actual_ytd']['売上高'])}")
    print(f"  売上高パターンA: {format_yen(forecast['pattern_a']['売上高'])}")
    print(f"  売上高パターンB: {format_yen(forecast['pattern_b']['売上高'])}")
    print("  ✅ 決算着地見込み OK")


def test_loan_schedule():
    """借入金スケジュールテスト"""
    loans = [
        {"name": "設備資金A", "lender": "○○銀行", "remaining_balance": 30_000_000,
         "monthly_payment": 500_000, "interest_rate": 1.5, "loan_type": "長期"},
        {"name": "運転資金B", "lender": "△△信金", "remaining_balance": 10_000_000,
         "monthly_payment": 300_000, "interest_rate": 2.0, "loan_type": "長期"},
    ]

    result = compute_loan_schedule(loans)
    assert len(result["contracts"]) == 2
    assert result["total"]["total_balance"] == 40_000_000

    for c in result["contracts"]:
        print(f"  {c['name']}: 残{c['remaining_payments']}回 ({c['remaining_period_str']})")

    print(f"  合計残高: {format_yen(result['total']['total_balance'])}")
    print("  ✅ 借入金スケジュール OK")


def test_fiscal_year():
    """会計年度ユーティリティテスト"""
    assert get_elapsed_months(4, 11) == 8
    assert get_remaining_months(4, 11) == 4
    assert get_elapsed_months(4, 3) == 12
    assert get_elapsed_months(1, 6) == 6
    print("  ✅ 会計年度ユーティリティ OK")


def test_excel_generation():
    """Excel生成テスト"""
    pl_data, months = create_sample_data()
    summary = compute_pl_summary(pl_data, months, 7)
    transition = compute_monthly_transition(pl_data, months)
    forecast = compute_forecast(pl_data, months, 7)
    loan_result = compute_loan_schedule([
        {"name": "テスト借入", "lender": "テスト銀行", "remaining_balance": 10_000_000,
         "monthly_payment": 200_000, "interest_rate": 1.0, "loan_type": "長期"},
    ])
    repayment = compute_repayment_capacity(15_000_000, 2_400_000)

    report_data = {
        "pl_summary": summary,
        "monthly_transition": transition,
        "months": months,
        "forecast": forecast,
        "loan_schedule": loan_result,
        "repayment_capacity": repayment,
        "working_capital": {"current_assets": 30_000_000, "current_liabilities": 15_000_000, "working_capital": 15_000_000},
        "ebitda": {"operating_income": 12_000_000, "depreciation": 3_000_000, "ebitda": 15_000_000},
    }

    settings = {
        "company_name": "テスト株式会社",
        "report_title": "月次経営報告書",
        "report_date": date.today(),
        "current_year": 2025,
        "current_month": 11,
        "display_unit": 1000,
    }

    excel_bytes = generate_excel(report_data, settings)
    assert len(excel_bytes) > 0
    print(f"  Excel生成: {len(excel_bytes):,} bytes")
    print("  ✅ Excel生成 OK")


def test_pdf_generation():
    """PDF生成テスト"""
    pl_data, months = create_sample_data()
    summary = compute_pl_summary(pl_data, months, 7)
    transition = compute_monthly_transition(pl_data, months)
    forecast = compute_forecast(pl_data, months, 7)
    loan_result = compute_loan_schedule([
        {"name": "テスト借入", "lender": "テスト銀行", "remaining_balance": 10_000_000,
         "monthly_payment": 200_000, "interest_rate": 1.0, "loan_type": "長期"},
    ])
    repayment = compute_repayment_capacity(15_000_000, 2_400_000)

    report_data = {
        "pl_summary": summary,
        "monthly_transition": transition,
        "months": months,
        "forecast": forecast,
        "loan_schedule": loan_result,
        "repayment_capacity": repayment,
        "working_capital": {"current_assets": 30_000_000, "current_liabilities": 15_000_000, "working_capital": 15_000_000},
        "ebitda": {"operating_income": 12_000_000, "depreciation": 3_000_000, "ebitda": 15_000_000},
    }

    settings = {
        "company_name": "テスト株式会社",
        "report_title": "月次経営報告書",
        "report_date": date.today(),
        "current_year": 2025,
        "current_month": 11,
        "display_unit": 1000,
    }

    pdf_bytes = generate_pdf(report_data, settings)
    assert len(pdf_bytes) > 0
    assert pdf_bytes[:5] == b"%PDF-"
    print(f"  PDF生成: {len(pdf_bytes):,} bytes")
    print("  ✅ PDF生成 OK")


if __name__ == "__main__":
    print("=== 統合テスト開始 ===\n")

    tests = [
        ("会計年度ユーティリティ", test_fiscal_year),
        ("PLサマリー", test_pl_summary),
        ("増減分析", test_variance),
        ("運転資本", test_working_capital),
        ("EBITDA", test_ebitda),
        ("返済原資", test_repayment_capacity),
        ("決算着地見込み", test_forecast),
        ("借入金スケジュール", test_loan_schedule),
        ("Excel生成", test_excel_generation),
        ("PDF生成", test_pdf_generation),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        print(f"\n[{name}]")
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"  ❌ 失敗: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n=== 結果: {passed}/{passed + failed} テスト成功 ===")
