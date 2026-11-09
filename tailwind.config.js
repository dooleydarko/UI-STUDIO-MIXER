/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#000000',
          900: '#050505',
          850: '#080808',
          800: '#0d0d0d',
          700: '#141414',
          600: '#1e1e1e',
        },
        frost: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        }
      },
      boxShadow: {
        'obsidian-card': '0 8px 32px 0 rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'liquid-glass': '0 4px 24px -1px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
        'neon-glow': '0 0 20px rgba(56, 189, 248, 0.35)',
      }
    },
  },
  plugins: [],
}
