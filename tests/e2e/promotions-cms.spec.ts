import { test, expect } from '@playwright/test';
import {
  createTestAdmin,
  deletePromotionsByTitle,
  deleteTestUserByUsername,
  integrationCredentials,
} from './cleanup';

const STAMP = Date.now().toString(36);
const ADMIN_USERNAME = `e2e.promos.${STAMP}`.slice(0, 32);
const ADMIN_EMAIL = `${ADMIN_USERNAME}@example.com`;
const ADMIN_PASSWORD = 'E2ePromo12345';
const PROMOTION_TITLE = `Promo E2E ${STAMP}`;
const PROMOTION_CODE = `E2E${STAMP.slice(-6).toUpperCase()}`;

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

test.afterAll(async () => {
  // Se borra por título/usuario para limpiar también cuando la prueba falla
  // antes de conocer el id de la promoción o del admin.
  await deletePromotionsByTitle(PROMOTION_TITLE);
  await deleteTestUserByUsername(ADMIN_USERNAME);
});

test('publica una promoción desde el CMS y la deja lista para las notificaciones de RelaxPMS', async ({
  page,
}) => {
  await createTestAdmin({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  // Ingreso real al CMS con el usuario temporal.
  await page.goto('/auth/login');
  await page.locator('#login-username').fill(ADMIN_USERNAME);
  await page.locator('#login-password').fill(ADMIN_PASSWORD);
  await page.waitForFunction(
    () => {
      const token = document.querySelector<HTMLInputElement>(
        'input[name="cf-turnstile-response"]'
      );
      return Boolean(token?.value);
    },
    undefined,
    { timeout: 30_000 }
  );
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Publicación desde el panel: es el mismo formulario que usa el hotel.
  await page.getByRole('button', { name: 'Promociones' }).click();
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByPlaceholder('Escapada de fin de semana').fill(PROMOTION_TITLE);
  await page.getByPlaceholder('RELAX10').fill(PROMOTION_CODE);
  await page
    .getByPlaceholder('Qué incluye la promoción')
    .fill('Promoción creada por la prueba E2E para validar su publicación.');
  await page.locator('input[type="number"]').nth(0).fill('15');
  await page.locator('input[type="date"]').nth(0).fill(isoDaysFromNow(-1));
  await page.locator('input[type="date"]').nth(1).fill(isoDaysFromNow(10));
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText(PROMOTION_TITLE, { exact: true })).toBeVisible();

  // La vista pública muestra solamente promociones vigentes y publicadas.
  await page.goto('/promociones');
  await expect(page.getByRole('heading', { name: PROMOTION_TITLE })).toBeVisible();
  await expect(page.getByText(PROMOTION_CODE, { exact: true })).toBeVisible();
  await expect(page.getByText('15% OFF', { exact: true })).toBeVisible();

  // La consulta se deriva a WhatsApp con el contexto de la promoción. Se busca
  // dentro de su tarjeta: puede haber otras promociones publicadas.
  const card = page.getByRole('article').filter({ hasText: PROMOTION_TITLE });
  const whatsapp = card.getByRole('link', { name: /Consultar por WhatsApp/i });
  await expect(whatsapp).toBeVisible();
  const href = await whatsapp.getAttribute('href');
  expect(href).toContain('https://wa.me/');
  expect(href).toContain(encodeURIComponent(PROMOTION_TITLE));
  expect(href).toContain(encodeURIComponent(PROMOTION_CODE));

  // El feed de integración es la fuente que usa RelaxPMS para crear la
  // notificación de recepción. Se consulta con reintentos: la promoción se
  // acaba de guardar desde el navegador.
  const credentials = integrationCredentials();
  const feedPath = '/api/integrations/v1/promotions?limit=100';
  await expect
    .poll(
      async () => {
        const response = await page.request.get(feedPath, {
          headers: { Authorization: `Bearer ${credentials.key}` },
        });
        if (!response.ok()) return null;
        const body = (await response.json()) as {
          data?: Array<{
            title: string;
            code: string | null;
            discount_percent: number | null;
            url: string | null;
          }>;
          error?: string | null;
        };
        if (body.error) return null;
        return (
          body.data?.find(
            (item) => item.title === PROMOTION_TITLE && item.code === PROMOTION_CODE
          ) ?? null
        );
      },
      { timeout: 15_000 }
    )
    .not.toBeNull();

  const feedResponse = await page.request.get(feedPath, {
    headers: { Authorization: `Bearer ${credentials.key}` },
  });
  expect(feedResponse.ok()).toBeTruthy();
  const feed = (await feedResponse.json()) as {
    data: Array<{
      title: string;
      code: string | null;
      discount_percent: number | null;
      url: string | null;
    }>;
  };
  const entry = feed.data.find(
    (item) => item.title === PROMOTION_TITLE && item.code === PROMOTION_CODE
  );
  expect(entry?.discount_percent).toBe(15);
  expect(entry?.url).toMatch(/\/promociones$/);

  // `updated_since` es lo que usa RelaxPMS para no volver a avisar lo mismo:
  // una fecha futura no devuelve la promoción recién publicada.
  const future = new Date(Date.now() + 60_000).toISOString();
  const filteredResponse = await page.request.get(
    `${feedPath}&updated_since=${encodeURIComponent(future)}`,
    { headers: { Authorization: `Bearer ${credentials.key}` } }
  );
  expect(filteredResponse.ok()).toBeTruthy();
  const filtered = (await filteredResponse.json()) as { data?: unknown[] };
  expect(filtered.data).toHaveLength(0);

  // El feed no se puede leer sin la clave de integración.
  const unauthorized = await page.request.get(feedPath);
  expect(unauthorized.status()).toBe(401);
});
