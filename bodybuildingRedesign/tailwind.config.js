/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './dist/index.html', './src/**/*.html'],
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
          primary: '#DC2626',
          accent: '#991B1B',
        },
      },
      backgroundImage: {
        mesh: 'radial-gradient(at 0% 0%, rgba(220, 38, 38, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(220, 38, 38, 0.05) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
