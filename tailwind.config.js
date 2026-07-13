/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DOFFA: глубокий тёплый эспрессо вместо холодной черноты
        ink: {
          900: '#16110b',
          800: '#1e1710',
          700: '#2a2016',
        },
        // Тёплые приподнятые поверхности (обжаренное зерно)
        graphite: {
          900: '#181209',
          800: '#241c12',
          700: '#31271a',
          600: '#3e3122',
        },
        // Горная лесная зелень с эмблемы DOFFA
        felt: {
          900: '#18271c',
          800: '#213626',
          700: '#2c4832',
          600: '#3a5e42',
        },
        // Золотой рассвет DOFFA (основной акцент): амбра → охра
        gold: {
          300: '#f2d9a0',
          400: '#ecba54',
          500: '#e0a43b',
          600: '#bd8329',
          700: '#95661d',
        },
        // Терракота/обжиг — штрафы, опасность, тёплые акценты
        wine: {
          400: '#dd8a63',
          500: '#bb5c3c',
          600: '#8f432a',
          700: '#5d2b1c',
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
        gold: '0 0 0 1px rgba(224,164,59,0.34), 0 10px 40px -10px rgba(0,0,0,0.7)',
        card: '0 18px 44px -14px rgba(0,0,0,0.78), 0 4px 12px -4px rgba(0,0,0,0.5)',
        glow: '0 0 44px rgba(224,164,59,0.28)',
        soft: '0 28px 70px -24px rgba(0,0,0,0.85)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      },
      backgroundImage: {
        // Тёплый эспрессо-стол DOFFA с рассветной кромкой
        'felt-radial':
          'radial-gradient(125% 95% at 50% -5%, #3a2d1d 0%, #2a2014 40%, #1b140c 72%, #120c07 100%)',
        // Фирменный градиент DOFFA: рассвет амбра → охра → терракота
        'gold-sheen':
          'linear-gradient(135deg, #ecba54 0%, #e0a43b 42%, #bb5c3c 100%)',
        'champagne-line':
          'linear-gradient(90deg, transparent, rgba(224,164,59,0.55), transparent)',
        'obsidian-fade':
          'linear-gradient(180deg, rgba(22,17,11,0) 0%, rgba(22,17,11,0.7) 70%, #16110b 100%)',
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
        // Медленное вращение ободка стола
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // Пульсация свечения активного игрока/центра стола
        haloPulse: {
          '0%,100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.08)' },
        },
      },
      animation: {
        shimmer: 'shimmer 4.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
        breathe: 'breathe 7s ease-in-out infinite',
        drift: 'drift 26s ease-in-out infinite',
        'spin-slow': 'spinSlow 52s linear infinite',
        'spin-slower': 'spinSlow 80s linear infinite reverse',
        halo: 'haloPulse 3.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
