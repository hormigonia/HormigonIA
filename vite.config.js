import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tecnico: resolve(__dirname, 'manual_tecnico.html'),
        usuario: resolve(__dirname, 'manual_usuario.html'),
        principiante: resolve(__dirname, 'manual_principiante.html')
      }
    }
  }
});
