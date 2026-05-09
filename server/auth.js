// 邀请码登录 + session token
// 简化模型：邀请码 = 账号。首次登录创建 user，后续同邀请码复用同一 user。

import { db, now, randomId } from './d1.js';

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

export async function loginWithInvite(env, code, nickname) {
  if (!code || typeof code !== 'string') return { error: '请输入邀请码', status: 400 };
  const d = db(env);

  const invite = await d.first('SELECT code, role, used_by FROM invite_codes WHERE code = ?', code);
  if (!invite) return { error: '邀请码无效', status: 404 };

  let userId = invite.used_by;
  if (!userId) {
    userId = randomId();
    const nn = (nickname || '').trim() || '朋友';
    await d.run(
      'INSERT INTO users (id, nickname, role, created_at, invite_code, theme) VALUES (?, ?, ?, ?, ?, ?)',
      userId, nn, invite.role || 'user', now(), code, 'night-violet',
    );
    await d.run(
      'UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?',
      userId, now(), code,
    );
  }

  const token = randomId() + randomId();
  await d.run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token, userId, now(), now() + SESSION_TTL_MS,
  );

  const user = await d.first('SELECT id, nickname, role, theme, consent_at, address_as, tone_style, background FROM users WHERE id = ?', userId);
  return { token, user };
}

export async function verifyToken(env, token) {
  if (!token) return null;
  const d = db(env);
  const s = await d.first('SELECT user_id, expires_at FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (s.expires_at < now()) {
    await d.run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  const user = await d.first('SELECT id, nickname, role, theme, consent_at, address_as, tone_style, background FROM users WHERE id = ?', s.user_id);
  return user || null;
}

// 中间件：从 Authorization: Bearer <token> 解析 user；未认证返回 401
export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const user = await verifyToken(env, token);
  return user;
}

export function requireRole(user, role) {
  return user && (user.role === role || user.role === 'admin');
}
