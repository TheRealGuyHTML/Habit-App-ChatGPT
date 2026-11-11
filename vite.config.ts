import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'bloom-offline-manifest',
    async closeBundle() {
      const assets = (await readdir(path.resolve('dist/assets'))).map(file => `/assets/${file}`);
      await writeFile(path.resolve('dist/precache-manifest.json'), JSON.stringify({ assets }));
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
      const workerPath = path.resolve('dist/sw.js');
      const worker = await readFile(workerPath, 'utf8');
      await writeFile(workerPath, worker.replace("const CACHE = 'bloom-shell-v1';", `const CACHE = 'bloom-shell-${version}';`));
    },
  }],
  build: { rollupOptions: { output: { manualChunks: { 'firebase-app': ['firebase/app'], 'firebase-auth': ['firebase/auth'], 'firebase-firestore': ['firebase/firestore'], vendor: ['react', 'react-dom', 'react-dom/client'] } } } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
