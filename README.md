Interactive Leaflet map scaffold

What I created

- index.html — entry page. Loads `js/config.js` then `js/app.js`.
- css/styles.css — basic styling and layout.
- js/config.js — placeholder file where you should paste your Leaflet CSS/JS CDN URLs and optionally change tile provider and initial view.
- js/app.js — application logic. Dynamically loads Leaflet, initializes the map, adds example markers, and provides locate/reset controls.

How to use

1. Open `js/config.js` and set the `window.LEAFLET_CSS` and `window.LEAFLET_JS` values to your CDN links. Example:

   // window.LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
   // window.LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

   Replace the empty strings with the URLs (remove the leading // to uncomment is fine too).

2. (Optional) modify `window.MAP_TILE_URL` and `window.MAP_TILE_ATTR` in `js/config.js` to use a different tile provider.

3. Open `index.html` in a browser (double-click or serve via a static server). On some browsers local file restrictions may block loading the CDN; if so, run a quick static server:

   python -m http.server 8000

   Then open http://localhost:8000 in your browser.

Next steps you might want

- Add clustering for many markers using Leaflet.markercluster.
- Add a sidebar list to toggle points on/off.
- Hook markers to a backend or GeoJSON file for dynamic data.


