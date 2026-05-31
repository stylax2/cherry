# WebGIS Components

## First Landing Scope

The first landing page is a map-first interface. It gives the user one immediate task: click a location in Korea and receive the nearest-station probabilistic cherry bloom forecast from the backend.

## Components

| Component | Role |
| --- | --- |
| Header | Brand, year, and service status |
| BasemapSwitcher | Toggle VWorld Base and Satellite maps |
| MapView | OpenLayers map centered on Korea |
| ClickMarker | Marks the user's selected location |
| ForecastPanel | Shows clicked coordinate, nearest station, bloom P10/P50/P90, and recommended festival window |
| ApiStatus | Shows whether the backend prediction endpoint responded |
| VWorldReferencePanel | Keeps key WMTS/WMS request parameters visible for development |

## Layer Plan

| Layer | Source | Purpose |
| --- | --- | --- |
| Base | VWorld WMTS Base | Default general map |
| Satellite | VWorld WMTS Satellite | User inspection of terrain/parks/rivers |
| Hybrid | VWorld WMTS Hybrid | Optional label overlay on satellite |
| Station/Festival | Backend GeoJSON, future task | Cherry forecast and festival markers |
| Administrative overlays | VWorld WMS/WFS, future task | Sido/sigungu boundary context |

## Backend Contract

```http
POST /api/v1/predict/location
Content-Type: application/json

{
  "lat": 37.57,
  "lon": 126.98,
  "year": 2026,
  "model": "xgb"
}
```

The page expects:

- `nearest_station`
- `bloom.date_p10`
- `bloom.date_p50`
- `bloom.date_p90`
- `recommended_festival_window`

