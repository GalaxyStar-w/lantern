// D1 薄封装：绑定 env.DB，提供 first/all/run 快捷方法

export function db(env) {
  return {
    async first(sql, ...params) {
      return await env.DB.prepare(sql).bind(...params).first();
    },
    async all(sql, ...params) {
      const r = await env.DB.prepare(sql).bind(...params).all();
      return r.results || [];
    },
    async run(sql, ...params) {
      return await env.DB.prepare(sql).bind(...params).run();
    },
    batch(stmts) {
      return env.DB.batch(stmts);
    },
    prepare(sql) {
      return env.DB.prepare(sql);
    },
  };
}

export function now() {
  return Date.now();
}

export function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
