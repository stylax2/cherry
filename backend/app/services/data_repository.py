import csv
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.location import haversine_km


class DataRepository:
    def __init__(
        self,
        station_meta_path: Path = settings.station_meta_path,
        predictions_path: Path = settings.predictions_path,
        model_scores_path: Path = settings.model_scores_path,
    ) -> None:
        self.station_meta_path = station_meta_path
        self.predictions_path = predictions_path
        self.model_scores_path = model_scores_path
        self._stations: list[dict[str, Any]] | None = None
        self._predictions: list[dict[str, Any]] | None = None
        self._scores: list[dict[str, Any]] | None = None

    @property
    def stations(self) -> list[dict[str, Any]]:
        if self._stations is None:
            self._stations = self._read_csv(self.station_meta_path)
            for row in self._stations:
                row["stn_id"] = int(row["stn_id"])
                row["lat"] = float(row["lat"])
                row["lon"] = float(row["lon"])
                row["elev_m"] = float(row["elev_m"])
        return self._stations

    @property
    def predictions(self) -> list[dict[str, Any]]:
        if self._predictions is None:
            self._predictions = self._read_csv(self.predictions_path)
            for row in self._predictions:
                row["stn_id"] = int(row["stn_id"])
                row["year"] = int(row["year"])
                for key, value in list(row.items()):
                    if key.endswith("_doy") or key.startswith(("xgb_", "lgbm_", "lstm_")):
                        row[key] = self._float_or_none(value)
        return self._predictions

    @property
    def scores(self) -> list[dict[str, Any]]:
        if self._scores is None:
            self._scores = self._read_csv(self.model_scores_path)
            for row in self._scores:
                row["mae"] = self._float_or_none(row["mae"])
                row["rmse"] = self._float_or_none(row["rmse"])
        return self._scores

    def find_nearest_station(self, lat: float, lon: float) -> dict[str, Any]:
        nearest = min(
            self.stations,
            key=lambda station: haversine_km(lat, lon, station["lat"], station["lon"]),
        )
        result = dict(nearest)
        result["distance_km"] = round(haversine_km(lat, lon, result["lat"], result["lon"]), 3)
        return result

    def find_prediction(self, stn_id: int, year: int) -> dict[str, Any] | None:
        for row in self.predictions:
            if row["stn_id"] == stn_id and row["year"] == year:
                return row
        return None

    def model_rmse(self, model: str, target: str, split: str = "test") -> float:
        if model == "ensemble":
            values = [
                row["rmse"]
                for row in self.scores
                if row["split"] == split and row["target"] == target and row["rmse"] is not None
            ]
            return float(sum(values) / len(values)) if values else 4.0

        lookup_model = model.upper()
        for row in self.scores:
            if row["split"] == split and row["model"] == lookup_model and row["target"] == target:
                return float(row["rmse"] or 4.0)
        return 4.0

    @staticmethod
    def _read_csv(path: Path) -> list[dict[str, str]]:
        if not path.exists():
            raise FileNotFoundError(f"Required data file does not exist: {path}")
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            return list(csv.DictReader(file))

    @staticmethod
    def _float_or_none(value: Any) -> float | None:
        if value is None or value == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None
