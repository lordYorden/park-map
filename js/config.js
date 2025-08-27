// Paste your Leaflet CDN URLs here. Example:
// window.LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
// window.LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

window.LEAFLET_CSS = window.LEAFLET_CSS || '';
window.LEAFLET_JS = window.LEAFLET_JS || '';

// Disney parks tile template you provided. Keep the {version} token — app will substitute it.
// During dev/ngrok, route tiles through /tiles proxy (see vite.config.js) to avoid CORS and enable offline caching.
// In production (no Vite proxy), fall back to the CDN URL.
if (!window.MAP_TILE_URL) {
	const host = (typeof location !== 'undefined' && location.hostname) || '';
	const isDev = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.ngrok-free.app');
	window.MAP_TILE_URL = isDev
		? '/tiles/{version}/{z}/{x}/{y}.jpg'
		: 'https://cdn6.parksmedia.wdprapps.disney.com/media/maps/prod/disneyland/{version}/{z}/{x}/{y}.jpg';
}
window.MAP_TILE_ATTR = window.MAP_TILE_ATTR || '&copy; Disney';

// Tile layer options provided by you
window.TILE_LAYER_OPTIONS = window.TILE_LAYER_OPTIONS || {
	maxZoom: 20,
	minZoom: 14,
	version: '662638499'
};

// Initial view (center + zoom)
window.INITIAL_VIEW = window.INITIAL_VIEW || { center: [33.809092, -117.918958], zoom: 16 };

// Map max bounds
window.MAP_MAX_BOUNDS = window.MAP_MAX_BOUNDS || {
	southWest: { lat: 33.75, lng: -118.5 },
	northEast: { lat: 33.95, lng: -117 }
};
