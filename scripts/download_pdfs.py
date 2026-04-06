"""茨城県44市町村の評価倍率表PDFをまとめてダウンロードする.

国税庁路線価サイト (rosenka.nta.go.jp) の茨城県 city_frm.htm から
市町村一覧を取得し、各市町村の倍率表PDFを data/pdf_cache/ にキャッシュする。
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import httpx

BASE = "https://www.rosenka.nta.go.jp/main_r07/kanto/ibaraki/"
CITY_FRAME_URL = urljoin(BASE, "ratios/city_frm.htm")
PDF_URL_TEMPLATE = urljoin(BASE, "ratios/pdf/{code}rt.pdf")

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "pdf_cache"
LIST_FILE = ROOT / "data" / "ibaraki_municipality_list.json"

DELAY_SEC = 1.0
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; InheritanceTaxApp/1.0)"}


def fetch_municipality_list(client: httpx.Client) -> list[dict[str, str]]:
    """city_frm.htm から (コード, 市町村名) のリストを取得."""
    print(f"Fetching municipality list: {CITY_FRAME_URL}")
    resp = client.get(CITY_FRAME_URL, headers=HEADERS)
    resp.encoding = "cp932"
    html = resp.text

    # frameset → city list frame を辿る
    frame_match = re.search(r'<frame[^>]+src="([^"]*city[^"]*)"', html, re.I)
    if frame_match:
        list_url = urljoin(CITY_FRAME_URL, frame_match.group(1))
        if list_url != CITY_FRAME_URL:
            print(f"Following frame: {list_url}")
            resp = client.get(list_url, headers=HEADERS)
            resp.encoding = "cp932"
            html = resp.text

    # ([a-z]\d{5})rf パターンを抽出
    pattern = re.compile(
        r'href="([^"]*?([a-z]\d{5})rf[^"]*?)"[^>]*>\s*([^<]+?)\s*<', re.I,
    )
    seen: set[str] = set()
    municipalities: list[dict[str, str]] = []
    for _href, code, name in pattern.findall(html):
        if code in seen:
            continue
        seen.add(code)
        municipalities.append({"code": code, "name": name.strip()})
    return municipalities


def download_pdf(client: httpx.Client, code: str, name: str) -> tuple[bool, str]:
    out_path = CACHE_DIR / f"{code}rt.pdf"
    if out_path.exists() and out_path.stat().st_size > 0:
        return True, "cached"
    url = PDF_URL_TEMPLATE.format(code=code)
    try:
        resp = client.get(url, headers=HEADERS)
        if resp.status_code != 200 or not resp.content:
            return False, f"HTTP {resp.status_code}"
        out_path.write_bytes(resp.content)
        return True, f"{len(resp.content)} bytes"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def main() -> int:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        municipalities = fetch_municipality_list(client)
        if not municipalities:
            print("ERROR: 市町村一覧を取得できませんでした", file=sys.stderr)
            return 1
        print(f"Found {len(municipalities)} municipalities")
        LIST_FILE.parent.mkdir(parents=True, exist_ok=True)
        LIST_FILE.write_text(
            json.dumps(municipalities, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        ok = fail = 0
        for i, m in enumerate(municipalities, 1):
            success, info = download_pdf(client, m["code"], m["name"])
            mark = "OK" if success else "NG"
            print(f"[{i:3d}/{len(municipalities)}] {mark} {m['code']} {m['name']} - {info}")
            if success:
                ok += 1
            else:
                fail += 1
            if info != "cached":
                time.sleep(DELAY_SEC)
        print(f"\nDone. success={ok} failed={fail} total={len(municipalities)}")
        return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
