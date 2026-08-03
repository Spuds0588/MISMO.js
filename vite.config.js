import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'MismoJS',
      fileName: 'mismo',
      // ES module (dist/mismo.js), UMD for Node/legacy (dist/mismo.umd.cjs),
      // and IIFE for plain <script> tags in the browser (dist/mismo.iife.js,
      // which exposes window.MismoJS with zero build step).
      formats: ['es', 'umd', 'iife']
    },
    // We are bundling fast-xml-parser into our dist to act as "zero-dependency" for the consumer
    rollupOptions: {
      external: [] 
    }
  }
});