"""PDF分割・ファイル出力"""

import logging
from pathlib import Path

import fitz

from mjs_pdf_splitter.classifier import DocumentSegment

logger = logging.getLogger(__name__)


def build_filename(segment: DocumentSegment) -> str:
    """セグメント情報からファイル名を生成する。

    形式: {書類名}_{和暦〇年〇月決算}_{会社名}.pdf
    決算期が不明の場合は省略: {書類名}_{会社名}.pdf
    """
    parts = [segment.doc_type]
    if segment.fiscal_period:
        parts.append(segment.fiscal_period)
    parts.append(segment.company_name)
    return "_".join(parts) + ".pdf"


def resolve_collision(filepath: Path) -> Path:
    """ファイル名の衝突を解決する。同名ファイルが存在する場合は連番を付加する。"""
    if not filepath.exists():
        return filepath

    stem = filepath.stem
    suffix = filepath.suffix
    parent = filepath.parent
    counter = 2

    while True:
        new_path = parent / f"{stem}_{counter}{suffix}"
        if not new_path.exists():
            return new_path
        counter += 1


def split_and_save(
    input_path: Path,
    segments: list[DocumentSegment],
    output_dir: Path,
) -> list[Path]:
    """PDFをセグメントごとに分割して保存する。

    Returns:
        作成されたファイルのパスのリスト
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    src_doc = fitz.open(str(input_path))
    created_files: list[Path] = []

    try:
        for segment in segments:
            filename = build_filename(segment)
            filepath = resolve_collision(output_dir / filename)

            dst_doc = fitz.open()
            try:
                dst_doc.insert_pdf(
                    src_doc,
                    from_page=segment.start_page,
                    to_page=segment.end_page,
                )
                dst_doc.save(str(filepath))
                created_files.append(filepath)

                page_count = segment.end_page - segment.start_page + 1
                logger.info(
                    "  -> %s (%dページ)", filepath.name, page_count
                )
            finally:
                dst_doc.close()
    finally:
        src_doc.close()

    return created_files
