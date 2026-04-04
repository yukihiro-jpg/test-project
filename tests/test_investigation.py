"""調査パイプラインのE2Eテスト"""

from datetime import date
from io import BytesIO

from yokin_chosa.investigation import DepositInvestigation
from yokin_chosa.models import VerificationResult


def test_full_pipeline(sample_case, sample_transactions):
    """フルパイプラインのE2Eテスト"""
    investigation = DepositInvestigation(sample_case)

    # 取引データ読み込み
    for acc in sample_case.accounts:
        txs = sample_transactions.get(acc.id, [])
        investigation.load_transactions_directly(acc, txs)

    # 分析実行
    investigation.run_analysis()

    # フラグ付き取引が存在する
    assert len(investigation.flagged) > 0

    # 銀行間資金移動が検出される（tx001 ↔ tx006）
    fund_transfers = [
        f for f in investigation.flagged
        if f.verification_result == VerificationResult.FUND_TRANSFER
    ]
    assert len(fund_transfers) >= 2  # 出金側と入金側

    # 要確認の取引が存在する（tx002: 不明なATM出金）
    needs_confirmation = [
        f for f in investigation.flagged
        if f.verification_result == VerificationResult.NEEDS_CONFIRMATION
    ]
    assert any(
        f.transaction.id == "tx002" for f in needs_confirmation
    ) or any(
        f.transaction.description == "ATM出金" and f.transaction.withdrawal == 1_000_000
        for f in needs_confirmation
    )

    # 相続開始直前の出金がフラグされる
    death_proximity = [
        f for f in investigation.flagged
        if f.transaction.id == "tx004"
    ]
    assert len(death_proximity) >= 1


def test_excel_generation(sample_case, sample_transactions):
    """Excel出力が正常に生成される"""
    investigation = DepositInvestigation(sample_case)

    for acc in sample_case.accounts:
        txs = sample_transactions.get(acc.id, [])
        investigation.load_transactions_directly(acc, txs)

    investigation.run_analysis()

    output = BytesIO()
    investigation.generate_excel(output)

    # ファイルが空でないことを確認
    output.seek(0)
    content = output.read()
    assert len(content) > 0

    # Excelファイルのマジックバイトを確認（PKヘッダ = ZIP形式）
    assert content[:2] == b"PK"


def test_empty_transactions(sample_case):
    """取引データが空でもエラーにならない"""
    investigation = DepositInvestigation(sample_case)
    investigation.run_analysis()
    assert investigation.flagged == []

    output = BytesIO()
    investigation.generate_excel(output)
    output.seek(0)
    assert len(output.read()) > 0


def test_threshold_filtering(sample_case, sample_transactions):
    """閾値以下の取引はフラグされない"""
    investigation = DepositInvestigation(sample_case)

    for acc in sample_case.accounts:
        txs = sample_transactions.get(acc.id, [])
        investigation.load_transactions_directly(acc, txs)

    investigation.run_analysis()

    # tx005 (30,000円) はフラグされない
    flagged_ids = {f.transaction.id for f in investigation.flagged}
    assert "tx005" not in flagged_ids
