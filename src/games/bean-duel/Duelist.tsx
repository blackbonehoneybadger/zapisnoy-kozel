// Боец Bean Duel — маскот-чашка DOFFA. Переиспользует фирменный логотип
// (см. src/components/DoffaMascot.tsx) вместо прототипной геометрической
// заглушки — команда соперника отличается тёплым сдвигом тона (CSS-фильтр),
// а не отдельным артом, пока не появится второй персонаж.
import { motion } from 'framer-motion';
import { FIGHTER_RADIUS, MAX_HP, type Fighter } from './engine';

interface Props {
  fighter: Fighter;
  team: 'player' | 'bot';
  label: string;
}

export function Duelist({ fighter, team, label }: Props) {
  const isDashing = fighter.dashingMs > 0;
  const isInvulnerable = fighter.invulnerableMs > 0;
  const isStunned = fighter.stunMs > 0;
  const hpPct = Math.max(0, Math.round((fighter.hp / MAX_HP) * 100));

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: fighter.pos.x - FIGHTER_RADIUS,
        top: fighter.pos.y - FIGHTER_RADIUS,
        width: FIGHTER_RADIUS * 2,
        height: FIGHTER_RADIUS * 2,
      }}
      animate={{
        scale: isDashing ? 1.12 : isStunned ? [1, 0.9, 1.05, 1] : 1,
        rotate: isDashing ? Math.atan2(fighter.facing.y, fighter.facing.x) * (180 / Math.PI) + 90 : 0,
      }}
      transition={{ duration: isStunned ? 0.26 : 0.12, ease: 'easeOut' }}
    >
      {/* след рывка */}
      {isDashing && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-md"
          style={{
            background: team === 'player'
              ? 'radial-gradient(circle, rgba(224,164,59,0.55), transparent 70%)'
              : 'radial-gradient(circle, rgba(58,150,110,0.55), transparent 70%)',
            transform: 'scale(1.8)',
          }}
        />
      )}
      {/* неуязвимость — тонкое сияющее кольцо */}
      {isInvulnerable && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-full"
          style={{ boxShadow: `0 0 0 2px ${team === 'player' ? 'rgba(224,164,59,0.8)' : 'rgba(58,150,110,0.8)'}` }}
        />
      )}
      <div
        className="relative h-full w-full overflow-hidden rounded-full shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]"
        style={{
          boxShadow: `inset 0 0 0 2px ${team === 'player' ? 'rgba(224,164,59,0.7)' : 'rgba(58,150,110,0.75)'}`,
        }}
      >
        <img
          src="/art/doffa-logo.webp"
          alt={label}
          draggable={false}
          className="h-full w-full object-cover"
          style={{
            filter:
              team === 'bot'
                ? 'hue-rotate(150deg) saturate(1.15) brightness(0.98)'
                : 'saturate(1.05)',
          }}
        />
        {fighter.hp < MAX_HP && (
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-wine-700/0 mix-blend-multiply" />
        )}
      </div>

      {/* HP-полоска над бойцом */}
      <div
        className="absolute left-1/2 h-1.5 w-14 -translate-x-1/2 overflow-hidden rounded-full bg-black/50"
        style={{ top: -12 }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{
            width: `${hpPct}%`,
            background: hpPct > 40 ? 'linear-gradient(90deg,#ecba54,#e0a43b)' : 'linear-gradient(90deg,#c25a5a,#8a3b3b)',
          }}
        />
      </div>
    </motion.div>
  );
}
