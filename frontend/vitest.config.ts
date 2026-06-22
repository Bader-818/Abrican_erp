import { defineConfig } from 'vitest/config'
import path from 'path'

// Standalone Vitest config (does not load the Vite app plugins) so unit tests
// for pure helpers run fast in a node environment with the `@/` alias resolved.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
