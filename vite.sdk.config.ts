import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/sdk',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: 'src/sdk/index.ts',
      formats: ['es'],
      fileName: () =>
        'video-core.esm.js',
    },
    rollupOptions: {
      output: {
        entryFileNames:
          'video-core.esm.js',
        chunkFileNames:
          'assets/[name]-[hash].js',
        assetFileNames:
          'assets/[name]-[hash][extname]',
      },
    },
  },
});
