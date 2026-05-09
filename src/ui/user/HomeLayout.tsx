import type { ReactNode } from 'react';
import { useApp } from '../../state/AppContext.tsx';

function NavLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return <a href={`#${to}`} className={active ? 'active' : ''}>{children}</a>;
}

export default function HomeLayout({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useApp();
  return (
    <div className="home-layout">
      <header className="app-header">
        <span className="brand">LANTERN</span>
        <nav>
          <NavLink to="/" active={path === '/' || path === ''}>说话</NavLink>
          <NavLink to="/me/mood" active={path === '/me/mood'}>心情</NavLink>
          <NavLink to="/me/memory" active={path === '/me/memory'}>记忆</NavLink>
          <NavLink to="/me/tools" active={path.startsWith('/me/tools')}>工具</NavLink>
          <NavLink to="/me/settings" active={path === '/me/settings'}>设置</NavLink>
          {user?.role === 'admin' && <a href="#/admin">后台</a>}
        </nav>
      </header>
      <div className="page">{children}</div>
    </div>
  );
}
