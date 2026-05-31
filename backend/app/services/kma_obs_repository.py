from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl

from app.config import settings
from app.services.location import haversine_km


@dataclass(frozen=True)
class ObservationRecord:
    year: int
    date: str
    doy: int


@dataclass(frozen=True)
class ObservationStationTrend:
    station_name: str
    site: int
    lat: float
    lon: float
    elevation: float | None
    distance_km: float
    records: tuple[ObservationRecord, ...]
    baseline_year: int | None
    baseline_doy: int | None
    predicted_delta_days: float | None


class KmaObsRepository:
    def __init__(self, obs_path: Path = settings.kma_obs_path) -> None:
        self.obs_path = obs_path
        self._stations: list[dict[str, Any]] | None = None

    def nearest_trend(self, lat: float, lon: float, predicted_doy: float) -> ObservationStationTrend | None:
        stations = self._load_stations()
        if not stations:
            return None

        station = min(stations, key=lambda item: haversine_km(lat, lon, item["lat"], item["lon"]))
        distance_km = round(haversine_km(lat, lon, station["lat"], station["lon"]), 3)
        records = tuple(station["records"])
        baseline = records[0] if records else None

        return ObservationStationTrend(
            station_name=station["station_name"],
            site=station["site"],
            lat=station["lat"],
            lon=station["lon"],
            elevation=station["elevation"],
            distance_km=distance_km,
            records=records,
            baseline_year=baseline.year if baseline else None,
            baseline_doy=baseline.doy if baseline else None,
            predicted_delta_days=round(predicted_doy - baseline.doy, 1) if baseline else None,
        )

    def _load_stations(self) -> list[dict[str, Any]]:
        if self._stations is None:
            if not self.obs_path.exists():
                raise FileNotFoundError(f"Required KMA observation workbook does not exist: {self.obs_path}")

            workbook = openpyxl.load_workbook(self.obs_path, read_only=True, data_only=True)
            worksheet = workbook["obs"]
            stations: dict[tuple[str, int, float, float], dict[str, Any]] = {}

            for row in worksheet.iter_rows(min_row=2, values_only=True):
                station_name, site, lat, lon, elevation, year, observed_date = row
                if not station_name or site is None or lat is None or lon is None or year is None or observed_date is None:
                    continue

                parsed_date = self._parse_date(observed_date)
                if parsed_date is None:
                    continue

                key = (str(station_name), int(site), float(lat), float(lon))
                station = stations.setdefault(
                    key,
                    {
                        "station_name": str(station_name),
                        "site": int(site),
                        "lat": float(lat),
                        "lon": float(lon),
                        "elevation": float(elevation) if elevation is not None else None,
                        "records": [],
                    },
                )
                station["records"].append(
                    ObservationRecord(
                        year=int(year),
                        date=parsed_date.isoformat(),
                        doy=int(parsed_date.timetuple().tm_yday),
                    )
                )

            self._stations = []
            for station in stations.values():
                station["records"].sort(key=lambda record: record.year)
                self._stations.append(station)
        return self._stations

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                return None
        return None
