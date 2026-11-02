const map = L.map('map').setView([51.1, 10.4], 6);
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'png'
}).addTo(map);

const results = L.layerGroup().addTo(map);
const status = document.getElementById('status');
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

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