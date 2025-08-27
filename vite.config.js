// Vite config: allow a specific ngrok host for dev server
module.exports = {
  // Use a relative base so the app works when deployed to GitHub Pages
  // (project pages are served under /<repo>/ and absolute paths break).
  base: './',
  server: {
    // whitelist hosts allowed to access the Vite dev server
    allowedHosts: [
      'assuring-greatly-urchin.ngrok-free.app',
      'https://cdn6.parksmedia.wdprapps.disney.com'
    ]
  }
};
