// lantern-server Worker 入口
// 路由 /api/* 所有请求，业务分发到 handlers/

import { requireAuth, requireRole } from './auth.js';
import { json, CORS_HEADERS } from './utils.js';

import { handleLogin, handleMe } from './handlers/auth.js';
import { handleChat, handleChatStream, handleListMessages, handleOpener, handleDeleteMessage } from './handlers/chat.js';
import { handleMyMemory, handleDeleteMoment, handleForgetProfile } from './handlers/memory.js';
import { handleSaveMoment, handleListSaved, handleDeleteSaved } from './handlers/saved.js';
import { handleExport } from './handlers/exportData.js';
import {
  handleDecouple, handleListLetters, handleCreateLetter,
  handleReadLetter, handlePendingLetter, handleDeleteLetter,
} from './handlers/tools.js';
import { handleUserMood, handleAdminAssessment } from './handlers/assessments.js';
import { handleGetSettings, handleUpdateSettings, handleTestLLM } from './handlers/settings.js';
import {
  handleAdminUsers, handleAdminUserDetail, handleAdminInviteList,
  handleAdminInviteCreate, handleAdminRunAssessment,
} from './handlers/admin.js';

function matchPath(pattern, pathname) {
  // 简单参数解析：/api/admin/users/:userId
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (p !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    try {
      // --- 公开路由 ---
      if (pathname === '/api/auth/login' && method === 'POST') return await handleLogin(request, env);
      if (pathname === '/api/health' && method === 'GET') return json({ ok: true });

      // --- 需登录 ---
      const user = await requireAuth(request, env);
      if (!user) return json({ error: '未登录' }, 401);

      if (pathname === '/api/me' && method === 'GET') return await handleMe(request, env, user);
      if (pathname === '/api/chat' && method === 'POST') return await handleChat(request, env, user);
      if (pathname === '/api/chat/stream' && method === 'POST') return await handleChatStream(request, env, user);
      if (pathname === '/api/chat/opener' && method === 'GET') return await handleOpener(request, env, user);
      if (pathname === '/api/messages' && method === 'GET') return await handleListMessages(request, env, user);
      {
        const m = matchPath('/api/messages/:messageId', pathname);
        if (m && method === 'DELETE') return await handleDeleteMessage(request, env, user, m);
      }
      if (pathname === '/api/me/mood' && method === 'GET') return await handleUserMood(request, env, user);
      if (pathname === '/api/user/settings' && method === 'GET') return await handleGetSettings(request, env, user);
      if (pathname === '/api/user/settings' && method === 'PATCH') return await handleUpdateSettings(request, env, user);
      if (pathname === '/api/user/settings/test' && method === 'POST') return await handleTestLLM(request, env, user);
      if (pathname === '/api/tools/decouple' && method === 'POST') return await handleDecouple(request, env, user);
      if (pathname === '/api/tools/letters' && method === 'GET') return await handleListLetters(request, env, user);
      if (pathname === '/api/tools/letters' && method === 'POST') return await handleCreateLetter(request, env, user);
      if (pathname === '/api/tools/letters/pending' && method === 'GET') return await handlePendingLetter(request, env, user);
      {
        const m = matchPath('/api/tools/letters/:id', pathname);
        if (m && method === 'GET') return await handleReadLetter(request, env, user, m);
        if (m && method === 'DELETE') return await handleDeleteLetter(request, env, user, m);
      }
      if (pathname === '/api/me/saved' && method === 'GET') return await handleListSaved(request, env, user);
      if (pathname === '/api/me/saved' && method === 'POST') return await handleSaveMoment(request, env, user);
      {
        const m = matchPath('/api/me/saved/:id', pathname);
        if (m && method === 'DELETE') return await handleDeleteSaved(request, env, user, m);
      }
      if (pathname === '/api/me/export' && method === 'GET') return await handleExport(request, env, user);
      if (pathname === '/api/me/memory' && method === 'GET') return await handleMyMemory(request, env, user);
      if (pathname === '/api/me/memory/forget' && method === 'POST') return await handleForgetProfile(request, env, user);
      {
        const m = matchPath('/api/me/memory/moments/:id', pathname);
        if (m && method === 'DELETE') return await handleDeleteMoment(request, env, user, m);
      }

      // --- 需管理员 ---
      if (pathname.startsWith('/api/admin/')) {
        if (!requireRole(user, 'admin')) return json({ error: '需要管理员权限' }, 403);

        if (pathname === '/api/admin/users' && method === 'GET') return await handleAdminUsers(request, env, user);
        let m;
        if ((m = matchPath('/api/admin/users/:userId', pathname)) && method === 'GET') {
          return await handleAdminUserDetail(request, env, user, m);
        }
        if ((m = matchPath('/api/admin/users/:userId/assessment', pathname)) && method === 'GET') {
          return await handleAdminAssessment(request, env, user, m);
        }
        if ((m = matchPath('/api/admin/users/:userId/assessment', pathname)) && method === 'POST') {
          return await handleAdminRunAssessment(request, env, user, m);
        }
        if (pathname === '/api/admin/invites' && method === 'GET') return await handleAdminInviteList(request, env, user);
        if (pathname === '/api/admin/invites' && method === 'POST') return await handleAdminInviteCreate(request, env, user);
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'server error', message: e?.message }, 500);
    }
  },
};
