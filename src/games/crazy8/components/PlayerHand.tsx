import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType } from '../engine/types';
import { Card } from './Card';

interface Props {
  cards: CardType[];
  isPlayable: (card: CardType) => boolean;
  onPlay: (card: CardType) => void;
  yourTurn: boolean;
}

/** Карты игрока веером снизу экрана. */
// Размеры карты (px) — должны соответствовать Card normal size (w-[4.5rem]).
const CARD_W = 72;
const MAX_FAN_W = 340; // веер не шире этого, чтобы влезал на узких экранах

export function PlayerHand({ cards, isPlayable, onPlay, yourTurn }: Props) {
  const n = cards.length;
  const spread = Math.min(8, n * 1.6); // суммарный угол веера
  const step = n > 1 ? spread / (n - 1) : 0;

  // Перекрытие подбираем так, чтобы веер всегда помещался по ширине.
  let overlap = -14;
  if (n > 1) {
    const fit = (MAX_FAN_W - CARD_W) / (n - 1) - CARD_W;
    overlap = Math.max(-56, Math.min(-10, fit));
  }

  // Detect initial deal: hand goes from 0 → N cards
  const wasEmptyRef = useRef(true);
  const isInitialDeal = wasEmptyRef.current && cards.length > 1;

  useEffect(() => {
    wasEmptyRef.current = cards.length === 0;
  }, [cards.length]);

  return (
    <div className="relative flex h-[10.5rem] items-end justify-center">
      <AnimatePresence initial={false}>
        {cards.map((card, i) => {
          const angle = -spread / 2 + step * i;
          const playable = yourTurn && isPlayable(card);
          return (
            <motion.div
              key={card.id}
              layout
              initial={
                isInitialDeal
                  ? { y: 150, opacity: 0, scale: 0.88 }
                  : { y: 80, opacity: 0 }
              }
              animate={{ y: 0, opacity: 1, rotate: angle, scale: 1 }}
              exit={{ y: -120, opacity: 0, transition: { duration: 0.25 } }}
              transition={
                isInitialDeal
                  ? { type: 'spring', stiffness: 180, damping: 20, delay: i * 0.075 }
                  : { type: 'spring', stiffness: 260, damping: 24, delay: i * 0.015 }
              }
              style={{ marginLeft: i === 0 ? 0 : overlap, transformOrigin: 'bottom center' }}
              className="relative"
            >
              <Card
                card={card}
                playable={playable}
                dimmed={yourTurn && !playable}
                onClick={playable ? () => onPlay(card) : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
