module.exports = {
  base: './',
  server: {
    host: true,
    allowedHosts: [
      'assuring-greatly-urchin.ngrok-free.app',
      'cdn6.parksmedia.wdprapps.disney.com'
    ],
    proxy: {
      '/tiles': {
        target: 'https://cdn6.parksmedia.wdprapps.disney.com',
        changeOrigin: true,
        // Map: /tiles/{version}/{z}/{x}/{y}.jpg -> /media/maps/prod/disneyland/{version}/{z}/{x}/{y}.jpg
        rewrite: (path) => path.replace(/^\/tiles/, '/media/maps/prod/disneyland')
      }
    }
  }
};
