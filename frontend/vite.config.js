import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env': process.env,
  },
  optimizeDeps: {
    include: ['react-datepicker'],
  },
});
