import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.url, '');
  return {
    plugins: [react()],
    // 'base: "./"' ensures assets are loaded relatively, preventing black pages on sub-path deployments
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    }
  };
});