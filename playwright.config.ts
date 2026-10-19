import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas end-to-end contra un servidor de desarrollo aislado.
 *
 * El servidor se levanta en otro puerto (no toca el del día a día) y con las
 * claves de prueba de Turnstile, así el registro real funciona sin captcha
 * manual. `RELAX_E2E=1` le indica a Vite que esas variables pisan a las de
 * `.dev.vars` solo para este proceso.
 */
const PORT = 5180;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'es-BO',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      RELAX_E2E: '1',
      // Claves "always pass" documentadas por Cloudflare para pruebas.
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
});
