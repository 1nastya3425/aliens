import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // важно для Docker
    port: 5173,
    proxy: {
      '/history': {
        target: 'http://backend:3000', // имя сервиса из docker-compose
        changeOrigin: true
      }
    }
  }
})
