/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/main.js'],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0c0c0c',
        'brand-surface': '#1a1a1a',
        'brand-surfaceHighlight': '#262626',
        'brand-primary': '#5e7faa',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        marquee: 'marquee-scroll 100s linear infinite',
      },
      keyframes: {
        'marquee-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          to: { transform: 'translateX(100%)' },
        },
      },
      backgroundImage: {
        mesh: 'radial-gradient(at 0 0, rgba(94,127,170,.25) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(94,127,170,.1) 0, transparent 50%)',
      },
    },
  },
  plugins: [],
};
