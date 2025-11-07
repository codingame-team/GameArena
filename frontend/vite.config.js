import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Accepter connexions depuis n'importe quelle interface
    port: 5173,
    proxy: {
      // Proxy /api requests to the Flask backend during development
      // Plus de CORS: le navigateur voit tout comme même origine
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
