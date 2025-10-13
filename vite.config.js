import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',        // listen on all interfaces inside container
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 5173 },
    watch: {
      usePolling: true,     // important on macOS volume mounts
      interval: 300
    }
  },
})

