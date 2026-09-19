import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 43124,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
