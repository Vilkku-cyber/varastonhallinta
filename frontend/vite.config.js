import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env': process.env, // Tämä varmistaa, että ympäristömuuttujat toimivat Vite-sovelluksessa
  },
  build: {
    rollupOptions: {
      external: ['react-datepicker'],
    },
  },
});
