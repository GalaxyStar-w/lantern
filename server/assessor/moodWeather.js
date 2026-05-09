// 分数 → 心情天气
// 用户端完全不出现 PHQ/GAD/抑郁/焦虑/分数，只有天气比喻。

export const WEATHERS = {
  sunny:       { key: 'sunny',    emoji: '☀️',   label: '晴',    phrase: '最近心里亮堂堂的' },
  partlyCloudy:{ key: 'partlyCloudy', emoji: '⛅', label: '多云',  phrase: '最近心里飘着一点云' },
  cloudy:      { key: 'cloudy',   emoji: '☁️',   label: '阴',    phrase: '最近天色有些灰' },
  rainy:       { key: 'rainy',    emoji: '🌧️',  label: '雨',    phrase: '最近下了一阵雨' },
  stormy:      { key: 'stormy',   emoji: '🌧️💨', label: '风雨', phrase: '这阵子风雨有点大，辛苦你撑着' },
};

export function phqToWeather(phq9_total) {
  const t = phq9_total ?? 0;
  if (t < 5) return WEATHERS.sunny;
  if (t < 10) return WEATHERS.partlyCloudy;
  if (t < 15) return WEATHERS.cloudy;
  if (t < 20) return WEATHERS.rainy;
  return WEATHERS.stormy;
}

// GAD-7 辅助：高焦虑加"风"效强度 0-1
export function gadWindIntensity(gad7_total) {
  const t = gad7_total ?? 0;
  return Math.max(0, Math.min(1, t / 21));
}

// 7 天趋势旁白（给心情地图下方用）
export function trendPhrase(recent) {
  // recent: [weather.key ...] 按时间升序，最后一个是今天
  if (!recent || recent.length === 0) return '今天先陪着你';
  const today = recent[recent.length - 1];
  const order = ['sunny', 'partlyCloudy', 'cloudy', 'rainy', 'stormy'];
  const rank = (k) => order.indexOf(k);

  const rankedToday = rank(today);
  let trend = 'flat';
  if (recent.length >= 3) {
    const earlier = recent.slice(0, Math.max(1, recent.length - 2));
    const avgEarlier = earlier.reduce((a, k) => a + rank(k), 0) / earlier.length;
    if (rankedToday < avgEarlier - 0.5) trend = 'clearing';
    else if (rankedToday > avgEarlier + 0.5) trend = 'worsening';
  }

  if (today === 'sunny') return trend === 'clearing' ? '云在慢慢散开，好好收住这份光' : '好好把这份阳光收进口袋';
  if (today === 'partlyCloudy') return trend === 'clearing' ? '云在变薄，再等等' : '多云也没关系，光还在';
  if (today === 'cloudy') return '天色灰灰的，先好好陪自己';
  if (today === 'rainy') return trend === 'worsening' ? '雨下久了会累，慢慢来，不用一口气想清楚' : '下雨的日子愿意说话，已经很好了';
  if (today === 'stormy') return '风雨的日子里你还愿意开口，已经很勇敢了';
  return '今天先陪着你';
}
