"""CLIエントリポイント"""

import argparse
import logging
import sys
from pathlib import Path

from mjs_pdf_splitter import __version__
from mjs_pdf_splitter.classifier import (
    classify_page,
    extract_company_name_from_pages,
    extract_fiscal_period,
    find_document_boundaries,
)
from mjs_pdf_splitter.extractor import extract_page_texts
from mjs_pdf_splitter.splitter import build_filename, split_and_save


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mjs-pdf-split",
        description="MJS電子申告PDFを書類種類ごとに自動分割・リネームします。",
    )
    parser.add_argument(
        "input_files",
        nargs="+",
        type=Path,
        metavar="INPUT_PDF",
        help="分割するPDFファイル（複数指定可）",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="出力先ディレクトリ（デフォルト: 入力ファイルと同じディレクトリに"
             "サブフォルダを作成）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際にファイルを作成せず、分割結果のプレビューのみ表示",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="各ページの抽出テキストと判定結果を表示（問題の診断用）",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="詳細なログを表示",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser


def debug_pdf(input_path: Path) -> None:
    """PDFの各ページからテキストを抽出し、判定結果を表示する（デバッグ用）。"""
    print(f"\n===== デバッグ: {input_path.name} =====")

    pages = extract_page_texts(input_path)
    print(f"総ページ数: {len(pages)}")

    # 会社名抽出
    company = extract_company_name_from_pages(pages)
    print(f"検出した会社名: {company}")

    # 決算期抽出
    for page in pages:
        fp = extract_fiscal_period(page.full_text)
        if fp:
            print(f"検出した決算期: {fp}")
            break

    print("\n--- ページごとの判定 ---")
    for page in pages:
        # ヘッダーで判定
        header_result = classify_page(page.header_text)
        # 全文で判定
        full_result = classify_page(page.full_text)
        # 採用される判定
        adopted = header_result or full_result

        print(f"\n【ページ {page.page_index + 1}】")
        print(f"  判定結果: {adopted or '判定不可'}")
        print(f"    (ヘッダー判定: {header_result or 'なし'} / "
              f"全文判定: {full_result or 'なし'})")

        # テキスト表示（先頭200文字）
        header_preview = page.header_text.replace("\n", " ").strip()[:200]
        full_preview = page.full_text.replace("\n", " ").strip()[:300]
        print(f"  ヘッダーテキスト: {header_preview}")
        print(f"  全文テキスト: {full_preview}")

    print("\n--- 分割結果プレビュー ---")
    segments = find_document_boundaries(pages)
    if segments:
        for seg in segments:
            page_count = seg.end_page - seg.start_page + 1
            filename = build_filename(seg)
            print(
                f"  ページ {seg.start_page + 1}-{seg.end_page + 1} "
                f"({page_count}p): {filename}"
            )
    else:
        print("  書類種類を検出できませんでした")


def process_single_pdf(
    input_path: Path,
    output_dir: Path | None,
    dry_run: bool,
) -> bool:
    """1つのPDFファイルを処理する。成功時True、失敗時Falseを返す。"""
    print(f"\n処理中: {input_path.name}")

    if not input_path.exists():
        print(f"  エラー: ファイルが見つかりません: {input_path}", file=sys.stderr)
        return False

    if not input_path.suffix.lower() == ".pdf":
        print(f"  エラー: PDFファイルではありません: {input_path}", file=sys.stderr)
        return False

    try:
        # テキスト抽出
        pages = extract_page_texts(input_path)
        print(f"  {len(pages)}ページを読み込みました")

        # 書類種類の分類・境界検出
        segments = find_document_boundaries(pages)

        if not segments:
            print("  警告: 書類種類を検出できませんでした。MJSの電子申告PDFか確認してください。")
            return False

        print(f"  {len(segments)}種類の書類を検出:")
        for seg in segments:
            page_count = seg.end_page - seg.start_page + 1
            fiscal_info = f"  決算期: {seg.fiscal_period}" if seg.fiscal_period else ""
            print(
                f"    ページ {seg.start_page + 1}-{seg.end_page + 1}: "
                f"{seg.doc_type}  会社名: {seg.company_name}{fiscal_info}"
            )

        if dry_run:
            print("\n  [ドライラン] 以下のファイルが作成されます:")
            for seg in segments:
                filename = build_filename(seg)
                print(f"    -> {filename}")
            return True

        # 出力先の決定
        if output_dir is None:
            out = input_path.parent / input_path.stem
        else:
            out = output_dir

        # PDF分割・保存
        created = split_and_save(input_path, segments, out)
        print(f"\n  出力先: {out}/")
        print(f"  完了: {len(created)}ファイルを作成しました")
        return True

    except ValueError as e:
        print(f"  エラー: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  予期しないエラー: {e}", file=sys.stderr)
        logging.exception("予期しないエラーが発生しました")
        return False


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()

    if args.verbose or args.debug:
        logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    else:
        logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

    # デバッグモード
    if args.debug:
        for input_path in args.input_files:
            if not input_path.exists():
                print(f"エラー: ファイルが見つかりません: {input_path}", file=sys.stderr)
                continue
            try:
                debug_pdf(input_path)
            except Exception as e:
                print(f"エラー: {e}", file=sys.stderr)
        return

    success_count = 0
    fail_count = 0

    for input_path in args.input_files:
        if process_single_pdf(input_path, args.output_dir, args.dry_run):
            success_count += 1
        else:
            fail_count += 1

    # サマリー表示（複数ファイル処理時）
    if len(args.input_files) > 1:
        print(f"\n=== 処理結果 ===")
        print(f"  成功: {success_count}件  失敗: {fail_count}件")

    if fail_count > 0:
        sys.exit(1)
