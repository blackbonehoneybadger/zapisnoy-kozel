/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#070a09',
          800: '#0b0f0d',
          700: '#111613',
        },
        graphite: {
          900: '#0c0f0e',
          800: '#141917',
          700: '#1b2220',
          600: '#252e2b',
        },
        felt: {
          900: '#06241c',
          800: '#0a3328',
          700: '#0f4435',
          600: '#155843',
        },
        gold: {
          400: '#f4d780',
          500: '#e7c168',
          600: '#caa24a',
          700: '#a07e2f',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(231,193,104,0.35), 0 8px 30px rgba(0,0,0,0.55)',
        card: '0 10px 30px -6px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)',
        glow: '0 0 30px rgba(231,193,104,0.25)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'felt-radial':
          'radial-gradient(120% 90% at 50% 0%, #155843 0%, #0a3328 45%, #06241c 100%)',
        'gold-sheen':
          'linear-gradient(135deg, #f4d780 0%, #caa24a 45%, #a07e2f 100%)',
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
      },
      animation: {
        shimmer: 'shimmer 3.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
