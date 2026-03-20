"""
会計大将インポートCSV生成ツール - メインスクリプト

使い方:
  python main.py <顧問先フォルダ名>                    # 仕訳CSV生成
  python main.py <顧問先フォルダ名> --build-rulebook    # ルールブックのみ生成
  python main.py --init <顧問先フォルダ名>              # 顧問先フォルダを初期化
  python main.py --list                                # 顧問先一覧を表示

例:
  python main.py 山田商事
  python main.py 山田商事 --build-rulebook
  python main.py --init 新規顧問先A
"""
import argparse
import glob
import os
import sys
from datetime import datetime

from config import CLIENTS_DIR
from modules.master import MasterData
from modules.rulebook import Rulebook
from modules.pdf_reader import (
    parse_passbook_pdf,
    parse_invoice_pdf,
    parse_payroll_pdf,
)
from modules.csv_exporter import export_csv, export_review_csv
from modules.journal_engine import JournalEngine


def init_client(name):
    """顧問先フォルダを初期化"""
    client_dir = os.path.join(CLIENTS_DIR, name)
    dirs = [
        client_dir,
        os.path.join(client_dir, "過去仕訳"),
        os.path.join(client_dir, "当月資料"),
        os.path.join(client_dir, "マスタ"),
        os.path.join(client_dir, "output"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # 事業者情報テンプレート
    info_path = os.path.join(client_dir, "マスタ", "事業者情報.json")
    if not os.path.isfile(info_path):
        import json
        template = {
            "会社名": name,
            "インボイス事業者": True,
            "インボイス番号": "T0000000000000",
            "会計期間開始": "2025/04/01",
            "会計期間終了": "2026/03/31",
            "備考": "",
        }
        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(template, f, ensure_ascii=False, indent=2)

    print(f"顧問先フォルダを作成しました: {client_dir}")
    print()
    print("以下のファイルを配置してください:")
    print(f"  {os.path.join(client_dir, '過去仕訳')}/ → 過去の仕訳エクスポートCSV（26列）")
    print(f"  {os.path.join(client_dir, '当月資料')}/ → 通帳PDF、請求書PDF、賃金台帳PDF等")
    print(f"  {os.path.join(client_dir, 'マスタ')}/  → 科目リスト.csv、補助科目リスト.csv等")
    print(f"  {os.path.join(client_dir, 'マスタ', '事業者情報.json')} → インボイス区分等（テンプレート生成済）")


def list_clients():
    """顧問先一覧を表示"""
    if not os.path.isdir(CLIENTS_DIR):
        print("顧問先フォルダがありません。--init で作成してください。")
        return

    clients = [d for d in os.listdir(CLIENTS_DIR)
               if os.path.isdir(os.path.join(CLIENTS_DIR, d)) and not d.startswith("_")]

    if not clients:
        print("登録済みの顧問先がありません。")
        return

    print(f"登録済み顧問先（{len(clients)}件）:")
    for name in sorted(clients):
        client_dir = os.path.join(CLIENTS_DIR, name)
        has_rulebook = os.path.isfile(os.path.join(client_dir, "rulebook.txt"))
        journal_count = len(glob.glob(os.path.join(client_dir, "過去仕訳", "*.csv")))
        doc_count = len(glob.glob(os.path.join(client_dir, "当月資料", "*")))
        status = "RB有" if has_rulebook else "RB無"
        print(f"  {name:20s}  [{status}]  過去仕訳CSV:{journal_count}件  当月資料:{doc_count}件")


def build_rulebook(client_dir):
    """ルールブックを生成"""
    print("ルールブック生成中...")

    # 過去仕訳CSV収集
    journal_dir = os.path.join(client_dir, "過去仕訳")
    csv_files = glob.glob(os.path.join(journal_dir, "*.csv"))
    if not csv_files:
        print(f"エラー: 過去仕訳CSVが見つかりません: {journal_dir}")
        return False

    print(f"  過去仕訳CSV: {len(csv_files)}ファイル")

    # 通帳PDF → 通帳取引（あれば）
    passbook_txs = []
    doc_dir = os.path.join(client_dir, "当月資料")
    passbook_pdfs = glob.glob(os.path.join(doc_dir, "*通帳*.pdf")) + \
                    glob.glob(os.path.join(doc_dir, "*passbook*.pdf"))
    for pdf in passbook_pdfs:
        try:
            txs = parse_passbook_pdf(pdf)
            passbook_txs.extend(txs)
            print(f"  通帳PDF: {os.path.basename(pdf)} → {len(txs)}件")
        except Exception as e:
            print(f"  通帳PDF読み取りエラー: {os.path.basename(pdf)} → {e}")

    # ルールブック生成
    rulebook = Rulebook(client_dir)
    result = rulebook.build_from_journals(csv_files, passbook_txs or None)

    if result:
        print(f"ルールブック生成完了: {rulebook.rulebook_path}")
        print(f"  科目数: {len(rulebook.account_map)}")
        print(f"  カタカナ変換: {len(rulebook.katakana_map)}件")
        print(f"  源泉税対象: {len(rulebook.withholding_vendors)}件")
    else:
        print("ルールブック生成に失敗しました。")

    return result


def process_client(client_dir):
    """顧問先の当月資料を処理してCSVを生成"""
    client_name = os.path.basename(client_dir)
    print(f"=== {client_name} の仕訳CSV生成 ===")

    # マスタ読み込み
    master = MasterData(client_dir)

    # 過去仕訳からマスタ補完
    journal_dir = os.path.join(client_dir, "過去仕訳")
    csv_files = glob.glob(os.path.join(journal_dir, "*.csv"))
    if csv_files:
        import csv as csv_mod
        for cf in csv_files:
            for enc in ["cp932", "utf-8-sig", "utf-8"]:
                try:
                    with open(cf, "r", encoding=enc) as f:
                        reader = csv_mod.reader(f)
                        rows = [row for row in reader if len(row) >= 26]
                    master.build_from_past_journals(rows)
                    break
                except (UnicodeDecodeError, UnicodeError):
                    continue

    # ルールブック読み込み（なければ生成）
    rulebook = Rulebook(client_dir)
    if not rulebook.load():
        print("ルールブックが見つかりません。自動生成します...")
        if not build_rulebook(client_dir):
            print("ルールブック生成に失敗。過去仕訳CSVを配置してください。")
            return
        rulebook.load()

    # エンジン初期化
    engine = JournalEngine(rulebook, master)

    doc_dir = os.path.join(client_dir, "当月資料")
    if not os.path.isdir(doc_dir):
        print(f"当月資料フォルダが空です: {doc_dir}")
        return

    # 1. 通帳PDF処理
    passbook_pdfs = [f for f in glob.glob(os.path.join(doc_dir, "*.pdf"))
                     if "通帳" in f or "passbook" in os.path.basename(f).lower()
                     or os.path.basename(f)[:3].isdigit()]
    for pdf in passbook_pdfs:
        try:
            txs = parse_passbook_pdf(pdf)
            print(f"  通帳: {os.path.basename(pdf)} → {len(txs)}取引")
            engine.process_bank_transactions(txs)
        except Exception as e:
            print(f"  通帳エラー: {os.path.basename(pdf)} → {e}")

    # 2. 請求書PDF処理
    invoice_pdfs = [f for f in glob.glob(os.path.join(doc_dir, "*.pdf"))
                    if "請求" in f or "invoice" in os.path.basename(f).lower()]
    for pdf in invoice_pdfs:
        try:
            inv = parse_invoice_pdf(pdf)
            print(f"  請求書: {os.path.basename(pdf)} → {inv.vendor} ¥{inv.total_amount:,}")
            engine.process_invoices([inv])
        except Exception as e:
            print(f"  請求書エラー: {os.path.basename(pdf)} → {e}")

    # 3. 賃金台帳PDF処理
    payroll_pdfs = [f for f in glob.glob(os.path.join(doc_dir, "*.pdf"))
                    if "賃金" in f or "給与" in f or "payroll" in os.path.basename(f).lower()]
    for pdf in payroll_pdfs:
        try:
            entries = parse_payroll_pdf(pdf)
            print(f"  賃金台帳: {os.path.basename(pdf)} → {len(entries)}名分")
            engine.process_payroll(entries)
        except Exception as e:
            print(f"  賃金台帳エラー: {os.path.basename(pdf)} → {e}")

    # 結果出力
    results = engine.get_results()
    stats = results["stats"]

    print()
    print(f"処理結果:")
    print(f"  確定仕訳: {stats['total']}件")
    print(f"    高信頼: {stats['high_confidence']}件")
    print(f"    中信頼: {stats['medium_confidence']}件")
    print(f"    低信頼: {stats['low_confidence']}件")
    print(f"  要確認: {stats['review_count']}件")

    if not results["confirmed"]:
        print("仕訳データがありません。当月資料フォルダにPDFを配置してください。")
        return

    # CSV出力
    output_dir = os.path.join(client_dir, "output")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # インポート用CSV（Shift_JIS）
    import_path = os.path.join(output_dir, f"import_{timestamp}.csv")
    export_csv(results["confirmed"], import_path)
    print(f"\n  インポートCSV: {import_path}")

    # レビュー用CSV（UTF-8）
    if results["review_items"]:
        review_path = os.path.join(output_dir, f"review_{timestamp}.csv")
        export_review_csv(results["confirmed"], results["review_items"], review_path)
        print(f"  レビュー用CSV: {review_path}")

    # ルールブック更新
    print("\nルールブックを更新中...")
    rulebook.update_with_new_journals(import_path)
    print("ルールブック更新完了。")


def main():
    parser = argparse.ArgumentParser(
        description="会計大将インポートCSV生成ツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("client", nargs="?", help="顧問先フォルダ名")
    parser.add_argument("--init", metavar="NAME", help="顧問先フォルダを新規作成")
    parser.add_argument("--list", action="store_true", help="顧問先一覧を表示")
    parser.add_argument("--build-rulebook", action="store_true", help="ルールブックのみ生成")

    args = parser.parse_args()

    if args.list:
        list_clients()
        return

    if args.init:
        init_client(args.init)
        return

    if not args.client:
        parser.print_help()
        return

    client_dir = os.path.join(CLIENTS_DIR, args.client)
    if not os.path.isdir(client_dir):
        print(f"顧問先フォルダが見つかりません: {client_dir}")
        print(f"python main.py --init {args.client} で作成してください。")
        sys.exit(1)

    if args.build_rulebook:
        build_rulebook(client_dir)
    else:
        process_client(client_dir)


if __name__ == "__main__":
    main()
