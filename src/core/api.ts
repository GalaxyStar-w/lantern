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
  address_as?: string;
  tone_style?: 'warm' | 'professional' | 'gentle';
  background?: 'weather' | 'starry' | 'seaside' | 'dawn';
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
  chat: (text: string, opts: { silent?: boolean; ephemeral?: boolean } = {}) =>
    apiFetch<{ userMessage: unknown; reply: unknown | null; silent?: boolean }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text, ...opts }),
    }),
  chatStream: async function* (text: string, opts: { silent?: boolean; ephemeral?: boolean } = {}) {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, ...opts }),
    });
    if (!res.ok || !res.body) {
      let err = `HTTP ${res.status}`;
      try { const j = await res.json(); if ((j as { error?: string }).error) err = (j as { error: string }).error; } catch { /* ignore */ }
      throw new Error(err);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = 'message';
        let data = '';
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          yield { event: ev, data: JSON.parse(data) };
        } catch {
          // ignore
        }
      }
    }
  },
  opener: () => apiFetch<{ opener: string | null; daysAway: number | null; milestone: { id: string; phrase: string; created_at: number } | null }>('/api/chat/opener'),
  deleteMessage: (id: string) => apiFetch<{ ok: boolean }>(`/api/messages/${id}`, { method: 'DELETE' }),
  myMemory: () => apiFetch<{ profile: unknown; moments: Array<{ id: string; tag: string; summary: string; created_at: number }> }>('/api/me/memory'),
  deleteMoment: (id: string) => apiFetch<{ ok: boolean }>(`/api/me/memory/moments/${id}`, { method: 'DELETE' }),
  forgetProfile: () => apiFetch<{ ok: boolean }>('/api/me/memory/forget', { method: 'POST' }),
  saveMessage: (messageId: string) => apiFetch<{ id: string; duplicate?: boolean }>('/api/me/saved', {
    method: 'POST', body: JSON.stringify({ messageId }),
  }),
  listSaved: () => apiFetch<{ saved: Array<{ id: string; message_id: string; content: string; created_at: number }> }>('/api/me/saved'),
  deleteSaved: (id: string) => apiFetch<{ ok: boolean }>(`/api/me/saved/${id}`, { method: 'DELETE' }),
  decouple: (step: number, messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    apiFetch<{ reply: string | null; step: number; finished: boolean; error?: string }>('/api/tools/decouple', {
      method: 'POST', body: JSON.stringify({ step, messages }),
    }),
  listLetters: () => apiFetch<{ letters: Array<{ id: string; content: string; created_at: number; deliver_at: number; delivered: number; read_at: number | null }> }>('/api/tools/letters'),
  createLetter: (content: string, deliverAt: number) =>
    apiFetch<{ id: string }>('/api/tools/letters', { method: 'POST', body: JSON.stringify({ content, deliverAt }) }),
  readLetter: (id: string) => apiFetch<{ letter: { id: string; content: string; created_at: number; deliver_at: number; read_at: number | null } }>(`/api/tools/letters/${id}`),
  pendingLetter: () => apiFetch<{ pendingLetterId: string | null }>('/api/tools/letters/pending'),
  deleteLetter: (id: string) => apiFetch<{ ok: boolean }>(`/api/tools/letters/${id}`, { method: 'DELETE' }),
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
