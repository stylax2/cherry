from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    backend_root: Path = Path(__file__).resolve().parents[1]
    repo_root: Path = Path(__file__).resolve().parents[2]
    station_meta_path: Path = repo_root / "station_meta_23.csv"
    predictions_path: Path = repo_root / "data" / "test_predictions.csv"
    model_scores_path: Path = repo_root / "data" / "model_scores.csv"
    prediction_grid_path: Path = repo_root / "data" / "cherry_pred_grid_2026.gpkg"
    prediction_lookup_path: Path = repo_root / "data" / "cherry_backend_lookup_2026.csv"
    kma_obs_path: Path = repo_root / "data" / "기상청_OBS.xlsx"
    festivals_geojson_path: Path = repo_root / "cherry_blossom_festivals.geojson"
    tour_api_key: str = "YEf+SkklvUZZNXTEKYwZeTCsNBaGvFdT8z7ULIDufbtKqPpeUobKPUyaXh8gYJhxpFnr/s0Dm0TLVHqe4izd3w=="
    tour_keyword_endpoint: str = "https://apis.data.go.kr/B551011/KorService2/searchKeyword2"
    vworld_search_key: str = "9B3E51CE-4BB6-3606-937B-39AFF211F204"
    vworld_search_endpoint: str = "https://api.vworld.kr/req/search"


settings = Settings()
