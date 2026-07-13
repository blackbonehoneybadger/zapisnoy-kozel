import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PremiumButton } from '../components/PremiumButton';
import { WalletButton } from '../components/WalletButton';
import { DoffaEmblem } from '../components/DoffaEmblem';
import { Confetti } from '../components/WinFx';
import { useRewardsStore } from '../store/rewardsStore';
import { useWalletStore } from '../solana/walletStore';
import { haptics } from '../game/haptics';

interface Props {
  onBack: () => void;
}

/**
 * Экран получения DOFFA. Накопленную награду можно закрепить за подключённым
 * Solana-кошельком — создаётся заявка на вывод. Экран честен с игроком:
 * сам токен в сеть отправляет команда DOFFA по заявкам, игра ключами не владеет.
 */
export function ClaimScreen({ onBack }: Props) {
  const doffa = useRewardsStore((s) => s.doffa);
  const doffaClaimed = useRewardsStore((s) => s.doffaClaimed);
  const cups = useRewardsStore((s) => s.cups);
  const claim = useRewardsStore((s) => s.claim);
  const address = useWalletStore((s) => s.address);

  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  // Растровая монета DOFFA (генерация Higgsfield). Пока файла нет в
  // public/art — молча показываем векторную эмблему, код менять не нужно.
  const [coinArtOk, setCoinArtOk] = useState(true);

  const handleClaim = () => {
    if (!address || doffa <= 0) return;
    const amount = claim(address);
    if (amount > 0) {
      haptics.win();
      setJustClaimed(amount);
    }
  };

  return (
    <div className="relative min-h-[100dvh] px-5 pt-4 safe-top safe-bottom">
      {justClaimed !== null && <Confetti />}

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
        <h1 className="font-display text-3xl gold-text">Награда DOFFA</h1>
      </div>

      {/* главная карточка с балансом */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative overflow-hidden rounded-3xl p-7 text-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(224,164,59,0.35), transparent 70%)' }}
        />
        <div className="relative mx-auto mb-4 grid h-24 w-24 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full table-ring animate-spin-slow opacity-70" />
          <motion.div
            className="grid h-20 w-20 place-items-center overflow-hidden rounded-full glass animate-float"
          >
            {coinArtOk ? (
              <img
                src="/art/doffa-coin.webp"
                alt=""
                className="h-full w-full object-cover"
                onError={() => setCoinArtOk(false)}
              />
            ) : (
              <DoffaEmblem size={52} />
            )}
          </motion.div>
        </div>

        <p className="text-[0.65rem] uppercase tracking-luxe text-gold-500/70">Доступно к получению</p>
        <p className="mt-2 font-display text-6xl font-semibold gold-text">{doffa}</p>
        <p className="mt-1 text-sm text-white/45">DOFFA</p>

        <div className="mx-auto mt-5 h-px w-24 bg-champagne-line" />

        <div className="mt-5 flex items-center justify-center gap-6 text-sm">
          <div>
            <p className="font-display text-2xl text-gold-300">{cups}</p>
            <p className="text-[11px] text-white/40">Cups · энергия</p>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div>
            <p className="font-display text-2xl text-white/85">{doffaClaimed}</p>
            <p className="text-[11px] text-white/40">DOFFA к выводу</p>
          </div>
        </div>
      </motion.div>

      {/* подключение кошелька + получение */}
      <div className="mt-4 space-y-3">
        <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="text-sm text-white/60">Кошелёк Solana</span>
          <WalletButton />
        </div>

        <PremiumButton
          full
          variant="gold"
          disabled={!address || doffa <= 0}
          onClick={handleClaim}
        >
          {doffa > 0 ? `Забрать ${doffa} DOFFA` : 'Пока нечего забирать'}
        </PremiumButton>

        {!address && doffa > 0 && (
          <p className="px-2 text-center text-xs text-white/40">
            Подключите кошелёк, чтобы закрепить награду за собой.
          </p>
        )}

        <p className="px-2 text-center text-[11px] leading-relaxed text-white/30">
          «Забрать награду» закрепляет DOFFA за вашим кошельком — создаётся заявка
          на вывод. Токены в сеть Solana отправляет команда DOFFA по заявкам.
        </p>
      </div>

      {/* подтверждение получения */}
      <AnimatePresence>
        {justClaimed !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-strong mt-4 rounded-2xl border border-gold-500/25 p-5 text-center"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">Готово</p>
            <p className="mt-1 font-display text-2xl gold-text">+{justClaimed} DOFFA к выводу</p>
            <p className="mt-2 text-xs text-white/45">
              Награда закреплена за кошельком{' '}
              <span className="font-mono text-gold-300">
                {address ? `${address.slice(0, 4)}…${address.slice(-4)}` : ''}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
