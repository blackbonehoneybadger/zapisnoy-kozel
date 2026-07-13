import { motion } from 'framer-motion';
import { useSettingsStore } from '../store/settingsStore';
import { useStatsStore } from '../store/statsStore';
import type { Difficulty } from '../game/types';

interface Props {
  onBack: () => void;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  normal: 'Средний',
  hard: 'Сложный',
};

export function SettingsScreen({ onBack }: Props) {
  const s = useSettingsStore();
  const resetStats = useStatsStore((st) => st.reset);

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
        <h1 className="font-display text-3xl gold-text">Настройки</h1>
      </div>

      <div className="space-y-3 pb-8">
        <Section title="Лимит очков" hint="Перебор — «вылет», ровно лимит — обнуление">
          <Segmented
            options={[101, 125, 151, 201].map((v) => ({ label: String(v), value: v }))}
            value={s.scoreLimit}
            onChange={(v) => s.update({ scoreLimit: v })}
          />
        </Section>

        <Section title="Количество игроков" hint="Вы и боты">
          <Segmented
            options={[
              { label: '2 игрока', value: 2 },
              { label: '3 игрока', value: 3 },
              { label: '4 игрока', value: 4 },
            ]}
            value={s.playerCount}
            onChange={(v) => s.update({ playerCount: v as 2 | 3 | 4 })}
          />
        </Section>

        <Section title="Карт на старте">
          <Segmented
            options={[5, 6, 7, 8].map((v) => ({ label: String(v), value: v }))}
            value={s.startingCards}
            onChange={(v) => s.update({ startingCards: v })}
          />
        </Section>

        <Section title="Сложность ботов">
          <Segmented
            options={(['easy', 'normal', 'hard'] as Difficulty[]).map((v) => ({
              label: DIFFICULTY_LABEL[v],
              value: v,
            }))}
            value={s.difficulty}
            onChange={(v) => s.update({ difficulty: v })}
          />
        </Section>

        <Section title="Звук">
          <Toggle value={s.soundEnabled} onChange={(v) => s.update({ soundEnabled: v })} />
        </Section>

        <div className="pt-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={resetStats}
            className="w-full rounded-2xl border border-wine-500/30 bg-wine-700/25 px-6 py-4 font-medium text-wine-400 hover:bg-wine-700/40"
          >
            Сбросить статистику
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white/85">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={String(o.value)}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 min-w-[4rem] rounded-xl px-3 py-2.5 text-sm font-medium ${
              active ? 'text-ink-900' : 'text-white/70 bg-white/[0.04]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join('-')}`}
                className="absolute inset-0 rounded-xl bg-gold-sheen shadow-gold"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative min-h-11 min-w-[3.5rem] rounded-full ${
        value ? 'bg-gold-sheen' : 'bg-white/[0.06]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-1.5 h-6 w-6 rounded-full bg-white shadow ${
          value ? 'left-7' : 'left-1.5'
        }`}
      />
    </button>
  );
}
