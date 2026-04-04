"""設定モデル"""

from pydantic import BaseModel


class InvestigationConfig(BaseModel):
    """調査設定"""
    # 調査期間（年）
    investigation_period_years: int = 5
    # フラグ閾値（円）
    threshold_amount: int = 500_000
    # 銀行間マッチング日数許容範囲
    interbank_date_tolerance_days: int = 3
    # 贈与税基礎控除額（円）
    gift_tax_annual_exemption: int = 1_100_000
    # 相続開始直前期間（日）
    death_proximity_days: int = 30
    # 端数なし判定の最小金額（円）
    round_number_min_amount: int = 1_000_000


class AppConfig(BaseModel):
    """アプリケーション設定"""
    host: str = "127.0.0.1"
    port: int = 8756
    upload_dir: str = "uploads"
    debug: bool = False
