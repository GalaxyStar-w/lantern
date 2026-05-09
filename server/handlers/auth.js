import { loginWithInvite } from '../auth.js';
import { json } from '../utils.js';

export async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { code, nickname } = body;
  const r = await loginWithInvite(env, code, nickname);
  if (r.error) return json({ error: r.error }, r.status || 400);
  return json({ token: r.token, user: r.user });
}

export async function handleMe(_request, _env, user) {
  return json({ user });
}
