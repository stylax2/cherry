# Cherry Bloom WebGIS Frontend

Static first-pass landing page for the cherry blossom forecast WebGIS.

## Open

Open `frontend/index.html` in a browser.

The page uses:

- VWorld WMTS Base map
- VWorld WMTS Satellite map
- OpenLayers from CDN
- Existing backend endpoint: `POST http://127.0.0.1:8000/api/v1/predict/location`

If the backend is not running, the page still shows the clicked coordinate and a connection notice.

## VWorld Key

The current development key is stored in `frontend/app.js`.

