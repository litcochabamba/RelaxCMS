import { json, serverConfigProblems, type Env } from '../_lib/env';
import { serviceRequest } from '../_lib/supabase';

type DatabaseState = 'ok' | 'unreachable' | 'rejected' | 'unconfigured';

async function probeDatabase(env: Env): Promise<DatabaseState> {
  if (!(env.SUPABASE_URL || '').trim() || !(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()) {
    return 'unconfigured';
  }
  const result = await serviceRequest<Array<{ id: string }>>(env, 'hoteles?select=id&limit=1');
  if (result.status === 503) return 'unreachable';
  if (result.error) return 'rejected';
  return 'ok';
}

/**
 * Diagnóstico del despliegue para las Pages Functions.
 *
 * Solo informa si cada variable está cargada (booleanos) y si Supabase
 * responde; nunca devuelve valores. Es la forma rápida de distinguir un login
 * roto por configuración de uno roto por credenciales.
 */
export async function handleHealth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const problems = serverConfigProblems(env);
  const database = await probeDatabase(env);
  const ok = problems.length === 0 && database === 'ok';

  return json(
    {
      ok,
      config: {
        supabaseUrl: Boolean((env.SUPABASE_URL || '').trim()),
        supabaseServiceRoleKey: Boolean((env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
        sessionSecret: Boolean((env.SESSION_SECRET || '').trim()),
        turnstile: Boolean((env.TURNSTILE_SECRET_KEY || '').trim()),
        resend: Boolean((env.RESEND_API_KEY || '').trim()),
      },
      database,
      problems,
    },
    ok ? 200 : 503
  );
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleHealth(request, env);
