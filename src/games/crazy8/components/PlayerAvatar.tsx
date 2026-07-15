import { motion } from 'framer-motion';
import type { Player } from '../engine/types';
import { DoffaEmblem } from '../../../components/DoffaEmblem';

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
        className={`relative grid place-items-center ${
          compact ? 'h-12 w-12' : 'h-14 w-14'
        } ${active ? 'hex-clip' : 'rounded-full'} ${
          active
            ? 'bg-gold-sheen'
            : 'bg-white/[0.05] border border-white/10 rounded-full'
        }`}
      >
        {/* пульсирующее шестиугольное свечение при ходе */}
        {active && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-2 -z-10 hex-clip animate-halo"
              style={{ background: 'radial-gradient(60% 60% at 50% 45%, rgba(224,164,59,0.6), rgba(58,94,66,0.2) 55%, transparent 72%)' }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-[2px] -z-10 hex-clip"
              style={{ background: 'linear-gradient(135deg, rgba(242,217,160,0.9), rgba(58,94,66,0.5))' }}
            />
          </>
        )}
        {player.isBot ? (
          <DoffaEmblem size={compact ? 26 : 30} />
        ) : (
          <span className={`font-display ${active ? 'text-ink-900' : 'gold-text'} text-xl`}>
            {(player.name.trim()[0] ?? 'И').toUpperCase()}
          </span>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-ink-900 px-1 text-xs font-bold text-gold-400 border border-gold-600/40">
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
