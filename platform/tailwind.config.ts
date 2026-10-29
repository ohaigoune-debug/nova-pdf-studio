import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1280px' } },
    extend: {
      fontFamily: {
        sans: ['var(--font-arabic)', 'Segoe UI', 'Tahoma', 'sans-serif'],
        // عناوين الواجهة (هوية v2): El Messiri — أميري يبقى لمستندات الطباعة والدروس فقط
        display: ['var(--font-heading)', 'var(--font-arabic)', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-arabic)', 'sans-serif'],
        // شعر واقتباسات: رقعة
        ruqaa: ['"Aref Ruqaa"', 'Amiri', 'serif']
      },
      colors: {
        purple: 'hsl(var(--purple) / <alpha-value>)',
        cyan: 'hsl(var(--cyan) / <alpha-value>)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        brand: {
          blue: 'hsl(var(--brand-blue) / <alpha-value>)',
          navy: 'hsl(var(--brand-navy) / <alpha-value>)',
          lime: 'hsl(var(--brand-lime) / <alpha-value>)',
          paper: 'hsl(var(--brand-paper) / <alpha-value>)'
        },
        // لعبة البطاقات: رموز مرجع التصميم، معرّفة داخل .play-deck فقط (globals.css)
        deck: {
          bg: 'hsl(var(--deck-bg) / <alpha-value>)',
          back: 'hsl(var(--deck-back) / <alpha-value>)',
          'back-deep': 'hsl(var(--deck-back-deep) / <alpha-value>)',
          line: 'hsl(var(--deck-line) / <alpha-value>)',
          gold: 'hsl(var(--deck-gold) / <alpha-value>)',
          'gold-ink': 'hsl(var(--deck-gold-ink) / <alpha-value>)'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          border: 'hsl(var(--sidebar-border))',
          active: 'hsl(var(--sidebar-active))'
        }
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: '12px',
        sm: '9px'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-5px)' }, '40%, 80%': { transform: 'translateX(5px)' } },
        pop: { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } }
      },
      animation: {
        'fade-in': 'fade-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.2s ease-out',
        'rise-in': 'rise-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 6s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
        pop: 'pop 0.3s ease-out'
      }
    }
  },
  plugins: []
}

export default config
