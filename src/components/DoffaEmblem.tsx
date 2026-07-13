interface Props {
  size?: number;
  className?: string;
}

/**
 * Эмблема DOFFA — чашка кофе с паром под рассветными лучами. Тот же мотив,
 * что на рубашке карт и логотипе кофейни: золото рассвета + горная зелень.
 * Интерфейс совпадает со старой эмблемой, чтобы вставать на её места 1:1.
 */
export function DoffaEmblem({ size = 96, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="doffaGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2d9a0" />
          <stop offset="0.5" stopColor="#e0a43b" />
          <stop offset="1" stopColor="#3a5e42" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#doffaGold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* рассветные лучи */}
        <path d="M32 6v5" />
        <path d="M18.5 10.5l2.6 4.4" />
        <path d="M45.5 10.5l-2.6 4.4" />
        {/* пар над чашкой */}
        <path d="M26.5 20c-1.4-2.4 1.4-3.6 0-6" />
        <path d="M32 19c-1.4-2.4 1.4-3.6 0-6" />
        <path d="M37.5 20c-1.4-2.4 1.4-3.6 0-6" />
        {/* чашка */}
        <path d="M18 26h26v7c0 7.2-5.8 13-13 13s-13-5.8-13-13v-7Z" />
        {/* ручка */}
        <path d="M44 29h3.5a4.5 4.5 0 0 1 0 9H42.5" />
        {/* блюдце */}
        <path d="M15 52c5 2.6 29 2.6 34 0" />
        {/* кофейное зерно на блюдце */}
        <path d="M29.5 57.5c0-1.4 2.2-2.5 2.5-2.5s2.5 1.1 2.5 2.5-2.2 2.5-2.5 2.5-2.5-1.1-2.5-2.5Z" strokeWidth="1.6" />
      </g>
    </svg>
  );
}
