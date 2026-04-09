"""FastAPI メインアプリケーション."""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates

from .config import config
from .excel.exporter import export_to_excel
from .models import (
    PropertyEvaluation,
    TohonLand, TohonBuilding,
    KoteiShisanLand, KoteiShisanBuilding,
    NochiDaicho,
)
from .services.document_parser import (
    parse_tohon, parse_kotei_shisan, parse_nochi_daicho,
    calculate_ownership,
    detect_prefecture_from_properties, detect_city_from_properties,
    extract_address_parts,
)
from .services.geocoder import geocode
from .services.nta_scraper import (
    fetch_multiplier_table,
    load_multipliers_json,
    lookup_from_saved_data,
    lookup_multiplier,
    resolve_municipality_code,
    save_multipliers_csv,
    save_multipliers_json,
    scrape_prefecture_multipliers,
)
from .services.reinfolib_client import ReinfolibClient
from .services.valuation import (
    calculate_valuation,
    check_consistency,
    select_valuation_chimoku,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="相続税土地評価 基礎情報収集アプリ")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

config.upload_dir.mkdir(parents=True, exist_ok=True)

DATA_DIR = BASE_DIR.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
PDF_CACHE_DIR = DATA_DIR / "pdf_cache"
PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
MANUAL_MULTIPLIER_FILE = DATA_DIR / "manual_multipliers.json"
IMPORTED_MULTIPLIER_FILE = DATA_DIR / "multipliers_imported.json"
MUNICIPALITY_LIST_FILE = DATA_DIR / "ibaraki_municipality_list.json"

reinfolib = ReinfolibClient()


# ------------------------------------------------------------------
# セッションデータ
# ------------------------------------------------------------------
@dataclass
class SessionData:
    tohon_lands: list[TohonLand] = field(default_factory=list)
    tohon_buildings: list[TohonBuilding] = field(default_factory=list)
    kotei_lands: list[KoteiShisanLand] = field(default_factory=list)
    kotei_buildings: list[KoteiShisanBuilding] = field(default_factory=list)
    nochi_daichos: list[NochiDaicho] = field(default_factory=list)
    evaluations: list[PropertyEvaluation] = field(default_factory=list)
    target_name: str = ""
    reference_date: str = ""


_sessions: dict[str, SessionData] = {}


@app.on_event("shutdown")
async def shutdown():
    await reinfolib.close()


# ------------------------------------------------------------------
# ページ表示
# ------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


# ------------------------------------------------------------------
# 書類アップロード（資料種別ごと）
# ------------------------------------------------------------------
@app.post("/api/upload_documents")
async def upload_documents(
    tohon_files: list[UploadFile] = File(default=[]),
    kotei_files: list[UploadFile] = File(default=[]),
    nochi_files: list[UploadFile] = File(default=[]),
    target_name: str = Form(default=""),
    reference_date: str = Form(default=""),
):
    """資料種別ごとにアップロード・解析."""
    session_id = str(uuid.uuid4())[:8]
    sd = SessionData(target_name=target_name, reference_date=reference_date)

    # 謄本
    for f in tohon_files:
        path = await _save_file(f, session_id)
        lands, buildings = parse_tohon(path)
        sd.tohon_lands.extend(lands)
        sd.tohon_buildings.extend(buildings)

    # 固定資産評価証明
    for f in kotei_files:
        path = await _save_file(f, session_id)
        lands, buildings = parse_kotei_shisan(path)
        sd.kotei_lands.extend(lands)
        sd.kotei_buildings.extend(buildings)

    # 農地台帳
    for f in nochi_files:
        path = await _save_file(f, session_id)
        entries = parse_nochi_daicho(path)
        sd.nochi_daichos.extend(entries)

    _sessions[session_id] = sd

    # 持分計算
    ownership_results = []
    if target_name:
        for tl in sd.tohon_lands:
            if tl.ownership_history:
                ores = calculate_ownership(tl.ownership_history, target_name, reference_date)
                ownership_results.append({
                    "location": tl.location,
                    "chiban": tl.chiban,
                    "current_share": ores.current_share,
                    "share_fraction": ores.share_fraction,
                    "history_summary": ores.history_summary,
                })

    # 都道府県・市区町村を自動検出
    all_props = sd.tohon_lands + sd.kotei_lands + sd.nochi_daichos
    detected_pref = detect_prefecture_from_properties(all_props)
    detected_city = detect_city_from_properties(all_props)

    return JSONResponse({
        "session_id": session_id,
        "detected_prefecture": detected_pref,
        "detected_city": detected_city,
        "tohon_lands": [_tohon_land_dict(tl) for tl in sd.tohon_lands],
        "tohon_buildings": [_tohon_building_dict(tb) for tb in sd.tohon_buildings],
        "kotei_lands": [_kotei_land_dict(kl) for kl in sd.kotei_lands],
        "kotei_buildings": [_kotei_building_dict(kb) for kb in sd.kotei_buildings],
        "nochi_daichos": [_nochi_dict(nd) for nd in sd.nochi_daichos],
        "ownership_results": ownership_results,
        "counts": {
            "tohon_land": len(sd.tohon_lands),
            "tohon_building": len(sd.tohon_buildings),
            "kotei_land": len(sd.kotei_lands),
            "kotei_building": len(sd.kotei_buildings),
            "nochi": len(sd.nochi_daichos),
        },
    })


# ------------------------------------------------------------------
# 手入力モード
# ------------------------------------------------------------------
@app.post("/api/manual_input")
async def manual_input(request: Request):
    """地番を手入力して物件情報を作成."""
    body = await request.json()
    entries = body.get("entries", [])
    session_id = str(uuid.uuid4())[:8]

    sd = SessionData(
        target_name=body.get("target_name", ""),
        reference_date=body.get("reference_date", ""),
    )

    for entry in entries:
        address = entry.get("address", "")
        tl = TohonLand(
            location=address,
            chiban=entry.get("chiban", ""),
            chimoku_registry=entry.get("chimoku", ""),
            area_registry_sqm=_to_float(entry.get("land_area_sqm")),
            source_file="手入力",
        )
        sd.tohon_lands.append(tl)

    _sessions[session_id] = sd

    all_props = sd.tohon_lands
    detected_pref = detect_prefecture_from_properties(all_props)
    detected_city = detect_city_from_properties(all_props)

    return JSONResponse({
        "session_id": session_id,
        "detected_prefecture": detected_pref,
        "detected_city": detected_city,
        "tohon_lands": [_tohon_land_dict(tl) for tl in sd.tohon_lands],
        "counts": {"tohon_land": len(sd.tohon_lands)},
    })


# ------------------------------------------------------------------
# 手入力: 固定資産情報・農地台帳の追加
# ------------------------------------------------------------------
@app.post("/api/manual_kotei_add")
async def manual_kotei_add(request: Request):
    """既存セッションに固定資産情報（土地・建物）を手入力で追加・上書き."""
    body = await request.json()
    session_id = body.get("session_id", "")
    sd = _sessions.get(session_id)
    if not sd:
        return JSONResponse({"error": "セッションが見つかりません"}, status_code=404)

    replace = bool(body.get("replace", False))
    if replace:
        sd.kotei_lands = []
        sd.kotei_buildings = []

    land_entries = body.get("lands", []) or []
    building_entries = body.get("buildings", []) or []

    added_lands = 0
    for entry in land_entries:
        location = (entry.get("location") or "").strip()
        chiban = (entry.get("chiban") or "").strip()
        if not location and not chiban:
            continue
        kl = KoteiShisanLand(
            location=location,
            chiban=chiban,
            chimoku_registry=(entry.get("chimoku_registry") or "").strip(),
            chimoku_tax=(entry.get("chimoku_tax") or "").strip(),
            area_registry_sqm=_to_float(entry.get("area_registry_sqm")),
            area_tax_sqm=_to_float(entry.get("area_tax_sqm")),
            assessed_value=_to_int(entry.get("assessed_value")),
            source_file="手入力",
        )
        sd.kotei_lands.append(kl)
        added_lands += 1

    added_buildings = 0
    for entry in building_entries:
        location = (entry.get("location") or "").strip()
        kaoku_bango = (entry.get("kaoku_bango") or "").strip()
        if not location and not kaoku_bango:
            continue
        kb = KoteiShisanBuilding(
            location=location,
            kaoku_bango=kaoku_bango,
            kind=(entry.get("kind") or "").strip(),
            structure=(entry.get("structure") or "").strip(),
            area_tax_sqm=_to_float(entry.get("area_tax_sqm")),
            assessed_value=_to_int(entry.get("assessed_value")),
            construction_year=(entry.get("construction_year") or "").strip(),
            source_file="手入力",
        )
        sd.kotei_buildings.append(kb)
        added_buildings += 1

    return JSONResponse({
        "session_id": session_id,
        "added_lands": added_lands,
        "added_buildings": added_buildings,
        "kotei_lands": [_kotei_land_dict(kl) for kl in sd.kotei_lands],
        "kotei_buildings": [_kotei_building_dict(kb) for kb in sd.kotei_buildings],
        "counts": {
            "kotei_land": len(sd.kotei_lands),
            "kotei_building": len(sd.kotei_buildings),
        },
    })


@app.post("/api/manual_nochi_add")
async def manual_nochi_add(request: Request):
    """既存セッションに農地台帳情報を手入力で追加・上書き."""
    body = await request.json()
    session_id = body.get("session_id", "")
    sd = _sessions.get(session_id)
    if not sd:
        return JSONResponse({"error": "セッションが見つかりません"}, status_code=404)

    replace = bool(body.get("replace", False))
    if replace:
        sd.nochi_daichos = []

    entries = body.get("entries", []) or []
    added = 0
    for entry in entries:
        location = (entry.get("location") or "").strip()
        chiban = (entry.get("chiban") or "").strip()
        if not location and not chiban:
            continue
        nd = NochiDaicho(
            location=location,
            chiban=chiban,
            chimoku=(entry.get("chimoku") or "").strip(),
            area_sqm=_to_float(entry.get("area_sqm")),
            farm_category=(entry.get("farm_category") or "").strip(),
            farmer_name=(entry.get("farmer_name") or "").strip(),
            right_type=(entry.get("right_type") or "").strip(),
            right_holder=(entry.get("right_holder") or "").strip(),
            source_file="手入力",
        )
        sd.nochi_daichos.append(nd)
        added += 1

    return JSONResponse({
        "session_id": session_id,
        "added": added,
        "nochi_daichos": [_nochi_dict(nd) for nd in sd.nochi_daichos],
        "counts": {"nochi": len(sd.nochi_daichos)},
    })


@app.post("/api/manual_tohon_add")
async def manual_tohon_add(request: Request):
    """既存セッションに謄本情報（土地）を手入力で追加."""
    body = await request.json()
    session_id = body.get("session_id", "")
    sd = _sessions.get(session_id)
    if not sd:
        return JSONResponse({"error": "セッションが見つかりません"}, status_code=404)

    replace = bool(body.get("replace", False))
    if replace:
        sd.tohon_lands = []

    entries = body.get("entries", []) or []
    added = 0
    for entry in entries:
        location = (entry.get("location") or "").strip()
        chiban = (entry.get("chiban") or "").strip()
        if not location and not chiban:
            continue
        tl = TohonLand(
            location=location,
            chiban=chiban,
            chimoku_registry=(entry.get("chimoku_registry") or "").strip(),
            area_registry_sqm=_to_float(entry.get("area_registry_sqm")),
            source_file="手入力",
        )
        sd.tohon_lands.append(tl)
        added += 1

    all_props = sd.tohon_lands + sd.kotei_lands + sd.nochi_daichos
    detected_pref = detect_prefecture_from_properties(all_props)
    detected_city = detect_city_from_properties(all_props)

    return JSONResponse({
        "session_id": session_id,
        "added": added,
        "detected_prefecture": detected_pref,
        "detected_city": detected_city,
        "tohon_lands": [_tohon_land_dict(tl) for tl in sd.tohon_lands],
        "counts": {"tohon_land": len(sd.tohon_lands)},
    })


# ------------------------------------------------------------------
# 評価情報取得
# ------------------------------------------------------------------
@app.post("/api/evaluate")
async def evaluate_properties(request: Request):
    """各不動産の基礎情報を外部API/スクレイピングから取得."""
    body = await request.json()
    session_id = body.get("session_id", "")
    prefecture = body.get("prefecture", "")
    city = body.get("city", "")

    sd = _sessions.get(session_id)
    if not sd:
        return JSONResponse({"error": "セッションが見つかりません"}, status_code=404)

    # 倍率表取得
    multiplier_rows = []
    municipality_code = ""
    if prefecture and city:
        try:
            municipality_code = await resolve_municipality_code(prefecture, city)
            if municipality_code:
                multiplier_rows = await fetch_multiplier_table(prefecture, municipality_code)
        except Exception as e:
            logger.warning("倍率表取得失敗: %s", e)

    # Excel取込済み倍率表を先読み
    imported_multipliers = _load_imported_multipliers()

    evaluations: list[PropertyEvaluation] = []
    prop_id = 0

    # 土地の評価情報構築
    for tl in sd.tohon_lands:
        prop_id += 1
        ev = PropertyEvaluation(property_id=prop_id, property_type="土地")
        ev.tohon_land = tl
        ev.address = f"{prefecture}{tl.location}{tl.chiban}"

        # 固定資産評価証明とのマッチング（所在+地番で）
        for kl in sd.kotei_lands:
            if _match_property(tl.location, tl.chiban, kl.location, kl.chiban):
                ev.kotei_land = kl
                break

        # 農地台帳とのマッチング
        for nd in sd.nochi_daichos:
            if _match_property(tl.location, tl.chiban, nd.location, nd.chiban):
                ev.nochi_daicho = nd
                break

        # 書類間整合性チェック
        ev.consistency_checks = check_consistency(ev.tohon_land, ev.kotei_land)

        # 持分計算
        if sd.target_name and tl.ownership_history:
            ev.ownership = calculate_ownership(
                tl.ownership_history, sd.target_name, sd.reference_date,
            )

        # ジオコーディング + API
        await _enrich_with_apis(ev, prefecture)

        # 倍率表
        _apply_multiplier(ev, prefecture, city, multiplier_rows, imported_multipliers)

        # 倍率方式 評価額算出
        _apply_valuation(ev, imported_multipliers, city)

        evaluations.append(ev)

    # 建物の評価情報
    for tb in sd.tohon_buildings:
        prop_id += 1
        ev = PropertyEvaluation(property_id=prop_id, property_type="建物")
        ev.tohon_building = tb
        ev.address = f"{prefecture}{tb.location}{tb.kaoku_bango}"

        # 固定資産評価証明の建物マッチング
        for kb in sd.kotei_buildings:
            if tb.kaoku_bango and tb.kaoku_bango in (kb.kaoku_bango or ""):
                ev.kotei_building = kb
                break

        if sd.target_name and tb.ownership_history:
            ev.ownership = calculate_ownership(
                tb.ownership_history, sd.target_name, sd.reference_date,
            )

        await _enrich_with_apis(ev, prefecture)
        evaluations.append(ev)

    sd.evaluations = evaluations
    _sessions[session_id] = sd

    return JSONResponse({
        "session_id": session_id,
        "municipality_code": municipality_code,
        "evaluations": [_evaluation_to_dict(ev) for ev in evaluations],
    })


# ------------------------------------------------------------------
# 倍率表バッチスクレイピング
# ------------------------------------------------------------------
@app.post("/api/scrape_multipliers")
async def scrape_multipliers(request: Request):
    body = await request.json()
    prefecture = body.get("prefecture", "茨城県")
    pref_key = _pref_key(prefecture)
    json_path = DATA_DIR / f"{pref_key}_multipliers.json"
    csv_path = DATA_DIR / f"{pref_key}_multipliers.csv"

    try:
        records = await scrape_prefecture_multipliers(prefecture)
        if not records:
            return JSONResponse({"error": f"{prefecture}の倍率表を取得できませんでした"}, status_code=500)
        save_multipliers_json(records, prefecture, json_path)
        save_multipliers_csv(records, csv_path)
        cities = set(r["municipality"] for r in records)
        rosenka_count = sum(1 for r in records if r["is_rosenka_area"])
        return JSONResponse({
            "prefecture": prefecture,
            "total_records": len(records),
            "municipality_count": len(cities),
            "rosenka_count": rosenka_count,
            "bairitsu_count": len(records) - rosenka_count,
        })
    except Exception as e:
        logger.error("スクレイピング失敗: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/multiplier_data/{prefecture}")
async def get_multiplier_data(prefecture: str):
    json_path = DATA_DIR / f"{_pref_key(prefecture)}_multipliers.json"
    data = load_multipliers_json(json_path)
    if not data:
        return JSONResponse({"error": f"{prefecture}の倍率データが見つかりません"}, status_code=404)
    return JSONResponse(data)


@app.get("/api/multiplier_lookup")
async def multiplier_lookup(prefecture: str, city: str, town: str):
    json_path = DATA_DIR / f"{_pref_key(prefecture)}_multipliers.json"
    data = load_multipliers_json(json_path)
    if not data:
        return JSONResponse({"error": f"{prefecture}の倍率データが見つかりません"}, status_code=404)
    info = lookup_from_saved_data(data, city, town)
    return JSONResponse({
        "town_name": info.town_name, "area_name": info.area_name,
        "leasehold_ratio": info.leasehold_ratio, "is_rosenka_area": info.is_rosenka_area,
        "residential_multiplier": info.residential_multiplier,
        "paddy_multiplier": info.paddy_multiplier, "field_multiplier": info.field_multiplier,
        "forest_multiplier": info.forest_multiplier, "wasteland_multiplier": info.wasteland_multiplier,
    })


# ------------------------------------------------------------------
# 倍率表PDF / 手入力データ
# ------------------------------------------------------------------
@app.get("/api/multiplier_pdf/{municipality_code}")
async def get_multiplier_pdf(municipality_code: str):
    """ダウンロード済み倍率表PDFを返す."""
    code = municipality_code.lower().replace("rt", "").replace(".pdf", "")
    pdf_path = PDF_CACHE_DIR / f"{code}rt.pdf"
    if not pdf_path.exists():
        return JSONResponse({"error": f"PDFが見つかりません: {code}"}, status_code=404)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={code}rt.pdf"},
    )


@app.get("/api/municipality_list")
async def get_municipality_list():
    """ダウンロード済みPDFキャッシュ + 保存済み市町村一覧を返す."""
    import json as _json

    saved: list[dict[str, str]] = []
    if MUNICIPALITY_LIST_FILE.exists():
        try:
            saved = _json.loads(MUNICIPALITY_LIST_FILE.read_text(encoding="utf-8"))
        except Exception:
            saved = []

    cached_codes = {
        p.stem.replace("rt", "")
        for p in PDF_CACHE_DIR.glob("*rt.pdf")
    }

    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for m in saved:
        code = m.get("code", "")
        items.append({
            "code": code,
            "name": m.get("name", code),
            "cached": code in cached_codes,
        })
        seen.add(code)
    for code in sorted(cached_codes):
        if code not in seen:
            items.append({"code": code, "name": code, "cached": True})

    return JSONResponse({"municipalities": items, "cached_count": len(cached_codes)})


@app.post("/api/save_multiplier")
async def save_multiplier(request: Request):
    """手入力された倍率データを保存."""
    import json as _json

    body = await request.json()
    municipality = (body.get("municipality") or "").strip()
    if not municipality:
        return JSONResponse({"error": "municipality is required"}, status_code=400)

    record = {
        "town_name": body.get("town_name", ""),
        "area_name": body.get("area_name", ""),
        "leasehold_ratio": body.get("leasehold_ratio", ""),
        "residential": body.get("residential", ""),
        "paddy": body.get("paddy", ""),
        "field": body.get("field", ""),
        "forest": body.get("forest", ""),
        "wasteland": body.get("wasteland", ""),
    }

    data: dict[str, list[dict[str, Any]]] = {}
    if MANUAL_MULTIPLIER_FILE.exists():
        try:
            data = _json.loads(MANUAL_MULTIPLIER_FILE.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    data.setdefault(municipality, []).append(record)
    MANUAL_MULTIPLIER_FILE.write_text(
        _json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    return JSONResponse({"ok": True, "count": len(data[municipality]), "record": record})


@app.get("/api/multipliers/{municipality}")
async def get_manual_multipliers(municipality: str):
    """保存済み倍率データを返す（Excel取込 + 手入力をマージ）."""
    import json as _json

    records: list[dict[str, Any]] = []

    # Excel取込データ
    if IMPORTED_MULTIPLIER_FILE.exists():
        try:
            imported = _json.loads(IMPORTED_MULTIPLIER_FILE.read_text(encoding="utf-8"))
            for r in imported.get(municipality, []):
                records.append({**r, "source": "imported"})
        except Exception:
            pass

    # 手入力データ
    if MANUAL_MULTIPLIER_FILE.exists():
        try:
            manual = _json.loads(MANUAL_MULTIPLIER_FILE.read_text(encoding="utf-8"))
            for r in manual.get(municipality, []):
                records.append({**r, "source": "manual"})
        except Exception:
            pass

    return JSONResponse({"municipality": municipality, "records": records})


@app.get("/api/imported_municipalities")
async def get_imported_municipalities():
    """Excel取込済みの市町村一覧を返す."""
    import json as _json

    if not IMPORTED_MULTIPLIER_FILE.exists():
        return JSONResponse({"municipalities": []})
    try:
        data = _json.loads(IMPORTED_MULTIPLIER_FILE.read_text(encoding="utf-8"))
    except Exception:
        return JSONResponse({"municipalities": []})

    items = [
        {"name": name, "count": len(records)}
        for name, records in sorted(data.items())
    ]
    return JSONResponse({"municipalities": items})


@app.get("/api/lookup_multiplier")
async def lookup_multiplier_endpoint(
    municipality: str,
    town_name: str = "",
    chimoku: str = "",
):
    """市町村+町名+地目から倍率候補を返す.

    Args:
        municipality: 市町村名 (例: 水戸市)
        town_name: 町名 (例: 加倉井町) — 部分一致
        chimoku: 地目 (宅地/田/畑/山林/原野)
    """
    import json as _json

    if not IMPORTED_MULTIPLIER_FILE.exists():
        return JSONResponse({"candidates": [], "error": "倍率表データが未取込"})

    try:
        data = _json.loads(IMPORTED_MULTIPLIER_FILE.read_text(encoding="utf-8"))
    except Exception:
        return JSONResponse({"candidates": [], "error": "倍率表データ読込失敗"})

    records = data.get(municipality, [])
    if not records:
        return JSONResponse({
            "candidates": [],
            "error": f"{municipality} の倍率データが未取込",
        })

    # 町名部分一致フィルタ
    if town_name:
        filtered = [r for r in records if town_name in r.get("town_name", "")]
        if not filtered:
            # 前方一致フォールバック
            filtered = [r for r in records if r.get("town_name", "").startswith(town_name)]
    else:
        filtered = records

    # 地目別倍率キー
    chimoku_key_map = {
        "宅地": "residential",
        "田": "paddy",
        "畑": "field",
        "山林": "forest",
        "原野": "wasteland",
        "牧場": "pasture",
        "池沼": "pond",
    }
    target_key = chimoku_key_map.get(chimoku, "")

    candidates = []
    for r in filtered:
        c = dict(r)
        if target_key:
            c["selected_multiplier"] = r.get(target_key, "")
            c["selected_chimoku"] = chimoku
        candidates.append(c)

    return JSONResponse({
        "municipality": municipality,
        "town_name": town_name,
        "chimoku": chimoku,
        "candidates": candidates[:50],  # 最大50件
        "total": len(candidates),
    })


# ------------------------------------------------------------------
# Excel出力
# ------------------------------------------------------------------
@app.get("/api/export/{session_id}")
async def export_excel(session_id: str):
    sd = _sessions.get(session_id)
    if not sd or not sd.evaluations:
        return JSONResponse({"error": "セッションデータが見つかりません"}, status_code=404)
    excel_bytes = export_to_excel(sd.evaluations)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=inheritance_tax_eval_{session_id}.xlsx"},
    )


# ------------------------------------------------------------------
# ヘルパー
# ------------------------------------------------------------------
async def _save_file(f: UploadFile, session_id: str) -> Path:
    path = config.upload_dir / f"{session_id}_{f.filename}"
    content = await f.read()
    path.write_bytes(content)
    return path


def _to_float(value: Any) -> float | None:
    """文字列・数値を float に変換（カンマ・空白を許容）."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        s = str(value).strip().replace(",", "").replace(" ", "")
        if not s:
            return None
        return float(s)
    except (ValueError, TypeError):
        return None


def _to_int(value: Any) -> int | None:
    """文字列・数値を int に変換（カンマ・空白・小数点を許容）."""
    if value is None or value == "":
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        s = str(value).strip().replace(",", "").replace(" ", "").replace("円", "")
        if not s:
            return None
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _pref_key(prefecture: str) -> str:
    return prefecture.replace("都", "").replace("府", "").replace("県", "").replace("道", "")


def _match_property(loc1: str, chiban1: str, loc2: str, chiban2: str) -> bool:
    """所在+地番で同一物件か判定（部分一致）."""
    if not loc1 or not loc2:
        return False
    loc_match = loc1 in loc2 or loc2 in loc1
    chiban_match = chiban1 and chiban2 and (chiban1 in chiban2 or chiban2 in chiban1)
    return loc_match and chiban_match


def _extract_town_name(location: str, chiban: str) -> str:
    combined = location + chiban
    m = re.search(r"([^\d市区郡県都府道]+?[町丁村])", combined)
    if m:
        return m.group(1)
    m = re.search(r"(大字\S+)", combined)
    if m:
        return m.group(1)
    return location


async def _enrich_with_apis(ev: PropertyEvaluation, prefecture: str):
    """ジオコーディング + reinfolib API で情報を付加."""
    address = ev.address
    if not address:
        return

    coords = await geocode(address)
    if coords:
        ev.latitude, ev.longitude = coords
        ev.data_sources.append("国土地理院ジオコーディング")
        try:
            zoning, urban_area, hazard = await asyncio.gather(
                reinfolib.get_zoning(ev.latitude, ev.longitude),
                reinfolib.get_urban_planning_area(ev.latitude, ev.longitude),
                reinfolib.get_hazard_info(ev.latitude, ev.longitude),
                return_exceptions=True,
            )
            if not isinstance(zoning, Exception):
                ev.zoning = zoning
                ev.zoning.urban_planning_area = urban_area if isinstance(urban_area, str) else ""
                ev.data_sources.append("不動産情報ライブラリAPI")
            if not isinstance(hazard, Exception):
                ev.hazard = hazard
                ev.data_sources.append("不動産情報ライブラリAPI (ハザード)")
        except Exception as e:
            ev.notes.append(f"API取得エラー: {e}")
    else:
        ev.notes.append("住所から座標を特定できませんでした")


def _load_imported_multipliers() -> dict[str, list[dict[str, Any]]]:
    """Excel取込済み倍率表を読み込む."""
    import json as _json

    if not IMPORTED_MULTIPLIER_FILE.exists():
        return {}
    try:
        return _json.loads(IMPORTED_MULTIPLIER_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _lookup_imported_multiplier(
    imported_data: dict[str, list[dict[str, Any]]],
    city: str,
    town: str,
) -> dict[str, Any] | None:
    """Excel取込倍率表から市町村+町名で1件抽出（部分一致）."""
    if not city or not town:
        return None
    records = imported_data.get(city, [])
    if not records:
        return None
    # 町名部分一致
    for r in records:
        if town in r.get("town_name", ""):
            return r
    # 前方一致
    for r in records:
        if r.get("town_name", "").startswith(town):
            return r
    return None


def _apply_multiplier(
    ev: PropertyEvaluation,
    prefecture: str,
    city: str,
    multiplier_rows,
    imported_data: dict[str, list[dict[str, Any]]] | None = None,
):
    """倍率表情報を適用（Excel取込データ最優先）."""
    location = ev.location or ""
    chiban = ev.chiban or ""
    town = _extract_town_name(location, chiban)
    if not town or not prefecture:
        return

    # 1. Excel取込データ最優先
    if imported_data:
        rec = _lookup_imported_multiplier(imported_data, city, town)
        if rec:
            ev.multiplier.town_name = rec.get("town_name", "")
            ev.multiplier.area_name = rec.get("area_name", "")
            ev.multiplier.leasehold_ratio = rec.get("leasehold_ratio", "")
            ev.multiplier.residential_multiplier = rec.get("residential", "")
            ev.multiplier.paddy_multiplier = rec.get("paddy", "")
            ev.multiplier.field_multiplier = rec.get("field", "")
            ev.multiplier.forest_multiplier = rec.get("forest", "")
            ev.multiplier.wasteland_multiplier = rec.get("wasteland", "")
            ev.multiplier.is_rosenka_area = False
            ev.data_sources.append("国税庁 評価倍率表（Excel取込）")
            return

    # 2. 保存済みスクレイピングデータ
    saved_data = load_multipliers_json(DATA_DIR / f"{_pref_key(prefecture)}_multipliers.json")
    if saved_data and city:
        ev.multiplier = lookup_from_saved_data(saved_data, city, town)
        if ev.multiplier.town_name:
            ev.data_sources.append("国税庁 評価倍率表（保存済み）")
            return

    # 3. リアルタイムスクレイピングの結果
    if multiplier_rows:
        from .services.nta_scraper import lookup_multiplier as _lookup
        ev.multiplier = _lookup(multiplier_rows, town)
        ev.data_sources.append("国税庁 評価倍率表")


def _apply_valuation(
    ev: PropertyEvaluation,
    imported_data: dict[str, list[dict[str, Any]]] | None,
    city: str,
):
    """倍率方式による相続税評価額を計算して ev.valuation にセット."""
    if ev.property_type != "土地":
        return
    if not imported_data or not city:
        return

    # 倍率表レコード取得
    town = _extract_town_name(ev.location or "", ev.chiban or "")
    if not town:
        return
    rec = _lookup_imported_multiplier(imported_data, city, town)
    if not rec:
        return

    chimoku = select_valuation_chimoku(ev)
    if not chimoku:
        ev.notes.append("評価地目が不明のため倍率方式の計算をスキップしました")
        return

    share = ev.ownership.share_fraction if ev.ownership else None
    ev.valuation = calculate_valuation(
        assessed_value=ev.assessed_value,
        chimoku=chimoku,
        multiplier_record=rec,
        share_fraction=share,
    )


# ------------------------------------------------------------------
# シリアライズ
# ------------------------------------------------------------------
def _tohon_land_dict(tl: TohonLand) -> dict:
    return {
        "location": tl.location, "chiban": tl.chiban,
        "chimoku_registry": tl.chimoku_registry,
        "area_registry_sqm": tl.area_registry_sqm,
        "ownership_history": [
            {"registration_date": e.registration_date, "cause": e.cause,
             "entry_type": e.entry_type, "owner_name": e.owner_name, "share": e.share}
            for e in tl.ownership_history
        ],
        "other_rights": [
            {"registration_date": e.registration_date, "right_type": e.right_type,
             "holder": e.holder, "details": e.details}
            for e in tl.other_rights
        ],
        "source_file": tl.source_file,
    }


def _tohon_building_dict(tb: TohonBuilding) -> dict:
    return {
        "location": tb.location, "kaoku_bango": tb.kaoku_bango,
        "kind": tb.kind, "structure": tb.structure,
        "floor_areas": [{"floor": fa.floor, "area_sqm": fa.area_sqm} for fa in tb.floor_areas],
        "source_file": tb.source_file,
    }


def _kotei_land_dict(kl: KoteiShisanLand) -> dict:
    return {
        "location": kl.location, "chiban": kl.chiban,
        "chimoku_registry": kl.chimoku_registry,
        "chimoku_tax": kl.chimoku_tax,
        "area_registry_sqm": kl.area_registry_sqm,
        "area_tax_sqm": kl.area_tax_sqm,
        "assessed_value": kl.assessed_value, "source_file": kl.source_file,
    }


def _kotei_building_dict(kb: KoteiShisanBuilding) -> dict:
    return {
        "location": kb.location, "kaoku_bango": kb.kaoku_bango,
        "kind": kb.kind, "structure": kb.structure,
        "area_tax_sqm": kb.area_tax_sqm, "assessed_value": kb.assessed_value,
        "construction_year": kb.construction_year, "source_file": kb.source_file,
    }


def _nochi_dict(nd: NochiDaicho) -> dict:
    return {
        "location": nd.location, "chiban": nd.chiban,
        "chimoku": nd.chimoku, "area_sqm": nd.area_sqm,
        "farm_category": nd.farm_category, "farmer_name": nd.farmer_name,
        "right_type": nd.right_type, "right_holder": nd.right_holder,
    }


def _evaluation_to_dict(ev: PropertyEvaluation) -> dict[str, Any]:
    d: dict[str, Any] = {
        "property_id": ev.property_id,
        "property_type": ev.property_type,
        "address": ev.address,
        "latitude": ev.latitude,
        "longitude": ev.longitude,
        # 登記情報
        "chimoku_registry": ev.chimoku_registry,
        "chimoku_tax": ev.chimoku_tax,
        "area_registry_sqm": ev.area_registry_sqm,
        "area_tax_sqm": ev.area_tax_sqm,
        "assessed_value": ev.assessed_value,
        # 持分
        "ownership": {
            "target_name": ev.ownership.target_name,
            "reference_date": ev.ownership.reference_date,
            "current_share": ev.ownership.current_share,
            "share_fraction": ev.ownership.share_fraction,
            "history_summary": ev.ownership.history_summary,
        },
        # 建物情報
        "building": None,
        # 農地情報
        "nochi": None,
        # 用途地域
        "zoning": {
            "zone_type": ev.zoning.zone_type,
            "building_coverage_ratio": ev.zoning.building_coverage_ratio,
            "floor_area_ratio": ev.zoning.floor_area_ratio,
            "urban_planning_area": ev.zoning.urban_planning_area,
        },
        "road": {
            "road_width_m": ev.road.road_width_m,
            "road_direction": ev.road.road_direction,
            "road_type": ev.road.road_type,
        },
        "hazard": {
            "flood_risk": ev.hazard.flood_risk,
            "landslide_risk": ev.hazard.landslide_risk,
            "tsunami_risk": ev.hazard.tsunami_risk,
            "storm_surge_risk": ev.hazard.storm_surge_risk,
        },
        "multiplier": {
            "is_rosenka_area": ev.multiplier.is_rosenka_area,
            "residential_multiplier": ev.multiplier.residential_multiplier,
            "paddy_multiplier": ev.multiplier.paddy_multiplier,
            "field_multiplier": ev.multiplier.field_multiplier,
            "forest_multiplier": ev.multiplier.forest_multiplier,
            "wasteland_multiplier": ev.multiplier.wasteland_multiplier,
            "leasehold_ratio": ev.multiplier.leasehold_ratio,
            "area_name": ev.multiplier.area_name,
            "town_name": ev.multiplier.town_name,
        },
        "valuation": None,
        "consistency_checks": [
            {
                "field_name": c.field_name,
                "tohon_value": c.tohon_value,
                "other_value": c.other_value,
                "other_source": c.other_source,
                "is_match": c.is_match,
                "message": c.message,
            }
            for c in ev.consistency_checks
        ],
        "data_sources": ev.data_sources,
        "notes": ev.notes,
    }

    # 倍率方式 評価結果
    if ev.valuation:
        v = ev.valuation
        d["valuation"] = {
            "method": v.method,
            "chimoku_used": v.chimoku_used,
            "multiplier_raw": v.multiplier_raw,
            "multiplier_value": v.multiplier_value,
            "multiplier_prefix": v.multiplier_prefix,
            "assessed_value": v.assessed_value,
            "evaluated_value": v.evaluated_value,
            "share_fraction": v.share_fraction,
            "final_value": v.final_value,
            "town_name": v.town_name,
            "area_name": v.area_name,
            "leasehold_ratio": v.leasehold_ratio,
            "formula": v.formula,
            "warnings": v.warnings,
        }

    # 建物情報
    if ev.tohon_building:
        tb = ev.tohon_building
        d["building"] = {
            "kaoku_bango": tb.kaoku_bango, "kind": tb.kind, "structure": tb.structure,
            "floor_areas": [{"floor": fa.floor, "area_sqm": fa.area_sqm} for fa in tb.floor_areas],
            "area_tax_sqm": ev.kotei_building.area_tax_sqm if ev.kotei_building else None,
            "assessed_value": ev.kotei_building.assessed_value if ev.kotei_building else None,
            "construction_year": ev.kotei_building.construction_year if ev.kotei_building else "",
        }

    # 農地情報
    if ev.nochi_daicho:
        nd = ev.nochi_daicho
        d["nochi"] = {
            "farm_category": nd.farm_category, "farmer_name": nd.farmer_name,
            "right_type": nd.right_type, "right_holder": nd.right_holder,
        }

    # 甲区要約
    if ev.tohon_land and ev.tohon_land.ownership_history:
        d["ownership_history"] = [
            {"registration_date": e.registration_date, "cause": e.cause,
             "entry_type": e.entry_type, "owner_name": e.owner_name, "share": e.share}
            for e in ev.tohon_land.ownership_history
        ]

    # 乙区要約
    if ev.tohon_land and ev.tohon_land.other_rights:
        d["other_rights"] = [
            {"registration_date": e.registration_date, "right_type": e.right_type,
             "holder": e.holder, "details": e.details}
            for e in ev.tohon_land.other_rights
        ]

    return d
