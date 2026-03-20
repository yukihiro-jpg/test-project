"""
マスタ管理モジュール
顧問先ごとの科目リスト・補助科目・消費税コード等を読み込み・管理する
"""
import csv
import os
import json


class マスタデータ:
    """顧問先のマスタデータを保持するクラス"""

    def __init__(self, 顧問先パス):
        self.顧問先パス = 顧問先パス
        self.マスタパス = os.path.join(顧問先パス, "マスタ")
        self.科目一覧 = {}        # コード → 科目名
        self.補助科目一覧 = {}    # "科目コード-補助コード" → 補助名
        self.消費税設定 = {}      # 科目コード → 消費税設定dict
        self.税率一覧 = {}        # 税率コード → 税率情報
        self.事業者情報 = {}      # 事業者区分情報
        self._全読み込み()

    def _全読み込み(self):
        """マスタフォルダ内のCSVを自動読み込み"""
        if not os.path.isdir(self.マスタパス):
            os.makedirs(self.マスタパス, exist_ok=True)
            return

        for ファイル名 in os.listdir(self.マスタパス):
            ファイルパス = os.path.join(self.マスタパス, ファイル名)
            if ファイル名.endswith(".csv"):
                self._CSV読み込み(ファイル名, ファイルパス)
            elif ファイル名 == "事業者情報.json":
                self._事業者情報読み込み(ファイルパス)

    def _CSV行読み込み(self, ファイルパス):
        """Shift_JIS/UTF-8を自動判定してCSV読み込み"""
        for 文字コード in ["cp932", "utf-8-sig", "utf-8"]:
            try:
                with open(ファイルパス, "r", encoding=文字コード) as f:
                    return list(csv.reader(f))
            except (UnicodeDecodeError, UnicodeError):
                continue
        return []

    def _CSV読み込み(self, ファイル名, ファイルパス):
        """ファイル名から種別を判定して読み込み"""
        行一覧 = self._CSV行読み込み(ファイルパス)
        if not 行一覧:
            return

        if "科目リスト" in ファイル名 or "勘定科目" in ファイル名:
            self._科目リスト解析(行一覧)
        elif "補助科目" in ファイル名:
            self._補助科目解析(行一覧)
        elif "消費税コード" in ファイル名 or "税コード" in ファイル名:
            self._消費税コード解析(行一覧)
        elif "消費税率" in ファイル名 or "税率" in ファイル名:
            self._税率解析(行一覧)

    def _科目リスト解析(self, 行一覧):
        """科目リスト: [コード, 科目名, ...]"""
        for 行 in 行一覧:
            if len(行) >= 2 and 行[0].strip().isdigit():
                self.科目一覧[行[0].strip()] = 行[1].strip()

    def _補助科目解析(self, 行一覧):
        """補助科目リスト: [科目コード, 補助コード, 補助名, ...]"""
        for 行 in 行一覧:
            if len(行) >= 3 and 行[0].strip().isdigit():
                キー = f"{行[0].strip()}-{行[1].strip()}"
                self.補助科目一覧[キー] = 行[2].strip()

    def _消費税コード解析(self, 行一覧):
        """消費税コード: [科目コード, 税売仕, 業種, 税込抜, 税コード, 税率, 事業者]"""
        for 行 in 行一覧:
            if len(行) >= 7 and 行[0].strip().isdigit():
                コード = 行[0].strip()
                self.消費税設定[コード] = {
                    "税売仕": 行[1].strip(), "業種": 行[2].strip(),
                    "税込抜": 行[3].strip(), "税コード": 行[4].strip(),
                    "税率": 行[5].strip(), "事業者": 行[6].strip(),
                }

    def _税率解析(self, 行一覧):
        """消費税率コード: [税率コード, 税率名, 税率%]"""
        for 行 in 行一覧:
            if len(行) >= 2:
                self.税率一覧[行[0].strip()] = 行[1].strip()

    def _事業者情報読み込み(self, ファイルパス):
        """事業者情報JSON"""
        with open(ファイルパス, "r", encoding="utf-8") as f:
            self.事業者情報 = json.load(f)

    def 科目名取得(self, コード):
        return self.科目一覧.get(コード, "")

    def 補助科目名取得(self, 科目コード, 補助コード):
        return self.補助科目一覧.get(f"{科目コード}-{補助コード}", "")

    def 消費税設定取得(self, 科目コード):
        return self.消費税設定.get(科目コード, None)

    def 銀行口座判定(self, コード):
        """銀行口座かどうかを判定"""
        科目名 = self.科目一覧.get(コード, "")
        if any(語 in 科目名 for 語 in ["預金", "当座", "銀行", "信金", "信用", "ゆうちょ", "農協", "JA"]):
            return True
        if any(語 in 科目名 for 語 in ["普通", "定期", "定積"]):
            return True
        コード数値 = int(コード) if コード.isdigit() else 0
        if 130 <= コード数値 <= 139:
            return True
        return False

    def インボイス事業者判定(self):
        """インボイス発行事業者かどうか"""
        return self.事業者情報.get("インボイス事業者", True)

    def 過去仕訳からマスタ構築(self, 仕訳行一覧):
        """過去仕訳CSVからマスタを自動構築（マスタCSVがない場合のフォールバック）"""
        for 行 in 仕訳行一覧:
            if len(行) < 26:
                continue
            借方コード, 借方名 = 行[1].strip(), 行[2].strip()
            借方補助コード, 借方補助名 = 行[3].strip(), 行[4].strip()
            貸方コード, 貸方名 = 行[13].strip(), 行[14].strip()
            貸方補助コード, 貸方補助名 = 行[15].strip(), 行[16].strip()

            if 借方コード and 借方名:
                self.科目一覧[借方コード] = 借方名
            if 貸方コード and 貸方名:
                self.科目一覧[貸方コード] = 貸方名
            if 借方コード and 借方補助コード and 借方補助名:
                self.補助科目一覧[f"{借方コード}-{借方補助コード}"] = 借方補助名
            if 貸方コード and 貸方補助コード and 貸方補助名:
                self.補助科目一覧[f"{貸方コード}-{貸方補助コード}"] = 貸方補助名

            # 消費税設定も収集
            for _, 列群 in [("借方", 行[1:13]), ("貸方", 行[13:25])]:
                コード = 列群[0].strip()
                if コード and コード != "997" and コード not in self.消費税設定:
                    税売仕 = 列群[4].strip()
                    if 税売仕 != "0" or 列群[6].strip() != "0":
                        self.消費税設定[コード] = {
                            "税売仕": 税売仕, "業種": 列群[5].strip(),
                            "税込抜": 列群[6].strip(), "税コード": 列群[9].strip(),
                            "税率": 列群[10].strip(), "事業者": 列群[11].strip(),
                        }
