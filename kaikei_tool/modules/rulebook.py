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


class Rulebook:
    """ルールブック辞書の生成・読み込み・更新を行うクラス"""

    MIN_COUNT = 3  # この回数以上の摘要パターンのみ辞書化

    def __init__(self, client_dir):
        self.client_dir = client_dir
        self.rulebook_path = os.path.join(client_dir, "rulebook.txt")

        # 内部データ
        self.account_map = {}       # コード → 科目名
        self.sub_account_map = {}   # "科目コード-補助コード" → 補助名
        self.katakana_map = {}      # カタカナ → 正式摘要（第1層）
        self.journal_patterns = {}  # 仕訳パターン（第2層）
        self.withholding_vendors = {}  # 源泉税対象取引先
        self.loan_patterns = {}     # 借入金返済パターン
        self.composite_examples = []  # 諸口仕訳実例
        self.tax_defaults = {}      # 消費税デフォルト

    def load(self):
        """既存ルールブックを読み込み"""
        if not os.path.isfile(self.rulebook_path):
            return False
        with open(self.rulebook_path, "r", encoding="utf-8-sig") as f:
            text = f.read()
        self._parse_rulebook(text)
        return True

    def _parse_rulebook(self, text):
        """ルールブックテキストをパースして内部データに変換"""
        current_section = ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("## "):
                current_section = line
                continue

            if "1. カタカナ→正式摘要" in current_section:
                if line.startswith('"'):
                    parts = self._parse_csv_line(line)
                    if len(parts) >= 2:
                        self.katakana_map[parts[0]] = parts[1]

            elif "2. 仕訳パターン" in current_section:
                if line.startswith("  ") and "→" in line:
                    self._parse_pattern_line(line.strip())

            elif "3. 源泉税対象" in current_section:
                if line.startswith("- "):
                    vendor = line[2:].strip()
                    self.withholding_vendors[vendor] = True

            elif "6. 勘定科目マスタ" in current_section:
                parts = line.split(",", 1)
                if len(parts) == 2 and parts[0].strip().isdigit():
                    self.account_map[parts[0].strip()] = parts[1].strip()

            elif "8. 消費税デフォルト" in current_section:
                parts = line.split(",")
                if len(parts) >= 7 and parts[0].strip().isdigit():
                    self.tax_defaults[parts[0].strip()] = {
                        "税売仕": parts[1], "業種": parts[2],
                        "税込抜": parts[3], "税コード": parts[4],
                        "税率": parts[5], "事業者": parts[6],
                    }

    def _parse_pattern_line(self, line):
        """仕訳パターン行をパース"""
        if "→" not in line:
            return
        parts = line.split("→", 1)
        tekiyo = parts[0].strip()
        target = parts[1].strip()

        # "科目コード:補助コード 税(...)" の形式
        m = re.match(r"(\d+)(?::(\d+))?\s*(?:税\(([^)]+)\))?", target)
        if m:
            self.journal_patterns[tekiyo] = {
                "account_code": m.group(1),
                "sub_code": m.group(2) or "",
                "tax": m.group(3) or "",
            }

    def _parse_csv_line(self, line):
        """CSVの1行をパース（ダブルクォート対応）"""
        result = []
        current = ""
        in_quote = False
        for ch in line:
            if in_quote:
                if ch == '"':
                    in_quote = False
                else:
                    current += ch
            else:
                if ch == '"':
                    in_quote = True
                elif ch == ',':
                    result.append(current)
                    current = ""
                else:
                    current += ch
        result.append(current)
        return result

    def build_from_journals(self, journal_csv_path, passbook_txs=None):
        """
        過去仕訳CSVからルールブックを新規生成。
        GASのbuildDictionary()をPythonに移植。
        """
        rows = self._read_journal_csv(journal_csv_path)
        if not rows:
            return False

        tekiyo_count = defaultdict(int)
        layer2_map = {}
        withholding_tekiyo = defaultdict(int)
        loan_patterns = {}
        composite_groups = defaultdict(list)
        tax_by_account = defaultdict(lambda: defaultdict(lambda: {"cnt": 0}))

        for row in rows:
            if len(row) < 26:
                continue

            date_str = row[0].strip()
            d_code, d_name = row[1].strip(), row[2].strip()
            d_sub_code, d_sub_name = row[3].strip(), row[4].strip()
            d_tax_sales, d_gyoshu, d_tax_type = row[5].strip(), row[6].strip(), row[7].strip()
            d_amount = row[8].strip()
            d_tax_code, d_tax_rate, d_biz_type = row[10].strip(), row[11].strip(), row[12].strip()
            c_code, c_name = row[13].strip(), row[14].strip()
            c_sub_code, c_sub_name = row[15].strip(), row[16].strip()
            c_tax_sales, c_gyoshu, c_tax_type = row[17].strip(), row[18].strip(), row[19].strip()
            c_tax_code, c_tax_rate, c_biz_type = row[22].strip(), row[23].strip(), row[24].strip()
            tekiyo = row[25].strip()
            amt = int(re.sub(r"[,\s]", "", d_amount) or "0")

            # 科目マスタ
            if d_code and d_name:
                self.account_map[d_code] = d_name
            if c_code and c_name:
                self.account_map[c_code] = c_name
            if d_code and d_sub_code and d_sub_name:
                self.sub_account_map[f"{d_code}-{d_sub_code}"] = d_sub_name
            if c_code and c_sub_code and c_sub_name:
                self.sub_account_map[f"{c_code}-{c_sub_code}"] = c_sub_name

            if tekiyo:
                tekiyo_count[tekiyo] += 1

            # 消費税パターン
            for code, ts, gy, tt, tc, tr, bt in [
                (d_code, d_tax_sales, d_gyoshu, d_tax_type, d_tax_code, d_tax_rate, d_biz_type),
                (c_code, c_tax_sales, c_gyoshu, c_tax_type, c_tax_code, c_tax_rate, c_biz_type),
            ]:
                if code and code != "997":
                    tax_key = f"{ts}|{gy}|{tt}|{tc}|{tr}|{bt}"
                    entry = tax_by_account[code][tax_key]
                    entry["cnt"] += 1
                    entry.update({"ts": ts, "gy": gy, "tt": tt, "tc": tc, "tr": tr, "bt": bt})

            # 源泉税対象
            if c_code == "323" and c_sub_code == "1" and tekiyo:
                base_tek = self._normalize_withholding_tekiyo(tekiyo)
                if base_tek and not any(kw in base_tek for kw in ["住民税", "所得税", "賞与", "給与", "給料"]):
                    withholding_tekiyo[base_tek] += 1

            # 諸口パターン
            if d_code == "997" or c_code == "997":
                group_key = f"{date_str}|{self._normalize_withholding_tekiyo(tekiyo)}"
                composite_groups[group_key].append({
                    "dc": d_code, "dn": d_name, "dsc": d_sub_code, "dsn": d_sub_name,
                    "dts": d_tax_sales, "dgy": d_gyoshu, "dtt": d_tax_type,
                    "dtc": d_tax_code, "dtr": d_tax_rate, "dbt": d_biz_type,
                    "cc": c_code, "cn": c_name, "csc": c_sub_code, "csn": c_sub_name,
                    "cts": c_tax_sales, "cgy": c_gyoshu, "ctt": c_tax_type,
                    "ctc": c_tax_code, "ctr": c_tax_rate, "cbt": c_biz_type,
                    "amt": amt, "tek": tekiyo,
                })

            # 借入金返済
            if d_code and d_code.isdigit() and 340 <= int(d_code) <= 360 and amt > 0:
                loan_key = f"{d_code}|{d_sub_code}"
                if loan_key not in loan_patterns:
                    loan_patterns[loan_key] = {
                        "code": d_code, "name": d_name,
                        "sub_code": d_sub_code, "sub_name": d_sub_name,
                        "tekiyo_map": defaultdict(int), "amounts": [], "cnt": 0,
                    }
                loan_patterns[loan_key]["amounts"].append(amt)
                loan_patterns[loan_key]["cnt"] += 1
                loan_patterns[loan_key]["tekiyo_map"][tekiyo] += 1

            # 第2層：銀行口座関連
            if amt > 0 and c_code and c_code != "997":
                l2_key = f"{c_code}|出金|{tekiyo}"
                if l2_key not in layer2_map:
                    layer2_map[l2_key] = {"bank": c_code, "dir": "出金", "tek": tekiyo, "cnt": 0, "ac_map": {}}
                layer2_map[l2_key]["cnt"] += 1
                ac_key = f"{d_code}|{d_sub_code}"
                if ac_key not in layer2_map[l2_key]["ac_map"]:
                    layer2_map[l2_key]["ac_map"][ac_key] = {
                        "ac": d_code, "an": d_name, "asc": d_sub_code, "asn": d_sub_name,
                        "ts": d_tax_sales, "gy": d_gyoshu, "tt": d_tax_type,
                        "tc": d_tax_code, "tr": d_tax_rate, "bt": d_biz_type,
                        "amounts": defaultdict(int),
                    }
                layer2_map[l2_key]["ac_map"][ac_key]["amounts"][amt] += 1

            if amt > 0 and d_code and d_code != "997":
                l2_key = f"{d_code}|入金|{tekiyo}"
                if l2_key not in layer2_map:
                    layer2_map[l2_key] = {"bank": d_code, "dir": "入金", "tek": tekiyo, "cnt": 0, "ac_map": {}}
                layer2_map[l2_key]["cnt"] += 1
                ac_key = f"{c_code}|{c_sub_code}"
                if ac_key not in layer2_map[l2_key]["ac_map"]:
                    layer2_map[l2_key]["ac_map"][ac_key] = {
                        "ac": c_code, "an": c_name, "asc": c_sub_code, "asn": c_sub_name,
                        "ts": c_tax_sales, "gy": c_gyoshu, "tt": c_tax_type,
                        "tc": c_tax_code, "tr": c_tax_rate, "bt": c_biz_type,
                        "amounts": defaultdict(int),
                    }
                layer2_map[l2_key]["ac_map"][ac_key]["amounts"][amt] += 1

        # --- 保存用データを構築 ---
        self.withholding_vendors = dict(withholding_tekiyo)
        self.loan_patterns = {k: v for k, v in loan_patterns.items() if v["cnt"] >= 2}
        self.tax_defaults = {}
        for acc_code, tax_patterns_dict in tax_by_account.items():
            if acc_code.isdigit() and int(acc_code) >= 400:
                best = max(tax_patterns_dict.values(), key=lambda x: x["cnt"])
                if best.get("ts", "0") != "0" or best.get("tt", "0") != "0":
                    self.tax_defaults[acc_code] = best

        # カタカナ→正式摘要マッピング（通帳取引との突き合わせ）
        if passbook_txs:
            self._build_katakana_map(rows, passbook_txs)

        # 第2層フィルタリング
        self._filtered_layer2 = {}
        for key, l2 in layer2_map.items():
            if self._is_bank_account(l2["bank"]) and l2["cnt"] >= self.MIN_COUNT:
                valid = {k: v for k, v in l2["ac_map"].items() if v["ac"] != "997"}
                if valid:
                    l2["ac_map"] = valid
                    self._filtered_layer2[key] = l2

        # 諸口実例
        cg_count_by_tek = defaultdict(int)
        for key, grp in composite_groups.items():
            if len(grp) >= 2:
                base_tek = self._normalize_withholding_tekiyo(grp[0]["tek"])
                cg_count_by_tek[base_tek] += 1
        seen = set()
        self.composite_examples = []
        for key, grp in composite_groups.items():
            if len(grp) >= 2:
                base_tek = self._normalize_withholding_tekiyo(grp[0]["tek"])
                if cg_count_by_tek[base_tek] >= 2 and base_tek not in seen:
                    seen.add(base_tek)
                    self.composite_examples.append({"key": key, "rows": grp})

        # テキスト生成して保存
        self._save()
        return True

    def _build_katakana_map(self, journal_rows, passbook_txs):
        """通帳取引と仕訳CSVの日付+金額で突き合わせてカタカナマップを構築"""
        exp_index = defaultdict(list)
        for row in journal_rows:
            if len(row) < 26:
                continue
            e_date = row[0].strip()
            d_code = row[1].strip()
            c_code = row[13].strip()
            e_amt = int(re.sub(r"[,\s]", "", row[8].strip()) or "0")
            e_tek = row[25].strip()
            if not e_tek or d_code == "997" or c_code == "997":
                continue
            if c_code and self._is_bank_account(c_code):
                exp_index[f"{e_date}|{e_amt}|{c_code}"].append(e_tek)
            if d_code and self._is_bank_account(d_code):
                exp_index[f"{e_date}|{e_amt}|{d_code}"].append(e_tek)

        seen = set()
        for tx in passbook_txs:
            date_normalized = re.sub(r"[/\-]", "", tx.date)
            if len(date_normalized) == 6:
                date_normalized = "20" + date_normalized
            amount = tx.withdrawal if tx.withdrawal > 0 else tx.deposit
            search_key = f"{date_normalized}|{amount}|{tx.bank_code}"
            candidates = exp_index.get(search_key, [])
            if len(candidates) == 1 and tx.tekiyo not in seen:
                self.katakana_map[tx.tekiyo] = candidates[0]
                seen.add(tx.tekiyo)

    def _save(self):
        """ルールブックをテキストファイルに保存"""
        now = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        lines = []
        lines.append("# ルールブック辞書（スリム版 v2）")
        lines.append(f"# 生成日時: {now}")
        lines.append(f"# 出現{self.MIN_COUNT}回以上のみ収録")
        lines.append("")

        # セクション0: 処理フロー
        lines.append("## 0. 処理フロー")
        lines.append("1→セクション1で通帳カタカナを正式摘要に変換")
        lines.append("2→セクション2で口座→出入→摘要名で科目を特定（金額分岐がある場合は金額で補助を確定）")
        lines.append("3→セクション3で源泉税対象なら諸口仕訳")
        lines.append("4→セクション4で借入金返済なら諸口仕訳")
        lines.append("5→セクション5で諸口仕訳の組み立て方を確認")
        lines.append("6→いずれも不一致→174仮払金")
        lines.append("")

        # セクション1: カタカナ→正式摘要
        if self.katakana_map:
            lines.append("## 1. カタカナ→正式摘要")
            lines.append("カタカナ,正式摘要")
            for k in sorted(self.katakana_map.keys()):
                kk = k.replace('"', '""')
                vv = self.katakana_map[k].replace('"', '""')
                lines.append(f'"{kk}","{vv}"')
            lines.append("")
        else:
            lines.append("## 1. カタカナ→正式摘要（通帳データ未登録のため未生成）")
            lines.append("")

        # セクション2: 仕訳パターン
        lines.append(f"## 2. 仕訳パターン（出現{self.MIN_COUNT}回以上）")
        used_codes = set()
        sorted_l2 = sorted(
            self._filtered_layer2.values(),
            key=lambda x: (x["bank"], x["dir"], x["tek"]),
        )
        current_bank, current_dir = "", ""
        for lf in sorted_l2:
            if lf["bank"] != current_bank or lf["dir"] != current_dir:
                current_bank, current_dir = lf["bank"], lf["dir"]
                lines.append(f'[{current_bank} {self.account_map.get(current_bank, "")} {current_dir}]')
            used_codes.add(lf["bank"])

            valid_acs = {k: v for k, v in lf["ac_map"].items() if v["ac"] != "997"}
            if len(valid_acs) == 1:
                ac = list(valid_acs.values())[0]
                used_codes.add(ac["ac"])
                sub = f':{ac["asc"]}' if ac["asc"] else ""
                tax = ""
                if ac["ts"] != "0" or ac["tt"] != "0" or ac["tc"] or ac["tr"]:
                    tax = f' 税({ac["ts"]},{ac["gy"]},{ac["tt"]},{ac["tc"]},{ac["tr"]},{ac["bt"]})'
                lines.append(f"  {lf['tek']} → {ac['ac']}{sub}{tax}")
            else:
                lines.append(f"  {lf['tek']} →金額分岐:")
                for ac in valid_acs.values():
                    used_codes.add(ac["ac"])
                    sub = f':{ac["asc"]}' if ac["asc"] else ""
                    tax = ""
                    if ac["ts"] != "0" or ac["tt"] != "0" or ac["tc"] or ac["tr"]:
                        tax = f' 税({ac["ts"]},{ac["gy"]},{ac["tt"]},{ac["tc"]},{ac["tr"]},{ac["bt"]})'
                    amts = "/".join(str(a) for a in sorted(ac["amounts"].keys()))
                    lines.append(f"    金額{amts} → {ac['ac']}{sub}{tax}")
        lines.append("")

        # セクション3: 源泉税対象
        if self.withholding_vendors:
            lines.append("## 3. 源泉税対象取引先")
            lines.append("以下の取引先への出金は必ず諸口仕訳（報酬+預り金+消費税）で処理する")
            for v in sorted(self.withholding_vendors.keys()):
                lines.append(f"- {v}")
            lines.append("")

        # セクション4: 借入金返済パターン
        if self.loan_patterns:
            lines.append("## 4. 借入金返済パターン")
            lines.append("科目コード,補助コード,補助名,摘要,直近金額,回数")
            for lp in self.loan_patterns.values():
                best_tek = max(lp["tekiyo_map"], key=lp["tekiyo_map"].get)
                recent = lp["amounts"][-1]
                tek_escaped = best_tek.replace('"', '""')
                lines.append(f'{lp["code"]},{lp["sub_code"]},{lp["sub_name"]},"{tek_escaped}",{recent},{lp["cnt"]}')
                used_codes.add(lp["code"])
            lines.append("")

        # セクション5: 諸口仕訳実例
        if self.composite_examples:
            lines.append(f"## 5. 諸口仕訳実例（{len(self.composite_examples)}件）")
            for ex in self.composite_examples:
                tek_label = ex["key"].split("|", 1)[1] if "|" in ex["key"] else ex["key"]
                lines.append(f"--- {tek_label} ---")
                for er in ex["rows"]:
                    d_part = er["dc"] + (f':{er["dsc"]}' if er["dsc"] else "")
                    c_part = er["cc"] + (f':{er["csc"]}' if er["csc"] else "")
                    lines.append(f'  借方:{d_part} {er["amt"]} / 貸方:{c_part}')
                    used_codes.add(er["dc"])
                    used_codes.add(er["cc"])
            lines.append("")

        # セクション6: 勘定科目マスタ
        used_codes.add("997")
        used_codes.add("174")
        lines.append("## 6. 勘定科目マスタ")
        lines.append("コード,科目名")
        for code in sorted(self.account_map.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            if code in used_codes:
                lines.append(f"{code},{self.account_map[code]}")
        lines.append("")

        # セクション8: 消費税デフォルト
        lines.append("## 8. 消費税デフォルト（セクション2に未収録の科目のみ）")
        lines.append("科目コード,税売仕,業種,税込抜,税コード,税率,事業者")
        for code in sorted(self.tax_defaults.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            td = self.tax_defaults[code]
            lines.append(f'{code},{td.get("ts","0")},{td.get("gy","0")},{td.get("tt","0")},{td.get("tc","")},{td.get("tr","")},{td.get("bt","0")}')
        lines.append("")

        text = "\n".join(lines)
        with open(self.rulebook_path, "w", encoding="utf-8-sig") as f:
            f.write(text)
        return text

    def update_with_new_journals(self, new_csv_path):
        """新しい仕訳CSVでルールブックを更新（差分追加）"""
        rows = self._read_journal_csv(new_csv_path)
        for row in rows:
            if len(row) < 26:
                continue
            d_code, d_name = row[1].strip(), row[2].strip()
            c_code, c_name = row[13].strip(), row[14].strip()
            tekiyo = row[25].strip()
            if d_code and d_name:
                self.account_map[d_code] = d_name
            if c_code and c_name:
                self.account_map[c_code] = c_name
        self._save()

    def lookup_tekiyo(self, katakana_tekiyo):
        """カタカナ摘要→正式摘要を検索"""
        return self.katakana_map.get(katakana_tekiyo, katakana_tekiyo)

    def lookup_pattern(self, tekiyo, direction, bank_code, amount=0):
        """摘要から仕訳パターンを検索"""
        # 完全一致
        if tekiyo in self.journal_patterns:
            return self.journal_patterns[tekiyo]

        # 第2層から検索
        for key, l2 in self._filtered_layer2.items():
            if l2["bank"] == bank_code and l2["dir"] == direction and l2["tek"] == tekiyo:
                valid = {k: v for k, v in l2["ac_map"].items() if v["ac"] != "997"}
                if len(valid) == 1:
                    ac = list(valid.values())[0]
                    return {
                        "account_code": ac["ac"],
                        "sub_code": ac["asc"],
                        "account_name": ac["an"],
                        "sub_name": ac["asn"],
                        "tax": {"ts": ac["ts"], "gy": ac["gy"], "tt": ac["tt"],
                                "tc": ac["tc"], "tr": ac["tr"], "bt": ac["bt"]},
                    }
                elif len(valid) > 1 and amount > 0:
                    for ac in valid.values():
                        if amount in ac["amounts"]:
                            return {
                                "account_code": ac["ac"],
                                "sub_code": ac["asc"],
                                "account_name": ac["an"],
                                "sub_name": ac["asn"],
                                "tax": {"ts": ac["ts"], "gy": ac["gy"], "tt": ac["tt"],
                                        "tc": ac["tc"], "tr": ac["tr"], "bt": ac["bt"]},
                            }

        return None

    def is_withholding_target(self, tekiyo):
        """源泉税対象の取引先かどうか"""
        for vendor in self.withholding_vendors:
            if vendor in tekiyo:
                return True
        return False

    def _is_bank_account(self, code):
        """銀行口座判定"""
        name = self.account_map.get(code, "")
        if any(kw in name for kw in ["預金", "当座", "銀行", "信金", "信用", "ゆうちょ", "農協", "JA"]):
            return True
        if any(kw in name for kw in ["普通", "定期", "定積"]):
            return True
        if code.isdigit() and 130 <= int(code) <= 139:
            return True
        return False

    def _normalize_withholding_tekiyo(self, tekiyo):
        """摘要から日付・月・源泉等を除去して正規化"""
        t = re.sub(r"\s*源泉.*$", "", tekiyo).strip()
        t = re.sub(r"\s*\d{1,2}月分?\s*", "", t).strip()
        t = re.sub(r"\s*\d{4}[/\-]\d{1,2}[/\-]?\d{0,2}\s*", "", t).strip()
        t = re.sub(r"\s*\d{1,2}[/\-]\d{1,2}\s*", "", t).strip()
        t = re.sub(r"\s*令和\d+年?\d*月?\d*日?\s*", "", t).strip()
        t = re.sub(r"\s*R\d+[/.]\d+[/.]*\d*\s*", "", t).strip()
        return t

    def _read_journal_csv(self, csv_path):
        """仕訳CSVを読み込み（エンコーディング自動判定）"""
        if isinstance(csv_path, list):
            # 複数ファイル
            all_rows = []
            for p in csv_path:
                all_rows.extend(self._read_journal_csv(p))
            return all_rows

        for enc in ["cp932", "utf-8-sig", "utf-8"]:
            try:
                with open(csv_path, "r", encoding=enc) as f:
                    reader = csv.reader(f)
                    rows = [row for row in reader if len(row) >= 26]
                return rows
            except (UnicodeDecodeError, UnicodeError):
                continue
        return []
