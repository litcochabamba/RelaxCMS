import { test, expect, type Page } from '@playwright/test';
import { deleteTestClientByUsername } from './cleanup';

const ALIAS = `qa.${Date.now().toString(36)}`;
const PASSWORD = 'Prueba12345';
const GUEST_PHONE = '70011122';

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function freeUnitValues(page: Page): Promise<string[]> {
  return page.locator('#reservar').getByRole('combobox', { name: 'Habitación', exact: true }).evaluate((element) =>
    [...(element as HTMLSelectElement).options]
      .filter((option) => option.value && !option.disabled)
      .map((option) => option.value)
  );
}

test.afterAll(async () => {
  // Borra la reserva y la cuenta creadas por esta corrida.
  await deleteTestClientByUsername(ALIAS);
});

test('la reserva rápida precarga los datos, bloquea la unidad y la libera al cancelar', async ({
  page,
  browser,
}) => {
  await page.goto('/auth/login');
  await page.getByRole('tab', { name: 'Registro' }).click();

  await page.locator('#register-alias').fill(ALIAS);
  await page.locator('#register-name').fill('Cliente E2E');
  await page.locator('#register-password').fill(PASSWORD);
  await page.getByPlaceholder('Número de celular').fill(GUEST_PHONE);

  // Turnstile agrega un input oculto con el token cuando resuelve el desafío.
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

  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByText('Mi cuenta', { exact: true })).toBeVisible();

  // Reserva rápida: el formulario de la web llega con nombre, celular y país.
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Reservar ahora' })
    .click();
  await expect(page).toHaveURL(/#reservar$/);

  const booking = page.locator('#reservar');
  await expect(booking.getByPlaceholder('Tu nombre')).toHaveValue('Cliente E2E');
  await expect(booking.getByPlaceholder('Número de celular')).toHaveValue(GUEST_PHONE);
  await expect(booking.getByText('País: Bolivia')).toBeVisible();
  await expect(
    booking.getByText(/Cargamos tu nombre, tu celular y tu país desde tu cuenta/)
  ).toBeVisible();

  const checkIn = isoDaysFromNow(40);
  const checkOut = isoDaysFromNow(42);

  await booking.getByLabel('Fecha de ingreso').fill(checkIn);
  const availability = page.waitForResponse(
    (response) =>
      response.url().includes('/api/public/availability') && response.status() === 200
  );
  await booking.getByLabel('Fecha de salida').fill(checkOut);
  const availabilityResponse = await availability;
  const hotelId = new URL(availabilityResponse.url()).searchParams.get('hotel_id') || '';
  expect(hotelId).not.toBe('');

  // Se elige un tipo con al menos dos unidades libres para que, después de
  // reservar una, otra persona siga viendo el tipo disponible pero la unidad
  // ocupada.
  const typeSelect = booking.getByRole('combobox', { name: 'Tipo de habitación' });
  const typeValues: string[] = await typeSelect.evaluate((element) =>
    [...(element as HTMLSelectElement).options]
      .filter((option) => option.value && !option.disabled)
      .map((option) => option.value)
  );
  expect(typeValues.length).toBeGreaterThan(0);

  let chosenType = '';
  let chosenUnit = '';
  let unitsInType = 0;

  for (const typeValue of typeValues) {
    await typeSelect.selectOption(typeValue);
    await expect.poll(async () => (await freeUnitValues(page)).length).toBeGreaterThan(0);
    const units = await freeUnitValues(page);
    if (units.length >= 2) {
      chosenType = typeValue;
      chosenUnit = units[0];
      unitsInType = units.length;
      break;
    }
  }

  expect(chosenType, 'Se esperaba un tipo con dos o más unidades libres').not.toBe('');
  await booking.getByRole('combobox', { name: 'Habitación', exact: true }).selectOption(chosenUnit);

  await booking.getByRole('button', { name: 'Consultar Disponibilidad' }).click();
  await expect(page.getByText('Solicitud recibida')).toBeVisible();
  await expect(page.getByText(/Quedó asociada a tu cuenta/)).toBeVisible();

  // El servidor también rechaza una segunda solicitud para la misma unidad y
  // fechas, aunque alguien la envíe sin pasar por el formulario.
  const duplicate = await page.request.post('/api/public/reservation', {
    data: {
      hotel_id: hotelId,
      guest_name: 'Otro Huésped',
      guest_phone: '+591 70099999',
      check_in: checkIn,
      check_out: checkOut,
      adults: 2,
      children_count: 0,
      room_type: chosenType,
      room_unit: chosenUnit,
    },
  });
  expect(duplicate.status()).toBe(409);

  // La reserva aparece en el panel del cliente.
  await page.goto('/cuenta');
  await page.getByRole('complementary').getByRole('button', { name: /^Reservaciones/ }).click();
  await expect(page.getByText(`${chosenType} · ${chosenUnit}`)).toBeVisible();

  // Otro visitante, con las mismas fechas, ya no puede elegir esa unidad.
  const origin = new URL(page.url()).origin;
  const guestContext = await browser.newContext({ baseURL: origin });
  const guestPage = await guestContext.newPage();
  await guestPage.goto('/#reservar');
  const guestBooking = guestPage.locator('#reservar');
  await guestBooking.getByLabel('Fecha de ingreso').fill(checkIn);
  const guestAvailability = guestPage.waitForResponse(
    (response) =>
      response.url().includes('/api/public/availability') && response.status() === 200
  );
  await guestBooking.getByLabel('Fecha de salida').fill(checkOut);
  await guestAvailability;

  await guestBooking.getByRole('combobox', { name: 'Tipo de habitación' }).selectOption(chosenType);
  const guestUnits = guestBooking.getByRole('combobox', { name: 'Habitación', exact: true });
  const unitOption = guestUnits.locator(`option[value="${chosenUnit}"]`);

  await expect(unitOption).toContainText('ocupada');
  expect(
    await unitOption.evaluate((element) => (element as HTMLOptionElement).disabled)
  ).toBe(true);

  // Si el tipo tenía una sola unidad, la opción de tipo completa queda bloqueada.
  if (unitsInType === 1) {
    const typeOption = guestPage.locator(`select option[value="${chosenType}"]`);
    expect(await typeOption.evaluate((element) => (element as HTMLOptionElement).disabled)).toBe(
      true
    );
  }

  // El cliente cancela desde su panel; la unidad se libera al instante.
  await page.getByRole('button', { name: 'Cancelar reserva' }).click();
  await page.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();

  // Recarga real (no un cambio de hash) para descartar la disponibilidad cacheada.
  await guestPage.reload();
  await guestBooking.getByLabel('Fecha de ingreso').fill(checkIn);
  const freedAvailability = guestPage.waitForResponse(
    (response) =>
      response.url().includes('/api/public/availability') && response.status() === 200
  );
  await guestBooking.getByLabel('Fecha de salida').fill(checkOut);
  await freedAvailability;

  await guestBooking.getByRole('combobox', { name: 'Tipo de habitación' }).selectOption(chosenType);
  const freedUnitOption = guestBooking
    .getByRole('combobox', { name: 'Habitación', exact: true })
    .locator(`option[value="${chosenUnit}"]`);
  await expect(freedUnitOption).not.toContainText('ocupada');
  expect(
    await freedUnitOption.evaluate((element) => (element as HTMLOptionElement).disabled)
  ).toBe(false);

  await guestContext.close();
});
