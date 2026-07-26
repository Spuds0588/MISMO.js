import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'MismoJS',
      fileName: 'mismo'
    },
    // We are bundling fast-xml-parser into our dist to act as "zero-dependency" for the consumer
    rollupOptions: {
      external: [] 
    }
  }
});