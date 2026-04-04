"""データモデル定義"""

from __future__ import annotations

import uuid
from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AccountType(str, Enum):
    """口座種別"""
    ORDINARY = "普通"
    FIXED = "定期"
    SAVINGS = "貯蓄"
    CURRENT = "当座"


class HolderType(str, Enum):
    """口座名義区分"""
    DECEDENT = "被相続人"
    HEIR = "相続人"
    FAMILY = "親族"


class FlagReason(str, Enum):
    """フラグ理由"""
    LARGE_DEPOSIT = "高額入金"
    LARGE_WITHDRAWAL = "高額出金"
    NOMINAL_SUSPECT = "名義預金疑い"
    REGULAR_TRANSFER = "定期的振込"
    ROUND_NUMBER = "端数なし"
    DEATH_PROXIMITY = "相続開始直前"


class VerificationResult(str, Enum):
    """検証結果"""
    FUND_TRANSFER = "資金移動"
    NEEDS_CONFIRMATION = "要確認"
    CONFIRMED = "確認済"
    NOMINAL_DEPOSIT_SUSPECT = "名義預金疑い"
    GIFT_TAX_ISSUE = "贈与税要検討"


class BankAccount(BaseModel):
    """銀行口座"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    bank_name: str
    branch_name: str = ""
    account_type: AccountType = AccountType.ORDINARY
    account_number: str
    account_holder: str
    holder_type: HolderType = HolderType.DECEDENT

    @property
    def display_name(self) -> str:
        return f"{self.bank_name} {self.account_type.value} {self.account_number}"


class Transaction(BaseModel):
    """取引"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    account_id: str
    date: date
    description: str = ""
    deposit: Optional[int] = None
    withdrawal: Optional[int] = None
    balance: Optional[int] = None

    @property
    def amount(self) -> int:
        """正=入金、負=出金"""
        if self.deposit is not None:
            return self.deposit
        if self.withdrawal is not None:
            return -self.withdrawal
        return 0

    @property
    def abs_amount(self) -> int:
        return abs(self.amount)

    @property
    def is_deposit(self) -> bool:
        return self.deposit is not None and self.deposit > 0

    @property
    def is_withdrawal(self) -> bool:
        return self.withdrawal is not None and self.withdrawal > 0


class FlaggedTransaction(BaseModel):
    """フラグ付き取引"""
    transaction: Transaction
    flag_reasons: list[FlagReason] = Field(default_factory=list)
    verification_result: VerificationResult = VerificationResult.NEEDS_CONFIRMATION
    matched_transaction_id: Optional[str] = None
    match_confidence: Optional[float] = None
    notes: str = ""


class Heir(BaseModel):
    """相続人"""
    name: str
    relationship: str  # 続柄: 配偶者, 長男, 長女, etc.
    accounts: list[BankAccount] = Field(default_factory=list)


class InvestigationCase(BaseModel):
    """調査案件"""
    case_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    decedent_name: str
    date_of_death: date
    investigation_period_years: int = 5
    threshold_amount: int = 500_000
    heirs: list[Heir] = Field(default_factory=list)
    accounts: list[BankAccount] = Field(default_factory=list)

    @property
    def investigation_start_date(self) -> date:
        """調査開始日（相続開始日からN年前）"""
        return self.date_of_death.replace(
            year=self.date_of_death.year - self.investigation_period_years
        )

    @property
    def decedent_accounts(self) -> list[BankAccount]:
        return [a for a in self.accounts if a.holder_type == HolderType.DECEDENT]

    @property
    def heir_accounts(self) -> list[BankAccount]:
        return [a for a in self.accounts if a.holder_type != HolderType.DECEDENT]


class NominalDepositFinding(BaseModel):
    """名義預金検出結果"""
    account: BankAccount
    evidence: list[str]
    total_suspected_amount: int = 0
    related_transactions: list[Transaction] = Field(default_factory=list)


class GiftTaxFinding(BaseModel):
    """贈与税チェック結果"""
    from_account_id: str
    to_heir_name: str
    year: int
    total_amount: int
    exceeds_exemption: bool
    transactions: list[Transaction] = Field(default_factory=list)
