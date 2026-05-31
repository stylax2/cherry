from fastapi import APIRouter, HTTPException

from fastapi import Query

from app.schemas import LocationPredictionRequest, LocationPredictionResponse
from app.services.bloom_predictor import BloomPredictor
from app.services.tour_api import search_cherry_festivals
from app.services.vworld_api import search_address


router = APIRouter()
predictor = BloomPredictor()


@router.post("/predict/location", response_model=LocationPredictionResponse)
def predict_location(request: LocationPredictionRequest) -> LocationPredictionResponse:
    try:
        return predictor.predict_for_location(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/festivals/search")
def search_festivals(keyword: str = Query("벚꽃축제", min_length=1), rows: int = Query(100, ge=1, le=100)) -> dict:
    return search_cherry_festivals(keyword=keyword, rows=rows)


@router.get("/geocode/search")
def geocode_search(query: str = Query(..., min_length=1)) -> dict:
    return search_address(query=query)
