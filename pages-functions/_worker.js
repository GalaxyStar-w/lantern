/**
 * Cloudflare Pages Advanced mode 入口
 *   /api/*  -> env.SERVER.fetch(request)  （Service Binding 到 lantern-server Worker）
 *   其他    -> env.ASSETS.fetch(request)
 *
 * lantern 使用两层架构：Pages 只做静态资源 + 路由转发，业务逻辑 + D1 都在独立 Worker。
 * 理由：Pages 的 wrangler.toml 不支持 D1 bindings 的完整流程，单独 Worker 也更便于迭代。
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (!env.SERVER) {
        return new Response(JSON.stringify({ error: 'SERVER binding missing' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return env.SERVER.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
