// Vite config: allow a specific ngrok host for dev server and proxy Disney tiles to avoid CORS
module.exports = {
  server: {
    // whitelist hosts allowed to access the Vite dev server
    allowedHosts: [
      'assuring-greatly-urchin.ngrok-free.app'
    ],
    proxy: {
      // Proxy tiles so the browser sees them as same-origin and the offline plugin can cache via IndexedDB
      '/tiles': {
        target: 'https://cdn6.parksmedia.wdprapps.disney.com',
        changeOrigin: true,
        // Map: /tiles/{version}/{z}/{x}/{y}.jpg -> /media/maps/prod/disneyland/{version}/{z}/{x}/{y}.jpg
        rewrite: (path) => path.replace(/^\/tiles/, '/media/maps/prod/disneyland')
      }
    }
  }
};
