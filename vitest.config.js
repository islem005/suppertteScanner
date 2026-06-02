import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// TEST: Vitest configuration — run with `npx vitest` or `npm run test`
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    // Scanner frontend tests need jsdom — they use // @vitest-environment jsdom
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
})
