import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'docs/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/test/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
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
