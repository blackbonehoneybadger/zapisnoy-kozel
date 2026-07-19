import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PremiumButton } from '../../components/shared/PremiumButton';
import { WalletButton } from '../../components/shared/WalletButton';
import { DoffaEmblem } from '../../components/shared/DoffaEmblem';
import { Confetti } from '../../components/shared/WinFx';
import { useBeansStore } from '../beans/beansStore';
import { useRewardsStore } from './rewardsStore';
import { useWalletStore } from '../wallet/walletStore';
import { useOnlineStore } from '../../net/onlineStore';
import { haptics } from '../../lib/haptics';

interface Props {
  onBack: () => void;
}

/**
 * Экран получения DOFFA. Список наград к получению и сам Claim — ТОЛЬКО с
 * сервера (reward:list/reward:claim): клиент не считает и не подтверждает
 * сумму сам. Токен в сеть отправляет команда DOFFA по заявкам — игра
 * ключами не владеет (см. server/src/services/claimService.ts).
 */
export function ClaimScreen({ onBack }: Props) {
  const doffa = useRewardsStore((s) => s.doffa);
  const doffaClaimed = useRewardsStore((s) => s.doffaClaimed);
  const available = useRewardsStore((s) => s.available);
  const beans = useBeansStore((s) => s.beans);
  const address = useWalletStore((s) => s.address);

  const status = useOnlineStore((s) => s.status);
  const user = useOnlineStore((s) => s.user);
  const claimBusy = useOnlineStore((s) => s.claimBusy);
  const claimError = useOnlineStore((s) => s.claimError);
  const lastClaimTestMode = useOnlineStore((s) => s.lastClaimTestMode);
  const requestRewards = useOnlineStore((s) => s.requestRewards);
  const claimReward = useOnlineStore((s) => s.claimReward);

  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  // Растровая монета DOFFA (генерация Higgsfield). Пока файла нет в
  // public/art — молча показываем векторную эмблему, код менять не нужно.
  const [coinArtOk, setCoinArtOk] = useState(true);
  // Сумма отправленной на Claim заявки — известна ДО ответа сервера
  // (нужна, чтобы показать подтверждение, когда claimBusy станет false).
  const pendingAmountRef = useRef<number | null>(null);
  const wasClaimBusyRef = useRef(false);

  // Подтягиваем актуальный список наград при входе на экран (и при
  // появлении сессии, если кошелёк подключился уже здесь).
  useEffect(() => {
    if (status === 'connected' && user) requestRewards();
  }, [status, user, requestRewards]);

  const handleClaim = () => {
    if (!address || doffa <= 0 || claimBusy) return;
    const oldest = [...available].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!oldest) return;
    pendingAmountRef.current = oldest.amount;
    claimReward(oldest.id, address);
  };

  // claimBusy: true -> false с claimError=null означает сервер подтвердил
  // Claim (см. reward:claimResult в net/onlineStore.ts) — показываем
  // подтверждение с суммой, которую мы отправляли на получение.
  useEffect(() => {
    if (wasClaimBusyRef.current && !claimBusy && !claimError && pendingAmountRef.current !== null) {
      haptics.win();
      setJustClaimed(pendingAmountRef.current);
      pendingAmountRef.current = null;
      const timer = setTimeout(() => setJustClaimed(null), 6000);
      wasClaimBusyRef.current = claimBusy;
      return () => clearTimeout(timer);
    }
    wasClaimBusyRef.current = claimBusy;
  }, [claimBusy, claimError]);

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
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="grid h-20 w-20 place-items-center overflow-hidden rounded-full glass"
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
            <p className="font-display text-2xl text-gold-300">{beans}</p>
            <p className="text-[11px] text-white/40">Зёрна · энергия</p>
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
          disabled={!address || doffa <= 0 || claimBusy}
          onClick={handleClaim}
        >
          {claimBusy ? 'Получаем…' : doffa > 0 ? `Забрать ${doffa} DOFFA` : 'Пока нечего забирать'}
        </PremiumButton>

        {!address && doffa > 0 && (
          <p className="px-2 text-center text-xs text-white/40">
            Подключите кошелёк, чтобы закрепить награду за собой.
          </p>
        )}

        {claimError && (
          <p className="px-2 text-center text-xs text-wine-400">{claimError}</p>
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
            {lastClaimTestMode && (
              <p className="mt-2 text-[11px] text-white/30">
                Тестовый режим — реальные выплаты DOFFA пока не активированы.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
