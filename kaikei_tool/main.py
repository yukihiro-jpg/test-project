"""
会計大将インポートCSV生成ツール - メインスクリプト

使い方:
  python main.py <顧問先フォルダ名>                    # 仕訳CSV生成
  python main.py <顧問先フォルダ名> --build-rulebook    # ルールブックのみ生成
  python main.py --init <顧問先フォルダ名>              # 顧問先フォルダを1件作成
  python main.py --batch-init <CSVファイル>             # CSVから顧問先フォルダを一括作成
  python main.py --list                                # 顧問先一覧を表示

例:
  python main.py 山田商事
  python main.py 山田商事 --build-rulebook
  python main.py --init 新規顧問先A
  python main.py --batch-init 顧問先リスト.csv
"""
import argparse
import glob
import os
import sys
from datetime import datetime

from config import 顧問先フォルダ
from modules.master import マスタデータ
from modules.rulebook import ルールブック管理
from modules.pdf_reader import 請求書PDF解析, 賃金台帳PDF解析
from modules.bank_parsers import 銀行別通帳解析
from modules.csv_exporter import CSV出力, レビュー用CSV出力
from modules.journal_engine import 仕訳エンジン


def 顧問先初期化(名前):
    """顧問先フォルダを初期化"""
    パス = os.path.join(顧問先フォルダ, 名前)
    for フォルダ in [パス,
                    os.path.join(パス, "過去仕訳"),
                    os.path.join(パス, "当月資料"),
                    os.path.join(パス, "マスタ"),
                    os.path.join(パス, "output")]:
        os.makedirs(フォルダ, exist_ok=True)

    情報パス = os.path.join(パス, "マスタ", "事業者情報.json")
    if not os.path.isfile(情報パス):
        import json
        テンプレート = {
            "会社名": 名前,
            "インボイス事業者": True,
            "インボイス番号": "T0000000000000",
            "会計期間開始": "2025/04/01",
            "会計期間終了": "2026/03/31",
            "備考": "",
        }
        with open(情報パス, "w", encoding="utf-8") as f:
            json.dump(テンプレート, f, ensure_ascii=False, indent=2)

    print(f"顧問先フォルダを作成しました: {パス}")
    print()
    print("以下のファイルを配置してください:")
    print(f"  {os.path.join(パス, '過去仕訳')}/ → 過去の仕訳エクスポートCSV（26列）")
    print(f"  {os.path.join(パス, '当月資料')}/ → 通帳PDF、請求書PDF、賃金台帳PDF等")
    print(f"  {os.path.join(パス, 'マスタ')}/  → 科目リスト.csv、補助科目リスト.csv等")
    print(f"  {os.path.join(パス, 'マスタ', '事業者情報.json')} → インボイス区分等（テンプレート生成済）")


def 顧問先一括作成(CSVパス):
    """
    顧問先リストCSVから一括でフォルダを作成する。

    CSVファイルの形式（以下のどちらでも対応）:

    パターン1: 顧問先名だけの1列CSV
      山田商事
      佐藤建設
      田中医院

    パターン2: 顧問先名,インボイス事業者,インボイス番号,会計期間開始,会計期間終了
      山田商事,TRUE,T1234567890123,2025/04/01,2026/03/31
      佐藤建設,FALSE,,2025/01/01,2025/12/31
      田中医院,TRUE,T9876543210987,2025/04/01,2026/03/31

    ※ヘッダー行があっても自動でスキップします
    ※Shift_JIS(cp932)でもUTF-8でも読めます
    """
    import csv as csv_mod
    import json

    if not os.path.isfile(CSVパス):
        print(f"エラー: CSVファイルが見つかりません: {CSVパス}")
        return

    # ファイル読み込み（文字コード自動判定）
    行一覧 = []
    for 文字コード in ["cp932", "utf-8-sig", "utf-8"]:
        try:
            with open(CSVパス, "r", encoding=文字コード) as f:
                行一覧 = list(csv_mod.reader(f))
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if not 行一覧:
        print("エラー: CSVを読み込めませんでした。")
        return

    # ヘッダー行の判定（「顧問先」「名前」「会社名」等を含む行はスキップ）
    ヘッダー語 = ["顧問先", "名前", "会社名", "クライアント", "事業者名", "名称"]
    if 行一覧 and any(語 in str(行一覧[0]) for 語 in ヘッダー語):
        行一覧 = 行一覧[1:]

    作成数 = 0
    スキップ数 = 0
    for 行 in 行一覧:
        if not 行 or not 行[0].strip():
            continue

        名前 = 行[0].strip()
        パス = os.path.join(顧問先フォルダ, 名前)

        # 既存フォルダはスキップ
        if os.path.isdir(パス):
            print(f"  スキップ（既存）: {名前}")
            スキップ数 += 1
            continue

        # フォルダ作成
        for フォルダ in [パス,
                        os.path.join(パス, "過去仕訳"),
                        os.path.join(パス, "当月資料"),
                        os.path.join(パス, "マスタ"),
                        os.path.join(パス, "output")]:
            os.makedirs(フォルダ, exist_ok=True)

        # 事業者情報.json の生成
        テンプレート = {
            "会社名": 名前,
            "インボイス事業者": True,
            "インボイス番号": "T0000000000000",
            "会計期間開始": "2025/04/01",
            "会計期間終了": "2026/03/31",
            "備考": "",
        }

        # CSVに追加情報があれば反映
        if len(行) >= 2 and 行[1].strip().upper() in ("TRUE", "FALSE", "○", "×"):
            テンプレート["インボイス事業者"] = 行[1].strip().upper() in ("TRUE", "○")
        if len(行) >= 3 and 行[2].strip():
            テンプレート["インボイス番号"] = 行[2].strip()
        if len(行) >= 4 and 行[3].strip():
            テンプレート["会計期間開始"] = 行[3].strip()
        if len(行) >= 5 and 行[4].strip():
            テンプレート["会計期間終了"] = 行[4].strip()

        情報パス = os.path.join(パス, "マスタ", "事業者情報.json")
        with open(情報パス, "w", encoding="utf-8") as f:
            json.dump(テンプレート, f, ensure_ascii=False, indent=2)

        print(f"  作成: {名前}")
        作成数 += 1

    print()
    print(f"一括作成完了: {作成数}件作成、{スキップ数}件スキップ（既存）")
    print()
    print("次のステップ:")
    print("  各フォルダの「過去仕訳」フォルダに、会計大将から出力したCSVを入れてください。")
    print("  各フォルダの「当月資料」フォルダに、通帳PDF等を入れてください。")


def 顧問先一覧表示():
    """顧問先一覧を表示"""
    if not os.path.isdir(顧問先フォルダ):
        print("顧問先フォルダがありません。--init で作成してください。")
        return

    一覧 = [d for d in os.listdir(顧問先フォルダ)
            if os.path.isdir(os.path.join(顧問先フォルダ, d)) and not d.startswith("_")]

    if not 一覧:
        print("登録済みの顧問先がありません。")
        return

    print(f"登録済み顧問先（{len(一覧)}件）:")
    for 名前 in sorted(一覧):
        パス = os.path.join(顧問先フォルダ, 名前)
        RB有無 = "RB有" if os.path.isfile(os.path.join(パス, "rulebook.txt")) else "RB無"
        仕訳数 = len(glob.glob(os.path.join(パス, "過去仕訳", "*.csv")))
        資料数 = len(glob.glob(os.path.join(パス, "当月資料", "*")))
        print(f"  {名前:20s}  [{RB有無}]  過去仕訳CSV:{仕訳数}件  当月資料:{資料数}件")


def ルールブック生成(顧問先パス):
    """ルールブックを生成"""
    print("ルールブック生成中...")

    仕訳フォルダ = os.path.join(顧問先パス, "過去仕訳")
    CSVファイル一覧 = glob.glob(os.path.join(仕訳フォルダ, "*.csv"))
    if not CSVファイル一覧:
        print(f"エラー: 過去仕訳CSVが見つかりません: {仕訳フォルダ}")
        return False

    print(f"  過去仕訳CSV: {len(CSVファイル一覧)}ファイル")

    # 通帳PDF → 通帳取引（あれば）
    通帳取引一覧 = []
    資料フォルダ = os.path.join(顧問先パス, "当月資料")
    通帳PDF一覧 = glob.glob(os.path.join(資料フォルダ, "*通帳*.pdf")) + \
                  glob.glob(os.path.join(資料フォルダ, "*passbook*.pdf"))
    for PDFパス in 通帳PDF一覧:
        try:
            取引 = 銀行別通帳解析(PDFパス)
            通帳取引一覧.extend(取引)
            print(f"  通帳PDF: {os.path.basename(PDFパス)} → {len(取引)}件")
        except Exception as e:
            print(f"  通帳PDF読み取りエラー: {os.path.basename(PDFパス)} → {e}")

    ルールブック = ルールブック管理(顧問先パス)
    結果 = ルールブック.過去仕訳から生成(CSVファイル一覧, 通帳取引一覧 or None)

    if 結果:
        print(f"ルールブック生成完了: {ルールブック.ルールブックパス}")
        print(f"  科目数: {len(ルールブック.科目一覧)}")
        print(f"  カタカナ変換: {len(ルールブック.カタカナ変換表)}件")
        print(f"  源泉税対象: {len(ルールブック.源泉税対象先)}件")
    else:
        print("ルールブック生成に失敗しました。")

    return 結果


def 顧問先処理(顧問先パス):
    """顧問先の当月資料を処理してCSVを生成"""
    顧問先名 = os.path.basename(顧問先パス)
    print(f"=== {顧問先名} の仕訳CSV生成 ===")

    # マスタ読み込み
    マスタ = マスタデータ(顧問先パス)

    # 過去仕訳からマスタ補完
    仕訳フォルダ = os.path.join(顧問先パス, "過去仕訳")
    CSVファイル一覧 = glob.glob(os.path.join(仕訳フォルダ, "*.csv"))
    if CSVファイル一覧:
        import csv as csv_mod
        for CSVパス in CSVファイル一覧:
            for 文字コード in ["cp932", "utf-8-sig", "utf-8"]:
                try:
                    with open(CSVパス, "r", encoding=文字コード) as f:
                        行一覧 = [行 for 行 in csv_mod.reader(f) if len(行) >= 26]
                    マスタ.過去仕訳からマスタ構築(行一覧)
                    break
                except (UnicodeDecodeError, UnicodeError):
                    continue

    # ルールブック読み込み（なければ生成）
    ルールブック = ルールブック管理(顧問先パス)
    if not ルールブック.読み込み():
        print("ルールブックが見つかりません。自動生成します...")
        if not ルールブック生成(顧問先パス):
            print("ルールブック生成に失敗。過去仕訳CSVを配置してください。")
            return
        ルールブック.読み込み()

    # エンジン初期化
    エンジン = 仕訳エンジン(ルールブック, マスタ)

    資料フォルダ = os.path.join(顧問先パス, "当月資料")
    if not os.path.isdir(資料フォルダ):
        print(f"当月資料フォルダが空です: {資料フォルダ}")
        return

    # 1. 通帳PDF処理
    通帳PDF一覧 = [f for f in glob.glob(os.path.join(資料フォルダ, "*.pdf"))
                   if "通帳" in f or "passbook" in os.path.basename(f).lower()
                   or os.path.basename(f)[:3].isdigit()]
    for PDFパス in 通帳PDF一覧:
        try:
            取引一覧 = 銀行別通帳解析(PDFパス)
            print(f"  通帳: {os.path.basename(PDFパス)} → {len(取引一覧)}取引")
            エンジン.通帳取引処理(取引一覧)
        except Exception as e:
            print(f"  通帳エラー: {os.path.basename(PDFパス)} → {e}")

    # 2. 請求書PDF処理
    請求書PDF一覧 = [f for f in glob.glob(os.path.join(資料フォルダ, "*.pdf"))
                    if "請求" in f or "invoice" in os.path.basename(f).lower()]
    for PDFパス in 請求書PDF一覧:
        try:
            請求書 = 請求書PDF解析(PDFパス)
            print(f"  請求書: {os.path.basename(PDFパス)} → {請求書.取引先名} ¥{請求書.合計金額:,}")
            エンジン.請求書処理([請求書])
        except Exception as e:
            print(f"  請求書エラー: {os.path.basename(PDFパス)} → {e}")

    # 3. 賃金台帳PDF処理
    賃金PDF一覧 = [f for f in glob.glob(os.path.join(資料フォルダ, "*.pdf"))
                  if "賃金" in f or "給与" in f or "payroll" in os.path.basename(f).lower()]
    for PDFパス in 賃金PDF一覧:
        try:
            賃金データ = 賃金台帳PDF解析(PDFパス)
            print(f"  賃金台帳: {os.path.basename(PDFパス)} → {len(賃金データ)}名分")
            エンジン.給与処理(賃金データ)
        except Exception as e:
            print(f"  賃金台帳エラー: {os.path.basename(PDFパス)} → {e}")

    # 結果出力
    結果 = エンジン.結果取得()
    統計 = 結果["統計"]

    print()
    print(f"処理結果:")
    print(f"  確定仕訳: {統計['合計']}件")
    print(f"    高信頼: {統計['高信頼']}件")
    print(f"    中信頼: {統計['中信頼']}件")
    print(f"    低信頼: {統計['低信頼']}件")
    print(f"  要確認: {統計['要確認数']}件")

    if not 結果["確定仕訳"]:
        print("仕訳データがありません。当月資料フォルダにPDFを配置してください。")
        return

    出力フォルダ = os.path.join(顧問先パス, "output")
    タイムスタンプ = datetime.now().strftime("%Y%m%d_%H%M%S")

    # インポート用CSV（Shift_JIS）
    インポートパス = os.path.join(出力フォルダ, f"import_{タイムスタンプ}.csv")
    CSV出力(結果["確定仕訳"], インポートパス)
    print(f"\n  インポートCSV: {インポートパス}")

    # レビュー用CSV（UTF-8）
    if 結果["要確認"]:
        レビューパス = os.path.join(出力フォルダ, f"review_{タイムスタンプ}.csv")
        レビュー用CSV出力(結果["確定仕訳"], 結果["要確認"], レビューパス)
        print(f"  レビュー用CSV: {レビューパス}")

    print("\nルールブックを更新中...")
    ルールブック.ルールブック更新(インポートパス)
    print("ルールブック更新完了。")


def main():
    parser = argparse.ArgumentParser(
        description="会計大将インポートCSV生成ツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("client", nargs="?", help="顧問先フォルダ名")
    parser.add_argument("--init", metavar="名前", help="顧問先フォルダを新規作成")
    parser.add_argument("--batch-init", metavar="CSVファイル", help="CSVから顧問先フォルダを一括作成")
    parser.add_argument("--list", action="store_true", help="顧問先一覧を表示")
    parser.add_argument("--build-rulebook", action="store_true", help="ルールブックのみ生成")

    args = parser.parse_args()

    if args.list:
        顧問先一覧表示()
        return

    if args.init:
        顧問先初期化(args.init)
        return

    if args.batch_init:
        顧問先一括作成(args.batch_init)
        return

    if not args.client:
        parser.print_help()
        return

    顧問先パス = os.path.join(顧問先フォルダ, args.client)
    if not os.path.isdir(顧問先パス):
        print(f"顧問先フォルダが見つかりません: {顧問先パス}")
        print(f"python main.py --init {args.client} で作成してください。")
        sys.exit(1)

    if args.build_rulebook:
        ルールブック生成(顧問先パス)
    else:
        顧問先処理(顧問先パス)


if __name__ == "__main__":
    main()
