"""
仕訳判定エンジン
ルールブック・マスタを参照して、取引データから仕訳を自動判定する
"""
import math
from .pdf_reader import BankTransaction, InvoiceData, PayrollEntry
from .csv_exporter import JournalEntry
from .rulebook import Rulebook
from .master import MasterData


class JournalEngine:
    """仕訳判定の中核エンジン"""

    def __init__(self, rulebook: Rulebook, master: MasterData):
        self.rulebook = rulebook
        self.master = master
        self.confirmed = []     # 確定仕訳
        self.review_items = []  # 要確認リスト

    def process_bank_transactions(self, transactions: list):
        """
        通帳取引リストを処理して仕訳を生成

        処理フロー（ルールブックのセクション0準拠）:
        1. カタカナ→正式摘要に変換
        2. 口座+出入+摘要で科目を特定
        3. 源泉税対象なら諸口仕訳
        4. 借入金返済なら諸口仕訳
        5. いずれも不一致→174仮払金（要確認）
        """
        for tx in transactions:
            entries = self._process_single_bank_tx(tx)
            if entries:
                self.confirmed.extend(entries)

    def _process_single_bank_tx(self, tx: BankTransaction):
        """通帳取引1件を仕訳に変換"""
        # STEP1: カタカナ→正式摘要変換
        formal_tekiyo = self.rulebook.lookup_tekiyo(tx.tekiyo)

        # 出入金の方向
        direction = "出金" if tx.withdrawal > 0 else "入金"
        amount = tx.withdrawal if tx.withdrawal > 0 else tx.deposit

        # 銀行口座の情報
        bank_info = {
            "account_code": tx.bank_code,
            "account_name": self.master.get_account_name(tx.bank_code),
            "sub_code": "",
            "sub_name": "",
        }

        # STEP2: ルールブックから仕訳パターンを検索
        pattern = self.rulebook.lookup_pattern(formal_tekiyo, direction, tx.bank_code, amount)

        # STEP3: 源泉税対象チェック
        if self.rulebook.is_withholding_target(formal_tekiyo):
            return self._create_withholding_entries(tx, formal_tekiyo, bank_info, amount)

        # STEP4: 借入金返済チェック
        loan = self._check_loan_repayment(formal_tekiyo, amount)
        if loan:
            return self._create_loan_entries(tx, formal_tekiyo, bank_info, loan)

        # STEP5: 通常パターン一致
        if pattern:
            counterpart_info = {
                "account_code": pattern["account_code"],
                "account_name": pattern.get("account_name",
                                            self.master.get_account_name(pattern["account_code"])),
                "sub_code": pattern.get("sub_code", ""),
                "sub_name": pattern.get("sub_name",
                                        self.master.get_sub_account_name(
                                            pattern["account_code"],
                                            pattern.get("sub_code", ""))),
                "tax": pattern.get("tax", {}),
            }

            if direction == "出金":
                entry = JournalEntry.from_bank_transaction(
                    tx, debit_info=counterpart_info, credit_info=bank_info,
                    tekiyo=formal_tekiyo,
                )
            else:
                entry = JournalEntry.from_bank_transaction(
                    tx, debit_info=bank_info, credit_info=counterpart_info,
                    tekiyo=formal_tekiyo,
                )
            entry.confidence = "high"
            return [entry]

        # STEP6: 不一致 → 174仮払金 + 要確認リストに追加
        self.review_items.append({
            "date": tx.date,
            "tekiyo": formal_tekiyo,
            "amount": amount,
            "direction": direction,
            "reason": "ルールブックに一致するパターンなし",
        })

        fallback_info = {
            "account_code": "174",
            "account_name": "仮払金",
            "sub_code": "",
            "sub_name": "",
        }

        if direction == "出金":
            entry = JournalEntry.from_bank_transaction(
                tx, debit_info=fallback_info, credit_info=bank_info,
                tekiyo=formal_tekiyo,
            )
        else:
            entry = JournalEntry.from_bank_transaction(
                tx, debit_info=bank_info, credit_info=fallback_info,
                tekiyo=formal_tekiyo,
            )
        entry.confidence = "low"
        return [entry]

    def _create_withholding_entries(self, tx, tekiyo, bank_info, amount):
        """源泉税対象の諸口仕訳を生成（報酬 + 預り金 + 消費税）"""
        entries = []

        # 簡易計算（10%税率の場合）
        # 支払額 = 報酬(税込) - 源泉所得税
        # 源泉所得税 = 報酬(税抜) × 10.21%
        # 報酬(税込) = 報酬(税抜) × 1.1
        # → 報酬(税抜) = 支払額 / (1.1 - 0.1021) = 支払額 / 0.9979
        tax_excl = math.floor(amount / 0.9979)
        tax_amount = math.floor(tax_excl * 0.1)
        withholding_tax = math.floor(tax_excl * 0.1021)
        gross = tax_excl + tax_amount

        # 実際の源泉税額で再計算（支払額 = gross - withholding_tax）
        # 誤差が出る場合があるので、支払額に合わせて調整
        if gross - withholding_tax != amount:
            # 諸口仕訳のため、貸方合計=借方合計にする
            gross = amount + withholding_tax

        # 借方: 報酬（997諸口）
        entry1 = JournalEntry()
        entry1.date = tx.date
        entry1.debit_code = "997"
        entry1.debit_name = "諸口"
        entry1.debit_amount = gross
        entry1.credit_code = "997"
        entry1.credit_name = "諸口"
        entry1.credit_amount = gross
        entry1.tekiyo = tekiyo
        entry1.confidence = "medium"
        entries.append(entry1)

        # 貸方: 預り金（源泉所得税）
        entry2 = JournalEntry()
        entry2.date = tx.date
        entry2.debit_code = "997"
        entry2.debit_name = "諸口"
        entry2.debit_amount = withholding_tax
        entry2.credit_code = "323"
        entry2.credit_name = "預り金"
        entry2.credit_sub_code = "1"
        entry2.credit_sub_name = "源泉所得税"
        entry2.credit_amount = withholding_tax
        entry2.tekiyo = tekiyo + " 源泉"
        entry2.confidence = "medium"
        entries.append(entry2)

        # 貸方: 銀行口座（実際の支払額）
        entry3 = JournalEntry()
        entry3.date = tx.date
        entry3.debit_code = "997"
        entry3.debit_name = "諸口"
        entry3.debit_amount = amount
        entry3.credit_code = bank_info["account_code"]
        entry3.credit_name = bank_info["account_name"]
        entry3.credit_amount = amount
        entry3.tekiyo = tekiyo
        entry3.confidence = "medium"
        entries.append(entry3)

        self.review_items.append({
            "date": tx.date,
            "tekiyo": tekiyo,
            "amount": amount,
            "direction": "出金",
            "reason": "源泉税対象（諸口仕訳を自動生成。報酬科目・金額の確認が必要）",
        })

        return entries

    def _check_loan_repayment(self, tekiyo, amount):
        """借入金返済パターンに一致するかチェック"""
        for lp in self.rulebook.loan_patterns.values():
            best_tek = max(lp["tekiyo_map"], key=lp["tekiyo_map"].get)
            if best_tek in tekiyo or tekiyo in best_tek:
                return lp
            # 金額での照合
            if amount in lp["amounts"] or (lp["amounts"] and abs(amount - lp["amounts"][-1]) < 100):
                return lp
        return None

    def _create_loan_entries(self, tx, tekiyo, bank_info, loan):
        """借入金返済の諸口仕訳を生成"""
        entries = []
        principal = tx.withdrawal  # 元本（利息は別途手動確認が必要）

        # 借方: 借入金返済
        entry1 = JournalEntry()
        entry1.date = tx.date
        entry1.debit_code = loan["code"]
        entry1.debit_name = loan["name"]
        entry1.debit_sub_code = loan.get("sub_code", "")
        entry1.debit_sub_name = loan.get("sub_name", "")
        entry1.debit_amount = principal
        entry1.credit_code = bank_info["account_code"]
        entry1.credit_name = bank_info["account_name"]
        entry1.credit_amount = principal
        entry1.tekiyo = tekiyo
        entry1.confidence = "medium"
        entries.append(entry1)

        self.review_items.append({
            "date": tx.date,
            "tekiyo": tekiyo,
            "amount": principal,
            "direction": "出金",
            "reason": "借入金返済（元本・利息の内訳確認が必要）",
        })

        return entries

    def process_invoices(self, invoices: list):
        """請求書データを処理して売上仕訳を生成"""
        for inv in invoices:
            entry = JournalEntry()
            entry.date = inv.date
            entry.debit_code = "150"  # 売掛金（デフォルト）
            entry.debit_name = "売掛金"
            entry.debit_amount = inv.total_amount
            entry.credit_code = "400"  # 売上高（デフォルト）
            entry.credit_name = "売上高"
            entry.credit_amount = inv.total_amount
            entry.tekiyo = f"{inv.vendor} 請求"

            # 消費税設定
            if inv.tax_amount > 0:
                entry.credit_tax_sales = "1"
                entry.credit_tax_type = "0"  # 税込
                entry.credit_tax_code = "10"
                entry.credit_tax_rate = "10"
                entry.credit_tax_amount = inv.tax_amount
                if self.master.is_invoice_issuer():
                    entry.credit_biz_type = "1"

            entry.confidence = "medium"
            self.confirmed.append(entry)

            self.review_items.append({
                "date": inv.date,
                "tekiyo": f"{inv.vendor} 請求",
                "amount": inv.total_amount,
                "direction": "売上",
                "reason": "請求書から自動生成（科目・税率の確認が必要）",
            })

    def process_payroll(self, payroll_entries: list, pay_date=""):
        """
        賃金台帳から給与仕訳を生成

        給与仕訳は複数行の諸口仕訳になる:
        借方: 給料手当、法定福利費（会社負担分）
        貸方: 預り金（源泉所得税、住民税、社保）、普通預金
        """
        for pe in payroll_entries:
            date = pay_date or pe.period

            # 借方: 給料手当
            if pe.total_pay > 0:
                entry = JournalEntry()
                entry.date = date
                entry.debit_code = "510"
                entry.debit_name = "給料手当"
                entry.debit_amount = pe.total_pay
                entry.credit_code = "997"
                entry.credit_name = "諸口"
                entry.credit_amount = pe.total_pay
                entry.tekiyo = f"給与 {pe.employee_name}"
                entry.confidence = "medium"
                self.confirmed.append(entry)

            # 貸方: 源泉所得税
            if pe.income_tax > 0:
                entry = JournalEntry()
                entry.date = date
                entry.debit_code = "997"
                entry.debit_name = "諸口"
                entry.debit_amount = pe.income_tax
                entry.credit_code = "323"
                entry.credit_name = "預り金"
                entry.credit_sub_code = "1"
                entry.credit_sub_name = "源泉所得税"
                entry.credit_amount = pe.income_tax
                entry.tekiyo = f"給与 {pe.employee_name} 源泉"
                entry.confidence = "medium"
                self.confirmed.append(entry)

            # 貸方: 住民税
            if pe.resident_tax > 0:
                entry = JournalEntry()
                entry.date = date
                entry.debit_code = "997"
                entry.debit_name = "諸口"
                entry.debit_amount = pe.resident_tax
                entry.credit_code = "323"
                entry.credit_name = "預り金"
                entry.credit_sub_code = "2"
                entry.credit_sub_name = "住民税"
                entry.credit_amount = pe.resident_tax
                entry.tekiyo = f"給与 {pe.employee_name} 住民税"
                entry.confidence = "medium"
                self.confirmed.append(entry)

            # 貸方: 社会保険料
            social_ins = pe.health_ins + pe.pension + pe.employment_ins
            if social_ins > 0:
                entry = JournalEntry()
                entry.date = date
                entry.debit_code = "997"
                entry.debit_name = "諸口"
                entry.debit_amount = social_ins
                entry.credit_code = "323"
                entry.credit_name = "預り金"
                entry.credit_sub_code = "3"
                entry.credit_sub_name = "社会保険"
                entry.credit_amount = social_ins
                entry.tekiyo = f"給与 {pe.employee_name} 社保"
                entry.confidence = "medium"
                self.confirmed.append(entry)

            # 貸方: 差引支給額（銀行振込）
            if pe.net_pay > 0:
                entry = JournalEntry()
                entry.date = date
                entry.debit_code = "997"
                entry.debit_name = "諸口"
                entry.debit_amount = pe.net_pay
                entry.credit_code = "131"
                entry.credit_name = "普通預金"
                entry.credit_amount = pe.net_pay
                entry.tekiyo = f"給与 {pe.employee_name} 振込"
                entry.confidence = "medium"
                self.confirmed.append(entry)

            self.review_items.append({
                "date": date,
                "tekiyo": f"給与 {pe.employee_name}",
                "amount": pe.total_pay,
                "direction": "給与",
                "reason": "賃金台帳から自動生成（社保率・科目コードの確認が必要）",
            })

    def get_results(self):
        """処理結果を返す"""
        return {
            "confirmed": self.confirmed,
            "review_items": self.review_items,
            "stats": {
                "total": len(self.confirmed),
                "high_confidence": sum(1 for e in self.confirmed if e.confidence == "high"),
                "medium_confidence": sum(1 for e in self.confirmed if e.confidence == "medium"),
                "low_confidence": sum(1 for e in self.confirmed if e.confidence == "low"),
                "review_count": len(self.review_items),
            },
        }
