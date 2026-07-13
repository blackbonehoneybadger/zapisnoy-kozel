import { motion } from 'framer-motion';
import { useRewardsStore, type RewardEntry } from '../store/rewardsStore';

interface Props {
  onBack: () => void;
}

const KIND_META: Record<RewardEntry['kind'], { label: string; badge: string; cls: string }> = {
  doffa: { label: 'DOFFA', badge: '+', cls: 'bg-gold-500/15 text-gold-300' },
  cups: { label: 'Cups', badge: '+', cls: 'bg-felt-600/25 text-emerald-300' },
  claim: { label: 'Вывод', badge: '→', cls: 'bg-white/[0.06] text-white/70' },
};

/** История наград: начисления Cups, DOFFA и заявки на вывод. */
export function RewardsScreen({ onBack }: Props) {
  const history = useRewardsStore((s) => s.history);
  const cups = useRewardsStore((s) => s.cups);
  const doffa = useRewardsStore((s) => s.doffa);
  const doffaClaimed = useRewardsStore((s) => s.doffaClaimed);

  return (
    <div className="min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
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
        <h1 className="font-display text-3xl gold-text">История наград</h1>
      </div>

      {/* сводка балансов */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cups', value: cups, cls: 'text-emerald-300' },
          { label: 'DOFFA', value: doffa, cls: 'text-gold-300' },
          { label: 'К выводу', value: doffaClaimed, cls: 'text-white/85' },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4 text-center">
            <div className={`font-display text-2xl ${c.cls}`}>{c.value}</div>
            <div className="mt-1 text-[11px] text-white/45">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 px-1 font-display text-xl gold-text">Операции</h2>
      {history.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-white/40">
          Пока нет наград. Сыграйте партию — Cups начисляются за каждую игру,
          DOFFA — за победы.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h, i) => {
            const meta = KIND_META[h.kind];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
                className="glass flex items-center justify-between rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-medium ${meta.cls}`}>
                    {meta.badge}
                  </span>
                  <div>
                    <div className="text-sm text-white/85">{h.note}</div>
                    <div className="text-[11px] text-white/40">
                      {new Date(h.date).toLocaleDateString('ru-RU')}{' '}
                      {new Date(h.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-lg ${h.kind === 'doffa' ? 'text-gold-300' : h.kind === 'cups' ? 'text-emerald-300' : 'text-white/70'}`}>
                    {h.kind === 'claim' ? '' : '+'}
                    {h.amount}
                  </div>
                  <div className="text-[11px] text-white/40">{meta.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
