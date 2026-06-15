import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType } from '../game/types';
import { Card } from './Card';

interface Props {
  cards: CardType[];
  isPlayable: (card: CardType) => boolean;
  onPlay: (card: CardType) => void;
  yourTurn: boolean;
}

/** Карты игрока веером снизу экрана. */
export function PlayerHand({ cards, isPlayable, onPlay, yourTurn }: Props) {
  const n = cards.length;
  const spread = Math.min(7, n * 1.6); // суммарный угол веера
  const step = n > 1 ? spread / (n - 1) : 0;

  return (
    <div className="relative flex h-44 items-end justify-center">
      <AnimatePresence initial={false}>
        {cards.map((card, i) => {
          const angle = -spread / 2 + step * i;
          const playable = yourTurn && isPlayable(card);
          const overlap = n > 7 ? -22 : -14;
          return (
            <motion.div
              key={card.id}
              layout
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: angle }}
              exit={{ y: -120, opacity: 0, transition: { duration: 0.25 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, delay: i * 0.015 }}
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
