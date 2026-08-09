import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        tecnico: 'manual_tecnico.html',
        usuario: 'manual_usuario.html',
        privacidad: 'declaracion_privacidad.html'
      }
    }
  }
});
