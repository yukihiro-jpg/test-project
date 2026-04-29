"""FastAPI メインアプリケーション."""

from __future__ import annotations

import asyncio
import logging
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
    PropertyEvaluation,
    TohonLand, TohonBuilding,
    KoteiShisanLand, KoteiShisanBuilding,
    NochiDaicho,
)
from .services.document_parser import (
    parse_tohon, parse_kotei_shisan,
    calculate_ownership,
    detect_prefecture_from_properties, detect_city_from_properties,
)
from .services.gemini_nochi_parser import parse_nochi_with_gemini
from .services.geocoder import geocode
from .services.reinfolib_client import ReinfolibClient
from .services.wagri_client import WagriClient
from .services.valuation import check_consistency

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="相続税土地評価 基礎情報収集アプリ")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

config.upload_dir.mkdir(parents=True, exist_ok=True)

DATA_DIR = BASE_DIR.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

reinfolib = ReinfolibClient()
wagri = WagriClient()


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
        try:
            lands, buildings = parse_tohon(path)
            logger.info("謄本解析 %s: 土地%d筆, 建物%d棟", f.filename, len(lands), len(buildings))
            sd.tohon_lands.extend(lands)
            sd.tohon_buildings.extend(buildings)
        except Exception as e:
            logger.error("謄本解析エラー %s: %s", f.filename, e, exc_info=True)

    # 固定資産評価証明
    for f in kotei_files:
        path = await _save_file(f, session_id)
        try:
            lands, buildings = parse_kotei_shisan(path)
            logger.info("固定資産解析 %s: 土地%d筆, 建物%d棟", f.filename, len(lands), len(buildings))
            sd.kotei_lands.extend(lands)
            sd.kotei_buildings.extend(buildings)
        except Exception as e:
            logger.error("固定資産解析エラー %s: %s", f.filename, e, exc_info=True)

    # 農地台帳（Gemini API で画像解析）
    for f in nochi_files:
        path = await _save_file(f, session_id)
        try:
            entries = parse_nochi_with_gemini(path)
            logger.info("農地台帳解析(Gemini) %s: %d件", f.filename, len(entries))
            sd.nochi_daichos.extend(entries)
        except Exception as e:
            logger.error("農地台帳解析エラー %s: %s", f.filename, e, exc_info=True)

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
        "evaluations": [_evaluation_to_dict(ev) for ev in evaluations],
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


def _match_property(loc1: str, chiban1: str, loc2: str, chiban2: str) -> bool:
    """所在+地番で同一物件か判定（部分一致）."""
    if not loc1 or not loc2:
        return False
    loc_match = loc1 in loc2 or loc2 in loc1
    chiban_match = chiban1 and chiban2 and (chiban1 in chiban2 or chiban2 in chiban1)
    return loc_match and chiban_match


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

        # WAGRI 農振区分
        if wagri.is_configured:
            try:
                agri = await wagri.get_agri_zone_by_distance(ev.latitude, ev.longitude)
                if agri:
                    ev.agri_zone = agri
                    ev.data_sources.append("WAGRI 農地データAPI")
            except Exception as e:
                logger.warning("WAGRI 農振取得エラー: %s", e)
    else:
        ev.notes.append("住所から座標を特定できませんでした")


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
        "location": (
            ev.tohon_land.location if ev.tohon_land
            else (ev.tohon_building.location if ev.tohon_building else "")
        ),
        "chiban": (ev.tohon_land.chiban if ev.tohon_land else ""),
        "kaoku_bango": (ev.tohon_building.kaoku_bango if ev.tohon_building else ""),
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
        # 農振区分（WAGRI）
        "agri_zone": ev.agri_zone,
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
