const VWORLD_KEY = "4B1C42DC-2A7F-302B-AB97-270733346A4F";
const VWORLD_SEARCH_KEY = "9B3E51CE-4BB6-3606-937B-39AFF211F204";
const TOUR_API_KEY = "YEf+SkklvUZZNXTEKYwZeTCsNBaGvFdT8z7ULIDufbtKqPpeUobKPUyaXh8gYJhxpFnr/s0Dm0TLVHqe4izd3w==";
const FORECAST_API_ENDPOINT = "http://127.0.0.1:8000/api/v1/predict/location";
const TOUR_PROXY_ENDPOINT = "http://127.0.0.1:8000/api/v1/festivals/search";
const GEOCODE_PROXY_ENDPOINT = "http://127.0.0.1:8000/api/v1/geocode/search";
const TOUR_KEYWORD_ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/searchKeyword2";
const LOCAL_FESTIVAL_CACHE = "./data/cherry_blossom_festivals.geojson";
const FESTIVAL_KEYWORD = "벚꽃축제";

const vworldTileUrl = (layer, ext) =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;

const baseLayer = new ol.layer.Tile({
  visible: true,
  source: new ol.source.XYZ({
    url: vworldTileUrl("Base", "png"),
    minZoom: 6,
    maxZoom: 19,
    crossOrigin: "anonymous",
    attributions: "VWorld",
  }),
});

const satelliteLayer = new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({
    url: vworldTileUrl("Satellite", "jpeg"),
    minZoom: 6,
    maxZoom: 19,
    crossOrigin: "anonymous",
    attributions: "VWorld",
  }),
});

const hybridLayer = new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({
    url: vworldTileUrl("Hybrid", "png"),
    minZoom: 6,
    maxZoom: 19,
    crossOrigin: "anonymous",
    attributions: "VWorld",
  }),
});

const festivalSource = new ol.source.Vector();
const festivalLayer = new ol.layer.Vector({
  source: festivalSource,
  style: (feature) => buildFestivalStyle(feature),
});

const markerElement = document.createElement("div");
markerElement.className = "click-marker";

const clickOverlay = new ol.Overlay({
  element: markerElement,
  positioning: "center-center",
  stopEvent: false,
});

const map = new ol.Map({
  target: "map",
  layers: [baseLayer, satelliteLayer, hybridLayer, festivalLayer],
  overlays: [clickOverlay],
  view: new ol.View({
    center: ol.proj.fromLonLat([127.7, 36.2]),
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
  }),
});

const elements = {
  apiStatus: document.getElementById("apiStatus"),
  addressForm: document.getElementById("addressForm"),
  addressInput: document.getElementById("addressInput"),
  loadFestivalsBtn: document.getElementById("loadFestivalsBtn"),
  modal: document.getElementById("forecastModal"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  modalKicker: document.getElementById("modalKicker"),
  modalTitle: document.getElementById("modalTitle"),
  modalIntro: document.getElementById("modalIntro"),
  predDate: document.getElementById("predDate"),
  predDoy: document.getElementById("predDoy"),
  forecastWindow: document.getElementById("forecastWindow"),
  confidence3Day: document.getElementById("confidence3Day"),
  confidence5Day: document.getElementById("confidence5Day"),
  confidenceLabel: document.getElementById("confidenceLabel"),
  elevationItem: document.getElementById("elevationItem"),
  elevationValue: document.getElementById("elevationValue"),
  relativeCurveChart: document.getElementById("relativeCurveChart"),
  curveEmptyMessage: document.getElementById("curveEmptyMessage"),
};

document.querySelectorAll(".map-mode").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.layer;
    baseLayer.setVisible(mode === "base");
    satelliteLayer.setVisible(mode === "satellite");
    hybridLayer.setVisible(mode === "satellite");
    document.querySelectorAll(".map-mode").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
  });
});

elements.loadFestivalsBtn.addEventListener("click", loadCherryFestivals);

elements.addressForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = elements.addressInput.value.trim();
  if (query) {
    await searchAddressAndPredict(query);
  }
});

elements.modalCloseBtn.addEventListener("click", closeForecastModal);
elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeForecastModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeForecastModal();
});

map.on("click", async (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate);
  if (feature && feature.get("featureType") === "festival") {
    await selectFestival(feature);
    return;
  }

  const [lon, lat] = ol.proj.toLonLat(event.coordinate);
  clickOverlay.setPosition(event.coordinate);
  await predictAtLocation(lat, lon, {
    title: "벚꽃 만개 예측 결과",
    intro: "지도에서 직접 선택한 위치의 예측 격자 결과입니다.",
  });
});

async function loadCherryFestivals() {
  setStatus("축제 불러오는 중", "pending");
  elements.loadFestivalsBtn.disabled = true;
  try {
    const result = await fetchFestivalData();
    const festivals = result.items.filter((item) => Number.isFinite(Number(item.mapx)) && Number.isFinite(Number(item.mapy)));
    renderFestivalMarkers(festivals);
    setStatus(`축제 ${festivals.length}개`, "ok");
  } catch (error) {
    festivalSource.clear();
    setStatus("축제 로딩 실패", "error");
  } finally {
    elements.loadFestivalsBtn.disabled = false;
  }
}

async function fetchFestivalData() {
  const attempts = [
    {
      url: `${TOUR_PROXY_ENDPOINT}?keyword=${encodeURIComponent(FESTIVAL_KEYWORD)}&rows=100`,
      parser: async (response) => normalizeTourItems(await response.json()),
    },
    {
      url: buildTourKeywordUrl(),
      parser: async (response) => normalizeTourItems(await response.json()),
    },
    {
      url: LOCAL_FESTIVAL_CACHE,
      parser: async (response) => normalizeGeoJsonItems(await response.json()),
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = await attempt.parser(response);
      if (items.length > 0) return { items };
      lastError = new Error("No festival items");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No festival data available");
}

function buildTourKeywordUrl() {
  const params = new URLSearchParams({
    serviceKey: TOUR_API_KEY,
    MobileOS: "ETC",
    MobileApp: "CherryBloomWebGIS",
    _type: "json",
    keyword: FESTIVAL_KEYWORD,
    contentTypeId: "15",
    arrange: "A",
    numOfRows: "100",
    pageNo: "1",
  });
  return `${TOUR_KEYWORD_ENDPOINT}?${params.toString()}`;
}

function normalizeTourItems(data) {
  const rawItems = data?.response?.body?.items?.item;
  if (!rawItems) return [];
  return Array.isArray(rawItems) ? rawItems : [rawItems];
}

function normalizeGeoJsonItems(data) {
  return (data.features || []).map((feature) => {
    const props = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [props.lon, props.lat];
    return {
      contentid: props.contentId || props.content_id || props.title,
      title: props.title,
      addr1: props.addr1,
      addr2: props.addr2,
      mapx: props.mapX || props.mapx || props.lon || coordinates[0],
      mapy: props.mapY || props.mapy || props.lat || coordinates[1],
    };
  });
}

function renderFestivalMarkers(festivals) {
  festivalSource.clear();
  const features = festivals.map((festival) => {
    const lon = Number(festival.mapx);
    const lat = Number(festival.mapy);
    return new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
      featureType: "festival",
      contentId: festival.contentid,
      title: festival.title || "벚꽃축제",
      addr1: festival.addr1 || "",
      lon,
      lat,
      selected: false,
    });
  });
  festivalSource.addFeatures(features);
  if (features.length > 0) {
    map.getView().fit(festivalSource.getExtent(), {
      padding: [90, 90, 90, 90],
      maxZoom: 11,
      duration: 450,
    });
  }
}

async function selectFestival(feature) {
  festivalSource.getFeatures().forEach((candidate) => candidate.set("selected", false));
  feature.set("selected", true);
  const coords = feature.getGeometry().getCoordinates();
  const [lon, lat] = ol.proj.toLonLat(coords);
  clickOverlay.setPosition(coords);
  map.getView().animate({ center: coords, zoom: Math.max(map.getView().getZoom(), 11), duration: 350 });
  await predictAtLocation(lat, lon, {
    kicker: "Cherry Festival",
    title: "벚꽃 만개 예측 결과",
    intro: feature.get("addr1") || feature.get("title") || "관광공사 API에서 불러온 벚꽃축제 위치입니다.",
  });
}

async function searchAddressAndPredict(query) {
  setStatus("주소 검색 중", "pending");
  try {
    const result = await geocodeAddress(query);
    const coords = ol.proj.fromLonLat([result.lon, result.lat]);
    clickOverlay.setPosition(coords);
    map.getView().animate({ center: coords, zoom: 13, duration: 400 });
    await predictAtLocation(result.lat, result.lon, {
      title: "벚꽃 만개 예측 결과",
      intro: result.title || query,
    });
  } catch (error) {
    setStatus("주소 검색 실패", "error");
  }
}

async function geocodeAddress(query) {
  const proxyData = await fetchJson(`${GEOCODE_PROXY_ENDPOINT}?query=${encodeURIComponent(query)}`);
  const proxyItem = firstGeocodeItem(proxyData);
  if (proxyItem) {
    return normalizeGeocodeItem(proxyItem, query);
  }

  const attempts = [
    { endpoint: "address", type: "road", category: "" },
    { endpoint: "address", type: "parcel", category: "" },
    { type: "address", category: "road" },
    { type: "address", category: "parcel" },
    { type: "place", category: "" },
  ];
  const keys = [...new Set([VWORLD_SEARCH_KEY, VWORLD_KEY])];
  for (const key of keys) {
    for (const attempt of attempts) {
      const data = attempt.endpoint === "address"
        ? await fetchVworldJson(buildVworldAddressUrl(query, attempt.type, key))
        : await fetchVworldJson(buildVworldSearchUrl(query, attempt, key));
      const item = firstGeocodeItem(data);
      if (item) {
        return normalizeGeocodeItem(item, query);
      }
    }
  }
  throw new Error("No geocode result");
}

function buildVworldAddressUrl(query, addressType, key) {
  const params = new URLSearchParams({
    service: "address",
    request: "getcoord",
    version: "2.0",
    crs: "EPSG:4326",
    address: query,
    type: addressType,
    format: "json",
    errorformat: "json",
    refine: "true",
    simple: "false",
    key,
  });
  return `https://api.vworld.kr/req/address?${params.toString()}`;
}

function buildVworldSearchUrl(query, attempt, key) {
  const params = new URLSearchParams({
    service: "search",
    request: "search",
    version: "2.0",
    crs: "EPSG:4326",
    size: "10",
    page: "1",
    query,
    type: attempt.type,
    format: "json",
    key,
  });
  if (attempt.category) {
    params.set("category", attempt.category);
  }
  return `https://api.vworld.kr/req/search?${params.toString()}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchVworldJson(url) {
  return (await fetchJson(url)) || (await fetchJsonp(url));
}

function fetchJsonp(url) {
  return new Promise((resolve) => {
    const callbackName = `vworldCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(cleanup, 5500, null);

    function cleanup(value) {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
      resolve(value);
    }

    window[callbackName] = (payload) => cleanup(payload);
    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${callbackName}`;
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
    lon: Number(item.point.x),
    lat: Number(item.point.y),
  };
}

async function predictAtLocation(lat, lon, context = {}) {
  setStatus("예측 요청 중", "pending");
  try {
    const response = await fetch(FORECAST_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, year: 2026, model: "grid" }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderForecastModal(await response.json(), context);
    setStatus("예측 완료", "ok");
  } catch (error) {
    setStatus("예측 실패", "error");
  }
}

function renderForecastModal(forecast, context = {}) {
  const gridCell = forecast.grid_cell || {};
  const bloom = forecast.bloom || {};
  const confidence3 = firstFinite(gridCell.confidence_3day_percent, bloom.confidence_3day_percent, forecast.prediction_probability);
  const confidence5 = firstFinite(gridCell.confidence_5day_percent, bloom.confidence_5day_percent);
  const curvePoints = buildRelativeCurvePoints(forecast.probability_curve || []);

  elements.modalKicker.textContent = context.kicker || "Forecast Result";
  elements.modalTitle.textContent = context.title || "벚꽃 만개 예측 결과";
  elements.modalIntro.textContent = context.intro || "선택한 위치의 예측 격자 결과입니다.";
  elements.predDate.textContent = bloom.date_p50 || bloom.date_mean || "-";
  elements.predDoy.textContent = Number.isFinite(Number(bloom.doy_mean)) ? `DOY ${Math.round(Number(bloom.doy_mean))}` : "DOY -";
  elements.forecastWindow.textContent = bloom.lower_date_3day && bloom.upper_date_3day
    ? `${bloom.lower_date_3day} ~ ${bloom.upper_date_3day}`
    : forecast.recommended_festival_window
      ? `${forecast.recommended_festival_window.start_date} ~ ${forecast.recommended_festival_window.end_date}`
      : "-";
  elements.confidence3Day.textContent = formatConfidence(confidence3);
  elements.confidence5Day.textContent = formatConfidence(confidence5);
  elements.confidenceLabel.textContent = gridCell.confidence_label || gridCell.confidence || "검증 신뢰도 정보 없음";

  setOptionalItem(elements.elevationItem, elements.elevationValue, gridCell.elevation, (value) => `${formatNumber(value, 0)} m`);

  renderRelativeCurve(curvePoints, confidence5);
  openForecastModal();
}

function buildRelativeCurvePoints(points) {
  return points
    .map((point) => ({
      date: point.date,
      offset: point.offset_days,
      relativeValue: firstFinite(point.relative_value, point.probability),
    }))
    .filter((point) => point.date && Number.isFinite(point.relativeValue));
}

function renderRelativeCurve(points, confidence5) {
  elements.relativeCurveChart.innerHTML = "";
  elements.curveEmptyMessage.classList.toggle("is-visible", points.length === 0);
  if (!points.length) return;

  const width = 640;
  const height = 230;
  const pad = { top: 28, right: 28, bottom: 46, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const peakPercent = Number.isFinite(Number(confidence5)) ? Math.min(100, Number(confidence5)) : 100;
  const maxRelative = Math.max(...points.map((point) => point.relativeValue), 1);
  const scaledPoints = points.map((point) => ({
    ...point,
    displayPercent: (point.relativeValue / maxRelative) * peakPercent,
  }));
  const x = (index) => pad.left + (index / Math.max(1, points.length - 1)) * plotW;
  const y = (percent) => pad.top + ((100 - percent) / 100) * plotH;
  const coords = scaledPoints.map((point, index) => [x(index), y(point.displayPercent)]);
  const centerIndex = points.findIndex((point) => point.offset === 0);
  const center = coords[centerIndex >= 0 ? centerIndex : Math.floor(coords.length / 2)];
  const areaPath = `${smoothPath(coords)} L ${coords.at(-1)[0]} ${pad.top + plotH} L ${coords[0][0]} ${pad.top + plotH} Z`;
  const yTicks = [0, 25, 50, 75, 100];

  elements.relativeCurveChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="예측 구간 내 날짜별 상대 가능성">
      <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${width - pad.right}" y2="${pad.top + plotH}" class="axis-line" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" class="axis-line" />
      ${yTicks.map((tick) => `
        <line x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}" class="grid-line" />
        <text x="${pad.left - 10}" y="${y(tick) + 4}" class="axis-label" text-anchor="end">${tick}%</text>
      `).join("")}
      ${points.map((point, index) => `<line x1="${x(index)}" y1="${pad.top}" x2="${x(index)}" y2="${pad.top + plotH}" class="grid-line is-vertical" />`).join("")}
      <path d="${areaPath}" class="relative-area" />
      <path d="${smoothPath(coords)}" class="relative-line" />
      ${coords.map((coord, index) => `<circle cx="${coord[0]}" cy="${coord[1]}" r="${points[index].offset === 0 ? 6 : 4}" class="${points[index].offset === 0 ? "relative-dot is-center" : "relative-dot"}" />`).join("")}
      <line x1="${center[0]}" y1="${pad.top}" x2="${center[0]}" y2="${pad.top + plotH}" class="center-line" />
      <text x="${center[0]}" y="${center[1] - 12}" class="center-label" text-anchor="middle">예상 만개일 ${peakPercent.toFixed(1)}%</text>
      ${points.map((point, index) => `<text x="${x(index)}" y="${height - 16}" class="axis-label" text-anchor="middle">${formatMonthDay(point.date)}</text>`).join("")}
    </svg>
  `;
}

function buildFestivalStyle(feature) {
  const selected = feature.get("selected");
  const title = feature.get("title") || "벚꽃축제";
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: selected ? 8 : 6,
      fill: new ol.style.Fill({ color: selected ? "#c0175b" : "#f06a9d" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: selected ? 3 : 2 }),
    }),
    text: new ol.style.Text({
      text: title,
      offsetY: -18,
      font: "700 12px Noto Sans KR, sans-serif",
      overflow: true,
      fill: new ol.style.Fill({ color: "#77113b" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 4 }),
    }),
  });
}

function setOptionalItem(item, valueElement, value, formatter) {
  const numeric = Number(value);
  const visible = value !== null && value !== undefined && value !== "" && Number.isFinite(numeric);
  item.hidden = !visible;
  if (visible) valueElement.textContent = formatter(numeric);
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function formatConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "검증 신뢰도 정보 없음";
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(1)}%`;
}

function formatNumber(value, digits) {
  return Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMonthDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function smoothPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current[0] + next[0]) / 2;
    path += ` C ${midX} ${current[1]}, ${midX} ${next[1]}, ${next[0]} ${next[1]}`;
  }
  return path;
}

function openForecastModal() {
  elements.modal.classList.add("is-open");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeForecastModal() {
  elements.modal.classList.remove("is-open");
  elements.modal.setAttribute("aria-hidden", "true");
}

function setStatus(message, state) {
  elements.apiStatus.textContent = message;
  elements.apiStatus.classList.toggle("is-ok", state === "ok");
  elements.apiStatus.classList.toggle("is-error", state === "error");
}
