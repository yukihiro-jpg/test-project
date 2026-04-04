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
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates

from .config import config
from .excel.exporter import export_to_excel
from .models import (
    KoteiShisanBuilding,
    KoteiShisanLand,
    NayosechoBuilding,
    NayosechoLand,
    NochiDaicho,
    PropertyEvaluation,
    TohonBuilding,
    TohonLand,
)
from .services.document_parser import (
    calculate_ownership,
    detect_city_from_properties,
    detect_prefecture_from_properties,
    extract_address_parts,
    parse_kotei_shisan,
    parse_nayosecho,
    parse_nochi_daicho,
    parse_tohon,
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="相続税土地評価 基礎情報収集アプリ")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

config.upload_dir.mkdir(parents=True, exist_ok=True)

DATA_DIR = BASE_DIR.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

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
    nayosecho_lands: list[NayosechoLand] = field(default_factory=list)
    nayosecho_buildings: list[NayosechoBuilding] = field(default_factory=list)
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
    return templates.TemplateResponse("index.html", {"request": request})


# ------------------------------------------------------------------
# 書類アップロード（資料種別ごと）
# ------------------------------------------------------------------
@app.post("/api/upload_documents")
async def upload_documents(
    tohon_files: list[UploadFile] = File(default=[]),
    kotei_files: list[UploadFile] = File(default=[]),
    nayosecho_files: list[UploadFile] = File(default=[]),
    nochi_files: list[UploadFile] = File(default=[]),
    target_name: str = Form(default=""),
    reference_date: str = Form(default=""),
):
    """4種類の書類を資料種別ごとにアップロード・解析."""
    session_id = str(uuid.uuid4())[:8]
    sd = SessionData(target_name=target_name, reference_date=reference_date)

    async def save_file(f: UploadFile) -> Path:
        path = config.upload_dir / f"{session_id}_{f.filename}"
        path.write_bytes(await f.read())
        return path

    # 謄本
    for f in tohon_files:
        path = await save_file(f)
        lands, buildings = parse_tohon(path)
        sd.tohon_lands.extend(lands)
        sd.tohon_buildings.extend(buildings)

    # 固定資産評価証明
    for f in kotei_files:
        path = await save_file(f)
        lands, buildings = parse_kotei_shisan(path)
        sd.kotei_lands.extend(lands)
        sd.kotei_buildings.extend(buildings)

    # 名寄帳
    for f in nayosecho_files:
        path = await save_file(f)
        lands, buildings = parse_nayosecho(path)
        sd.nayosecho_lands.extend(lands)
        sd.nayosecho_buildings.extend(buildings)

    # 農地台帳
    for f in nochi_files:
        path = await save_file(f)
        entries = parse_nochi_daicho(path)
        sd.nochi_daichos.extend(entries)

    # 持分計算
    ownership_results = {}
    if target_name:
        for i, tl in enumerate(sd.tohon_lands):
            if tl.ownership_history:
                result = calculate_ownership(
                    tl.ownership_history, target_name, reference_date
                )
                ownership_results[f"land_{i}"] = {
                    "location": tl.location,
                    "chiban": tl.chiban,
                    "share": result.current_share,
                    "fraction": result.share_fraction,
                    "history": result.history_summary,
                }

    # 都道府県・市区町村自動検出
    all_props = sd.tohon_lands + sd.kotei_lands + sd.nayosecho_lands + sd.nochi_daichos
    detected_pref = detect_prefecture_from_properties(all_props)
    detected_city = detect_city_from_properties(all_props)

    _sessions[session_id] = sd

    return JSONResponse({
        "session_id": session_id,
        "detected_prefecture": detected_pref,
        "detected_city": detected_city,
        "target_name": target_name,
        "reference_date": reference_date,
        "parsed": {
            "tohon_lands": [_tohon_land_dict(t) for t in sd.tohon_lands],
            "tohon_buildings": [_tohon_building_dict(b) for b in sd.tohon_buildings],
            "kotei_lands": [_kotei_land_dict(k) for k in sd.kotei_lands],
            "kotei_buildings": [_kotei_building_dict(b) for b in sd.kotei_buildings],
            "nayosecho_lands": [_nayosecho_land_dict(n) for n in sd.nayosecho_lands],
            "nayosecho_buildings": [_nayosecho_building_dict(b) for b in sd.nayosecho_buildings],
            "nochi_daichos": [_nochi_dict(n) for n in sd.nochi_daichos],
        },
        "ownership_results": ownership_results,
        "counts": {
            "tohon_land": len(sd.tohon_lands),
            "tohon_building": len(sd.tohon_buildings),
            "kotei_land": len(sd.kotei_lands),
            "kotei_building": len(sd.kotei_buildings),
            "nayosecho_land": len(sd.nayosecho_lands),
            "nayosecho_building": len(sd.nayosecho_buildings),
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
    sd = SessionData()

    for entry in entries:
        address = entry.get("address", "")
        tl = TohonLand(
            location=address,
            chiban=entry.get("chiban", ""),
            chimoku_registry=entry.get("chimoku", ""),
            area_registry_sqm=entry.get("land_area_sqm"),
            source_file="手入力",
        )
        sd.tohon_lands.append(tl)

    all_props = sd.tohon_lands
    detected_pref = detect_prefecture_from_properties(all_props)
    detected_city = detect_city_from_properties(all_props)

    _sessions[session_id] = sd

    return JSONResponse({
        "session_id": session_id,
        "detected_prefecture": detected_pref,
        "detected_city": detected_city,
        "parsed": {
            "tohon_lands": [_tohon_land_dict(t) for t in sd.tohon_lands],
            "tohon_buildings": [],
            "kotei_lands": [],
            "kotei_buildings": [],
            "nayosecho_lands": [],
            "nayosecho_buildings": [],
            "nochi_daichos": [],
        },
        "counts": {
            "tohon_land": len(sd.tohon_lands),
            "tohon_building": 0,
            "kotei_land": 0,
            "kotei_building": 0,
            "nayosecho_land": 0,
            "nayosecho_building": 0,
            "nochi": 0,
        },
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
            # 保存済みデータ優先
            pref_key = prefecture.replace("都", "").replace("府", "").replace("県", "").replace("道", "")
            saved_data = load_multipliers_json(DATA_DIR / f"{pref_key}_multipliers.json")
            if not saved_data:
                municipality_code = await resolve_municipality_code(prefecture, city)
                if municipality_code:
                    multiplier_rows = await fetch_multiplier_table(prefecture, municipality_code)
        except Exception as e:
            logger.warning("倍率表取得失敗: %s", e)

    evaluations: list[PropertyEvaluation] = []
    prop_id = 0

    # 土地の評価（謄本ベース、他の書類をマッチ）
    for tl in sd.tohon_lands:
        prop_id += 1
        ev = PropertyEvaluation(
            property_id=prop_id,
            property_type="土地",
            address=f"{tl.location} {tl.chiban}".strip(),
            tohon_land=tl,
        )

        # 固定資産評価証明とマッチ（所在+地番）
        for kl in sd.kotei_lands:
            if _match_property(tl.location, tl.chiban, kl.location, kl.chiban):
                ev.kotei_land = kl
                break

        # 名寄帳とマッチ
        for nl in sd.nayosecho_lands:
            if _match_property(tl.location, tl.chiban, nl.location, nl.chiban):
                ev.nayosecho_land = nl
                break

        # 農地台帳とマッチ
        for nd in sd.nochi_daichos:
            if _match_property(tl.location, tl.chiban, nd.location, nd.chiban):
                ev.nochi_daicho = nd
                break

        # 持分計算
        if sd.target_name and tl.ownership_history:
            ev.ownership = calculate_ownership(
                tl.ownership_history, sd.target_name, sd.reference_date
            )

        ev.data_sources.append("謄本（全部事項証明書）")
        if ev.kotei_land:
            ev.data_sources.append("固定資産評価証明")
        if ev.nayosecho_land:
            ev.data_sources.append("名寄帳")
        if ev.nochi_daicho:
            ev.data_sources.append("農地台帳")

        # ジオコーディング + API
        await _enrich_with_api(ev, prefecture, city, saved_data, multiplier_rows)

        evaluations.append(ev)

    # 謄本にない固定資産評価証明のみの土地
    matched_kotei = {id(ev.kotei_land) for ev in evaluations if ev.kotei_land}
    for kl in sd.kotei_lands:
        if id(kl) not in matched_kotei:
            prop_id += 1
            ev = PropertyEvaluation(
                property_id=prop_id,
                property_type="土地",
                address=f"{kl.location} {kl.chiban}".strip(),
                kotei_land=kl,
            )
            ev.data_sources.append("固定資産評価証明")
            await _enrich_with_api(ev, prefecture, city, saved_data, multiplier_rows)
            evaluations.append(ev)

    # 建物の評価
    for tb in sd.tohon_buildings:
        prop_id += 1
        ev = PropertyEvaluation(
            property_id=prop_id,
            property_type="建物",
            address=f"{tb.location} {tb.kaoku_bango}".strip(),
            tohon_building=tb,
        )
        # 固定資産評価証明とマッチ
        for kb in sd.kotei_buildings:
            if tb.kaoku_bango and tb.kaoku_bango in (kb.kaoku_bango or ""):
                ev.kotei_building = kb
                break
        ev.data_sources.append("謄本（全部事項証明書）")
        if ev.kotei_building:
            ev.data_sources.append("固定資産評価証明")
        evaluations.append(ev)

    sd.evaluations = evaluations
    _sessions[session_id] = sd

    return JSONResponse({
        "session_id": session_id,
        "municipality_code": municipality_code,
        "evaluations": [_evaluation_to_dict(ev) for ev in evaluations],
    })


async def _enrich_with_api(
    ev: PropertyEvaluation,
    prefecture: str,
    city: str,
    saved_data: dict,
    multiplier_rows: list,
):
    """ジオコーディング + reinfolib API + 倍率表で情報を補完."""
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
        except Exception as e:
            ev.notes.append(f"API取得エラー: {e}")
    else:
        ev.notes.append("住所から座標を特定できませんでした")

    # 倍率表
    town = _extract_town_name(ev.location, ev.chiban)
    if town and prefecture:
        if saved_data and city:
            ev.multiplier = lookup_from_saved_data(saved_data, city, town)
            if ev.multiplier.town_name:
                ev.data_sources.append("国税庁 評価倍率表（保存済みデータ）")
        elif multiplier_rows:
            ev.multiplier = lookup_multiplier(multiplier_rows, town)
            ev.data_sources.append("国税庁 評価倍率表")


# ------------------------------------------------------------------
# 倍率表バッチスクレイピング
# ------------------------------------------------------------------
@app.post("/api/scrape_multipliers")
async def scrape_multipliers(request: Request):
    body = await request.json()
    prefecture = body.get("prefecture", "茨城県")
    pref_key = prefecture.replace("都", "").replace("府", "").replace("県", "").replace("道", "")
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
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/multiplier_data/{prefecture}")
async def get_multiplier_data(prefecture: str):
    pref_key = prefecture.replace("都", "").replace("府", "").replace("県", "").replace("道", "")
    data = load_multipliers_json(DATA_DIR / f"{pref_key}_multipliers.json")
    if not data:
        return JSONResponse({"error": f"{prefecture}の倍率データが見つかりません"}, status_code=404)
    return JSONResponse(data)


@app.get("/api/multiplier_lookup")
async def multiplier_lookup(prefecture: str, city: str, town: str):
    pref_key = prefecture.replace("都", "").replace("府", "").replace("県", "").replace("道", "")
    data = load_multipliers_json(DATA_DIR / f"{pref_key}_multipliers.json")
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
        headers={"Content-Disposition": f"attachment; filename=eval_{session_id}.xlsx"},
    )


# ------------------------------------------------------------------
# ヘルパー
# ------------------------------------------------------------------
def _match_property(loc1: str, chiban1: str, loc2: str, chiban2: str) -> bool:
    """2つの不動産が同一筆かを判定（部分一致）."""
    if not loc1 and not loc2:
        return False
    loc_match = loc1 in loc2 or loc2 in loc1 if (loc1 and loc2) else False
    chiban_match = chiban1 == chiban2 if (chiban1 and chiban2) else False
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


# ------------------------------------------------------------------
# シリアライズ
# ------------------------------------------------------------------
def _tohon_land_dict(t: TohonLand) -> dict:
    return {
        "location": t.location, "chiban": t.chiban,
        "chimoku_registry": t.chimoku_registry,
        "area_registry_sqm": t.area_registry_sqm,
        "ownership_history": [
            {"date": e.registration_date, "type": e.entry_type,
             "cause": e.cause, "owner": e.owner_name, "share": e.share}
            for e in t.ownership_history
        ],
        "other_rights": [
            {"date": e.registration_date, "type": e.right_type,
             "holder": e.holder, "details": e.details}
            for e in t.other_rights
        ],
        "source_file": t.source_file,
    }


def _tohon_building_dict(b: TohonBuilding) -> dict:
    return {
        "location": b.location, "kaoku_bango": b.kaoku_bango,
        "kind": b.kind, "structure": b.structure,
        "floor_areas": [{"floor": f.floor, "area_sqm": f.area_sqm} for f in b.floor_areas],
        "source_file": b.source_file,
    }


def _kotei_land_dict(k: KoteiShisanLand) -> dict:
    return {
        "location": k.location, "chiban": k.chiban,
        "chimoku_tax": k.chimoku_tax, "area_tax_sqm": k.area_tax_sqm,
        "assessed_value": k.assessed_value, "source_file": k.source_file,
    }


def _kotei_building_dict(b: KoteiShisanBuilding) -> dict:
    return {
        "location": b.location, "kaoku_bango": b.kaoku_bango,
        "kind": b.kind, "structure": b.structure,
        "area_tax_sqm": b.area_tax_sqm, "assessed_value": b.assessed_value,
        "construction_year": b.construction_year, "source_file": b.source_file,
    }


def _nayosecho_land_dict(n: NayosechoLand) -> dict:
    return {
        "location": n.location, "chiban": n.chiban,
        "chimoku_tax": n.chimoku_tax, "area_tax_sqm": n.area_tax_sqm,
        "assessed_value": n.assessed_value, "owner": n.owner,
        "share": n.share, "source_file": n.source_file,
    }


def _nayosecho_building_dict(b: NayosechoBuilding) -> dict:
    return {
        "location": b.location, "kaoku_bango": b.kaoku_bango,
        "kind": b.kind, "structure": b.structure,
        "area_tax_sqm": b.area_tax_sqm, "assessed_value": b.assessed_value,
        "source_file": b.source_file,
    }


def _nochi_dict(n: NochiDaicho) -> dict:
    return {
        "location": n.location, "chiban": n.chiban,
        "chimoku": n.chimoku, "area_sqm": n.area_sqm,
        "farm_category": n.farm_category, "farmer_name": n.farmer_name,
        "right_type": n.right_type, "right_holder": n.right_holder,
        "source_file": n.source_file,
    }


def _evaluation_to_dict(ev: PropertyEvaluation) -> dict[str, Any]:
    result: dict[str, Any] = {
        "property_id": ev.property_id,
        "property_type": ev.property_type,
        "address": ev.address,
        "latitude": ev.latitude,
        "longitude": ev.longitude,
        "registry": {
            "location": ev.location,
            "chiban": ev.chiban,
            "chimoku_registry": ev.chimoku_registry,
            "area_registry_sqm": ev.area_registry_sqm,
        },
        "tax": {
            "chimoku_tax": ev.chimoku_tax,
            "area_tax_sqm": ev.area_tax_sqm,
            "assessed_value": ev.assessed_value,
        },
        "ownership": {
            "target_name": ev.ownership.target_name,
            "reference_date": ev.ownership.reference_date,
            "current_share": ev.ownership.current_share,
            "share_fraction": ev.ownership.share_fraction,
            "history_summary": ev.ownership.history_summary,
        },
        "building": None,
        "nochi": None,
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
        "data_sources": ev.data_sources,
        "notes": ev.notes,
    }

    # 建物情報
    if ev.tohon_building:
        tb = ev.tohon_building
        result["building"] = {
            "kaoku_bango": tb.kaoku_bango,
            "kind": tb.kind,
            "structure": tb.structure,
            "floor_areas": [{"floor": f.floor, "area_sqm": f.area_sqm} for f in tb.floor_areas],
            "area_tax_sqm": ev.kotei_building.area_tax_sqm if ev.kotei_building else None,
            "assessed_value": ev.kotei_building.assessed_value if ev.kotei_building else None,
            "construction_year": ev.kotei_building.construction_year if ev.kotei_building else "",
        }

    # 農地情報
    if ev.nochi_daicho:
        nd = ev.nochi_daicho
        result["nochi"] = {
            "farm_category": nd.farm_category,
            "farmer_name": nd.farmer_name,
            "right_type": nd.right_type,
            "right_holder": nd.right_holder,
        }

    return result
