import type { Config } from 'tailwindcss'

const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        bg: v('--bg'),
        surface: v('--surface'),
        'surface-2': v('--surface-2'),
        fg: v('--fg'),
        muted: v('--muted'),
        line: v('--line'),
        brand: v('--brand'),
        accent: v('--accent'),
        'accent-fg': v('--accent-fg'),
        danger: v('--danger'),
        warning: v('--warning'),
        success: v('--success')
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Arabic"', '"Geeza Pro"', '"Noto Naskh Arabic"', 'system-ui', 'sans-serif']
      },
      borderRadius: { ios: '12px', card: '16px', sheet: '22px' },
      boxShadow: {
        card: '0 1px 2px rgb(18 61 54 / 0.06), 0 8px 24px rgb(18 61 54 / 0.06)',
        float: '0 10px 40px rgb(0 0 0 / 0.18)'
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'none' } },
        'push-in': { from: { opacity: '0', transform: 'translateX(calc(var(--push-dir, 1) * 24px))' }, to: { opacity: '1', transform: 'none' } }
      },
      animation: {
        'sheet-up': 'sheet-up 280ms cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 180ms ease-out',
        'pop-in': 'pop-in 200ms ease-out',
        'push-in': 'push-in 240ms cubic-bezier(.2,.8,.2,1)'
      }
    }
  },
  plugins: []
} satisfies Config
