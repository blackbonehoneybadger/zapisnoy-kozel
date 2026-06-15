import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, Suit } from '../game/types';
import { canPlayCard, hasPlayableCard, mustTakeOnly } from '../game/rules';
import { SUITS, SUIT_IS_RED, SUIT_LABEL, SUIT_SYMBOL } from '../game/deck';
import { GameTable } from '../components/GameTable';
import { PlayerHand } from '../components/PlayerHand';
import { ScoreBoard } from '../components/ScoreBoard';
import { PremiumButton } from '../components/PremiumButton';
import { GoatEmblem } from '../components/GoatEmblem';
import { useGameStore } from '../store/gameStore';

interface Props {
  onExit: () => void;
}

export function GameScreen({ onExit }: Props) {
  const game = useGameStore((s) => s.game);
  const playCard = useGameStore((s) => s.playCard);
  const take = useGameStore((s) => s.take);
  const nextRound = useGameStore((s) => s.nextRound);
  const start = useGameStore((s) => s.start);

  const [queenCard, setQueenCard] = useState<CardType | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Тост на яркие события (спец-карты, штрафы, победы).
  useEffect(() => {
    if (!game) return;
    const last = game.log[0];
    if (last && last.kind !== 'info') {
      setToast({ id: last.id, text: last.text });
      const t = setTimeout(() => setToast(null), 2200);
      return () => clearTimeout(t);
    }
  }, [game?.log[0]?.id]);

  if (!game) return null;

  const human = game.players.find((p) => p.id === 'you')!;
  const current = game.players[game.currentPlayerIndex];
  const yourTurn = current.id === 'you' && game.phase === 'playing';
  const isPlayable = (card: CardType) => canPlayCard(game, card);
  const canPlayAny = hasPlayableCard(game, human.hand);
  const takeLabel = getTakeLabel(game, canPlayAny);

  const onPlay = (card: CardType) => {
    if (card.rank === 'Q') setQueenCard(card);
    else playCard(card.id);
  };

  const chooseSuit = (suit: Suit) => {
    if (queenCard) playCard(queenCard.id, suit);
    setQueenCard(null);
  };

  const handleBack = () => {
    if (game.phase === 'playing') setConfirmExit(true);
    else onExit();
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col px-3 pt-3 safe-top">
      {/* верхняя панель */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={handleBack}
          aria-label="Выйти в меню"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-wide gold-text">Раунд {game.roundNumber}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Записной Козёл</div>
        </div>
        <button
          onClick={() => setShowScore(true)}
          aria-label="Показать счёт и события"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-gold-400 transition active:scale-95 hover:text-gold-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <GameTable state={game} />

      {/* статус хода */}
      <div className="relative mt-3 flex min-h-[2.5rem] items-center justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${yourTurn}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-full px-4 py-1.5 text-center text-sm"
          >
            {yourTurn ? (
              <span className="text-gold-300">
                {takeLabel.prompt ?? 'Ваш ход — выберите карту'}
              </span>
            ) : (
              <span className="text-white/60">Ходит {current.name}…</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* рука игрока */}
      <div className="relative mt-1">
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
        <PlayerHand
          cards={human.hand}
          isPlayable={isPlayable}
          onPlay={onPlay}
          yourTurn={yourTurn}
        />
      </div>

      {/* действия */}
      <div className="mb-1 mt-1 flex items-center justify-center gap-3 px-3 safe-bottom">
        <PremiumButton
          variant="ghost"
          disabled={!yourTurn}
          onClick={take}
          className="min-w-[10rem]"
        >
          {takeLabel.button}
        </PremiumButton>
      </div>

      {/* тост события */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="pointer-events-none absolute left-1/2 top-20 z-30 w-[88%] max-w-sm -translate-x-1/2"
          >
            <div className="glass-strong rounded-2xl px-4 py-3 text-center text-sm text-white/90">
              {toast.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* выбор масти дамой */}
      <AnimatePresence>
        {queenCard && (
          <SuitChooser onChoose={chooseSuit} onCancel={() => setQueenCard(null)} />
        )}
      </AnimatePresence>

      {/* таблица счёта (шторка) */}
      <AnimatePresence>
        {showScore && (
          <Sheet onClose={() => setShowScore(false)}>
            <ScoreBoard state={game} />
            <div className="mt-4 max-h-48 overflow-y-auto no-scrollbar">
              <h4 className="mb-2 text-xs uppercase tracking-widest text-white/40">События</h4>
              <div className="space-y-1.5">
                {game.log.slice(0, 14).map((l) => (
                  <p key={l.id} className={`text-xs ${logColor(l.kind)}`}>
                    {l.text}
                  </p>
                ))}
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* подтверждение выхода */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6"
            onClick={() => setConfirmExit(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center"
            >
              <h3 className="font-display text-xl gold-text">Выйти в меню?</h3>
              <p className="mb-5 mt-1 text-xs text-white/50">
                Текущая партия не сохранится.
              </p>
              <div className="space-y-3">
                <PremiumButton full variant="danger" onClick={onExit}>
                  Выйти
                </PremiumButton>
                <PremiumButton full variant="ghost" onClick={() => setConfirmExit(false)}>
                  Продолжить игру
                </PremiumButton>
              </div>
            </motion.div>
          </motion.div>
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
            won={game.winnerId === 'you'}
            onMenu={onExit}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getTakeLabel(state: GameState, canPlayAny: boolean): {
  button: string;
  prompt?: string;
} {
  const d = state.demand;
  if (mustTakeOnly(d)) {
    const src = d.drawSource === 'king' ? 'пиковый король' : 'семёрка';
    return { button: `Взять ${d.drawCount}`, prompt: `Штраф (${src}) — берите ${d.drawCount}` };
  }
  if (d.drawSource === 'six' && d.drawCount > 0) {
    return {
      button: `Взять ${d.drawCount}`,
      prompt: canPlayAny ? `Переведите шестёркой или возьмите ${d.drawCount}` : `Берите ${d.drawCount} карт`,
    };
  }
  if (d.aceSkip) {
    return { button: 'Пропустить', prompt: canPlayAny ? 'Побейте тузом или пропустите' : 'Туз — пропуск хода' };
  }
  if (d.nineSuit) {
    return {
      button: 'Взять 1',
      prompt: canPlayAny ? `Накройте мастью ${SUIT_SYMBOL[d.nineSuit]} или переведите 9` : 'Нечем накрыть — берите карту',
    };
  }
  if (state.drewThisTurn) return { button: 'Пропустить', prompt: 'Сыграйте взятую карту или пропустите' };
  return { button: 'Взять карту', prompt: canPlayAny ? undefined : 'Нет хода — возьмите карту' };
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
        className="glass-strong w-full max-w-sm rounded-3xl p-6"
      >
        <h2 className="mb-1 text-center font-display text-2xl gold-text">Раунд завершён</h2>
        <p className="mb-4 text-center text-xs text-white/50">Очки добавлены в таблицу</p>
        <ScoreBoard state={state} results={state.roundResults} />
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
  onMenu,
  onRestart,
}: {
  state: GameState;
  won: boolean;
  onMenu: () => void;
  onRestart: () => void;
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

      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="glass-strong relative w-full max-w-sm rounded-3xl p-7 text-center"
      >
        <motion.div
          animate={won ? { rotate: [0, -6, 6, 0] } : {}}
          transition={{ repeat: Infinity, duration: 4 }}
          className="mx-auto mb-3 grid h-24 w-24 place-items-center rounded-3xl glass"
        >
          <GoatEmblem size={64} />
        </motion.div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">
          {won ? 'Победа' : 'Партия окончена'}
        </p>
        <h2 className="mt-1 font-display text-3xl">
          {won ? <span className="gold-text">Вы выиграли!</span> : <span className="text-white/90">Вы проиграли</span>}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {won
            ? 'Вы остались последним, кто не «улетел».'
            : `Победитель — ${winner?.name ?? '—'}.`}
        </p>

        <div className="mt-5 space-y-3">
          <PremiumButton full onClick={onRestart}>
            Новая партия
          </PremiumButton>
          <PremiumButton full variant="ghost" onClick={onMenu}>
            В меню
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.4 + Math.random() * 2,
        rot: Math.random() * 360,
        gold: Math.random() > 0.4,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, opacity: 0, rotate: p.rot }}
          animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: p.rot + 360 }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity }}
          style={{ left: `${p.x}%` }}
          className={`absolute top-0 h-2.5 w-1.5 rounded-sm ${
            p.gold ? 'bg-gold-400' : 'bg-white/80'
          }`}
        />
      ))}
    </div>
  );
}

function logColor(kind: string): string {
  if (kind === 'special') return 'text-gold-300/90';
  if (kind === 'penalty') return 'text-wine-400/90';
  if (kind === 'win') return 'text-emerald-300/90';
  return 'text-white/55';
}
