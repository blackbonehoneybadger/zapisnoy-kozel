import { motion } from 'framer-motion';
import { useStatsStore } from '../store/statsStore';
import { PremiumButton } from '../components/PremiumButton';

interface Props {
  onBack: () => void;
}

export function StatsScreen({ onBack }: Props) {
  const stats = useStatsStore();
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  const cards = [
    { label: 'Победы', value: stats.wins, accent: 'text-emerald-300' },
    { label: 'Поражения', value: stats.losses, accent: 'text-rose-300' },
    { label: 'Сыграно партий', value: stats.gamesPlayed, accent: 'text-white/90' },
    { label: 'Процент побед', value: `${winRate}%`, accent: 'text-gold-300' },
    {
      label: 'Лучший результат',
      value: stats.bestScore === null ? '—' : stats.bestScore,
      accent: 'text-gold-300',
    },
    { label: 'Сколько раз «улетел»', value: stats.timesFlewAway, accent: 'text-rose-300' },
  ];

  return (
    <div className="min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 active:scale-95"
        >
          ←
        </button>
        <h1 className="font-display text-3xl gold-text">Статистика</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4"
          >
            <div className={`font-display text-3xl ${c.accent}`}>{c.value}</div>
            <div className="mt-1 text-xs text-white/50">{c.label}</div>
          </motion.div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 px-1 font-display text-xl gold-text">История последних партий</h2>
      {stats.history.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-white/40">
          Пока нет сыгранных партий. Сыграйте первую!
        </div>
      ) : (
        <div className="space-y-2">
          {stats.history.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass flex items-center justify-between rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold ${
                    h.won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {h.won ? 'W' : 'L'}
                </span>
                <div>
                  <div className="text-sm text-white/85">
                    {h.won ? 'Победа' : 'Поражение'}
                    {h.flewAway && <span className="ml-2 text-[11px] text-rose-400">улетел</span>}
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
            </motion.div>
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
