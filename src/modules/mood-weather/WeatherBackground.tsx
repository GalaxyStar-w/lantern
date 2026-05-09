import { useEffect, useRef } from 'react';
import type { BackgroundKey, WeatherKey } from '../../state/types.ts';
import './weather.css';
import './backgrounds.css';

interface Props {
  weather: WeatherKey | null;
  wind: number;
  background?: BackgroundKey; // 'weather' = 跟心情；其他 = 固定背景
}

export default function WeatherBackground({ weather, wind, background = 'weather' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.setProperty('--wind-intensity', String(0.6 + wind * 0.8));
  }, [wind]);

  if (background && background !== 'weather') {
    return <div ref={ref} className={`weather-bg bg-${background}`} aria-hidden="true" />;
  }

  const key = weather || 'partlyCloudy';
  return <div ref={ref} className={`weather-bg weather-${key}`} aria-hidden="true" />;
}
