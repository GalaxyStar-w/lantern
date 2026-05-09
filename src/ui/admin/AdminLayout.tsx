import type { ReactNode } from 'react';

export default function AdminLayout({ path, children }: { path: string; children: ReactNode }) {
  const active = (p: string) => path === p || path.startsWith(p + '/');
  return (
    <div className="admin-layout">
      <div className="admin-header">
        <span className="brand">lantern · 后台</span>
        <nav>
          <a href="#/admin/users" className={active('/admin/users') || path === '/admin' ? 'active' : ''}>用户</a>
          <a href="#/admin/invites" className={active('/admin/invites') ? 'active' : ''}>邀请码</a>
          <a href="#/" style={{ marginLeft: 'auto' }}>回到前台</a>
        </nav>
      </div>
      <div className="admin-body">{children}</div>
    </div>
  );
}
