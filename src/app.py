"""FastAPI メインアプリケーション."""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates

from .config import config
from .excel.exporter import export_to_excel
from .models import PropertyEvaluation, UploadedProperty
from .services.document_parser import (
    detect_city_from_properties,
    detect_prefecture_from_properties,
    extract_address_parts,
    parse_document,
)
from .services.geocoder import geocode
from .services.nta_scraper import (
    fetch_multiplier_table,
    lookup_multiplier,
    resolve_municipality_code,
)
from .services.reinfolib_client import ReinfolibClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="相続税土地評価 基礎情報収集アプリ")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

config.upload_dir.mkdir(parents=True, exist_ok=True)

_session_data: dict[str, list[PropertyEvaluation]] = {}

reinfolib = ReinfolibClient()


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
# 書類アップロード（PDFモード）
# ------------------------------------------------------------------
@app.post("/api/upload")
async def upload_documents(files: list[UploadFile] = File(...)):
    """書類をアップロードしてテキスト抽出。都道府県・市区町村を自動検出。"""
    session_id = str(uuid.uuid4())[:8]
    all_properties: list[dict[str, Any]] = []
    uploaded_models: list[UploadedProperty] = []

    for f in files:
        file_path = config.upload_dir / f"{session_id}_{f.filename}"
        content = await f.read()
        file_path.write_bytes(content)

        extracted = parse_document(file_path)
        uploaded_models.extend(extracted)
        for prop in extracted:
            all_properties.append({
                "location": prop.location,
                "chiban": prop.chiban,
                "chimoku": prop.chimoku,
                "land_area_sqm": prop.land_area_sqm,
                "fixed_asset_value": prop.fixed_asset_value,
                "owner": prop.owner,
                "source_file": f.filename,
            })

    # 都道府県・市区町村を自動検出
    detected_prefecture = detect_prefecture_from_properties(uploaded_models)
    detected_city = detect_city_from_properties(uploaded_models)

    return JSONResponse({
        "session_id": session_id,
        "properties": all_properties,
        "file_count": len(files),
        "detected_prefecture": detected_prefecture,
        "detected_city": detected_city,
    })


# ------------------------------------------------------------------
# 手入力モード
# ------------------------------------------------------------------
@app.post("/api/manual_input")
async def manual_input(request: Request):
    """地番を手入力して物件情報を作成。"""
    body = await request.json()
    entries = body.get("entries", [])
    session_id = str(uuid.uuid4())[:8]

    all_properties: list[dict[str, Any]] = []
    detected_prefecture = ""
    detected_city = ""

    for entry in entries:
        address = entry.get("address", "")
        parts = extract_address_parts(address)
        if not detected_prefecture and parts["prefecture"]:
            detected_prefecture = parts["prefecture"]
        if not detected_city and parts["city"]:
            detected_city = parts["city"]

        all_properties.append({
            "location": address,
            "chiban": entry.get("chiban", ""),
            "chimoku": entry.get("chimoku", ""),
            "land_area_sqm": entry.get("land_area_sqm"),
            "fixed_asset_value": entry.get("fixed_asset_value"),
            "owner": "",
            "source_file": "手入力",
        })

    return JSONResponse({
        "session_id": session_id,
        "properties": all_properties,
        "detected_prefecture": detected_prefecture,
        "detected_city": detected_city,
    })


# ------------------------------------------------------------------
# 評価情報取得
# ------------------------------------------------------------------
@app.post("/api/evaluate")
async def evaluate_properties(request: Request):
    """各不動産の基礎情報を外部API/スクレイピングから取得."""
    body = await request.json()
    properties_data = body.get("properties", [])
    prefecture = body.get("prefecture", "")
    city = body.get("city", "")
    session_id = body.get("session_id", "default")

    evaluations: list[PropertyEvaluation] = []

    # 倍率表コードを自動解決し、倍率表を取得
    multiplier_rows = []
    municipality_code = ""
    if prefecture and city:
        try:
            municipality_code = await resolve_municipality_code(prefecture, city)
            if municipality_code:
                multiplier_rows = await fetch_multiplier_table(prefecture, municipality_code)
                logger.info("倍率表取得成功: %s %s → %s (%d行)",
                            prefecture, city, municipality_code, len(multiplier_rows))
            else:
                logger.warning("倍率表コード解決失敗: %s %s", prefecture, city)
        except Exception as e:
            logger.warning("倍率表取得失敗: %s", e)

    for idx, prop_data in enumerate(properties_data):
        ev = PropertyEvaluation(property_id=idx + 1)

        ev.uploaded.location = prop_data.get("location", "")
        ev.uploaded.chiban = prop_data.get("chiban", "")
        ev.uploaded.chimoku = prop_data.get("chimoku", "")
        ev.uploaded.land_area_sqm = prop_data.get("land_area_sqm")
        ev.uploaded.fixed_asset_value = prop_data.get("fixed_asset_value")
        ev.uploaded.owner = prop_data.get("owner", "")
        ev.uploaded.source_file = prop_data.get("source_file", "")

        address = prop_data.get("address", "") or f"{prefecture}{ev.uploaded.location}{ev.uploaded.chiban}"
        ev.address = address

        # ジオコーディング
        coords = await geocode(address)
        if coords:
            ev.latitude, ev.longitude = coords
            ev.data_sources.append("国土地理院ジオコーディング")

            # API情報を並行取得
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
                    ev.data_sources.append("不動産情報ライブラリAPI (XKT002/XKT003)")
                else:
                    ev.notes.append(f"用途地域取得エラー: {zoning}")

                if not isinstance(hazard, Exception):
                    ev.hazard = hazard
                    ev.data_sources.append("不動産情報ライブラリAPI (ハザード)")
                else:
                    ev.notes.append(f"ハザード情報取得エラー: {hazard}")

            except Exception as e:
                ev.notes.append(f"API取得エラー: {e}")
        else:
            ev.notes.append("住所から座標を特定できませんでした")

        # 倍率表から路線価/倍率判定
        if multiplier_rows:
            town = _extract_town_name(ev.uploaded.location, ev.uploaded.chiban)
            if town:
                ev.multiplier = lookup_multiplier(multiplier_rows, town)
                ev.data_sources.append("国税庁 評価倍率表")

        evaluations.append(ev)

    _session_data[session_id] = evaluations

    return JSONResponse({
        "session_id": session_id,
        "municipality_code": municipality_code,
        "evaluations": [_evaluation_to_dict(ev) for ev in evaluations],
    })


# ------------------------------------------------------------------
# Excel出力
# ------------------------------------------------------------------
@app.get("/api/export/{session_id}")
async def export_excel(session_id: str):
    evaluations = _session_data.get(session_id, [])
    if not evaluations:
        return JSONResponse({"error": "セッションデータが見つかりません"}, status_code=404)

    excel_bytes = export_to_excel(evaluations)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=inheritance_tax_eval_{session_id}.xlsx"},
    )


# ------------------------------------------------------------------
# ヘルパー
# ------------------------------------------------------------------
def _extract_town_name(location: str, chiban: str) -> str:
    combined = location + chiban
    m = re.search(r"([^\d市区郡県都府道]+?[町丁村])", combined)
    if m:
        return m.group(1)
    m = re.search(r"(大字\S+)", combined)
    if m:
        return m.group(1)
    return location


def _evaluation_to_dict(ev: PropertyEvaluation) -> dict[str, Any]:
    return {
        "property_id": ev.property_id,
        "address": ev.address,
        "latitude": ev.latitude,
        "longitude": ev.longitude,
        "uploaded": {
            "location": ev.uploaded.location,
            "chiban": ev.uploaded.chiban,
            "chimoku": ev.uploaded.chimoku,
            "land_area_sqm": ev.uploaded.land_area_sqm,
            "fixed_asset_value": ev.uploaded.fixed_asset_value,
            "source_file": ev.uploaded.source_file,
        },
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
