export const TILE_URL_TEMPLATE = 'https://cdn6.parksmedia.wdprapps.disney.com/media/maps/prod/disneyland/{version}/{z}/{x}/{y}.jpg';

export const ATTR = '&copy; Disney';

export const TILE_OPTS = {
	maxZoom: 20,
	minZoom: 14,
	version: '662638499'
};

export const INITIAL_VIEW = { center: [33.809092, -117.918958], zoom: 16 };

export const MAX_BOUNDS = {
	southWest: { lat: 33.75, lng: -118.5 },
	northEast: { lat: 33.95, lng: -117 }
};
