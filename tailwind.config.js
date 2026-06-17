/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Обсидиан — глубокая, тёплая чернота вместо плоского чёрного
        ink: {
          900: '#08090b',
          800: '#0c0e11',
          700: '#13151a',
        },
        // Холодные приподнятые поверхности
        graphite: {
          900: '#0a0b0e',
          800: '#14161b',
          700: '#1c1f26',
          600: '#272b34',
        },
        // Глубокий кинематографичный нефрит-мята (зелёная грань Solana)
        felt: {
          900: '#05221a',
          800: '#073325',
          700: '#0a4733',
          600: '#0f5d44',
        },
        // Фирменный фиолет Solana (основной акцент вместо золота)
        gold: {
          300: '#d8c7ff',
          400: '#c4a5ff',
          500: '#9945ff',
          600: '#7c3aed',
          700: '#5b21b6',
        },
        // Приглушённый бордо для штрафов/опасности
        wine: {
          400: '#d98a93',
          500: '#b9505d',
          600: '#8f3a45',
          700: '#5e2630',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        luxe: '0.42em',
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(153,69,255,0.34), 0 10px 40px -10px rgba(0,0,0,0.7)',
        card: '0 18px 44px -14px rgba(0,0,0,0.78), 0 4px 12px -4px rgba(0,0,0,0.5)',
        glow: '0 0 44px rgba(153,69,255,0.30)',
        soft: '0 28px 70px -24px rgba(0,0,0,0.85)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      },
      backgroundImage: {
        // Глубокий фиолет с мятной кромкой — стол в духе Solana
        'felt-radial':
          'radial-gradient(125% 95% at 50% -5%, #3b1d6e 0%, #241046 40%, #120726 72%, #080414 100%)',
        // Фирменный градиент Solana: фиолет → мята
        'gold-sheen':
          'linear-gradient(135deg, #9945ff 0%, #8b5cf6 38%, #19d68a 100%)',
        'champagne-line':
          'linear-gradient(90deg, transparent, rgba(153,69,255,0.55), transparent)',
        'obsidian-fade':
          'linear-gradient(180deg, rgba(8,9,11,0) 0%, rgba(8,9,11,0.7) 70%, #08090b 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        breathe: {
          '0%,100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.06)' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) rotate(0deg)' },
          '50%': { transform: 'translate3d(3%,-2%,0) rotate(4deg)' },
        },
      },
      animation: {
        shimmer: 'shimmer 4.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
        breathe: 'breathe 7s ease-in-out infinite',
        drift: 'drift 26s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
