/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Medkit cozy plush palette
        'cap-cream': '#FFF6E6',
        'cap-cream-2': '#FFEFD1',
        'cap-paper': '#FFFAF0',
        'cap-peach': '#FFB68A',
        'cap-peach-deep': '#FF8E5C',
        'cap-butter': '#FFD86B',
        'cap-butter-deep': '#F5B73D',
        'cap-mint': '#A8E5C8',
        'cap-mint-deep': '#5FCFA0',
        'cap-sky': '#A6D8FF',
        'cap-sky-deep': '#5AB7F2',
        'cap-rose': '#FFB3C0',
        'cap-rose-deep': '#F47A92',
        'cap-ink': '#3B2A1F',
        'cap-ink-2': '#6B4F3F',
        'cap-ink-soft': '#8E7261',
        'cap-line': '#2B1E16',

        // Legacy aliases (mapped to new palette for gradual migration)
        'cap-bg': '#FFF6E6',
        'cap-surface': '#FFFAF0',
        'cap-surface-2': '#FFEFD1',
        'cap-border': '#2B1E16',
        'cap-text': '#3B2A1F',
        'cap-text-muted': '#6B4F3F',
        'cap-primary': '#FFB68A',
        'cap-primary-dim': '#FFE6D1',
        'cap-accent': '#A8E5C8',
        'cap-accent-warm': '#FFD86B',
        'cap-accent-danger': '#F47A92',
        'cap-accent-purple': '#A6D8FF',
      },
      borderRadius: {
        'plush': '36px',
        'plush-md': '22px',
        'plush-sm': '14px',
      },
      fontFamily: {
        'cozy': ['"Nunito"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
