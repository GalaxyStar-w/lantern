import { useApp } from '../../state/AppContext.tsx';
import { useMoodWeather } from '../../modules/mood-weather/useMoodWeather.ts';
import WeatherBackground from '../../modules/mood-weather/WeatherBackground.tsx';

export default function MoodWeatherView() {
  const { user } = useApp();
  const { mood } = useMoodWeather();

  return (
    <>
      <WeatherBackground
        weather={mood?.current?.weather ?? null}
        wind={mood?.current?.wind ?? 0}
        background={user?.background || 'weather'}
      />
      <div className="mood-view">
        <h2>你最近的心情地图</h2>

        {!mood ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 0' }}>
            慢慢攒着说过的话，心情地图才会慢慢亮起来。
          </div>
        ) : (
          <>
            <div className="mood-current">
              <div className="emoji">{mood.current.emoji}</div>
              <div className="phrase">{mood.current.phrase}</div>
            </div>

            <div className="mood-band" aria-label="最近 30 天心情">
              {mood.band.map((b, i) => (
                <div
                  key={b.dayStart + '-' + i}
                  className={`cell ${b.weather || 'empty'}`}
                  title={new Date(b.dayStart).toLocaleDateString('zh-CN')}
                />
              ))}
            </div>

            <div className="mood-narrative">{mood.narrative}</div>
          </>
        )}

        <div className="mood-footer">
          想和真实的人聊聊吗？<br />
          全国心理援助热线 <a href="tel:400-161-9995">400-161-9995</a>，24 小时都在。
        </div>
      </div>
    </>
  );
}
