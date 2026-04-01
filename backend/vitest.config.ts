import { defineConfig } from 'vitest/config';
import { join } from 'path';
import { tmpdir } from 'os';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      ARGUS_DB_PATH: join(tmpdir(), `argus-test-${Date.now()}.db`),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', 'src/**/*.d.ts'],
    },
  },
});
