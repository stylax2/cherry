# VWorld API Notes

Source pages:

- WMS/WFS 2.0 reference: https://www.vworld.kr/dev/v4dv_wmsguide2_s001.do
- WMTS reference: https://www.vworld.kr/dev/v4dv_wmtsguide_s001.do
- Search API 2.0 reference: https://www.vworld.kr/dev/v4dv_search2_s001.do

## Basemap: WMTS

The service uses WMTS for high-performance background map tiles.

Request URL:

```text
https://api.vworld.kr/req/wmts/1.0.0/{key}/{layer}/{tileMatrix}/{tileRow}/{tileCol}.{tileType}
```

Required request parameters:

| Parameter | Required | Meaning | Valid values |
| --- | --- | --- | --- |
| key | yes | Issued API key | VWorld key |
| layer | yes | Map layer | Base, white, midnight, Hybrid, Satellite |
| tileMatrix | yes | Zoom level | Base/Hybrid/Satellite: 6-19 |
| tileRow | yes | Google index Y | number |
| tileCol | yes | Google index X | number |
| tileType | yes | Tile extension | Base/Hybrid png, Satellite jpeg |

Layers used in this project:

```text
Base:      https://api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png
Satellite: https://api.vworld.kr/req/wmts/1.0.0/{key}/Satellite/{z}/{y}/{x}.jpeg
Hybrid:    https://api.vworld.kr/req/wmts/1.0.0/{key}/Hybrid/{z}/{y}/{x}.png
```

## Overlay Data: WMS/WFS 2.0

The WMS endpoint is intended for optional administrative or thematic overlays.

WMS request URL:

```text
https://api.vworld.kr/req/wms?key={key}&[WMS Param]
```

Important WMS GetMap request parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| service | optional | WMS, default WMS |
| version | optional | 1.3.0, default 1.3.0 |
| request | yes | GetMap or GetCapabilities |
| key | yes | Issued API key |
| format | optional | image/png by default |
| exceptions | optional | text/xml by default |
| layers | yes | One or more layer names, up to 4 |
| styles | optional | One-to-one styles for layers |
| bbox | yes | Bounding box |
| width | yes | Pixel width |
| height | yes | Pixel height |
| transparent | optional | TRUE or FALSE |
| bgcolor | optional | 0xFFFFFF by default |
| crs | optional | EPSG:4326 by default |
| domain | optional | Registered domain for browser use |

Important WMS GetFeatureInfo request parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| request | yes | GetFeatueInfo in the VWorld document |
| query_layers | yes | Query layer names |
| info_format | optional | text/plain, GML, HTML, application/json, text/javascript |
| feature_count | optional | Maximum feature count, default 1 |
| i | yes | Map X pixel coordinate |
| j | yes | Map Y pixel coordinate |

WFS request URL:

```text
https://api.vworld.kr/req/wfs?key={key}&[WFS Param]
```

Important WFS request parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| service | optional | WFS, default WFS |
| version | optional | 1.1.0, default 1.1.0 |
| request | yes | GetFeature or GetCapabilities |
| key | yes | Issued API key |
| output | optional | GML or application/json |
| typename | yes | One or more layer names, up to 4 |
| bbox | optional | Bounding box |
| propertyname | optional | Requested attributes |
| maxfeatures | optional | Feature limit for version 1.0.0 |
| count | optional | Feature limit for version 2.0.0 |
| startindex | optional | Start offset for version 2.0.0 |
| sortby | optional | Sort expression |
| srsname | optional | EPSG:900913 by default |
| domain | optional | Registered domain for browser use |
| filter | optional | OGC filter |

## Address And Place Search: Search API 2.0

Request URL:

```text
https://api.vworld.kr/req/search?key={key}&[Search API parameters]
```

Search key used by this project:

```text
9B3E51CE-4BB6-3606-937B-39AFF211F204
```

Important request parameters:

| Parameter | Required | Meaning | Values |
| --- | --- | --- | --- |
| service | optional | Service name | search |
| version | optional | API version | 2.0 |
| request | required | Operation | search |
| key | required | Issued API key | VWorld search key |
| format | optional | Response format | json, xml |
| errorFormat | optional | Error format | json, xml |
| size | optional | Page size | 1-1000 |
| page | optional | Page number | number |
| query | required | Search text | address, place, district, road name |
| type | required | Search target | PLACE, ADDRESS, DISTRICT, ROAD |
| category | conditional | Subtype | ADDRESS: ROAD/PARCEL, DISTRICT: L1-L4 |
| bbox | optional | Search area | minx,miny,maxx,maxy |
| crs | optional | Result coordinate reference system | EPSG:4326 default |
| callback | optional | JSON callback | function name |

This frontend tries ADDRESS/ROAD, ADDRESS/PARCEL, then PLACE in EPSG:4326.
