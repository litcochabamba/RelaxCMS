/**
 * Validación de correo electrónico del registro público.
 *
 * El correo es opcional, pero cuando se carga tiene que existir de verdad:
 * se valida el formato, se rechazan dominios descartables y se consulta el
 * registro MX del dominio por DNS over HTTPS (Cloudflare). Así se aceptan
 * Gmail, Outlook, Yahoo o un dominio propio, y se rechazan dominios inventados.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'dispostable.com',
  'getnada.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

const DNS_TIMEOUT_MS = 4000;

export interface EmailCheck {
  ok: boolean;
  /** Correo normalizado (minúsculas, sin espacios) cuando es válido. */
  email?: string;
  error?: string;
}

async function dnsHasRecords(name: string, type: 'MX' | 'A'): Promise<boolean | null> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json().catch(() => null)) as
      | { Status?: number; Answer?: Array<{ type?: number }> }
      | null;
    if (!data) return null;
    // NXDOMAIN: el dominio no existe.
    if (data.Status === 3) return false;
    const expectedType = type === 'MX' ? 15 : 1;
    return Boolean(data.Answer?.some((answer) => answer.type === expectedType));
  } catch {
    // Sin respuesta del resolver: no se puede afirmar nada.
    return null;
  }
}

/**
 * `true` = el dominio recibe correo, `false` = no existe o no tiene registros,
 * `null` = no se pudo comprobar.
 */
async function domainAcceptsMail(domain: string): Promise<boolean | null> {
  if (domain === 'localhost' || /^\d+(\.\d+){3}$/.test(domain)) return false;

  const mx = await dnsHasRecords(domain, 'MX');
  if (mx) return true;
  // Sin MX explícito, el correo puede entregarse al registro A del dominio.
  const a = await dnsHasRecords(domain, 'A');
  if (mx === null && a === null) return null;
  return Boolean(a);
}

export async function validateEmail(raw: string): Promise<EmailCheck> {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Ingresá un correo o dejá el campo vacío' };
  if (email.length > 200) return { ok: false, error: 'El correo es demasiado largo' };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: 'Ingresá un correo válido' };

  const domain = email.split('@')[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, error: 'Usá un correo permanente, no uno temporal' };
  }

  const acceptsMail = await domainAcceptsMail(domain);
  if (acceptsMail === false) {
    return { ok: false, error: 'Ese correo no parece existir. Revisá el dominio.' };
  }
  // Si el DNS no respondió no se bloquea el registro: no hay evidencia de que
  // el correo sea falso.
  return { ok: true, email };
}
