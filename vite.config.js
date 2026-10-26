import { defineConfig } from 'vite';
import { resolve } from 'path';

// Relative base so the build works on GitHub Pages under /zday/.
// es2019 target keeps older iPhone Safari able to run the bundle.
export default defineConfig({
  base: './',
  server: { host: true, port: 5191 },
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), showcase: resolve(__dirname, 'showcase.html') } },
  },
});
