/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './dist/index.html', './**/*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#030912',
          surface: '#1a1a1a',
          primary: '#1e64f0',
          accent: '#60a5fa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1300px' },
      },
      animation: {
        marquee: 'marquee-scroll 40s linear infinite',
        'marquee-lg': 'marquee-scroll 30s linear infinite',
      },
      keyframes: {
        'marquee-scroll': {
          '0%': { transform: 'translateZ(0)' },
          '100%': { transform: 'translate3d(-50%, 0, 0)' },
        },
        shimmer: {
          to: { transform: 'translateX(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
