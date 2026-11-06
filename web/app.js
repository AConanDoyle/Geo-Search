import { GroupedLayers } from './src/leaflet.groupedlayercontrol.js';

const map = L.map('map').setView([51.1, 10.4], 6);
const baselayers = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'png'
}).addTo(map);

const results = L.layerGroup().addTo(map);
const status = document.getElementById('status');
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const groupedOverlays = {
  'Layers': {
    'Cities': L.geoJSON(null, {
      onEachFeature: (feature, layer) => layer.bindPopup(
        `<b>${esc(feature.properties.name)}</b><br>${esc(feature.properties.adm0name)}`
      )
    }),
    'Countries': L.geoJSON(null, {
      style: { color: '#b7c8ce', weight: 1, fillOpacity: 0.12 },
      onEachFeature: (feature, layer) => layer.bindPopup(
        `<b>${esc(feature.properties.name)}</b><br>${esc(feature.properties.continent)}`
      )
    })
  }
};

const layerControl = new GroupedLayers(
  { 'Statia Basemap': baselayers },
  groupedOverlays
).addTo(map);

async function loadOverlayData() {
  try {
    const [placesResponse, countriesResponse] = await Promise.all([
      fetch('/api/populated_places'),
      fetch('/api/countries')
    ]);
    if (!placesResponse.ok || !countriesResponse.ok) {
      throw new Error('Map layers');
    }

    const [placesData, countriesData] = await Promise.all([
      placesResponse.json(),
      countriesResponse.json()
    ]);
    groupedOverlays.Layers['Cities'].addData(placesData);
    groupedOverlays.Layers.Countries.addData(countriesData);
    status.textContent = `${placesData.features.length} Orte und ${countriesData.features.length} Länder geladen`;
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
    if (!response.ok) throw new Error('HTTP ' + response.status);
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