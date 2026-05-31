// ── Configuration ─────────────────────────────────────────────────────────────
const VWORLD_KEY        = "4B1C42DC-2A7F-302B-AB97-270733346A4F";
const VWORLD_SEARCH_KEY = "9B3E51CE-4BB6-3606-937B-39AFF211F204";
const GRID_DATA_URL     = "https://github.com/stylax2/cherry/releases/download/v1.0/cherry_backend_lookup_2026.csv";
const FESTIVAL_KEYWORD  = "벚꽃축제";
const FORECAST_YEAR     = 2026;

// ── Grid data cache ────────────────────────────────────────────────────────────
let _gridRows = null;
let _gridLoadPromise = null;

async function loadGridData() {
  if (_gridRows) return _gridRows;
  if (_gridLoadPromise) return _gridLoadPromise;
  _gridLoadPromise = (async () => {
    const response = await fetch(GRID_DATA_URL);
    if (!response.ok) throw new Error(`CSV 로드 실패: ${response.status}`);
    const text = await response.text();
    _gridRows = parseGridCsv(text);
    _gridLoadPromise = null;
    return _gridRows;
  })();
  return _gridLoadPromise;
}

function parseGridCsv(text) {
  const lines = text.split("\n");
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { fields.push(field); field = ""; }
      else { field += char; }
    }
  }
  fields.push(field);
  return fields;
}

// ── Spatial lookup ─────────────────────────────────────────────────────────────
function findNearestGridRow(lat, lon, rows) {
  let bestRow = null;
  let bestDistSq = Infinity;
  for (const row of rows) {
    const dLat = parseFloat(row.lat) - lat;
    const dLon = parseFloat(row.lon) - lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < bestDistSq) { bestDistSq = distSq; bestRow = row; }
  }
  return bestRow;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function doyToDate(year, doy) {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + Math.round(doy) - 1);
  return d.toISOString().slice(0, 10);
}

function csvFloat(value) { const n = parseFloat(value); return Number.isFinite(n) ? n : null; }
function csvInt(value)   { const n = parseInt(value, 10); return Number.isFinite(n) ? n : null; }

function buildForecastFromRow(row, lat, lon) {
  const rowLat = parseFloat(row.lat);
  const rowLon = parseFloat(row.lon);
  const distKm = Math.round(haversineKm(lat, lon, rowLat, rowLon) * 1000) / 1000;
  const predDoy = parseFloat(row.pred_doy);
  const sdDays  = csvFloat(row.error_window_days) ?? csvFloat(row.sd_days) ?? 3.0;

  const conf3pct = csvFloat(row.confidence_3day_percent)
    ?? (csvFloat(row.confidence_3day) != null ? csvFloat(row.confidence_3day) * 100 : null);
  const conf5pct = csvFloat(row.confidence_5day_percent)
    ?? (csvFloat(row.confidence_5day) != null ? csvFloat(row.confidence_5day) * 100 : null);

  const OFFSET_KEYS = ["minus3", "minus2", "minus1", "0", "plus1", "plus2", "plus3"];
  const probabilityCurve = [-3, -2, -1, 0, 1, 2, 3].map((offset, i) => {
    const key = OFFSET_KEYS[i];
    const relVal = csvFloat(row[`curve_${key}`]) ?? csvFloat(row[`p_${key}`]);
    return { offset_days: offset, date: row[`date_${key}`] || "", probability: relVal, relative_value: relVal };
  }).filter((p) => p.date);

  return {
    year: FORECAST_YEAR, model: "grid",
    clicked_location: { lat, lon },
    grid_cell: {
      grid_id: row.grid_id, cell: csvInt(row.cell),
      lat: rowLat, lon: rowLon, distance_km: distKm,
      elevation: csvFloat(row.elevation),
      confidence: row.confidence_label || null,
      confidence_label: row.confidence_label || null,
      confidence_3day: csvFloat(row.confidence_3day),
      confidence_3day_percent: conf3pct,
      confidence_5day: csvFloat(row.confidence_5day),
      confidence_5day_percent: conf5pct,
      naturing_obs_count: csvInt(row.naturing_obs_count),
      nearest_naturing_dist_km: csvFloat(row.nearest_naturing_dist_km),
    },
    bloom: {
      doy_mean: Math.round(predDoy * 100) / 100,
      doy_std:  Math.round(sdDays * 100) / 100,
      date_mean: row.pred_date,
      date_p10:  doyToDate(FORECAST_YEAR, predDoy - 1.2816 * sdDays),
      date_p50:  row.pred_date,
      date_p90:  doyToDate(FORECAST_YEAR, predDoy + 1.2816 * sdDays),
      lower_date_3day: row.lower_date_3day,
      upper_date_3day: row.upper_date_3day,
      probability: conf3pct,
      confidence_3day_percent: conf3pct,
      confidence_5day_percent: conf5pct,
    },
    probability_curve: probabilityCurve,
    prediction_probability: conf3pct,
    recommended_festival_window: { start_date: row.lower_date_3day, end_date: row.upper_date_3day },
    uncertainty_source: "cherry_backend_lookup_2026.csv",
  };
}

// ── Map setup ──────────────────────────────────────────────────────────────────
const vworldTileUrl = (layer, ext) =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;

const baseLayer = new ol.layer.Tile({
  visible: true,
  source: new ol.source.XYZ({ url: vworldTileUrl("Base", "png"), minZoom: 6, maxZoom: 19, crossOrigin: "anonymous", attributions: "VWorld" }),
});
const satelliteLayer = new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({ url: vworldTileUrl("Satellite", "jpeg"), minZoom: 6, maxZoom: 19, crossOrigin: "anonymous", attributions: "VWorld" }),
});
const hybridLayer = new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({ url: vworldTileUrl("Hybrid", "png"), minZoom: 6, maxZoom: 19, crossOrigin: "anonymous", attributions: "VWorld" }),
});

const festivalSource = new ol.source.Vector();
const festivalLayer  = new ol.layer.Vector({
  source: festivalSource,
  style: (feature) => buildFestivalStyle(feature),
});

const markerElement = document.createElement("div");
markerElement.className = "click-marker";

const clickOverlay = new ol.Overlay({ element: markerElement, positioning: "center-center", stopEvent: false });

const map = new ol.Map({
  target: "map",
  layers: [baseLayer, satelliteLayer, hybridLayer, festivalLayer],
  overlays: [clickOverlay],
  view: new ol.View({ center: ol.proj.fromLonLat([127.7, 36.2]), zoom: 7, minZoom: 6, maxZoom: 18 }),
});

// ── Element refs ───────────────────────────────────────────────────────────────
const el = {
  splash:          document.getElementById("splashScreen"),
  appShell:        document.getElementById("appShell"),
  apiStatus:       document.getElementById("apiStatus"),
  loadFestivalsBtn:document.getElementById("loadFestivalsBtn"),
  clearFestivalsBtn:document.getElementById("clearFestivalsBtn"),
  selectModeBtn:   document.getElementById("selectModeBtn"),
  clearSelectionBtn:document.getElementById("clearSelectionBtn"),
  addressForm:     document.getElementById("addressForm"),
  addressInput:    document.getElementById("addressInput"),
  clearSearchBtn:  document.getElementById("clearSearchBtn"),
  modal:           document.getElementById("forecastModal"),
  modalDragHandle: document.getElementById("modalDragHandle"),
  modalCloseBtn:   document.getElementById("modalCloseBtn"),
  modalKicker:     document.getElementById("modalKicker"),
  modalTitle:      document.getElementById("modalTitle"),
  modalIntro:      document.getElementById("modalIntro"),
  predDate:        document.getElementById("predDate"),
  predDoy:         document.getElementById("predDoy"),
  forecastWindow:  document.getElementById("forecastWindow"),
  confidence3Day:  document.getElementById("confidence3Day"),
  confidence5Day:  document.getElementById("confidence5Day"),
  confidenceLabel: document.getElementById("confidenceLabel"),
  elevationItem:   document.getElementById("elevationItem"),
  elevationValue:  document.getElementById("elevationValue"),
  relativeCurveChart: document.getElementById("relativeCurveChart"),
  curveEmptyMessage:  document.getElementById("curveEmptyMessage"),
};

// ── Splash screen ──────────────────────────────────────────────────────────────
el.splash.addEventListener("click", enterApp);
el.splash.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") enterApp(); });

function enterApp() {
  el.splash.classList.add("is-exiting");
  el.appShell.classList.remove("app-hidden");
  el.splash.addEventListener("animationend", () => {
    el.splash.style.display = "none";
  }, { once: true });
}

function returnToSplash() {
  closeForecastModal();
  el.splash.style.display = "";
  el.splash.classList.remove("is-exiting");
  el.appShell.classList.add("app-hidden");
}

document.querySelector(".brand").addEventListener("click", returnToSplash);
document.querySelector(".brand").style.cursor = "pointer";

// ── Map mode toggle ────────────────────────────────────────────────────────────
document.querySelectorAll(".map-mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.layer;
    baseLayer.setVisible(mode === "base");
    satelliteLayer.setVisible(mode === "satellite");
    hybridLayer.setVisible(mode === "satellite");
    document.querySelectorAll(".map-mode").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
});

// ── Festival section ───────────────────────────────────────────────────────────
el.loadFestivalsBtn.addEventListener("click", loadCherryFestivals);

el.clearFestivalsBtn.addEventListener("click", () => {
  festivalSource.clear();
  el.clearFestivalsBtn.disabled = true;
  setStatus("축제 초기화", "ok");
});

async function loadCherryFestivals() {
  setStatus("축제 불러오는 중", "pending");
  el.loadFestivalsBtn.disabled = true;
  try {
    const result = await fetchFestivalData();
    const festivals = result.items.filter(
      (item) => Number.isFinite(Number(item.mapx)) && Number.isFinite(Number(item.mapy))
    );
    renderFestivalMarkers(festivals);
    el.clearFestivalsBtn.disabled = false;
    setStatus(`축제 ${festivals.length}개`, "ok");
  } catch (error) {
    festivalSource.clear();
    console.error("[축제 로딩 실패]", error);
    setStatus(`축제 실패: ${error.message}`, "error");
  } finally {
    el.loadFestivalsBtn.disabled = false;
  }
}

async function fetchFestivalData() {
  const response = await fetch("/api/festivals");
  if (!response.ok) throw new Error(`관광공사 API 오류: HTTP ${response.status}`);
  const items = normalizeTourItems(await response.json());
  if (items.length === 0) throw new Error("축제 데이터가 없습니다.");
  return { items };
}

function normalizeTourItems(data) {
  const raw = data?.response?.body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function renderFestivalMarkers(festivals) {
  festivalSource.clear();
  const features = festivals.map((f) => {
    const lon = Number(f.mapx);
    const lat = Number(f.mapy);
    return new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
      featureType: "festival",
      contentId: f.contentid,
      title: f.title || "벚꽃축제",
      addr1: f.addr1 || "",
      tel: f.tel || "",
      lon, lat, selected: false,
    });
  });
  festivalSource.addFeatures(features);
  if (features.length > 0) {
    map.getView().fit(festivalSource.getExtent(), { padding: [90, 90, 90, 90], maxZoom: 11, duration: 450 });
  }
}

async function selectFestival(feature) {
  festivalSource.getFeatures().forEach((c) => c.set("selected", false));
  feature.set("selected", true);
  const coords = feature.getGeometry().getCoordinates();
  const [lon, lat] = ol.proj.toLonLat(coords);
  clickOverlay.setPosition(coords);
  map.getView().animate({ center: coords, zoom: Math.max(map.getView().getZoom(), 11), duration: 350 });
  el.clearSelectionBtn.disabled = false;

  // 축제 정보 카드 먼저 표시 (기본 필드)
  showFestivalCard({
    name:   feature.get("title"),
    addr:   feature.get("addr1"),
    tel:    feature.get("tel"),
    place:  "",
    period: "조회 중…",
  });

  // 예측 결과와 축제 상세(기간·장소) 병렬 조회
  const [, detail] = await Promise.allSettled([
    predictAtLocation(lat, lon, {
      kicker: "Cherry Festival",
      title:  "벚꽃 만개 예측 결과",
      intro:  feature.get("addr1") || feature.get("title"),
    }),
    fetchFestivalDetail(feature.get("contentId")),
  ]);

  if (detail.status === "fulfilled" && detail.value) {
    const d = detail.value;
    showFestivalCard({
      name:   feature.get("title"),
      addr:   feature.get("addr1"),
      tel:    feature.get("tel"),
      place:  d.eventplace || "",
      period: formatFestivalPeriod(d.eventstartdate, d.eventenddate),
    });
  } else {
    showFestivalCard({
      name:   feature.get("title"),
      addr:   feature.get("addr1"),
      tel:    feature.get("tel"),
      place:  "",
      period: "-",
    });
  }
}

async function fetchFestivalDetail(contentId) {
  if (!contentId) return null;
  const resp = await fetch(`/api/festival-detail?contentId=${encodeURIComponent(contentId)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  const raw = data?.response?.body?.items?.item;
  return Array.isArray(raw) ? raw[0] : raw;
}

function formatFestivalPeriod(start, end) {
  if (!start) return "-";
  const fmt = (s) => `${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`;
  return end ? `${fmt(start)} ~ ${fmt(end)}` : fmt(start);
}

function showFestivalCard(info) {
  const card = document.getElementById("festivalInfoCard");
  document.getElementById("ficName").textContent   = info.name   || "-";
  document.getElementById("ficAddr").textContent   = info.addr   || "-";
  document.getElementById("ficPeriod").textContent = info.period || "-";
  document.getElementById("ficPlace").textContent  = info.place  || "-";
  const telItem = document.getElementById("ficTelItem");
  if (info.tel) {
    document.getElementById("ficTel").textContent = info.tel;
    telItem.style.display = "";
  } else {
    telItem.style.display = "none";
  }
  card.style.display = "";
}

function hideFestivalCard() {
  document.getElementById("festivalInfoCard").style.display = "none";
}

// ── Selection section ─────────────────────────────────────────────────────────
el.selectModeBtn.addEventListener("click", () => {
  // Visual feedback — active mode hint
  el.selectModeBtn.classList.toggle("ctrl-active");
  const isActive = el.selectModeBtn.classList.contains("ctrl-active");
  setStatus(isActive ? "지도를 클릭하여 위치 선택" : "준비됨", isActive ? "pending" : "ok");
});

el.clearSelectionBtn.addEventListener("click", () => {
  clickOverlay.setPosition(undefined);
  closeForecastModal();
  el.clearSelectionBtn.disabled = true;
  el.selectModeBtn.classList.remove("ctrl-active");
  setStatus("선택 초기화", "ok");
});

// ── Search section ─────────────────────────────────────────────────────────────
el.addressForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = el.addressInput.value.trim();
  if (query) await searchAddressAndPredict(query);
});

el.clearSearchBtn.addEventListener("click", () => {
  el.addressInput.value = "";
  clickOverlay.setPosition(undefined);
  closeForecastModal();
  el.clearSearchBtn.disabled = true;
  setStatus("검색 초기화", "ok");
});

// ── Map click ─────────────────────────────────────────────────────────────────
map.on("click", async (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (c) => c);
  if (feature && feature.get("featureType") === "festival") {
    await selectFestival(feature);
    return;
  }
  const [lon, lat] = ol.proj.toLonLat(event.coordinate);
  clickOverlay.setPosition(event.coordinate);
  el.clearSelectionBtn.disabled = false;
  hideFestivalCard();
  await predictAtLocation(lat, lon, {
    title: "벚꽃 만개 예측 결과",
    intro: "지도에서 직접 선택한 위치의 예측 격자 결과입니다.",
  });
});

// ── Close modal on Escape ─────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeForecastModal(); });
el.modalCloseBtn.addEventListener("click", closeForecastModal);

// ── Core prediction ────────────────────────────────────────────────────────────
async function predictAtLocation(lat, lon, context = {}) {
  setStatus("예측 데이터 로딩 중", "pending");
  try {
    const rows = await loadGridData();
    const row = findNearestGridRow(lat, lon, rows);
    if (!row) throw new Error("격자 데이터 없음");
    renderForecastModal(buildForecastFromRow(row, lat, lon), context);
    setStatus("예측 완료", "ok");
  } catch (error) {
    setStatus("예측 실패", "error");
  }
}

async function searchAddressAndPredict(query) {
  setStatus("주소 검색 중", "pending");
  try {
    const result = await geocodeAddress(query);
    const coords = ol.proj.fromLonLat([result.lon, result.lat]);
    clickOverlay.setPosition(coords);
    map.getView().animate({ center: coords, zoom: 13, duration: 400 });
    el.clearSearchBtn.disabled = false;
    hideFestivalCard();
    await predictAtLocation(result.lat, result.lon, {
      title: "벚꽃 만개 예측 결과",
      intro: result.title || query,
    });
  } catch (error) {
    setStatus("주소 검색 실패", "error");
  }
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocodeAddress(query) {
  const attempts = [
    { endpoint: "address", type: "road" },
    { endpoint: "address", type: "parcel" },
    { endpoint: "search",  type: "address", category: "road" },
    { endpoint: "search",  type: "address", category: "parcel" },
    { endpoint: "search",  type: "place",   category: "" },
  ];
  const keys = [...new Set([VWORLD_SEARCH_KEY, VWORLD_KEY])];
  for (const key of keys) {
    for (const attempt of attempts) {
      const url = attempt.endpoint === "address"
        ? buildVworldAddressUrl(query, attempt.type, key)
        : buildVworldSearchUrl(query, attempt, key);
      const data = await fetchVworldJson(url);
      const item = firstGeocodeItem(data);
      if (item) return normalizeGeocodeItem(item, query);
    }
  }
  throw new Error("No geocode result");
}

function buildVworldAddressUrl(query, type, key) {
  return `https://api.vworld.kr/req/address?${new URLSearchParams({
    service: "address", request: "getcoord", version: "2.0", crs: "EPSG:4326",
    address: query, type, format: "json", errorformat: "json", refine: "true", simple: "false", key,
  })}`;
}

function buildVworldSearchUrl(query, attempt, key) {
  const p = new URLSearchParams({
    service: "search", request: "search", version: "2.0", crs: "EPSG:4326",
    size: "10", page: "1", query, type: attempt.type, format: "json", key,
  });
  if (attempt.category) p.set("category", attempt.category);
  return `https://api.vworld.kr/req/search?${p}`;
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const tid = window.setTimeout(() => ctrl.abort(), 4500);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
  finally { window.clearTimeout(tid); }
}

async function fetchVworldJson(url) { return (await fetchJson(url)) || (await fetchJsonp(url)); }

function fetchJsonp(url) {
  return new Promise((resolve) => {
    const cb = `vworldCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const tid = window.setTimeout(cleanup, 5500, null);
    function cleanup(val) { window.clearTimeout(tid); delete window[cb]; script.remove(); resolve(val); }
    window[cb] = (payload) => cleanup(payload);
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${cb}`;
    script.onerror = () => cleanup(null);
    document.head.appendChild(script);
  });
}

function firstGeocodeItem(data) {
  const item = data?.response?.result?.items?.[0];
  if (item) return item;
  const point = data?.response?.result?.point;
  return point?.x && point?.y ? { title: "", point } : null;
}

function normalizeGeocodeItem(item, query) {
  if (!item?.point?.x || !item?.point?.y) throw new Error("No geocode result");
  return {
    title: item.title || item.address?.road || item.address?.parcel || query,
    lon: Number(item.point.x), lat: Number(item.point.y),
  };
}

// ── Draggable modal ────────────────────────────────────────────────────────────
let _modalPositioned = false;
const isMobile = () => window.innerWidth <= 600;

// Reset desktop positioning when resizing across breakpoint
window.addEventListener("resize", () => {
  if (isMobile()) { _modalPositioned = false; }
});

function initModalDrag() {
  const handle = el.modalDragHandle;
  const modal  = el.modal;
  let dragging = false;
  let startX, startY, startLeft, startTop;

  function beginDrag(clientX, clientY) {
    if (document.activeElement === el.modalCloseBtn) return;
    dragging = true;
    startX = clientX; startY = clientY;
    if (isMobile()) {
      startTop = 0;
    } else {
      startLeft = parseInt(modal.style.left, 10) || modal.getBoundingClientRect().left;
      startTop  = parseInt(modal.style.top,  10) || modal.getBoundingClientRect().top;
      handle.style.cursor = "grabbing";
    }
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    if (isMobile()) {
      // Bottom sheet: only track downward drag
      const dy = clientY - startY;
      if (dy > 0) modal.style.transform = `translateY(${dy}px)`;
    } else {
      const dx = clientX - startX;
      const dy = clientY - startY;
      const maxLeft = window.innerWidth  - modal.offsetWidth;
      const maxTop  = window.innerHeight - modal.offsetHeight;
      modal.style.left  = `${Math.max(0, Math.min(maxLeft, startLeft + dx))}px`;
      modal.style.top   = `${Math.max(0, Math.min(maxTop,  startTop  + dy))}px`;
      modal.style.right     = "auto";
      modal.style.transform = "none";
    }
  }

  function endDrag(clientY) {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    if (isMobile()) {
      const dy = clientY - startY;
      if (dy > 80) {
        closeForecastModal(); // swipe down to close
      } else {
        modal.style.transform = "translateY(0)"; // snap back
      }
    }
  }

  handle.addEventListener("mousedown", (e) => { if (!e.target.closest(".modal-close")) beginDrag(e.clientX, e.clientY); });
  document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
  document.addEventListener("mouseup", (e) => endDrag(e.clientY));

  handle.addEventListener("touchstart", (e) => {
    if (e.target.closest(".modal-close")) return;
    const t = e.touches[0];
    beginDrag(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    endDrag(t.clientY);
  });
}

initModalDrag();

function openForecastModal() {
  const modal = el.modal;
  if (!_modalPositioned && !isMobile()) {
    // Position right-center on first open (desktop only)
    const mw = 440;
    const left = Math.max(20, window.innerWidth - mw - 24);
    const top  = Math.round((window.innerHeight - 600) / 2);
    modal.style.left      = `${left}px`;
    modal.style.top       = `${Math.max(20, top)}px`;
    modal.style.right     = "auto";
    modal.style.transform = "none";
    _modalPositioned = true;
  }
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");
}

function closeForecastModal() {
  el.modal.classList.remove("is-visible");
  el.modal.setAttribute("aria-hidden", "true");
}

// ── Modal rendering ────────────────────────────────────────────────────────────
function renderForecastModal(forecast, context = {}) {
  const gc     = forecast.grid_cell || {};
  const bloom  = forecast.bloom || {};
  const conf3  = firstFinite(gc.confidence_3day_percent, bloom.confidence_3day_percent, forecast.prediction_probability);
  const conf5  = firstFinite(gc.confidence_5day_percent, bloom.confidence_5day_percent);
  const curvePoints = buildRelativeCurvePoints(forecast.probability_curve || []);

  el.modalKicker.textContent   = context.kicker || "Forecast Result";
  el.modalTitle.textContent    = context.title  || "벚꽃 만개 예측 결과";
  el.modalIntro.textContent    = context.intro  || "선택한 위치의 예측 격자 결과입니다.";
  el.predDate.textContent      = bloom.date_p50 || bloom.date_mean || "-";
  el.predDoy.textContent       = Number.isFinite(Number(bloom.doy_mean))
    ? `DOY ${Math.round(Number(bloom.doy_mean))}` : "DOY -";
  el.forecastWindow.textContent = bloom.lower_date_3day && bloom.upper_date_3day
    ? `${bloom.lower_date_3day} ~ ${bloom.upper_date_3day}`
    : forecast.recommended_festival_window
      ? `${forecast.recommended_festival_window.start_date} ~ ${forecast.recommended_festival_window.end_date}`
      : "-";
  el.confidence3Day.textContent = formatConfidence(conf3);
  el.confidence5Day.textContent = formatConfidence(conf5);
  el.confidenceLabel.textContent = gc.confidence_label || gc.confidence || "검증 신뢰도 정보 없음";

  setOptionalItem(el.elevationItem, el.elevationValue, gc.elevation, (v) => `${formatNumber(v, 0)} m`);
  renderRelativeCurve(curvePoints, conf5);
  openForecastModal();
}

function buildRelativeCurvePoints(points) {
  return points
    .map((p) => ({ date: p.date, offset: p.offset_days, relativeValue: firstFinite(p.relative_value, p.probability) }))
    .filter((p) => p.date && Number.isFinite(p.relativeValue));
}

function renderRelativeCurve(points, confidence5) {
  el.relativeCurveChart.innerHTML = "";
  el.curveEmptyMessage.classList.toggle("is-visible", points.length === 0);
  if (!points.length) return;

  const width = 580, height = 210;
  const pad = { top: 24, right: 24, bottom: 42, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const peakPct = Number.isFinite(Number(confidence5)) ? Math.min(100, Number(confidence5)) : 100;
  const maxRel  = Math.max(...points.map((p) => p.relativeValue), 1);
  const scaled  = points.map((p) => ({ ...p, displayPercent: (p.relativeValue / maxRel) * peakPct }));

  const x = (i) => pad.left + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (pct) => pad.top + ((100 - pct) / 100) * plotH;
  const coords = scaled.map((p, i) => [x(i), y(p.displayPercent)]);
  const ci = points.findIndex((p) => p.offset === 0);
  const center = coords[ci >= 0 ? ci : Math.floor(coords.length / 2)];
  const areaPath = `${smoothPath(coords)} L ${coords.at(-1)[0]} ${pad.top + plotH} L ${coords[0][0]} ${pad.top + plotH} Z`;
  const yTicks = [0, 25, 50, 75, 100];

  el.relativeCurveChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="예측 구간 내 날짜별 상대 가능성">
      <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${width - pad.right}" y2="${pad.top + plotH}" class="axis-line"/>
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" class="axis-line"/>
      ${yTicks.map((t) => `
        <line x1="${pad.left}" y1="${y(t)}" x2="${width - pad.right}" y2="${y(t)}" class="grid-line"/>
        <text x="${pad.left - 8}" y="${y(t) + 4}" class="axis-label" text-anchor="end">${t}%</text>
      `).join("")}
      ${points.map((_, i) => `<line x1="${x(i)}" y1="${pad.top}" x2="${x(i)}" y2="${pad.top + plotH}" class="grid-line is-vertical"/>`).join("")}
      <path d="${areaPath}" class="relative-area"/>
      <path d="${smoothPath(coords)}" class="relative-line"/>
      ${coords.map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="${points[i].offset === 0 ? 6 : 4}" class="${points[i].offset === 0 ? "relative-dot is-center" : "relative-dot"}"/>`).join("")}
      <line x1="${center[0]}" y1="${pad.top}" x2="${center[0]}" y2="${pad.top + plotH}" class="center-line"/>
      <text x="${center[0]}" y="${center[1] - 11}" class="center-label" text-anchor="middle">예상 만개일 ${peakPct.toFixed(1)}%</text>
      ${points.map((p, i) => `<text x="${x(i)}" y="${height - 14}" class="axis-label" text-anchor="middle">${formatMonthDay(p.date)}</text>`).join("")}
    </svg>`;
}

// ── Festival marker style ──────────────────────────────────────────────────────
function buildFestivalStyle(feature) {
  const selected = feature.get("selected");
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: selected ? 8 : 6,
      fill:   new ol.style.Fill({ color: selected ? "#c0175b" : "#f06a9d" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: selected ? 3 : 2 }),
    }),
    text: new ol.style.Text({
      text: feature.get("title") || "벚꽃축제",
      offsetY: -18, font: "700 12px Noto Sans KR, sans-serif", overflow: true,
      fill:   new ol.style.Fill({ color: "#77113b" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 4 }),
    }),
  });
}

// ── Utility helpers ────────────────────────────────────────────────────────────
function setOptionalItem(item, valEl, value, formatter) {
  const n = Number(value);
  const visible = value != null && value !== "" && Number.isFinite(n);
  item.hidden = !visible;
  if (visible) valEl.textContent = formatter(n);
}

function firstFinite(...values) {
  for (const v of values) { const n = Number(v); if (Number.isFinite(n)) return n; }
  return null;
}

function formatConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "검증 신뢰도 정보 없음";
  return `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
}

function formatNumber(value, digits) {
  return Number(value).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatMonthDay(dateText) {
  const d = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateText;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function smoothPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i], nxt = points[i + 1];
    const mx = (cur[0] + nxt[0]) / 2;
    path += ` C ${mx} ${cur[1]}, ${mx} ${nxt[1]}, ${nxt[0]} ${nxt[1]}`;
  }
  return path;
}

function setStatus(msg, state) {
  el.apiStatus.textContent = msg;
  el.apiStatus.classList.toggle("is-ok",    state === "ok");
  el.apiStatus.classList.toggle("is-error", state === "error");
}
