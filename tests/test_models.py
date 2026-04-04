"""データモデルのテスト"""

from datetime import date

from yokin_chosa.models import (
    AccountType,
    BankAccount,
    FlagReason,
    FlaggedTransaction,
    HolderType,
    InvestigationCase,
    Transaction,
    VerificationResult,
)


def test_transaction_amount():
    tx_deposit = Transaction(
        account_id="a1", date=date(2024, 1, 1), deposit=1_000_000
    )
    assert tx_deposit.amount == 1_000_000
    assert tx_deposit.abs_amount == 1_000_000
    assert tx_deposit.is_deposit is True
    assert tx_deposit.is_withdrawal is False

    tx_withdrawal = Transaction(
        account_id="a1", date=date(2024, 1, 1), withdrawal=500_000
    )
    assert tx_withdrawal.amount == -500_000
    assert tx_withdrawal.abs_amount == 500_000
    assert tx_withdrawal.is_deposit is False
    assert tx_withdrawal.is_withdrawal is True


def test_bank_account_display_name():
    acc = BankAccount(
        bank_name="三菱UFJ銀行",
        account_type=AccountType.ORDINARY,
        account_number="1234567",
        account_holder="田中太郎",
    )
    assert acc.display_name == "三菱UFJ銀行 普通 1234567"


def test_investigation_case_dates():
    case = InvestigationCase(
        decedent_name="田中太郎",
        date_of_death=date(2026, 1, 15),
        investigation_period_years=5,
    )
    assert case.investigation_start_date == date(2021, 1, 15)


def test_investigation_case_account_filtering():
    dec_acc = BankAccount(
        bank_name="A銀行",
        account_number="111",
        account_holder="太郎",
        holder_type=HolderType.DECEDENT,
    )
    heir_acc = BankAccount(
        bank_name="B銀行",
        account_number="222",
        account_holder="花子",
        holder_type=HolderType.HEIR,
    )
    case = InvestigationCase(
        decedent_name="太郎",
        date_of_death=date(2026, 1, 1),
        accounts=[dec_acc, heir_acc],
    )
    assert len(case.decedent_accounts) == 1
    assert len(case.heir_accounts) == 1
    assert case.decedent_accounts[0].account_holder == "太郎"


def test_flagged_transaction_defaults():
    tx = Transaction(account_id="a1", date=date(2024, 1, 1), withdrawal=1_000_000)
    flagged = FlaggedTransaction(
        transaction=tx, flag_reasons=[FlagReason.LARGE_WITHDRAWAL]
    )
    assert flagged.verification_result == VerificationResult.NEEDS_CONFIRMATION
    assert flagged.matched_transaction_id is None
