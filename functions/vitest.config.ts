import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['src/**/*.test.ts'], environment: 'node', testTimeout: 15000, hookTimeout: 30000,
  // These integration files share one emulator process. Keep destructive test
  // cleanup separate from the other suite's live transactions.
  fileParallelism: false,
} });
