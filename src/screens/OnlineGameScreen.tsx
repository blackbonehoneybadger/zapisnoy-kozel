import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, Suit } from '../game/types';
import { canPlayCard, hasPlayableCard } from '../game/rules';
import { SUITS, SUIT_IS_RED, SUIT_LABEL, SUIT_SYMBOL } from '../game/deck';
import { getTakeLabel } from '../game/labels';
import { GameTable } from '../components/GameTable';
import { PlayerHand } from '../components/PlayerHand';
import { ScoreBoard } from '../components/ScoreBoard';
import { PremiumButton } from '../components/PremiumButton';
import { GoatEmblem } from '../components/GoatEmblem';
import { Confetti, Trophy } from '../components/WinFx';
import {
  drawCardSound,
  loseSound,
  penaltySound,
  playCardSound,
  specialSound,
  winSound,
} from '../game/sound';
import { haptics } from '../game/haptics';
import { useOnlineStore } from '../net/onlineStore';

function playEvent(state: GameState): void {
  const evt = state.lastEvent;
  if (!evt) return;
  switch (evt.type) {
    case 'play':
      playCardSound();
      haptics.play();
      break;
    case 'queen':
    case 'six':
    case 'seven':
    case 'king':
    case 'ace':
    case 'nine':
      specialSound();
      haptics.special();
      break;
    case 'draw':
      if ((evt.amount ?? 1) > 1) {
        penaltySound();
        haptics.penalty();
      } else {
        drawCardSound();
        haptics.draw();
      }
      break;
    case 'busted':
      loseSound();
      haptics.lose();
      break;
    case 'reset':
    case 'roundWin':
      winSound();
      haptics.win();
      break;
  }
}

export function OnlineGameScreen() {
  const game = useOnlineStore((s) => s.game);
  const youSeat = useOnlineStore((s) => s.youSeat);
  const table = useOnlineStore((s) => s.table);
  const user = useOnlineStore((s) => s.user);
  const playCard = useOnlineStore((s) => s.playCard);
  const take = useOnlineStore((s) => s.take);
  const nextRound = useOnlineStore((s) => s.nextRound);
  const startGame = useOnlineStore((s) => s.startGame);
  const leaveTable = useOnlineStore((s) => s.leaveTable);

  const [queenCard, setQueenCard] = useState<CardType | null>(null);
  const [showScore, setShowScore] = useState(false);
  const lastEventTs = useRef(0);

  useEffect(() => {
    if (game?.lastEvent && game.lastEvent.ts !== lastEventTs.current) {
      lastEventTs.current = game.lastEvent.ts;
      playEvent(game);
    }
  }, [game?.lastEvent?.ts]);

  if (!game) return null;

  const me = game.players[youSeat];
  const current = game.players[game.currentPlayerIndex];
  const yourTurn = game.currentPlayerIndex === youSeat && game.phase === 'playing';
  const isPlayable = (card: CardType) => canPlayCard(game, card);
  const canPlayAny = hasPlayableCard(game, me?.hand ?? []);
  const takeLabel = getTakeLabel(game, canPlayAny);
  const isHost = table?.hostId === user?.id;

  const onPlay = (card: CardType) => {
    if (card.rank === 'Q') setQueenCard(card);
    else playCard(card.id);
  };
  const chooseSuit = (suit: Suit) => {
    if (queenCard) playCard(queenCard.id, suit);
    setQueenCard(null);
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden px-3 pt-3 safe-top">
      {/* верхняя панель */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={leaveTable}
          aria-label="Выйти из-за стола"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-wide gold-text">Раунд {game.roundNumber}</div>
          <div className="max-w-[10rem] truncate text-[10px] uppercase tracking-[0.25em] text-white/35">
            {table?.name ?? 'Онлайн-стол'}
          </div>
        </div>
        <button
          onClick={() => setShowScore(true)}
          aria-label="Показать счёт"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-gold-400 transition active:scale-95 hover:text-gold-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <GameTable state={game} youSeat={youSeat} />

      {/* статус хода */}
      <div className="relative mt-2 flex min-h-[2.25rem] shrink-0 items-center justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${yourTurn}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-full px-4 py-1.5 text-center text-sm"
          >
            {yourTurn ? (
              <span className="text-gold-300">{takeLabel.prompt ?? 'Ваш ход — выберите карту'}</span>
            ) : (
              <span className="text-white/60">Ходит {current.name}…</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* рука игрока */}
      <div className="relative mt-1 shrink-0">
        <AnimatePresence>
          {yourTurn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-full bg-gold-500/25 blur-2xl"
            />
          )}
        </AnimatePresence>
        <PlayerHand cards={me?.hand ?? []} isPlayable={isPlayable} onPlay={onPlay} yourTurn={yourTurn} />
      </div>

      {/* действия */}
      <div className="mt-2 flex shrink-0 items-center justify-center gap-3 px-3 pb-1 safe-bottom">
        <PremiumButton variant="ghost" disabled={!yourTurn} onClick={take} className="min-w-[10rem]">
          {takeLabel.button}
        </PremiumButton>
      </div>

      {/* выбор масти дамой */}
      <AnimatePresence>
        {queenCard && <SuitChooser onChoose={chooseSuit} onCancel={() => setQueenCard(null)} />}
      </AnimatePresence>

      {/* счёт */}
      <AnimatePresence>
        {showScore && (
          <Sheet onClose={() => setShowScore(false)}>
            <ScoreBoard state={game} />
          </Sheet>
        )}
      </AnimatePresence>

      {/* конец раунда */}
      <AnimatePresence>
        {game.phase === 'roundOver' && game.roundResults && (
          <RoundOverlay state={game} onNext={nextRound} />
        )}
      </AnimatePresence>

      {/* конец партии */}
      <AnimatePresence>
        {game.phase === 'gameOver' && (
          <GameOverOverlay
            state={game}
            won={game.winnerId === me?.id}
            isHost={isHost}
            onAgain={startGame}
            onLeave={leaveTable}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SuitChooser({ onChoose, onCancel }: { onChoose: (s: Suit) => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center"
      >
        <GoatEmblem size={40} className="mx-auto mb-2" />
        <h3 className="font-display text-xl gold-text">Выберите масть</h3>
        <p className="mb-5 mt-1 text-xs text-white/50">Дама меняет масть на столе</p>
        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((s) => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.04 }}
              onClick={() => onChoose(s)}
              className="glass flex flex-col items-center gap-1 rounded-2xl py-4"
            >
              <span className={`text-3xl ${SUIT_IS_RED[s] ? 'text-[#d98a93]' : 'text-white'}`}>
                {SUIT_SYMBOL[s]}
              </span>
              <span className="text-xs text-white/60">{SUIT_LABEL[s]}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full rounded-t-3xl p-5 safe-bottom"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        {children}
      </motion.div>
    </motion.div>
  );
}

function RoundOverlay({ state, onNext }: { state: GameState; onNext: () => void }) {
  const results = state.roundResults!;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 grid place-items-center bg-black/75 backdrop-blur-md px-6"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="glass-strong w-full max-w-sm rounded-3xl p-6"
      >
        <h2 className="mb-4 text-center font-display text-2xl gold-text">Раунд завершён</h2>
        <div className="glass rounded-2xl p-4">
          <div className="space-y-1.5">
            {results.map((r) => (
              <div
                key={r.playerId}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  r.busted ? 'bg-wine-700/20' : 'bg-white/[0.03]'
                }`}
              >
                <span className={`text-sm ${r.busted ? 'text-wine-400 line-through' : 'text-white/85'}`}>
                  {r.name}
                </span>
                <span className="flex items-center gap-2">
                  {r.busted && <span className="text-[11px] text-wine-400">улетел</span>}
                  {r.reset && <span className="text-[11px] text-emerald-300">обнулён</span>}
                  <span className="font-display text-lg text-gold-300">{r.total}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <PremiumButton full onClick={onNext}>
            Следующий раунд
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GameOverOverlay({
  state,
  won,
  isHost,
  onAgain,
  onLeave,
}: {
  state: GameState;
  won: boolean;
  isHost: boolean;
  onAgain: () => void;
  onLeave: () => void;
}) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden px-6"
    >
      <div className={`absolute inset-0 ${won ? 'bg-felt-radial' : 'bg-ink-900'}`} />
      <div className="absolute inset-0 bg-black/55" />
      {won && <Confetti />}

      {/* пульсирующий ореол за баннером победы */}
      {won && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(224,164,59,0.55), rgba(58,94,66,0.22) 55%, transparent 72%)' }}
        />
      )}

      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="glass-strong relative w-full max-w-sm rounded-3xl p-7 text-center"
      >
        <div className="relative mx-auto mb-3 grid h-28 w-28 place-items-center">
          {/* вращающийся орб-награда за кубком */}
          {won && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full table-ring animate-spin-slow opacity-80"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-2 rounded-full blur-xl animate-halo"
                style={{ background: 'radial-gradient(circle, rgba(224,164,59,0.5), transparent 70%)' }}
              />
            </>
          )}
          <motion.div
            animate={won ? { rotate: [0, -6, 6, 0], y: [0, -4, 0] } : {}}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="relative grid h-24 w-24 place-items-center rounded-3xl glass"
          >
            {won ? <Trophy size={60} /> : <GoatEmblem size={64} />}
          </motion.div>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">
          {won ? 'Победа' : 'Партия окончена'}
        </p>
        <h2 className="mt-1 font-display text-3xl">
          {won ? <span className="gold-text">Вы выиграли!</span> : <span className="text-white/90">Победил {winner?.name ?? '—'}</span>}
        </h2>
        <div className="mt-5 space-y-3">
          {isHost && (
            <PremiumButton full onClick={onAgain}>
              Сыграть ещё
            </PremiumButton>
          )}
          <PremiumButton full variant="ghost" onClick={onLeave}>
            Выйти в лобби
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
