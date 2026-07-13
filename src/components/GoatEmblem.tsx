interface Props {
  size?: number;
  className?: string;
}

/** Шампань-эмблема козла — логотип и аватары. Изящные линии, благородный металл. */
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
          <stop offset="0" stopColor="#f2d9a0" />
          <stop offset="0.5" stopColor="#e0a43b" />
          <stop offset="1" stopColor="#3a5e42" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#goatGold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* изящные рога */}
        <path d="M21 23c-5-3.5-9.5-2-10.5 2.5 6.5 1 8 6.5 7.6 10.5" />
        <path d="M43 23c5-3.5 9.5-2 10.5 2.5-6.5 1-8 6.5-7.6 10.5" />
        {/* морда */}
        <path d="M22.5 21c2-5.2 5.6-8 9.5-8s7.5 2.8 9.5 8c2.6 6.4 2 13.6-2.2 18.8-2.4 3-5 4.6-7.3 4.6s-4.9-1.6-7.3-4.6C20.5 34.6 19.9 27.4 22.5 21Z" />
        {/* глаза */}
        <path d="M27 30.5h.01M37 30.5h.01" />
        {/* улыбка */}
        <path d="M28.5 40.5c2.2 2 4.8 2 7 0" />
        {/* «бородка» / хохолок */}
        <path d="M32 13c0-2 .1-3.6.4-4.8" />
        <path d="M30.5 46.5c1 1.4 2.5 1.4 3 0" />
      </g>
    </svg>
  );
}
