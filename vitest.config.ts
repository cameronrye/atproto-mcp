import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      // 'lcov' is required by the Codecov upload step in ci.yml (coverage/lcov.info).
      reporter: ['text', 'json', 'html', 'lcov'],
      // Vitest 4.0: Explicitly include source files for coverage
      include: ['src/**/*.{js,ts}'],
      exclude: [
        'node_modules/',
        'dist/',
        'docs/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      // Vitest 4.x: thresholds must be flat keys (or per-file globs). The old
      // `thresholds.global` wrapper is treated as a filename glob that matches
      // nothing, silently disabling enforcement — keep these flat so the gate
      // actually fails the run. Values are a no-regression ratchet pinned just
      // under current real coverage; raise them as coverage improves.
      thresholds: {
        branches: 30,
        functions: 50,
        lines: 42,
        statements: 42,
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/tools': resolve(__dirname, './src/tools'),
      '@/resources': resolve(__dirname, './src/resources'),
    },
  },
});
