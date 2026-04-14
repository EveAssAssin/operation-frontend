import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],

    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        process.env.VITE_API_URL || env.VITE_API_URL || ''
      ),
      'import.meta.env.VITE_LINE_LIFF_ID': JSON.stringify(
        process.env.VITE_LINE_LIFF_ID || env.VITE_LINE_LIFF_ID || ''
      ),
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
