#!/usr/bin/env python3
"""Convert TripList trip JSON → map-creator POI JSON.

Usage (在 map-creator 目录下):
    python ../TripList-main/convert_triplist.py ../TripList-main/trip_templates/攻略模板.json
    python ../TripList-main/convert_triplist.py ../TripList-main/trip_templates/攻略模板.json --trip-index 0
    python ../TripList-main/convert_triplist.py ../TripList-main/trip_templates/攻略模板.json --output-dir outputs/poi_sets
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

# ── GCJ-02 → WGS84 ──

PI = math.pi
A = 6378245.0
EE = 0.00669342162296594323


def _out_of_china(lng: float, lat: float) -> bool:
    return not (73.66 < lng < 135.05 and 3.86 < lat < 53.55)


def _tlat(lng: float, lat: float) -> float:
    r = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * math.sqrt(abs(lng))
    r += (20.0 * math.sin(6.0 * lng * PI) + 20.0 * math.sin(2.0 * lng * PI)) * 2.0 / 3.0
    r += (20.0 * math.sin(lat * PI) + 40.0 * math.sin(lat / 3.0 * PI)) * 2.0 / 3.0
    r += (160.0 * math.sin(lat / 12.0 * PI) + 320.0 * math.sin(lat * PI / 30.0)) * 2.0 / 3.0
    return r


def _tlng(lng: float, lat: float) -> float:
    r = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * math.sqrt(abs(lng))
    r += (20.0 * math.sin(6.0 * lng * PI) + 20.0 * math.sin(2.0 * lng * PI)) * 2.0 / 3.0
    r += (20.0 * math.sin(lng * PI) + 40.0 * math.sin(lng / 3.0 * PI)) * 2.0 / 3.0
    r += (150.0 * math.sin(lng / 12.0 * PI) + 300.0 * math.sin(lng / 30.0)) * 2.0 / 3.0
    return r


def gcj02_to_wgs84(lng: float, lat: float) -> tuple[float, float]:
    if _out_of_china(lng, lat):
        return lng, lat
    dlat = _tlat(lng - 105.0, lat - 35.0)
    dlng = _tlng(lng - 105.0, lat - 35.0)
    radlat = lat / 180.0 * PI
    magic = math.sin(radlat)
    magic = 1 - EE * magic * magic
    sqm = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sqm) * PI)
    dlng = (dlng * 180.0) / (A / sqm * math.cos(radlat) * PI)
    return round(lng * 2 - (lng + dlng), 6), round(lat * 2 - (lat + dlat), 6)


# ── helpers ──

def slug(v: str) -> str:
    t = re.sub(r"\s+", "_", v.strip().lower())
    return re.sub(r"[^\w\u4e00-\u9fff-]+", "", t, flags=re.UNICODE).strip("_") or "map"


def spot_to_poi(spot: dict) -> dict | None:
    lat = spot.get("lat")
    lng = spot.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None

    lng02, lat02 = float(lng), float(lat)
    lng84, lat84 = gcj02_to_wgs84(lng02, lat02)
    name = spot.get("name", "").strip()
    city = spot.get("city", "")
    note = spot.get("note", "")
    addr = spot.get("address", "")  # 高德简短地址优先
    display = addr or (note[:80] if note else "")

    return {
        "input_name": name,
        "resolved_name": name,
        "source": "triplist",
        "poi_id": spot.get("id"),
        "address": display,
        "province": None,
        "city": city,
        "district": None,
        "type": spot.get("type"),
        "typecode": None,
        "lng_gcj02": lng02,
        "lat_gcj02": lat02,
        "lng_wgs84": lng84,
        "lat_wgs84": lat84,
        "confidence": 1.0,
        "status": "resolved",
        "needs_review": False,
        "candidates": [{
            "score": 1.0,
            "poi_id": spot.get("id"),
            "name": name,
            "address": display,
            "city": city,
            "district": "",
            "type": spot.get("type"),
            "lng_gcj02": lng02,
            "lat_gcj02": lat02,
        }],
    }


def convert_trip(trip: dict, output_dir: Path) -> list[Path]:
    trip_name = trip.get("name", "trip")
    city_pois: dict[str, list[dict]] = {}

    for day in trip.get("days", []):
        for spot in day.get("spots", []):
            poi = spot_to_poi(spot)
            if poi is None:
                continue
            city = poi["city"] or trip.get("city", "unknown")
            city_pois.setdefault(city, []).append(poi)

    outputs = []
    for city, pois in city_pois.items():
        payload = {
            "city": city,
            "theme": "guide",
            "source": "triplist",
            "coordinate_policy": "AMap GCJ-02 is converted to WGS84 for OSMnx rendering",
            "pois": pois,
        }
        out = output_dir / f"{slug(trip_name)}_{slug(city)}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        outputs.append(out)
        print(f"  [OK] {city}: {len(pois)} POIs -> {out}")
    return outputs


def load_trips(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("["):
        return json.loads(text)
    if text.startswith("{") and "\n{" not in text:
        return [json.loads(text)]
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def main() -> int:
    ap = argparse.ArgumentParser(description="TripList trip JSON -> map-creator POI JSON")
    ap.add_argument("input", type=Path)
    ap.add_argument("--output-dir", type=Path, default=Path("outputs/poi_sets"))
    ap.add_argument("--trip-index", type=int, default=None, help="only convert this trip (0-based)")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"Error: {args.input} not found", file=sys.stderr)
        return 1

    trips = load_trips(args.input)
    if not trips:
        print("No trips found.", file=sys.stderr)
        return 1

    if args.trip_index is not None:
        trips = [trips[args.trip_index]]

    print(f"Found {len(trips)} trip(s)")
    all_out: list[Path] = []
    for i, trip in enumerate(trips):
        print(f"\n-- [{i}] {trip.get('name', '?')} --")
        all_out.extend(convert_trip(trip, args.output_dir))

    print(f"\nDone: {len(all_out)} file(s) -> {args.output_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
