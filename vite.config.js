// Vite config: allow a specific ngrok host for dev server
module.exports = {
  server: {
    // whitelist hosts allowed to access the Vite dev server
    allowedHosts: [
      'assuring-greatly-urchin.ngrok-free.app'
    ]
  }
};
