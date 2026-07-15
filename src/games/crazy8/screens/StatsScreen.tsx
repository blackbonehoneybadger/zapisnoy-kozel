import { useRef } from 'react';
import { useStatsStore } from '../store/statsStore';
import { useScrollReveal } from '../fx/useScrollReveal';
import { CountUpOnView } from '../components/CountUpOnView';
import { PremiumButton } from '../components/PremiumButton';

interface Props {
  onBack: () => void;
}

interface StatCard {
  label: string;
  accent: string;
  num?: number;
  suffix?: string;
  text?: string;
}

export function StatsScreen({ onBack }: Props) {
  const stats = useStatsStore();
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  const cards: StatCard[] = [
    { label: 'Победы', num: stats.wins, accent: 'text-emerald-300' },
    { label: 'Поражения', num: stats.losses, accent: 'text-wine-400' },
    { label: 'Сыграно партий', num: stats.gamesPlayed, accent: 'text-white/90' },
    { label: 'Процент побед', num: winRate, suffix: '%', accent: 'text-gold-300' },
    stats.bestScore === null
      ? { label: 'Лучший результат', text: '—', accent: 'text-gold-300' }
      : { label: 'Лучший результат', num: stats.bestScore, accent: 'text-gold-300' },
    { label: 'Сколько раз «улетел»', num: stats.timesFlewAway, accent: 'text-wine-400' },
  ];

  return (
    <div ref={rootRef} className="min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 active:scale-95"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-display text-3xl gold-text">Статистика</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} data-reveal className="glass rounded-2xl p-4">
            <div className={`font-display text-3xl ${c.accent}`}>
              {c.num !== undefined ? <CountUpOnView value={c.num} suffix={c.suffix} /> : c.text}
            </div>
            <div className="mt-1 text-xs text-white/50">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 px-1 font-display text-xl gold-text">История последних партий</h2>
      {stats.history.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-white/40">
          Пока нет сыгранных партий. Сыграйте первую!
        </div>
      ) : (
        <div className="space-y-2">
          {stats.history.map((h) => (
            <div
              key={h.id}
              data-reveal
              className="glass flex items-center justify-between rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-medium ${
                    h.won ? 'bg-emerald-500/15 text-emerald-300' : 'bg-wine-700/20 text-wine-400'
                  }`}
                >
                  {h.won ? 'W' : 'L'}
                </span>
                <div>
                  <div className="text-sm text-white/85">
                    {h.won ? 'Победа' : 'Поражение'}
                    {h.flewAway && <span className="ml-2 text-[11px] text-wine-400">улетел</span>}
                  </div>
                  <div className="text-[11px] text-white/40">
                    {new Date(h.date).toLocaleDateString('ru-RU')} · {h.players} игрока · {h.rounds}{' '}
                    раундов
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg text-gold-300">{h.finalScore}</div>
                <div className="text-[11px] text-white/40">очков</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.gamesPlayed > 0 && (
        <div className="mt-6">
          <PremiumButton full variant="danger" onClick={() => stats.reset()}>
            Сбросить статистику
          </PremiumButton>
        </div>
      )}
    </div>
  );
}
