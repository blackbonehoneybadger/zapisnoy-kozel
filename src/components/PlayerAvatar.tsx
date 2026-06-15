import { motion } from 'framer-motion';
import type { Player } from '../game/types';
import { GoatEmblem } from './GoatEmblem';

interface Props {
  player: Player;
  active: boolean;
  compact?: boolean;
}

/** Аватар игрока/бота с числом карт и счётом. */
export function PlayerAvatar({ player, active, compact }: Props) {
  return (
    <motion.div
      animate={active ? { scale: 1.06 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`flex flex-col items-center gap-1 ${player.busted ? 'opacity-40' : ''}`}
    >
      <div
        className={`relative grid place-items-center rounded-full ${
          compact ? 'h-12 w-12' : 'h-14 w-14'
        } ${
          active
            ? 'bg-gold-sheen shadow-glow'
            : 'bg-white/[0.05] border border-white/10'
        }`}
      >
        {player.isBot ? (
          <GoatEmblem size={compact ? 26 : 30} />
        ) : (
          <span className={`font-display ${active ? 'text-ink-900' : 'gold-text'} text-xl`}>
            Я
          </span>
        )}
        {active && (
          <span className="absolute -inset-1 rounded-full border border-gold-400/50 animate-pulse" />
        )}
        <span className="absolute -bottom-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-ink-900 px-1 text-xs font-bold text-gold-400 border border-gold-600/40">
          {player.hand.length}
        </span>
      </div>
      <div className="text-center leading-tight">
        <div className={`text-[11px] ${active ? 'text-gold-300' : 'text-white/70'}`}>
          {player.name}
        </div>
        <div className="text-[11px] font-semibold text-white/50">
          {player.busted ? 'улетел' : `${player.score} очк.`}
        </div>
      </div>
    </motion.div>
  );
}
