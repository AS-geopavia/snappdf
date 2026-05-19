/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,js}',
  ],
  safelist: [
    'hidden',
    'checking', 'downloading', 'ready', 'error',
    'disabled-row',
    'active',
    'info', 'success', 'warning',
    'log-item', 'log-time', 'log-msg',
    'file-icon', 'file-name', 'file-size', 'file-remove',
    'thumb-item', 'thumb-filename',
    'working', 'idle',
    'empty',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        violet: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};
