import { GroupedLayers } from './src/leaflet.groupedlayercontrol.js';

const map = L.map('map').setView([51.1, 10.4], 6);
// Basemaps
const baselayersStatiaDark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'png'
}).addTo(map);

const baselayersSatellite = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'jpg'
});

const baselayersStadiaOutdoors = L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
});

// Data
const results = L.layerGroup().addTo(map);
const earthquakes = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const magnitude = Number(feature.properties.magnitude ?? 0);
    return L.circleMarker(latlng, {
      radius: Math.max(4, Math.min(12, 3 + magnitude * 1.5)),
      color: '#fff7ed',
      weight: 1.5,
      fillColor: '#ef704f',
      fillOpacity: 0.9
    });
  },
  onEachFeature: (feature, layer) => {
    const properties = feature.properties;
    const time = new Date(properties.event_time).toLocaleString('de-DE');
    const usgsLink = properties.url
      ? `<br><a href="${esc(properties.url)}" target="_blank" rel="noopener">USGS-Details</a>`
      : '';
    layer.bindPopup(
      `<b>M ${esc(properties.magnitude ?? 'unbekannt')} · ${esc(properties.place)}</b><br>` +
      `${esc(time)}<br>Tiefe: ${esc(properties.depth_km)} km<br>` +
      usgsLink
    );
  }
});

const cities = L.geoJSON(null, {
  onEachFeature: (feature, layer) => layer.bindPopup(
    `<b>${esc(feature.properties.name)}</b><br>${esc(feature.properties.adm0name)}`
  )
});

const countries = L.geoJSON(null, {
  style: { color: '#b7c8ce', weight: 1, fillOpacity: 0.12 },
  onEachFeature: (feature, layer) => layer.bindPopup(
    `<b>${esc(feature.properties.name)}</b><br>${esc(feature.properties.continent)}`
  )
});

const status = document.getElementById('status');
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const groupedOverlays = {
  'Layers': {
    'Cities': cities,
    'Countries': countries,
    'Earthquakes': earthquakes
  }
};

const layerControl = new GroupedLayers(
  { 
    'Statia Alidade Dark': baselayersStatiaDark,
    'Stadia Outdoors': baselayersStadiaOutdoors,
    'Satellite': baselayersSatellite
  },
  groupedOverlays
).addTo(map);

async function loadOverlayData() {
  try {
    const [placesResponse, countriesResponse, earthquakesResponse] = await Promise.all([
      fetch('/api/populated_places'),
      fetch('/api/countries'),
      fetch('/api/earthquakes')
    ]);
    if (!placesResponse.ok || !countriesResponse.ok || !earthquakesResponse.ok) {
      throw new Error('Map layers');
    }

    const [placesData, countriesData, earthquakesData] = await Promise.all([
      placesResponse.json(),
      countriesResponse.json(),
      earthquakesResponse.json()
    ]);
    groupedOverlays.Layers['Cities'].addData(placesData);
    groupedOverlays.Layers.Countries.addData(countriesData);
    earthquakes.addData(earthquakesData);
    if (earthquakesData.features.length) {
      map.fitBounds(earthquakes.getBounds(), { padding: [30, 30], maxZoom: 5 });
    }
    status.textContent = `${placesData.features.length} Orte, ${countriesData.features.length} Länder und ${earthquakesData.features.length} Erdbeben geladen`;
  } catch (error) {
    status.textContent = `Error while loading layers: ${error.message}`;
  }
}

loadOverlayData();

document.getElementById('form').addEventListener('submit', async event => {
  event.preventDefault();
  const query = document.getElementById('q').value.trim();
  if (!query) return;
  status.textContent = 'Suche …';
  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(query));
    if (!response.ok) throw new Error('HTTP ' + error.status);
    const data = await response.json();

    results.clearLayers();
    const layer = L.geoJSON(data, {
      onEachFeature: (feature, featureLayer) => featureLayer.bindPopup(
        `<b>${esc(feature.properties.name)}</b><br>${esc(feature.properties.ADM0NAME)}`)
    }).addTo(results);

    status.textContent = data.features.length + ' Treffer';
    if (data.features.length) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 12 });
  } catch (error) {
    status.textContent = 'Fehler: ' + error.message;
  }
});
