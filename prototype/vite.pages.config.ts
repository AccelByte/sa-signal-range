import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

const appRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./static-demo', import.meta.url)),
  // The Pages build has no AGS environment or server routes.
  envDir: fileURLToPath(new URL('./static-demo', import.meta.url)),
  base: '/sa-signal-range/',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: { alias: { '@': appRoot } },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist-pages', import.meta.url)),
    emptyOutDir: true,
  },
});
