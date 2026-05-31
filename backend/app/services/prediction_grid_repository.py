import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scipy.spatial import cKDTree

from app.config import settings
from app.services.location import haversine_km


@dataclass(frozen=True)
class ProbabilityPoint:
    offset_days: int
    date: str
    relative_value: float | None


@dataclass(frozen=True)
class PredictionGridSample:
    grid_id: str
    cell: int
    lat: float
    lon: float
    elevation: float | None
    pred_doy: float
    pred_date: str
    lower_date_3day: str
    upper_date_3day: str
    sd_days: float | None
    confidence_label: str | None
    confidence_3day: float | None
    confidence_3day_percent: float | None
    confidence_5day: float | None
    confidence_5day_percent: float | None
    probability_curve: tuple[ProbabilityPoint, ...]
    naturing_obs_count: int | None
    nearest_naturing_dist_km: float | None
    distance_km: float


class PredictionGridRepository:
    def __init__(
        self,
        grid_path: Path = settings.prediction_grid_path,
        lookup_path: Path = settings.prediction_lookup_path,
    ) -> None:
        self.grid_path = grid_path
        self.lookup_path = lookup_path
        self._rows: list[dict[str, Any]] | None = None
        self._tree: cKDTree | None = None

    def sample(self, lat: float, lon: float) -> PredictionGridSample:
        rows = self._load_rows()
        tree = self._load_tree()
        _distance_degrees, index = tree.query((lat, lon), k=1)
        row = rows[int(index)]
        distance_km = round(haversine_km(lat, lon, row["lat"], row["lon"]), 3)

        curve = tuple(
            ProbabilityPoint(
                offset_days=offset,
                date=row[f"date_{self._offset_key(offset)}"],
                relative_value=row.get(f"curve_{self._offset_key(offset)}"),
            )
            for offset in range(-3, 4)
        )

        return PredictionGridSample(
            grid_id=row["grid_id"],
            cell=row["cell"],
            lat=row["lat"],
            lon=row["lon"],
            elevation=row["elevation"],
            pred_doy=row["pred_doy"],
            pred_date=row["pred_date"],
            lower_date_3day=row["lower_date_3day"],
            upper_date_3day=row["upper_date_3day"],
            sd_days=row["sd_days"],
            confidence_label=row["confidence_label"],
            confidence_3day=row["confidence_3day"],
            confidence_3day_percent=row["confidence_3day_percent"],
            confidence_5day=row["confidence_5day"],
            confidence_5day_percent=row["confidence_5day_percent"],
            probability_curve=curve,
            naturing_obs_count=row["naturing_obs_count"],
            nearest_naturing_dist_km=row["nearest_naturing_dist_km"],
            distance_km=distance_km,
        )

    def _load_rows(self) -> list[dict[str, Any]]:
        if self._rows is None:
            if not self.lookup_path.exists():
                raise FileNotFoundError(f"Required prediction lookup does not exist: {self.lookup_path}")
            with self.lookup_path.open("r", encoding="utf-8-sig", newline="") as file:
                self._rows = [self._convert_row(row) for row in csv.DictReader(file)]
        return self._rows

    def _load_tree(self) -> cKDTree:
        if self._tree is None:
            self._tree = cKDTree([(row["lat"], row["lon"]) for row in self._load_rows()])
        return self._tree

    @classmethod
    def _convert_row(cls, row: dict[str, str]) -> dict[str, Any]:
        converted: dict[str, Any] = {
            "grid_id": row["grid_id"],
            "cell": int(float(row["cell"])),
            "prediction_year": cls._int_or_none(row.get("prediction_year") or row.get("year")),
            "lon": float(row["lon"]),
            "lat": float(row["lat"]),
            "elevation": cls._float_or_none(row.get("elevation")),
            "pred_doy": float(row["pred_doy"]),
            "pred_date": row["pred_date"],
            "lower_date_3day": row["lower_date_3day"],
            "upper_date_3day": row["upper_date_3day"],
            "sd_days": cls._float_or_none(row.get("sd_days") or row.get("error_window_days")),
            "confidence_label": row.get("confidence_label") or row.get("confidence") or None,
            "confidence_3day": cls._float_or_none(row.get("confidence_3day")),
            "confidence_3day_percent": cls._percent_or_none(row.get("confidence_3day_percent"), row.get("confidence_3day")),
            "confidence_5day": cls._float_or_none(row.get("confidence_5day")),
            "confidence_5day_percent": cls._percent_or_none(row.get("confidence_5day_percent"), row.get("confidence_5day")),
            "naturing_obs_count": cls._int_or_none(row.get("naturing_obs_count")),
            "nearest_naturing_dist_km": cls._float_or_none(row.get("nearest_naturing_dist_km")),
        }
        for offset in range(-3, 4):
            key = cls._offset_key(offset)
            converted[f"date_{key}"] = row.get(f"date_{key}", "")
            converted[f"curve_{key}"] = cls._float_or_none(row.get(f"curve_{key}") or row.get(f"p_{key}"))
        return converted

    @staticmethod
    def _offset_key(offset: int) -> str:
        if offset < 0:
            return f"minus{abs(offset)}"
        if offset > 0:
            return f"plus{offset}"
        return "0"

    @staticmethod
    def _float_or_none(value: str | None) -> float | None:
        if value is None or value == "":
            return None
        return float(value)

    @classmethod
    def _percent_or_none(cls, percent_value: str | None, ratio_value: str | None) -> float | None:
        percent = cls._float_or_none(percent_value)
        if percent is not None:
            return percent
        ratio = cls._float_or_none(ratio_value)
        return ratio * 100 if ratio is not None else None

    @staticmethod
    def _int_or_none(value: str | None) -> int | None:
        if value is None or value == "":
            return None
        return int(float(value))
