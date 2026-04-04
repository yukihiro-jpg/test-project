"""テスト用フィクスチャ"""

from datetime import date

import pytest

from yokin_chosa.config import InvestigationConfig
from yokin_chosa.models import (
    AccountType,
    BankAccount,
    Heir,
    HolderType,
    InvestigationCase,
    Transaction,
)


@pytest.fixture
def config():
    return InvestigationConfig(
        investigation_period_years=5,
        threshold_amount=500_000,
        interbank_date_tolerance_days=3,
    )


@pytest.fixture
def decedent_account():
    return BankAccount(
        id="acc_dec1",
        bank_name="三菱UFJ銀行",
        branch_name="東京支店",
        account_type=AccountType.ORDINARY,
        account_number="1234567",
        account_holder="田中太郎",
        holder_type=HolderType.DECEDENT,
    )


@pytest.fixture
def decedent_account_2():
    return BankAccount(
        id="acc_dec2",
        bank_name="三井住友銀行",
        branch_name="新宿支店",
        account_type=AccountType.ORDINARY,
        account_number="7654321",
        account_holder="田中太郎",
        holder_type=HolderType.DECEDENT,
    )


@pytest.fixture
def heir_account():
    return BankAccount(
        id="acc_heir1",
        bank_name="みずほ銀行",
        branch_name="渋谷支店",
        account_type=AccountType.ORDINARY,
        account_number="9876543",
        account_holder="田中花子",
        holder_type=HolderType.HEIR,
    )


@pytest.fixture
def sample_case(decedent_account, decedent_account_2, heir_account):
    return InvestigationCase(
        case_id="test001",
        decedent_name="田中太郎",
        date_of_death=date(2026, 1, 15),
        investigation_period_years=5,
        threshold_amount=500_000,
        heirs=[
            Heir(
                name="田中花子",
                relationship="配偶者",
                accounts=[heir_account],
            ),
        ],
        accounts=[decedent_account, decedent_account_2, heir_account],
    )


@pytest.fixture
def sample_transactions(decedent_account, decedent_account_2, heir_account):
    """サンプル取引データ"""
    return {
        decedent_account.id: [
            # 銀行間資金移動（出金）
            Transaction(
                id="tx001",
                account_id=decedent_account.id,
                date=date(2024, 4, 1),
                description="振込 タナカタロウ",
                withdrawal=3_000_000,
                balance=10_000_000,
            ),
            # 不明な出金
            Transaction(
                id="tx002",
                account_id=decedent_account.id,
                date=date(2024, 5, 15),
                description="ATM出金",
                withdrawal=1_000_000,
                balance=9_000_000,
            ),
            # 贈与の可能性（110万円）
            Transaction(
                id="tx003",
                account_id=decedent_account.id,
                date=date(2024, 12, 25),
                description="振込 タナカハナコ",
                withdrawal=1_100_000,
                balance=7_900_000,
            ),
            # 相続開始直前の出金
            Transaction(
                id="tx004",
                account_id=decedent_account.id,
                date=date(2026, 1, 5),
                description="ATM出金",
                withdrawal=2_000_000,
                balance=5_900_000,
            ),
            # 閾値以下（フラグされない）
            Transaction(
                id="tx005",
                account_id=decedent_account.id,
                date=date(2024, 6, 1),
                description="振込 電気代",
                withdrawal=30_000,
                balance=8_970_000,
            ),
        ],
        decedent_account_2.id: [
            # 銀行間資金移動（入金）- tx001と対応
            Transaction(
                id="tx006",
                account_id=decedent_account_2.id,
                date=date(2024, 4, 1),
                description="振込入金",
                deposit=3_000_000,
                balance=5_000_000,
            ),
            # 通常の入金
            Transaction(
                id="tx007",
                account_id=decedent_account_2.id,
                date=date(2024, 7, 1),
                description="給与",
                deposit=800_000,
                balance=5_800_000,
            ),
        ],
        heir_account.id: [
            # 贈与の可能性（被相続人からの振込と対応）
            Transaction(
                id="tx008",
                account_id=heir_account.id,
                date=date(2024, 12, 25),
                description="振込入金",
                deposit=1_100_000,
                balance=2_100_000,
            ),
            # 別年度の同額振込（連年贈与の疑い）
            Transaction(
                id="tx009",
                account_id=heir_account.id,
                date=date(2023, 12, 20),
                description="振込入金",
                deposit=1_100_000,
                balance=1_000_000,
            ),
        ],
    }
