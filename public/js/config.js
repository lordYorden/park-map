// Disney parks tile template you provided. Keep the {version} token  app will substitute it.
window.MAP_TILE_URL = window.MAP_TILE_URL || 'https://cdn6.parksmedia.wdprapps.disney.com/media/maps/prod/disneyland/{version}/{z}/{x}/{y}.jpg';
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
