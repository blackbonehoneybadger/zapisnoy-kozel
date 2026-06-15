import { AnimatePresence, motion } from 'framer-motion';
import type { GameState } from '../game/types';
import { SUIT_IS_RED, SUIT_LABEL, SUIT_SYMBOL } from '../game/deck';
import { topCard } from '../game/rules';
import { Card } from './Card';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  state: GameState;
}

/** Карточный стол: соперники сверху, колода и сброс в центре. */
export function GameTable({ state }: Props) {
  const bots = state.players.filter((p) => p.isBot);
  const top = topCard(state);
  const activeSuit = state.activeSuit;
  const red = SUIT_IS_RED[activeSuit];
  const d = state.demand;

  let demandBadge: string | null = null;
  if (d.drawCount > 0) demandBadge = `+${d.drawCount}`;
  else if (d.aceSkip) demandBadge = 'Пропуск';
  else if (d.nineSuit) demandBadge = `9 · ${SUIT_SYMBOL[d.nineSuit]}`;

  return (
    <div className="relative flex-1 overflow-hidden rounded-[2rem] bg-felt-radial border border-gold-700/30 shadow-[inset_0_2px_30px_rgba(0,0,0,0.5)]">
      {/* фактура сукна */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-gold-500/15" />

      {/* соперники */}
      <div className="relative flex justify-around px-4 pt-5">
        {bots.map((p) => (
          <PlayerAvatar
            key={p.id}
            player={p}
            active={state.players[state.currentPlayerIndex].id === p.id && state.phase === 'playing'}
            compact={bots.length > 2}
          />
        ))}
      </div>

      {/* центр: колода + сброс */}
      <div className="relative mt-2 flex items-center justify-center gap-7 py-6">
        {/* колода */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <Card faceDown className="absolute -left-1 -top-1 rotate-[-6deg]" />
            <Card faceDown className="absolute left-0.5 top-0.5 rotate-[4deg]" />
            <Card faceDown />
          </div>
          <span className="text-[11px] text-white/50">Колода · {state.deck.length}</span>
        </div>

        {/* сброс */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={top.id}
                initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
              >
                <Card card={top} />
              </motion.div>
            </AnimatePresence>
            {demandBadge && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-3 -top-3 grid h-8 min-w-8 place-items-center rounded-full bg-red-600 px-2 text-xs font-bold text-white shadow-lg border border-red-300/40"
              >
                {demandBadge}
              </motion.span>
            )}
          </div>
          <span className="text-[11px] text-white/50">Сброс</span>
        </div>
      </div>

      {/* индикатор активной масти */}
      <div className="relative flex items-center justify-center pb-4">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-1.5">
          <span className="text-[11px] uppercase tracking-widest text-white/50">Масть</span>
          <span className={`text-lg ${red ? 'text-rose-400' : 'text-white'}`}>
            {SUIT_SYMBOL[activeSuit]}
          </span>
          <span className="text-[12px] text-white/70">{SUIT_LABEL[activeSuit]}</span>
        </div>
      </div>
    </div>
  );
}
