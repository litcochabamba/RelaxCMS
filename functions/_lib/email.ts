import type { Env } from './env';

/**
 * Envío de correos transaccionales con Resend.
 *
 * La API key vive solo en el servidor (`RESEND_API_KEY`). Nunca se devuelve al
 * navegador ni se registra en logs; el remitente se configura con `RESEND_FROM`.
 */

export interface CredentialsEmail {
  to: string;
  name: string;
  username: string;
  password: string;
  role: 'client' | 'admin' | 'moderator';
  loginUrl: string;
}

export interface EmailResult {
  to: string;
  sent: boolean;
  error?: string;
  /** Identificador del mensaje en Resend (para seguimiento de la entrega). */
  id?: string;
}

const DEFAULT_FROM = 'Relax Hotel <onboarding@resend.dev>';

const ROLE_LABEL: Record<CredentialsEmail['role'], string> = {
  client: 'cliente',
  admin: 'administrador',
  moderator: 'moderador',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml({ name, username, password, role, loginUrl }: CredentialsEmail): string {
  const safeName = escapeHtml(name);
  const safeUser = escapeHtml(username);
  const safePass = escapeHtml(password);
  const safeUrl = escapeHtml(loginUrl);

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:Georgia,'Times New Roman',serif;color:#1c1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a8a29e;">Relax Hotel</p>
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:normal;">Tu cuenta ya está lista</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#57534e;">
                  Hola ${safeName}, el hotel creó tu cuenta de ${ROLE_LABEL[role]}. Estos son tus datos de acceso:
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e4;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #f0efed;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a8a29e;">Usuario</td>
                    <td style="padding:14px 18px;border-bottom:1px solid #f0efed;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#1c1917;">${safeUser}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a8a29e;">Contraseña</td>
                    <td style="padding:14px 18px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#1c1917;">${safePass}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 32px;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;">Ingresar a mi cuenta</a>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">
                  Por seguridad, cambia esta contraseña después del primer ingreso y no compartas este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText({ name, username, password, loginUrl }: CredentialsEmail): string {
  return [
    `Hola ${name}, el hotel creó tu cuenta.`,
    '',
    `Usuario: ${username}`,
    `Contraseña: ${password}`,
    '',
    `Ingresa en: ${loginUrl}`,
    '',
    'Por seguridad, cambia esta contraseña después del primer ingreso.',
  ].join('\n');
}

/** Envía las credenciales por correo. Nunca lanza: informa el resultado. */
export async function sendCredentialsEmail(
  env: Env,
  payload: CredentialsEmail
): Promise<EmailResult> {
  const to = payload.to.trim();
  const apiKey = env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return { to, sent: false, error: 'El envío de correos no está configurado' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
    return { to, sent: false, error: 'El correo no es válido' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject: 'Tus datos de acceso · Relax Hotel',
        html: buildHtml(payload),
        text: buildText(payload),
      }),
    });

    if (response.ok) {
      const created = (await response.json().catch(() => null)) as { id?: string } | null;
      return { to, sent: true, id: created?.id };
    }

    // Motivo del proveedor ("validation_error", "restricted_api_key", etc.).
    // Solo llega al panel de administración, nunca a un visitante ni a un log.
    const detail = await response
      .json()
      .then((body) => (body as { message?: string })?.message || '')
      .catch(() => '');
    const clean = detail.replace(/\s+/g, ' ').trim();
    const hint = clean ? ` · ${clean.length > 160 ? `${clean.slice(0, 160)}…` : clean}` : '';

    if (response.status === 403) {
      return {
        to,
        sent: false,
        error: `el proveedor solo entrega al correo de la cuenta hasta que se verifique un dominio${hint}`,
      };
    }
    if (response.status === 422) {
      return { to, sent: false, error: `el proveedor rechazó el remitente o el destinatario${hint}` };
    }
    if (response.status === 401) {
      return { to, sent: false, error: 'La credencial del proveedor de correos no es válida' };
    }
    if (response.status === 429) {
      return { to, sent: false, error: 'se alcanzó el límite de envíos; reintenta más tarde' };
    }
    // El detalle crudo del proveedor no se propaga: solo el código de estado.
    return { to, sent: false, error: `el proveedor rechazó el envío (código ${response.status})${hint}` };
  } catch {
    return { to, sent: false, error: 'No se pudo conectar con el proveedor de correos' };
  }
}
