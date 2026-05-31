from app.schemas import (
    DateWindow,
    GridCellMatch,
    LocationPredictionRequest,
    LocationPredictionResponse,
    ObservationTrend,
    ObservationTrendPoint,
    ProbabilityCurvePoint,
    ProbabilisticDate,
    StationMatch,
)
from app.services.date_utils import clamp_doy, doy_to_date
from app.services.kma_obs_repository import KmaObsRepository
from app.services.prediction_grid_repository import PredictionGridRepository, PredictionGridSample


class BloomPredictor:
    def __init__(
        self,
        grid_repository: PredictionGridRepository | None = None,
        obs_repository: KmaObsRepository | None = None,
    ) -> None:
        self.grid_repository = grid_repository or PredictionGridRepository()
        self.obs_repository = obs_repository or KmaObsRepository()

    def predict_for_location(self, request: LocationPredictionRequest) -> LocationPredictionResponse:
        sample = self.grid_repository.sample(request.lat, request.lon)
        bloom = self._build_grid_date(sample, request.year)

        curve_points = [
            ProbabilityCurvePoint(
                offset_days=point.offset_days,
                date=point.date,
                probability=round(point.relative_value, 4) if point.relative_value is not None else None,
                relative_value=round(point.relative_value, 4) if point.relative_value is not None else None,
            )
            for point in sample.probability_curve
        ]
        observation_trend = self._build_observation_trend(
            self.obs_repository.nearest_trend(request.lat, request.lon, sample.pred_doy)
        )

        return LocationPredictionResponse(
            year=request.year,
            model="grid",
            clicked_location={"lat": request.lat, "lon": request.lon},
            nearest_station=StationMatch(
                stn_id=sample.cell,
                stn_name=sample.grid_id,
                sido=None,
                sigungu=None,
                lat=sample.lat,
                lon=sample.lon,
                distance_km=sample.distance_km,
            ),
            grid_cell=GridCellMatch(
                grid_id=sample.grid_id,
                cell=sample.cell,
                lat=sample.lat,
                lon=sample.lon,
                distance_km=sample.distance_km,
                elevation=sample.elevation,
                confidence=sample.confidence_label,
                confidence_label=sample.confidence_label,
                confidence_3day=sample.confidence_3day,
                confidence_3day_percent=sample.confidence_3day_percent,
                confidence_5day=sample.confidence_5day,
                confidence_5day_percent=sample.confidence_5day_percent,
                naturing_obs_count=sample.naturing_obs_count,
                nearest_naturing_dist_km=(
                    round(sample.nearest_naturing_dist_km, 3)
                    if sample.nearest_naturing_dist_km is not None
                    else None
                ),
            ),
            probability_curve=curve_points,
            prediction_probability=sample.confidence_3day_percent,
            observation_trend=observation_trend,
            sprout=None,
            bloom=bloom,
            fullbloom=None,
            recommended_festival_window=DateWindow(
                start_date=sample.lower_date_3day,
                end_date=sample.upper_date_3day,
            ),
            uncertainty_source="KNA 2026 validation confidence and relative curve values from data/cherry_backend_lookup_2026.csv",
        )

    @staticmethod
    def _build_grid_date(sample: PredictionGridSample, year: int) -> ProbabilisticDate:
        mean = sample.pred_doy
        std = sample.sd_days or 3.0
        p10 = clamp_doy(mean - 1.2816 * std, year)
        p50 = clamp_doy(mean, year)
        p90 = clamp_doy(mean + 1.2816 * std, year)

        return ProbabilisticDate(
            doy_mean=round(mean, 2),
            doy_std=round(std, 2),
            date_mean=doy_to_date(year, mean),
            date_p10=doy_to_date(year, p10),
            date_p50=doy_to_date(year, p50),
            date_p90=doy_to_date(year, p90),
            lower_date_3day=sample.lower_date_3day,
            upper_date_3day=sample.upper_date_3day,
            probability=sample.confidence_3day_percent,
            confidence_3day_percent=sample.confidence_3day_percent,
            confidence_5day_percent=sample.confidence_5day_percent,
        )

    @staticmethod
    def _build_observation_trend(trend) -> ObservationTrend | None:
        if trend is None:
            return None
        return ObservationTrend(
            station_name=trend.station_name,
            site=trend.site,
            lat=trend.lat,
            lon=trend.lon,
            elevation=trend.elevation,
            distance_km=trend.distance_km,
            baseline_year=trend.baseline_year,
            baseline_doy=trend.baseline_doy,
            predicted_delta_days=trend.predicted_delta_days,
            records=[
                ObservationTrendPoint(year=record.year, date=record.date, doy=record.doy)
                for record in trend.records
            ],
        )
