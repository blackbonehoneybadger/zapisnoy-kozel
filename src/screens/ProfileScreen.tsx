import { motion } from 'framer-motion';
import { PremiumButton } from '../components/PremiumButton';
import { WalletButton } from '../components/WalletButton';
import { DoffaEmblem } from '../components/DoffaEmblem';
import { useStatsStore } from '../store/statsStore';
import { useBeansStore } from '../store/beansStore';
import { useRewardsStore } from '../store/rewardsStore';
import { useWalletStore } from '../solana/walletStore';
import { ENABLE_CRAZY8_CLASSIC } from '../config/features';
import type { Screen } from '../App';

interface Props {
  onBack: () => void;
  navigate: (s: Screen) => void;
}

/** Профиль игрока: кошелёк, балансы Зёрна/DOFFA, сводка статистики. */
export function ProfileScreen({ onBack, navigate }: Props) {
  const stats = useStatsStore();
  const beans = useBeansStore((s) => s.beans);
  const doffa = useRewardsStore((s) => s.doffa);
  const doffaClaimed = useRewardsStore((s) => s.doffaClaimed);
  const address = useWalletStore((s) => s.address);

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

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
        <h1 className="font-display text-3xl gold-text">Профиль</h1>
      </div>

      {/* шапка профиля */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative overflow-hidden rounded-3xl p-6 text-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-[70px]"
          style={{ background: 'radial-gradient(circle, rgba(224,164,59,0.3), transparent 70%)' }}
        />
        <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center overflow-hidden rounded-full glass">
          <img src="/art/doffa-logo.webp" alt="" className="h-[112%] w-[112%] object-cover" />
        </div>
        <p className="font-display text-2xl text-white/90">Игрок DOFFA</p>
        <p className="mt-1 text-[11px] uppercase tracking-luxe text-gold-500/60">
          {address ? 'Кошелёк подключён' : 'Гость'}
        </p>
        <div className="mt-4 flex justify-center">
          <WalletButton />
        </div>
      </motion.div>

      {/* балансы */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Зёрна', value: beans, cls: 'text-emerald-300', hint: 'энергия' },
          { label: 'DOFFA', value: doffa, cls: 'text-gold-300', hint: 'награда' },
          { label: 'К выводу', value: doffaClaimed, cls: 'text-white/85', hint: 'заявки' },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4 text-center">
            <div className={`font-display text-2xl ${c.cls}`}>{c.value}</div>
            <div className="mt-0.5 text-xs text-white/60">{c.label}</div>
            <div className="text-[10px] text-white/30">{c.hint}</div>
          </div>
        ))}
      </div>

      {/* сводка статистики Crazy 8 — показываем только в dev-режиме классики,
          иначе она бессмысленна (режим недоступен игроку). */}
      {ENABLE_CRAZY8_CLASSIC && (
        <div className="mt-4 glass rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Партий сыграно</span>
            <span className="font-display text-lg text-white/85">{stats.gamesPlayed}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/60">Побед</span>
            <span className="font-display text-lg text-emerald-300">{stats.wins}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/60">Процент побед</span>
            <span className="font-display text-lg text-gold-300">{winRate}%</span>
          </div>
        </div>
      )}

      {/* навигация */}
      <div className="mt-4 space-y-3">
        <PremiumButton full variant="gold" onClick={() => navigate('claim')}>
          Забрать награду
        </PremiumButton>
        <PremiumButton full variant="ghost" onClick={() => navigate('rewards')}>
          История наград
        </PremiumButton>
        {ENABLE_CRAZY8_CLASSIC && (
          <PremiumButton full variant="ghost" onClick={() => navigate('stats')}>
            Полная статистика (Crazy 8)
          </PremiumButton>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 pb-6 text-[11px] text-white/25">
        <DoffaEmblem size={14} />
        Экосистема DOFFA · doffa.coffee
      </div>
    </div>
  );
}
