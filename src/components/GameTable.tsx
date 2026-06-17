import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, Player } from '../game/types';
import { SUIT_SYMBOL } from '../game/deck';
import { topCard } from '../game/rules';
import { Card } from './Card';

interface Props {
  state: GameState;
  youSeat?: number;
}

/** Позиции соперников в зависимости от их числа. */
function seatClass(i: number, count: number): string {
  if (count === 1) return 'top-3 left-1/2 -translate-x-1/2';
  if (count === 2) return ['top-3 left-4', 'top-3 right-4'][i] ?? '';
  return (
    [
      'top-[38%] left-1 -translate-y-1/2',
      'top-3 left-1/2 -translate-x-1/2',
      'top-[38%] right-1 -translate-y-1/2',
    ][i] ?? 'top-3 left-1/2 -translate-x-1/2'
  );
}

/** Карты соперника рубашкой — компактный веер. */
function OpponentFan({ player, active }: { player: Player; active: boolean }) {
  const n = player.hand.length;
  const show = Math.min(n, 7);
  const spread = Math.min(30, show * 5);
  const step = show > 1 ? spread / (show - 1) : 0;

  return (
    <div className={`flex flex-col items-center gap-1 ${player.busted ? 'opacity-35' : ''}`}>
      {/* веер рубашек */}
      <div className="relative" style={{ width: '4.4rem', height: '3.6rem' }}>
        {Array.from({ length: show }).map((_, i) => {
          const angle = -spread / 2 + step * i;
          return (
            <div
              key={i}
              className="absolute left-1/2 bottom-0"
              style={{
                transform: `translateX(-50%) rotate(${angle}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              {/* мини-карта рубашкой */}
              <div
                className="relative overflow-hidden rounded-[0.45rem] shadow-card"
                style={{
                  width: '2rem',
                  height: '2.85rem',
                  backgroundImage: "url('/art/card-back.svg'), linear-gradient(150deg,#15181c,#0c0e11)",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,rgba(153,69,255,0.16),transparent)]" />
                <div className="absolute inset-[2px] rounded-[0.3rem] border border-gold-600/25" />
              </div>
            </div>
          );
        })}
      </div>

      {/* имя + счёт */}
      <div className="text-center leading-none">
        <div
          className={`text-[9px] font-medium tracking-wide truncate max-w-[4.5rem] ${
            active ? 'text-gold-300' : 'text-white/50'
          }`}
        >
          {player.name}
        </div>
        {active && (
          <div className="mt-0.5 text-[8px] text-gold-400/80 animate-pulse">ход</div>
        )}
      </div>
    </div>
  );
}

/** Карточный стол: соперники с рубашками, колода и активная карта в центре. */
export function GameTable({ state, youSeat }: Props) {
  const mySeat = youSeat ?? Math.max(0, state.players.findIndex((p) => p.id === 'you'));
  const opponents = state.players
    .map((player, index) => ({ player, index }))
    .filter((p) => p.index !== mySeat);

  const top = topCard(state);
  const d = state.demand;
  let demandBadge: string | null = null;
  if (d.drawCount > 0) demandBadge = `+${d.drawCount}`;
  else if (d.aceSkip) demandBadge = 'Пропуск';
  else if (d.nineSuit) demandBadge = `9·${SUIT_SYMBOL[d.nineSuit]}`;

  const isActive = (p: Player) =>
    state.players[state.currentPlayerIndex].id === p.id && state.phase === 'playing';

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-gold-700/25 shadow-[inset_0_2px_40px_rgba(0,0,0,0.55),0_30px_70px_-30px_rgba(0,0,0,0.8)]"
      style={{
        backgroundImage: "url('/art/table-felt.svg'), url('/art/table-felt.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* CSS-фоллбэк изумрудного сукна */}
      <div className="pointer-events-none absolute inset-0 bg-felt-radial opacity-50" />
      {/* зерно и свет */}
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.06] mix-blend-soft-light" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(68%_52%_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_60%,rgba(0,0,0,0.4)_100%)]" />
      {/* шампань-кант */}
      <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-gold-500/12" />

      {/* соперники с веерами рубашек */}
      {opponents.map(({ player }, i) => (
        <div key={player.id} className={`absolute z-10 ${seatClass(i, opponents.length)}`}>
          <OpponentFan player={player} active={isActive(player)} />
        </div>
      ))}

      {/* центр: только колода + текущая карта */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-5">
        {/* колода — стопка рубашек */}
        {state.deck.length > 0 && (
          <div className="relative">
            <Card faceDown className="absolute -left-1 -top-1 rotate-[-7deg] opacity-70" />
            <Card faceDown className="absolute left-0.5 top-0.5 rotate-[4deg] opacity-85" />
            <Card faceDown />
          </div>
        )}

        {/* активная карта + штрафной бейдж */}
        <div className="relative">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={top.id}
              initial={{ scale: 0.65, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <Card card={top} />
            </motion.div>
          </AnimatePresence>

          {demandBadge && (
            <motion.span
              key={demandBadge}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-3 -top-3 grid h-7 min-w-7 place-items-center rounded-full bg-wine-600 px-1.5 text-[11px] font-bold text-white shadow-lg border border-wine-400/40"
            >
              {demandBadge}
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
