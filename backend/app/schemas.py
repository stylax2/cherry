from typing import Literal

from pydantic import BaseModel, Field


ForecastModel = Literal["grid", "raster", "xgb", "lgbm", "lstm", "ensemble"]


class LocationPredictionRequest(BaseModel):
    lat: float = Field(..., ge=32.0, le=39.5)
    lon: float = Field(..., ge=124.0, le=132.5)
    year: int = Field(2026, ge=1990, le=2100)
    model: ForecastModel = "grid"


class StationMatch(BaseModel):
    stn_id: int
    stn_name: str
    sido: str | None = None
    sigungu: str | None = None
    lat: float
    lon: float
    distance_km: float


class GridCellMatch(BaseModel):
    grid_id: str
    cell: int
    lat: float
    lon: float
    distance_km: float
    elevation: float | None = None
    confidence: str | None = None
    confidence_label: str | None = None
    confidence_3day: float | None = None
    confidence_3day_percent: float | None = None
    confidence_5day: float | None = None
    confidence_5day_percent: float | None = None
    naturing_obs_count: int | None = None
    nearest_naturing_dist_km: float | None = None


class ProbabilityCurvePoint(BaseModel):
    offset_days: int
    date: str
    probability: float | None = None
    relative_value: float | None = None


class ObservationTrendPoint(BaseModel):
    year: int
    date: str
    doy: int


class ObservationTrend(BaseModel):
    station_name: str
    site: int
    lat: float
    lon: float
    elevation: float | None = None
    distance_km: float
    baseline_year: int | None = None
    baseline_doy: int | None = None
    predicted_delta_days: float | None = None
    records: list[ObservationTrendPoint] = Field(default_factory=list)


class DateWindow(BaseModel):
    start_date: str
    end_date: str


class ProbabilisticDate(BaseModel):
    doy_mean: float
    doy_std: float
    date_mean: str
    date_p10: str
    date_p50: str
    date_p90: str
    lower_date_3day: str | None = None
    upper_date_3day: str | None = None
    probability: float | None = None
    confidence_3day_percent: float | None = None
    confidence_5day_percent: float | None = None


class LocationPredictionResponse(BaseModel):
    year: int
    model: ForecastModel
    clicked_location: dict[str, float]
    nearest_station: StationMatch
    grid_cell: GridCellMatch | None = None
    probability_curve: list[ProbabilityCurvePoint] = Field(default_factory=list)
    prediction_probability: float | None = None
    observation_trend: ObservationTrend | None = None
    sprout: ProbabilisticDate | None = None
    bloom: ProbabilisticDate
    fullbloom: ProbabilisticDate | None = None
    recommended_festival_window: DateWindow
    uncertainty_source: str
