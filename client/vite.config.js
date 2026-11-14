import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento (npm run dev), o Vite repassa /api para a API em localhost:3000.
// No Docker, quem faz esse repasse é o nginx (client/nginx.conf). Assim o front sempre chama
// "/api/..." e não precisa saber em que porta a API está.
const API = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true, rewrite: (caminho) => caminho.replace(/^\/api/, '') },
    },
  },
});
