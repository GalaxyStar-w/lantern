import { useEffect, useRef } from 'react';
import type { WeatherKey } from '../../state/types.ts';
import './weather.css';

interface Props {
  weather: WeatherKey | null;
  wind: number; // 0-1
}

// 阶段 1：静态渐变叠加层 + CSS 动效。阶段 2 加雨粒子 Canvas。
export default function WeatherBackground({ weather, wind }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.setProperty('--wind-intensity', String(0.6 + wind * 0.8));
  }, [wind]);

  const key = weather || 'partlyCloudy';
  return <div ref={ref} className={`weather-bg weather-${key}`} aria-hidden="true" />;
}
