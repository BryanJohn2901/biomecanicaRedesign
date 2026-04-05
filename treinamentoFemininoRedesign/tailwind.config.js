/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './dist/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#d946ef',
          secondary: '#a855f7',
          bg: '#05020a',
          surface: '#120a17',
          surfaceHighlight: '#1f1129',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
