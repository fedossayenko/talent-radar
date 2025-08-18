/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.ts',
        'dist/',
        'playwright-report/',
        'test-results/',
        'coverage/',
      ],
    },
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests', // E2E tests directory
    ],
  },
})