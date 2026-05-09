import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.tsx';
import InviteCodeLogin from './auth/InviteCodeLogin.tsx';
import ConsentGate from '../modules/onboarding/ConsentGate.tsx';
import HomeLayout from './user/HomeLayout.tsx';
import ChatView from './chat/ChatView.tsx';
import MoodWeatherView from './user/MoodWeatherView.tsx';
import MemoryView from './user/MemoryView.tsx';
import ToolsHub from './user/ToolsHub.tsx';
import DecoupleView from './user/DecoupleView.tsx';
import BreathingView from './user/BreathingView.tsx';
import LettersView from './user/LettersView.tsx';
import SavedView from './user/SavedView.tsx';
import SettingsView from './user/SettingsView.tsx';
import AdminLayout from './admin/AdminLayout.tsx';
import UserListView from './admin/UserListView.tsx';
import UserDetailView from './admin/UserDetailView.tsx';
import InviteCodeView from './admin/InviteCodeView.tsx';
import './App.css';

// 极简 hash router
function useRoute(): { path: string; params: Record<string, string> } {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return { path: hash, params: {} };
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to.slice(1) : to;
}

export default function App() {
  const { user, loading } = useApp();
  const { path } = useRoute();

  if (loading) return <div className="splash">…</div>;
  if (!user) return <InviteCodeLogin />;
  // 管理员不走同意流程，普通用户首次登录必须过
  if (user.role === 'user' && !user.consent_at) return <ConsentGate />;

  // 管理员路由
  if (path.startsWith('/admin')) {
    if (user.role !== 'admin') return <div className="splash">没有权限</div>;
    return (
      <AdminLayout path={path}>
        {path === '/admin' || path === '/admin/users' ? <UserListView /> :
         path.startsWith('/admin/users/') ? <UserDetailView userId={path.replace('/admin/users/', '')} /> :
         path === '/admin/invites' ? <InviteCodeView /> :
         <UserListView />}
      </AdminLayout>
    );
  }

  // 用户路由
  return (
    <HomeLayout path={path}>
      {path === '/' || path === '' ? <ChatView /> :
       path === '/me/mood' ? <MoodWeatherView /> :
       path === '/me/memory' ? <MemoryView /> :
       path === '/me/tools' ? <ToolsHub /> :
       path === '/me/tools/decouple' ? <DecoupleView /> :
       path === '/me/tools/breathing' ? <BreathingView /> :
       path === '/me/letters' ? <LettersView /> :
       path === '/me/saved' ? <SavedView /> :
       path === '/me/settings' ? <SettingsView /> :
       <ChatView />}
    </HomeLayout>
  );
}
