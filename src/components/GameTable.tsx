import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, Player } from '../game/types';
import { SUIT_IS_RED, SUIT_LABEL, SUIT_SYMBOL } from '../game/deck';
import { topCard } from '../game/rules';
import { Card } from './Card';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  state: GameState;
  /** Кресло зрителя: соперники — все остальные. По умолчанию игрок «you». */
  youSeat?: number;
}

/** Кресло соперника за столом — по краям, как за реальным столом. */
function seatClass(i: number, count: number): string {
  if (count <= 2) {
    return ['left-6 top-4', 'right-6 top-4'][i] ?? 'left-1/2 top-4 -translate-x-1/2';
  }
  // три соперника: слева, по центру сверху, справа
  return (
    [
      'left-1 top-[42%] -translate-y-1/2',
      'left-1/2 top-3 -translate-x-1/2',
      'right-1 top-[42%] -translate-y-1/2',
    ][i] ?? 'left-1/2 top-3 -translate-x-1/2'
  );
}

/** Карточный стол: соперники по краям, колода и сброс в центре. */
export function GameTable({ state, youSeat }: Props) {
  const mySeat =
    youSeat ?? Math.max(0, state.players.findIndex((p) => p.id === 'you'));
  const opponents = state.players
    .map((player, index) => ({ player, index }))
    .filter((p) => p.index !== mySeat);
  const top = topCard(state);
  const activeSuit = state.activeSuit;
  const red = SUIT_IS_RED[activeSuit];
  const d = state.demand;

  let demandBadge: string | null = null;
  if (d.drawCount > 0) demandBadge = `+${d.drawCount}`;
  else if (d.aceSkip) demandBadge = 'Пропуск';
  else if (d.nineSuit) demandBadge = `9 · ${SUIT_SYMBOL[d.nineSuit]}`;

  const isActive = (p: Player) =>
    state.players[state.currentPlayerIndex].id === p.id && state.phase === 'playing';

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-gold-700/25 shadow-[inset_0_2px_40px_rgba(0,0,0,0.55),0_30px_70px_-30px_rgba(0,0,0,0.8)]"
      style={{
        backgroundImage: "url('/art/table-felt.jpg'), url('/art/table-felt.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* CSS-фоллбэк изумрудного сукна — поверх AI как darkening overlay */}
      <div className="pointer-events-none absolute inset-0 bg-felt-radial opacity-50" />
      {/* зерно сукна */}
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.06] mix-blend-soft-light" />
      {/* мягкий центральный свет стола */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(68%_52%_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
      {/* виньетка по краям */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_60%,rgba(0,0,0,0.4)_100%)]" />
      {/* тонкая шампань-окантовка */}
      <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-gold-500/15" />
      <div className="pointer-events-none absolute inset-[14px] rounded-[1.4rem] border border-gold-700/10" />

      {/* соперники по краям стола */}
      {opponents.map(({ player }, i) => (
        <div key={player.id} className={`absolute z-10 ${seatClass(i, opponents.length)}`}>
          <PlayerAvatar player={player} active={isActive(player)} compact />
        </div>
      ))}

      {/* центр: колода + сброс */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-6">
        {/* колода */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            <Card faceDown className="absolute -left-1 -top-1 rotate-[-6deg]" />
            <Card faceDown className="absolute left-0.5 top-0.5 rotate-[4deg]" />
            <Card faceDown />
          </div>
          <span className="text-[10px] tracking-wide text-white/45">Колода · {state.deck.length}</span>
        </div>

        {/* сброс */}
        <div className="flex flex-col items-center gap-1.5">
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
                className="absolute -right-3 -top-3 grid h-8 min-w-8 place-items-center rounded-full bg-wine-600 px-2 text-xs font-bold text-white shadow-lg border border-wine-400/40"
              >
                {demandBadge}
              </motion.span>
            )}
          </div>
          <span className="text-[10px] tracking-wide text-white/45">Сброс</span>
        </div>
      </div>

      {/* индикатор активной масти — у нижней кромки стола */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Масть</span>
          <span className={`text-base ${red ? 'text-[#d98a93]' : 'text-white'}`}>
            {SUIT_SYMBOL[activeSuit]}
          </span>
          <span className="text-[11px] text-white/65">{SUIT_LABEL[activeSuit]}</span>
        </div>
      </div>
    </div>
  );
}
