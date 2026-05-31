from typing import Any

import requests

from app.config import settings


def search_cherry_festivals(keyword: str = "벚꽃축제", rows: int = 100) -> dict[str, Any]:
    params = {
        "serviceKey": settings.tour_api_key,
        "MobileOS": "ETC",
        "MobileApp": "CherryBloomWebGIS",
        "_type": "json",
        "keyword": keyword,
        "contentTypeId": "15",
        "arrange": "A",
        "numOfRows": str(rows),
        "pageNo": "1",
    }
    response = requests.get(settings.tour_keyword_endpoint, params=params, timeout=20)
    response.raise_for_status()
    return response.json()
