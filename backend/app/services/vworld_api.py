from typing import Any

import requests

from app.config import settings


MAP_KEY = "4B1C42DC-2A7F-302B-AB97-270733346A4F"


def search_address(query: str) -> dict[str, Any]:
    keys = list(dict.fromkeys([settings.vworld_search_key, MAP_KEY]))
    last_payload: dict[str, Any] = {}
    last_error: str | None = None

    for key in keys:
        for address_type in ("road", "parcel"):
            try:
                payload = _request_address_coord(query=query, address_type=address_type, key=key)
            except requests.RequestException as exc:
                last_error = str(exc)
                continue
            last_payload = payload
            point = payload.get("response", {}).get("result", {}).get("point")
            if point and point.get("x") and point.get("y"):
                return _as_search_items_payload(query=query, point=point, source_payload=payload)

        for entry in (
            {"type": "address", "category": "road"},
            {"type": "address", "category": "parcel"},
            {"type": "place", "category": ""},
        ):
            try:
                payload = _request_search(query=query, entry=entry, key=key)
            except requests.RequestException as exc:
                last_error = str(exc)
                continue
            last_payload = payload
            items = payload.get("response", {}).get("result", {}).get("items", [])
            if items:
                return payload

    if last_error and not last_payload:
        return {
            "response": {
                "status": "ERROR",
                "result": {"items": []},
                "error": {"message": last_error},
            }
        }
    return last_payload or {"response": {"result": {"items": []}}}


def _request_address_coord(query: str, address_type: str, key: str) -> dict[str, Any]:
    params = {
        "service": "address",
        "request": "getcoord",
        "version": "2.0",
        "crs": "EPSG:4326",
        "address": query,
        "type": address_type,
        "format": "json",
        "errorformat": "json",
        "refine": "true",
        "simple": "false",
        "key": key,
    }
    response = requests.get(
        "https://api.vworld.kr/req/address",
        params=params,
        headers={"User-Agent": "CherryBloomWebGIS/1.0"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _request_search(query: str, entry: dict[str, str], key: str) -> dict[str, Any]:
    params = {
        "service": "search",
        "request": "search",
        "version": "2.0",
        "crs": "EPSG:4326",
        "size": "10",
        "page": "1",
        "query": query,
        "type": entry["type"],
        "format": "json",
        "key": key,
    }
    if entry["category"]:
        params["category"] = entry["category"]
    response = requests.get(
        settings.vworld_search_endpoint,
        params=params,
        headers={"User-Agent": "CherryBloomWebGIS/1.0"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _as_search_items_payload(query: str, point: dict[str, Any], source_payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "response": {
            "status": source_payload.get("response", {}).get("status", "OK"),
            "result": {
                "items": [
                    {
                        "title": query,
                        "point": {"x": point["x"], "y": point["y"]},
                        "address": {"road": query, "parcel": query},
                    }
                ]
            },
        }
    }
