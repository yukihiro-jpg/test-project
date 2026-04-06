"""
ルールブック管理モジュール
GASのbuildDictionary()ロジックをPythonに移植。
過去仕訳CSVからルールブックを生成・更新する。
"""
import csv
import os
import re
from datetime import datetime
from collections import defaultdict


class ルールブック管理:
    """ルールブック辞書の生成・読み込み・更新を行うクラス"""

    最小出現回数 = 1  # この回数以上の摘要パターンのみ辞書化（初期は1で精度向上）

    def __init__(self, 顧問先パス):
        self.顧問先パス = 顧問先パス
        self.ルールブックパス = os.path.join(顧問先パス, "rulebook.txt")

        # 内部データ
        self.科目一覧 = {}           # コード → 科目名
        self.補助科目一覧 = {}       # "科目コード-補助コード" → 補助名
        self.カタカナ変換表 = {}      # カタカナ → 正式摘要（第1層）
        self.仕訳パターン = {}       # 仕訳パターン（第2層）
        self.源泉税対象先 = {}       # 源泉税対象取引先
        self.借入金パターン = {}     # 借入金返済パターン
        self.諸口仕訳実例 = []       # 諸口仕訳実例
        self.消費税初期値 = {}       # 消費税デフォルト
        self._第2層データ = {}       # フィルタ済み第2層

    def 読み込み(self):
        """既存ルールブックを読み込み"""
        if not os.path.isfile(self.ルールブックパス):
            return False
        with open(self.ルールブックパス, "r", encoding="utf-8-sig") as f:
            テキスト = f.read()
        self._ルールブック解析(テキスト)
        return True

    def _ルールブック解析(self, テキスト):
        """ルールブックテキストをパースして内部データに変換"""
        現在セクション番号 = -1
        for 行 in テキスト.split("\n"):
            行 = 行.strip()
            if 行.startswith("## "):
                # セクション番号で判定（日本語テキストに依存しない）
                for i in range(10):
                    if f"## {i}." in 行 or f"## {i} " in 行:
                        現在セクション番号 = i
                        break
                continue

            if 現在セクション番号 == 1:  # カタカナ→正式摘要
                if 行.startswith('"'):
                    部品 = self._CSV行解析(行)
                    if len(部品) >= 2:
                        self.カタカナ変換表[部品[0]] = 部品[1]

            elif 現在セクション番号 == 2:  # 仕訳パターン
                if 行.startswith("["):
                    pass  # 口座ヘッダー行はスキップ
                elif "→" in 行:
                    self._パターン行解析(行)

            elif 現在セクション番号 == 3:  # 源泉税対象
                if 行.startswith("- "):
                    self.源泉税対象先[行[2:].strip()] = True

            elif 現在セクション番号 == 6:  # 勘定科目マスタ
                部品 = 行.split(",", 1)
                if len(部品) == 2 and 部品[0].strip().isdigit():
                    self.科目一覧[部品[0].strip()] = 部品[1].strip()

            elif 現在セクション番号 == 8:  # 消費税デフォルト
                部品 = 行.split(",")
                if len(部品) >= 7 and 部品[0].strip().isdigit():
                    self.消費税初期値[部品[0].strip()] = {
                        "税売仕": 部品[1], "業種": 部品[2],
                        "税込抜": 部品[3], "税コード": 部品[4],
                        "税率": 部品[5], "事業者": 部品[6],
                    }

    def _パターン行解析(self, 行):
        """仕訳パターン行をパース"""
        if "→" not in 行:
            return
        # 金額分岐行（"金額xxx →"）はスキップ
        if 行.startswith("金額"):
            return
        部品 = 行.split("→", 1)
        摘要 = 部品[0].strip()
        対象 = 部品[1].strip()

        # "金額分岐:" の場合はスキップ
        if "金額分岐" in 対象:
            return

        m = re.match(r"(\d+)(?::(\d+))?\s*(?:税\(([^)]+)\))?", 対象)
        if m:
            # 消費税データを文字列→辞書に変換
            税データ = {}
            if m.group(3):
                税部品 = m.group(3).split(",")
                if len(税部品) >= 6:
                    税データ = {
                        "ts": 税部品[0], "gy": 税部品[1], "tt": 税部品[2],
                        "tc": 税部品[3], "tr": 税部品[4], "bt": 税部品[5],
                    }
            self.仕訳パターン[摘要] = {
                "科目コード": m.group(1),
                "補助コード": m.group(2) or "",
                "消費税": 税データ,
            }

    def _CSV行解析(self, 行):
        """CSVの1行をパース（ダブルクォート対応）"""
        結果 = []
        現在 = ""
        引用符内 = False
        for 文字 in 行:
            if 引用符内:
                if 文字 == '"':
                    引用符内 = False
                else:
                    現在 += 文字
            else:
                if 文字 == '"':
                    引用符内 = True
                elif 文字 == ',':
                    結果.append(現在)
                    現在 = ""
                else:
                    現在 += 文字
        結果.append(現在)
        return 結果

    def 過去仕訳から生成(self, 仕訳CSVパス, 通帳取引一覧=None):
        """
        過去仕訳CSVからルールブックを新規生成。
        GASのbuildDictionary()をPythonに移植。
        """
        行一覧 = self._仕訳CSV読み込み(仕訳CSVパス)
        if not 行一覧:
            return False

        摘要集計 = defaultdict(int)
        第2層 = {}
        源泉摘要集計 = defaultdict(int)
        借入パターン = {}
        諸口グループ = defaultdict(list)
        科目別消費税 = defaultdict(lambda: defaultdict(lambda: {"回数": 0}))

        for 行 in 行一覧:
            if len(行) < 26:
                continue

            日付 = 行[0].strip()
            借コード, 借名 = 行[1].strip(), 行[2].strip()
            借補コード, 借補名 = 行[3].strip(), 行[4].strip()
            借税売仕, 借業種, 借税込抜 = 行[5].strip(), 行[6].strip(), 行[7].strip()
            借金額文字列 = 行[8].strip()
            借税コード, 借税率, 借事業者 = 行[10].strip(), 行[11].strip(), 行[12].strip()
            貸コード, 貸名 = 行[13].strip(), 行[14].strip()
            貸補コード, 貸補名 = 行[15].strip(), 行[16].strip()
            貸税売仕, 貸業種, 貸税込抜 = 行[17].strip(), 行[18].strip(), 行[19].strip()
            貸税コード, 貸税率, 貸事業者 = 行[22].strip(), 行[23].strip(), 行[24].strip()
            摘要 = 行[25].strip()
            金額 = int(re.sub(r"[,\s]", "", 借金額文字列) or "0")

            # 科目マスタ
            if 借コード and 借名:
                self.科目一覧[借コード] = 借名
            if 貸コード and 貸名:
                self.科目一覧[貸コード] = 貸名
            if 借コード and 借補コード and 借補名:
                self.補助科目一覧[f"{借コード}-{借補コード}"] = 借補名
            if 貸コード and 貸補コード and 貸補名:
                self.補助科目一覧[f"{貸コード}-{貸補コード}"] = 貸補名

            if 摘要:
                摘要集計[摘要] += 1

            # 消費税パターン
            for コード, ts, gy, tt, tc, tr, bt in [
                (借コード, 借税売仕, 借業種, 借税込抜, 借税コード, 借税率, 借事業者),
                (貸コード, 貸税売仕, 貸業種, 貸税込抜, 貸税コード, 貸税率, 貸事業者),
            ]:
                if コード and コード != "997":
                    税キー = f"{ts}|{gy}|{tt}|{tc}|{tr}|{bt}"
                    項目 = 科目別消費税[コード][税キー]
                    項目["回数"] += 1
                    項目.update({"ts": ts, "gy": gy, "tt": tt, "tc": tc, "tr": tr, "bt": bt})

            # 源泉税対象
            if 貸コード == "323" and 貸補コード == "1" and 摘要:
                基本摘要 = self._摘要正規化(摘要)
                if 基本摘要 and not any(語 in 基本摘要 for 語 in ["住民税", "所得税", "賞与", "給与", "給料"]):
                    源泉摘要集計[基本摘要] += 1

            # 諸口パターン
            if 借コード == "997" or 貸コード == "997":
                グループキー = f"{日付}|{self._摘要正規化(摘要)}"
                諸口グループ[グループキー].append({
                    "dc": 借コード, "dn": 借名, "dsc": 借補コード, "dsn": 借補名,
                    "dts": 借税売仕, "dgy": 借業種, "dtt": 借税込抜,
                    "dtc": 借税コード, "dtr": 借税率, "dbt": 借事業者,
                    "cc": 貸コード, "cn": 貸名, "csc": 貸補コード, "csn": 貸補名,
                    "cts": 貸税売仕, "cgy": 貸業種, "ctt": 貸税込抜,
                    "ctc": 貸税コード, "ctr": 貸税率, "cbt": 貸事業者,
                    "amt": 金額, "tek": 摘要,
                })

            # 借入金返済
            if 借コード and 借コード.isdigit() and 340 <= int(借コード) <= 360 and 金額 > 0:
                借入キー = f"{借コード}|{借補コード}"
                if 借入キー not in 借入パターン:
                    借入パターン[借入キー] = {
                        "コード": 借コード, "科目名": 借名,
                        "補助コード": 借補コード, "補助名": 借補名,
                        "摘要集計": defaultdict(int), "金額一覧": [], "回数": 0,
                    }
                借入パターン[借入キー]["金額一覧"].append(金額)
                借入パターン[借入キー]["回数"] += 1
                借入パターン[借入キー]["摘要集計"][摘要] += 1

            # 第2層：銀行口座関連
            if 金額 > 0 and 貸コード and 貸コード != "997":
                l2キー = f"{貸コード}|出金|{摘要}"
                if l2キー not in 第2層:
                    第2層[l2キー] = {"bank": 貸コード, "dir": "出金", "tek": 摘要, "cnt": 0, "ac_map": {}}
                第2層[l2キー]["cnt"] += 1
                acキー = f"{借コード}|{借補コード}"
                if acキー not in 第2層[l2キー]["ac_map"]:
                    第2層[l2キー]["ac_map"][acキー] = {
                        "ac": 借コード, "an": 借名, "asc": 借補コード, "asn": 借補名,
                        "ts": 借税売仕, "gy": 借業種, "tt": 借税込抜,
                        "tc": 借税コード, "tr": 借税率, "bt": 借事業者,
                        "amounts": defaultdict(int),
                    }
                第2層[l2キー]["ac_map"][acキー]["amounts"][金額] += 1

            if 金額 > 0 and 借コード and 借コード != "997":
                l2キー = f"{借コード}|入金|{摘要}"
                if l2キー not in 第2層:
                    第2層[l2キー] = {"bank": 借コード, "dir": "入金", "tek": 摘要, "cnt": 0, "ac_map": {}}
                第2層[l2キー]["cnt"] += 1
                acキー = f"{貸コード}|{貸補コード}"
                if acキー not in 第2層[l2キー]["ac_map"]:
                    第2層[l2キー]["ac_map"][acキー] = {
                        "ac": 貸コード, "an": 貸名, "asc": 貸補コード, "asn": 貸補名,
                        "ts": 貸税売仕, "gy": 貸業種, "tt": 貸税込抜,
                        "tc": 貸税コード, "tr": 貸税率, "bt": 貸事業者,
                        "amounts": defaultdict(int),
                    }
                第2層[l2キー]["ac_map"][acキー]["amounts"][金額] += 1

        # --- 保存用データを構築 ---
        self.源泉税対象先 = dict(源泉摘要集計)
        self.借入金パターン = {k: v for k, v in 借入パターン.items() if v["回数"] >= 2}
        self.消費税初期値 = {}
        for 科目コード, 税パターン辞書 in 科目別消費税.items():
            if 科目コード.isdigit() and int(科目コード) >= 400:
                最多 = max(税パターン辞書.values(), key=lambda x: x["回数"])
                if 最多.get("ts", "0") != "0" or 最多.get("tt", "0") != "0":
                    self.消費税初期値[科目コード] = 最多

        # カタカナ→正式摘要マッピング
        if 通帳取引一覧:
            self._カタカナ変換表構築(行一覧, 通帳取引一覧)

        # 第2層フィルタリング
        self._第2層データ = {}
        for キー, l2 in 第2層.items():
            if self._銀行口座判定(l2["bank"]) and l2["cnt"] >= self.最小出現回数:
                有効 = {k: v for k, v in l2["ac_map"].items() if v["ac"] != "997"}
                if 有効:
                    l2["ac_map"] = 有効
                    self._第2層データ[キー] = l2

        # 諸口実例
        摘要別回数 = defaultdict(int)
        for キー, グループ in 諸口グループ.items():
            if len(グループ) >= 2:
                基本摘要 = self._摘要正規化(グループ[0]["tek"])
                摘要別回数[基本摘要] += 1
        使用済み = set()
        self.諸口仕訳実例 = []
        for キー, グループ in 諸口グループ.items():
            if len(グループ) >= 2:
                基本摘要 = self._摘要正規化(グループ[0]["tek"])
                if 摘要別回数[基本摘要] >= 2 and 基本摘要 not in 使用済み:
                    使用済み.add(基本摘要)
                    self.諸口仕訳実例.append({"key": キー, "rows": グループ})

        self._保存()
        return True

    def _カタカナ変換表構築(self, 仕訳行一覧, 通帳取引一覧):
        """通帳取引と仕訳CSVの日付+金額で突き合わせてカタカナマップを構築"""
        仕訳索引 = defaultdict(list)
        for 行 in 仕訳行一覧:
            if len(行) < 26:
                continue
            日付 = 行[0].strip()
            借コード = 行[1].strip()
            貸コード = 行[13].strip()
            金額 = int(re.sub(r"[,\s]", "", 行[8].strip()) or "0")
            摘要 = 行[25].strip()
            if not 摘要 or 借コード == "997" or 貸コード == "997":
                continue
            if 貸コード and self._銀行口座判定(貸コード):
                仕訳索引[f"{日付}|{金額}|{貸コード}"].append(摘要)
            if 借コード and self._銀行口座判定(借コード):
                仕訳索引[f"{日付}|{金額}|{借コード}"].append(摘要)

        使用済み = set()
        for 取引 in 通帳取引一覧:
            日付正規化 = re.sub(r"[/\-]", "", 取引.日付)
            if len(日付正規化) == 6:
                日付正規化 = "20" + 日付正規化
            金額 = 取引.出金額 if 取引.出金額 > 0 else 取引.入金額
            検索キー = f"{日付正規化}|{金額}|{取引.口座コード}"
            候補 = 仕訳索引.get(検索キー, [])
            if len(候補) == 1 and 取引.摘要 not in 使用済み:
                self.カタカナ変換表[取引.摘要] = 候補[0]
                使用済み.add(取引.摘要)

    def _保存(self):
        """ルールブックをテキストファイルに保存"""
        現在時刻 = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        行 = []
        行.append("# ルールブック辞書（スリム版 v2）")
        行.append(f"# 生成日時: {現在時刻}")
        行.append(f"# 出現{self.最小出現回数}回以上のみ収録")
        行.append("")

        行.append("## 0. 処理フロー")
        行.append("1→セクション1で通帳カタカナを正式摘要に変換")
        行.append("2→セクション2で口座→出入→摘要名で科目を特定（金額分岐がある場合は金額で補助を確定）")
        行.append("3→セクション3で源泉税対象なら諸口仕訳")
        行.append("4→セクション4で借入金返済なら諸口仕訳")
        行.append("5→セクション5で諸口仕訳の組み立て方を確認")
        行.append("6→いずれも不一致→174仮払金")
        行.append("")

        if self.カタカナ変換表:
            行.append("## 1. カタカナ→正式摘要")
            行.append("カタカナ,正式摘要")
            for k in sorted(self.カタカナ変換表.keys()):
                kk = k.replace('"', '""')
                vv = self.カタカナ変換表[k].replace('"', '""')
                行.append(f'"{kk}","{vv}"')
            行.append("")
        else:
            行.append("## 1. カタカナ→正式摘要（通帳データ未登録のため未生成）")
            行.append("")

        行.append(f"## 2. 仕訳パターン（出現{self.最小出現回数}回以上）")
        使用コード = set()
        ソート済み = sorted(
            self._第2層データ.values(), key=lambda x: (x["bank"], x["dir"], x["tek"]))
        現在口座, 現在方向 = "", ""
        for lf in ソート済み:
            if lf["bank"] != 現在口座 or lf["dir"] != 現在方向:
                現在口座, 現在方向 = lf["bank"], lf["dir"]
                行.append(f'[{現在口座} {self.科目一覧.get(現在口座, "")} {現在方向}]')
            使用コード.add(lf["bank"])
            有効 = {k: v for k, v in lf["ac_map"].items() if v["ac"] != "997"}
            if len(有効) == 1:
                ac = list(有効.values())[0]
                使用コード.add(ac["ac"])
                補 = f':{ac["asc"]}' if ac["asc"] else ""
                税 = ""
                if ac["ts"] != "0" or ac["tt"] != "0" or ac["tc"] or ac["tr"]:
                    税 = f' 税({ac["ts"]},{ac["gy"]},{ac["tt"]},{ac["tc"]},{ac["tr"]},{ac["bt"]})'
                行.append(f"  {lf['tek']} → {ac['ac']}{補}{税}")
            else:
                行.append(f"  {lf['tek']} →金額分岐:")
                for ac in 有効.values():
                    使用コード.add(ac["ac"])
                    補 = f':{ac["asc"]}' if ac["asc"] else ""
                    税 = ""
                    if ac["ts"] != "0" or ac["tt"] != "0" or ac["tc"] or ac["tr"]:
                        税 = f' 税({ac["ts"]},{ac["gy"]},{ac["tt"]},{ac["tc"]},{ac["tr"]},{ac["bt"]})'
                    金額群 = "/".join(str(a) for a in sorted(ac["amounts"].keys()))
                    行.append(f"    金額{金額群} → {ac['ac']}{補}{税}")
        行.append("")

        if self.源泉税対象先:
            行.append("## 3. 源泉税対象取引先")
            行.append("以下の取引先への出金は必ず諸口仕訳（報酬+預り金+消費税）で処理する")
            for v in sorted(self.源泉税対象先.keys()):
                行.append(f"- {v}")
            行.append("")

        if self.借入金パターン:
            行.append("## 4. 借入金返済パターン")
            行.append("科目コード,補助コード,補助名,摘要,直近金額,回数")
            for lp in self.借入金パターン.values():
                代表摘要 = max(lp["摘要集計"], key=lp["摘要集計"].get)
                直近金額 = lp["金額一覧"][-1]
                tek_escaped = 代表摘要.replace('"', '""')
                行.append(f'{lp["コード"]},{lp["補助コード"]},{lp["補助名"]},"{tek_escaped}",{直近金額},{lp["回数"]}')
                使用コード.add(lp["コード"])
            行.append("")

        if self.諸口仕訳実例:
            行.append(f"## 5. 諸口仕訳実例（{len(self.諸口仕訳実例)}件）")
            for 実例 in self.諸口仕訳実例:
                ラベル = 実例["key"].split("|", 1)[1] if "|" in 実例["key"] else 実例["key"]
                行.append(f"--- {ラベル} ---")
                for er in 実例["rows"]:
                    d部分 = er["dc"] + (f':{er["dsc"]}' if er["dsc"] else "")
                    c部分 = er["cc"] + (f':{er["csc"]}' if er["csc"] else "")
                    行.append(f'  借方:{d部分} {er["amt"]} / 貸方:{c部分}')
                    使用コード.add(er["dc"])
                    使用コード.add(er["cc"])
            行.append("")

        使用コード.add("997")
        使用コード.add("174")
        行.append("## 6. 勘定科目マスタ")
        行.append("コード,科目名")
        for コード in sorted(self.科目一覧.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            if コード in 使用コード:
                行.append(f"{コード},{self.科目一覧[コード]}")
        行.append("")

        行.append("## 8. 消費税デフォルト（セクション2に未収録の科目のみ）")
        行.append("科目コード,税売仕,業種,税込抜,税コード,税率,事業者")
        for コード in sorted(self.消費税初期値.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            td = self.消費税初期値[コード]
            行.append(f'{コード},{td.get("ts","0")},{td.get("gy","0")},{td.get("tt","0")},{td.get("tc","")},{td.get("tr","")},{td.get("bt","0")}')
        行.append("")

        テキスト = "\n".join(行)
        with open(self.ルールブックパス, "w", encoding="utf-8-sig") as f:
            f.write(テキスト)
        return テキスト

    def ルールブック更新(self, 新CSV):
        """新しい仕訳CSVでルールブックを更新（差分追加）
        科目マスタのみ追加更新する。
        _第2層データが空の場合（読み込みのみで再生成していない場合）は
        ファイルを上書きしない（セクション2のデータ消失を防止）。
        """
        行一覧 = self._仕訳CSV読み込み(新CSV)
        for 行 in 行一覧:
            if len(行) < 26:
                continue
            借コード, 借名 = 行[1].strip(), 行[2].strip()
            貸コード, 貸名 = 行[13].strip(), 行[14].strip()
            if 借コード and 借名:
                self.科目一覧[借コード] = 借名
            if 貸コード and 貸名:
                self.科目一覧[貸コード] = 貸名
        # _第2層データがある場合のみ保存（読み込みのみの場合はファイルを上書きしない）
        if self._第2層データ:
            self._保存()

    def 摘要変換(self, カタカナ摘要):
        """カタカナ摘要→正式摘要を検索"""
        return self.カタカナ変換表.get(カタカナ摘要, カタカナ摘要)

    def パターン検索(self, 摘要, 方向, 口座コード, 金額=0):
        """摘要から仕訳パターンを検索"""
        if 摘要 in self.仕訳パターン:
            return self.仕訳パターン[摘要]

        for キー, l2 in self._第2層データ.items():
            if l2["bank"] == 口座コード and l2["dir"] == 方向 and l2["tek"] == 摘要:
                有効 = {k: v for k, v in l2["ac_map"].items() if v["ac"] != "997"}
                if len(有効) == 1:
                    ac = list(有効.values())[0]
                    return {
                        "科目コード": ac["ac"], "補助コード": ac["asc"],
                        "科目名": ac["an"], "補助名": ac["asn"],
                        "消費税": {"ts": ac["ts"], "gy": ac["gy"], "tt": ac["tt"],
                                  "tc": ac["tc"], "tr": ac["tr"], "bt": ac["bt"]},
                    }
                elif len(有効) > 1 and 金額 > 0:
                    for ac in 有効.values():
                        if 金額 in ac["amounts"]:
                            return {
                                "科目コード": ac["ac"], "補助コード": ac["asc"],
                                "科目名": ac["an"], "補助名": ac["asn"],
                                "消費税": {"ts": ac["ts"], "gy": ac["gy"], "tt": ac["tt"],
                                          "tc": ac["tc"], "tr": ac["tr"], "bt": ac["bt"]},
                            }

        return None

    def 源泉税対象判定(self, 摘要):
        """源泉税対象の取引先かどうか"""
        for 取引先 in self.源泉税対象先:
            if 取引先 in 摘要:
                return True
        return False

    def _銀行口座判定(self, コード):
        """銀行口座判定"""
        科目名 = self.科目一覧.get(コード, "")
        if any(語 in 科目名 for 語 in ["預金", "当座", "銀行", "信金", "信用", "ゆうちょ", "農協", "JA"]):
            return True
        if any(語 in 科目名 for 語 in ["普通", "定期", "定積"]):
            return True
        if コード.isdigit() and 130 <= int(コード) <= 139:
            return True
        return False

    def _摘要正規化(self, 摘要):
        """摘要から日付・月・源泉等を除去して正規化"""
        t = re.sub(r"\s*源泉.*$", "", 摘要).strip()
        t = re.sub(r"\s*\d{1,2}月分?\s*", "", t).strip()
        t = re.sub(r"\s*\d{4}[/\-]\d{1,2}[/\-]?\d{0,2}\s*", "", t).strip()
        t = re.sub(r"\s*\d{1,2}[/\-]\d{1,2}\s*", "", t).strip()
        t = re.sub(r"\s*令和\d+年?\d*月?\d*日?\s*", "", t).strip()
        t = re.sub(r"\s*R\d+[/.]\d+[/.]*\d*\s*", "", t).strip()
        return t

    def _仕訳CSV読み込み(self, CSVパス):
        """仕訳CSVを読み込み（エンコーディング自動判定）"""
        if isinstance(CSVパス, list):
            全行 = []
            for パス in CSVパス:
                全行.extend(self._仕訳CSV読み込み(パス))
            return 全行

        for 文字コード in ["cp932", "utf-8-sig", "utf-8"]:
            try:
                with open(CSVパス, "r", encoding=文字コード) as f:
                    return [行 for 行 in csv.reader(f) if len(行) >= 26]
            except (UnicodeDecodeError, UnicodeError):
                continue
        return []
