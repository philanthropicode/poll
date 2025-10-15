import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',        // listen on all interfaces inside container
      port: 5173,
      strictPort: true,
      hmr: { clientPort: 5173 },
      watch: {
        usePolling: true,     // important on macOS volume mounts
        interval: 300
      },
      
    },
  };
})