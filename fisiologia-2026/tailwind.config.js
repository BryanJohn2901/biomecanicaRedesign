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
          surfaceHighlight: '#1A1A1A',
          primary: '#00C2FF',
          accent: '#0088B2',
        },
      },
      backgroundImage: {
        mesh:
          'radial-gradient(at 0% 0%, rgba(0, 194, 255, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 194, 255, 0.05) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
