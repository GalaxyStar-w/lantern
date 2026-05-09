import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext.tsx';
import type { ThemeKey } from '../../core/theme.ts';
import type { BackgroundKey, ToneStyle } from '../../state/types.ts';
import { api, type SettingsResponse } from '../../core/api.ts';

interface SlotForm {
  endpoint: string;
  model: string;
  apiKey: string;      // 空字符串 = 用户没在此次编辑中输入；提交时转 undefined 保持不变
  clearKey: boolean;   // 显式勾选清除已存 key
}

const emptySlot = (): SlotForm => ({ endpoint: '', model: '', apiKey: '', clearKey: false });

const TONE_LABELS: Record<ToneStyle, { label: string; desc: string }> = {
  warm: { label: '温暖朋友', desc: '主动回应，多共情，像坐在你身边' },
  calm: { label: '冷静朋友', desc: '安静倾听，只在关键处说话' },
  quiet: { label: '少说话多陪着', desc: '主要是"嗯"、"我在"、偶尔一句话' },
};

const BG_LABELS: Record<BackgroundKey, string> = {
  weather: '跟着心情变（推荐）',
  starry: '星夜',
  seaside: '海边',
  dawn: '晨光',
};

export default function SettingsView() {
  const { user, theme, setTheme, patchUser, logout } = useApp();
  const [addressInput, setAddressInput] = useState(user?.address_as || '');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [chatForm, setChatForm] = useState<SlotForm>(emptySlot());
  const [assessForm, setAssessForm] = useState<SlotForm>(emptySlot());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<null | 'chat' | 'assess'>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      setChatForm({
        endpoint: s.llm?.chat.endpoint || '',
        model: s.llm?.chat.model || '',
        apiKey: '',
        clearKey: false,
      });
      setAssessForm({
        endpoint: s.llm?.assess.endpoint || '',
        model: s.llm?.assess.model || '',
        apiKey: '',
        clearKey: false,
      });
    } catch (e) {
      setMsg('读取设置失败：' + (e as Error).message);
    }
  };

  useEffect(() => { load(); }, []);

  const buildSlotPatch = (form: SlotForm, orig: SlotForm) => {
    const patch: { endpoint?: string; model?: string; apiKey?: string } = {};
    if (form.endpoint !== orig.endpoint) patch.endpoint = form.endpoint;
    if (form.model !== orig.model) patch.model = form.model;
    if (form.clearKey) patch.apiKey = '';
    else if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim();
    return patch;
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const orig = {
        chat: { endpoint: settings?.llm?.chat.endpoint || '', model: settings?.llm?.chat.model || '', apiKey: '', clearKey: false },
        assess: { endpoint: settings?.llm?.assess.endpoint || '', model: settings?.llm?.assess.model || '', apiKey: '', clearKey: false },
      };
      const chatPatch = buildSlotPatch(chatForm, orig.chat);
      const assessPatch = buildSlotPatch(assessForm, orig.assess);
      const hasChange = Object.keys(chatPatch).length + Object.keys(assessPatch).length > 0;
      if (!hasChange) { setMsg('没有修改'); setSaving(false); return; }
      await api.updateSettings({
        llm: {
          ...(Object.keys(chatPatch).length ? { chat: chatPatch } : {}),
          ...(Object.keys(assessPatch).length ? { assess: assessPatch } : {}),
        },
      });
      setMsg('保存成功');
      await load();
    } catch (e) {
      setMsg('保存失败：' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async (kind: 'chat' | 'assess', form: SlotForm) => {
    setTesting(kind);
    setTestResult((p) => ({ ...p, [kind]: '' }));
    try {
      const inline = form.apiKey.trim()
        ? { endpoint: form.endpoint.trim(), model: form.model.trim(), apiKey: form.apiKey.trim() }
        : undefined;
      const r = await api.testLLM(kind, inline);
      setTestResult((p) => ({ ...p, [kind]: r.ok ? `✓ 通了（${r.model || ''}）` : `✗ ${r.error}` }));
    } catch (e) {
      setTestResult((p) => ({ ...p, [kind]: '✗ ' + (e as Error).message }));
    } finally {
      setTesting(null);
    }
  };

  const themeBtn = (key: ThemeKey, label: string) => (
    <button key={key} className={theme === key ? 'active' : ''} onClick={() => setTheme(key)}>
      {label}
    </button>
  );

  const slotRow = (
    label: string,
    kind: 'chat' | 'assess',
    form: SlotForm,
    setForm: (f: SlotForm) => void,
    llmSlot: SettingsResponse['llm'] extends null ? null : SettingsResponse['llm'],
    defaults: { endpoint: string; model: string; hasKey: boolean },
  ) => {
    const hasStoredKey = !!llmSlot && (kind === 'chat' ? llmSlot.chat.hasKey : llmSlot.assess.hasKey);
    const keyMask = llmSlot ? (kind === 'chat' ? llmSlot.chat.keyMask : llmSlot.assess.keyMask) : '';
    return (
      <div className="llm-slot">
        <h4>{label}</h4>
        <label className="field">
          <span>Base URL</span>
          <input
            placeholder={defaults.endpoint || 'https://api.openai.com/v1'}
            value={form.endpoint}
            onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input
            placeholder={defaults.model || 'gpt-4o-mini / deepseek-chat / ...'}
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            placeholder={hasStoredKey ? `已保存 ${keyMask}` : (defaults.hasKey ? '不填则用后端默认 key' : '必须填')}
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value, clearKey: false })}
            autoComplete="new-password"
            spellCheck={false}
          />
        </label>
        {hasStoredKey && (
          <label style={{ display: 'flex', gap: 6, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            <input
              type="checkbox"
              checked={form.clearKey}
              onChange={(e) => setForm({ ...form, clearKey: e.target.checked, apiKey: '' })}
            />
            清除已保存的 key（改回后端默认）
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => test(kind, form)} disabled={testing !== null}>
            {testing === kind ? '测试中…' : '测试连通性'}
          </button>
          {testResult[kind] && (
            <span style={{ fontSize: '0.85rem', color: testResult[kind].startsWith('✓') ? 'var(--accent)' : 'var(--danger)' }}>
              {testResult[kind]}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="settings">
      <section>
        <h3>你好，{user?.nickname}</h3>
      </section>

      <section>
        <h3>主题</h3>
        <div className="theme-picker">
          {themeBtn('night-violet', '夜色')}
          {themeBtn('cream-warm', '暖阳')}
        </div>
      </section>

      <section>
        <h3>AI 怎么叫你</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder={user?.nickname ? `（留空会叫你 ${user.nickname}）` : '怎么叫都行，留空也可以'}
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            maxLength={20}
          />
          <button
            disabled={savingPrefs || addressInput === (user?.address_as || '')}
            onClick={async () => {
              setSavingPrefs(true);
              try { await patchUser({ address_as: addressInput.trim() }); }
              finally { setSavingPrefs(false); }
            }}
          >保存</button>
        </div>
      </section>

      <section>
        <h3>AI 的语气</h3>
        <div className="theme-picker" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {(Object.keys(TONE_LABELS) as ToneStyle[]).map((k) => (
            <button
              key={k}
              className={(user?.tone_style || 'warm') === k ? 'active' : ''}
              onClick={() => patchUser({ tone_style: k })}
              style={{ textAlign: 'left', padding: '0.7rem 1rem' }}
            >
              <div>{TONE_LABELS[k].label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>
                {TONE_LABELS[k].desc}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>背景</h3>
        <div className="theme-picker" style={{ flexWrap: 'wrap' }}>
          {(Object.keys(BG_LABELS) as BackgroundKey[]).map((k) => (
            <button
              key={k}
              className={(user?.background || 'weather') === k ? 'active' : ''}
              onClick={() => patchUser({ background: k })}
            >
              {BG_LABELS[k]}
            </button>
          ))}
        </div>
      </section>

      {settings && (
        <section>
          <h3>AI 配置（OpenAI 兼容）</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: 1.7 }}>
            如果留空，会用管理员在后端配置的默认值。<br />
            API Key 会用 AES-GCM 加密后存储，前端只看得到末 4 位。
          </p>
          {slotRow('聊天 AI', 'chat', chatForm, setChatForm, settings.llm, settings.defaults.chat)}
          <div style={{ height: '1rem' }} />
          {slotRow('评估 AI（静默运行）', 'assess', assessForm, setAssessForm, settings.llm, settings.defaults.assess)}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
            {msg && <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{msg}</span>}
          </div>
        </section>
      )}

      <section>
        <h3>你的数据</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href="/api/me/export"
            download
            onClick={(e) => {
              const token = localStorage.getItem('lantern.token');
              if (!token) return;
              e.preventDefault();
              fetch('/api/me/export', { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.blob())
                .then((b) => {
                  const url = URL.createObjectURL(b);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `lantern-${user?.nickname || 'data'}-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            style={{
              padding: '0.5rem 1.1rem',
              border: '1px solid var(--border)',
              borderRadius: 999,
              display: 'inline-block',
              color: 'var(--text)',
            }}
          >导出我的数据</a>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 8 }}>
          包含全部聊天、评估、收藏、信件，一个 JSON 文件，下载到本地。
        </p>
      </section>

      <section>
        <h3>账号</h3>
        <button onClick={() => { if (confirm('确定退出吗？下次用同一个邀请码就能回来。')) logout(); }}>
          退出
        </button>
      </section>

      <section>
        <h3>关于</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', lineHeight: 1.8 }}>
          lantern 只是一个听你说话的地方。<br />
          它不是医生，也不能代替医生。<br />
          如果你正在很难熬的时期，请去找真实的专业人士。
        </p>
      </section>
    </div>
  );
}
