import csv
import json
import math
from datetime import date, timedelta
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "cherry_backend_lookup_2026.csv"
OUT_DIR = ROOT / "frontend" / "data"
PNG_OUT = OUT_DIR / "cherry_pred_raster_2026.png"
JSON_OUT = OUT_DIR / "cherry_pred_raster_2026.json"
STANDALONE_OUT_DIR = ROOT / "standalone" / "data"
STANDALONE_PNG_OUT = STANDALONE_OUT_DIR / PNG_OUT.name
STANDALONE_JSON_OUT = STANDALONE_OUT_DIR / JSON_OUT.name

BIN_SIZE = 5
YEAR = 2026
WEB_MERCATOR_RADIUS = 6378137.0
RASTER_RESOLUTION_M = 500.0

COLORS = [
    "#b2185b",
    "#d64f83",
    "#f08aa7",
    "#f7b267",
    "#f6d55c",
    "#9bcf72",
    "#4fb3a2",
    "#3d8fc6",
    "#5266b8",
    "#6b4c9a",
    "#4b2f74",
]


def doy_to_label(start_doy: int, end_doy: int) -> str:
    start = date(YEAR, 1, 1) + timedelta(days=start_doy - 1)
    end = date(YEAR, 1, 1) + timedelta(days=end_doy - 1)
    return f"{start.month}/{start.day:02d} ~ {end.month}/{end.day:02d}"


def hex_to_rgba(color: str, alpha: int = 188) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    return (int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), alpha)


def lonlat_to_web_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = WEB_MERCATOR_RADIUS * math.radians(lon)
    y = WEB_MERCATOR_RADIUS * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def main() -> None:
    rows = []
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            lon = float(row["lon"])
            lat = float(row["lat"])
            x, y = lonlat_to_web_mercator(lon, lat)
            rows.append(
                {
                    "lon": lon,
                    "lat": lat,
                    "x": x,
                    "y": y,
                    "doy": int(round(float(row["pred_doy"]))),
                }
            )

    min_lon = min(row["lon"] for row in rows)
    max_lon = max(row["lon"] for row in rows)
    min_lat = min(row["lat"] for row in rows)
    max_lat = max(row["lat"] for row in rows)
    min_x = min(row["x"] for row in rows)
    max_x = max(row["x"] for row in rows)
    min_y = min(row["y"] for row in rows)
    max_y = max(row["y"] for row in rows)
    min_doy = min(row["doy"] for row in rows)
    max_doy = max(row["doy"] for row in rows)

    extent = [
        min_x - RASTER_RESOLUTION_M,
        min_y - RASTER_RESOLUTION_M,
        max_x + RASTER_RESOLUTION_M,
        max_y + RASTER_RESOLUTION_M,
    ]
    width = math.ceil((extent[2] - extent[0]) / RASTER_RESOLUTION_M)
    height = math.ceil((extent[3] - extent[1]) / RASTER_RESOLUTION_M)
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = image.load()

    bin_start = (min_doy // BIN_SIZE) * BIN_SIZE
    bins = []
    current = bin_start
    color_index = 0
    while current <= max_doy:
        end = min(current + BIN_SIZE - 1, max_doy)
        bins.append(
            {
                "start_doy": current,
                "end_doy": end,
                "label": doy_to_label(current, end),
                "color": COLORS[color_index % len(COLORS)],
            }
        )
        current += BIN_SIZE
        color_index += 1

    for row in rows:
        col = round((row["x"] - extent[0]) / RASTER_RESOLUTION_M)
        pixel_row = round((extent[3] - row["y"]) / RASTER_RESOLUTION_M)
        bin_index = min((row["doy"] - bin_start) // BIN_SIZE, len(bins) - 1)
        color = hex_to_rgba(bins[bin_index]["color"])
        for dx in (0, 1):
            for dy in (0, 1):
                x = col + dx
                y = pixel_row + dy
                if 0 <= x < width and 0 <= y < height:
                    pixels[x, y] = color

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STANDALONE_OUT_DIR.mkdir(parents=True, exist_ok=True)
    image.save(PNG_OUT)
    image.save(STANDALONE_PNG_OUT)
    metadata = json.dumps(
        {
            "year": YEAR,
            "source": SOURCE.name,
            "image": PNG_OUT.name,
            "bin_days": BIN_SIZE,
            "opacity": 0.62,
            "projection": "EPSG:3857",
            "extent": extent,
            "lonlat_extent": [
                min_lon,
                min_lat,
                max_lon,
                max_lat,
            ],
            "resolution_m": RASTER_RESOLUTION_M,
            "doy_range": [min_doy, max_doy],
            "legend": bins,
        },
        ensure_ascii=False,
        indent=2,
    )
    JSON_OUT.write_text(metadata, encoding="utf-8")
    STANDALONE_JSON_OUT.write_text(metadata, encoding="utf-8")
    print(f"wrote {PNG_OUT}")
    print(f"wrote {JSON_OUT}")
    print(f"wrote {STANDALONE_PNG_OUT}")
    print(f"wrote {STANDALONE_JSON_OUT}")
    print(f"size {image.width}x{image.height}, rows {len(rows)}")


if __name__ == "__main__":
    main()
