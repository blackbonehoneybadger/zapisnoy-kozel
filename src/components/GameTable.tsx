import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, Player } from '../game/types';
import { SUIT_SYMBOL } from '../game/deck';
import { topCard } from '../game/rules';
import { Card } from './Card';
import { GoatEmblem } from './GoatEmblem';

interface Props {
  state: GameState;
  youSeat?: number;
}

/** Позиции соперников по кромке овала в зависимости от их числа. */
function seatClass(i: number, count: number): string {
  if (count === 1) return 'top-2 left-1/2 -translate-x-1/2';
  if (count === 2) return ['top-2 left-3', 'top-2 right-3'][i] ?? '';
  return (
    [
      'top-[34%] left-2 -translate-y-1/2',
      'top-2 left-1/2 -translate-x-1/2',
      'top-[34%] right-2 -translate-y-1/2',
    ][i] ?? 'top-2 left-1/2 -translate-x-1/2'
  );
}

/** Светящаяся гексагональная рамка соперника: имя сверху, крупный счёт снизу, чип статуса. */
function OpponentSeat({
  player,
  active,
  drawCount,
}: {
  player: Player;
  active: boolean;
  drawCount: number;
}) {
  let chip: { text: string; tone: 'turn' | 'penalty' | 'busted' } | null = null;
  if (player.busted) chip = { text: 'улетел', tone: 'busted' };
  else if (active && drawCount > 0) chip = { text: `+${drawCount}`, tone: 'penalty' };
  else if (active) chip = { text: 'ход', tone: 'turn' };

  return (
    <div className={`flex flex-col items-center gap-1 ${player.busted ? 'opacity-40' : ''}`}>
      {/* имя */}
      <div
        className={`max-w-[5rem] truncate text-[10px] font-medium tracking-wide ${
          active ? 'text-gold-300' : 'text-white/55'
        }`}
      >
        {player.name}
      </div>

      {/* гексагональная рамка аватара */}
      <div className="relative grid h-14 w-14 place-items-center">
        {/* внешнее пульсирующее свечение активного игрока */}
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 -z-10 hex-clip animate-halo"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 45%, rgba(153,69,255,0.6), rgba(25,214,138,0.22) 55%, transparent 72%)',
            }}
          />
        )}
        {/* неоновая кромка гексагона */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 hex-clip"
          style={{
            background: active
              ? 'linear-gradient(135deg, rgba(216,199,255,0.95), rgba(25,214,138,0.6))'
              : 'linear-gradient(135deg, rgba(196,165,255,0.35), rgba(25,214,138,0.2))',
          }}
        />
        {/* тёмная сердцевина */}
        <span aria-hidden className="pointer-events-none absolute inset-[1.5px] hex-clip bg-ink-900" />
        {/* внутреннее свечение */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[1.5px] hex-clip"
          style={{
            background: 'radial-gradient(70% 60% at 50% 38%, rgba(153,69,255,0.28), transparent 70%)',
          }}
        />

        {/* содержимое */}
        <span className="relative grid place-items-center">
          {player.isBot ? (
            <GoatEmblem size={26} />
          ) : (
            <span className={`font-display text-lg ${active ? 'text-gold-300' : 'text-white/80'}`}>
              {(player.name.trim()[0] ?? 'И').toUpperCase()}
            </span>
          )}
        </span>

        {/* бейдж числа карт на руке */}
        <span className="absolute -bottom-1 -right-1 z-10 grid h-5 min-w-5 place-items-center rounded-full border border-gold-600/40 bg-ink-900 px-1 text-[10px] font-semibold text-gold-300">
          {player.hand.length}
        </span>
      </div>

      {/* крупный счёт */}
      <div
        className={`font-display text-xl leading-none tabular-nums ${
          active ? 'gold-text' : 'text-white/75'
        }`}
      >
        {player.score}
      </div>

      {/* чип статуса */}
      <div className="h-4">
        <AnimatePresence mode="wait">
          {chip && (
            <motion.span
              key={chip.text}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              className={`inline-flex items-center rounded-full px-2 py-[1px] text-[8px] font-semibold uppercase tracking-[0.15em] ${
                chip.tone === 'busted'
                  ? 'bg-wine-700/40 text-wine-400 border border-wine-500/30'
                  : chip.tone === 'penalty'
                    ? 'bg-wine-600 text-white border border-wine-400/40'
                    : 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
              }`}
            >
              {chip.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Парящий стеклянный Solana-кристалл — декоративный акцент над стопками. */
function CrystalToken() {
  return (
    <motion.div
      aria-hidden
      animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="pointer-events-none relative grid place-items-center"
      style={{ width: '3.25rem', height: '3.75rem' }}
    >
      <span
        className="absolute inset-0 rounded-full blur-xl"
        style={{
          background:
            'radial-gradient(circle, rgba(153,69,255,0.6), rgba(25,214,138,0.22) 58%, transparent 72%)',
        }}
      />
      <svg viewBox="0 0 48 56" width="42" height="50" fill="none" className="relative drop-shadow-[0_4px_10px_rgba(153,69,255,0.5)]">
        <defs>
          <linearGradient id="gemFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d8c7ff" />
            <stop offset="0.5" stopColor="#9945ff" />
            <stop offset="1" stopColor="#19d68a" />
          </linearGradient>
          <linearGradient id="gemCrown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#c4a5ff" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* корона */}
        <polygon points="16,6 32,6 42,20 6,20" fill="url(#gemCrown)" />
        {/* павильон */}
        <polygon points="6,20 42,20 24,52" fill="url(#gemFace)" />
        {/* грани-тени */}
        <polygon points="6,20 24,20 24,52" fill="#050308" opacity="0.18" />
        <polygon points="16,6 24,6 24,20 6,20" fill="#ffffff" opacity="0.16" />
        {/* блик на площадке */}
        <polygon points="17,7 31,7 29,12 19,12" fill="#ffffff" opacity="0.55" />
        {/* контур и рёбра */}
        <path d="M16 6 32 6 42 20 24 52 6 20Z" stroke="url(#gemFace)" strokeWidth="1" opacity="0.9" />
        <path d="M6 20H42M24 20V52M16 6 24 20M32 6 24 20" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" />
      </svg>
    </motion.div>
  );
}

/** Стопка с подписью капсом. */
function Pile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid h-[6.5rem] w-[4.6rem] place-items-center">{children}</div>
      <span className="text-[8px] font-medium uppercase tracking-[0.28em] text-white/45">{label}</span>
    </div>
  );
}

/** Постоянный вращающийся Solana Rewards Orb — декоративный бренд-акцент. */
function RewardsOrb() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2">
      <div className="relative grid h-10 w-10 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full table-ring animate-spin-slow opacity-80" />
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full blur-md"
          style={{ background: 'radial-gradient(circle, rgba(153,69,255,0.5), transparent 70%)' }}
        />
        <span className="relative grid h-7 w-7 place-items-center rounded-full border border-gold-600/40 bg-ink-900/85">
          <GoatEmblem size={16} />
        </span>
      </div>
      <span className="text-[7px] font-medium uppercase leading-[1.3] tracking-[0.22em] text-white/35">
        Solana
        <br />
        Rewards
      </span>
    </div>
  );
}

/** Карточный стол: гексагональные аватары соперников, кристалл, подписанные стопки. */
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

  const you = state.players[mySeat];
  const yourTurn =
    !!you && state.players[state.currentPlayerIndex].id === you.id && state.phase === 'playing';

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-gold-700/25 shadow-[inset_0_2px_40px_rgba(0,0,0,0.55),0_30px_70px_-30px_rgba(0,0,0,0.8)]"
      style={{
        backgroundImage: "url('/art/table-felt.svg'), url('/art/table-felt.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* CSS-фоллбэк неонового сукна */}
      <div className="pointer-events-none absolute inset-0 bg-felt-radial opacity-50" />

      {/* гравировка «печатной платы»: тонкие дорожки + узлы, приглушены к краям */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(60deg, transparent 0 26px, rgba(196,165,255,0.5) 26px 27px), repeating-linear-gradient(-60deg, transparent 0 26px, rgba(25,214,138,0.35) 26px 27px)',
          maskImage: 'radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 75%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(196,165,255,0.7) 1px, transparent 1.6px), radial-gradient(circle, rgba(25,214,138,0.5) 1px, transparent 1.6px)',
          backgroundSize: '54px 54px, 54px 54px',
          backgroundPosition: '0 0, 27px 27px',
          maskImage: 'radial-gradient(65% 55% at 50% 50%, #000 0%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(65% 55% at 50% 50%, #000 0%, transparent 78%)',
        }}
      />

      {/* зерно и свет */}
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.06] mix-blend-soft-light" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(68%_52%_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_60%,rgba(0,0,0,0.4)_100%)]" />

      {/* овальный неоновый ободок стола */}
      <div className="pointer-events-none absolute inset-2 rounded-full">
        <div className="absolute left-1/2 top-1/2 aspect-square h-[135%] max-h-none -translate-x-1/2 -translate-y-1/2 rounded-full table-ring animate-spin-slow opacity-70 blur-[0.5px]" />
        <div className="absolute left-1/2 top-1/2 aspect-square h-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full table-ring animate-spin-slower opacity-40" />
      </div>

      {/* усиленное свечение центра во время хода игрока-человека */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-700 ${
          yourTurn ? 'opacity-100 animate-halo' : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(153,69,255,0.4), rgba(25,214,138,0.14) 55%, transparent 72%)',
        }}
      />

      {/* шампань-кант */}
      <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-gold-500/12" />

      {/* соперники в гексагональных рамках */}
      {opponents.map(({ player }, i) => (
        <div key={player.id} className={`absolute z-10 ${seatClass(i, opponents.length)}`}>
          <OpponentSeat
            player={player}
            active={isActive(player)}
            drawCount={isActive(player) ? d.drawCount : 0}
          />
        </div>
      ))}

      {/* центр: кристалл над двумя подписанными стопками */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <CrystalToken />

        <div className="mt-1 flex items-start justify-center gap-5">
          {/* СБРОС — текущая верхняя карта */}
          <Pile label="Сброс">
            <div className="relative" style={{ perspective: 900 }}>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={top.id}
                  initial={{ scale: 0.6, rotateY: -120, rotateZ: -14, opacity: 0 }}
                  animate={{ scale: 1, rotateY: 0, rotateZ: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <Card card={top} />
                </motion.div>
              </AnimatePresence>

              {demandBadge && (
                <motion.span
                  key={demandBadge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-3 -top-3 grid h-7 min-w-7 place-items-center rounded-full border border-wine-400/40 bg-wine-600 px-1.5 text-[11px] font-semibold text-white shadow-lg"
                >
                  {demandBadge}
                </motion.span>
              )}
            </div>
          </Pile>

          {/* КОЛОДА — стопка рубашек */}
          <Pile label="Колода">
            {state.deck.length > 0 ? (
              <>
                <Card faceDown className="absolute -left-1 -top-1 rotate-[-7deg] opacity-70" />
                <Card faceDown className="absolute left-0.5 top-0.5 rotate-[4deg] opacity-85" />
                <Card faceDown />
              </>
            ) : (
              <div className="grid h-full w-full place-items-center rounded-[0.85rem] border border-dashed border-white/10 text-[9px] uppercase tracking-widest text-white/25">
                пусто
              </div>
            )}
          </Pile>
        </div>
      </div>

      {/* Solana Rewards Orb */}
      <RewardsOrb />
    </div>
  );
}
