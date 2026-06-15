import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  badge?: string;
  accent?: 'gold' | 'red' | 'emerald';
  children: ReactNode;
  index?: number;
}

const accents = {
  gold: 'text-gold-300 border-gold-500/30',
  red: 'text-rose-300 border-rose-500/30',
  emerald: 'text-emerald-300 border-emerald-500/30',
};

/** Стеклянная карточка с правилом. */
export function RuleCard({ title, badge, accent = 'gold', children, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl p-4"
    >
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
    </motion.div>
  );
}
