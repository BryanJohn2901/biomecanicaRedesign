/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#050505',
          surface: '#121212',
          surfaceHighlight: '#1E1E1E',
          primary: '#FFB800',
          secondary: '#F59E0B',
        }
      },
      backgroundImage: {
        'mesh': "radial-gradient(at 0% 0%, rgba(255, 184, 0, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.1) 0px, transparent 50%)",
      },
      keyframes: {
        'marquee-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'marquee': 'marquee-scroll 60s linear infinite',
      },
    }
  },
  plugins: [],
}
