import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api, /auth and /uploads to the Express backend so
// the SPA and API stay on the same origin (no CORS friction, cookies work).
// The backend port comes from your server/.env PORT via API_PORT (default 3001).
const apiPort = process.env.API_PORT || 3002;
const target = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': target,
      '/auth': target,
      '/uploads': target,
      // websocket upgrade for live collaboration (shares the API origin)
      '/ws': { target, ws: true },
    },
  },
});