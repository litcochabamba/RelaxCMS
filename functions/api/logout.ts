import { clearedSessionCookie, isSecureRequest, json, type Env } from '../_lib/env';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  return json(
    { ok: true },
    200,
    { 'Set-Cookie': clearedSessionCookie(isSecureRequest(request)) }
  );
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleLogout(request, env);
