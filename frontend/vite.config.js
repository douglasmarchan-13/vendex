import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // Rutas reales (/login, /registro...): los recursos deben salir de la raíz, no relativos a la URL.
  // Al publicar, el hosting debe responder index.html en cualquier ruta (fallback SPA).
  base: '/',
  plugins: [react(), tailwindcss()],
  // En desarrollo, /api va al backend (backend/, puerto 4000)
  server: { proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:4000' } },
  // Pruebas unitarias (npm test)
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
