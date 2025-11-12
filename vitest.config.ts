import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',             // padrão; pode trocar por 'node' por arquivo
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx,js,jsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
  resolve: { conditions: ['browser', 'module', 'default'] },
});
