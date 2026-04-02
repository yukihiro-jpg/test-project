"""
売掛金消込エンジン

売上請求書で発生した売掛金を記憶し、通帳入金時に自動突合する。
- 完全一致 → 売掛金消込
- 手数料差引一致（〜1,100円） → 売掛金+手数料の複合仕訳
- 不一致 → 仮払金+メモ
"""
import json
import os
from datetime import datetime

from config import 振込手数料パターン


class 売掛金管理:
    """未消込売掛金の管理と入金突合"""

    def __init__(self, 顧問先パス):
        self.顧問先パス = 顧問先パス
        self.ARファイルパス = os.path.join(顧問先パス, "outstanding_ar.json")
        self.未消込一覧 = []
        self._読み込み()

    def _読み込み(self):
        """未消込売掛金リストを読み込み"""
        if os.path.isfile(self.ARファイルパス):
            with open(self.ARファイルパス, "r", encoding="utf-8") as f:
                self.未消込一覧 = json.load(f)
        else:
            self.未消込一覧 = []

    def _保存(self):
        """未消込売掛金リストを保存"""
        os.makedirs(os.path.dirname(self.ARファイルパス), exist_ok=True)
        with open(self.ARファイルパス, "w", encoding="utf-8") as f:
            json.dump(self.未消込一覧, f, ensure_ascii=False, indent=2)

    def 売掛金登録(self, 日付, 取引先名, 請求額, 消費税額=0, 摘要=""):
        """
        請求書処理時に売掛金を登録する

        引数:
            日付: YYYYMMDD
            取引先名: 取引先名
            請求額: 税込請求額
            消費税額: 消費税額
            摘要: 摘要テキスト
        """
        エントリ = {
            "id": f"{日付}_{取引先名}_{請求額}",
            "日付": 日付,
            "取引先名": 取引先名,
            "請求額": 請求額,
            "消費税額": 消費税額,
            "摘要": 摘要,
            "登録日時": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
            "消込済み": False,
        }
        # 重複チェック（同じID＝同日・同取引先・同額は登録済み）
        既存ID = {ar["id"] for ar in self.未消込一覧}
        if エントリ["id"] not in 既存ID:
            self.未消込一覧.append(エントリ)
            self._保存()
        return エントリ

    def 入金突合(self, 入金額, 入金摘要=""):
        """
        通帳入金額と未消込売掛金を突合する

        戻り値:
            dict: {
                "種別": "完全一致" | "手数料差引" | "不一致",
                "売掛金": 一致した売掛金エントリ or None,
                "手数料": 手数料額 (手数料差引時のみ),
                "メモ": 仕訳メモテキスト,
            }
        """
        未消込 = [ar for ar in self.未消込一覧 if not ar["消込済み"]]

        # STEP1: 完全一致を検索
        for ar in 未消込:
            if ar["請求額"] == 入金額:
                return {
                    "種別": "完全一致",
                    "売掛金": ar,
                    "手数料": 0,
                    "メモ": (f"売掛金消込 {ar['取引先名']} "
                             f"請求額{ar['請求額']:,}円と一致"),
                }

        # STEP2: 手数料差引を検索（差額が手数料パターンに該当するか）
        for ar in 未消込:
            差額 = ar["請求額"] - 入金額
            if 差額 > 0 and 差額 in 振込手数料パターン:
                return {
                    "種別": "手数料差引",
                    "売掛金": ar,
                    "手数料": 差額,
                    "メモ": (f"売掛金消込 {ar['取引先名']} "
                             f"請求額{ar['請求額']:,}円"
                             f"-手数料{差額:,}円"
                             f"=入金額{入金額:,}円"),
                }

        # STEP3: 入金摘要で部分一致を試みる（取引先名が摘要に含まれる場合）
        for ar in 未消込:
            if ar["取引先名"] and ar["取引先名"] in 入金摘要:
                差額 = ar["請求額"] - 入金額
                if 0 < 差額 <= 1100:
                    return {
                        "種別": "手数料差引",
                        "売掛金": ar,
                        "手数料": 差額,
                        "メモ": (f"売掛金消込 {ar['取引先名']} "
                                 f"請求額{ar['請求額']:,}円"
                                 f"-手数料{差額:,}円"
                                 f"=入金額{入金額:,}円"
                                 f"（※手数料が標準パターン外: {差額}円）"),
                    }

        # STEP4: 不一致
        return {
            "種別": "不一致",
            "売掛金": None,
            "手数料": 0,
            "メモ": f"★要確認★ 入金{入金額:,}円 該当する売掛金なし",
        }

    def 消込実行(self, 売掛金エントリ):
        """売掛金を消込済みにする"""
        for ar in self.未消込一覧:
            if ar["id"] == 売掛金エントリ["id"]:
                ar["消込済み"] = True
                ar["消込日時"] = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
                break
        self._保存()

    def 未消込件数(self):
        """未消込の売掛金件数"""
        return sum(1 for ar in self.未消込一覧 if not ar["消込済み"])

    def 未消込一覧取得(self):
        """未消込の売掛金リストを返す"""
        return [ar for ar in self.未消込一覧 if not ar["消込済み"]]
