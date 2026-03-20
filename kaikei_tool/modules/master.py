"""
マスタ管理モジュール
顧問先ごとの科目リスト・補助科目・消費税コード等を読み込み・管理する
"""
import csv
import os
import json


class MasterData:
    """顧問先のマスタデータを保持するクラス"""

    def __init__(self, client_dir):
        self.client_dir = client_dir
        self.master_dir = os.path.join(client_dir, "マスタ")
        self.accounts = {}        # コード → 科目名
        self.sub_accounts = {}    # "科目コード-補助コード" → 補助名
        self.tax_codes = {}       # 科目コード → 消費税設定dict
        self.tax_rates = {}       # 税率コード → 税率情報
        self.business_info = {}   # 事業者区分情報
        self._load_all()

    def _load_all(self):
        """マスタフォルダ内のCSVを自動読み込み"""
        if not os.path.isdir(self.master_dir):
            os.makedirs(self.master_dir, exist_ok=True)
            return

        for fname in os.listdir(self.master_dir):
            fpath = os.path.join(self.master_dir, fname)
            if fname.endswith(".csv"):
                self._load_csv(fname, fpath)
            elif fname == "事業者情報.json":
                self._load_business_info(fpath)

    def _read_csv_rows(self, fpath):
        """Shift_JIS/UTF-8を自動判定してCSV読み込み"""
        for enc in ["cp932", "utf-8-sig", "utf-8"]:
            try:
                with open(fpath, "r", encoding=enc) as f:
                    reader = csv.reader(f)
                    return list(reader)
            except (UnicodeDecodeError, UnicodeError):
                continue
        return []

    def _load_csv(self, fname, fpath):
        """ファイル名から種別を判定して読み込み"""
        rows = self._read_csv_rows(fpath)
        if not rows:
            return

        lower = fname.lower()
        if "科目リスト" in fname or "勘定科目" in fname:
            self._parse_accounts(rows)
        elif "補助科目" in fname:
            self._parse_sub_accounts(rows)
        elif "消費税コード" in fname or "税コード" in fname:
            self._parse_tax_codes(rows)
        elif "消費税率" in fname or "税率" in fname:
            self._parse_tax_rates(rows)

    def _parse_accounts(self, rows):
        """科目リスト: [コード, 科目名, ...]"""
        for row in rows:
            if len(row) >= 2 and row[0].strip().isdigit():
                self.accounts[row[0].strip()] = row[1].strip()

    def _parse_sub_accounts(self, rows):
        """補助科目リスト: [科目コード, 補助コード, 補助名, ...]"""
        for row in rows:
            if len(row) >= 3 and row[0].strip().isdigit():
                key = f"{row[0].strip()}-{row[1].strip()}"
                self.sub_accounts[key] = row[2].strip()

    def _parse_tax_codes(self, rows):
        """消費税コード: [科目コード, 税売仕, 業種, 税込抜, 税コード, 税率, 事業者]"""
        for row in rows:
            if len(row) >= 7 and row[0].strip().isdigit():
                code = row[0].strip()
                self.tax_codes[code] = {
                    "税売仕": row[1].strip(),
                    "業種": row[2].strip(),
                    "税込抜": row[3].strip(),
                    "税コード": row[4].strip(),
                    "税率": row[5].strip(),
                    "事業者": row[6].strip(),
                }

    def _parse_tax_rates(self, rows):
        """消費税率コード: [税率コード, 税率名, 税率%]"""
        for row in rows:
            if len(row) >= 2:
                self.tax_rates[row[0].strip()] = row[1].strip()

    def _load_business_info(self, fpath):
        """事業者情報JSON"""
        with open(fpath, "r", encoding="utf-8") as f:
            self.business_info = json.load(f)

    def get_account_name(self, code):
        return self.accounts.get(code, "")

    def get_sub_account_name(self, account_code, sub_code):
        return self.sub_accounts.get(f"{account_code}-{sub_code}", "")

    def get_tax_setting(self, account_code):
        return self.tax_codes.get(account_code, None)

    def is_bank_account(self, code):
        """銀行口座かどうかを判定"""
        name = self.accounts.get(code, "")
        if any(kw in name for kw in ["預金", "当座", "銀行", "信金", "信用", "ゆうちょ", "農協", "JA"]):
            return True
        if any(kw in name for kw in ["普通", "定期", "定積"]):
            return True
        code_num = int(code) if code.isdigit() else 0
        if 130 <= code_num <= 139:
            return True
        return False

    def is_invoice_issuer(self):
        """インボイス発行事業者かどうか"""
        return self.business_info.get("インボイス事業者", True)

    def build_from_past_journals(self, journal_rows):
        """過去仕訳CSVからマスタを自動構築（マスタCSVがない場合のフォールバック）"""
        for row in journal_rows:
            if len(row) < 26:
                continue
            d_code, d_name = row[1].strip(), row[2].strip()
            d_sub_code, d_sub_name = row[3].strip(), row[4].strip()
            c_code, c_name = row[13].strip(), row[14].strip()
            c_sub_code, c_sub_name = row[15].strip(), row[16].strip()

            if d_code and d_name:
                self.accounts[d_code] = d_name
            if c_code and c_name:
                self.accounts[c_code] = c_name
            if d_code and d_sub_code and d_sub_name:
                self.sub_accounts[f"{d_code}-{d_sub_code}"] = d_sub_name
            if c_code and c_sub_code and c_sub_name:
                self.sub_accounts[f"{c_code}-{c_sub_code}"] = c_sub_name

            # 消費税設定も収集
            for prefix, cols in [("借方", row[1:13]), ("貸方", row[13:25])]:
                code = cols[0].strip()
                if code and code != "997" and code not in self.tax_codes:
                    tax_s = cols[4].strip()
                    if tax_s != "0" or cols[6].strip() != "0":
                        self.tax_codes[code] = {
                            "税売仕": tax_s,
                            "業種": cols[5].strip(),
                            "税込抜": cols[6].strip(),
                            "税コード": cols[9].strip(),
                            "税率": cols[10].strip(),
                            "事業者": cols[11].strip(),
                        }
