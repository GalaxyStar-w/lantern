// 前端 API 客户端：统一加 Authorization、处理错误

export interface LLMSlot {
  endpoint: string;
  model: string;
  hasKey: boolean;
  keyMask: string;
}

export interface LLMInline {
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface SettingsResponse {
  theme: string;
  consent_at: number | null;
  llm: { chat: LLMSlot; assess: LLMSlot; updated_at: number } | null;
  defaults: {
    chat: { endpoint: string; model: string; hasKey: boolean };
    assess: { endpoint: string; model: string; hasKey: boolean };
  };
}

export interface SettingsPatch {
  theme?: string;
  consent?: boolean;
  llm?: {
    chat?: { endpoint?: string; model?: string; apiKey?: string };
    assess?: { endpoint?: string; model?: string; apiKey?: string };
  };
}

const TOKEN_KEY = 'lantern.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = (data as { error?: string })?.error || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

export const api = {
  login: (code: string, nickname?: string) =>
    apiFetch<{ token: string; user: unknown }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code, nickname }),
    }),
  me: () => apiFetch<{ user: unknown }>('/api/me'),
  listMessages: () => apiFetch<{ conversationId: string | null; messages: unknown[] }>('/api/messages'),
  chat: (text: string) => apiFetch<{ userMessage: unknown; reply: unknown }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  mood: () => apiFetch<unknown>('/api/me/mood'),
  getSettings: () => apiFetch<SettingsResponse>('/api/user/settings'),
  updateSettings: (patch: SettingsPatch) => apiFetch<SettingsResponse>('/api/user/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }),
  testLLM: (kind: 'chat' | 'assess', inline?: LLMInline) =>
    apiFetch<{ ok: boolean; error?: string; model?: string }>('/api/user/settings/test', {
      method: 'POST',
      body: JSON.stringify({ kind, inline }),
    }),
  adminUsers: () => apiFetch<unknown>('/api/admin/users'),
  adminUserDetail: (userId: string) => apiFetch<unknown>(`/api/admin/users/${userId}`),
  adminRunAssessment: (userId: string) => apiFetch<unknown>(`/api/admin/users/${userId}/assessment`, {
    method: 'POST',
  }),
  adminInvites: () => apiFetch<unknown>('/api/admin/invites'),
  adminCreateInvite: (role: 'user' | 'admin' = 'user') => apiFetch<unknown>('/api/admin/invites', {
    method: 'POST',
    body: JSON.stringify({ role }),
  }),
};
