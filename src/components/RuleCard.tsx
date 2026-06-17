import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  badge?: string;
  accent?: 'gold' | 'red' | 'emerald';
  children: ReactNode;
  index?: number;
  /** Иллюстрация-карта справа от текста правила. */
  art?: ReactNode;
}

const accents = {
  gold: 'text-gold-300 border-gold-500/30',
  red: 'text-wine-400 border-wine-500/30',
  emerald: 'text-emerald-300 border-emerald-500/30',
};

/** Стеклянная карточка с правилом. */
export function RuleCard({ title, badge, accent = 'gold', children, index = 0, art }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-3">
            {badge && (
              <span
                className={`grid h-9 min-w-9 place-items-center rounded-xl border bg-white/[0.04] px-2 font-display text-lg ${accents[accent]}`}
              >
                {badge}
              </span>
            )}
            <h3 className="font-display text-lg text-white/90">{title}</h3>
          </div>
          <div className="text-sm leading-relaxed text-white/65">{children}</div>
        </div>
        {art && <div className="shrink-0 self-center">{art}</div>}
      </div>
    </motion.div>
  );
}
