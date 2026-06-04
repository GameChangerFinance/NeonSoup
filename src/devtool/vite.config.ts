import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/devtool',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
  server: {
    port: 8081,
  },
});
