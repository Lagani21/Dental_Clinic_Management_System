/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial B&W palette (matches design spec)
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#F9FAFB',
          border:  '#E5E7EB',
        },
        // Keep primary blues for auth/login page compatibility
        primary: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
}