"""銀行間資金移動マッチングのテスト"""

from datetime import date

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.matching.interbank import InterbankMatcher
from yokin_chosa.models import (
    FlaggedTransaction,
    FlagReason,
    Transaction,
    VerificationResult,
)


def make_flagged(tx: Transaction) -> FlaggedTransaction:
    reasons = []
    if tx.is_withdrawal:
        reasons.append(FlagReason.LARGE_WITHDRAWAL)
    if tx.is_deposit:
        reasons.append(FlagReason.LARGE_DEPOSIT)
    return FlaggedTransaction(
        transaction=tx,
        flag_reasons=reasons,
        verification_result=VerificationResult.NEEDS_CONFIRMATION,
    )


def test_same_day_match(config):
    """同日・同額の出金と入金がマッチする"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        description="振込", withdrawal=3_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc2", date=date(2024, 4, 1),
        description="振込入金", deposit=3_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp)]
    matches = matcher.find_matches(flagged)

    assert len(matches) == 1
    assert matches[0][2] == 1.0  # 信頼度 = 1.0


def test_next_day_match(config):
    """翌日の同額入金もマッチする（信頼度低め）"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        withdrawal=1_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc2", date=date(2024, 4, 2),
        deposit=1_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp)]
    matches = matcher.find_matches(flagged)

    assert len(matches) == 1
    assert matches[0][2] == 0.8


def test_no_match_different_amount(config):
    """金額が異なる場合はマッチしない"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        withdrawal=3_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc2", date=date(2024, 4, 1),
        deposit=2_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp)]
    matches = matcher.find_matches(flagged)
    assert len(matches) == 0


def test_no_match_same_account(config):
    """同一口座内の入出金はマッチしない"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        withdrawal=1_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc1", date=date(2024, 4, 1),
        deposit=1_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp)]
    matches = matcher.find_matches(flagged)
    assert len(matches) == 0


def test_no_match_too_far_apart(config):
    """日付が4日以上離れているとマッチしない"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        withdrawal=1_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc2", date=date(2024, 4, 5),
        deposit=1_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp)]
    matches = matcher.find_matches(flagged)
    assert len(matches) == 0


def test_apply_matches(config):
    """apply_matchesで検証結果が更新される"""
    matcher = InterbankMatcher(config)

    wd = Transaction(
        id="w1", account_id="acc1", date=date(2024, 4, 1),
        withdrawal=3_000_000,
    )
    dp = Transaction(
        id="d1", account_id="acc2", date=date(2024, 4, 1),
        deposit=3_000_000,
    )
    unmatched = Transaction(
        id="u1", account_id="acc1", date=date(2024, 5, 1),
        withdrawal=1_000_000,
    )

    flagged = [make_flagged(wd), make_flagged(dp), make_flagged(unmatched)]
    result = matcher.apply_matches(flagged)

    matched = [f for f in result if f.verification_result == VerificationResult.FUND_TRANSFER]
    unmatched_results = [f for f in result if f.verification_result == VerificationResult.NEEDS_CONFIRMATION]

    assert len(matched) == 2
    assert len(unmatched_results) == 1
