import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env': process.env,
  },
  optimizeDeps: {
    include: ['react-datepicker', 'react-modal'], // Lisätty react-modal tähän
  },
  server: {
    historyApiFallback: true, // Tämä varmistaa, että reititys toimii lokaalisti
  },
});
