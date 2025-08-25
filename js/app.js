// Dynamically load Leaflet CSS/JS provided in js/config.js
(function () {
  const showMessage = (msg, timeout = 3500) => {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.classList.remove('hidden');
    if (timeout) setTimeout(() => el.classList.add('hidden'), timeout);
  };

  function loadCSS(url) {
    return new Promise((res, rej) => {
      if (!url) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = url;
      l.onload = () => res();
      l.onerror = () => rej(new Error('Failed to load CSS ' + url));
      document.head.appendChild(l);
    });
  }

  function loadScript(url) {
    return new Promise((res, rej) => {
      if (!url) return res();
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error('Failed to load script ' + url));
      document.head.appendChild(s);
    });
  }

  async function main() {
    try {
      await loadCSS(window.LEAFLET_CSS);
      await loadScript(window.LEAFLET_JS);
    } catch (err) {
      showMessage('Leaflet assets not loaded. Paste CDN URLs into js/config.js');
      console.error(err);
      return;
    }

    if (!window.L) {
      showMessage('Leaflet not available after loading. Check CDN URL.');
      return;
    }

    // Set up map with initial view
    const map = L.map('map', {
      minZoom: (window.TILE_LAYER_OPTIONS && window.TILE_LAYER_OPTIONS.minZoom) || 0,
      maxZoom: (window.TILE_LAYER_OPTIONS && window.TILE_LAYER_OPTIONS.maxZoom) || 18,
    }).setView(window.INITIAL_VIEW.center, window.INITIAL_VIEW.zoom);

    // Substitute {version} token in the tile URL if present
    let tileUrl = window.MAP_TILE_URL || '';
    const version = (window.TILE_LAYER_OPTIONS && window.TILE_LAYER_OPTIONS.version) || '';
    if (version) tileUrl = tileUrl.replace('{version}', version);

    // Apply maxBounds if provided
    if (window.MAP_MAX_BOUNDS) {
      const sw = window.MAP_MAX_BOUNDS.southWest;
      const ne = window.MAP_MAX_BOUNDS.northEast;
      try {
        map.setMaxBounds([[sw.lat, sw.lng], [ne.lat, ne.lng]]);
      } catch (e) {
        console.warn('Invalid max bounds', e);
      }
    }

    L.tileLayer(tileUrl, { attribution: window.MAP_TILE_ATTR, minZoom: window.TILE_LAYER_OPTIONS.minZoom, maxZoom: window.TILE_LAYER_OPTIONS.maxZoom }).addTo(map);

    // Example markers (Disney coordinates close to Magic Kingdom)
    const points = [
      { id: 'magic-kingdom', name: 'Magic Kingdom', latlng: [28.417663, -81.581212], desc: 'Main park' },
      { id: 'epcot', name: 'EPCOT', latlng: [28.374694, -81.549404], desc: 'Future World / World Showcase' },
      { id: 'hollywood', name: 'Hollywood Studios', latlng: [28.357019, -81.558988], desc: 'Shows & rides' },
      { id: 'animal-kingdom', name: "Animal Kingdom", latlng: [28.355467, -81.590788], desc: 'Animals & attractions' },
    ];

    const markers = L.layerGroup().addTo(map);

    points.forEach(p => {
      const m = L.marker(p.latlng).addTo(markers);
      m.bindPopup(`<strong>${p.name}</strong><br/>${p.desc}`);
      m.on('click', () => showMessage(`${p.name} selected`));
    });

    // Controls
    document.getElementById('locateBtn').addEventListener('click', () => {
      map.locate({ setView: true, maxZoom: 16 });
    });

    map.on('locationfound', e => {
      const radius = e.accuracy || 50;
      L.circle(e.latlng, { radius }).addTo(map);
      showMessage('Location found (accuracy ' + Math.round(radius) + 'm)');
    });

    map.on('locationerror', () => showMessage('Could not get location'));

    document.getElementById('resetBtn').addEventListener('click', () => {
      map.setView(window.INITIAL_VIEW.center, window.INITIAL_VIEW.zoom);
    });

    showMessage('Map ready — add your Leaflet CDN URLs to js/config.js if blank', 2500);
  }

  // wait for DOM
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();

})();
