/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Marcellus', 'Georgia', 'serif'],
        sans: ['Marcellus', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#f9cccc',
          300: '#f4a3a3',
          400: '#ec6b6b',
          500: '#df3b3b',
          600: '#cc2222',
          700: '#ab1a1a',
          800: '#8b1818',
          900: '#751a1a',
          950: '#400808',
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'ken-burns': 'kenBurns 8s ease-in-out infinite',
      },
      keyframes: {
        kenBurns: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
