import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    open: '/hub.html',
    proxy: {
      '/plants': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        hub: 'hub.html',
        aportes: 'aportes.html',
        admin: 'admin.html',
        form: 'form.html',
        // mapa: 'mapa.html', // removed
        info: 'info_general.html',
        index: 'index.html'
      }
    }
  }
});
