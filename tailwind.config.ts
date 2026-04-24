import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(148, 163, 184, 0.08), 0 24px 80px rgba(2, 6, 23, 0.35)',
      },
    },
  },
  plugins: [],
}

export default config
