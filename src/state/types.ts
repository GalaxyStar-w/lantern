import type { ThemeKey } from '../core/theme.ts';

export type Role = 'user' | 'admin';
export type CrisisLevel = 'none' | 'monitor' | 'medium' | 'high';
export type WeatherKey = 'sunny' | 'partlyCloudy' | 'cloudy' | 'rainy' | 'stormy';

export interface User {
  id: string;
  nickname: string;
  role: Role;
  theme?: ThemeKey;
  consent_at?: number | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
  crisis_level?: CrisisLevel;
}

export interface MoodDay {
  dayStart: number;
  weather: WeatherKey | null;
  wind?: number;
}

export interface MoodSnapshot {
  current: {
    weather: WeatherKey;
    label: string;
    emoji: string;
    phrase: string;
    wind: number;
  };
  band: MoodDay[];
  narrative: string;
}
