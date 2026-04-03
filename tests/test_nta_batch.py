"""NTAバッチスクレイピング機能のテスト."""

import json
import tempfile
from pathlib import Path

from src.services.nta_scraper import (
    MultiplierRow,
    _parse_multiplier_html,
    save_multipliers_json,
    save_multipliers_csv,
    load_multipliers_json,
    lookup_from_saved_data,
)


# テスト用の倍率表HTML（NTA実際のHTML構造を模したもの）
SAMPLE_HTML = """
<html>
<body>
<table border="1">
<tr>
  <th>町（丁目）又は大字名</th>
  <th>適用地域名</th>
  <th>借地権割合</th>
  <th>宅地</th>
  <th>田</th>
  <th>畑</th>
  <th>山林</th>
  <th>原野</th>
</tr>
<tr>
  <td>赤塚</td>
  <td>全域</td>
  <td>C</td>
  <td>路線</td>
  <td>純 22</td>
  <td>純 18</td>
  <td>純 15</td>
  <td>純 10</td>
</tr>
<tr>
  <td>大工町</td>
  <td>全域</td>
  <td>D</td>
  <td>路線</td>
  <td>純 25</td>
  <td>純 20</td>
  <td></td>
  <td></td>
</tr>
<tr>
  <td>内原町</td>
  <td>全域</td>
  <td>C</td>
  <td>1.1</td>
  <td>純 15</td>
  <td>純 12</td>
  <td>純 8</td>
  <td>純 5</td>
</tr>
<tr>
  <td>飯富町</td>
  <td>市街化区域</td>
  <td>C</td>
  <td>1.1</td>
  <td>中 25</td>
  <td>中 20</td>
  <td>純 10</td>
  <td></td>
</tr>
<tr>
  <td>飯富町</td>
  <td>その他</td>
  <td>C</td>
  <td>1.1</td>
  <td>純 18</td>
  <td>純 15</td>
  <td>純 8</td>
  <td></td>
</tr>
</table>
</body>
</html>
"""


def test_parse_multiplier_html():
    """倍率表HTMLパースの基本テスト."""
    rows = _parse_multiplier_html(SAMPLE_HTML)
    assert len(rows) == 5

    # 赤塚: 路線価地域
    assert rows[0].town_name == "赤塚"
    assert rows[0].residential == "路線"
    assert rows[0].leasehold_ratio == "C"

    # 内原町: 倍率地域
    assert rows[2].town_name == "内原町"
    assert rows[2].residential == "1.1"

    # 飯富町: 2行（市街化区域 / その他）
    assert rows[3].town_name == "飯富町"
    assert rows[3].area_name == "市街化区域"
    assert rows[4].town_name == "飯富町"
    assert rows[4].area_name == "その他"


def test_save_and_load_json():
    """JSON保存・読み込みのテスト."""
    records = [
        {
            "municipality": "水戸市",
            "municipality_code": "d08201rf",
            "town_name": "赤塚",
            "area_name": "全域",
            "leasehold_ratio": "C",
            "residential": "路線",
            "paddy": "純 22",
            "field": "純 18",
            "forest": "純 15",
            "wasteland": "純 10",
            "is_rosenka_area": True,
        },
        {
            "municipality": "水戸市",
            "municipality_code": "d08201rf",
            "town_name": "内原町",
            "area_name": "全域",
            "leasehold_ratio": "C",
            "residential": "1.1",
            "paddy": "純 15",
            "field": "純 12",
            "forest": "純 8",
            "wasteland": "純 5",
            "is_rosenka_area": False,
        },
        {
            "municipality": "日立市",
            "municipality_code": "d08202rf",
            "town_name": "助川町",
            "area_name": "全域",
            "leasehold_ratio": "D",
            "residential": "路線",
            "paddy": "純 20",
            "field": "純 16",
            "forest": "純 12",
            "wasteland": "",
            "is_rosenka_area": True,
        },
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = Path(tmpdir) / "test_multipliers.json"
        save_multipliers_json(records, "茨城県", json_path)

        assert json_path.exists()

        data = load_multipliers_json(json_path)
        assert data["prefecture"] == "茨城県"
        assert data["total_records"] == 3
        assert "水戸市" in data["municipalities"]
        assert "日立市" in data["municipalities"]
        assert len(data["municipalities"]["水戸市"]["records"]) == 2
        assert data["municipalities"]["水戸市"]["code"] == "d08201rf"


def test_save_csv():
    """CSV保存のテスト."""
    records = [
        {
            "municipality": "水戸市",
            "municipality_code": "d08201rf",
            "town_name": "赤塚",
            "area_name": "全域",
            "leasehold_ratio": "C",
            "residential": "路線",
            "paddy": "純 22",
            "field": "純 18",
            "forest": "純 15",
            "wasteland": "純 10",
            "is_rosenka_area": True,
        },
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = Path(tmpdir) / "test_multipliers.csv"
        save_multipliers_csv(records, csv_path)

        assert csv_path.exists()

        # CSVの中身を確認
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
        assert len(lines) == 2  # ヘッダー + 1行
        assert "水戸市" in lines[1]
        assert "赤塚" in lines[1]
        assert "○" in lines[1]  # 路線価地域


def test_lookup_from_saved_data():
    """保存済みデータからの検索テスト."""
    data = {
        "municipalities": {
            "水戸市": {
                "code": "d08201rf",
                "records": [
                    {
                        "town_name": "赤塚",
                        "area_name": "全域",
                        "leasehold_ratio": "C",
                        "residential": "路線",
                        "paddy": "純 22",
                        "field": "純 18",
                        "forest": "純 15",
                        "wasteland": "純 10",
                        "is_rosenka_area": True,
                    },
                    {
                        "town_name": "内原町",
                        "area_name": "全域",
                        "leasehold_ratio": "C",
                        "residential": "1.1",
                        "paddy": "純 15",
                        "field": "純 12",
                        "forest": "純 8",
                        "wasteland": "純 5",
                        "is_rosenka_area": False,
                    },
                ],
            },
        },
    }

    # 路線価地域の検索
    info = lookup_from_saved_data(data, "水戸市", "赤塚")
    assert info.is_rosenka_area is True
    assert info.residential_multiplier == "路線"
    assert info.leasehold_ratio == "C"

    # 倍率地域の検索
    info = lookup_from_saved_data(data, "水戸市", "内原町")
    assert info.is_rosenka_area is False
    assert info.residential_multiplier == "1.1"

    # 見つからない市区町村
    info = lookup_from_saved_data(data, "つくば市", "春日")
    assert "つくば市" in info.notes

    # 見つからない町名
    info = lookup_from_saved_data(data, "水戸市", "存在しない町")
    assert "存在しない町" in info.notes


def test_lookup_from_saved_data_partial_match():
    """部分一致検索のテスト."""
    data = {
        "municipalities": {
            "水戸市": {
                "code": "d08201rf",
                "records": [
                    {
                        "town_name": "赤塚一丁目",
                        "area_name": "全域",
                        "leasehold_ratio": "C",
                        "residential": "路線",
                        "paddy": "",
                        "field": "",
                        "forest": "",
                        "wasteland": "",
                        "is_rosenka_area": True,
                    },
                ],
            },
        },
    }

    # "赤塚" で "赤塚一丁目" に部分一致
    info = lookup_from_saved_data(data, "水戸市", "赤塚")
    assert info.town_name == "赤塚一丁目"
    assert info.is_rosenka_area is True


def test_load_multipliers_json_missing_file():
    """存在しないファイルの読み込みテスト."""
    data = load_multipliers_json(Path("/nonexistent/path.json"))
    assert data == {}
