import { useCallback, useEffect, useState } from 'react';
import { api } from '../../core/api.ts';
import type { MoodSnapshot } from '../../state/types.ts';

export function useMoodWeather() {
  const [mood, setMood] = useState<MoodSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.mood();
      setMood(r as MoodSnapshot);
    } catch {
      // 静默失败：用户可能刚登录还没消息
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { mood, refresh };
}
