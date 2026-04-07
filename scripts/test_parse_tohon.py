"""parse_tohon() を直接呼び出してデバッグ.

使い方:
    python scripts/test_parse_tohon.py <PDFファイルパス>
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.services.document_parser import parse_tohon, _extract_text

if len(sys.argv) < 2:
    print("使い方: python scripts/test_parse_tohon.py <PDFファイルパス>")
    sys.exit(1)

pdf_path = Path(sys.argv[1])
print(f"=== parse_tohon テスト: {pdf_path} ===\n")

# 抽出生テキスト
text = _extract_text(pdf_path)
print(f"[抽出テキスト長: {len(text) if text else 0}]")
if text:
    print("--- 生テキスト（最初の40行）---")
    for i, line in enumerate(text.splitlines()[:40]):
        print(f"  {i:3d}: {repr(line)}")
    print()

# パーサー実行
lands, buildings = parse_tohon(pdf_path)
print(f"\n=== 結果 ===")
print(f"土地: {len(lands)} 件")
for i, land in enumerate(lands):
    print(f"  [{i}] location={land.location!r}")
    print(f"      chiban={land.chiban!r}")
    print(f"      chimoku_registry={land.chimoku_registry!r}")
    print(f"      area_registry_sqm={land.area_registry_sqm!r}")
print(f"建物: {len(buildings)} 件")
