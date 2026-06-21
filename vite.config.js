import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端 5173，API 代理到后端 8787（保持 Key 在服务端）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
