interface Props {
  size?: number;
  className?: string;
}

/** Золотая эмблема козла — используется в логотипе и аватарах. */
export function GoatEmblem({ size = 96, className = '' }: Props) {
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
        <linearGradient id="goatGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e3a1" />
          <stop offset="0.5" stopColor="#caa24a" />
          <stop offset="1" stopColor="#9c7a2c" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#goatGold)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 24c-4-3-8-2-9 2 6 1 7 6 7 9" />
        <path d="M44 24c4-3 8-2 9 2-6 1-7 6-7 9" />
        <path d="M22 22c2-5 6-8 10-8s8 3 10 8c2.5 6 2 13-2 18-2.4 3-5 4.5-8 4.5s-5.6-1.5-8-4.5c-4-5-4.5-12-2-18Z" />
        <path d="M26.5 31h.01M37.5 31h.01" />
        <path d="M28.5 41c2 1.8 5 1.8 7 0" />
        <path d="M32 14c0-2 0-4 .2-5" />
      </g>
    </svg>
  );
}
