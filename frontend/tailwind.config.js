/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled from the workbook's header bands (navy) and row banding (light blue).
        navy: {
          50: '#eef2f9', 100: '#d7e0f0', 200: '#b0c2e0', 300: '#7d9bcb',
          400: '#4d73b2', 500: '#2f5596', 600: '#264a83', 700: '#1f3864',
          800: '#18294a', 900: '#111c33',
        },
        sky: {
          50: '#f3f8fd', 100: '#dbeafe', 200: '#bfdcf7', 300: '#93c5ed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 28, 51, 0.06), 0 8px 24px -12px rgba(17, 28, 51, 0.18)',
      },
      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up .22s ease-out',
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },
  plugins: [],
};
