import csv
import json
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

DX = 0.008988586
DY = 0.007285974
BIN_SIZE = 5
YEAR = 2026

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


def main() -> None:
    rows = []
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            rows.append(
                {
                    "lon": float(row["lon"]),
                    "lat": float(row["lat"]),
                    "doy": int(round(float(row["pred_doy"]))),
                }
            )

    min_lon = min(row["lon"] for row in rows)
    max_lon = max(row["lon"] for row in rows)
    min_lat = min(row["lat"] for row in rows)
    max_lat = max(row["lat"] for row in rows)
    min_doy = min(row["doy"] for row in rows)
    max_doy = max(row["doy"] for row in rows)

    width = round((max_lon - min_lon) / DX) + 1
    height = round((max_lat - min_lat) / DY) + 1
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
        col = round((row["lon"] - min_lon) / DX)
        pixel_row = round((max_lat - row["lat"]) / DY)
        bin_index = min((row["doy"] - bin_start) // BIN_SIZE, len(bins) - 1)
        if 0 <= col < width and 0 <= pixel_row < height:
            pixels[col, pixel_row] = hex_to_rgba(bins[bin_index]["color"])

    # Expand sparse point pixels into small cells so the layer reads as a continuous 1 km grid.
    image = image.resize((width * 2, height * 2), resample=Image.Resampling.NEAREST)

    extent = [
        min_lon - DX / 2,
        min_lat - DY / 2,
        max_lon + DX / 2,
        max_lat + DY / 2,
    ]

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
            "extent": extent,
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
