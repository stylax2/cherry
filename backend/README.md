# Cherry Bloom Forecast Backend

FastAPI backend for the cherry blossom WebGIS service.

The prediction endpoint uses the precomputed 2026 national grid outputs in `data/`. It does not run a model at request time.

## Prediction Inputs

- `data/cherry_pred_grid_2026.gpkg`: 2026 prediction grid as EPSG:4326 GeoPackage points
- `data/cherry_pred_lookup_2026.csv`: backend lookup table with predicted DOY, dates, uncertainty, and +/-3 day probabilities

`cherry_pred_lookup_2026.csv` is loaded into memory with a KDTree for fast nearest-cell lookup from a clicked or geocoded coordinate.

## Run

```powershell
cd E:\cherry\backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Endpoint

`POST /api/v1/predict/location`

```json
{
  "lat": 37.5665,
  "lon": 126.978,
  "year": 2026
}
```

The response keeps the existing forecast shape and adds grid/probability fields for the frontend:

- `bloom.doy_mean`: predicted bloom DOY
- `bloom.date_p50`: predicted 2026 calendar date
- `bloom.lower_date_3day` / `bloom.upper_date_3day`: +/-3 day display range
- `prediction_probability`: probability at the predicted date
- `probability_curve`: seven date-axis points from `-3` to `+3` days for the frontend accuracy-range curve
- `observation_trend`: nearest KMA biological-season observation station and year-by-year DOY records
- `grid_cell`: matched grid cell metadata and confidence
